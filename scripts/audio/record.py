"""Records the fixed Latin texts with a neural voice, as the learner chose
("recorded neural audio, the same voice on every device").

    python3 -m venv /tmp/piper && /tmp/piper/bin/pip install piper-tts
    # a voice from https://huggingface.co/rhasspy/piper-voices (model + .json)
    /tmp/piper/bin/python -I scripts/audio/record.py --voice es_MX-claude-high.onnx

It bundles scripts/audio/texts.ts (the texts, their keys and the Spanish
respelling of src/audio/pronounce.ts), reads each one with Piper, trims the
silence, puts the clips of one pack (a lesson, the stories of a step, the
rules, the words) one after another into an MP3, and writes each pack as a
small script beside the page, src/content/audio/<pack>-<hash>.js, that sets
window.__tabulaAudio[pack] to the MP3 in base64 (a script loads beside the page
the way the code does; the page plays it with Web Audio). The index,
src/audio/recorded-index.json, says where each clip is: key -> [pack, start ms,
length ms]. Run it again after adding texts (a new lesson): a pack whose texts
and respellings are unchanged is kept as it is (the voice reads a little
differently every time, so re-recording it would only make a new file to
publish); --fresh records every pack again.
"""

import argparse
import base64
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import wave
from array import array

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, "src", "content", "audio")
INDEX = os.path.join(ROOT, "src", "audio", "recorded-index.json")
GAP = 0.3  # seconds of silence between clips in a pack
PAD = 0.04  # seconds kept before and after each trimmed clip


def texts(tmp):
    """Bundles and runs the collector; returns its list of {key, latin, say, pack} and their fingerprint."""
    bundle = os.path.join(tmp, "texts.mjs")
    out = os.path.join(tmp, "texts.json")
    subprocess.run(
        ["npx", "esbuild", "scripts/audio/texts.ts", "--bundle", "--platform=node", "--format=esm",
         f"--outfile={bundle}", "--log-level=warning", "--jsx=automatic", "--jsx-import-source=preact"],
        cwd=ROOT, check=True)
    subprocess.run(["node", bundle, out], cwd=ROOT, check=True)
    with open(out, encoding="utf-8") as f:
        data = json.load(f)
    return data["texts"], data["fingerprint"]


# Spanish softens b between vowels (β); Latin said it hard. (A hard d and g were
# tried too: a speech recognizer heard them no better, and «videō» came out as
# "cuidado", so the voice keeps its own.)
HARD = {"β": "b"}


def latin_phonemes(voice, say):
    """The voice's phonemes for the respelled text, made more Latin: a hard b,
    and the h that Spanish leaves silent at the start of a word (habet)."""
    words = [w for w in say.split() if any(c.isalpha() for c in w)]
    out = []
    for sentence in voice.phonemize(say):
        ph = [HARD.get(p, p) for p in sentence]
        # the start of each word in the phonemes: after a space, or the first
        starts = [0] + [i + 1 for i, p in enumerate(ph) if p == " "]
        for wi in reversed(range(min(len(starts), len(words)))):
            if words[wi].lower().lstrip("¡¿\"'(").startswith("h"):
                i = starts[wi]
                if i < len(ph) and ph[i] == "ˈ":
                    i += 1
                ph.insert(i, "h")
        out.append(ph)
    return out


def speak(voice, say, cfg):
    """The audio of one text, as 16-bit samples."""
    parts = []
    for ph in latin_phonemes(voice, say):
        audio = voice.phoneme_ids_to_audio(voice.phonemes_to_ids(ph), syn_config=cfg)
        parts.extend(float(a) for a in (audio[0] if isinstance(audio, tuple) else audio))
    # every clip at the same loudness: its peak at 90% of full scale
    peak = max((abs(a) for a in parts), default=0) or 1
    return array("h", (int(a / peak * 0.9 * 32767) for a in parts))


def pack_hash(xs):
    """What a pack holds: its texts, their respellings and their order."""
    return hashlib.sha256("\n".join(f"{x['key']}\t{x['say']}" for x in xs).encode("utf-8")).hexdigest()[:12]


def trim(samples, rate, threshold=350):
    """Cuts the silence at both ends, keeping a little padding."""
    n = len(samples)
    start = next((i for i in range(n) if abs(samples[i]) > threshold), 0)
    end = next((i for i in range(n - 1, -1, -1) if abs(samples[i]) > threshold), n - 1)
    pad = int(PAD * rate)
    return samples[max(0, start - pad):min(n, end + pad + 1)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True, help="a Piper model (.onnx, with its .onnx.json beside it)")
    ap.add_argument("--length-scale", type=float, default=1.12, help="above 1 is slower (a learner's pace)")
    ap.add_argument("--only", help="record only this pack (to try a voice)")
    ap.add_argument("--fresh", action="store_true", help="record every pack again, also the unchanged ones")
    args = ap.parse_args()

    from piper import PiperVoice, SynthesisConfig

    voice = PiperVoice.load(args.voice)
    rate = voice.config.sample_rate
    cfg = SynthesisConfig(length_scale=args.length_scale)
    with tempfile.TemporaryDirectory() as tmp:
        items, fp = texts(tmp)
        if args.only:
            items = [x for x in items if x["pack"] == args.only]
        packs = {}
        for x in items:
            packs.setdefault(x["pack"], []).append(x)
        clips = {}
        names = {}
        hashes = {}
        os.makedirs(OUT_DIR, exist_ok=True)
        # the packs recorded before, kept when their texts are the same
        old = {}
        if os.path.exists(INDEX) and not args.fresh and not args.only:
            with open(INDEX, encoding="utf-8") as f:
                old = json.load(f)
        if old.get("voice") != os.path.basename(args.voice).replace(".onnx", ""):
            old = {}
        kept = set()
        for pack, xs in packs.items():
            name = old.get("packs", {}).get(pack)
            if name and old.get("hashes", {}).get(pack) == pack_hash(xs) and os.path.exists(os.path.join(OUT_DIR, name)):
                kept.add(pack)
                names[pack] = name
                hashes[pack] = pack_hash(xs)
                clips.update({k: v for k, v in old["clips"].items() if v[0] == pack})
                print(f"{pack}: unchanged, kept audio/{name}", flush=True)
        if not args.only:
            for f in os.listdir(OUT_DIR):
                if f.endswith(".js") and f not in {names[p] for p in kept}:
                    os.remove(os.path.join(OUT_DIR, f))
        for pack, xs in sorted(packs.items()):
            if pack in kept:
                continue
            pcm = array("h")
            gap = array("h", [0] * int(GAP * rate))
            for i, x in enumerate(xs):
                samples = trim(speak(voice, x["say"], cfg), rate)
                pcm.extend(gap)
                start = len(pcm) / rate
                pcm.extend(samples)
                clips[x["key"]] = [pack, round(start * 1000), round(len(samples) / rate * 1000)]
                if i % 25 == 0:
                    print(f"  {pack}: {i + 1}/{len(xs)} «{x['latin']}» → {x['say']}", flush=True)
            pcm.extend(gap)
            wav_path = os.path.join(tmp, f"{pack}.wav")
            with wave.open(wav_path, "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(rate)
                w.writeframes(pcm.tobytes())
            mp3_path = os.path.join(tmp, f"{pack}.mp3")
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav_path, "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "40k", mp3_path], check=True)
            data = open(mp3_path, "rb").read()
            digest = hashlib.sha256(data).hexdigest()[:8]
            name = f"{pack}-{digest}.js"
            with open(os.path.join(OUT_DIR, name), "w", encoding="ascii") as f:
                f.write(f'(window.__tabulaAudio=window.__tabulaAudio||{{}})["{pack}"]="{base64.b64encode(data).decode()}";\n')
            names[pack] = name
            hashes[pack] = pack_hash(xs)
            print(f"{pack}: {len(xs)} clips, {len(pcm) / rate:.0f} s, {len(data) / 1024:.0f} KB → audio/{name}", flush=True)
        if args.only:
            print("(a trial: the index is left as it was)")
            return
        index = {"voice": os.path.basename(args.voice).replace(".onnx", ""), "fingerprint": fp, "packs": dict(sorted(names.items())), "hashes": dict(sorted(hashes.items())), "clips": dict(sorted(clips.items()))}
        with open(INDEX, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        print(f"{len(clips)} clips in {len(names)} packs → {os.path.relpath(INDEX, ROOT)}")


if __name__ == "__main__":
    sys.exit(main())

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { FRIEND_VOICES, voiceOfPerson, voiceText, withRecordings } from "../src/chat/voices";
import { Msg } from "../src/chat/model";
import { PEOPLE } from "../src/content/people";

const T = Date.UTC(2026, 9, 19, 18, 0);
const msg = (from: string, la: string, extra: Partial<Msg> = {}): Msg => ({ id: `m${from}${la.length}`, from, la, at: T, ...extra });
const who = (id: string) => PEOPLE.find((p) => p.id === id) ?? (id.startsWith("s-") ? { id, g: (id.endsWith("f") ? "f" : "m") as "m" | "f" } : null);

describe("the people's own voices in their voice messages", () => {
  it("gives each friend a voice of their own, and anyone else a steady one of their sex", () => {
    const names = PEOPLE.map((p) => voiceOfPerson(p).name);
    expect(new Set(names).size).toBe(PEOPLE.length);
    expect(Object.keys(FRIEND_VOICES).sort()).toEqual(PEOPLE.map((p) => p.id).sort());
    expect(voiceOfPerson({ id: "s-abc", g: "m" })).toEqual(voiceOfPerson({ id: "s-abc", g: "m" }));
    const women = ["s-1", "s-2", "s-3", "s-4", "s-5"].map((id) => voiceOfPerson({ id, g: "f" }).name);
    expect(women.every((n) => /Harper|Rosa|Valeria|Marta/.test(n))).toBe(true);
  });

  it("reads the classical respelling for its voice, without emoji", () => {
    expect(voiceText("Salvē, amīce! 😂 :lupa: Hodiē sōl lūcet.", { name: "es-MX-Valeria", lang: "es" })).toBe("sálue, amíque! hódie sol lúquet.");
    expect(voiceText("Salvē, amīce!", { name: "it-IT-Luca", lang: "it" })).toBe("salue, amiche!");
  });

  it("wants a recording for each of the people's voice messages, never for the learner's own", () => {
    const { messages, wanted } = withRecordings([msg("iulia", "Salvē, amīce!", { voice: true }), msg("me", "Salvē!", { voice: true }), msg("marcus", "Ita."), msg("s-xf", "Valē!", { voice: true }), msg("gaius", "Iam!", { voice: true, rec: "vold" })], who, T);
    expect(messages.map((m) => m.rec)).toEqual(["vmiulia13", undefined, undefined, "vms-xf5", "vold"]);
    expect(wanted).toHaveLength(2);
    expect(wanted[0]).toMatchObject({ id: "vmiulia13", by: "iulia", en: "Salvē, amīce!", prompt: "sálue, amíque!", kind: "voice", voice: "es-MX-Valeria", status: "wanted", at: T });
  });

  it("is recorded by the routine's helper: the voice asked for, made small, with its length", () => {
    const code = `
import base64, importlib.util, io, json, os, shutil, subprocess, sys, tempfile, urllib.error
sys.stderr = open(os.devnull, "w")
spec = importlib.util.spec_from_file_location("h", sys.argv[1]); h = importlib.util.module_from_spec(spec); spec.loader.exec_module(h)
if not shutil.which("ffmpeg"):
    print(json.dumps({"skip": True})); sys.exit()
tmp = tempfile.mkdtemp()
src = os.path.join(tmp, "tone.mp3")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-ac", "2", "-b:a", "160k", src], check=True)
big = open(src, "rb").read()
asked = []
class R:
    def __init__(s, body): s.body = body
    def __enter__(s): return s
    def __exit__(s, *a): return False
    def read(s): return s.body
def fake(req, timeout=0):
    asked.append(json.loads(req.data)); return R(big)
h.urllib.request.urlopen = fake
json.dump([{"id": "vm1", "prompt": "sálue!", "kind": "voice", "voice": "es-MX-Valeria"}], open(os.path.join(tmp, "w.json"), "w"))
h.pictures(os.path.join(tmp, "w.json"), os.path.join(tmp, "made"))
doc = json.load(open(os.path.join(tmp, "made", "vm1.json")))
print(json.dumps({"asked": asked, "status": doc["status"], "type": doc.get("type"), "secs": doc.get("secs"), "len": len(base64.b64decode(doc.get("b64", ""))), "big": len(big)}))
`;
    const helper = new URL("../scripts/nuntii-routine.py", import.meta.url).pathname;
    let out: string;
    try {
      out = execFileSync("python3", ["-I", "-c", code, helper], { encoding: "utf8" });
    } catch (e) {
      if ((e as { code?: string }).code === "ENOENT") return; // no python here
      throw e;
    }
    const res = JSON.parse(out.trim().split("\n").at(-1)!);
    if (res.skip) return; // no ffmpeg here
    expect(res.asked).toEqual([{ model: "microsoft/mai-voice-2.1-flash", voice: "es-MX-Valeria", input: "sálue!", response_format: "mp3" }]);
    expect(res).toMatchObject({ status: "done", type: "audio/mpeg" });
    expect(res.secs).toBeGreaterThan(2.5);
    expect(res.len).toBeLessThan(res.big / 2);
  });
});

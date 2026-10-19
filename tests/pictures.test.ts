import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { photoHabits, photoRoom, withLooks } from "../src/chat/pictures";
import { writeReply } from "../src/chat/engine";
import { makeBrief } from "../src/chat/brief";
import { Msg, newMeta, newThread, Thread } from "../src/chat/model";
import { GROUP, PEOPLE, PERSON_BY_ID } from "../src/content/people";
import { allowedWords, chatEntries, chatLexicon, nameEntry } from "../src/chat/words";
import { LESSONS } from "../src/content/lessons";
import { PARTS } from "../src/content/parts";
import { seeded } from "../src/latin/generate";

const entries = chatEntries(LESSONS.flatMap((l) => l.words), [nameEntry("Kiril", "Kiril (your name)", "m")]);
const lex = chatLexicon(entries);
const seen = new Set(PARTS.flatMap((p) => p.skills));
const T0 = Date.UTC(2026, 9, 19, 11, 0);
const H = 3600_000;
const ctxAt = (now: number) => ({ now, me: { name: "Kiril", g: "m" as const }, tz: "Europe/Kyiv", words: allowedWords(entries, seen), seen, canMake: true });
const look = (id: string) => PERSON_BY_ID.get(id)!.nature.look;
const meta = newMeta();
const photoMsg = (from: string, at: number, extra: Partial<Msg> = {}): Msg => ({ id: `p${at}${from}`, from, la: "Ecce!", at, photo: "any-cat", ...extra });

describe("pictures that look like their senders", () => {
  it("draws a selfie's sender and anyone named as they look, their names left out", () => {
    expect(withLooks("selfie at the theatre, laughing", "iulia", meta)).toBe(`${look("iulia")}. selfie at the theatre, laughing`);
    expect(withLooks("Iūlia's new lyre, and Marcus asleep on the couch behind it", "lucius", meta)).toBe(`${look("iulia")}; and ${look("marcus")}. her new lyre, and the man asleep on the couch behind it`);
    // named without long marks; a selfie with someone else: the sender first
    expect(withLooks("selfie with Gaius and his goat", "marcus", meta)).toBe(`${look("marcus")}; and ${look("gaius")}. selfie with the man and his goat`);
    expect(withLooks("a goat on the roof", "gaius", meta)).toBe("a goat on the roof");
    // a word that only contains a name is not the name
    expect(withLooks("the lucidity of the morning", "iulia", meta)).toBe("the lucidity of the morning");
  });

  it("makes a fresh picture from the looks, while the chat shows what Claude said it shows", async () => {
    const ask = async <T,>(): Promise<T> => ({ messages: [{ from: "lucius", la: "Ecce!", en: "Look!", picture: "moody selfie by the light of an oil lamp" }] }) as T;
    const reply = await writeReply({ ...newThread("lucius", "dm"), messages: [{ id: "a", from: "me", la: "Ubi es?", at: T0 }] }, newMeta(), ctxAt(T0), { ask, opts: {}, lex, r: seeded(2) });
    expect(reply.made[0].prompt).toBe(`${look("lucius")}. moody selfie by the light of an oil lamp`);
    expect(reply.made[0].en).toBe("moody selfie by the light of an oil lamp");
    expect(reply.messages[0].picEn).toBe("moody selfie by the light of an oil lamp");
  });
});

describe("photos by each one's habit", () => {
  it("lets Iūlia send a few a day, Claudia one, Gāius one in three days", () => {
    const t: Thread = { ...newThread(GROUP.id, "group"), messages: [photoMsg("iulia", T0 - 2 * H), photoMsg("claudia", T0 - 20 * H), photoMsg("gaius", T0 - 30 * H)] };
    expect(photoRoom("iulia", meta, [t], T0)).toBe(2);
    expect(photoRoom("claudia", meta, [t], T0)).toBe(0);
    expect(photoRoom("claudia", meta, [t], T0 + 5 * H)).toBe(1);
    expect(photoRoom("gaius", meta, [t], T0 + 30 * H)).toBe(0);
    expect(photoRoom("gaius", meta, [t], T0 + 43 * H)).toBe(1);
    const drafts = [
      { from: "gaius", la: "Ecce caper!", photo: "gaius-goat" },
      { from: "gaius", la: "", picture: "the goat again" },
      { from: "iulia", la: "", photo: "iulia-figs" },
      { from: "iulia", la: "Et hoc!", picture: "her new stola" },
    ];
    // Gāius sent one yesterday: his photo goes, his words stay; Iūlia may send both
    expect(photoHabits(drafts, meta, [t], T0)).toEqual([{ from: "gaius", la: "Ecce caper!" }, drafts[2], drafts[3]]);
  });

  it("keeps the phone routine to the same habits and looks (its helper agrees)", () => {
    const dir = mkdtempSync(join(tmpdir(), "nuntii-pics-"));
    const base = join(dir, "data/users/me/messenger");
    mkdirSync(join(base, "threads"), { recursive: true });
    mkdirSync(join(base, "brief"), { recursive: true });
    writeFileSync(base + ".json", JSON.stringify(newMeta()));
    const ctx = { ...ctxAt(T0), words: allowedWords(entries, seen) };
    writeFileSync(join(base, "brief/now.json"), JSON.stringify(makeBrief(newMeta(), ctx, [], seeded(1))));
    writeFileSync(join(base, "threads/gaius.json"), JSON.stringify({ ...newThread("gaius", "dm"), messages: [{ id: "x", from: "me", la: "Salvē", at: T0 - 40 * H }, photoMsg("gaius", T0 - 30 * H, { src: "reply" })] }));
    writeFileSync(join(dir, "draft.json"), JSON.stringify([{ chat: "gaius", from: "gaius", la: "Ecce!", en: "Look!", photo: "gaius-goat" }]));
    const env = (globalThis as unknown as { process: { env: Record<string, string> } }).process.env;
    const helper = new URL("../scripts/nuntii-routine.py", import.meta.url).pathname;
    const run = (...args: string[]) => execFileSync("python3", ["-I", helper, ...args], { env: { ...env, NUNTII_NOW: String(T0) }, encoding: "utf8" });
    let out: string;
    try {
      out = run("vet", dir, join(dir, "draft.json"), join(dir, "new.json"));
    } catch (e) {
      if ((e as { code?: string }).code === "ENOENT") return; // no python here
      throw e;
    }
    expect(out).toContain("gaius has sent enough photos lately (their habit)");
    expect(JSON.parse(readFileSync(join(dir, "new.json"), "utf8"))).toEqual([]);
    for (const [by, text] of [
      ["iulia", "selfie at the theatre, laughing"],
      ["lucius", "Iūlia's new lyre, and Marcus asleep on the couch behind it"],
      ["marcus", "selfie with Gaius and his goat"],
      ["gaius", "a goat on the roof"],
    ])
      expect(run("looks", dir, by, text).trim()).toBe(withLooks(text, by, meta));
    expect(PEOPLE.every((p) => p.nature.look.length > 40)).toBe(true);
  });
});

describe("pictures from the learner's Pollen first, the free generators after", () => {
  it("shrinks a picture for its document, falls back to the cheaper model without Pollen, and stops without a key", () => {
    // a fake Pollinations: MAI is out of Pollen (402), FLUX.2 Klein answers with a big PNG; then no key at all (401)
    const code = `
import base64, importlib.util, io, json, os, sys, urllib.error
sys.stderr = open(os.devnull, "w")
spec = importlib.util.spec_from_file_location("h", sys.argv[1]); h = importlib.util.module_from_spec(spec); spec.loader.exec_module(h)
from PIL import Image
buf = io.BytesIO(); Image.effect_noise((1024, 1024), 60).convert("RGB").save(buf, "PNG"); big = buf.getvalue()
asked = []
class R:
    def __init__(s, body): s.body = body
    def __enter__(s): return s
    def __exit__(s, *a): return False
    def read(s): return s.body
def fake(req, timeout=0):
    model = json.loads(req.data)["model"]; asked.append(model)
    if h.KEY_GONE: raise urllib.error.HTTPError(req.full_url, 401, "no key", {}, None)
    if "mai" in model: raise urllib.error.HTTPError(req.full_url, 402, "no pollen", {}, None)
    return R(json.dumps({"data": [{"b64_json": base64.b64encode(big).decode()}]}).encode())
h.urllib.request.urlopen = fake
h.KEY_GONE = False
kind, b64 = h.pollinations("a goat on the roof")
pic = Image.open(io.BytesIO(base64.b64decode(b64)))
again = h.pollinations("a goat in the kitchen")
first = list(asked)
h.POLL_OFF.clear(); h.KEY_GONE = True; asked.clear()
gone = h.pollinations("a goat in the forum"), h.pollinations("a goat in the baths")
print(json.dumps({"kind": kind, "size": pic.size, "len": len(b64), "big": len(big), "again": again is not None, "first": first, "gone": gone, "asked": asked, "off": h.POLL_OFF}))
`;
    const helper = new URL("../scripts/nuntii-routine.py", import.meta.url).pathname;
    let out: string;
    try {
      out = execFileSync("python3", ["-I", "-c", code, helper], { encoding: "utf8" });
    } catch (e) {
      if ((e as { code?: string }).code === "ENOENT") return; // no python here
      throw e;
    }
    const res = JSON.parse(out);
    expect(res.kind).toBe("image/webp");
    expect(res.size).toEqual([576, 576]);
    expect(res.len).toBeLessThan(250_000); // a document holds 256 KiB
    expect(res.big * 1.34).toBeGreaterThan(256 * 1024);
    // MAI is not asked again once it ran out; FLUX.2 Klein goes on
    expect(res.again).toBe(true);
    expect(res.first).toEqual(["microsoft/mai-image-2.6-flash", "black-forest-labs/flux.2-klein-4b", "black-forest-labs/flux.2-klein-4b"]);
    // without a key, Pollinations is asked once, then left for the free generators
    expect(res.gone).toEqual([null, null]);
    expect(res.asked).toEqual(["microsoft/mai-image-2.6-flash"]);
    expect(res.off).toEqual({ all: "HTTP 401" });
  });
});

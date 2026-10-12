# Helper for the phone routine of the messenger (scripts/messenger-routine.md
# carries the same code, since a routine's session may not have this repo).
# The routine saves the messenger's documents with ArtifactData (out_dir) into
# one folder, then:
#   python3 nuntii.py state  DIR             who is awake, moods, the chats
#   python3 nuntii.py check  DIR "msg" ...   every word allowed?
#   python3 nuntii.py notify DIR [new.json]  the line for the phone notification
# DIR holds data/users/me/messenger.json, data/users/me/messenger/brief/now.json
# and data/users/me/messenger/threads/*.json (as ArtifactData saves them).
import glob, json, os, re, sys, time, unicodedata
from datetime import datetime
from zoneinfo import ZoneInfo


def load(path, default=None):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def docs(d):
    base = os.path.join(d, "data/users/me/messenger")
    meta = load(base + ".json", {}) or {}
    brief = load(os.path.join(base, "brief/now.json"))
    threads = {os.path.basename(p)[:-5]: load(p, {}) for p in glob.glob(os.path.join(base, "threads/*.json"))}
    return meta, brief, threads


def hours(t, tz):
    dt = datetime.fromtimestamp(t / 1000, ZoneInfo(tz))
    return dt.hour + dt.minute / 60, dt.strftime("%a %H:%M")


def inside(h, a, b):
    a, b = a % 24, b % 24
    return a <= h < b if a <= b else h >= a or h < b


def status(p, now):
    h, _ = hours(now, p["tz"])
    if not inside(h, p["wake"], p["sleep"]):
        return "asleep"
    for a, b, what in p.get("busy", []):
        if inside(h, a, b):
            return "busy: " + what
    return "free"


def life_now(brief, pid, now):
    cur = None
    for x in brief.get("lives", {}).get(pid, []):
        if x.get("from", 0) <= now:
            cur = x
    if not cur:
        return "no current mood: choose one that fits"
    level = (cur.get("level") or "") + " " if cur.get("level") else ""
    return f"mood {level}{cur.get('mood')}; " + (f"going on: {cur['event']}" if cur.get("event") else "nothing special going on")


def names(brief):
    out = {p["id"]: p["name"] for p in brief.get("people", [])}
    out["me"] = brief.get("me", {}).get("name", "the learner")
    return out


def unseen(threads, now, extra=()):
    out = []
    for cid, t in threads.items():
        # the Ācta Diurna is a news board, not a chat
        if t.get("gone") or cid == "acta":
            continue
        for m in t.get("messages", []):
            if m.get("from") not in ("me", "sys") and t.get("readAt", 0) < m.get("at", 0) <= now:
                out.append(dict(m, chat=cid))
    out += [dict(m) for m in extra]
    return sorted(out, key=lambda m: m.get("at", 0))


def state(d):
    meta, brief, threads = docs(d)
    now = int(time.time() * 1000)
    if not brief:
        print("NO BRIEF")
        return
    print(f"now: {now} ms; Kyiv {hours(now, 'Europe/Kyiv')[1]}; learner last in the messenger {round((now - meta.get('seenAt', 0)) / 60000)} minutes ago")
    print("\nPEOPLE (local time, now, life):")
    for p in brief["people"]:
        print(f"- {p['id']} ({p['name']}): {hours(now, p['tz'])[1]} {p['tz']}; {status(p, now)}; {life_now(brief, p['id'], now)}")
    today = datetime.fromtimestamp(now / 1000, ZoneInfo("Europe/Rome")).strftime("%Y-%m-%d")
    day = next((c for c in brief.get("calendar", []) if c.get("day") == today), None)
    if day:
        print("\n" + day["text"])
    if brief.get("world"):
        print("\n" + brief["world"])
    if brief.get("photos"):
        print("\nPHOTOS (id: what it shows; who may send it):")
        for ph in brief["photos"]:
            who = "anyone" if ph.get("who") == "any" else ", ".join(ph.get("who", []))
            print(f"- {ph['id']}: {ph['en']} ({who})")
    n = names(brief)
    print("\nCHATS (oldest first; times in Rome):")
    for cid, t in sorted(threads.items()):
        if t.get("gone") or cid == "acta":
            continue
        msgs = [m for m in t.get("messages", []) if m.get("at", 0) <= now]
        waiting = [m for m in t.get("messages", []) if m.get("at", 0) > now]
        new = [m for m in msgs if m.get("from") not in ("me", "sys") and m.get("at", 0) > t.get("readAt", 0)]
        print(f"- chat {cid}: {len(new)} unseen by the learner{'; messages still on their way' if waiting else ''}")
        for m in msgs[-6:]:
            if m.get("from") == "sys":
                print(f"    [{hours(m['at'], 'Europe/Rome')[1]}] ({m.get('en')})")
            else:
                print(f"    [{hours(m['at'], 'Europe/Rome')[1]}] {n.get(m.get('from'), m.get('from'))}: {m.get('la')}" + (" (deleted)" if m.get("deletedAt") else ""))


def plain(w):
    return "".join(c for c in unicodedata.normalize("NFD", w) if unicodedata.category(c) != "Mn").lower()


# the hand-drawn Roman emoji, written as codes (":lupa:"), and a plain emoji for each in a notification
ROMAN_EMOJI = {"spqr": "🏛️", "laurus": "🌿", "aquila": "🦅", "lupa": "🐺", "gladius": "🗡️", "galea": "🪖", "scutum": "🛡️", "colosseum": "🏟️", "columna": "🏛️", "lucerna": "🪔", "tabula": "✍️", "lyra": "🎶", "aureus": "🪙", "canis": "🐕"}
CODE = re.compile(r":([a-z]{3,12}):")


def check(d, msgs):
    _, brief, _ = docs(d)
    forms = set(brief.get("forms", [])) if brief else set()
    for msg in msgs:
        unknown = [c for c in CODE.findall(msg) if c not in ROMAN_EMOJI]
        words = CODE.sub(" ", msg)
        bad = [w for w in re.findall(r"[^\W\d_]+", words) if plain(w) not in forms and not re.fullmatch(r"(ha)+e?", plain(w))]
        bad += [f":{c}: (no such emoji)" for c in unknown]
        print(msg, "->", "OK" if not bad else "NOT ALLOWED: " + ", ".join(bad))


def notify(d, new_path=None):
    meta, brief, threads = docs(d)
    now = int(time.time() * 1000)
    if not brief:
        print("Open Nūntiī once, and your Roman friends will start writing to you.")
        return
    extra = load(new_path, []) if new_path else []
    msgs = unseen(threads, now + 60_000, extra)
    if not msgs:
        print("No new messages.")
        return
    n = names(brief)
    last = msgs[-1]
    shown = lambda t: CODE.sub(lambda m: ROMAN_EMOJI.get(m.group(1), m.group(0)), t or "")
    if last.get("voice"):
        line = f"{n.get(last.get('from'), last.get('from'))}: 🎤 Voice message"
    else:
        text = shown(last.get("la")) or "Photo"
        line = f"{n.get(last.get('from'), last.get('from'))}: {'📷 ' if last.get('photo') else ''}{text}" + (f" ({shown(last['en'])})" if last.get("en") else "")
    others = [n.get(m.get("from"), m.get("from")) for m in msgs[:-1]]
    if others:
        who = ", ".join(dict.fromkeys(others))
        line += f" · and {len(others)} more from {who}"
    print(line)


if __name__ == "__main__":
    cmd, d = sys.argv[1], sys.argv[2]
    if cmd == "state":
        state(d)
    elif cmd == "check":
        check(d, sys.argv[3:])
    elif cmd == "notify":
        notify(d, sys.argv[3] if len(sys.argv) > 3 else None)

# Makes src/content/photos/<id>.webp: the pictures the people of the messenger
# send, as if Romans of AD 100 had phones in their pockets (the learner asked for
# "something wild, something they would send", not a museum's collection). Each
# scene is in scripts/content/photos.json; what it shows and who sends it is in
# src/content/photos.ts. The pictures come from AI Horde (aihorde.net), a free
# crowd of volunteers' image generators that needs no key (anonymous requests
# wait in a queue, about two minutes each), with its filter on (no nudity).
# Pictures already made are kept; delete one to make it again.
#   python3 -I scripts/content/photos.py [id ...]
import io, json, os, sys, time, urllib.request, zlib
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
OUT = os.path.join(ROOT, "src", "content", "photos")
API = "https://aihorde.net/api/v2"
HEAD = {"apikey": os.environ.get("HORDE_KEY", "0000000000"), "Content-Type": "application/json", "Client-Agent": "tabula-latina:1:anon", "User-Agent": "tabula-latina/1.0"}
MODEL = "AlbedoBase XL (SDXL)"
STYLE = ", amateur smartphone photo taken in ancient Rome around AD 100, candid, realistic, natural colours, sharp focus"
NEGATIVE = "cartoon, painting, drawing, illustration, anime, 3d render, modern clothes, modern buildings, cars, electric light, glasses, text, letters, watermark, logo, signature, nsfw, nude, blood, gore, deformed hands, extra fingers"
SIZE = 576
JOBS = 6


def call(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, headers=HEAD, method="POST" if body else "GET")
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


def make(item, tries=3):
    """One picture: ask, wait in the queue, fetch, save as a small WebP."""
    path = os.path.join(OUT, item["id"] + ".webp")
    for attempt in range(tries):
        try:
            job = call("/generate/async", {
                "prompt": item["prompt"] + STYLE + " ### " + NEGATIVE,
                "params": {"width": SIZE, "height": SIZE, "steps": 25, "n": 1, "sampler_name": "k_euler_a", "cfg_scale": 6, "seed": str(zlib.crc32(item["id"].encode()) % 10**8)},
                "models": [MODEL], "nsfw": False, "censor_nsfw": True, "r2": True,
            })
            t0 = time.time()
            while not call("/generate/check/" + job["id"]).get("done"):
                if time.time() - t0 > 900:
                    raise TimeoutError("queue")
                time.sleep(8)
            gen = call("/generate/status/" + job["id"])["generations"][0]
            if gen.get("censored"):
                raise ValueError("censored")
            raw = urllib.request.urlopen(urllib.request.Request(gen["img"], headers={"User-Agent": HEAD["User-Agent"]}), timeout=90).read()
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            img.save(path, "WEBP", quality=72, method=6)
            print(f"{item['id']}: {os.path.getsize(path) // 1024} KB in {round(time.time() - t0)} s", flush=True)
            return True
        except Exception as e:  # noqa: BLE001 - a volunteer's worker can fail in many ways; try again
            print(f"{item['id']}: try {attempt + 1} failed ({e})", flush=True)
            time.sleep(10)
    return False


def main():
    items = json.load(open(os.path.join(ROOT, "scripts", "content", "photos.json")))
    want = set(sys.argv[1:])
    todo = [x for x in items if (x["id"] in want if want else not os.path.exists(os.path.join(OUT, x["id"] + ".webp")))]
    os.makedirs(OUT, exist_ok=True)
    print(f"{len(todo)} to make", flush=True)
    with ThreadPoolExecutor(JOBS) as pool:
        done = list(pool.map(make, todo))
    print(f"made {sum(done)} of {len(todo)}")


if __name__ == "__main__":
    main()

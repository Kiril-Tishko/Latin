"""Pictures for the stories (src/content/stories.ts), as Roman wall paintings: one per story, from
scripts/content/story-pics.json, into src/content/story-pics/<id>.webp (files beside the page).

Made with the learner's Pollinations account (the environment's network adds its key): MAI Image 2.6 Flash.
Makes only the ones that are missing; delete a file to make it again (SEED=<n> for another try).
Run: python3 -I scripts/content/story_pics.py
"""
import base64, io, json, os, sys, urllib.error, urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "src", "content", "story-pics")
URL = "https://gen.pollinations.ai/v1/images/generations"
MODEL = "microsoft/mai-image-2.6-flash"
STYLE = (" Painted as an ancient Roman fresco, like the wall paintings of Pompeii: warm earth colours (red and yellow ochre,"
         " green earth, soft blue), a little faded plaster texture, simple graceful figures in Roman tunics and stolas,"
         " a plain background. No writing, no letters, no frame, no nudity.")


def make(prompt, seed):
    body = {"prompt": prompt + STYLE, "model": MODEL, "size": "1024x768", "seed": seed, "safe": "nsfw", "quality": "medium", "response_format": "b64_json"}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "User-Agent": "tabula-latina/1.0"}, method="POST")
    with urllib.request.urlopen(req, timeout=240) as r:
        raw = base64.b64decode(json.load(r)["data"][0]["b64_json"])
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img.thumbnail((720, 540), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=78)
    return buf.getvalue()


def main():
    os.makedirs(OUT, exist_ok=True)
    seed = int(os.environ.get("SEED", "3"))
    for s in json.load(open(os.path.join(HERE, "story-pics.json"))):
        dest = os.path.join(OUT, s["id"] + ".webp")
        if os.path.exists(dest):
            continue
        try:
            data = make(s["prompt"], seed)
        except urllib.error.HTTPError as e:
            print(s["id"], "HTTP", e.code, e.read()[:200], file=sys.stderr)
            continue
        with open(dest, "wb") as f:
            f.write(data)
        print(s["id"], len(data), "bytes")


if __name__ == "__main__":
    main()

# Builds src/content/photos/<id>.webp: the photos the people of the messenger
# send, small WebP files that are published next to the page (the page itself
# stays under the publisher's 1 MB). The pictures are Roman wall paintings and
# things from The Met's Open Access collection (CC0); what each one is and who
# sends it is in src/content/photos.ts. Download the originals into one folder
# first (web-large images: https://images.metmuseum.org/CRDImages/gr/web-large/<file>),
# named <Met object id>.jpg, then:
#   python3 -I scripts/content/photos.py <folder> src/content/photos
import io, os, sys
from PIL import Image

# photo id, Met object id, the image file at The Met, crop (left, top, right, bottom as fractions) or None
PHOTOS = [
    ("lyre", 247009, "DP105943.jpg", (0.12, 0.05, 0.88, 0.95)),
    ("earring", 242689, "sp74513256.jpg", None),
    ("perfume", 239768, "DP155806.jpg", None),
    ("comb", 254591, "DP-14287-009.jpg", None),
    ("masks", 248802, "DP271330.jpg", None),
    ("actor-lamp", 250236, "DP105841.jpg", None),
    ("ink", 252501, "DP121128.jpg", None),
    ("coin", 248043, "LC-08_170_121b.jpg", (0.22, 0.1, 0.78, 0.9)),
    ("die", 246446, "DP121100.jpg", None),
    ("gladiator-cup", 245397, "DP104755.jpg", None),
    ("goat", 252549, "DP257414.jpg", None),
    ("tied-goat", 248270, "DP122078.jpg", None),
    ("grapes", 245388, "DP222367.jpg", None),
    ("cup", 239878, "DP120977.jpg", None),
    ("boat-lamp", 250457, "DP121793.jpg", None),
    ("fish", 249494, "DP272861.jpg", None),
    ("pig-rattle", 250257, "DP2031.jpg", None),
    ("girl-dog", 248754, "DP20467.jpg", None),
    ("night-lamp", 239871, "DP141533.jpg", None),
    ("galatea", 250946, "DP138763.jpg", None),
    ("lantern-boy", 251415, "DP292010.jpg", None),
    ("dining-room", 247008, "DP141474.jpg", None),
    ("bedroom", 247017, "DP143704.jpg", None),
    ("mosaic", 253565, "DP140137.jpg", None),
    ("dog", 255121, "DP20789.jpg", None),
]
MAX = 480


def encode(path, box):
    im = Image.open(path).convert("RGB")
    if box:
        w, h = im.size
        im = im.crop((round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h)))
    im.thumbnail((MAX, MAX), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=60, method=6)
    return buf.getvalue()


def main(src, out):
    os.makedirs(out, exist_ok=True)
    total = 0
    for pid, met, _file, box in PHOTOS:
        data = encode(os.path.join(src, f"{met}.jpg"), box)
        total += len(data)
        with open(os.path.join(out, f"{pid}.webp"), "wb") as f:
            f.write(data)
    print(f"{len(PHOTOS)} photos, {total // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

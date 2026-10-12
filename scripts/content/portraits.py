# Builds src/content/portraits.ts: the messenger's avatars, cropped from museum
# images (painted mummy portraits from Roman Egypt and a Boscoreale wall
# painting; CC0 or CC BY 4.0). Download the originals into one folder first
# (each URL is in the table; Met images: primaryImageSmall from the Met's
# collection API, the Boscoreale one in full size), named as in "file", then:
#   python3 -I scripts/content/portraits.py <folder> src/content/portraits.ts
# Crops: cx, cy are the face's center as fractions of width and height; s is the
# side of the square as a fraction of the width. 200 px WebP, quality 70.
import base64, io, json, os, sys
from PIL import Image

PORTRAITS = [
    # id, file, cx, cy, s, sex, age, title, date, museum, license, url
    ("met547768", "547768.jpg", 0.5, 0.38, 0.95, "m", "young", "Portrait of a youth", "190–210 CE", "The Met, New York", "CC0", "https://www.metmuseum.org/art/collection/search/547768"),
    ("met547856", "547856.jpg", 0.5, 0.36, 0.95, "m", "adult", "Portrait of a thin-faced, bearded man", "160–180 CE", "The Met, New York", "CC0", "https://www.metmuseum.org/art/collection/search/547856"),
    ("met547857", "547857.jpg", 0.5, 0.33, 1.0, "m", "adult", "Portrait of a man with a mole on his nose", "130–150 CE", "The Met, New York", "CC0", "https://www.metmuseum.org/art/collection/search/547857"),
    ("met547858", "547858.jpg", 0.5, 0.3, 1.0, "m", "adult", "Portrait of a thin-faced man", "140–170 CE", "The Met, New York", "CC0", "https://www.metmuseum.org/art/collection/search/547858"),
    ("met547859", "547859.jpg", 0.5, 0.33, 0.98, "f", "old", "Portrait of an elderly lady with a gold wreath", "100–125 CE", "The Met, New York", "CC0", "https://www.metmuseum.org/art/collection/search/547859"),
    ("met547860", "547860.jpg", 0.52, 0.33, 0.95, "f", "young", "Portrait of a young woman in red", "90–120 CE", "The Met, New York", "CC0", "https://www.metmuseum.org/art/collection/search/547860"),
    ("met547861", "547861.jpg", 0.5, 0.32, 0.95, "f", "young", "Portrait of a young woman with a gilded wreath", "120–140 CE", "The Met, New York", "CC0", "https://www.metmuseum.org/art/collection/search/547861"),
    ("cma145924", "cma145924.jpg", 0.5, 0.44, 0.8, "f", "adult", "Funerary portrait of a woman", "2nd century CE", "Cleveland Museum of Art", "CC0", "https://clevelandart.org/art/1971.136"),
    ("blm1", "blm1.jpg", 0.42, 0.3, 0.75, "f", "adult", "Mummy portrait of a woman", "Roman Egypt", "Badisches Landesmuseum Karlsruhe", "CC0", "https://www.europeana.eu/item/1236/item_K7XILUCQ3AMDJKMWPE5VFEHRNVXAWXXU"),
    ("smvk4014464", "smvk4014464.jpg", 0.5, 0.36, 0.85, "m", "adult", "Mummy portrait", "Roman Egypt", "Medelhavsmuseet, Stockholm", "CC BY 4.0", "https://www.europeana.eu/item/91639/SMVK_MM_objekt_4004968"),
    ("smvk4014469", "smvk4014469.jpg", 0.5, 0.32, 0.85, "m", "young", "Mummy portrait", "Roman Egypt", "Medelhavsmuseet, Stockholm", "CC BY 4.0", "https://www.europeana.eu/item/91639/SMVK_MM_objekt_4004967"),
    ("smvk4014474", "smvk4014474.jpg", 0.5, 0.33, 0.85, "m", "young", "Mummy portrait", "Roman Egypt", "Medelhavsmuseet, Stockholm", "CC BY 4.0", "https://www.europeana.eu/item/91639/SMVK_MM_objekt_4004966"),
    ("smvk4014479", "smvk4014479.jpg", 0.48, 0.3, 0.8, "f", "adult", "Mummy portrait", "Roman Egypt", "Medelhavsmuseet, Stockholm", "CC BY 4.0", "https://www.europeana.eu/item/91639/SMVK_MM_objekt_3981028"),
    ("smvk4014484", "smvk4014484.jpg", 0.5, 0.3, 0.85, "f", "young", "Mummy portrait", "Roman Egypt", "Medelhavsmuseet, Stockholm", "CC BY 4.0", "https://www.europeana.eu/item/91639/SMVK_MM_objekt_3981027"),
    ("smvk4014489", "smvk4014489.jpg", 0.5, 0.32, 0.85, "f", "adult", "Mummy portrait", "Roman Egypt", "Medelhavsmuseet, Stockholm", "CC BY 4.0", "https://www.europeana.eu/item/91639/SMVK_MM_objekt_3981025"),
    ("smvk4007097", "smvk4007097.jpg", 0.53, 0.3, 0.9, "m", "young", "Mummy portrait", "Roman Egypt", "Medelhavsmuseet, Stockholm", "CC BY 4.0", "https://www.europeana.eu/item/91639/SMVK_MM_objekt_3104845"),
    ("smvk4014575", "smvk4014575.jpg", 0.5, 0.38, 0.85, "m", "adult", "Mummy portrait", "Roman Egypt", "Medelhavsmuseet, Stockholm", "CC BY 4.0", "https://www.europeana.eu/item/91639/SMVK_MM_objekt_3016273"),
    ("smvk3981002", "smvk3981002.jpg", 0.5, 0.33, 0.9, "m", "young", "Mummy portrait", "Roman Egypt", "Medelhavsmuseet, Stockholm", "CC BY 4.0", "https://www.europeana.eu/item/91639/SMVK_MM_objekt_3981024"),
    ("bosc-kithara", "DP105943.jpg", 0.44, 0.31, 0.25, "f", "young", "Woman playing a kithara, wall painting from Boscoreale", "50–40 BCE", "The Met, New York", "CC0", "https://www.metmuseum.org/art/collection/search/247009"),
]
N = 200


def crop(path, cx, cy, s):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    side = s * w
    x0, y0 = cx * w - side / 2, cy * h - side / 2
    im = im.crop((round(x0), round(y0), round(x0 + side), round(y0 + side))).resize((N, N), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=70, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def main(src, out):
    lines = [
        "// Portraits of people from the Roman world (painted mummy portraits from Roman",
        "// Egypt and a wall painting from Boscoreale), cropped to 200 px avatars. All",
        "// public domain (CC0) or CC BY 4.0, credited in the messenger's profiles.",
        "// Generated by scripts/content/portraits.py: do not edit by hand.",
        "",
        "export interface Portrait {",
        "  id: string;",
        '  g: "m" | "f";',
        '  age: "young" | "adult" | "old";',
        "  title: string;",
        "  date: string;",
        "  museum: string;",
        "  license: string;",
        "  url: string;",
        "  src: string;",
        "}",
        "",
        "export const PORTRAITS: Portrait[] = [",
    ]
    for (pid, f, cx, cy, s, g, age, title, date, museum, lic, url) in PORTRAITS:
        rec = {"id": pid, "g": g, "age": age, "title": title, "date": date, "museum": museum, "license": lic, "url": url, "src": crop(os.path.join(src, f), cx, cy, s)}
        lines.append("  " + json.dumps(rec, ensure_ascii=False) + ",")
    lines += ["];", "", "export const PORTRAIT_BY_ID = new Map(PORTRAITS.map((p) => [p.id, p]));", ""]
    with open(out, "w") as fh:
        fh.write("\n".join(lines))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

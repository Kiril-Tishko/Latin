# Builds src/content/roman-emoji.ts: hand-drawn Roman emoji for the messenger
# (SPQR, a laurel wreath, the legion's eagle, the she-wolf with the twins…) as a
# small color font (COLR/CPAL, every layer one flat color) whose glyphs sit in
# the Private Use Area, so they behave like real emoji in the message box and
# in the bubbles. Messages store them as codes (":lupa:"); the page shows the
# glyphs. Drawn here as polygons on a 100 x 100 grid (y down).
#
#   python3 -m venv /tmp/fontenv && /tmp/fontenv/bin/pip install fonttools brotli
#   /tmp/fontenv/bin/python scripts/content/roman_emoji.py src/content/roman-emoji.ts [preview.html]
import base64, io, json, math, sys

# ------------------------------------------------------------------ colors
RED, RED_D = "#B3302B", "#7E201D"
GOLD, GOLD_D, GOLD_L = "#D9A93A", "#A27620", "#F3D47E"
BRONZE, BRONZE_D, BRONZE_L = "#9A6436", "#5E3A1C", "#C48A55"
STONE, STONE_D, STONE_DD = "#E9DDC0", "#C3AF88", "#8C7856"
STEEL, STEEL_D = "#CBD3DB", "#8996A3"
GREEN, GREEN_D = "#6E9E3F", "#44702A"
DARK = "#2E2219"
CREAM = "#F5ECD6"
FLAME, FLAME_L = "#F09A2E", "#FFE07A"
WOOD, WOOD_D, WOOD_L = "#B07843", "#74491F", "#CF9A62"
TERRA, TERRA_D, TERRA_L = "#C66B38", "#8F4720", "#E0925C"
WAX = "#3B281B"

# ----------------------------------------------------------------- shapes
# A contour is a list of (x, y) points; a layer is (color, [contours]).


def arc(cx, cy, rx, ry, a0, a1, n=24, rot=0.0):
    """Points along an ellipse from angle a0 to a1 (degrees; y down, so positive angles turn clockwise)."""
    out = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        x, y = rx * math.cos(a), ry * math.sin(a)
        r = math.radians(rot)
        out.append((cx + x * math.cos(r) - y * math.sin(r), cy + x * math.sin(r) + y * math.cos(r)))
    return out


def circle(cx, cy, r, n=56):
    return arc(cx, cy, r, r, 0, 360, n)[:-1]


def ellipse(cx, cy, rx, ry, rot=0.0, n=44):
    return arc(cx, cy, rx, ry, 0, 360, n, rot)[:-1]


def rrect(x0, y0, x1, y1, r):
    if r <= 0:
        return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    return arc(x1 - r, y0 + r, r, r, -90, 0, 6) + arc(x1 - r, y1 - r, r, r, 0, 90, 6) + arc(x0 + r, y1 - r, r, r, 90, 180, 6) + arc(x0 + r, y0 + r, r, r, 180, 270, 6)


def spline(points, n=10, closed=False):
    """A smooth curve through the points (Catmull-Rom)."""
    p = list(points)
    if closed:
        p = [p[-1]] + p + [p[0], p[1]]
    else:
        p = [p[0]] + p + [p[-1]]
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    if not closed:
        out.append(p[-2])
    return out


def stroke(points, w, caps=True):
    """The outline of a line of width w along the points, with round ends."""
    h = w / 2
    left, right = [], []
    for i, (x, y) in enumerate(points):
        a = points[max(i - 1, 0)]
        b = points[min(i + 1, len(points) - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        d = math.hypot(dx, dy) or 1
        nx, ny = -dy / d, dx / d
        left.append((x + nx * h, y + ny * h))
        right.append((x - nx * h, y - ny * h))
    if not caps:
        return left + right[::-1]

    def cap(p, q):
        ang = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
        return arc(p[0], p[1], h, h, ang + 90, ang + 270, 8)[1:-1][::-1]

    end = cap(points[-1], points[-2])
    start = cap(points[0], points[1])
    return left + end + right[::-1] + start


class Hole(list):
    """A contour cut out of the shapes before it in its layer (a ring's middle)."""


def ring(cx, cy, r_out, r_in):
    return [circle(cx, cy, r_out), Hole(circle(cx, cy, r_in))]


def area(c):
    return sum(c[i][0] * c[(i + 1) % len(c)][1] - c[(i + 1) % len(c)][0] * c[i][1] for i in range(len(c))) / 2


def oriented(c):
    """Shapes clockwise on the page, holes the other way, so the font's fill rule draws them as meant."""
    want_positive = not isinstance(c, Hole)
    return list(c) if (area(c) > 0) == want_positive else list(c)[::-1]


def mirror(c, axis=50):
    return [(2 * axis - x, y) for x, y in c][::-1]


def rotate(c, deg, cx=50, cy=50):
    r = math.radians(deg)
    return [(cx + (x - cx) * math.cos(r) - (y - cy) * math.sin(r), cy + (x - cx) * math.sin(r) + (y - cy) * math.cos(r)) for x, y in c]


def move(c, dx, dy):
    return [(x + dx, y + dy) for x, y in c]


def leaf(cx, cy, length, width, ang):
    """A pointed leaf centred at (cx, cy), pointing at angle ang (degrees)."""
    half = length / 2
    pts = []
    for i in range(13):
        t = -1 + 2 * i / 12
        pts.append((t * half, (1 - t * t) ** 0.8 * width / 2))
    for i in range(1, 12):
        t = 1 - 2 * i / 12
        pts.append((t * half, -((1 - t * t) ** 0.8) * width / 2))
    r = math.radians(ang)
    return [(cx + x * math.cos(r) - y * math.sin(r), cy + x * math.sin(r) + y * math.cos(r)) for x, y in pts]


# --------------------------------------------------------------- letters

def letter(ch, x0, y0, w, h, sw):
    """A Roman capital as stroked lines inside the box (x0, y0, w, h)."""
    x1, y1 = x0 + w, y0 + h
    ym = y0 + h / 2
    if ch == "S":
        return [stroke(spline([(x1 - w * 0.08, y0 + h * 0.16), (x0 + w * 0.55, y0 + h * 0.02), (x0 + w * 0.12, y0 + h * 0.2), (x0 + w * 0.2, y0 + h * 0.4), (x0 + w * 0.8, y0 + h * 0.58), (x1 - w * 0.08, y0 + h * 0.8), (x0 + w * 0.45, y1 - h * 0.02), (x0 + w * 0.05, y1 - h * 0.16)], 8), sw)]
    stem = stroke([(x0 + sw / 2, y0 + sw / 2), (x0 + sw / 2, y1 - sw / 2)], sw)
    if ch in "PR":
        bottom = ym + (0 if ch == "R" else h * 0.04)
        r = (bottom - y0) / 2
        bowl = [(x0 + sw / 2, y0 + sw / 2), (x1 - r - sw / 2, y0 + sw / 2)] + arc(x1 - r - sw / 2, y0 + r, r - sw / 2, r - sw / 2, -90, 90, 14)[1:] + [(x0 + sw / 2, bottom - sw / 2)]
        out = [stem, stroke(bowl, sw)]
        if ch == "R":
            out.append(stroke([(x0 + w * 0.42, bottom - sw / 2), (x1 - sw / 2, y1 - sw / 2)], sw))
        return out
    if ch == "Q":
        cx, cy, rx, ry = x0 + w / 2, ym - h * 0.02, w / 2 - sw / 2, h / 2 - sw / 2 - h * 0.02
        return [ellipse(cx, cy, rx + sw / 2, ry + sw / 2), Hole(ellipse(cx, cy, rx - sw / 2, ry - sw / 2)), stroke([(cx + w * 0.05, y1 - h * 0.14), (x1 + w * 0.12, y1 + h * 0.06)], sw)]
    raise ValueError(ch)


# ----------------------------------------------------------------- emoji

def spqr():
    plaque = rrect(13, 27, 87, 73, 3)
    handles = [[(14, 41), (3, 31), (3, 69), (14, 59)], mirror([(14, 41), (3, 31), (3, 69), (14, 59)])]
    letters = []
    w, gap, h, sw = 14.2, 2.4, 26, 4.6
    x = 50 - (4 * w + 3 * gap) / 2
    for ch in "SPQR":
        letters += letter(ch, x, 50 - h / 2, w, h, sw)
        x += w + gap
    return [(GOLD_D, handles + [plaque]), (RED, [rrect(17, 31, 83, 69, 1.5)]), (GOLD_L, letters)]


def laurus():
    layers = {GREEN_D: [], GREEN: [], RED: [], RED_D: []}
    cx, cy, r = 50, 50, 33

    def toward(t, n, deg):
        th = math.radians(deg)
        x, y = t[0] * math.cos(th) + n[0] * math.sin(th), t[1] * math.cos(th) + n[1] * math.sin(th)
        return math.degrees(math.atan2(y, x))

    for a0, a1 in ((106, 268), (74, -88)):
        stem = arc(cx, cy, r, r, a0, a1, 40)
        layers[GREEN_D].append(stroke(stem, 2.6))
        sign = 1 if a1 > a0 else -1
        steps = 8
        for i in range(steps + 1):
            t = (i + 0.4) / (steps + 0.4)
            a = math.radians(a0 + (a1 - a0) * t)
            px, py = cx + r * math.cos(a), cy + r * math.sin(a)
            tan = (-math.sin(a) * sign, math.cos(a) * sign)  # the way the branch grows
            nor = (math.cos(a), math.sin(a))  # outwards
            size = 13.5 - 4.5 * t
            if i == steps:
                layers[GREEN].append(leaf(px + tan[0] * 4, py + tan[1] * 4, size, size * 0.42, toward(tan, nor, 0)))
                continue
            layers[GREEN].append(leaf(px + nor[0] * 4.6 + tan[0] * 2.6, py + nor[1] * 4.6 + tan[1] * 2.6, size, size * 0.42, toward(tan, nor, 34)))
            layers[GREEN_D].append(leaf(px - nor[0] * 4.6 + tan[0] * 2.6, py - nor[1] * 4.6 + tan[1] * 2.6, size * 0.92, size * 0.4, toward(tan, (-nor[0], -nor[1]), 34)))
    # the ribbon that ties the branches
    layers[RED_D] += [stroke(spline([(50, 84), (42, 92), (37, 97)], 6), 4.2), stroke(spline([(50, 84), (58, 92), (63, 97)], 6), 4.2)]
    layers[RED] += [ellipse(42.5, 81.5, 7.5, 4.6, -20), ellipse(57.5, 81.5, 7.5, 4.6, 20), circle(50, 83.5, 3.6)]
    return [(GREEN_D, layers[GREEN_D]), (GREEN, layers[GREEN]), (RED_D, layers[RED_D]), (RED, layers[RED])]


def aquila():
    wing = spline([(46, 46), (36, 47), (25, 42), (17, 33), (12, 22), (8, 9), (15, 15), (16, 6), (22, 14), (25, 5), (29, 15), (34, 8), (36, 19), (41, 29), (47, 36)], 4, closed=True)
    feathers = [stroke(spline([(42, 40), (30, 35), (20, 22)], 6), 1.6), stroke(spline([(40, 44), (28, 40), (17, 30)], 6), 1.4)]
    body = ellipse(50, 47, 8.5, 12.5)
    tail = [(44, 55), (56, 55), (60, 64), (40, 64)]
    head = circle(47.5, 30.5, 6.2)
    beak = [(42.5, 28.5), (35.5, 31.5), (37.5, 33.6), (43.5, 34.5)]
    return [
        (BRONZE_D, [rrect(47.2, 60, 52.8, 97, 1.4)]),
        (GOLD_D, [rrect(33, 61.5, 67, 67, 2)]),
        (GOLD, [wing, mirror(wing), body, tail, head]),
        (GOLD_D, feathers + [mirror(f) for f in feathers] + [beak, stroke([(46, 56), (45, 62)], 2.4), stroke([(54, 56), (55, 62)], 2.4)]),
        (DARK, [circle(45.6, 29.4, 1.3)]),
    ]


def lupa():
    far_legs = [
        [(38, 63), (39.5, 84), (37.5, 87.5), (45, 87.5), (44, 76), (44, 64)],
        [(56, 61), (57, 74), (56, 84), (54, 87.5), (61.5, 87.5), (61.5, 78), (63, 64)],
    ]
    body = spline([
        (7, 44), (8.5, 46.5), (15, 47.5), (21, 49), (26, 51.5), (31, 56), (33, 62),
        (32.5, 70), (32, 84), (28.5, 87.5), (36.5, 87.5), (37, 76), (38, 65),
        (44, 64), (52, 62), (60, 60),
        (62, 62), (64.5, 72), (64, 84), (61, 87.5), (69.5, 87.5), (69.5, 79), (73, 71), (76, 61), (78, 54),
        (79, 48), (72, 43), (60, 41.5), (48, 41.5), (38, 40),
        (32, 38), (27, 35), (26.5, 33.5), (25.5, 25), (22, 31), (21.5, 30.5), (19.5, 24.5), (17, 31),
        (16, 32.5), (13.5, 36), (10, 40), (7, 42.5),
    ], 4, closed=True)
    tail = spline([(78, 47), (84, 50), (88, 58), (88.5, 68), (86.5, 76), (83.5, 70), (82.5, 60), (79, 53)], 5, closed=True)
    curls = [circle(x, y, 1.8) for x, y in [(27, 41), (30.5, 44.5), (33, 48.5), (28, 47.5), (31.5, 40.5)]]
    twin1 = [circle(46, 68.5, 4.2), ellipse(49.5, 78, 5, 7.4, -15), stroke([(47.5, 73.5), (45.5, 70.5)], 2.2)]
    twin2 = [circle(57.5, 71, 4.1), ellipse(58, 80, 5.3, 6.4)]
    return [
        (BRONZE_D, far_legs),
        (BRONZE, [body, tail]),
        (BRONZE_D, curls + [stroke(spline([(42, 52), (52, 53), (62, 51)], 6), 1.3)]),
        (DARK, [circle(14.5, 37, 1.25)]),
        ("#DDA56C", twin1 + twin2),
    ]

def gladius():
    blade = [(50, 3), (55.4, 20), (54.4, 40), (55.2, 63), (44.8, 63), (45.6, 40), (44.6, 20)]
    fuller = [(49.3, 14), (50.7, 14), (50.7, 61), (49.3, 61)]
    grip = rrect(46.3, 69, 53.7, 87, 2.5)
    rings = [ellipse(50, y, 4.4, 1.4) for y in (74, 78.5, 83)]
    parts = [
        (STEEL, [blade]),
        (STEEL_D, [fuller]),
        (WOOD, [grip]),
        (WOOD_D, rings + [ellipse(50, 66.5, 12.5, 4.6)]),
        (GOLD, [ellipse(50, 90.5, 8.2, 5.6)]),
        (GOLD_D, [circle(50, 96.2, 2.2)]),
    ]
    return [(c, [move(rotate(k, 42), 0, 0) for k in cs]) for c, cs in parts]


def galea():
    crest_out = spline([(19, 41), (24, 21), (40, 9), (60, 8), (77, 16), (87, 30), (88, 41)], 8)
    crest_in = spline([(78, 39), (75, 30), (66, 22), (51, 20), (37, 25), (30, 33), (29, 42)], 8)
    hair = [stroke([(x, y0), (x + 0.5, y0 + 9)], 1.4) for x, y0 in [(30, 23), (38, 16), (47, 13), (56, 12.5), (65, 14), (73, 19), (80, 26)]]
    dome = arc(52, 60, 30, 33, 180, 360, 30)
    neck = spline([(72, 56), (86, 58.5), (95, 65), (92.5, 69), (79, 66.5), (70, 62)], 5, closed=True)
    cheek = spline([(38, 59), (58, 59), (59.5, 70), (55, 80), (48.5, 84), (44.5, 79.5), (43.5, 72), (39.5, 66)], 5, closed=True)
    return [
        (RED, [crest_out + crest_in]),
        (RED_D, hair),
        (GOLD_D, [rrect(48, 22, 56, 30, 1.5), stroke(cheek + cheek[:1], 3, False)]),
        (GOLD, [dome, neck, cheek]),
        (GOLD_D, [[(19.5, 57), (31, 56.2), (31, 60), (19.5, 60.6)], stroke(spline([(31, 46), (40, 40), (50, 42)], 6), 1.6), stroke(spline([(55, 43), (64, 39), (73, 46)], 6), 1.6), stroke([(23, 59.4), (81, 59.4)], 1.7), stroke(spline([(62, 62), (66, 66), (66, 72)], 6), 1.6)]),
        (BRONZE_D, [circle(44, 64, 1.7), circle(52, 64.5, 1.7), circle(50, 76, 1.7)]),
    ]

def scutum():
    wing = spline([(42, 47), (33, 44), (25, 36), (22, 28), (28, 32), (27, 25), (32, 31), (33, 24), (37, 33), (42, 40)], 4, closed=True)
    bolt = [(44, 59), (37, 67), (42, 67), (31, 82)]
    return [
        (GOLD_D, [rrect(19, 3, 81, 97, 10)]),
        (RED, [rrect(22.5, 6.5, 77.5, 93.5, 7.5)]),
        (RED_D, [rrect(22.5, 9, 27, 91, 2), rrect(73, 9, 77.5, 91, 2)]),
        (GOLD, [rrect(48, 9, 52, 91, 1.2), wing, mirror(wing), stroke(bolt, 2.6), stroke(mirror(bolt)[::-1], 2.6)]),
        (GOLD_D, [circle(50, 50, 11.5)]),
        (GOLD, [circle(50, 50, 9)]),
        (GOLD_L, [circle(47.5, 47.5, 3.6)]),
    ]


def colosseum():
    shape = [(6, 88), (6, 21), (22, 17), (40, 15), (56, 15), (60, 20), (64, 21), (67, 29), (73, 30), (76, 39), (83, 41), (86, 50), (94, 53), (94, 88)]
    top = lambda x: 15 if x <= 56 else 21 if x <= 64 else 30 if x <= 73 else 41 if x <= 83 else 53

    def arch(x, y0, y1, w=7.4):
        return [(x - w / 2, y1), (x - w / 2, y0 + w / 2)] + arc(x, y0 + w / 2, w / 2, w / 2, 180, 360, 8)[1:-1] + [(x + w / 2, y0 + w / 2), (x + w / 2, y1)]

    holes, bands = [], []
    xs = [13, 25, 37, 49, 61, 73, 85]
    for y0, y1 in [(63, 79), (44, 58), (25, 38)]:
        for x in xs:
            if top(x + 4) + 3 < y0:
                holes.append(arch(x, y0, y1))
    for y in (40.5, 59.5, 80.5):
        x_end = max(x for x in range(6, 95) if top(x) + 1 < y)
        bands.append([(6, y - 1.6), (x_end, y - 1.6), (x_end, y + 1.6), (6, y + 1.6)])
    attic = [rrect(x - 2, 18.5, x + 2, 22, 0.4) for x in (16, 28, 40) if top(x + 3) < 17]
    return [(STONE, [shape]), (STONE_D, bands + [[(6, 84), (94, 84), (94, 88), (6, 88)]]), (STONE_DD, holes + attic)]


def columna():
    def spiral(cx, cy, r0, turns=1.6, flip=1):
        pts = []
        for i in range(48):
            t = i / 47
            a = math.radians(90 + flip * 360 * turns * t)
            r = r0 * (1 - 0.82 * t)
            pts.append((cx + flip * r * math.cos(a), cy + r * math.sin(a)))
        return pts

    shaft = [(35.5, 27), (64.5, 27), (66, 81), (34, 81)]
    flutes = [stroke([(x, 30), (x + (x - 50) * 0.04, 78)], 2.2) for x in (40.5, 47, 53, 59.5)]
    return [
        (STONE_D, [rrect(25, 86, 75, 95, 1.2), rrect(32, 22, 68, 28, 1)]),
        (STONE, [shaft, rrect(29, 79.5, 71, 87.5, 3.5), rrect(20, 11, 80, 17, 1.2), rrect(23, 16.5, 77, 23.5, 2), circle(26.5, 23.5, 7.6), circle(73.5, 23.5, 7.6)]),
        (STONE_D, flutes),
        (STONE_DD, [stroke(spiral(26.5, 23.5, 6.2, flip=-1), 1.7), stroke(spiral(73.5, 23.5, 6.2), 1.7), stroke([(28, 17), (72, 17)], 1.2)]),
    ]


def lucerna():
    flame = spline([(81.5, 52), (76, 43), (78.5, 33), (84, 18), (89, 33), (88.5, 45)], 6, closed=True)
    inner = spline([(82.5, 50), (80, 43), (82, 36), (84.5, 29), (86.5, 38), (86, 45)], 6, closed=True)
    return [
        (TERRA, ring(17, 56, 9.5, 4.8)),
        (TERRA_D, [ellipse(45, 74.5, 13, 3.6)]),
        (TERRA, [ellipse(45, 62, 27, 13.5), rrect(58, 52.5, 87, 64.5, 6)]),
        (TERRA_L, [ellipse(45, 56.5, 18.5, 6.4)]),
        (TERRA_D, [ellipse(45, 56.5, 4, 1.8), ellipse(81.5, 56.2, 3, 1.6), stroke(spline([(30, 66), (45, 70), (60, 66)], 6), 1.4)]),
        (FLAME, [flame]),
        (FLAME_L, [inner]),
    ]


def tabula():
    writing = [
        stroke(spline([(25, 33), (29, 31), (33, 34), (37, 31), (41, 34), (45, 31), (49, 34), (55, 32), (61, 33)], 4), 1.9),
        stroke(spline([(25, 44), (30, 42), (34, 45), (40, 42), (46, 45), (52, 42), (58, 45), (66, 43)], 4), 1.9),
        stroke(spline([(25, 55), (31, 53), (36, 56), (42, 53), (48, 56), (54, 54)], 4), 1.9),
        stroke(spline([(25, 66), (30, 64), (35, 67), (41, 64), (46, 66)], 4), 1.9),
    ]
    stylus_line = [(57, 95), (93, 47)]
    tip = [(54.5, 98.5), (58.4, 91.5), (60.5, 93.6)]
    spatula = rotate([(90.5, 39), (97.5, 39), (96.5, 47), (91.5, 47)], 37, 94, 45)
    return [
        (WOOD_D, [rrect(10, 14, 82, 86, 5)]),
        (WOOD, [rrect(12.5, 16.5, 79.5, 83.5, 3.5)]),
        (WAX, [rrect(19, 23, 73, 77, 2)]),
        ("#E2C08A", writing),
        (GOLD_D, [stroke(stylus_line, 3.6, False), tip, spatula]),
        (GOLD, [stroke([(60, 89), (89, 51)], 1.3)]),
    ]


def lyra():
    arm = spline([(36, 69), (27, 55), (23, 38), (26, 23), (22, 12)], 8)
    strings = [stroke([(x, 25), (50 + (x - 50) * 0.55, 68)], 1.15, False) for x in (40, 45, 50, 55, 60)]
    return [
        (GOLD_D, [stroke(arm, 6.2), stroke(mirror(arm)[::-1], 6.2)]),
        (WOOD, [ellipse(50, 76, 23, 15)]),
        (WOOD_L, [ellipse(50, 72.5, 18, 9)]),
        (WOOD_D, [stroke([(19, 23.5), (81, 23.5)], 4.6), stroke(spline([(36, 79), (50, 84), (64, 79)], 6), 1.4), rrect(39, 66.5, 61, 70, 1)]),
        (CREAM, strings),
        (GOLD, [circle(18.5, 23.5, 3.4), circle(81.5, 23.5, 3.4)]),
    ]


def aureus():
    head = spline([
        (46, 20), (56, 21), (62, 26), (65, 33), (66, 38.5), (67.5, 41), (72.5, 49), (69, 51), (68.5, 53),
        (70, 54.5), (67.5, 56), (69.5, 57.5), (68.2, 60.5), (68.5, 64), (65, 66.5), (59, 67), (57, 71),
        (59, 82.5), (38, 82.5), (40, 76), (38, 68), (33, 60), (30.5, 48), (32, 36), (38, 26),
    ], 5, closed=True)
    path = spline([(33, 57), (33, 44), (38, 33), (47, 26), (58, 24.5)], 8)
    wreath = []
    for i in range(1, len(path) - 1, 6):
        (x0, y0), (x1, y1) = path[i - 1], path[i + 1]
        ang = math.degrees(math.atan2(y1 - y0, x1 - x0))
        wreath += [leaf(path[i][0] - 2.2 * math.sin(math.radians(ang)) + 2 * math.cos(math.radians(ang)), path[i][1] + 2.2 * math.cos(math.radians(ang)) + 2 * math.sin(math.radians(ang)), 7, 2.8, ang + 30),
                   leaf(path[i][0] + 2.2 * math.sin(math.radians(ang)) + 2 * math.cos(math.radians(ang)), path[i][1] - 2.2 * math.cos(math.radians(ang)) + 2 * math.sin(math.radians(ang)), 7, 2.8, ang - 30)]
    ribbons = [stroke(spline([(33, 58), (30, 66), (31.5, 74)], 6), 1.8), stroke(spline([(34, 58), (34.5, 67), (37, 73)], 6), 1.8)]
    beads = [circle(50 + 38.5 * math.cos(math.radians(a)), 50 + 38.5 * math.sin(math.radians(a)), 1.5, 12) for a in range(0, 360, 12)]
    return [
        (GOLD_D, [circle(50, 50, 45)]),
        (GOLD, [circle(50, 50, 41.5)]),
        (GOLD_D, beads + [head] + ribbons),
        (GOLD_L, wreath + [ellipse(47, 50, 2.6, 4)]),
        (DARK, [circle(62.3, 40.6, 1.2)]),
    ]

def canis():
    dog = spline([
        (13, 44), (16, 49.5), (23, 50.5), (29, 54), (32, 62),
        (30, 80), (25.5, 83.5), (35.5, 83.5), (37.5, 66),
        (48, 64.5), (60, 63.5),
        (63.5, 67), (65.5, 80), (62.5, 83.5), (72.5, 83.5), (74.5, 72), (77, 63),
        (80, 52), (85, 45), (90, 35), (86.5, 36.5), (80.5, 45),
        (73, 46.5), (56, 46.5), (43, 44.5), (36.5, 38.5),
        (32.5, 30.5), (30.5, 21.5), (27.5, 18), (25.5, 27.5), (20.5, 32), (16.5, 38),
    ], 4, closed=True)
    border = [rrect(5, 5, 95, 95, 7)]
    return [
        (DARK, border),
        ("#EFE4CB", [rrect(10, 10, 90, 90, 4)]),
        (DARK, [dog]),
        (RED, [[(29.5, 40), (36.5, 36.5), (39, 41.5), (31.5, 46)]]),
        ("#EFE4CB", [circle(21.5, 35, 1.3)]),
    ]


# code, English name, fallback emoji (for phone notifications), drawing
EMOJI = [
    ("spqr", "SPQR: the Senate and the People of Rome", "🏛️", spqr),
    ("laurus", "a laurel wreath", "🌿", laurus),
    ("aquila", "the legion's eagle", "🦅", aquila),
    ("lupa", "the she-wolf with Romulus and Remus", "🐺", lupa),
    ("gladius", "a Roman sword", "🗡️", gladius),
    ("galea", "a crested helmet", "🪖", galea),
    ("scutum", "a legionary's shield", "🛡️", scutum),
    ("colosseum", "the Colosseum", "🏟️", colosseum),
    ("columna", "a column", "🏛️", columna),
    ("lucerna", "an oil lamp", "🪔", lucerna),
    ("tabula", "a wax tablet and stylus", "✍️", tabula),
    ("lyra", "a lyre", "🎶", lyra),
    ("aureus", "a gold coin", "🪙", aureus),
    ("canis", "cave canem: beware of the dog", "🐕", canis),
]
FIRST = 0xE100


def svg(layers, size=None):
    paths = "".join(f'<path fill="{c}" d="{d_of(cs)}"/>' for c, cs in layers)
    dim = f' width="{size}" height="{size}"' if size else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"{dim}>{paths}</svg>'


def d_of(contours):
    return "".join("M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in c) + "Z" for c in contours)


# ------------------------------------------------------------------- font

UPM = 1000
SCALE = 11.6  # grid units to font units: a glyph 1.16 em high
ASC, DESC = 940, -300


def to_font(x, y):
    return round(30 + x * SCALE), round(ASC - 60 - y * SCALE)


def build_font(drawn):
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.colorLib.builder import buildCOLR, buildCPAL

    def glyph(contours):
        pen = TTGlyphPen(None)
        for c in contours:
            pts = [to_font(x, y) for x, y in c]
            # drop repeated points
            clean = [p for i, p in enumerate(pts) if i == 0 or p != pts[i - 1]]
            if len(clean) > 1 and clean[0] == clean[-1]:
                clean.pop()
            if len(clean) < 3:
                continue
            pen.moveTo(clean[0])
            for p in clean[1:]:
                pen.lineTo(p)
            pen.closePath()
        return pen.glyph()

    order = [".notdef", "space"]
    glyphs = {".notdef": glyph([]), "space": glyph([])}
    colors = []
    layers_of = {}
    cmap = {0x20: "space"}
    for i, (code, _, _, layers) in enumerate(drawn):
        base = f"rx_{code}"
        order.append(base)
        glyphs[base] = glyph([c for _, cs in layers for c in cs if area(c) > 0])
        cmap[FIRST + i] = base
        refs = []
        for j, (color, cs) in enumerate(layers):
            name = f"{base}.{j}"
            order.append(name)
            glyphs[name] = glyph(cs)
            if color not in colors:
                colors.append(color)
            refs.append((name, colors.index(color)))
        layers_of[base] = refs
    advance = round(60 + 100 * SCALE)
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    # each glyph's left side bearing is where its outline starts: the layers of one emoji then stay in register
    glyf = fb.font["glyf"]
    lsb = {}
    for g in order:
        gl = glyf[g]
        gl.recalcBounds(glyf)
        lsb[g] = getattr(gl, "xMin", 0) if gl.numberOfContours else 0
    fb.setupHorizontalMetrics({g: (advance if g.startswith("rx_") else 300, lsb[g]) for g in order})
    fb.setupHorizontalHeader(ascent=ASC, descent=DESC)
    fb.setupNameTable({"familyName": "Tabula Roman Emoji", "styleName": "Regular"})
    fb.setupOS2(sTypoAscender=ASC, sTypoDescender=DESC, usWinAscent=ASC, usWinDescent=-DESC)
    fb.setupPost()
    rgba = lambda h: tuple(int(h[k : k + 2], 16) / 255 for k in (1, 3, 5)) + (1.0,)
    fb.font["CPAL"] = buildCPAL([[rgba(c) for c in colors]])
    fb.font["COLR"] = buildCOLR(layers_of)
    buf = io.BytesIO()
    fb.font.flavor = "woff2"
    fb.font.save(buf)
    return buf.getvalue()


def main():
    out = sys.argv[1]
    drawn = [(code, en, fb, [(color, [oriented(c) for c in cs]) for color, cs in fn()]) for code, en, fb, fn in EMOJI]
    font = build_font(drawn)
    items = [{"code": code, "en": en, "fallback": fb, "char": chr(FIRST + i)} for i, (code, en, fb, layers) in enumerate(drawn)]
    svgs = [svg(layers) for _, _, _, layers in drawn]
    with open(out, "w") as f:
        f.write("// Hand-drawn Roman emoji for the messenger, as a color font (COLR/CPAL) whose glyphs\n")
        f.write("// sit in the Private Use Area: messages store codes (\":lupa:\"), the page shows the glyphs.\n")
        f.write("// Generated by scripts/content/roman_emoji.py: do not edit by hand.\n\n")
        f.write("export interface RomanEmoji {\n  /** The code in a message: \":lupa:\". */\n  code: string;\n  en: string;\n  /** A plain emoji for places without the font (phone notifications). */\n  fallback: string;\n  /** The character the font draws. */\n  char: string;\n}\n\n")
        f.write(f"export const ROMAN_EMOJI: RomanEmoji[] = {json.dumps(items, ensure_ascii=False, indent=1)};\n\n")
        f.write(f'export const ROMAN_EMOJI_FONT = "data:font/woff2;base64,{base64.b64encode(font).decode()}";\n')
    print(f"{len(items)} emoji, font {len(font)} bytes")
    if len(sys.argv) > 2:
        cells = "".join(f'<figure>{g.replace("<svg ", "<svg width=128 height=128 ")}<figcaption>:{it["code"]}: · {g.replace("<svg ", "<svg width=24 height=24 ")} {g.replace("<svg ", "<svg width=18 height=18 ")}</figcaption></figure>' for it, g in zip(items, svgs))
        with open(sys.argv[2], "w") as f:
            f.write(f"<!doctype html><meta charset=utf-8><style>body{{font:14px sans-serif;background:#f6efe0;display:flex;flex-wrap:wrap;gap:14px;padding:14px}}figure{{margin:0;background:#fff;padding:8px;border-radius:8px;text-align:center}}figcaption{{display:flex;gap:6px;align-items:center;justify-content:center}}</style>{cells}")


if __name__ == "__main__":
    main()

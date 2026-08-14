"""Generate Villa Ops PWA icons (192x192, 512x512).
Design: dark ink background, brass keychain-tag motif (echoes the entry tag UI).
Run once locally; output committed to icons/.
"""
from PIL import Image, ImageDraw

INK = (22, 35, 31, 255)      # #16231F
BRASS = (201, 154, 61, 255)  # #C99A3D
INK_HOLE = (22, 35, 31, 255)

def make_icon(size, path):
    scale = 4  # supersample for smooth edges
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # background: rounded square, ink color
    bg_radius = int(s * 0.22)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=bg_radius, fill=INK)

    # keychain tag shape, centered, rotated feel via simple rounded rect + hole + notch
    tag_w = s * 0.46
    tag_h = s * 0.60
    cx, cy = s / 2, s / 2
    left = cx - tag_w / 2
    top = cy - tag_h / 2
    right = cx + tag_w / 2
    bottom = cy + tag_h / 2

    tag_radius = tag_w * 0.22
    d.rounded_rectangle([left, top, right, bottom], radius=tag_radius, fill=BRASS)

    # hole near top of tag
    hole_r = tag_w * 0.11
    hole_cx = cx
    hole_cy = top + tag_h * 0.22
    d.ellipse(
        [hole_cx - hole_r, hole_cy - hole_r, hole_cx + hole_r, hole_cy + hole_r],
        fill=INK_HOLE,
    )

    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)
    print("wrote", path)

make_icon(192, "icons/icon-192.png")
make_icon(512, "icons/icon-512.png")

# maskable variant (512) with extra safe-zone padding since Android crops to a circle
def make_maskable(size, path):
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, s, s], fill=INK)

    tag_w = s * 0.34
    tag_h = s * 0.44
    cx, cy = s / 2, s / 2
    left = cx - tag_w / 2
    top = cy - tag_h / 2
    right = cx + tag_w / 2
    bottom = cy + tag_h / 2
    tag_radius = tag_w * 0.22
    d.rounded_rectangle([left, top, right, bottom], radius=tag_radius, fill=BRASS)

    hole_r = tag_w * 0.11
    hole_cx = cx
    hole_cy = top + tag_h * 0.22
    d.ellipse(
        [hole_cx - hole_r, hole_cy - hole_r, hole_cx + hole_r, hole_cy + hole_r],
        fill=INK_HOLE,
    )

    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)
    print("wrote", path)

make_maskable(512, "icons/icon-512-maskable.png")

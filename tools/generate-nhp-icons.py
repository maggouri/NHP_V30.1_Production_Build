"""Generate Chrome Ext icons from the EmailCore site brand mark (favicon.svg)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

# Site source: NHP_PLATFORM/01_EmailCore/public/favicon.svg
BG = (26, 29, 35, 255)  # #1a1d23
STROKE = (238, 242, 247, 255)  # #eef2f7
ACCENT = (0, 209, 178, 255)  # #00d1b2

DESTS = [
    Path(r"C:\Users\MAGGOURIKHALID\Desktop\NHP_V30.1_Production_Build"),
    Path(
        r"C:\Users\MAGGOURIKHALID\Desktop\NHP_Backups\NHP_V30.1_Production_Build"
        r"\NHP_PLATFORM\02_Chrome_Extension"
    ),
]

SITE_FAVICON_SVG = Path(
    r"C:\Users\MAGGOURIKHALID\Desktop\NHP_Backups\NHP_V30.1_Production_Build"
    r"\NHP_PLATFORM\01_EmailCore\public\favicon.svg"
)


def _draw_mark(canvas: int) -> Image.Image:
    """Rasterize favicon.svg geometry onto a canvas×canvas RGBA image."""
    s = canvas / 512.0
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def u(*vals: float) -> list[float]:
        return [v * s for v in vals]

    # Rounded square background (rx=108 in 512 space)
    d.rounded_rectangle(u(0, 0, 512, 512), radius=108 * s, fill=BG)

    # Envelope body stroke (stroke-width 28). Draw as thick outline via outer/inner.
    sw = max(2.0, 28 * s)
    # Outer envelope rounded rect
    body = u(120, 168, 392, 344)
    radius = 24 * s
    d.rounded_rectangle(body, radius=radius, outline=STROKE, width=int(round(sw)))

    # Envelope flap: M96 192 L256 296 L416 192  (stroke, round joins)
    flap = u(96, 192, 256, 296, 416, 192)
    d.line(
        [(flap[0], flap[1]), (flap[2], flap[3]), (flap[4], flap[5])],
        fill=STROKE,
        width=int(round(sw)),
        joint="curve",
    )

    # Teal hexagon accent: 256,236 284,252 284,284 256,300 228,284 228,252
    hex_pts = u(256, 236, 284, 252, 284, 284, 256, 300, 228, 284, 228, 252)
    d.polygon(
        [
            (hex_pts[0], hex_pts[1]),
            (hex_pts[2], hex_pts[3]),
            (hex_pts[4], hex_pts[5]),
            (hex_pts[6], hex_pts[7]),
            (hex_pts[8], hex_pts[9]),
            (hex_pts[10], hex_pts[11]),
        ],
        fill=ACCENT,
    )
    return img


def draw_icon(size: int) -> Image.Image:
    # Render at 512 then downscale for crisp small icons.
    master = _draw_mark(512)
    if size == 512:
        return master
    return master.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    sizes = (
        (16, "icon16.png"),
        (32, "icon32.png"),
        (48, "icon48.png"),
        (128, "icon128.png"),
        (256, "icon256.png"),
    )
    for dest in DESTS:
        icons = dest / "icons"
        icons.mkdir(exist_ok=True)
        for size, name in sizes:
            path = icons / name
            draw_icon(size).save(path, format="PNG", optimize=True)
            print(f"  {path} ({path.stat().st_size}b)")
        root = dest / "icon.png"
        draw_icon(128).save(root, format="PNG", optimize=True)
        print(f"  {root} ({root.stat().st_size}b)")
        # Keep a copy of the site SVG next to PNGs for future regenerations.
        if SITE_FAVICON_SVG.is_file():
            svg_dest = icons / "emailcore-mark.svg"
            svg_dest.write_bytes(SITE_FAVICON_SVG.read_bytes())
            print(f"  {svg_dest}")
    print("done (source: EmailCore public/favicon.svg)")


if __name__ == "__main__":
    main()

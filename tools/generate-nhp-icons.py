"""Generate Niche Hunter Pro toolbar icons (EmailCore style, hunt mark).

Style family matches EmailCore site favicon (dark rounded square, white
line-art, teal hex) but the glyph is distinct: magnifying glass + target
ring + EmailCore hex — niche discovery / trend hunting, not mail.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

# Brand tokens (EmailCore / admin)
BG = (26, 29, 35, 255)  # #1a1d23
STROKE = (238, 242, 247, 255)  # #eef2f7
ACCENT = (0, 209, 178, 255)  # #00d1b2 teal
PURPLE = (167, 139, 250, 255)  # #a78bfa

DESTS = [
    Path(r"C:\Users\MAGGOURIKHALID\Desktop\NHP_V30.1_Production_Build"),
    Path(
        r"C:\Users\MAGGOURIKHALID\Desktop\NHP_Backups\NHP_V30.1_Production_Build"
        r"\NHP_PLATFORM\02_Chrome_Extension"
    ),
]

# Extension hunt-mark SVG (not the site envelope favicon)
NHP_MARK_SVG = """\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Niche Hunter Pro">
  <rect width="512" height="512" rx="108" fill="#1a1d23"/>
  <!-- Magnifying glass lens -->
  <circle cx="214" cy="214" r="118" fill="none" stroke="#eef2f7" stroke-width="28" stroke-linecap="round"/>
  <!-- Target ring (hunt) -->
  <circle cx="214" cy="214" r="68" fill="none" stroke="#a78bfa" stroke-width="20" stroke-linecap="round"/>
  <!-- EmailCore teal hex (shared brand geometry) -->
  <polygon fill="#00d1b2" points="214,184 242,200 242,232 214,248 186,232 186,200"/>
  <!-- Handle -->
  <line x1="302" y1="302" x2="412" y2="412" stroke="#eef2f7" stroke-width="34" stroke-linecap="round"/>
</svg>
"""


def _draw_mark(canvas: int) -> Image.Image:
    """Rasterize NHP hunt-mark geometry onto a canvas×canvas RGBA image."""
    s = canvas / 512.0
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def u(*vals: float) -> list[float]:
        return [v * s for v in vals]

    # Rounded square background (rx=108 in 512 space)
    d.rounded_rectangle(u(0, 0, 512, 512), radius=108 * s, fill=BG)

    cx, cy = 214 * s, 214 * s
    sw_lens = max(2.0, 28 * s)
    sw_target = max(2.0, 20 * s)
    sw_handle = max(2.0, 34 * s)

    # Lens (white)
    r_lens = 118 * s
    d.ellipse(
        [cx - r_lens, cy - r_lens, cx + r_lens, cy + r_lens],
        outline=STROKE,
        width=int(round(sw_lens)),
    )

    # Target ring (purple)
    r_tgt = 68 * s
    d.ellipse(
        [cx - r_tgt, cy - r_tgt, cx + r_tgt, cy + r_tgt],
        outline=PURPLE,
        width=int(round(sw_target)),
    )

    # Teal hex at lens center (EmailCore accent geometry)
    hex_pts = u(214, 184, 242, 200, 242, 232, 214, 248, 186, 232, 186, 200)
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

    # Handle (white, round caps via thick line)
    handle = u(302, 302, 412, 412)
    d.line(
        [(handle[0], handle[1]), (handle[2], handle[3])],
        fill=STROKE,
        width=int(round(sw_handle)),
    )
    # Round cap disks (PIL line caps are square on some builds)
    cap_r = sw_handle / 2.0
    for hx, hy in ((handle[0], handle[1]), (handle[2], handle[3])):
        d.ellipse(
            [hx - cap_r, hy - cap_r, hx + cap_r, hy + cap_r],
            fill=STROKE,
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
        svg_dest = icons / "nhp-mark.svg"
        svg_dest.write_text(NHP_MARK_SVG, encoding="utf-8")
        print(f"  {svg_dest}")
        # Remove obsolete envelope copy if present (site favicon is separate).
        legacy = icons / "emailcore-mark.svg"
        if legacy.is_file():
            legacy.unlink()
            print(f"  removed {legacy}")
    print("done (source: NHP hunt mark — mag glass + target + teal hex)")


if __name__ == "__main__":
    main()

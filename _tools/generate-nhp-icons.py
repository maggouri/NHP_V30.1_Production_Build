"""Generate clean Niche Hunter Pro Chrome icons (lightbulb badge, no legacy text)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

DESTS = [
    Path(r"C:\Users\MAGGOURIKHALID\Desktop\NHP_V30.1_Production_Build"),
    Path(
        r"C:\Users\MAGGOURIKHALID\Desktop\NHP_Backups\NHP_V30.1_Production_Build"
        r"\NHP_PLATFORM\02_Chrome_Extension"
    ),
]


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)

    def xy(vals):
        return [v * size / 100 for v in vals]

    stroke = max(2, int(size * 0.055))
    d.ellipse(xy([6, 6, 94, 94]), fill=(255, 255, 255, 255))
    d.ellipse(xy([9.5, 9.5, 90.5, 90.5]), fill=(242, 157, 74, 255))

    bulb = xy([32, 18, 68, 58])
    d.ellipse(
        [bulb[0] - stroke / 2, bulb[1] - stroke / 2, bulb[2] + stroke / 2, bulb[3] + stroke / 2],
        fill=(10, 10, 10, 255),
    )
    d.ellipse(bulb, fill=(255, 255, 255, 255))
    d.arc(xy([40, 28, 46, 36]), 200, 320, fill=(10, 10, 10, 255), width=max(1, stroke // 2))
    d.arc(xy([38, 38, 44, 44]), 200, 320, fill=(10, 10, 10, 255), width=max(1, stroke // 2))

    neck = xy([44, 56, 56, 68])
    d.rounded_rectangle(
        [neck[0] - stroke / 2, neck[1] - stroke / 2, neck[2] + stroke / 2, neck[3] + stroke / 2],
        radius=size * 0.03,
        fill=(10, 10, 10, 255),
    )
    d.rounded_rectangle(neck, radius=size * 0.02, fill=(255, 255, 255, 255))
    d.rounded_rectangle(xy([40, 66, 60, 78]), radius=size * 0.04, fill=(10, 10, 10, 255))
    for y in (70, 73, 76):
        yy = y * size / 100
        d.line(
            [(42 * size / 100, yy), (58 * size / 100, yy)],
            fill=(40, 40, 40, 255),
            width=max(1, size // 64),
        )
    return img


def main() -> None:
    for dest in DESTS:
        icons = dest / "icons"
        icons.mkdir(exist_ok=True)
        for size, name in (
            (16, "icon16.png"),
            (32, "icon32.png"),
            (48, "icon48.png"),
            (128, "icon128.png"),
            (256, "icon256.png"),
        ):
            path = icons / name
            draw_icon(size).save(path, format="PNG", optimize=True)
            print(f"  {path} ({path.stat().st_size}b)")
        root = dest / "icon.png"
        draw_icon(128).save(root, format="PNG", optimize=True)
        print(f"  {root} ({root.stat().st_size}b)")
    print("done")


if __name__ == "__main__":
    main()

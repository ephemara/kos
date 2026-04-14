"""
Generate a 100-icon themed preview batch using the real UI Forge preview system.

This version intentionally uses a broader icon vocabulary so the gallery reads
like a catalog instead of a repeated primitive exercise.
"""

import logging
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core import UIForgeEngine
from llm_api import animate, circle, linear, path, polygon, rect, render_catalog_partitioned, solid
from preview_manager import PreviewManager


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


THEMES = [
    {"name": "aurora", "background": "#08121a", "primary": "#67e8f9", "secondary": "#2563eb", "accent": "#ecfeff", "shadow": "#0a0f1f"},
    {"name": "ember", "background": "#1a0f0b", "primary": "#fb7185", "secondary": "#f97316", "accent": "#fff1e6", "shadow": "#220904"},
    {"name": "forest", "background": "#07130d", "primary": "#34d399", "secondary": "#65a30d", "accent": "#f0fdf4", "shadow": "#041109"},
    {"name": "violet", "background": "#12081d", "primary": "#a78bfa", "secondary": "#7c3aed", "accent": "#faf5ff", "shadow": "#12051c"},
]

MOTIONS = ["pulse", "orbit", "float", "shake", "wobble"]


def diamond(cx: int, cy: int, r: int, **kwargs):
    return polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], **kwargs)


def chevron_up(cx: int, cy: int, w: int, h: int, **kwargs):
    half = w // 2
    return polygon([(cx - half, cy + h // 4), (cx, cy - h // 2), (cx + half, cy + h // 4), (cx + half - 8, cy + h // 2), (cx, cy - h // 8), (cx - half + 8, cy + h // 2)], **kwargs)


def bolt(cx: int, cy: int, **kwargs):
    return polygon([(cx - 6, cy - 30), (cx + 8, cy - 30), (cx + 1, cy - 5), (cx + 18, cy - 5), (cx - 10, cy + 30), (cx - 2, cy + 6), (cx - 18, cy + 6)], **kwargs)


def spark(cx: int, cy: int, **kwargs):
    return polygon([(cx, cy - 28), (cx + 8, cy - 8), (cx + 28, cy), (cx + 8, cy + 8), (cx, cy + 28), (cx - 8, cy + 8), (cx - 28, cy), (cx - 8, cy - 8)], **kwargs)


def shield(cx: int, cy: int, **kwargs):
    return polygon([(cx, cy - 30), (cx + 24, cy - 18), (cx + 20, cy + 8), (cx, cy + 30), (cx - 20, cy + 8), (cx - 24, cy - 18)], **kwargs)


def fan_blades(theme: dict):
    return [
        polygon([(48, 16), (58, 38), (48, 48), (38, 38)], fill=solid(theme["accent"]), opacity=0.95),
        polygon([(80, 48), (58, 58), (48, 48), (58, 38)], fill=solid(theme["accent"]), opacity=0.9),
        polygon([(48, 80), (38, 58), (48, 48), (58, 58)], fill=solid(theme["accent"]), opacity=0.85),
        polygon([(16, 48), (38, 38), (48, 48), (38, 58)], fill=solid(theme["accent"]), opacity=0.8),
    ]


def motif_layers(theme: dict, motif: int):
    c = 48
    p = theme["primary"]
    s = theme["secondary"]
    a = theme["accent"]
    bg = theme["background"]
    shadow = theme["shadow"]

    motifs = [
        [
            circle(c, c, 34, fill=linear(s, p, angle=135), opacity=0.35),
            circle(c, c, 26, fill=linear(p, s, angle=35)),
            path("M 48 22 L 64 48 L 48 74 L 32 48 Z", fill=solid(a)),
        ],
        [
            rect(14, 14, 68, 68, rx=18, fill=linear(p, s, angle=90)),
            rect(24, 24, 48, 48, rx=14, fill=solid(shadow), opacity=0.35),
            bolt(c, c, fill=solid(a)),
        ],
        [
            shield(c, c, fill=linear(s, p, angle=180)),
            chevron_up(c, 52, 34, 38, fill=solid(a)),
        ],
        [
            circle(c, c, 30, fill=solid(s), opacity=0.22),
            diamond(c, c, 26, fill=linear(p, s, angle=45)),
            circle(c, c, 8, fill=solid(a)),
        ],
        [
            rect(20, 20, 56, 56, rx=12, fill=solid(p), opacity=0.2),
            rect(28, 28, 40, 40, rx=10, fill=linear(s, p, angle=135)),
            rect(40, 16, 16, 64, rx=8, fill=solid(a)),
        ],
        [
            circle(c, c, 34, fill=linear(p, s, angle=0)),
            circle(c, c, 24, fill=solid(bg)),
            spark(c, c, fill=solid(a)),
        ],
        [
            shield(c, c, fill=solid(shadow), opacity=0.3),
            shield(c, c - 2, fill=linear(p, s, angle=90)),
            path("M 32 54 L 44 42 L 52 50 L 66 34", stroke={"color": a, "width": 8, "cap": "round", "join": "round"}, fill=None),
        ],
        [
            circle(c, c, 14, fill=solid(a)),
            *fan_blades(theme),
            circle(c, c, 6, fill=solid(s)),
        ],
        [
            diamond(c, c, 32, fill=linear(s, p, angle=90)),
            diamond(c, c, 20, fill=solid(bg), opacity=0.85),
            chevron_up(c, 50, 28, 28, fill=solid(a)),
        ],
        [
            rect(16, 22, 64, 52, rx=16, fill=linear(p, s, angle=180)),
            circle(32, 48, 8, fill=solid(a)),
            circle(48, 48, 8, fill=solid(a), opacity=0.8),
            circle(64, 48, 8, fill=solid(a), opacity=0.6),
        ],
    ]
    return motifs[motif % len(motifs)]


def build_item(theme: dict, index: int) -> dict:
    motif = index % 10
    item = {
        "name": f"{theme['name']}-icon-{index:02d}",
        "description": f"{theme['name'].title()} catalog icon {index:02d}",
        "layers": motif_layers(theme, motif),
        "category": f"mega-preview/{theme['name']}",
        "tags": ["preview", "theme", theme["name"], f"motif-{motif}"],
        "size": 96,
        "background": theme["background"],
        "padding": 8,
        "antialias": 2,
        "formats": ["png", "svg"],
    }

    if index % 5 == 0:
        motion = MOTIONS[(index // 5) % len(MOTIONS)]
        motion_params = {
            "pulse": {"intensity": 0.14, "frequency": 1.8},
            "orbit": {"radius": 6},
            "float": {"amplitude": 5, "axis": "vertical"},
            "shake": {"amplitude": 3},
            "wobble": {"angle": 12},
        }
        item["animation"] = animate(
            motion,
            duration=1.4,
            fps=12,
            output="apng",
            motion_params={motion: motion_params.get(motion, {})},
        )
        item["formats"] = ["png", "svg", "apng"]

    return item


def build_catalog() -> list[dict]:
    return [build_item(theme, index) for theme in THEMES for index in range(25)]


def main() -> int:
    base_dir = Path(__file__).parent.parent
    output_dir = base_dir / "output" / "mega_preview_100"
    preview_dir = base_dir / "preview" / "mega_preview_100"
    preview_manager = PreviewManager()
    engine = UIForgeEngine(output_dir=output_dir)
    preview_id = "mega_preview_100"

    if output_dir.exists():
        shutil.rmtree(output_dir)
    if preview_dir.exists():
        shutil.rmtree(preview_dir)

    items = build_catalog()
    logger.info("Generating %s icons across %s themes", len(items), len(THEMES))

    partitioned_results = render_catalog_partitioned(
        items,
        engine=engine,
        parallel=False,
        batch_size=25,
    )

    results = [result for batch_results in partitioned_results for result in batch_results]
    success_results = [result for result in results if result.success]
    logger.info("Generated %s/%s icons", len(success_results), len(results))

    for result in success_results:
        preview_manager.stage_asset(result, preview_id=preview_id)

    gallery_path = preview_manager.generate_gallery(preview_id)
    print(gallery_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

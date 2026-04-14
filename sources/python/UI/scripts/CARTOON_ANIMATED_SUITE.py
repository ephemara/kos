"""
Generate a transparent, one-color animated icon suite with cartoon silhouettes.

The gallery prefers APNG previews so motion is visible in the browser.
"""

import logging
import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core import UIForgeEngine
from llm_api import animate, circle, path, polygon, rect, render_catalog_partitioned, solid


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


SUITE_SPEC = {
    "tool": {
        "color": "#ff7a59",
        "motion": "wobble",
        "icons": [
            {
                "name": "select-cursor",
                "layers": [
                    path(
                        "M 18 12 L 66 42 L 46 46 L 58 78 L 46 82 L 34 50 L 18 66 Z",
                        fill=solid("#ff7a59"),
                    )
                ],
            },
            {
                "name": "move-gizmo",
                "layers": [
                    rect(43, 16, 10, 54, rx=5, fill=solid("#ff7a59")),
                    rect(21, 38, 54, 10, rx=5, fill=solid("#ff7a59")),
                    polygon([(48, 10), (58, 24), (38, 24)], fill=solid("#ff7a59")),
                    polygon([(48, 86), (58, 72), (38, 72)], fill=solid("#ff7a59")),
                    polygon([(10, 43), (24, 38), (24, 58)], fill=solid("#ff7a59")),
                    polygon([(86, 43), (72, 38), (72, 58)], fill=solid("#ff7a59")),
                ],
            },
            {
                "name": "rotate-swoosh",
                "layers": [
                    path(
                        "M 28 26 Q 54 10 72 30 Q 82 42 80 58 L 66 54 Q 66 42 58 36 Q 48 28 34 34 Z",
                        fill=solid("#ff7a59"),
                    ),
                    polygon([(72, 18), (84, 34), (64, 34)], fill=solid("#ff7a59")),
                ],
            },
            {
                "name": "scale-corners",
                "layers": [
                    rect(18, 18, 18, 18, rx=6, fill=solid("#ff7a59")),
                    rect(60, 18, 18, 18, rx=6, fill=solid("#ff7a59")),
                    rect(18, 60, 18, 18, rx=6, fill=solid("#ff7a59")),
                    rect(60, 60, 18, 18, rx=6, fill=solid("#ff7a59")),
                ],
            },
        ],
    },
    "nav": {
        "color": "#5bbcff",
        "motion": "float",
        "icons": [
            {
                "name": "orbit-camera",
                "layers": [
                    circle(48, 48, 24, fill=solid("#5bbcff"), opacity=0.22),
                    path(
                        "M 14 48 Q 28 20 48 20 Q 68 20 82 48 Q 68 76 48 76 Q 28 76 14 48 Z",
                        fill=solid("#5bbcff"),
                    ),
                ],
            },
            {
                "name": "hand-pan",
                "layers": [
                    path(
                        "M 34 18 L 42 18 L 42 46 L 46 46 L 46 14 L 54 14 L 54 46 L 58 46 L 58 20 L 66 20 L 66 50 Q 66 70 52 78 L 38 78 Q 24 72 22 58 L 22 38 L 30 38 L 30 54 Q 30 62 36 66 L 50 66 Q 58 62 58 54 L 58 18 L 50 18 L 50 46 L 46 46 L 46 18 L 38 18 L 38 46 L 34 46 Z",
                        fill=solid("#5bbcff"),
                    )
                ],
            },
            {
                "name": "zoom-plus",
                "layers": [
                    circle(40, 40, 18, fill=solid("#5bbcff")),
                    rect(36, 24, 8, 32, rx=4, fill=solid("#5bbcff")),
                    rect(24, 36, 32, 8, rx=4, fill=solid("#5bbcff")),
                    path(
                        "M 54 54 L 66 66 Q 72 72 66 78 Q 60 84 54 78 L 42 66 Z",
                        fill=solid("#5bbcff"),
                    ),
                ],
            },
            {
                "name": "compass-burst",
                "layers": [
                    polygon([(48, 10), (58, 32), (48, 26), (38, 32)], fill=solid("#5bbcff")),
                    polygon([(86, 48), (64, 58), (70, 48), (64, 38)], fill=solid("#5bbcff")),
                    polygon([(48, 86), (58, 64), (48, 70), (38, 64)], fill=solid("#5bbcff")),
                    polygon([(10, 48), (32, 58), (26, 48), (32, 38)], fill=solid("#5bbcff")),
                    circle(48, 48, 14, fill=solid("#5bbcff")),
                ],
            },
        ],
    },
    "object": {
        "color": "#ffd166",
        "motion": "pulse",
        "icons": [
            {
                "name": "cube-block",
                "layers": [
                    polygon([(48, 12), (76, 28), (48, 44), (20, 28)], fill=solid("#ffd166")),
                    polygon([(20, 28), (48, 44), (48, 78), (20, 62)], fill=solid("#ffd166"), opacity=0.82),
                    polygon([(76, 28), (48, 44), (48, 78), (76, 62)], fill=solid("#ffd166"), opacity=0.62),
                ],
            },
            {
                "name": "sphere-bounce",
                "layers": [
                    circle(48, 48, 28, fill=solid("#ffd166")),
                    circle(38, 36, 8, fill=solid("#ffd166"), opacity=0.55),
                ],
            },
            {
                "name": "gem-diamond",
                "layers": [
                    polygon([(48, 14), (78, 48), (48, 82), (18, 48)], fill=solid("#ffd166")),
                    polygon([(48, 24), (66, 48), (48, 72), (30, 48)], fill=solid("#ffd166"), opacity=0.74),
                ],
            },
            {
                "name": "stacked-assets",
                "layers": [
                    rect(18, 24, 40, 14, rx=6, fill=solid("#ffd166"), opacity=0.58),
                    rect(28, 42, 40, 14, rx=6, fill=solid("#ffd166"), opacity=0.78),
                    rect(38, 60, 40, 14, rx=6, fill=solid("#ffd166")),
                ],
            },
        ],
    },
    "edit": {
        "color": "#7bd389",
        "motion": "shake",
        "icons": [
            {
                "name": "bevel-corner",
                "layers": [
                    polygon([(20, 20), (76, 20), (76, 40), (40, 76), (20, 76)], fill=solid("#7bd389"))
                ],
            },
            {
                "name": "loop-cut",
                "layers": [
                    rect(20, 18, 56, 60, rx=14, fill=solid("#7bd389"), opacity=0.28),
                    rect(18, 42, 60, 12, rx=6, fill=solid("#7bd389")),
                ],
            },
            {
                "name": "knife-slice",
                "layers": [
                    path("M 22 74 L 60 18 L 74 30 L 36 86 Z", fill=solid("#7bd389")),
                    polygon([(58, 18), (80, 12), (70, 32)], fill=solid("#7bd389")),
                ],
            },
            {
                "name": "extrude-face",
                "layers": [
                    rect(18, 34, 24, 24, rx=8, fill=solid("#7bd389")),
                    rect(54, 20, 24, 24, rx=8, fill=solid("#7bd389"), opacity=0.72),
                    polygon([(42, 42), (54, 30), (54, 48), (42, 60)], fill=solid("#7bd389")),
                ],
            },
        ],
    },
    "paint": {
        "color": "#ff5d8f",
        "motion": "strobe",
        "icons": [
            {
                "name": "brush-tip",
                "layers": [
                    path("M 48 12 L 66 42 L 48 80 L 30 42 Z", fill=solid("#ff5d8f")),
                    rect(38, 62, 20, 18, rx=8, fill=solid("#ff5d8f")),
                ],
            },
            {
                "name": "paint-drop",
                "layers": [
                    path("M 48 12 Q 68 34 68 54 Q 68 76 48 84 Q 28 76 28 54 Q 28 34 48 12 Z", fill=solid("#ff5d8f"))
                ],
            },
            {
                "name": "spray-burst",
                "layers": [
                    rect(18, 40, 26, 20, rx=8, fill=solid("#ff5d8f")),
                    rect(42, 44, 16, 12, rx=6, fill=solid("#ff5d8f")),
                    circle(68, 30, 4, fill=solid("#ff5d8f")),
                    circle(76, 40, 5, fill=solid("#ff5d8f")),
                    circle(72, 52, 4, fill=solid("#ff5d8f")),
                    circle(82, 48, 3, fill=solid("#ff5d8f")),
                ],
            },
            {
                "name": "ink-star",
                "layers": [
                    polygon(
                        [(48, 14), (58, 36), (82, 40), (64, 54), (70, 80), (48, 66), (26, 80), (32, 54), (14, 40), (38, 36)],
                        fill=solid("#ff5d8f"),
                    )
                ],
            },
        ],
    },
    "status": {
        "color": "#c084fc",
        "motion": "bounce",
        "icons": [
            {
                "name": "spark-badge",
                "layers": [
                    circle(48, 48, 26, fill=solid("#c084fc"), opacity=0.24),
                    polygon(
                        [(48, 18), (56, 38), (78, 48), (56, 58), (48, 78), (40, 58), (18, 48), (40, 38)],
                        fill=solid("#c084fc"),
                    ),
                ],
            },
            {
                "name": "bell-ring",
                "layers": [
                    path("M 48 18 Q 64 18 64 38 L 64 56 Q 64 60 72 64 L 24 64 Q 32 60 32 56 L 32 38 Q 32 18 48 18 Z", fill=solid("#c084fc")),
                    circle(48, 74, 7, fill=solid("#c084fc")),
                ],
            },
            {
                "name": "pin-drop",
                "layers": [
                    path("M 48 14 Q 68 14 68 36 Q 68 56 48 82 Q 28 56 28 36 Q 28 14 48 14 Z", fill=solid("#c084fc")),
                    circle(48, 36, 9, fill=solid("#c084fc"), opacity=0.42),
                ],
            },
            {
                "name": "signal-bars",
                "layers": [
                    rect(16, 58, 12, 16, rx=6, fill=solid("#c084fc")),
                    rect(34, 46, 12, 28, rx=6, fill=solid("#c084fc")),
                    rect(52, 32, 12, 42, rx=6, fill=solid("#c084fc")),
                    rect(70, 18, 12, 56, rx=6, fill=solid("#c084fc")),
                ],
            },
        ],
    },
}


def build_catalog():
    items = []
    for category, spec in SUITE_SPEC.items():
        for icon in spec["icons"]:
            items.append(
                {
                    "name": f"{category}-{icon['name']}",
                    "description": f"Cartoon {category} suite icon",
                    "layers": icon["layers"],
                    "category": f"cartoon-suite/{category}",
                    "tags": ["cartoon", "suite", category, spec["motion"], "transparent", "solid-color"],
                    "size": 96,
                    "background": None,
                    "padding": 8,
                    "antialias": 2,
                    "formats": ["png", "svg", "apng"],
                    "colors": [spec["color"]],
                    "animation": animate(
                        spec["motion"],
                        duration=1.25,
                        fps=14,
                        output="apng",
                        motion_params={
                            spec["motion"]: {
                                "radius": 5,
                                "amplitude": 4,
                                "intensity": 0.14,
                                "frequency": 1.4,
                                "angle": 9,
                            }
                        },
                    ),
                }
            )
    return items


def create_gallery(results, output_path: Path):
    categories = {}
    for result in results:
        categories.setdefault(result.metadata.category, []).append(result)

    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cartoon Animated Suite</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Trebuchet MS", sans-serif;
      color: #f8fafc;
      background:
        radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 28%),
        linear-gradient(135deg, #0f172a 0%, #081224 55%, #020617 100%);
      padding: 32px;
    }
    h1 { margin: 0 0 8px; font-size: 42px; }
    p.lead { margin: 0 0 28px; color: #cbd5e1; max-width: 900px; }
    .section { margin: 34px 0 42px; }
    .section h2 {
      margin: 0 0 18px;
      font-size: 22px;
      text-transform: capitalize;
      letter-spacing: 0.04em;
      color: #93c5fd;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 18px;
    }
    .card {
      background: rgba(15, 23, 42, 0.78);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.28);
    }
    .preview {
      height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      background:
        linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.06) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.06) 75%);
      background-size: 24px 24px;
      background-position: 0 0, 0 12px, 12px -12px, -12px 0;
    }
    .preview img {
      width: 112px;
      height: 112px;
      object-fit: contain;
      filter: drop-shadow(0 12px 16px rgba(0,0,0,0.28));
    }
    .info { padding: 16px 16px 18px; }
    .name { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
    .meta { color: #94a3b8; font-size: 13px; line-height: 1.5; }
    .tags { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
    .tag {
      font-size: 11px;
      border-radius: 999px;
      padding: 4px 9px;
      background: rgba(59, 130, 246, 0.14);
      color: #bfdbfe;
    }
  </style>
</head>
<body>
  <h1>Cartoon Animated Suite</h1>
  <p class="lead">Transparent, one-color, cartoon-styled animated icons for a DCC-style suite. APNG is used when available so the motion shows directly in the browser.</p>
"""

    for category, items in categories.items():
        html += f'  <section class="section"><h2>{category.split("/")[-1]}</h2><div class="grid">\n'
        for result in items:
            preview_path = result.output_paths.get("apng") or result.output_paths.get("png")
            rel_path = Path(os.path.relpath(Path(preview_path).resolve(), output_path.parent.resolve()))
            html += f"""    <article class="card">
      <div class="preview"><img src="{rel_path.as_posix()}" alt="{result.template_name}"></div>
      <div class="info">
        <div class="name">{result.template_name}</div>
        <div class="meta">Formats: {", ".join(result.output_paths.keys())}<br>Animation: {result.metadata.animation_type or "none"}</div>
        <div class="tags">{"".join(f'<span class="tag">{tag}</span>' for tag in result.metadata.tags)}</div>
      </div>
    </article>
"""
        html += "  </div></section>\n"

    html += "</body></html>\n"
    output_path.write_text(html, encoding="utf-8")


def main() -> int:
    base_dir = Path(__file__).parent.parent
    output_dir = base_dir / "output" / "cartoon_animated_suite"
    gallery_path = base_dir / "preview" / "cartoon_animated_suite.html"

    if output_dir.exists():
        shutil.rmtree(output_dir)
    if gallery_path.exists():
        gallery_path.unlink()

    engine = UIForgeEngine(output_dir=output_dir)
    results_by_partition = render_catalog_partitioned(
        build_catalog(),
        engine=engine,
        parallel=False,
        batch_size=8,
    )
    results = [result for batch in results_by_partition for result in batch if result.success]
    logger.info("Generated %s animated icons", len(results))

    gallery_path.parent.mkdir(parents=True, exist_ok=True)
    create_gallery(results, gallery_path)
    print(gallery_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

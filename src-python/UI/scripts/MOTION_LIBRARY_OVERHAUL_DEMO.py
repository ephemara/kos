"""
Generate a preview gallery for the expanded motion library.
"""

import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core import UIForgeEngine
from llm_api import animate, circle, icon, path, polygon, rect, render_catalog_partitioned, solid


BASE_DIR = Path(__file__).parent.parent
OUTPUT_DIR = BASE_DIR / "output" / "motion_overhaul_demo"
GALLERY_PATH = BASE_DIR / "preview" / "motion_overhaul_demo.html"


MOTION_SPECS = [
    ("hover", "#5bbcff", [circle(48, 48, 24, fill=solid("#5bbcff"))], {"amplitude": 5, "tilt": 6, "frequency": 1.0}),
    ("breath", "#7bd389", [circle(48, 48, 26, fill=solid("#7bd389"))], {"intensity": 0.12, "frequency": 1.0}),
    ("jelly", "#ff7a59", [rect(20, 20, 56, 56, rx=14, fill=solid("#ff7a59"))], {"intensity": 0.16, "frequency": 2.5}),
    ("snap", "#ffd166", [polygon([(20, 20), (76, 20), (76, 76), (20, 76)], fill=solid("#ffd166"))], {"distance": 8, "angle": 20}),
    ("blink", "#c084fc", [path("M 16 48 Q 30 26 48 26 Q 66 26 80 48 Q 66 70 48 70 Q 30 70 16 48 Z", fill=solid("#c084fc"))], {"frequency": 2.6}),
    ("pop", "#ff5d8f", [circle(48, 48, 20, fill=solid("#ff5d8f"))], {"overshoot": 0.28, "frequency": 1.8}),
    ("twitch", "#38bdf8", [path("M 24 72 L 60 18 L 74 30 L 38 84 Z", fill=solid("#38bdf8"))], {"intensity": 4, "angle": 8, "frequency": 7}),
    ("helix", "#f59e0b", [circle(48, 48, 16, fill=solid("#f59e0b"))], {"radius": 8, "rotations": 2.5, "lift": 10}),
    ("spiral", "#22c55e", [polygon([(48, 12), (80, 48), (48, 84), (16, 48)], fill=solid("#22c55e"))], {"radius": 12, "rotations": 2}),
    ("zigzag", "#f97316", [rect(26, 26, 44, 44, rx=10, fill=solid("#f97316"))], {"amplitude": 8, "travel": 10, "cycles": 4}),
    ("ricochet", "#8b5cf6", [circle(48, 48, 18, fill=solid("#8b5cf6"))], {"distance": 10, "bounces": 4}),
    ("swirl", "#14b8a6", [polygon([(48, 16), (64, 40), (48, 80), (32, 40)], fill=solid("#14b8a6"))], {"radius": 9, "turns": 1.8}),
    ("ripple", "#e879f9", [circle(48, 48, 24, fill=solid("#e879f9"))], {"intensity": 0.14, "frequency": 3.2}),
    ("ping", "#fb7185", [circle(48, 48, 24, fill=solid("#fb7185"), opacity=0.75)], {"max_scale": 1.34}),
    ("jitter", "#60a5fa", [rect(18, 18, 60, 60, rx=12, fill=solid("#60a5fa"))], {"intensity": 0.9, "frequency": 18, "seed": 11}),
    ("glide", "#34d399", [path("M 18 48 L 78 24 L 60 48 L 78 72 Z", fill=solid("#34d399"))], {"distance": 10, "axis": "diagonal"}),
    ("orbital_pulse", "#f43f5e", [circle(48, 48, 16, fill=solid("#f43f5e"))], {"radius": 7, "intensity": 0.14, "pulse_frequency": 2.2}),
    ("hover+pulse", "#a78bfa", [circle(48, 48, 22, fill=solid("#a78bfa"))], {"hover": {"amplitude": 4, "tilt": 5}, "pulse": {"intensity": 0.1, "frequency": 2.0}}),
    ("swirl+ripple", "#facc15", [polygon([(48, 12), (76, 48), (48, 84), (20, 48)], fill=solid("#facc15"))], {"swirl": {"radius": 8, "turns": 1.5}, "ripple": {"intensity": 0.12, "frequency": 2.5}}),
    ("jelly+jitter", "#2dd4bf", [rect(20, 20, 56, 56, rx=16, fill=solid("#2dd4bf"))], {"jelly": {"intensity": 0.14, "frequency": 2.8}, "jitter": {"intensity": 0.5, "frequency": 12, "seed": 5}}),
]


def build_catalog():
    items = []
    for label, color, layers, params in MOTION_SPECS:
        if "+" in label:
            motions = label.split("+")
            motion_params = params
        else:
            motions = [label]
            motion_params = {label: params}

        items.append(
            icon(
                f"motion-{label.replace('+', '-')}",
                *layers,
                description=f"Expanded motion demo: {label}",
                category="motion-overhaul",
                tags=["motion-demo", *motions],
                size=96,
                formats=["png", "apng"],
                background=None,
                padding=10,
                colors=[color],
                animation=animate(
                    *motions,
                    duration=1.6,
                    fps=16,
                    output="apng",
                    motion_params=motion_params,
                ),
            )
        )
    return items


def create_gallery(results):
    parts = [
        "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>",
        "<title>Motion Overhaul Demo</title>",
        "<style>body{margin:0;padding:28px;background:linear-gradient(135deg,#020617,#0f172a 55%,#111827);color:#e2e8f0;font-family:Georgia,serif}h1{margin:0 0 8px;font-size:40px}p{color:#94a3b8;max-width:920px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px;margin-top:24px}.card{border:1px solid rgba(148,163,184,.18);border-radius:18px;overflow:hidden;background:rgba(15,23,42,.78)}.preview{height:180px;display:flex;align-items:center;justify-content:center;background:linear-gradient(45deg,rgba(255,255,255,.06) 25%,transparent 25%),linear-gradient(-45deg,rgba(255,255,255,.06) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(255,255,255,.06) 75%),linear-gradient(-45deg,transparent 75%,rgba(255,255,255,.06) 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}.preview img{width:116px;height:116px;filter:drop-shadow(0 14px 18px rgba(0,0,0,.28))}.info{padding:14px 16px 18px}.name{font-size:18px;font-weight:700}.meta{font-size:13px;color:#94a3b8;margin-top:6px}.tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.tag{font-size:11px;padding:4px 9px;border-radius:999px;background:rgba(59,130,246,.14);color:#bfdbfe}</style></head><body>",
        "<h1>Motion Overhaul Demo</h1>",
        "<p>Expanded procedural motion library with new snap, hover, breath, jelly, blink, helix, spiral, zigzag, ricochet, swirl, ripple, ping, jitter, glide, orbital-pulse, and composed motion examples.</p>",
        "<div class='grid'>",
    ]
    for result in results:
        preview_path = result.output_paths.get("apng") or result.output_paths.get("png")
        rel = Path(os.path.relpath(Path(preview_path).resolve(), GALLERY_PATH.parent.resolve())).as_posix()
        tags = "".join(f"<span class='tag'>{tag}</span>" for tag in result.metadata.tags)
        parts.append(
            f"<article class='card'><div class='preview'><img src='{rel}' alt='{result.template_name}'></div>"
            f"<div class='info'><div class='name'>{result.template_name}</div>"
            f"<div class='meta'>Animation: {result.metadata.animation_type or 'none'}<br>Formats: {', '.join(result.output_paths.keys())}</div>"
            f"<div class='tags'>{tags}</div></div></article>"
        )
    parts.append("</div></body></html>")
    GALLERY_PATH.parent.mkdir(parents=True, exist_ok=True)
    GALLERY_PATH.write_text("".join(parts), encoding="utf-8")


def main() -> int:
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    if GALLERY_PATH.exists():
        GALLERY_PATH.unlink()

    engine = UIForgeEngine(output_dir=OUTPUT_DIR)
    result_batches = render_catalog_partitioned(build_catalog(), engine=engine, parallel=False, batch_size=6)
    results = [result for batch in result_batches for result in batch if result.success]
    create_gallery(results)
    print(GALLERY_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Tests for the compact LLM authoring helpers."""

import sys
from pathlib import Path
import numpy as np


sys.path.insert(0, str(Path(__file__).parent.parent))

from core import UIForgeEngine
from llm_api import (
    animate,
    batch,
    catalog,
    catalog_plan,
    circle,
    dedupe_catalog,
    icon,
    linear,
    partition_catalog,
    polygon,
    rect,
    render_catalog,
    render_catalog_partitioned,
    solid,
    stroke,
)
from generators.icon_generator import IconGenerator
from models import AnimationOutputType, GeneratorType, OutputFormat


def test_icon_builder_creates_template():
    template = icon(
        "llm-test-icon",
        circle(32, 32, 24, fill=solid("#2563eb")),
        rect(18, 18, 28, 28, rx=6, fill=linear("#ffffff", "#93c5fd", angle=90), opacity=0.85),
        description="Compact icon",
        category="tests",
        tags=["llm", "compact"],
        size=64,
        formats=["png", "svg"],
        padding=4,
    )

    assert template.generator_type == GeneratorType.ICON
    assert template.output_formats == [OutputFormat.PNG, OutputFormat.SVG]
    assert template.dimensions == {"width": 64, "height": 64}
    assert template.params["padding"] == 4
    assert len(template.params["layers"]) == 2


def test_polygon_shortcut_accepts_point_lists():
    poly = polygon(
        [(32, 8), (56, 56), (8, 56)],
        fill=solid("#f97316"),
        stroke=stroke("#7c2d12", width=2),
    )

    assert poly["type"] == "polygon"
    assert poly["geometry"]["points"] == [[32, 8], [56, 56], [8, 56]]
    assert poly["stroke"]["width"] == 2


def test_batch_helper_runs_engine(tmp_path):
    results = batch(
        icon(
            "batch-one",
            circle(32, 32, 22, fill=solid("#10b981")),
            category="tests",
        ),
        icon(
            "batch-two",
            rect(12, 12, 40, 40, rx=8, fill=solid("#f59e0b")),
            category="tests",
        ),
        engine=UIForgeEngine(output_dir=tmp_path),
        parallel=False,
    )

    assert len(results) == 2
    assert all(result.success for result in results)
    assert all("png" in result.output_paths for result in results)


def test_batch_helper_generates_svg_outputs(tmp_path):
    results = batch(
        icon(
            "batch-svg",
            circle(32, 32, 22, fill=solid("#2563eb"), stroke=stroke("#0f172a", width=2)),
            category="tests",
            formats=["png", "svg"],
        ),
        engine=UIForgeEngine(output_dir=tmp_path),
        parallel=False,
    )

    assert len(results) == 1
    assert results[0].success
    assert "svg" in results[0].output_paths
    assert Path(results[0].output_paths["svg"]).exists()


def test_catalog_helpers_build_large_specs():
    templates = catalog(
        [
            {"name": "catalog-one", "layers": [circle(32, 32, 20, fill=solid("#3b82f6"))]},
            {"name": "catalog-two", "layers": [rect(16, 16, 32, 32, rx=6, fill=solid("#22c55e"))]},
        ],
        category="catalog",
        size=64,
        formats=["png"],
    )

    assert [template.name for template in templates] == ["catalog-one", "catalog-two"]
    assert all(template.category == "catalog" for template in templates)


def test_render_catalog_and_apng_output(tmp_path):
    animation = animate(
        "orbit",
        duration=1.0,
        fps=8,
        output="apng",
        motion_params={"orbit": {"radius": 6}},
    )
    results = render_catalog(
        [
            {
                "name": "animated-catalog-item",
                "layers": [circle(32, 32, 18, fill=solid("#f43f5e"))],
                "animation": animation,
                "formats": ["png", "apng"],
            }
        ],
        output_dir=tmp_path,
        parallel=False,
        category="catalog",
        size=64,
    )

    assert len(results) == 1
    assert results[0].success
    assert results[0].output_paths["apng"].endswith(".apng")
    assert animation.output_type == AnimationOutputType.APNG


def test_catalog_dedup_and_partition_helpers():
    items = [
        {"name": "dupe-a", "layers": [circle(32, 32, 20, fill=solid("#3b82f6"))]},
        {"name": "dupe-a", "layers": [circle(32, 32, 20, fill=solid("#3b82f6"))]},
        {"name": "dupe-b", "layers": [rect(16, 16, 32, 32, fill=solid("#22c55e"))]},
    ]

    deduped = dedupe_catalog(items, strategy="content", category="test", size=64)
    partitions = partition_catalog(deduped, batch_size=1)
    plan = catalog_plan(items, batch_size=1, category="test", size=64)

    assert len(deduped) == 2
    assert len(partitions) == 2
    assert plan["duplicate_count"] == 1
    assert plan["partitions"] == [1, 1]


def test_render_catalog_partitioned(tmp_path):
    partitioned_results = render_catalog_partitioned(
        [
            {"name": "part-a", "layers": [circle(32, 32, 18, fill=solid("#2563eb"))]},
            {"name": "part-b", "layers": [circle(32, 32, 18, fill=solid("#7c3aed"))]},
            {"name": "part-c", "layers": [circle(32, 32, 18, fill=solid("#ea580c"))]},
        ],
        output_dir=tmp_path,
        parallel=False,
        batch_size=2,
        category="partitioned",
        size=64,
    )

    assert len(partitioned_results) == 2
    assert sum(len(batch_results) for batch_results in partitioned_results) == 3
    assert all(result.success for batch_results in partitioned_results for result in batch_results)


def test_icon_compositor_handles_zero_alpha_without_runtime_warning():
    generator = IconGenerator()
    canvas = np.zeros((4, 4, 4), dtype=np.uint8)
    layer = np.zeros((4, 4, 4), dtype=np.uint8)

    result = generator._composite_layer(canvas, layer, "normal", 1.0)

    assert result.shape == canvas.shape
    assert np.all(result == 0)

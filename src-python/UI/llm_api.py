"""
Compact Python authoring helpers for LLM-generated UI Forge assets.

This module reduces the amount of nested dict boilerplate needed to build
icons programmatically while still producing plain Template objects that the
existing engine already understands.
"""

from pathlib import Path
import json
import hashlib
from copy import deepcopy
from typing import Any, Dict, Iterable, List, Optional, Sequence, Union

from core import UIForgeEngine
from models import (
    AlphaMode,
    AnimationConfig,
    AnimationEasing,
    AnimationOutputType,
    GeneratorType,
    MotionType,
    OutputFormat,
    SpriteSheetLayout,
    Template,
)


FORMAT_ALIASES = {
    "png": OutputFormat.PNG,
    "apng": OutputFormat.APNG,
    "svg": OutputFormat.SVG,
    "jpeg": OutputFormat.JPEG,
    "jpg": OutputFormat.JPEG,
    "webp": OutputFormat.WEBP,
    "tiff": OutputFormat.TIFF,
    "bmp": OutputFormat.BMP,
    "ico": OutputFormat.ICO,
}

BLEND_ALIASES = {
    "normal": "normal",
    "multiply": "multiply",
    "screen": "screen",
    "overlay": "overlay",
    "add": "add",
}

ANIMATION_OUTPUT_ALIASES = {
    "svg": AnimationOutputType.SVG_SMIL,
    "svg_smil": AnimationOutputType.SVG_SMIL,
    "sprite": AnimationOutputType.SPRITE_SHEET,
    "sprite_sheet": AnimationOutputType.SPRITE_SHEET,
    "apng": AnimationOutputType.APNG,
    "both": AnimationOutputType.BOTH,
    "all": AnimationOutputType.ALL,
}

ShapeValue = Union[Dict[str, Any], Sequence[Sequence[float]]]
FormatValue = Union[str, OutputFormat]


def _as_output_format(value: FormatValue) -> OutputFormat:
    if isinstance(value, OutputFormat):
        return value
    key = str(value).strip().lower()
    if key not in FORMAT_ALIASES:
        raise ValueError(f"Unsupported output format: {value}")
    return FORMAT_ALIASES[key]


def _as_output_formats(values: Optional[Iterable[FormatValue]]) -> List[OutputFormat]:
    if values is None:
        return [OutputFormat.PNG]
    return [_as_output_format(value) for value in values]


def _as_alpha_mode(value: Union[str, AlphaMode]) -> AlphaMode:
    if isinstance(value, AlphaMode):
        return value
    return AlphaMode(str(value).strip().lower())


def _as_motion_type(value: Union[str, MotionType]) -> MotionType:
    if isinstance(value, MotionType):
        return value
    return MotionType(str(value).strip().lower())


def _as_easing(value: Union[str, AnimationEasing]) -> AnimationEasing:
    if isinstance(value, AnimationEasing):
        return value
    return AnimationEasing(str(value).strip().lower())


def _as_animation_output(value: Union[str, AnimationOutputType]) -> AnimationOutputType:
    if isinstance(value, AnimationOutputType):
        return value
    key = str(value).strip().lower()
    if key not in ANIMATION_OUTPUT_ALIASES:
        raise ValueError(f"Unsupported animation output: {value}")
    return ANIMATION_OUTPUT_ALIASES[key]


def _as_sprite_layout(value: Optional[Union[str, SpriteSheetLayout]]) -> Optional[SpriteSheetLayout]:
    if value is None or isinstance(value, SpriteSheetLayout):
        return value
    return SpriteSheetLayout(str(value).strip().lower())


def fill(
    *colors: str,
    type: str = "solid",
    stops: Optional[Sequence[float]] = None,
    angle: Optional[float] = None,
    center: Optional[Sequence[float]] = None,
) -> Dict[str, Any]:
    """Create a fill descriptor understood by UI Forge templates."""
    if not colors:
        raise ValueError("fill() requires at least one color")

    payload: Dict[str, Any] = {
        "type": type,
        "colors": list(colors),
    }
    if stops is not None:
        payload["stops"] = list(stops)
    if angle is not None:
        payload["angle"] = angle
    if center is not None:
        payload["center"] = list(center)
    return payload


def solid(*colors: str) -> Dict[str, Any]:
    return fill(*colors, type="solid")


def linear(*colors: str, angle: float = 0, stops: Optional[Sequence[float]] = None) -> Dict[str, Any]:
    return fill(*colors, type="linear_gradient", angle=angle, stops=stops)


def radial(
    *colors: str,
    center: Optional[Sequence[float]] = None,
    stops: Optional[Sequence[float]] = None,
) -> Dict[str, Any]:
    return fill(*colors, type="radial_gradient", center=center, stops=stops)


def angular(*colors: str, angle: float = 0, stops: Optional[Sequence[float]] = None) -> Dict[str, Any]:
    return fill(*colors, type="angular_gradient", angle=angle, stops=stops)


def stroke(
    color: str,
    width: float = 1.0,
    cap: str = "round",
    join: str = "round",
    miter_limit: float = 4.0,
) -> Dict[str, Any]:
    return {
        "color": color,
        "width": width,
        "cap": cap,
        "join": join,
        "miter_limit": miter_limit,
    }


def layer(
    shape: str,
    geometry: ShapeValue,
    *,
    fill: Optional[Dict[str, Any]] = None,
    stroke: Optional[Dict[str, Any]] = None,
    opacity: float = 1.0,
    blend: str = "normal",
    transform: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if blend not in BLEND_ALIASES:
        raise ValueError(f"Unsupported blend mode: {blend}")

    if shape == "polygon" and not isinstance(geometry, dict):
        geometry = {"points": [list(point) for point in geometry]}

    return {
        "type": shape,
        "geometry": dict(geometry),
        "fill": fill,
        "stroke": stroke,
        "opacity": opacity,
        "blend_mode": BLEND_ALIASES[blend],
        "transform": transform,
    }


def circle(cx: float, cy: float, r: float, **kwargs: Any) -> Dict[str, Any]:
    return layer("circle", {"cx": cx, "cy": cy, "r": r}, **kwargs)


def rect(x: float, y: float, width: float, height: float, rx: float = 0, ry: Optional[float] = None, **kwargs: Any) -> Dict[str, Any]:
    geometry: Dict[str, Any] = {"x": x, "y": y, "width": width, "height": height}
    if rx:
        geometry["rx"] = rx
    if ry is not None:
        geometry["ry"] = ry
    return layer("rect", geometry, **kwargs)


def polygon(points: Sequence[Sequence[float]], **kwargs: Any) -> Dict[str, Any]:
    return layer("polygon", points, **kwargs)


def ellipse(cx: float, cy: float, rx: float, ry: float, **kwargs: Any) -> Dict[str, Any]:
    return layer("ellipse", {"cx": cx, "cy": cy, "rx": rx, "ry": ry}, **kwargs)


def line(x1: float, y1: float, x2: float, y2: float, **kwargs: Any) -> Dict[str, Any]:
    return layer("line", {"x1": x1, "y1": y1, "x2": x2, "y2": y2}, **kwargs)


def path(d: str, **kwargs: Any) -> Dict[str, Any]:
    return layer("path", {"d": d}, **kwargs)


def animate(
    *motions: Union[str, MotionType],
    duration: float,
    fps: int = 30,
    loop: bool = True,
    easing: Union[str, AnimationEasing] = AnimationEasing.LINEAR,
    output: Union[str, AnimationOutputType] = AnimationOutputType.SVG_SMIL,
    sprite_sheet_layout: Optional[Union[str, SpriteSheetLayout]] = None,
    reverse: bool = False,
    alternate: bool = False,
    delay: float = 0.0,
    motion_params: Optional[Dict[str, Dict[str, Any]]] = None,
) -> AnimationConfig:
    if not motions:
        raise ValueError("animate() requires at least one motion type")

    return AnimationConfig(
        enabled=True,
        motion_types=[_as_motion_type(motion) for motion in motions],
        duration=duration,
        fps=fps,
        loop=loop,
        easing=_as_easing(easing),
        motion_params=motion_params or {},
        output_type=_as_animation_output(output),
        sprite_sheet_layout=_as_sprite_layout(sprite_sheet_layout),
        reverse=reverse,
        alternate=alternate,
        delay=delay,
    )


def icon(
    name: str,
    *layers: Dict[str, Any],
    description: str = "",
    category: str = "llm",
    tags: Optional[Sequence[str]] = None,
    size: Optional[int] = 64,
    width: Optional[int] = None,
    height: Optional[int] = None,
    formats: Optional[Iterable[FormatValue]] = None,
    ico_sizes: Optional[Sequence[int]] = None,
    colors: Optional[Sequence[str]] = None,
    padding: int = 0,
    background: Optional[str] = None,
    antialias: int = 2,
    theme_variants: Optional[Sequence[str]] = None,
    alpha_mode: Union[str, AlphaMode] = AlphaMode.EMBEDDED,
    animation: Optional[Any] = None,
    version: str = "1.0",
) -> Template:
    resolved_width = width or size or 64
    resolved_height = height or size or 64

    return Template(
        name=name,
        description=description or name.replace("-", " ").replace("_", " "),
        generator_type=GeneratorType.ICON,
        category=category,
        tags=list(tags or []),
        output_formats=_as_output_formats(formats),
        ico_sizes=list(ico_sizes) if ico_sizes is not None else None,
        dimensions={"width": resolved_width, "height": resolved_height},
        colors=list(colors) if colors is not None else None,
        theme_variants=list(theme_variants) if theme_variants is not None else None,
        params={
            "layers": list(layers),
            "background": background,
            "padding": padding,
            "antialias_factor": antialias,
        },
        alpha_mode=_as_alpha_mode(alpha_mode),
        animation=animation,
        version=version,
    )


def batch(
    *templates: Template,
    engine: Optional[UIForgeEngine] = None,
    output_dir: Optional[Union[str, Path]] = None,
    parallel: bool = False,
) -> List[Any]:
    if not templates:
        return []

    active_engine = engine or UIForgeEngine(output_dir=Path(output_dir) if output_dir else None)
    return active_engine.batch_generate(list(templates), parallel=parallel)


def catalog(
    items: Sequence[Union[Template, Dict[str, Any]]],
    **defaults: Any,
) -> List[Template]:
    """
    Build a large icon catalog from a manifest-like list.

    Each item can be either a ready-made Template or a dict accepted by icon().
    Default values are merged in once, which keeps large AI-generated catalogs
    compact and consistent.
    """
    templates: List[Template] = []
    for item in items:
        if isinstance(item, Template):
            templates.append(item)
            continue

        payload = deepcopy(defaults)
        payload.update(item)

        name = payload.pop("name")
        item_layers = payload.pop("layers", [])
        if not isinstance(item_layers, (list, tuple)):
            raise ValueError(f"Catalog item '{name}' must provide layers as a list or tuple")

        templates.append(icon(name, *item_layers, **payload))
    return templates


def catalog_signature(item: Union[Template, Dict[str, Any]], **defaults: Any) -> str:
    """Create a stable content signature for deduping catalog items."""
    if isinstance(item, Template):
        payload = {
            "name": item.name,
            "category": item.category,
            "dimensions": item.dimensions,
            "output_formats": [fmt.value for fmt in item.output_formats],
            "params": item.params,
            "animation": repr(item.animation),
            "version": item.version,
        }
    else:
        payload = deepcopy(defaults)
        payload.update(item)
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def dedupe_catalog(
    items: Sequence[Union[Template, Dict[str, Any]]],
    *,
    strategy: str = "content",
    **defaults: Any,
) -> List[Union[Template, Dict[str, Any]]]:
    """
    Remove duplicates from a catalog by `name` or by normalized content.
    Keeps the first occurrence.
    """
    if strategy not in {"name", "content"}:
        raise ValueError("strategy must be 'name' or 'content'")

    seen = set()
    unique_items: List[Union[Template, Dict[str, Any]]] = []
    for item in items:
        if strategy == "name":
            key = item.name if isinstance(item, Template) else item.get("name")
        else:
            key = catalog_signature(item, **defaults)
        if key in seen:
            continue
        seen.add(key)
        unique_items.append(item)
    return unique_items


def partition_catalog(
    items: Sequence[Union[Template, Dict[str, Any]]],
    *,
    batch_size: int = 100,
) -> List[List[Union[Template, Dict[str, Any]]]]:
    """Split a large catalog into deterministic chunks for staged generation."""
    if batch_size <= 0:
        raise ValueError("batch_size must be greater than 0")
    return [list(items[index:index + batch_size]) for index in range(0, len(items), batch_size)]


def catalog_plan(
    items: Sequence[Union[Template, Dict[str, Any]]],
    *,
    batch_size: int = 100,
    dedupe: str = "content",
    **defaults: Any,
) -> Dict[str, Any]:
    """Return a summary plan for a large catalog before rendering it."""
    deduped_items = dedupe_catalog(items, strategy=dedupe, **defaults)
    partitions = partition_catalog(deduped_items, batch_size=batch_size)
    return {
        "input_count": len(items),
        "unique_count": len(deduped_items),
        "duplicate_count": len(items) - len(deduped_items),
        "batch_size": batch_size,
        "partition_count": len(partitions),
        "partitions": [len(partition) for partition in partitions],
    }


def render_catalog(
    items: Sequence[Union[Template, Dict[str, Any]]],
    *,
    engine: Optional[UIForgeEngine] = None,
    output_dir: Optional[Union[str, Path]] = None,
    parallel: bool = True,
    **defaults: Any,
) -> List[Any]:
    templates = catalog(items, **defaults)
    return batch(*templates, engine=engine, output_dir=output_dir, parallel=parallel)


def render_catalog_partitioned(
    items: Sequence[Union[Template, Dict[str, Any]]],
    *,
    engine: Optional[UIForgeEngine] = None,
    output_dir: Optional[Union[str, Path]] = None,
    parallel: bool = True,
    batch_size: int = 100,
    dedupe: str = "content",
    **defaults: Any,
) -> List[List[Any]]:
    """
    Render a large catalog in partitions after deterministic duplicate removal.
    Returns one result list per partition.
    """
    active_engine = engine or UIForgeEngine(output_dir=Path(output_dir) if output_dir else None)
    deduped_items = dedupe_catalog(items, strategy=dedupe, **defaults)
    partitions = partition_catalog(deduped_items, batch_size=batch_size)
    all_results: List[List[Any]] = []
    for partition in partitions:
        templates = catalog(partition, **defaults)
        all_results.append(active_engine.batch_generate(templates, parallel=parallel))
    return all_results


__all__ = [
    "angular",
    "animate",
    "batch",
    "catalog_plan",
    "catalog_signature",
    "catalog",
    "circle",
    "dedupe_catalog",
    "ellipse",
    "fill",
    "icon",
    "layer",
    "line",
    "linear",
    "path",
    "polygon",
    "radial",
    "rect",
    "render_catalog",
    "render_catalog_partitioned",
    "partition_catalog",
    "solid",
    "stroke",
]

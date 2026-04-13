#!/usr/bin/env python3
"""
Generate a clean, light-only chrome icon pack for Kade.

This pack focuses on the top-level VS Code extension surfaces that matter most:
activity, chat, new task, history, settings, popout, help, and profile.
The visual language is intentionally simple and artifact-resistant so it holds
up at small sizes in a Svelte/Tauri UI.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from core import UIForgeEngine
from llm_api import circle, icon, line, polygon, rect, solid, stroke
from models import OutputFormat, Template
from validators import AssetValidator


PACK_NAME = "kade-extension-icons"
CATALOG_VERSION = "2.0.0"
THEME_NAME = "light"
CATEGORY = "chrome"

ICON_SIZE = 64
PADDING = 5
ANTIALIAS = 4

OUTPUT_ROOT = ROOT / "output" / PACK_NAME
STAGING_ROOT = OUTPUT_ROOT / "_engine"
BUNDLE_ROOT = OUTPUT_ROOT / "bundle"
SVG_ROOT = BUNDLE_ROOT / "svg" / THEME_NAME / CATEGORY
PNG_ROOT = BUNDLE_ROOT / "png" / THEME_NAME / CATEGORY
MANIFEST_ROOT = BUNDLE_ROOT / "manifest"
SVELTE_ROOT = BUNDLE_ROOT / "svelte"

SURFACE = "#f7fbff"
OUTLINE = "#18263b"
OUTLINE_SOFT = "#42556b"
ACCENT = "#2563eb"
ACCENT_2 = "#14b8a6"
ACCENT_3 = "#f59e0b"
SUCCESS = "#10b981"
MUTED = "#6f839a"
LIGHT_FILL = "#ffffff"


@dataclass(frozen=True)
class IconSpec:
    name: str
    title: str
    usage: str
    tags: List[str]
    aliases: List[str]
    layers: List[Dict[str, Any]]


def flat(*items: Any) -> List[Dict[str, Any]]:
    layers: List[Dict[str, Any]] = []
    for item in items:
        if item is None:
            continue
        if isinstance(item, list):
            layers.extend(item)
        else:
            layers.append(item)
    return layers


def dot(x: float, y: float, r: float, color: str, opacity: float = 1.0) -> Dict[str, Any]:
    return circle(x, y, r, fill=solid(color), opacity=opacity)


def bar(x1: float, y1: float, x2: float, y2: float, color: str, width: float = 2.5) -> Dict[str, Any]:
    return line(x1, y1, x2, y2, stroke=stroke(color, width=width))


def shell(*glyphs: Dict[str, Any]) -> List[Dict[str, Any]]:
    return flat(
        rect(10, 10, 44, 44, rx=12, fill=solid(SURFACE), stroke=stroke(OUTLINE, width=3)),
        list(glyphs),
    )


def badge_plus(x: float = 46, y: float = 18) -> List[Dict[str, Any]]:
    return flat(
        dot(x, y, 5.2, ACCENT_3),
        bar(x - 2.2, y, x + 2.2, y, LIGHT_FILL, 2.6),
        bar(x, y - 2.2, x, y + 2.2, LIGHT_FILL, 2.6),
    )


def activity_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(18, 18, 8, 28, rx=4, fill=solid(ACCENT), opacity=0.96),
        rect(30, 18, 18, 10, rx=4, fill=solid(ACCENT_2), opacity=0.92),
        rect(30, 32, 18, 10, rx=4, fill=solid(ACCENT_3), opacity=0.92),
        rect(30, 46, 12, 4, rx=2, fill=solid(MUTED), opacity=0.8),
    )


def chat_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(18, 19, 28, 20, rx=8, fill=None, stroke=stroke(ACCENT, width=3)),
        polygon([(24, 39), (30, 39), (23, 45)], fill=solid(ACCENT_2)),
        dot(25, 29, 2.4, ACCENT),
        dot(32, 29, 2.4, ACCENT),
        dot(39, 29, 2.4, ACCENT),
    )


def document_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(20, 16, 22, 30, rx=6, fill=None, stroke=stroke(OUTLINE, width=3)),
        polygon([(34, 16), (42, 24), (34, 24)], fill=solid("#e8eef7")),
        rect(34, 16, 8, 8, rx=1.5, fill=solid("#e8eef7")),
        bar(25, 30, 37, 30, ACCENT, 3),
        bar(25, 36, 33, 36, ACCENT_2, 3),
    )


def new_task_glyph() -> List[Dict[str, Any]]:
    return flat(document_glyph(), badge_plus())


def history_glyph() -> List[Dict[str, Any]]:
    return flat(
        circle(32, 31, 11, fill=None, stroke=stroke(ACCENT, width=3)),
        bar(32, 31, 32, 25, ACCENT, 3),
        bar(32, 31, 38, 35, ACCENT_2, 3),
        bar(39, 31, 43, 31, ACCENT_2, 3),
    )


def settings_glyph() -> List[Dict[str, Any]]:
    return flat(
        bar(20, 24, 44, 24, OUTLINE_SOFT, 3),
        bar(20, 33, 44, 33, OUTLINE_SOFT, 3),
        bar(20, 42, 44, 42, OUTLINE_SOFT, 3),
        circle(28, 24, 3, fill=solid(ACCENT), opacity=0.96),
        circle(36, 33, 3, fill=solid(ACCENT_2), opacity=0.96),
        circle(32, 42, 3, fill=solid(ACCENT_3), opacity=0.96),
    )


def popout_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(18, 18, 24, 24, rx=6, fill=None, stroke=stroke(OUTLINE, width=3)),
        rect(18, 18, 24, 6, rx=6, fill=solid("#e8eef7")),
        bar(29, 35, 42, 22, ACCENT, 3),
        bar(36, 22, 42, 22, ACCENT, 3),
        bar(42, 22, 42, 28, ACCENT, 3),
    )


def help_glyph() -> List[Dict[str, Any]]:
    return flat(
        circle(32, 31, 11, fill=None, stroke=stroke(ACCENT, width=3)),
        bar(32, 25, 32, 31, ACCENT, 3),
        bar(29, 23, 35, 23, ACCENT, 3),
        dot(32, 41, 2.4, ACCENT_2),
    )


def profile_glyph() -> List[Dict[str, Any]]:
    return flat(
        circle(32, 24, 7, fill=None, stroke=stroke(ACCENT, width=3)),
        rect(20, 34, 24, 14, rx=7, fill=None, stroke=stroke(OUTLINE, width=3)),
        rect(24, 34, 16, 6, rx=3, fill=solid("#e8eef7")),
    )


def spec(name: str, title: str, usage: str, tags: List[str], aliases: List[str], layers: List[Dict[str, Any]]) -> IconSpec:
    return IconSpec(name=name, title=title, usage=usage, tags=tags, aliases=aliases, layers=layers)


def build_specs() -> List[IconSpec]:
    return [
        spec(
            "activity",
            "Activity",
            "Primary Kade entry icon for the VS Code activity bar and extension surface.",
            ["activity", "sidebar", "extension", "launch"],
            ["activity", "sidebar", "kade-ActivityBar", "kade.SidebarProvider"],
            shell(*activity_glyph()),
        ),
        spec(
            "chat",
            "Chat",
            "Main conversational workspace for prompts and responses.",
            ["chat", "conversation", "assistant"],
            ["chat", "chatButtonClicked", "kade.chatButtonClicked"],
            shell(*chat_glyph()),
        ),
        spec(
            "new-task",
            "New Task",
            "Create a fresh task, prompt, or agent request.",
            ["new", "task", "create"],
            ["new-task", "plus", "kade.plusButtonClicked", "kade.newTask"],
            shell(*new_task_glyph()),
        ),
        spec(
            "history",
            "History",
            "Open prior sessions, previous tasks, and resumable context.",
            ["history", "sessions", "recents"],
            ["history", "historyButtonClicked", "kade.historyButtonClicked"],
            shell(*history_glyph()),
        ),
        spec(
            "settings",
            "Settings",
            "Open Kade settings, modes, and preference controls.",
            ["settings", "config", "preferences"],
            ["settings", "settingsButtonClicked", "kade.settingsButtonClicked"],
            shell(*settings_glyph()),
        ),
        spec(
            "popout",
            "Popout",
            "Open the Kade surface in a separate tab or window.",
            ["popout", "external", "tab"],
            ["popout", "open-in-tab", "kade.popoutButtonClicked"],
            shell(*popout_glyph()),
        ),
        spec(
            "help",
            "Help",
            "Documentation, walkthroughs, and guided product support.",
            ["help", "docs", "support"],
            ["help", "documentation", "kade.helpButtonClicked"],
            shell(*help_glyph()),
        ),
        spec(
            "profile",
            "Profile",
            "User profile and account identity state.",
            ["profile", "account", "user"],
            ["profile", "account", "profileButtonClicked", "kade.profileButtonClicked"],
            shell(*profile_glyph()),
        ),
    ]


def build_template(spec_data: IconSpec) -> Template:
    return icon(
        spec_data.name,
        *spec_data.layers,
        description=spec_data.usage,
        category=CATEGORY,
        tags=spec_data.tags,
        size=ICON_SIZE,
        formats=["svg", "png"],
        padding=PADDING,
        antialias=ANTIALIAS,
        theme_variants=[THEME_NAME],
    )


def optimize_svg(svg_path: Path) -> None:
    content = svg_path.read_text(encoding="utf-8")
    content = re.sub(r">\s+<", "><", content)
    content = re.sub(r"\s{2,}", " ", content)
    svg_path.write_text(content.strip() + "\n", encoding="utf-8")


def normalize_term(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")


def ensure_clean_output() -> None:
    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)
    for path in (STAGING_ROOT, SVG_ROOT, PNG_ROOT, MANIFEST_ROOT, SVELTE_ROOT):
        path.mkdir(parents=True, exist_ok=True)


def copy_variant_file(source: Path, icon_name: str, output_format: str) -> Path:
    root = SVG_ROOT if output_format == "svg" else PNG_ROOT
    destination = root / f"{icon_name}.{output_format}"
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    if output_format == "svg":
        optimize_svg(destination)
    return destination


def build_preview_html(entries: List[Dict[str, Any]]) -> str:
    cards = "\n".join(
        f"""
        <article class="card">
          <img data-icon-path="{entry['name']}.svg" src="svg/light/chrome/{entry['name']}.svg" alt="{entry['title']}" />
          <h3>{entry['title']}</h3>
          <p>{entry['usage']}</p>
          <code>{entry['name']}</code>
        </article>
        """.strip()
        for entry in entries
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kade Light Chrome Icons</title>
  <style>
    body {{
      margin: 0;
      font: 14px/1.5 "Segoe UI", sans-serif;
      background: #f4f8fc;
      color: #132235;
    }}
    header {{
      position: sticky;
      top: 0;
      padding: 18px 20px;
      background: rgba(244, 248, 252, 0.94);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid #d7e2ef;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }}
    main {{
      padding: 20px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }}
    .card {{
      background: #fff;
      border: 1px solid #d7e2ef;
      border-radius: 18px;
      padding: 16px;
      box-shadow: 0 8px 24px rgba(16, 24, 40, 0.05);
    }}
    .card img {{
      width: 48px;
      height: 48px;
      display: block;
      margin-bottom: 12px;
    }}
    .card h3 {{
      margin: 0 0 6px;
      font-size: 15px;
    }}
    .card p {{
      margin: 0 0 10px;
      color: #5c7087;
      min-height: 42px;
    }}
    .card code {{
      color: #2563eb;
    }}
  </style>
</head>
<body>
  <header>
    <div>
      <strong>Kade Light Chrome Icons</strong><br />
      <span>{len(entries)} icons, 1 theme</span>
    </div>
    <div>light only</div>
  </header>
  <main>{cards}</main>
  <script>
    const images = [...document.querySelectorAll("[data-icon-path]")];
    for (const image of images) {{
      image.src = `svg/light/chrome/${{image.dataset.iconPath}}`;
    }}
  </script>
</body>
</html>
"""


def write_readme(icon_count: int) -> None:
    readme = f"""# Kade Light Chrome Icons

Light-only chrome icon pack generated with UI Forge for Kade.

- Pack: `{PACK_NAME}`
- Version: `{CATALOG_VERSION}`
- Icons: `{icon_count}`
- Theme: `{THEME_NAME}`
- Category: `{CATEGORY}`
- Formats: `svg`, `png`

## Layout

- `svg/light/chrome/<icon>.svg`
- `png/light/chrome/<icon>.png`
- `manifest/icon-manifest.json`
- `manifest/icon-alias-map.json`
- `manifest/validation-report.json`
- `svelte/icons.ts`
- `svelte/KadeIcon.svelte`
- `preview.html`
"""
    (BUNDLE_ROOT / "README.md").write_text(readme, encoding="utf-8")


def write_svelte_exports(entries: List[Dict[str, Any]], alias_map: Dict[str, str]) -> None:
    names_union = " | ".join(json.dumps(entry["name"]) for entry in entries)
    manifest_json = json.dumps(entries, indent=2)
    alias_json = json.dumps(alias_map, indent=2)
    icons_ts = f"""export type KadeChromeIconTheme = "light"
export type KadeChromeIconFormat = "svg" | "png"
export type KadeChromeIconName = {names_union}

export type KadeChromeIconEntry = (typeof iconManifest)[number]

export const iconManifest = {manifest_json} as const
export const iconAliasMap = {alias_json} as const

export function normalizeKadeChromeIconTerm(value: string): string {{
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}}

export function resolveKadeChromeIconName(value: string): KadeChromeIconName | null {{
  const normalized = normalizeKadeChromeIconTerm(value)
  if ((iconAliasMap as Record<string, string>)[normalized]) {{
    return (iconAliasMap as Record<string, string>)[normalized] as KadeChromeIconName
  }}
  return iconManifest.find((entry) => entry.name === normalized)?.name ?? null
}}

export function getKadeChromeIconEntry(nameOrAlias: string): KadeChromeIconEntry | null {{
  const resolved = resolveKadeChromeIconName(nameOrAlias)
  if (!resolved) return null
  return iconManifest.find((entry) => entry.name === resolved) ?? null
}}

export function getKadeChromeIconPath(nameOrAlias: string, format: KadeChromeIconFormat = "svg", base = ".."): string | null {{
  const entry = getKadeChromeIconEntry(nameOrAlias)
  if (!entry) return null
  const relativePath = entry.paths.light[format]
  if (!base) return relativePath
  return `${{base.replace(/\\/+$/g, "")}}/${{relativePath}}`
}}

export function listKadeChromeIcons(): readonly KadeChromeIconEntry[] {{
  return iconManifest
}}
"""
    component = """<script lang="ts">
  import { getKadeChromeIconEntry, getKadeChromeIconPath, type KadeChromeIconFormat } from "./icons"

  export let name: string
  export let format: KadeChromeIconFormat = "svg"
  export let base = ".."
  export let alt = name
  export let className = ""
  export let size: number | string | null = null
  export let title: string | null = null

  $: src = getKadeChromeIconPath(name, format, base)
  $: resolved = getKadeChromeIconEntry(name)
  $: dimension = typeof size === "number" ? `${size}px` : size
  $: style = dimension ? `width: ${dimension}; height: ${dimension};` : undefined
</script>

{#if src}
  <img
    src={src}
    alt={alt}
    class={className}
    title={title ?? resolved?.title ?? alt}
    style={style}
    data-kade-icon={resolved?.name ?? name}
    data-kade-icon-category={resolved?.category ?? undefined}
    loading="lazy"
    decoding="async"
  />
{/if}
"""
    (SVELTE_ROOT / "icons.ts").write_text(icons_ts, encoding="utf-8")
    (SVELTE_ROOT / "KadeChromeIcon.svelte").write_text(component, encoding="utf-8")


def main() -> None:
    ensure_clean_output()
    engine = UIForgeEngine(output_dir=STAGING_ROOT)
    validator = AssetValidator()
    specs = build_specs()

    manifest_entries: List[Dict[str, Any]] = []
    alias_map: Dict[str, str] = {}
    validation_report: Dict[str, Any] = {
        "summary": {
            "icon_count": len(specs),
            "theme": THEME_NAME,
            "category": CATEGORY,
        },
        "icons": {},
    }

    for spec_data in specs:
        template = build_template(spec_data)
        result = engine.generate_theme_variants(template, themes=[THEME_NAME])[THEME_NAME]
        if not result.success:
            raise RuntimeError(f"Failed to generate '{spec_data.name}': {result.error}")

        theme_paths: Dict[str, Dict[str, str]] = {}
        theme_validation: Dict[str, Any] = {"warnings": result.warnings[:], "formats": {}}

        theme_paths[THEME_NAME] = {}
        for format_name, model_format in (("svg", OutputFormat.SVG), ("png", OutputFormat.PNG)):
            source_path = Path(result.output_paths[format_name])
            bundled = copy_variant_file(source_path, spec_data.name, format_name)
            validation = validator.validate_asset(bundled, template, model_format)
            theme_paths[THEME_NAME][format_name] = bundled.relative_to(BUNDLE_ROOT).as_posix()
            theme_validation["formats"][format_name] = {
                "passed": validation.passed,
                "errors": validation.errors,
                "warnings": validation.warnings,
                "checks": validation.checks,
            }

        entry = {
            "name": spec_data.name,
            "title": spec_data.title,
            "category": CATEGORY,
            "tags": spec_data.tags,
            "aliases": spec_data.aliases,
            "usage": spec_data.usage,
            "paths": theme_paths,
        }
        manifest_entries.append(entry)
        validation_report["icons"][spec_data.name] = theme_validation

        for term in [spec_data.name, *spec_data.aliases, *spec_data.tags]:
            alias_map.setdefault(normalize_term(term), spec_data.name)

    validation_report["summary"]["all_passed"] = all(
        fmt["passed"]
        for icon_data in validation_report["icons"].values()
        for fmt in icon_data["formats"].values()
    )

    (MANIFEST_ROOT / "icon-manifest.json").write_text(json.dumps(manifest_entries, indent=2), encoding="utf-8")
    (MANIFEST_ROOT / "icon-alias-map.json").write_text(json.dumps(alias_map, indent=2), encoding="utf-8")
    (MANIFEST_ROOT / "validation-report.json").write_text(json.dumps(validation_report, indent=2), encoding="utf-8")
    (BUNDLE_ROOT / "preview.html").write_text(build_preview_html(manifest_entries), encoding="utf-8")
    write_svelte_exports(manifest_entries, alias_map)
    write_readme(len(manifest_entries))

    print(f"Generated {len(manifest_entries)} Kade light chrome icons")
    print(f"Bundle root: {BUNDLE_ROOT}")
    print(f"Manifest: {MANIFEST_ROOT / 'icon-manifest.json'}")


if __name__ == "__main__":
    main()

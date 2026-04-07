#!/usr/bin/env python3
"""
Generate a production-ready Kade extension icon pack for Svelte/Tauri projects.

The catalog is tailored to Kade's real product surface as an AI-first VS Code
extension: chat, agents, MCP, terminal actions, history, settings, provider
state, memory, indexing, and account flows.
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
from llm_api import circle, ellipse, icon, line, polygon, rect, solid, stroke
from models import OutputFormat, Template
from validators import AssetValidator


PACK_NAME = "kade-extension-icons"
CATALOG_VERSION = "1.0.0"
THEMES = ("light", "dark", "high-contrast")
ICON_SIZE = 64
ANTIALIAS = 4
PADDING = 4

OUTPUT_ROOT = ROOT / "output" / PACK_NAME
STAGING_ROOT = OUTPUT_ROOT / "_engine"
BUNDLE_ROOT = OUTPUT_ROOT / "bundle"
SVG_ROOT = BUNDLE_ROOT / "svg"
PNG_ROOT = BUNDLE_ROOT / "png"
MANIFEST_ROOT = BUNDLE_ROOT / "manifest"
SVELTE_ROOT = BUNDLE_ROOT / "svelte"

THEME_TOKENS = {
    "light": {
        "$surface": "#eef4fb",
        "$surface-alt": "#d8e3f2",
        "$outline": "#162235",
        "$muted": "#6d7f97",
        "$highlight": "#ffffff",
        "$accent-primary": "#2563eb",
        "$accent-secondary": "#14b8a6",
        "$accent-tertiary": "#f59e0b",
        "$accent-danger": "#ef4444",
        "$accent-success": "#10b981",
    },
    "dark": {
        "$surface": "#172232",
        "$surface-alt": "#26364a",
        "$outline": "#eef5ff",
        "$muted": "#9db0c6",
        "$highlight": "#ffffff",
        "$accent-primary": "#60a5fa",
        "$accent-secondary": "#2dd4bf",
        "$accent-tertiary": "#fbbf24",
        "$accent-danger": "#f87171",
        "$accent-success": "#4ade80",
    },
    "high-contrast": {
        "$surface": "#000000",
        "$surface-alt": "#151515",
        "$outline": "#ffffff",
        "$muted": "#d1d5db",
        "$highlight": "#ffffff",
        "$accent-primary": "#00ffff",
        "$accent-secondary": "#00ff9c",
        "$accent-tertiary": "#ffff00",
        "$accent-danger": "#ff4d4d",
        "$accent-success": "#00ff00",
    },
}


@dataclass(frozen=True)
class IconSpec:
    name: str
    title: str
    category: str
    tags: List[str]
    aliases: List[str]
    usage: str
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


def bar(x1: float, y1: float, x2: float, y2: float, color: str, width: float = 2.0) -> Dict[str, Any]:
    return line(x1, y1, x2, y2, stroke=stroke(color, width=width))


def ring(cx: float, cy: float, r: float, color: str, width: float = 2.0) -> Dict[str, Any]:
    return circle(cx, cy, r, fill=None, stroke=stroke(color, width=width))


def triangle(points: Iterable[tuple[float, float]], color: str, opacity: float = 1.0) -> Dict[str, Any]:
    return polygon(list(points), fill=solid(color), opacity=opacity)


def tri_up(cx: float, y: float, size: float, color: str) -> Dict[str, Any]:
    half = size / 2
    return triangle(((cx, y), (cx - half, y + size), (cx + half, y + size)), color)


def tri_right(x: float, cy: float, size: float, color: str) -> Dict[str, Any]:
    half = size / 2
    return triangle(((x, cy - half), (x, cy + half), (x + size, cy)), color)


def tri_left(x: float, cy: float, size: float, color: str) -> Dict[str, Any]:
    half = size / 2
    return triangle(((x, cy), (x + size, cy - half), (x + size, cy + half)), color)


def frame_shell(*glyphs: Dict[str, Any]) -> List[Dict[str, Any]]:
    return flat(
        rect(10, 10, 44, 44, rx=12, fill=solid("$surface"), opacity=0.16),
        rect(10, 10, 44, 44, rx=12, fill=None, stroke=stroke("$outline", width=3)),
        list(glyphs),
    )


def round_shell(*glyphs: Dict[str, Any]) -> List[Dict[str, Any]]:
    return flat(
        circle(32, 32, 21, fill=solid("$surface"), opacity=0.16),
        ring(32, 32, 21, "$outline", width=3),
        list(glyphs),
    )


def badge_plus(x: float = 46, y: float = 18) -> List[Dict[str, Any]]:
    return flat(
        dot(x, y, 5.5, "$accent-tertiary"),
        bar(x - 2.5, y, x + 2.5, y, "$highlight", width=2),
        bar(x, y - 2.5, x, y + 2.5, "$highlight", width=2),
    )


def bubble_glyph(color: str = "$accent-primary", tail_color: str = "$accent-secondary") -> List[Dict[str, Any]]:
    return flat(
        rect(18, 22, 28, 18, rx=8, fill=None, stroke=stroke(color, width=2)),
        triangle(((26, 40), (30, 40), (24, 46)), tail_color),
        dot(25, 31, 2.2, color),
        dot(32, 31, 2.2, color),
        dot(39, 31, 2.2, color),
    )


def clock_glyph() -> List[Dict[str, Any]]:
    return flat(
        ring(32, 32, 11, "$accent-primary", 2),
        bar(32, 32, 32, 24, "$accent-secondary", 2),
        bar(32, 32, 38, 36, "$accent-secondary", 2),
    )


def gear_glyph() -> List[Dict[str, Any]]:
    return flat(
        ring(32, 32, 8, "$accent-primary", 3),
        dot(32, 32, 3, "$accent-secondary"),
        rect(30.5, 17.5, 3, 5, rx=1.5, fill=solid("$muted")),
        rect(43.5, 29.5, 5, 3, rx=1.5, fill=solid("$muted")),
        rect(30.5, 41.5, 3, 5, rx=1.5, fill=solid("$muted")),
        rect(17.5, 29.5, 5, 3, rx=1.5, fill=solid("$muted")),
    )


def popout_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(20, 24, 18, 18, fill=None, stroke=stroke("$outline", width=2)),
        bar(30, 34, 43, 21, "$accent-primary", 2.5),
        tri_up(43, 18, 6, "$accent-primary"),
        tri_right(40, 21, 6, "$accent-primary"),
    )


def help_glyph() -> List[Dict[str, Any]]:
    return flat(
        ring(32, 30, 10, "$accent-primary", 3),
        bar(32, 27, 32, 34, "$accent-primary", 3),
        tri_right(34, 21, 5, "$accent-primary"),
        dot(32, 43, 2.2, "$accent-secondary"),
    )


def doc_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(20, 18, 22, 28, rx=5, fill=None, stroke=stroke("$outline", width=2)),
        bar(24, 27, 38, 27, "$accent-primary", 2),
        bar(24, 34, 38, 34, "$accent-secondary", 2),
        bar(24, 41, 34, 41, "$muted", 2),
    )


def brackets_glyph() -> List[Dict[str, Any]]:
    return flat(
        bar(24, 24, 20, 32, "$accent-primary", 2),
        bar(20, 32, 24, 40, "$accent-primary", 2),
        bar(40, 24, 44, 32, "$accent-primary", 2),
        bar(44, 32, 40, 40, "$accent-primary", 2),
    )


def sparkle_glyph(cx: float = 42, cy: float = 22, color: str = "$accent-tertiary") -> List[Dict[str, Any]]:
    return flat()


def wrench_glyph() -> List[Dict[str, Any]]:
    return flat(
        ring(26, 25, 4, "$accent-secondary", 2),
        bar(29, 28, 40, 39, "$accent-primary", 2.5),
        bar(38, 41, 44, 47, "$accent-primary", 2.5),
    )


def robot_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(20, 22, 24, 18, rx=6, fill=None, stroke=stroke("$accent-primary", width=2)),
        bar(32, 18, 32, 22, "$accent-secondary", 2),
        dot(32, 16, 2, "$accent-secondary"),
        dot(27, 31, 2.5, "$accent-secondary"),
        dot(37, 31, 2.5, "$accent-secondary"),
        bar(27, 38, 37, 38, "$muted", 2),
    )


def group_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(15, 23, 18, 13, rx=6, fill=None, stroke=stroke("$accent-secondary", width=2)),
        rect(31, 20, 18, 13, rx=6, fill=None, stroke=stroke("$accent-primary", width=2)),
        triangle(((22, 36), (25, 36), (20, 41)), "$accent-secondary"),
        triangle(((38, 33), (41, 33), (36, 39)), "$accent-primary"),
        dot(23, 29, 1.8, "$accent-secondary"),
        dot(39, 26, 1.8, "$accent-primary"),
    )


def shield_check_glyph() -> List[Dict[str, Any]]:
    return flat(
        polygon([(32, 18), (44, 24), (42, 40), (32, 46), (22, 40), (20, 24)], fill=None, stroke=stroke("$accent-primary", width=2)),
        bar(27, 32, 31, 36, "$accent-success", 2.5),
        bar(31, 36, 38, 27, "$accent-success", 2.5),
    )


def bookmark_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(23, 18, 18, 28, rx=4, fill=None, stroke=stroke("$accent-primary", width=2)),
        triangle(((23, 46), (32, 38), (41, 46)), "$accent-secondary"),
    )


def plug_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(22, 24, 16, 12, rx=5, fill=None, stroke=stroke("$accent-primary", width=2)),
        bar(26, 19, 26, 24, "$accent-secondary", 2),
        bar(34, 19, 34, 24, "$accent-secondary", 2),
        bar(38, 30, 45, 30, "$accent-primary", 2),
        bar(45, 30, 45, 39, "$accent-secondary", 2),
    )


def grid_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(18, 22, 11, 11, rx=3, fill=solid("$accent-primary"), opacity=0.9),
        rect(35, 22, 11, 11, rx=3, fill=solid("$accent-secondary"), opacity=0.9),
        rect(18, 39, 11, 11, rx=3, fill=solid("$surface-alt"), opacity=1.0),
        rect(35, 39, 11, 11, rx=3, fill=solid("$accent-tertiary"), opacity=0.95),
    )


def terminal_glyph() -> List[Dict[str, Any]]:
    return flat(
        bar(22, 24, 28, 30, "$accent-primary", 3),
        bar(22, 36, 28, 30, "$accent-primary", 3),
        bar(31, 38, 43, 38, "$accent-secondary", 3),
        dot(35, 38, 1.8, "$accent-secondary"),
    )


def diff_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(17, 20, 12, 24, rx=4, fill=None, stroke=stroke("$accent-primary", width=2)),
        rect(35, 20, 12, 24, rx=4, fill=None, stroke=stroke("$accent-secondary", width=2)),
        bar(29, 32, 35, 32, "$muted", 2),
        tri_right(29, 32, 6, "$accent-secondary"),
        tri_left(23, 32, 6, "$accent-primary"),
    )


def search_glyph() -> List[Dict[str, Any]]:
    return flat(
        circle(28, 28, 8, fill=None, stroke=stroke("$accent-primary", width=3)),
        bar(34, 34, 43, 43, "$accent-primary", 3),
        rect(18, 39, 12, 3, rx=1.5, fill=solid("$accent-secondary"), opacity=0.9),
    )


def browser_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(16, 20, 32, 24, rx=6, fill=None, stroke=stroke("$outline", width=3)),
        rect(16, 20, 32, 6, rx=6, fill=solid("$surface-alt"), opacity=0.95),
        rect(22, 34, 20, 4, rx=2, fill=solid("$accent-primary"), opacity=0.9),
    )


def chart_glyph() -> List[Dict[str, Any]]:
    return flat(
        bar(20, 44, 20, 33, "$accent-secondary", 3),
        bar(30, 44, 30, 27, "$accent-primary", 3),
        bar(40, 44, 40, 22, "$accent-tertiary", 3),
        bar(18, 44, 44, 44, "$outline", 2),
    )


def ghost_glyph() -> List[Dict[str, Any]]:
    return flat(
        circle(32, 28, 10, fill=solid("$accent-primary"), opacity=0.95),
        rect(22, 28, 20, 13, rx=8, fill=solid("$accent-primary"), opacity=0.95),
        dot(27, 29, 2, "$highlight"),
        dot(37, 29, 2, "$highlight"),
        rect(24, 39, 5, 4, rx=2, fill=solid("$surface")),
        rect(30, 41, 4, 3, rx=1.5, fill=solid("$surface")),
        rect(36, 39, 5, 4, rx=2, fill=solid("$surface")),
    )


def stack_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(20, 18, 18, 10, rx=4, fill=None, stroke=stroke("$accent-primary", width=2)),
        rect(23, 28, 18, 10, rx=4, fill=None, stroke=stroke("$accent-secondary", width=2)),
        rect(26, 38, 18, 10, rx=4, fill=None, stroke=stroke("$accent-tertiary", width=2)),
    )


def orbit_glyph() -> List[Dict[str, Any]]:
    return flat(
        ellipse(32, 32, 15, 9, fill=None, stroke=stroke("$accent-primary", width=2)),
        ellipse(32, 32, 9, 15, fill=None, stroke=stroke("$accent-secondary", width=2)),
        dot(32, 32, 3, "$accent-tertiary"),
        dot(46, 32, 2.2, "$accent-primary"),
        dot(18, 32, 2.2, "$accent-secondary"),
    )


def chip_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(22, 22, 20, 20, rx=4, fill=None, stroke=stroke("$accent-primary", width=2)),
        bar(18, 27, 22, 27, "$muted", 2),
        bar(18, 37, 22, 37, "$muted", 2),
        bar(42, 27, 46, 27, "$muted", 2),
        bar(42, 37, 46, 37, "$muted", 2),
        bar(27, 18, 27, 22, "$muted", 2),
        bar(37, 18, 37, 22, "$muted", 2),
        bar(27, 42, 27, 46, "$muted", 2),
        bar(37, 42, 37, 46, "$muted", 2),
        dot(32, 32, 4, "$accent-secondary"),
    )


def branch_message_glyph() -> List[Dict[str, Any]]:
    return flat(
        dot(22, 23, 3, "$accent-secondary"),
        dot(22, 41, 3, "$accent-secondary"),
        dot(38, 32, 3, "$accent-primary"),
        bar(22, 23, 22, 41, "$muted", 3),
        bar(22, 32, 36, 32, "$muted", 3),
        rect(30, 18, 16, 11, rx=4, fill=None, stroke=stroke("$accent-primary", width=3)),
        rect(33, 22, 7, 2.6, rx=1.2, fill=solid("$accent-primary"), opacity=0.9),
    )


def lock_glyph() -> List[Dict[str, Any]]:
    return flat(
        rect(22, 28, 20, 16, rx=4, fill=None, stroke=stroke("$accent-primary", width=2)),
        ellipse(32, 24, 7, 8, fill=None, stroke=stroke("$accent-secondary", width=2)),
        dot(32, 35, 2.2, "$accent-tertiary"),
        bar(32, 35, 32, 40, "$accent-tertiary", 2),
    )


def user_glyph() -> List[Dict[str, Any]]:
    return flat(dot(32, 24, 6, "$accent-primary"), ellipse(32, 40, 12, 8, fill=None, stroke=stroke("$accent-secondary", width=2)))


def sync_glyph() -> List[Dict[str, Any]]:
    return flat(
        bar(22, 24, 38, 24, "$accent-primary", 2),
        tri_right(38, 24, 6, "$accent-primary"),
        bar(42, 40, 26, 40, "$accent-secondary", 2),
        tri_left(20, 40, 6, "$accent-secondary"),
    )


def spec(name: str, title: str, category: str, usage: str, tags: List[str], aliases: List[str], layers: List[Dict[str, Any]]) -> IconSpec:
    return IconSpec(name=name, title=title, category=category, tags=tags, aliases=aliases, usage=usage, layers=layers)


def build_specs() -> List[IconSpec]:
    return [
        spec("activity", "Activity", "chrome", "Primary Kade entry icon for sidebar, surfaces, and app-level launch points.", ["activity", "sidebar", "extension", "launch"], ["activity", "sidebar", "kade-ActivityBar", "kade.SidebarProvider"], frame_shell(*bubble_glyph(), *sparkle_glyph(42, 23))),
        spec("chat", "Chat", "chrome", "Standard conversational surface for coding tasks and AI interaction.", ["chat", "conversation", "assistant"], ["chat", "chatButtonClicked", "kade.chatButtonClicked", "conversation"], frame_shell(*bubble_glyph())),
        spec("new-task", "New Task", "chrome", "Create a fresh coding task or agent request.", ["new", "task", "create"], ["new-task", "plus", "kade.plusButtonClicked", "kade.newTask"], frame_shell(*doc_glyph(), *badge_plus())),
        spec("history", "History", "chrome", "Task history, previous sessions, and resumable conversations.", ["history", "sessions", "recents"], ["history", "historyButtonClicked", "kade.historyButtonClicked", "recent-tasks"], round_shell(*clock_glyph())),
        spec("settings", "Settings", "chrome", "Configuration, modes, providers, and Kade preferences.", ["settings", "config", "preferences"], ["settings", "settingsButtonClicked", "kade.settingsButtonClicked", "preferences"], round_shell(*gear_glyph())),
        spec("popout", "Popout", "chrome", "Open the Kade surface in a separate editor tab or external shell.", ["popout", "external", "tab"], ["popout", "open-in-tab", "kade.popoutButtonClicked", "kade.openInNewTab"], frame_shell(*popout_glyph())),
        spec("help", "Help", "chrome", "Documentation, walkthroughs, and guided product help.", ["help", "docs", "support"], ["help", "documentation", "kade.helpButtonClicked"], round_shell(*help_glyph())),
        spec("prompt", "Prompt", "conversation", "Prompt authoring, instructions, and input framing.", ["prompt", "input", "instruction"], ["prompt", "message", "compose"], frame_shell(*bubble_glyph("$accent-secondary", "$accent-primary"), *sparkle_glyph(41, 22))),
        spec("reply", "Reply", "conversation", "Assistant reply and conversational return path.", ["reply", "response", "answer"], ["reply", "response"], frame_shell(*bubble_glyph("$accent-primary", "$accent-secondary"), bar(20, 32, 14, 32, "$accent-tertiary", 2), tri_left(12, 32, 6, "$accent-tertiary"))),
        spec("context-add", "Context Add", "conversation", "Add editor selections, files, or terminal output into task context.", ["context", "attach", "add"], ["context-add", "addToContext", "kade.addToContext", "kade.terminalAddToContext"], frame_shell(*brackets_glyph(), *badge_plus(43, 21))),
        spec("explain-code", "Explain Code", "conversation", "Explain the current code selection or file behavior.", ["explain", "code", "inspect"], ["explain-code", "kade.explainCode"], frame_shell(*doc_glyph(), *brackets_glyph(), dot(44, 41, 2.2, "$accent-tertiary"))),
        spec("fix-code", "Fix Code", "conversation", "Repair a bug, command failure, or broken implementation.", ["fix", "repair", "code"], ["fix-code", "kade.fixCode", "terminal-fix-command", "kade.terminalFixCommand"], frame_shell(*doc_glyph(), *wrench_glyph())),
        spec("improve-code", "Improve Code", "conversation", "Refactor or strengthen an existing implementation.", ["improve", "refactor", "optimize"], ["improve-code", "kade.improveCode"], frame_shell(*doc_glyph(), bar(32, 40, 32, 26, "$accent-success", 2.5), tri_up(32, 22, 7, "$accent-success"), *sparkle_glyph(43, 23))),
        spec("agent", "Agent", "agents", "Single autonomous coding agent identity.", ["agent", "assistant", "worker"], ["agent", "task-agent"], round_shell(*robot_glyph())),
        spec("agent-manager", "Agent Manager", "agents", "Manage agent lifecycles, ownership, and active sessions.", ["agent", "manager", "orchestration"], ["agent-manager", "agents", "manager"], frame_shell(*robot_glyph(), bar(18, 45, 46, 45, "$muted", 2), bar(22, 41, 22, 45, "$accent-secondary", 2.5), bar(32, 36, 32, 45, "$accent-primary", 2.5), bar(42, 30, 42, 45, "$accent-tertiary", 2.5))),
        spec("group-chat", "Group Chat", "agents", "Multi-agent or multi-participant conversational coordination.", ["group", "chat", "collaboration"], ["group-chat", "team-chat"], frame_shell(*group_glyph())),
        spec("modes", "Modes", "agents", "Mode switching for ask, edit, architect, review, or custom agent behaviors.", ["modes", "profiles", "behavior"], ["modes", "promptsButtonClicked", "kade.promptsButtonClicked", "mode-switcher"], frame_shell(rect(18, 22, 28, 8, rx=4, fill=None, stroke=stroke("$accent-primary", width=2)), rect(18, 34, 28, 8, rx=4, fill=None, stroke=stroke("$accent-secondary", width=2)), dot(24, 26, 2.2, "$accent-primary"), dot(40, 38, 2.2, "$accent-secondary"))),
        spec("auto-approve", "Auto Approve", "agents", "Approval policy states for safe autonomous execution.", ["approve", "policy", "safety"], ["auto-approve", "approval", "toggleAutoApprove"], round_shell(*shield_check_glyph())),
        spec("checkpoint", "Checkpoint", "agents", "Checkpoint save and restore state for tasks and messages.", ["checkpoint", "restore", "snapshot"], ["checkpoint", "snapshot", "restore-point"], round_shell(*bookmark_glyph())),
        spec("mcp", "MCP", "tools", "Model Context Protocol servers, tools, and installed integrations.", ["mcp", "servers", "tools"], ["mcp", "mcpButtonClicked", "kade.mcpButtonClicked", "model-context-protocol"], frame_shell(*plug_glyph())),
        spec("marketplace", "Marketplace", "tools", "Marketplace browsing for servers, tools, and extensions.", ["marketplace", "catalog", "install"], ["marketplace", "store", "installed"], frame_shell(*grid_glyph())),
        spec("terminal", "Terminal", "tools", "Integrated terminal actions and command-centric workflows.", ["terminal", "cli", "shell"], ["terminal", "console"], frame_shell(*terminal_glyph())),
        spec("terminal-fix", "Terminal Fix", "tools", "Repair a failed terminal command or shell flow.", ["terminal", "fix", "command"], ["terminal-fix", "kade.terminalFixCommand"], frame_shell(*terminal_glyph(), *wrench_glyph())),
        spec("terminal-explain", "Terminal Explain", "tools", "Explain shell commands, output, or failure states.", ["terminal", "explain", "shell"], ["terminal-explain", "kade.terminalExplainCommand"], frame_shell(*terminal_glyph(), dot(42, 25, 2.2, "$accent-tertiary"), bar(42, 29, 42, 38, "$accent-tertiary", 2))),
        spec("command-generator", "Command Generator", "tools", "Generate terminal commands or code actions from intent.", ["command", "generate", "terminal"], ["command-generator", "kade.generateTerminalCommand"], frame_shell(*terminal_glyph(), *sparkle_glyph(42, 23))),
        spec("diff", "Diff", "tools", "Diff, patch, and edit-review states.", ["diff", "patch", "review"], ["diff", "changes", "patch"], frame_shell(*diff_glyph())),
        spec("search", "Search", "tools", "Search across code, context, tools, and extension state.", ["search", "find", "lookup"], ["search", "lookup", "code-search"], round_shell(*search_glyph())),
        spec("browser", "Browser", "tools", "Browser tool and page-level browsing sessions.", ["browser", "web", "page"], ["browser", "webview", "browse"], frame_shell(*browser_glyph())),
        spec("resource-monitor", "Resource Monitor", "tools", "Runtime resource, CPU, memory, and system telemetry views.", ["resource", "monitor", "metrics"], ["resource-monitor", "resources", "telemetry"], frame_shell(*chart_glyph())),
        spec("ghost", "Ghost", "intelligence", "Inline ghost suggestions and ephemeral autocomplete states.", ["ghost", "autocomplete", "inline"], ["ghost", "suggestions", "kade.ghost.generateSuggestions"], round_shell(*ghost_glyph())),
        spec("memory", "Memory", "intelligence", "Persistent memory, saved facts, and long-lived context recall.", ["memory", "stack", "recall"], ["memory", "recall", "saved-context"], round_shell(*stack_glyph())),
        spec("code-index", "Code Index", "intelligence", "Indexed codebase search and retrieval-backed understanding.", ["index", "embedding", "retrieval"], ["code-index", "index", "search-index"], frame_shell(*grid_glyph(), circle(44, 44, 4, fill=None, stroke=stroke("$accent-primary", width=2)), bar(46, 46, 50, 50, "$accent-primary", 2))),
        spec("provider", "Provider", "intelligence", "AI provider routing, network endpoints, and orchestration.", ["provider", "network", "routing"], ["provider", "api-provider"], round_shell(*orbit_glyph())),
        spec("model", "Model", "intelligence", "AI model identity, selection, and capability state.", ["model", "llm", "engine"], ["model", "api-model", "vsCodeLmModelSelector"], round_shell(*chip_glyph())),
        spec("commit-message", "Commit Message", "intelligence", "Generate source control commit summaries and messages.", ["commit", "git", "message"], ["commit-message", "git-message", "kade.vsc.generateCommitMessage"], frame_shell(*branch_message_glyph())),
        spec("auth", "Auth", "identity", "Authentication, sign-in, and secure provider credentials.", ["auth", "login", "security"], ["auth", "sign-in", "login"], round_shell(*lock_glyph())),
        spec("profile", "Profile", "identity", "User profile, account settings, and identity state.", ["profile", "account", "user"], ["profile", "account", "profileButtonClicked", "kade.profileButtonClicked"], round_shell(*user_glyph())),
        spec("sync", "Sync", "identity", "Settings sync and profile propagation across installs.", ["sync", "settings", "replicate"], ["sync", "settings-sync"], round_shell(*sync_glyph())),
    ]


def install_kade_themes(engine: UIForgeEngine) -> None:
    manager = engine.template_manager.theme_manager
    for theme_name, tokens in THEME_TOKENS.items():
        manager.add_theme(theme_name, tokens, overwrite=True)


def build_template(spec_data: IconSpec) -> Template:
    return icon(
        spec_data.name,
        *spec_data.layers,
        description=spec_data.usage,
        category=spec_data.category,
        tags=spec_data.tags,
        size=ICON_SIZE,
        formats=["png", "svg"],
        padding=PADDING,
        antialias=ANTIALIAS,
        theme_variants=list(THEMES),
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


def copy_variant_file(source: Path, theme: str, category: str, icon_name: str, output_format: str) -> Path:
    root = SVG_ROOT if output_format == "svg" else PNG_ROOT
    destination = root / theme / category / f"{icon_name}.{output_format}"
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    if output_format == "svg":
        optimize_svg(destination)
    return destination


def build_preview_html(entries: List[Dict[str, Any]]) -> str:
    cards = "\n".join(
        f"""
        <article class="card">
          <img data-icon-path="{entry['category']}/{entry['name']}.svg" src="svg/dark/{entry['category']}/{entry['name']}.svg" alt="{entry['title']}" />
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
  <title>Kade Extension Icons Preview</title>
  <style>
    :root {{ color-scheme: dark; }}
    body {{ margin: 0; font: 14px/1.5 "Segoe UI", sans-serif; background: #0f1720; color: #ecf4ff; }}
    header {{ position: sticky; top: 0; padding: 18px 20px; background: rgba(15,23,32,.92); backdrop-filter: blur(12px); border-bottom: 1px solid #223245; display: flex; gap: 16px; align-items: center; justify-content: space-between; }}
    select {{ background: #172232; color: #ecf4ff; border: 1px solid #38516c; border-radius: 10px; padding: 8px 10px; }}
    main {{ padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }}
    .card {{ background: linear-gradient(180deg, #172232, #131c29); border: 1px solid #223245; border-radius: 18px; padding: 16px; }}
    .card img {{ width: 48px; height: 48px; display: block; margin-bottom: 12px; }}
    .card h3 {{ margin: 0 0 6px; font-size: 15px; }}
    .card p {{ margin: 0 0 10px; color: #9db0c6; min-height: 60px; }}
    .card code {{ color: #7dd3fc; }}
  </style>
</head>
<body>
  <header>
    <div>
      <strong>Kade Extension Icons</strong><br />
      <span>{len(entries)} icons, {len(THEMES)} themes</span>
    </div>
    <label>Theme <select id="theme"><option value="dark">dark</option><option value="light">light</option><option value="high-contrast">high-contrast</option></select></label>
  </header>
  <main>{cards}</main>
  <script>
    const themeSelect = document.getElementById("theme");
    const images = [...document.querySelectorAll("[data-icon-path]")];
    themeSelect.addEventListener("change", () => {{
      for (const image of images) {{
        image.src = `svg/${{themeSelect.value}}/${{image.dataset.iconPath}}`;
      }}
    }});
  </script>
</body>
</html>
"""


def write_readme(icon_count: int) -> None:
    readme = f"""# Kade Extension Icons

Generated with UI Forge for Kade as an AI-first VS Code extension icon pack.

- Pack: `{PACK_NAME}`
- Version: `{CATALOG_VERSION}`
- Icons: `{icon_count}`
- Themes: `{", ".join(THEMES)}`
- Formats: `svg`, `png`

## Layout

- `svg/<theme>/<category>/<icon>.svg`
- `png/<theme>/<category>/<icon>.png`
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
    categories_union = " | ".join(sorted({json.dumps(entry["category"]) for entry in entries}))
    manifest_json = json.dumps(entries, indent=2)
    alias_json = json.dumps(alias_map, indent=2)
    icons_ts = f"""export type KadeIconTheme = "light" | "dark" | "high-contrast"
export type KadeIconFormat = "svg" | "png"
export type KadeIconName = {names_union}
export type KadeIconCategory = {categories_union}

export const iconManifest = {manifest_json} as const
export const iconAliasMap = {alias_json} as const
export type KadeIconEntry = (typeof iconManifest)[number]

export function normalizeKadeIconTerm(value: string): string {{
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}}

export function resolveKadeIconName(value: string): KadeIconName | null {{
  const normalized = normalizeKadeIconTerm(value)
  if ((iconAliasMap as Record<string, string>)[normalized]) {{
    return (iconAliasMap as Record<string, string>)[normalized] as KadeIconName
  }}
  return iconManifest.find((entry) => entry.name === normalized)?.name ?? null
}}

export function getKadeIconEntry(nameOrAlias: string): KadeIconEntry | null {{
  const resolved = resolveKadeIconName(nameOrAlias)
  if (!resolved) return null
  return iconManifest.find((item) => item.name === resolved) ?? null
}}

export function listKadeIcons(category?: KadeIconCategory): readonly KadeIconEntry[] {{
  if (!category) return iconManifest
  return iconManifest.filter((entry) => entry.category === category)
}}

export function getKadeIconPath(nameOrAlias: string, theme: KadeIconTheme = "dark", format: KadeIconFormat = "svg", base = ".."): string | null {{
  const entry = getKadeIconEntry(nameOrAlias)
  if (!entry) return null
  const relativePath = entry.paths[theme][format]
  if (!base) return relativePath
  return `${{base.replace(/\\/+$/g, "")}}/${{relativePath}}`
}}
"""
    component = """<script lang="ts">
  import { getKadeIconEntry, getKadeIconPath, type KadeIconFormat, type KadeIconTheme } from "./icons"

  export let name: string
  export let theme: KadeIconTheme = "dark"
  export let format: KadeIconFormat = "svg"
  export let base = ".."
  export let alt = name
  export let className = ""
  export let size: number | string | null = null
  export let title: string | null = null

  $: src = getKadeIconPath(name, theme, format, base)
  $: resolved = getKadeIconEntry(name)
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
    (SVELTE_ROOT / "KadeIcon.svelte").write_text(component, encoding="utf-8")


def main() -> None:
    ensure_clean_output()
    engine = UIForgeEngine(output_dir=STAGING_ROOT)
    install_kade_themes(engine)
    validator = AssetValidator()
    specs = build_specs()

    manifest_entries: List[Dict[str, Any]] = []
    alias_map: Dict[str, str] = {}
    validation_report: Dict[str, Any] = {"summary": {"icon_count": len(specs), "themes": list(THEMES)}, "icons": {}}

    for spec_data in specs:
        template = build_template(spec_data)
        results = engine.generate_theme_variants(template, themes=list(THEMES))
        theme_paths: Dict[str, Dict[str, str]] = {}
        theme_validation: Dict[str, Dict[str, Any]] = {}

        for theme_name, result in results.items():
            if not result.success:
                raise RuntimeError(f"Failed to generate '{spec_data.name}' for theme '{theme_name}': {result.error}")

            theme_paths[theme_name] = {}
            theme_validation[theme_name] = {"warnings": result.warnings[:], "formats": {}}

            for format_name, model_format in (("svg", OutputFormat.SVG), ("png", OutputFormat.PNG)):
                source_path = Path(result.output_paths[format_name])
                bundled = copy_variant_file(source_path, theme_name, spec_data.category, spec_data.name, format_name)
                validation = validator.validate_asset(bundled, template, model_format)
                theme_paths[theme_name][format_name] = bundled.relative_to(BUNDLE_ROOT).as_posix()
                theme_validation[theme_name]["formats"][format_name] = {
                    "passed": validation.passed,
                    "errors": validation.errors,
                    "warnings": validation.warnings,
                    "checks": validation.checks,
                }

        manifest_entry = {
            "name": spec_data.name,
            "title": spec_data.title,
            "category": spec_data.category,
            "tags": spec_data.tags,
            "aliases": spec_data.aliases,
            "usage": spec_data.usage,
            "paths": theme_paths,
        }
        manifest_entries.append(manifest_entry)
        validation_report["icons"][spec_data.name] = theme_validation

        for term in [spec_data.name, *spec_data.aliases, *spec_data.tags]:
            alias_map.setdefault(normalize_term(term), spec_data.name)

    validation_report["summary"]["all_passed"] = all(
        fmt["passed"]
        for icon_data in validation_report["icons"].values()
        for theme_data in icon_data.values()
        for fmt in theme_data["formats"].values()
    )

    (MANIFEST_ROOT / "icon-manifest.json").write_text(json.dumps(manifest_entries, indent=2), encoding="utf-8")
    (MANIFEST_ROOT / "icon-alias-map.json").write_text(json.dumps(alias_map, indent=2), encoding="utf-8")
    (MANIFEST_ROOT / "validation-report.json").write_text(json.dumps(validation_report, indent=2), encoding="utf-8")
    (BUNDLE_ROOT / "preview.html").write_text(build_preview_html(manifest_entries), encoding="utf-8")
    write_svelte_exports(manifest_entries, alias_map)
    write_readme(len(manifest_entries))

    print(f"Generated {len(manifest_entries)} Kade extension icons")
    print(f"Bundle root: {BUNDLE_ROOT}")
    print(f"Manifest: {MANIFEST_ROOT / 'icon-manifest.json'}")


if __name__ == "__main__":
    main()

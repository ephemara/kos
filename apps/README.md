# Apps Folder Guide

Use `apps/` for runnable hosts and app shells. If code is reusable across hosts, it belongs in `crates/` instead.

## Current App Surfaces

- `apps/web`: React, Vite, and TypeScript UI. Put browser-first UI and Tauri-shared frontend work here.
- `apps/tauri`: Tauri desktop host, IPC boundary, packaging config, shipped resources, and sidecars. Put desktop shell wiring here.
- `apps/bevy`: Bevy-specific host and viewport experiments. Put Bevy-only renderer and tooling work here, not shared domain logic.
- `apps/zen`: Native Zen renderer and editor shell. Put Zen windowing, egui shell work, and Zen runtime resources here.

## Placement Rules

- Put reusable engine, runtime, scene, IO, renderer, and domain logic in `crates/`.
- Put host-specific boot code, packaging config, and shipped app resources in the matching `apps/*` folder.
- Prefer naming new app folders by host or runtime boundary, not vague product terms.
- If a feature needs both shared logic and a host surface, split it: shared code in `crates/`, host wiring in `apps/*`.

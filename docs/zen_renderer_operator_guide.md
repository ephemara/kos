# Zen Renderer Operator Guide

> Purpose: give future operators and agents a concise way to reason about Zen viewport ownership, Kain runtime state, and registry-driven host integration while the renderer unification work is in flight.

## Mental Model

Treat Zen as the native shell around a shared renderer pipeline.

- `zen` owns the window, egui workspace, input flow, and viewport presentation
- `k-os-scene-runtime` should own canonical scene/runtime state for renderer-facing sync
- `k-os-eval` should derive viewport payloads from canonical scene state
- `k-os-renderer` should own viewport lifecycle, mesh sync, selection, stats, and render execution
- `k-os-kain`, `zen-host`, `zen-kain-api`, and `zen-kain-modules` should supply tool, shell, and contract data without becoming the renderer truth layer

If something feels ambiguous, prefer the shared renderer path over any host-local Zen rendering code.

## Current Runtime Reality

Zen is not fully cut over yet.

Today:

- [`M:\K_OS\crates\zen\src\renderer_session.rs`](M:\K_OS\crates\zen\src\renderer_session.rs) already creates a `RendererService`, ensures a shared renderer viewport, syncs `SceneRenderPayload` data into `sync_viewport_payload(...)`, forwards camera state, and requests selection and redraw through the shared renderer service
- the same module still builds host-local `SceneGeometry` from `ZenScene::build_render_mesh()` and exposes local vertex/index counts
- [`M:\K_OS\crates\zen\src\main.rs`](M:\K_OS\crates\zen\src\main.rs) still carries inline WGSL scene, shadow, and background shaders plus presentation-era renderer responsibilities
- [`M:\K_OS\crates\zen\src\kain_ui_host.rs`](M:\K_OS\crates\zen\src\kain_ui_host.rs) already owns workspace UI, dock state, document/session persistence, asset import wiring, host action binding, and Kain shell/status surfaces

Operationally, that means the renderer path is hybrid: shared service for part of runtime ownership, host-local code for part of draw ownership.

## What To Trust

When deciding which surfaces are authoritative, use this order:

1. [`M:\K_OS\docs\zen_renderer_unification.md`](M:\K_OS\docs\zen_renderer_unification.md) for crate ownership and migration cut points
2. [`M:\K_OS\docs\zen_contract_surface.md`](M:\K_OS\docs\zen_contract_surface.md) for stable host-facing crate and registry contracts
3. [`M:\K_OS\crates\k-os-workspace-registry\generated\json\integration_registry.json`](M:\K_OS\crates\k-os-workspace-registry\generated\json\integration_registry.json) and [`M:\K_OS\crates\k-os-workspace-registry\generated\json\adapter_manifests.json`](M:\K_OS\crates\k-os-workspace-registry\generated\json\adapter_manifests.json) for generated composition truth
4. [`M:\K_OS\docs\zen_renderer_validation_matrix.md`](M:\K_OS\docs\zen_renderer_validation_matrix.md) for the minimum proof set and rollout gate
5. Zen source code for current implementation gaps and temporary seams

Do not treat arbitrary deep public APIs as the host contract just because Rust makes them visible.

## Host And Tool Surfaces

The native shell and operator workflow are already data-driven in the following resources:

- [`M:\K_OS\crates\zen\resources\workspace_ui.toml`](M:\K_OS\crates\zen\resources\workspace_ui.toml) defines workspace documents, presets, tabs, viewport surfaces, and panel layout
- [`M:\K_OS\crates\zen\resources\host_api.toml`](M:\K_OS\crates\zen\resources\host_api.toml) defines host actions and bindings such as `scene.viewport`, `scene.selection`, and runtime/Kain panels
- [`M:\K_OS\crates\zen\resources\modules.toml`](M:\K_OS\crates\zen\resources\modules.toml) and [`M:\K_OS\crates\zen\resources\runtime.toml`](M:\K_OS\crates\zen\resources\runtime.toml) define the shell and runtime manifests Zen loads at startup

For host integration, prefer registry lookups called out in the contract note:

- `workspace_registry()`
- `integration_registry()`
- `adapter_manifests()`
- `adapter_manifest_for_target("zen")`
- `integration_contract_for_package("zen-host")`
- `integration_contract_for_package("zen-kain-api")`
- `integration_contract_for_package("zen-kain-modules")`
- `packages_for_host("zen")`

## Viewport Ownership Rules

Use these rules during migration:

1. Zen owns viewport presentation into egui and operator-facing layout behavior.
2. Camera input and editor intent may stay in Zen, but applied render camera state should flow through `k-os-renderer`.
3. Mesh payload derivation should come from the canonical scene/runtime path and `k-os-eval`, not from ad hoc host-local mesh builders.
4. Selection should route through the shared renderer contract, even if the backing implementation remains transitional for a while.
5. Any host-local post-processing or presentation seam is temporary unless it is clearly documented as presentation-only.

## Kain Runtime Interpretation

Treat Kain as an augmentation and tool/runtime layer, not the owner of base viewport draw truth.

- Kain shell status in Zen is part of operator workflow and module dispatch
- Kain manifests and contracts should inform what Zen can load and expose
- Kain should not be used as a justification to preserve a duplicate Zen-owned renderer path

## Common Failure Modes

- If Zen UI wiring starts hardcoding package names or entrypoints again, stop and move that information into the registry or manifest layer.
- If renderer changes add more scene buffer ownership to `zen/src/main.rs` or `zen/src/renderer_session.rs`, treat that as regression pressure unless it is an explicitly temporary seam for cutover safety.
- If a future lane cannot tell whether a behavior belongs to presentation or rendering truth, assign presentation to `zen` and rendering truth to `k-os-renderer` plus the scene/eval pipeline.
- If counts, selection, or runtime stats disagree between Zen and the shared renderer service, assume the hybrid seam is still leaking duplicated ownership.

## Recommended Next Checks

- Compare any new Zen viewport work against this guide and [`M:\K_OS\docs\zen_renderer_unification.md`](M:\K_OS\docs\zen_renderer_unification.md) before expanding the host-local path.
- Use [`M:\K_OS\docs\zen_renderer_validation_matrix.md`](M:\K_OS\docs\zen_renderer_validation_matrix.md) when you need believable proof without broad test suites.
- Keep `ARCHITECTURE.md`, `memory.md`, and this guide aligned whenever the cutover materially advances.
- Use swarm plans in [`M:\K_OS\Swarm`](M:\K_OS\Swarm) as the live control plane for who owns the next migration step.

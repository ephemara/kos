# K_OS Architecture

## Purpose

K_OS is a private multi-runtime creative tooling workspace. The repo combines:

- a Tauri desktop shell and React frontend,
- Rust engine/domain crates for scene, evaluation, GPU, rendering, gameplay, IO, and tooling,
- Kain-authored shader/runtime assets,
- an experimental Bevy host,
- a native Zen host.

Historical notes in this file may reference old Windows paths like `M:\\K_OS` and `M:\\Code\\Kain`. On this Linux workspace, treat the repo root as `/home/ephemara/Dev/Apps-3D/Zender` and the sibling upstream Kain checkout as `/home/ephemara/Dev/Kain`.

Inside the Rust workspace, the important architectural rule is that heavy logic should live in owner/domain crates, while host crates stay thin composition roots.

## Workspace Shape

The workspace root is [`M:\K_OS\Cargo.toml`](M:\K_OS\Cargo.toml). It currently contains 47 workspace packages under `src-tauri` and `crates/*`.

The most important crate groups are:

- Hosts and composition roots:
  - [`M:\K_OS\src-tauri`](M:\K_OS\src-tauri)
  - [`M:\K_OS\crates\k-os-bevy`](M:\K_OS\crates\k-os-bevy)
  - [`M:\K_OS\crates\zen`](M:\K_OS\crates\zen)
- Foundation crates:
  - [`M:\K_OS\crates\k-os-scene`](M:\K_OS\crates\k-os-scene)
  - [`M:\K_OS\crates\k-os-eval`](M:\K_OS\crates\k-os-eval)
- [`M:\K_OS\crates\k-os-gpu-pipeline`](M:\K_OS\crates\k-os-gpu-pipeline)
- [`M:\K_OS\crates\k-os-game-runtime`](M:\K_OS\crates\k-os-game-runtime)
- [`M:\K_OS\crates\k-os-kain`](M:\K_OS\crates\k-os-kain)
- [`M:\K_OS\crates\k-os-workspace-registry`](M:\K_OS\crates\k-os-workspace-registry)
- [`M:\K_OS\crates\k-os-config`](M:\K_OS\crates\k-os-config)
  - [`M:\K_OS\crates\zen-core`](M:\K_OS\crates\zen-core)
- Operator and feature crates:
  - sculpt, renderer, materials, mesh processing, baking, rig, scatter, photogrammetry, scene runtime, gameplay crates, and other domain owners in [`M:\K_OS\crates`](M:\K_OS\crates)

## Composition Roots

### Tauri

[`M:\K_OS\src-tauri\Cargo.toml`](M:\K_OS\src-tauri\Cargo.toml) is a thin backend proxy in intent, but today it statically depends on many owner crates directly. It exposes functionality through Tauri command modules in [`M:\K_OS\src-tauri\src\commands`](M:\K_OS\src-tauri\src\commands).

The host now also exposes a registry-backed composition surface from [`M:\K_OS\src-tauri\src\commands\registry.rs`](M:\K_OS\src-tauri\src\commands\registry.rs). Those commands let the frontend or other host-side consumers query:

- workspace summary
- adapter targets and adapter manifests
- per-package integration contracts
- filtered integration contract lists
- per-package public API summaries

The Tauri boundary now has three shared contract modules:

- [`M:\K_OS\src-tauri\src\registry_contract.rs`](M:\K_OS\src-tauri\src\registry_contract.rs)
- [`M:\K_OS\src-tauri\src\kain_contract.rs`](M:\K_OS\src-tauri\src\kain_contract.rs)
- [`M:\K_OS\src-tauri\src\viewport_contract.rs`](M:\K_OS\src-tauri\src\viewport_contract.rs)

`src-tauri/build.rs` exports those contracts through Specta into [`M:\K_OS\src-frontend\generated\tauriRegistry.gen.ts`](M:\K_OS\src-frontend\generated\tauriRegistry.gen.ts), so the frontend can consume typed registry, Kain, and viewport commands without hand-maintaining TS interfaces.

The durable Zen-facing contract note is [`M:\K_OS\docs\zen_contract_surface.md`](M:\K_OS\docs\zen_contract_surface.md). It defines the stable host/integration/internal split for Zen consumption and points Delta at the registry lookups and entrypoints it should use instead of rediscovering crates manually.

On the frontend side, the current native viewport composition root is the shared session plus app viewport path:

- [`M:\K_OS\src-frontend\features\viewport\sharedViewportSession.tsx`](M:\K_OS\src-frontend\features\viewport\sharedViewportSession.tsx) is the owner-registration seam for whichever feature currently claims the shared viewport
- [`M:\K_OS\src-frontend\ui\viewport\AppViewport.tsx`](M:\K_OS\src-frontend\ui\viewport\AppViewport.tsx) is the shell-facing bridge that mounts the native viewport and instruments runtime callbacks into shared state
- [`M:\K_OS\src-frontend\features\viewport\NativeViewport.tsx`](M:\K_OS\src-frontend\features\viewport\NativeViewport.tsx) owns the actual native viewport lifecycle and pointer/camera/gizmo interaction wiring
- [`M:\K_OS\src-frontend\state\stores\viewportStore.ts`](M:\K_OS\src-frontend\state\stores\viewportStore.ts) is the shared frontend control plane for native viewport availability, session status, handles, stats, selection, and persistent viewport preferences

The intended pattern is: feature modules register a shared viewport request, `AppViewport` binds that request to the native renderer bridge, and shell UI reads runtime state from `viewportStore` instead of inventing per-feature viewport session state.

### Bevy

[`M:\K_OS\crates\k-os-bevy\Cargo.toml`](M:\K_OS\crates\k-os-bevy\Cargo.toml) is an experimental host that aggregates renderer, sculpt, GPU, and gameplay crates directly.

### Zen

[`M:\K_OS\crates\zen\Cargo.toml`](M:\K_OS\crates\zen\Cargo.toml) is a native host that composes Kain, renderer, asset pipeline, and the `zen-*` crates.

Zen's current native renderer cutover now lives in [`M:\K_OS\crates\zen\src\renderer_session.rs`](M:\K_OS\crates\zen\src\renderer_session.rs). That session owns the shared `k-os-renderer` service, mirrors Zen scene data into `k-os-scene-runtime` as the canonical eval bridge, forwards camera state, handles selection requests, and caches scene geometry, while [`M:\K_OS\crates\zen\src\main.rs`](M:\K_OS\crates\zen\src\main.rs) keeps the surface/presentation/post seam.

Zen now also embeds a first-class Fabric service in [`M:\K_OS\crates\zen\src\fabric.rs`](M:\K_OS\crates\zen\src\fabric.rs). This service resolves and executes a configured `KAIN.fabric.toml` through upstream `kain-host`, reads an intent registry from `config/fabric_intents.json`, exposes intent buttons and reports in the native shell, and can auto-run configured Fabric intents on scene-dirty runtime events. The current default embedded workspace lives under [`M:\K_OS\crates\k-os-kain\fabric\zen-dcc`](M:\K_OS\crates\k-os-kain\fabric\zen-dcc).

[`M:\K_OS\crates\zen-scene\src\lib.rs`](M:\K_OS\crates\zen-scene\src\lib.rs) still exposes a scene payload bridge helper for host extraction, but the actual viewport payload evaluation now flows through [`M:\K_OS\crates\k-os-scene-runtime\src\mesh_state.rs`](M:\K_OS\crates\k-os-scene-runtime\src\mesh_state.rs).

Zen's native shell now also exposes a generated registry surface and an embedded Fabric panel in [`M:\K_OS\crates\zen\src\kain_ui_host.rs`](M:\K_OS\crates\zen\src\kain_ui_host.rs). The command palette, `workspace.tools` action strip, dedicated `workspace.registry` and `workspace.fabric` tabs, and the newer manifest-driven shell chrome all read generated registry data plus Fabric session/report state directly so the shell can discover Zen-facing packages, run Fabric intents, and inspect orchestration work without hand-curated crate lists.

The shell chrome porting seam for Zen now lives in the workspace manifest as well as the host renderer. [`M:\K_OS\crates\zen\resources\workspace_ui.toml`](M:\K_OS\crates\zen\resources\workspace_ui.toml) owns both the topbar groups and the higher-level menu bar, parsed through [`M:\K_OS\crates\zen-editor\src\lib.rs`](M:\K_OS\crates\zen-editor\src\lib.rs), so future native shell passes should extend that manifest first and then project it through [`M:\K_OS\crates\zen\src\kain_ui_host.rs`](M:\K_OS\crates\zen\src\kain_ui_host.rs).

Zen's native editor lane now also includes a painter-first workspace. The workspace manifest at [`M:\K_OS\crates\zen\resources\workspace_ui.toml`](M:\K_OS\crates\zen\resources\workspace_ui.toml) now defaults to a painter preset with import, materials, brushes, and layers panels, the palette in [`M:\K_OS\crates\zen\resources\theme.toml`](M:\K_OS\crates\zen\resources\theme.toml) is tuned for that workflow, and [`M:\K_OS\crates\zen\src\kain_ui_host.rs`](M:\K_OS\crates\zen\src\kain_ui_host.rs) now owns native painter workspace state for mesh ingest, nearby PBR texture discovery, material-slot binding, brush rack state, SVG stencil metadata, and read-only import summaries. The truthful current import contract is: GLTF, GLB, and OBJ are real scene imports through `k-os-asset-pipeline`; SVG is real stencil metadata ingest through `usvg`; FBX still routes through `k-os-io` as metadata-first staging rather than a full geometry import path.

## Existing Data-Driven Systems

Several parts of the repo already use manifests and registries instead of hardcoded wiring:

- `k-os-game-runtime` parses pipeline manifests and builds execution plans:
  - [`M:\K_OS\crates\k-os-game-runtime\src\lib.rs`](M:\K_OS\crates\k-os-game-runtime\src\lib.rs)
- `k-os-kain` tracks source and runtime assets in manifests:
  - [`M:\K_OS\crates\k-os-kain\manifests\sources.json`](M:\K_OS\crates\k-os-kain\manifests\sources.json)
  - [`M:\K_OS\crates\k-os-kain\manifests\runtime_apps.json`](M:\K_OS\crates\k-os-kain\manifests\runtime_apps.json)
  - [`M:\K_OS\crates\k-os-kain\manifests\upstream_capabilities.json`](M:\K_OS\crates\k-os-kain\manifests\upstream_capabilities.json)
- `k-os-config` owns typed config registries and JSON-schema-backed config surfaces:
  - [`M:\K_OS\crates\k-os-config\src\config`](M:\K_OS\crates\k-os-config\src\config)
- Zen loads runtime, host API, and UI manifests:
  - [`M:\K_OS\crates\zen\src\config.rs`](M:\K_OS\crates\zen\src\config.rs)
  - [`M:\K_OS\crates\zen\resources\runtime.toml`](M:\K_OS\crates\zen\resources\runtime.toml)
- Zen now also loads embedded Fabric configuration from the runtime manifest and resolves the default workspace under:
  - [`M:\K_OS\crates\zen\resources\runtime.toml`](M:\K_OS\crates\zen\resources\runtime.toml)
  - [`M:\K_OS\crates\k-os-kain\fabric\zen-dcc\KAIN.fabric.toml`](M:\K_OS\crates\k-os-kain\fabric\zen-dcc\KAIN.fabric.toml)
- Zen's embedded Fabric lane is now also registry-driven through:
  - [`M:\K_OS\crates\k-os-kain\fabric\zen-dcc\config\fabric_intents.json`](M:\K_OS\crates\k-os-kain\fabric\zen-dcc\config\fabric_intents.json)
  - [`M:\K_OS\crates\k-os-kain\fabric\zen-dcc\fabric\intents`](M:\K_OS\crates\k-os-kain\fabric\zen-dcc\fabric\intents)

## Workspace Registry

The workspace now has a dedicated generated registry crate:

- [`M:\K_OS\crates\k-os-workspace-registry`](M:\K_OS\crates\k-os-workspace-registry)

This crate is the composition layer above Cargo. It does not replace Cargo linking. Instead it:

1. runs `cargo metadata --format-version 1 --no-deps`
2. reads `workspace.metadata.kos` from [`M:\K_OS\Cargo.toml`](M:\K_OS\Cargo.toml)
3. optionally merges `[package.metadata.kos]` from crate manifests when present
4. extracts manifest and artifact ownership from:
   - [`M:\K_OS\crates\k-os-kain\manifests\sources.json`](M:\K_OS\crates\k-os-kain\manifests\sources.json)
   - [`M:\K_OS\crates\k-os-kain\manifests\runtime_apps.json`](M:\K_OS\crates\k-os-kain\manifests\runtime_apps.json)
   - [`M:\K_OS\crates\k-os-kain\manifests\upstream_capabilities.json`](M:\K_OS\crates\k-os-kain\manifests\upstream_capabilities.json)
   - [`M:\K_OS\crates\zen\resources\runtime.toml`](M:\K_OS\crates\zen\resources\runtime.toml)
   - [`M:\K_OS\crates\zen\resources\modules.toml`](M:\K_OS\crates\zen\resources\modules.toml)
   - [`M:\K_OS\crates\zen\resources\host_api.toml`](M:\K_OS\crates\zen\resources\host_api.toml)
5. writes generated proof artifacts:
   - [`M:\K_OS\crates\k-os-workspace-registry\generated\json\workspace_registry.json`](M:\K_OS\crates\k-os-workspace-registry\generated\json\workspace_registry.json)
   - [`M:\K_OS\crates\k-os-workspace-registry\generated\proof\workspace_registry_summary.md`](M:\K_OS\crates\k-os-workspace-registry\generated\proof\workspace_registry_summary.md)
   - [`M:\K_OS\crates\k-os-workspace-registry\generated\json\public_api_registry.json`](M:\K_OS\crates\k-os-workspace-registry\generated\json\public_api_registry.json)
   - [`M:\K_OS\crates\k-os-workspace-registry\generated\proof\public_api_registry_summary.md`](M:\K_OS\crates\k-os-workspace-registry\generated\proof\public_api_registry_summary.md)
   - [`M:\K_OS\crates\k-os-workspace-registry\generated\json\api_bloat_pressure.json`](M:\K_OS\crates\k-os-workspace-registry\generated\json\api_bloat_pressure.json)
   - [`M:\K_OS\crates\k-os-workspace-registry\generated\proof\api_bloat_pressure_summary.md`](M:\K_OS\crates\k-os-workspace-registry\generated\proof\api_bloat_pressure_summary.md)
   - [`M:\K_OS\crates\k-os-workspace-registry\generated\json\integration_registry.json`](M:\K_OS\crates\k-os-workspace-registry\generated\json\integration_registry.json)
   - [`M:\K_OS\crates\k-os-workspace-registry\generated\proof\integration_registry_summary.md`](M:\K_OS\crates\k-os-workspace-registry\generated\proof\integration_registry_summary.md)
   - [`M:\K_OS\crates\k-os-workspace-registry\generated\json\adapter_manifests.json`](M:\K_OS\crates\k-os-workspace-registry\generated\json\adapter_manifests.json)
   - [`M:\K_OS\crates\k-os-workspace-registry\generated\proof\adapter_manifests_summary.md`](M:\K_OS\crates\k-os-workspace-registry\generated\proof\adapter_manifests_summary.md)

The current generated snapshot proves:

- 47 workspace packages
- 101 workspace-local dependency edges
- 5 extracted external manifests
- 86 extracted artifacts
- 47 scanned public API packages
- 3,100 public API items
- 575 public reexports
- 2 current `critical` API cleanup candidates:
  - `k-os-material`
  - `k-os-gpu-pipeline`
- 3 `host-api` packages, 28 `integration` packages, and 16 `internal` packages in the current integration contract layer
- generated adapters now exist for `tauri`, `bevy`, `zen`, and `external`

The three main host crates now depend on `k-os-workspace-registry`:

- [`M:\K_OS\src-tauri\Cargo.toml`](M:\K_OS\src-tauri\Cargo.toml)
- [`M:\K_OS\crates\k-os-bevy\Cargo.toml`](M:\K_OS\crates\k-os-bevy\Cargo.toml)
- [`M:\K_OS\crates\zen\Cargo.toml`](M:\K_OS\crates\zen\Cargo.toml)

That means normal builds of those composition roots will also build and regenerate the registry crate.

## Current Wiring Reality

The workspace is only partially data-driven today.

- Cargo handles real compile-time linking through explicit path dependencies.
- Runtime crates already understand manifests, profiles, adapters, and registries.
- Host crates still contain a lot of direct crate dependencies and string-literal identities for runtime hosts, renderer contracts, shader IDs, and asset paths.
- `k-os-kain` now has two distinct registry truths that should not be conflated:
  - local K_OS-owned Kain assets under `sources.json` and `runtime_apps.json`
  - upstream Kain capability/adoption truth under `upstream_capabilities.json`

The important rule is: do not fake parity by inventing local runtime apps for upstream Kain features that are not actually wired into K_OS yet. Model upstream firepower explicitly in the capability manifest, then promote specific lanes into local runtime/source manifests once they are real.

From a workspace-only dependency audit:

- Biggest aggregators are `k-os-backend`, `k-os-bevy`, and `zen`.
- Most depended-on foundations are `k-os-gpu-pipeline`, `k-os-kain`, `k-os-scene`, `k-os-game-framework`, and `k-os-mesh-processing`.

That means the safest place to centralize future wiring is the composition layer, not the leaf crates.

## Zen Renderer Unification Status

The active renderer migration is documented in:

- [`M:\K_OS\docs\zen_renderer_unification.md`](M:\K_OS\docs\zen_renderer_unification.md)
- [`M:\K_OS\docs\zen_contract_surface.md`](M:\K_OS\docs\zen_contract_surface.md)
- [`M:\K_OS\docs\zen_renderer_validation_matrix.md`](M:\K_OS\docs\zen_renderer_validation_matrix.md)
- [`M:\K_OS\docs\zen_renderer_operator_guide.md`](M:\K_OS\docs\zen_renderer_operator_guide.md)

The target model is:

- `zen` owns the native shell, input, viewport presentation, and operator workflow
- embedded Fabric in `zen` owns cross-runtime orchestration, intent execution, host action routing, scene-dirty auto lanes, report/session emission, and mixed-runtime pipeline inspection
- `k-os-scene-runtime` owns canonical scene/runtime state for renderer-facing sync
- `k-os-eval` owns viewport payload derivation
- `k-os-renderer` owns viewport lifecycle, mesh sync, selection, stats, and render execution
- `zen-host`, `zen-kain-api`, and `zen-kain-modules` define the host/tool contract surfaces

The current implementation is still hybrid. [`M:\K_OS\crates\zen\src\renderer_session.rs`](M:\K_OS\crates\zen\src\renderer_session.rs) already syncs `SceneRenderPayload` data into `k-os-renderer::RendererService`, but it still builds host-local `SceneGeometry` buffers from `ZenScene::build_render_mesh()` for presentation and count reporting. [`M:\K_OS\crates\zen\src\main.rs`](M:\K_OS\crates\zen\src\main.rs) also still contains inline WGSL shader ownership and local render-path responsibilities Atlas identified for removal.

For future work, treat Zen's renderer migration as a cutover problem, not a greenfield renderer design problem. The job is to finish moving Zen onto the shared renderer path and then delete the duplicate host-local path.

## Recommended Wiring Direction

Do not try to make crates dynamically discover Rust dependencies at runtime.

Prefer this split instead:

1. Keep Cargo as the source of truth for compile-time linking.
2. Add workspace and crate metadata for roles, capabilities, host support, contracts, and artifact ownership.
3. Generate a workspace registry from Cargo metadata plus existing Kain and runtime manifests.
4. Make host crates read the generated registry to decide what to activate, expose, or validate.

Good candidates for metadata and generated registry ownership:

- workspace metadata in [`M:\K_OS\Cargo.toml`](M:\K_OS\Cargo.toml)
- per-crate metadata in each crate `Cargo.toml`
- a generated registry crate or generated Rust module under `crates/generated` or a small dedicated registry crate

## Important Folders

- [`M:\K_OS\crates`](M:\K_OS\crates): Rust crates
- [`M:\K_OS\src-tauri`](M:\K_OS\src-tauri): Tauri backend
- [`M:\K_OS\src-frontend`](M:\K_OS\src-frontend): React frontend
- [`M:\K_OS\src-game`](M:\K_OS\src-game): game-facing assets and manifests
- [`M:\K_OS\src-kain`](M:\K_OS\src-kain): Kain sources outside crate-local manifests
- [`M:\K_OS\config`](M:\K_OS\config): repo-level config
- [`M:\K_OS\docs`](M:\K_OS\docs): broader docs
- [`M:\K_OS\Swarm`](M:\K_OS\Swarm): active multi-agent execution plans and lane state

## Common CLI

Useful commands for architecture work:

- `cargo metadata --format-version 1 --no-deps`
- `cargo build -p k-os-workspace-registry`
- `cargo check -p k-os-backend`
- `cargo check -p k-os-bevy`
- `cargo check -p zen`
- `rg "runtime_host|renderer_contract|source_registry|modules_manifest_path" M:\K_OS`

Testing and heavy validation should still follow the repo conversation rule: ask the user once before running broad tests.

## Common Errors

- Treat `AppShell` as the only valid host for `AppViewport`. If a frontend surface needs the native renderer, layer its UI above the shell center underlay instead of mounting another renderer host.
- Treat the `NativeViewport` host element as part of the shell hole contract. In the live leash path it must stay visually transparent once the native window is connected, or the Tauri UI will paint over the renderer even when bounds sync is correct.
- Universal mode is intentionally narrower than the standalone module surface. Do not embed `NativeToolWorkspace` or other shell-owning tool workspaces inside Universal panels until they are rewritten as panel-safe embedded surfaces.
- Do not assume the Tauri shell already presents through Zen just because Zen has the target renderer architecture. The current visible Tauri viewport path still goes through `src-tauri/src/viewport_host.rs` plus `crates/k-os-bevy` on the leash port.
- Zen painter ingest is intentionally asymmetric right now. GLTF, GLB, and OBJ are real native scene imports; SVG is real stencil metadata; FBX is summary-only metadata staging until a real parser lands.
- Do not assume host crates are the right place for new logic. Prefer pushing ownership down into a domain crate and surfacing it through composition data.
- Avoid adding new string-literal crate IDs or hardcoded asset paths when a manifest or schema already exists nearby.
- `k-os-plugin` exists, but dynamic library loading is not the easiest first answer for this workspace. Static Cargo composition plus generated registries is simpler and safer for the current architecture.
- Zen's `renderer_session.rs` should be treated as the current ownership boundary for scene-to-render sync. If you need draw data or selection in Zen, use that session instead of rebuilding scene buffers directly in `main.rs`.
- For Zen shell/UI work, extend `crates/zen/resources/workspace_ui.toml` and `crates/zen/resources/theme.toml` first. `kain_ui_host.rs` should project those manifests and state, not become another hardcoded layout file.
- `cargo metadata` is the fastest reliable way to inspect the workspace graph; use `--format-version 1`.
- The Linux checkout currently expects the upstream Kain repo as a sibling workspace (`/home/ephemara/Dev/Kain`). If that is not true, set `KAIN_REPO_ROOT` and `KAIN_BIN_PATH` explicitly before blaming Cargo or Tauri.
- `public_api_registry.json` is now the closest thing this workspace has to generated headers. Use it when you need to answer “what is callable from this crate?” before reaching for global `rg` on `pub fn`.
- `api_bloat_pressure.json` is the cleanup-priority layer on top of the raw public API index. Use it to decide where crate-root curation and `pub(crate)` tightening will buy the most relief first.
- `integration_registry.json` is the curated composition layer. It assigns each crate a stability tier and recommended entrypoints so integrators do not have to consume the full raw public surface.
- `adapter_manifests.json` projects the curated composition layer into host-oriented adapter targets. Right now the generated targets are `tauri`, `bevy`, `zen`, and `external`.
- Zen renderer work now has four durable references with different roles: the boundary proposal in [`M:\K_OS\docs\zen_renderer_unification.md`](M:\K_OS\docs\zen_renderer_unification.md), the host contract note in [`M:\K_OS\docs\zen_contract_surface.md`](M:\K_OS\docs\zen_contract_surface.md), the validation matrix in [`M:\K_OS\docs\zen_renderer_validation_matrix.md`](M:\K_OS\docs\zen_renderer_validation_matrix.md), and the operator-facing runtime guide in [`M:\K_OS\docs\zen_renderer_operator_guide.md`](M:\K_OS\docs\zen_renderer_operator_guide.md).
- `src-tauri/build.rs` enforces crate documentation parity against [`M:\K_OS\docs\CARGO_ARSENAL.md`](M:\K_OS\docs\CARGO_ARSENAL.md). Any new Tauri dependency added to [`M:\K_OS\src-tauri\Cargo.toml`](M:\K_OS\src-tauri\Cargo.toml) must also be documented there or `cargo check -p k-os-backend` will fail before Rust compilation finishes.
- `src-tauri/build.rs` now also generates [`M:\K_OS\src-frontend\generated\tauriRegistry.gen.ts`](M:\K_OS\src-frontend\generated\tauriRegistry.gen.ts). Despite the filename, it now contains registry, Kain, and viewport bindings. If the file looks stale, rebuild the backend with `cargo check -p k-os-backend` instead of editing the generated TS directly.
- The generated Tauri wrappers should use camelCase argument names for command parameters even when the Rust function arguments are snake_case. Keep nested payload DTO field naming aligned with the Rust serde contract, but do not hand-write snake_case top-level invoke keys in frontend code.
- The workspace root manifest is virtual, so a root `build.rs` will not run. Shared generation work must live in a real package like `k-os-workspace-registry`.
- Builds of `k-os-backend`, `k-os-bevy`, and `zen` now regenerate the workspace registry because they depend on `k-os-workspace-registry`, but arbitrary leaf-crate builds will not. If universal pre-build sync becomes necessary, add an `xtask` or wrapper command rather than trying to force it through the virtual workspace root.
- The combined K_OS + Kain dependency graph is sensitive to `kain-import` feature selection. Modern Bevy/egui crates want the newer serde line, while `swc_common 0.38.0` still breaks on that line. For the current Zen path, keep `kain-import` on workspace serde and avoid enabling the TypeScript importer through `kain-omni` / `kain-host` unless the SWC stack is upgraded.
- `npm ci` now relies on the repo-local `.npmrc` with `legacy-peer-deps=true`. Keep that behavior unless the frontend dependency graph is deliberately re-pinned; otherwise Linux installs regress before the app code even compiles.
- `DIRECTORY.md` is helpful background, but it is not the authoritative Rust workspace contract. Check manifests and crate entrypoints directly before changing wiring.
- The root folder is intentionally slimmer now: repo maps live under `docs/repo-maps`, Kain helper scripts live under `scripts/kain`, and test runners live under `scripts/testing`. Do not move manifest, HTML entrypoint, or root contract files into those folders.
- The `Scribe` lane in a swarm should keep structural docs synchronized with the active swarm handoff docs. If Zen renderer ownership changes materially, update `ARCHITECTURE.md`, `memory.md`, and the operator guide together so future agents do not reconstruct the migration state from code alone.

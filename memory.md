# Memory

## 2026-03-29: Frontend shared native viewport control plane

### What changed

Moved the Tauri frontend closer to a real shared native-renderer shell instead of letting each feature own isolated viewport session state.

Expanded [`M:\K_OS\src-frontend\state\stores\viewportStore.ts`](M:\K_OS\src-frontend\state\stores\viewportStore.ts) from a camera-only preference store into a mixed preference plus runtime-session store. It now tracks native availability, runtime phase/status, active viewport handle, active render mesh handle, frame stats, selection, and the current shared viewport owner/request summary while persisting only stable viewport preferences.

Threaded that store through the shared viewport path:

- [`M:\K_OS\src-frontend\features\viewport\sharedViewportSession.tsx`](M:\K_OS\src-frontend\features\viewport\sharedViewportSession.tsx) now mirrors the current shared viewport owner/request into the store
- [`M:\K_OS\src-frontend\ui\viewport\AppViewport.tsx`](M:\K_OS\src-frontend\ui\viewport\AppViewport.tsx) now acts as the instrumentation seam between the shared request and the native viewport component, updating the store as viewport/session callbacks fire
- [`M:\K_OS\src-frontend\features\viewport\NativeViewport.tsx`](M:\K_OS\src-frontend\features\viewport\NativeViewport.tsx) now exposes render-mesh-handle and frame-stats callbacks so the shell can observe native viewport state without reaching into component internals
- [`M:\K_OS\src-frontend\features\native\NativeToolWorkspace.tsx`](M:\K_OS\src-frontend\features\native\NativeToolWorkspace.tsx) now reads shared viewport runtime status from the store instead of maintaining a private per-workspace status string

### Durable findings

- The Tauri shell was already much closer to the desired shipping architecture than the old frontend/native debates suggested. The critical missing piece was not another renderer bridge, but a shared frontend control plane over the bridge that already existed.
- `AppViewport` is the right frontend boundary for renderer instrumentation. It is the single place that knows both the active shared viewport request and the native viewport component lifecycle, so status/handle/stats/selection fan-out should happen there rather than in every feature.
- The shared session provider should own request metadata only; the viewport store should own runtime-observable session state. That split keeps request registration simple while giving the shell one place to read native viewport truth.
- Persist only stable viewport preferences. Handles, selection, frame stats, and active owner metadata are live runtime state and should not be restored from storage.

### Next recommended step

Start moving shell-facing tools like content browser, sequencer, inspector, and sculpt overlays onto the shared viewport store/selectors instead of ad hoc local `viewportStatus` and `viewportHandle` state. If new functionality needs viewport feedback, add the callback once at `NativeViewport` plus `AppViewport`, then consume it from the shared store instead of threading more one-off props through feature trees.

## 2026-03-27: Zen build and startup unblock after Fabric embed

### What changed

Unblocked `cargo build -p zen` and confirmed the resulting `target/debug/zen.exe` stays alive on launch instead of failing before startup.

Aligned the mixed K_OS + Kain dependency surface so the Zen host can build cleanly after the Fabric embed work. On the K_OS side, moved local `uuid` consumers onto a shared workspace pin in `M:\K_OS\Cargo.toml`. On the Kain side, removed the hard `serde = =1.0.209` pin from `M:\Code\Kain\crates\kain-import\Cargo.toml`, then trimmed unnecessary TypeScript importer edges by making `kain-omni`'s TypeScript lane optional, disabling that feature for `kain-host` and Zen, and narrowing `kain-c-ffi` to the `c` importer feature only. Fixed the remaining Zen compile regression by threading `fabric_service` through the `draw_action_strip` and `draw_runtime_inspector` call paths in `M:\K_OS\crates\zen\src\kain_ui_host.rs`.

### Durable findings

- The real resolver conflict was not just `uuid`; it was the combination of newer UI/runtime crates in K_OS and an exact `serde 1.0.209` pin in upstream `kain-import`.
- `swc_common 0.38.0` still expects `serde::__private`, so any Zen dependency path that enables the Kain TypeScript importer will break on the modern serde line used by current Bevy/egui/bitflags stacks.
- Zen's current Fabric host path does not require TypeScript import support to boot or run the embedded DCC workspace. Keeping the TS importer disabled in the Zen-facing `kain-omni` and `kain-host` path is the safer default until SWC is upgraded.
- When diagnosing Zen startup after cross-repo dependency edits, clear overlapping cargo processes before trusting compiler output. Stale parallel jobs produced misleading errors during this pass.

### Next recommended step

If Zen needs TypeScript import support later, upgrade the upstream SWC stack in `kain-import` instead of reintroducing an exact old serde pin. Keep validating startup from the built `target/debug/zen.exe` after major Kain dependency changes, not just `cargo build`.

## 2026-03-27: Embedded Fabric subsystem for Zen

### What changed

Moved the Zen Fabric embed from a single configured-manifest panel into a real intent-driven native pipeline.

Extended the host-local Fabric service at `M:\K_OS\crates\zen\src\fabric.rs` so it now loads an intent registry, resolves lane-specific `fabric/intents/*.fabric.toml` graphs, handles `FabricRunIntent` runtime commands, and auto-runs configured Fabric lanes on scene-dirty events. Added native host actions for bootstrap, ingest, material bake, topology rebuild, and publish, then expanded the default Zen Fabric workspace at `M:\K_OS\crates\k-os-kain\fabric\zen-dcc` with real Python, Kain, GPU, Rust, and Node steps.

### Durable findings

- The right framing is "Fabric is a native Zen subsystem" rather than "Fabric is an optional external sidecar." Zen can embed Fabric deeply without giving up ownership of the viewport loop.
- The host/service split matters. `crates/zen` should own manifest resolution, run triggers, session/report caching, and panel presentation, while upstream `kain-host` continues to own execution of `KAIN.fabric.toml`.
- The best Zen-side trigger seam is `ZenCommand -> ZenEvent -> ZenFabricService`, not direct UI callbacks. That keeps Fabric intent execution reachable from host actions, command palette picks, and future non-UI runtime triggers without duplicating glue.
- A registry-driven workspace under `k-os-kain/fabric/zen-dcc` is the right shape for Zen DCC. `config/fabric_intents.json` plus `fabric/intents/*.fabric.toml` lets the shell stay data-driven while the runtime mix under `src/`, `scripts/`, `shaders/`, and `local_crate/` grows over time.
- The current embedded workspace now proves five runtime lanes locally: `python`, `kain`, `gpu_compute`, `rust_crate`, and `node`. The `c_abi` lane should be added once ZenDCC has a concrete local DLL owner instead of pointing at a placeholder native artifact.
- The ownership rule still holds: Zen owns viewport and operator workflow; Fabric owns cross-runtime orchestration; owner crates keep domain semantics. Embedding Fabric more deeply should reduce glue code, not move scene/viewport truth into scripts.

### Next recommended step

Decide which Zen runtime events should map to additional Fabric auto lanes beyond the current scene-dirty material/topology hooks, then add a real local `c_abi` owner if sculpt/filter native kernels should become first-class parts of the embedded Zen DCC pipeline. Keep hot interactive viewport paths off the Fabric execution loop unless a specific lane proves it can meet latency requirements.

## 2026-03-27: Fabric adoption assessment for Zen DCC

### What changed

Replaced the stale external-style Fabric research dump at `M:\K_OS\crates\FABRIC.md` with a source-grounded adoption guide based on the current `M:\Code\Kain` Fabric implementation, the `kain-fabric-modeler` and `kain-fabric-dcc-suite` app scaffolds, and Zen's current manifest-driven host architecture.

### Durable findings

- Kain Fabric is now a real local execution pipeline, not just a plan. The current CLI and host already support `init`, `validate`, and `run`, structured reports and JSONL events, and runtime adapters for `kain`, `python`, `rust_crate`, `c_abi`, `node`, and `gpu_compute`.
- The strongest reusable pattern from the Kain Fabric app scaffolds is "native shell in front, Fabric orchestration behind." Config registries, session truth, broad pipeline manifests, and lane-specific intent graphs sit behind the shell; generated UI and runtime snapshots are projections.
- Zen should adopt that same split. `crates/zen` should remain the native viewport and operator shell over the shared renderer path, while Fabric becomes the job and intent spine for bootstrap, ingest, bake, topology, publish, and tensor-style mixed-runtime work.
- The biggest adoption risk is repeating the renderer duplication mistake in a new form. Fabric should not own viewport presentation, frame submission, camera/navigation, hot selection feedback, or canonical live scene state.

### Next recommended step

Start with a narrow Zen DCC Fabric sidecar under `crates/k-os-kain` plus one Zen shell surface for Fabric sessions and reports. The first intent graphs should be bootstrap, asset ingest, material bake preview, topology rebuild, and publish, while keeping the native viewport path entirely on the current Zen plus shared-renderer architecture.

## 2026-03-27: Delta Zen registry surface and package discovery

### What changed

Expanded the Zen shell integration lane so [`M:\K_OS\crates\zen\src\kain_ui_host.rs`](M:\K_OS\crates\zen\src\kain_ui_host.rs) now surfaces the generated workspace registry directly inside the native UI. Zen now has a dedicated `workspace.registry` feature tab, the command palette can surface registry-backed package discovery for the Zen host, and the diagnostics/status surfaces report the generated registry summary alongside the existing host API, module, contract, and shell status.

### Durable findings

- Registry consumption in Zen should stay generated and query-driven, not hand-curated. The new shell surface reads `k-os-workspace-registry` directly rather than duplicating crate discovery logic in the host.
- `workspace.registry` is the right kind of shell surface for this layer: it is a discovery and composition tab, not another host API abstraction.
- The Kain status and shell diagnostics should continue to show the registry summary so operators can see the current composition surface without opening separate tooling.

### Next recommended step

Let later lanes keep using the registry pane as the host-facing discovery source, and only add more shell-specific registry affordances if a real operator workflow needs them.

## 2026-03-26: Scribe renderer unification docs handoff

### What changed

Claimed and completed the `Scribe` lane in [`M:\K_OS\Swarm\glass-foundry-zen-kain-native-pipeline.md`](M:\K_OS\Swarm\glass-foundry-zen-kain-native-pipeline.md).

Added the operator-facing guide at [`M:\K_OS\docs\zen_renderer_operator_guide.md`](M:\K_OS\docs\zen_renderer_operator_guide.md) and updated [`M:\K_OS\ARCHITECTURE.md`](M:\K_OS\ARCHITECTURE.md) so future agents can see the current Zen renderer migration state without rediscovering it from code.

The new docs record that Zen is currently hybrid:

- [`M:\K_OS\crates\zen\src\renderer_session.rs`](M:\K_OS\crates\zen\src\renderer_session.rs) already uses `k-os-renderer::RendererService` for viewport creation, camera updates, redraws, mesh sync, and selection requests
- the same module still builds host-local `SceneGeometry` from `ZenScene::build_render_mesh()`
- [`M:\K_OS\crates\zen\src\main.rs`](M:\K_OS\crates\zen\src\main.rs) still carries inline WGSL shader ownership and local renderer responsibilities that Atlas identified as migration targets
- [`M:\K_OS\crates\zen\src\kain_ui_host.rs`](M:\K_OS\crates\zen\src\kain_ui_host.rs) remains the operator shell for workspace layout, documents, host actions, asset import, and Kain status

### Durable findings

- The highest-value documentation gap was not the target architecture anymore; Atlas and Vector had already covered that. The missing durable piece was an operator-level statement of the current hybrid runtime reality and which files/contracts are authoritative during migration.
- Zen host workflow is already strongly manifest-driven through `workspace_ui.toml` and `host_api.toml`, so future integration work should avoid rebuilding those decisions in code or UI literals.
- A future agent can now distinguish three documentation layers quickly:
  - boundary proposal
  - host contract surface
  - operator/runtime guide

### Next recommended step

Keep `Forge` as the critical path. Once its renderer cutover changes land, update the operator guide and architecture note again before `Sweep` removes the remaining duplicate Zen renderer path.

## 2026-03-26: Forge renderer-session cutover

### What changed

Claimed the `Forge` lane in [`M:\K_OS\Swarm\glass-foundry-zen-kain-native-pipeline.md`](M:\K_OS\Swarm\glass-foundry-zen-kain-native-pipeline.md) and moved the Zen host's scene-to-render ownership into a dedicated session module at [`M:\K_OS\crates\zen\src\renderer_session.rs`](M:\K_OS\crates\zen\src\renderer_session.rs).

The cutover added:

- a shared `RendererService`-backed Zen session
- an explicit scene payload bridge from [`M:\K_OS\crates\zen-scene\src\lib.rs`](M:\K_OS\crates\zen-scene\src\lib.rs) via `SceneRenderPayload`
- session-owned scene geometry buffers for the local presentation seam
- selection and camera forwarding through the shared renderer contract
- a narrow compatibility path in [`M:\K_OS\crates\zen\src\main.rs`](M:\K_OS\crates\zen\src\main.rs) for post-processing and egui presentation

### Durable findings

- Zen no longer owns scene-buffer creation directly in `main.rs`; that responsibility now sits in the renderer session.
- The shared renderer service is now the source of truth for camera, selection, and frame stats in the Zen host loop where possible.
- The final bridge step now mirrors Zen scene data into `k-os-scene-runtime` before calling `evaluate_viewport_payload`, so the viewport payload evaluation path is canonical instead of host-local.
- The scene-runtime mirror contract now carries `ViewportStateComponent` alongside geometry, so `evaluate_viewport_payload` preserves Zen viewport shading mode instead of falling back to the scene-runtime default.
- `SharedMeshInfo` now exposes the mirrored shading mode as a lightweight proof hook, which Aegis can use to confirm the mirrored runtime state without broad tests.
- `zen-scene` still provides host-side scene extraction, but the evaluated payload is now owned by scene-runtime rather than by Zen itself.
- The remaining host-local work in Zen is intentionally the presentation/post seam, not the scene sync contract.

### Verification

- `cargo check -p zen` passed after the cutover.

### Next recommended step

Let `Delta` consume the new session boundary from the host side and keep `Aegis` focused on proving that the remaining presentation seam does not regress selection, stats, or viewport redraw behavior.

## 2026-03-26: Active swarm for Zen native renderer unification

### What changed

Created an active swarm plan at [`M:\K_OS\Swarm\glass-foundry-zen-kain-native-pipeline.md`](M:\K_OS\Swarm\glass-foundry-zen-kain-native-pipeline.md) to coordinate the large push for:

- unifying Zen's native 3D renderer around the shared `k-os-renderer` + `k-os-eval` + `k-os-scene-runtime` path
- wiring more of the workspace crate surface into Zen through registry-driven host contracts
- landing a Kain-backed DCC integration path without preserving permanent duplicate renderer ownership in `crates/zen`

The swarm uses the full 8-lane roster:

- `Sovereign`
- `Atlas`
- `Forge`
- `Vector`
- `Delta`
- `Aegis`
- `Scribe`
- `Sweep`

### Durable findings

- The largest architectural risk in this program is not crate discovery anymore; it is duplicate renderer ownership. Zen already has enough registry, manifest, and host-shell structure to act as the composition root, but `crates/zen/src/main.rs` still carries a parallel renderer implementation.
- The swarm is intentionally organized around one decisive move: Zen should become the native host over the shared renderer/eval/scene-runtime pipeline, not remain a second renderer with partial shared-crate adoption.
- Cleanup is intentionally deferred into `Sweep` and starts blocked. The migration should prove the shared path first, then delete obsolete host-local renderer code.
- The Atlas lane is now complete. The durable boundary proposal lives in [`M:\K_OS\docs\zen_renderer_unification.md`](M:\K_OS\docs\zen_renderer_unification.md) and defines the exact ownership split between `zen`, `k-os-renderer`, `k-os-eval`, `k-os-scene-runtime`, and `k-os-kain`.

### Next recommended step

Start `Forge` and `Vector` in parallel. `Forge` should own the shared Zen renderer session, scene-runtime bridge, and viewport cutover. `Vector` should own the registry/contract surface that tells Zen which crates and entrypoints it should consume. `Delta` should begin only after those two lanes have stabilized the renderer backbone and the host/tool contract surface.

## 2026-03-26: Vector contract surface note for Zen integration

### What changed

Claimed the `Vector` lane in [`M:\K_OS\Swarm\glass-foundry-zen-kain-native-pipeline.md`](M:\K_OS\Swarm\glass-foundry-zen-kain-native-pipeline.md) and landed a durable Zen-facing contract note at [`M:\K_OS\docs\zen_contract_surface.md`](M:\K_OS\docs\zen_contract_surface.md).

The note captures the stable host/integration/internal split for Zen consumption and names the registry lookups Delta should use:

- `workspace_registry()`
- `integration_registry()`
- `adapter_manifests()`
- `adapter_manifest_for_target("zen")`
- `integration_contract_for_package("zen-host")`
- `integration_contract_for_package("zen-kain-api")`
- `integration_contract_for_package("zen-kain-modules")`
- `packages_for_host("zen")`

### Durable findings

- The generated registry already had the Zen tiering and recommended entrypoints that Vector needed, so the remaining work was to make the contract legible and durable for Delta and Scribe.
- `zen-host` and `zen-kain-api` are the best stable host-facing contract surfaces for Zen tool integration right now.
- The right consumption model is still “generated registry plus explicit recommended entrypoints,” not “walk arbitrary public items at the host boundary.”

### Next recommended step

Hand the new contract note to `Delta` so it can wire Zen host/UI/tool surfaces against the registry-driven contract rather than adding fresh hardcoded discovery logic.

## 2026-03-26: Specta expansion for Kain and viewport contracts

### What changed

Extended the shared Tauri Specta contract beyond the workspace registry by adding:

- [`M:\K_OS\src-tauri\src\kain_contract.rs`](M:\K_OS\src-tauri\src\kain_contract.rs)
- [`M:\K_OS\src-tauri\src\viewport_contract.rs`](M:\K_OS\src-tauri\src\viewport_contract.rs)

Updated [`M:\K_OS\src-tauri\src\kain_commands.rs`](M:\K_OS\src-tauri\src\kain_commands.rs) and [`M:\K_OS\src-tauri\src\commands\viewport.rs`](M:\K_OS\src-tauri\src\commands\viewport.rs) so the backend command layer now maps between owner-crate types and explicit frontend-facing contract DTOs instead of exposing ad hoc serialized structs or raw renderer/Kain types directly.

Expanded [`M:\K_OS\src-tauri\build.rs`](M:\K_OS\src-tauri\build.rs) so [`M:\K_OS\src-frontend\generated\tauriRegistry.gen.ts`](M:\K_OS\src-frontend\generated\tauriRegistry.gen.ts) now exports typed Kain and viewport bindings in addition to the registry slice. Refactored [`M:\K_OS\src-frontend\kain\bridge\KAINBridge.ts`](M:\K_OS\src-frontend\kain\bridge\KAINBridge.ts) and [`M:\K_OS\src-frontend\services\viewportClient.ts`](M:\K_OS\src-frontend\services\viewportClient.ts) to consume those generated wrappers instead of using handwritten `invoke()` DTOs.

### Durable findings

- The current pragmatic Specta pattern in this repo is still “shared DTO modules + generated wrapper file,” not full `tauri-specta` command collection. That is enough to replace handwritten TypeScript on high-leverage surfaces without forcing a full backend migration.
- Kain benefited from a local contract module because the build script cannot safely import owner-crate-only types unless those crates are also build dependencies. Keep contract modules self-contained and do type conversion inside command modules.
- Tauri command argument keys should be emitted as camelCase in the generated wrappers even when the Rust parameter names are snake_case. The earlier registry wrapper slice was updated accordingly during this pass.
- `cargo check -p k-os-backend` now validates the registry, Kain, and viewport Specta export path together and regenerates the single frontend binding file.

### Design decision

The Tauri/frontend boundary now has an explicit contract layer for three families:

1. Workspace registry composition data.
2. Kain compile and manifest-backed registry data.
3. Native viewport config and diagnostics data.

That keeps owner/domain crates authoritative while making the host boundary typed, generated, and much easier to integrate against from React.

### Next recommended step

Use the generated contract file for the next high-value Tauri surfaces that still have manual DTO drift:

1. Renderer event payloads in [`M:\K_OS\src-frontend\services\rendererClient.ts`](M:\K_OS\src-frontend\services\rendererClient.ts).
2. Additional Kain multi-target compile and toolchain request payloads in [`M:\K_OS\src-tauri\src\main.rs`](M:\K_OS\src-tauri\src\main.rs).
3. Any frontend feature panels that still mirror backend structs by hand.

## 2026-03-26: Specta registry bindings and frontend adoption

### What changed

Added a shared registry contract module at [`M:\K_OS\src-tauri\src\registry_contract.rs`](M:\K_OS\src-tauri\src\registry_contract.rs), then used `specta` from [`M:\K_OS\src-tauri\build.rs`](M:\K_OS\src-tauri\build.rs) to generate frontend bindings at [`M:\K_OS\src-frontend\generated\tauriRegistry.gen.ts`](M:\K_OS\src-frontend\generated\tauriRegistry.gen.ts).

Added a frontend registry client at [`M:\K_OS\src-frontend\services\workspaceRegistryClient.ts`](M:\K_OS\src-frontend\services\workspaceRegistryClient.ts) and wired [`M:\K_OS\src-frontend\features\native\NativeToolWorkspace.tsx`](M:\K_OS\src-frontend\features\native\NativeToolWorkspace.tsx) to consume `registry_get_adapter_manifest("tauri")` and the filtered integration contract list instead of relying only on static UI copy.

### Durable findings

- `specta` 1.x works fine here for DTO/type export, but the current repo still does not have a live `tauri-specta` command-collection pipeline. The pragmatic first step is shared Specta DTO export plus thin handwritten invoke wrappers in the generated TS file.
- Specta's default TypeScript export config fails on `usize` and similar integer widths because it treats them as BigInt-sensitive. The local fix is to export with `ts::ExportConfiguration::new().bigint(ts::BigIntExportBehavior::Number)` in the Tauri build script.
- `cargo check -p k-os-backend` now validates both the new Specta export path and the registry-backed frontend consumption path, and it regenerates the TS file in `src-frontend/generated`.

### Design decision

The registry surface is now the first Tauri API slice with a generated TS contract. This keeps the Specta blast radius small and useful: one stable, high-leverage command family instead of trying to retrofit the entire backend command set in one pass.

### Next recommended step

Expand this same pattern to other data-driven surfaces that already have clean registry semantics:

1. Kain registry commands.
2. Viewport diagnostics/state summaries.
3. Host capability browsers or tool launch surfaces that currently rely on static frontend metadata.

## 2026-03-26: Tauri registry host commands

### What changed

Added a dedicated Tauri command module at [`M:\K_OS\src-tauri\src\commands\registry.rs`](M:\K_OS\src-tauri\src\commands\registry.rs) and registered it from [`M:\K_OS\src-tauri\src\main.rs`](M:\K_OS\src-tauri\src\main.rs). The backend can now expose the generated composition layer to frontend or host-side consumers without hardcoding crate wiring in JavaScript or React.

The command module currently exposes:

- workspace summary
- adapter target listing
- adapter manifest lookup by target
- integration contract lookup by package
- filtered integration contract listing
- public API summary lookup by package

Updated [`M:\K_OS\docs\CARGO_ARSENAL.md`](M:\K_OS\docs\CARGO_ARSENAL.md) to document the `k-os-workspace-registry` dependency because `src-tauri/build.rs` blocks backend builds when undocumented Rust crates are present in the Tauri manifest.

### Durable findings

- The fastest safe way to consume the new registry in Tauri is plain typed `serde` payloads, not `tauri-specta`. There is no active Specta wiring in the live `src-tauri` source yet, only stale or backup references.
- `cargo check -p k-os-backend` now succeeds with the new registry command module in place.
- `src-tauri/build.rs` is enforcing dependency documentation parity against `docs/CARGO_ARSENAL.md`, so any future Tauri-side crate addition must update that doc first or the build will fail before regular compile errors surface.

### Design decision

The host integration pass stays intentionally narrow: surface the generated composition data through Tauri first, then layer stronger frontend typing or Specta export on top later if the command set stabilizes.

This keeps the registry authoritative while avoiding a second refactor on the host command layer right now.

### Next recommended step

Use the new Tauri registry commands to replace a few hardcoded frontend assumptions first:

1. Read adapter manifests for `tauri` instead of hardcoding integration-visible crate lists.
2. Use per-package integration contracts to drive feature panels, capability browsers, or host-side crate pickers.
3. If the command shapes settle, add `specta` only to generate TypeScript bindings for these already-stable registry commands rather than for the entire backend command surface.

## 2026-03-25: Workspace registry implementation

### What changed

Implemented a dedicated workspace registry crate at [`M:\K_OS\crates\k-os-workspace-registry`](M:\K_OS\crates\k-os-workspace-registry) and wired the main host crates to depend on it:

- [`M:\K_OS\src-tauri\Cargo.toml`](M:\K_OS\src-tauri\Cargo.toml)
- [`M:\K_OS\crates\k-os-bevy\Cargo.toml`](M:\K_OS\crates\k-os-bevy\Cargo.toml)
- [`M:\K_OS\crates\zen\Cargo.toml`](M:\K_OS\crates\zen\Cargo.toml)

Added `workspace.metadata.kos` to [`M:\K_OS\Cargo.toml`](M:\K_OS\Cargo.toml) to define workspace-wide registry defaults, inference markers, external manifest sources, and package overrides.

### Durable findings

- The workspace registry now generates from `cargo metadata --format-version 1 --no-deps` plus manifest extraction from Kain and Zen.
- The generated artifacts live at:
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
- Current generated proof counts are:
  - 47 workspace packages
  - 101 workspace-local dependency edges
  - 5 extracted external manifests
  - 86 extracted artifacts
  - 47 scanned public API packages
  - 3,100 public API items
  - 464 public functions
  - 1,053 public methods
  - 575 public reexports
- Extracted manifest sources currently include:
  - `k-os-kain` `sources.json`
  - `k-os-kain` `runtime_apps.json`
  - Zen `runtime.toml`
  - Zen `modules.toml`
  - Zen `host_api.toml`
- `k-os-kain` is currently the biggest artifact provider in the generated registry, followed by `zen`.
- The current API pressure ranking puts these crates at the top of header-style cleanup priority:
  - `k-os-material` (`critical`)
  - `k-os-gpu-pipeline` (`critical`)
  - `k-os-io` (`high`)
  - `zen-mocap-engine` (`high`)
- The integration contract layer now classifies crate surfaces by stability:
  - `host-api`: 3 crates
  - `integration`: 28 crates
  - `internal`: 16 crates
- The adapter manifests currently project curated crate surfaces into:
  - `tauri`
  - `bevy`
  - `zen`
  - `external`
- Explicit recommended entrypoint overrides are now baked in for:
  - `k-os-kain`
  - `k-os-workspace-registry`
  - `k-os-game-runtime`
  - `k-os-gpu-pipeline`
  - `k-os-sculpt`
  - host crates `k-os-backend`, `k-os-bevy`, and `zen`

### Design decision

The first mass-adoption pass avoids editing every crate. The registry infers most package identity from Cargo metadata, patches important cases from `workspace.metadata.kos`, and only leaves room for `[package.metadata.kos]` when a crate eventually needs facts Cargo cannot infer.

This keeps compile-time truth in Cargo while moving host-facing composition data into a generated, queryable registry.

### Important constraint

The registry auto-generates when the registry crate itself builds and when `k-os-backend`, `k-os-bevy`, or `zen` build, because those hosts now depend on it. Cargo still has no workspace-wide prebuild hook for every possible leaf-crate build because the root workspace manifest is virtual.

### Next recommended step

Start replacing handwritten host wiring with registry lookups in narrow slices:

1. Read the generated registry from `k-os-backend`, `k-os-bevy`, and `zen`.
2. Move shader IDs, host manifest paths, runtime host identities, and activation rules behind registry queries.
3. Add `[package.metadata.kos]` only for crates whose roles or exported contracts cannot be inferred cleanly.
4. Use `public_api_registry.json` as the header-like audit surface before any large API cleanup, then start pushing crates toward curated crate-root exports and fewer accidental deep `pub` items.
5. Use `api_bloat_pressure.json` to choose cleanup order instead of arguing from feel. Start with `k-os-material` and `k-os-gpu-pipeline`.
6. Use `integration_registry.json` and `adapter_manifests.json` as the integration-facing source of truth before wiring crates into new host systems or external tools.

## 2026-03-25: Data-driven crate wiring research

### What changed

Added durable workspace notes in [`M:\K_OS\ARCHITECTURE.md`](M:\K_OS\ARCHITECTURE.md) and recorded the current recommendation for crate wiring here.

### Durable findings

- The Rust workspace currently has 47 workspace packages and about 101 workspace-local dependency edges.
- The main aggregators are:
  - `k-os-backend`
  - `k-os-bevy`
  - `zen`
- The most central foundations by inbound dependency count are:
  - `k-os-gpu-pipeline`
  - `k-os-kain`
  - `k-os-scene`
  - `k-os-game-framework`
  - `k-os-mesh-processing`
- The repo already has strong data-driven surfaces:
  - `k-os-game-runtime` pipeline manifests
  - `k-os-kain` source/runtime manifests
  - `k-os-config` typed config registries and schemas
  - Zen runtime and host API manifests

### Recommendation

The easiest way to wire the crates together without making the system brittle is:

1. Keep Cargo in charge of compile-time linking.
2. Move crate identity, role, capability, host support, and artifact ownership into metadata.
3. Generate one workspace composition registry from:
   - `cargo metadata`
   - per-crate Cargo metadata
   - existing Kain/runtime manifests
4. Make host crates consume that generated registry instead of growing more handwritten imports, string IDs, and filesystem paths.

### Design direction

Use Cargo-native metadata instead of inventing a second package system.

Suggested shape:

- `workspace.metadata.kos` in [`M:\K_OS\Cargo.toml`](M:\K_OS\Cargo.toml) for global roles, host kinds, and registry defaults
- `[package.metadata.kos]` in each crate `Cargo.toml` for:
  - layer
  - host support
  - provides
  - requires
  - manifest paths
  - exported adapters or commands
- a generated Rust/JSON registry artifact that host crates can read

### Important constraint

Do not try to make Rust crates discover and link each other dynamically as the first step. That is what `k-os-plugin` would imply, and it is likely more complex than needed right now. The lower-friction path is static linking plus data-driven activation.

### Current risks

- Runtime identities are split between Cargo dependency edges, manifest files, and hardcoded string literals.
- Some runtime paths still point directly at crate-relative filesystem locations.
- Host crates can keep accreting direct dependencies unless a composition registry becomes the preferred integration surface.

### Next recommended step

Move from generation-only adoption into runtime consumption:

1. Replace host-local shader path and host manifest literals with reads from `k-os-workspace-registry`.
2. Add per-crate `[package.metadata.kos]` only where inference is insufficient.
3. Keep reconciling generated artifacts against manifest truth, especially in `k-os-kain`.

## 2026-03-25: Kain bridge drift reconnaissance

### What changed

Captured the current state of the Kain-facing crates under [`M:\K_OS\crates`](M:\K_OS\crates), with special focus on [`M:\K_OS\crates\k-os-kain`](M:\K_OS\crates\k-os-kain), [`M:\K_OS\crates\zen`](M:\K_OS\crates\zen), [`M:\K_OS\crates\zen-kain-modules`](M:\K_OS\crates\zen-kain-modules), and the upstream Kain toolchain in [`M:\Code\Kain`](M:\Code\Kain).

### Durable findings

- `k-os-kain` is now a real bridge crate, not just a shader bucket. It owns manifest-backed source/runtime discovery, generated registries, CLI shell-out helpers, and embedded SPIR-V/runtime lookup surfaces.
- The upstream Kain toolchain has evolved beyond the local K_OS target model. Upstream `CompileTarget` now includes `llvm`, `ue5`, and `ue5editor`, and the CLI exposes first-class `selfhost`, `omni`, `fabric`, `gpu-artifacts`, `import-crate`, and `build native-ui` flows.
- The local `KainCliTarget` enum in `k-os-kain` still models only `wasm`, `spirv`, `ts`, `js`, `ks`, `hybrid`, `rust`, `cpp`, `run`, `test`, `hlsl`, and `usf`. Any host surface built on that enum is therefore structurally behind upstream Kain.
- The Tauri Kain bridge in `src-tauri/src/kain_commands.rs` is still documented and exposed as a narrow compile/run/build-file wrapper. It does not model the newer upstream command surface, packaging lanes, or richer target space.
- Zen is robust as a native host shell, but its Kain integration is currently shell-centric and renderer-centric. It directly depends on upstream `kain-core` and `kain-ui`, loads a tiny module registry, and uses `k-os-kain` mainly for shell path resolution and SPIR-V-backed renderer/runtime assets.
- Zen's module registry is intentionally simple right now: one shell entry (`zen.shell.main`) backed by `crates/zen/resources/zen_shell.kn`. This is a solid composition root, but it is not yet a broader registry of modern Kain applications or native-ui bundles.
- Runtime config in `crates/zen/resources/runtime.toml` keeps Kain dispatch disabled by default and treats Kain mostly as staged renderer/UI infrastructure, not as a fully exposed multi-target application runtime.
- Manifest coverage is incomplete relative to the authored/generated asset surface:
  - `sources.json` currently contains 57 entries, of which 45 are `spirv` assets.
  - `generated/spv` currently contains 73 `.spv` files.
  - Several generated shader artifacts are not represented in `sources.json`, especially extra renderer and sculpting variants.
  - `runtime_apps.json` currently declares 10 apps and 28 generated outputs, but only 10 declared output files currently exist on disk.
- `AGENT_NOTES.md` in `k-os-kain` is already stale on counts alone. It still claims 54 source assets and 9 runtime apps.

### Design implication

There are now three distinct Kain layers that should not be conflated:

1. Upstream Kain language and compiler capability in `M:\Code\Kain`
2. K_OS registry and generated asset ownership in `crates/k-os-kain`
3. Host exposure in Tauri and Zen

The main risk is not that Kain is absent. The risk is that host-facing enums, manifests, and generated outputs only describe an older slice of a much broader upstream platform.

### Current risks

- Adding new Kain capabilities directly in hosts will keep widening the drift unless `k-os-kain` becomes the authoritative capability registry for host consumption.
- Some generated outputs appear to be treated as canonical even when the files are missing, which can make registry consumers overconfident.
- Shader/runtime manifests are curated, but the generated artifact directories have grown faster than the manifests, so “what exists” and “what is registered” are no longer the same thing.
- `find_workspace_root` in `k-os-kain` still assumes both `Cargo.toml` and `package.json`, which is fragile for tool reuse outside the full repo checkout.

### Next recommended step

Do a focused modernization pass in this order:

1. Decide whether `k-os-kain` should model upstream Kain capability as a full registry or remain an intentionally partial K_OS slice.
2. If it should model full capability, expand `KainCliTarget` and related host contracts to match upstream `CompileTarget` where K_OS intends to support those lanes.
3. Reconcile `sources.json`, `runtime_apps.json`, and generated output directories so registry data reflects actual available artifacts.
4. Add an explicit “supported in K_OS” layer if the workspace should only expose a subset of upstream Kain. That is better than letting partial support masquerade as canonical support.

## 2026-03-27: Aegis renderer validation matrix

### What changed

Claimed the `Aegis` lane in [`M:\K_OS\Swarm\glass-foundry-zen-kain-native-pipeline.md`](M:\K_OS\Swarm\glass-foundry-zen-kain-native-pipeline.md) and wrote the durable validation matrix at [`M:\K_OS\docs\zen_renderer_validation_matrix.md`](M:\K_OS\docs\zen_renderer_validation_matrix.md).

Added a lightweight runtime proof hook by exposing mirrored viewport shading mode through `SharedMeshInfo` in [`M:\K_OS\crates\k-os-scene-runtime\src\mesh_state.rs`](M:\K_OS\crates\k-os-scene-runtime\src\mesh_state.rs). That gives operators and future agents a direct way to check whether the mirror contract preserved Zen viewport state without relying on broad tests.

### Durable findings

- The minimum believable proof set for the Zen renderer cutover is now documented in one place: payload canonicalization, selection routing, redraw behavior, runtime stats, and shading-mode preservation.
- The most likely remaining regression zones are normals, post-processing handoff, threaded renderer-service behavior, and viewport texture presentation.
- The rollout gate should stay conservative until the validation matrix and the runtime proof hook both agree that the hybrid seam is only presentation-only.

### Next recommended step

Use [`M:\K_OS\docs\zen_renderer_validation_matrix.md`](M:\K_OS\docs\zen_renderer_validation_matrix.md) as the operator-facing gate before any work removes the duplicate Zen-local renderer path.

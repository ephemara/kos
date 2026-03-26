# Memory

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
  - 99 workspace-local dependency edges
  - 5 extracted external manifests
  - 86 extracted artifacts
  - 47 scanned public API packages
  - 3,079 public API items
  - 452 public functions
  - 1,052 public methods
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

- The Rust workspace currently has 47 workspace packages and about 99 workspace-local dependency edges.
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

# K_OS Architecture

## Purpose

K_OS is a private multi-runtime creative tooling workspace. The repo combines:

- a Tauri desktop shell and React frontend,
- Rust engine/domain crates for scene, evaluation, GPU, rendering, gameplay, IO, and tooling,
- Kain-authored shader/runtime assets,
- an experimental Bevy host,
- a native Zen host.

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

### Bevy

[`M:\K_OS\crates\k-os-bevy\Cargo.toml`](M:\K_OS\crates\k-os-bevy\Cargo.toml) is an experimental host that aggregates renderer, sculpt, GPU, and gameplay crates directly.

### Zen

[`M:\K_OS\crates\zen\Cargo.toml`](M:\K_OS\crates\zen\Cargo.toml) is a native host that composes Kain, renderer, asset pipeline, and the `zen-*` crates.

## Existing Data-Driven Systems

Several parts of the repo already use manifests and registries instead of hardcoded wiring:

- `k-os-game-runtime` parses pipeline manifests and builds execution plans:
  - [`M:\K_OS\crates\k-os-game-runtime\src\lib.rs`](M:\K_OS\crates\k-os-game-runtime\src\lib.rs)
- `k-os-kain` tracks source and runtime assets in manifests:
  - [`M:\K_OS\crates\k-os-kain\manifests\sources.json`](M:\K_OS\crates\k-os-kain\manifests\sources.json)
  - [`M:\K_OS\crates\k-os-kain\manifests\runtime_apps.json`](M:\K_OS\crates\k-os-kain\manifests\runtime_apps.json)
- `k-os-config` owns typed config registries and JSON-schema-backed config surfaces:
  - [`M:\K_OS\crates\k-os-config\src\config`](M:\K_OS\crates\k-os-config\src\config)
- Zen loads runtime, host API, and UI manifests:
  - [`M:\K_OS\crates\zen\src\config.rs`](M:\K_OS\crates\zen\src\config.rs)
  - [`M:\K_OS\crates\zen\resources\runtime.toml`](M:\K_OS\crates\zen\resources\runtime.toml)

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
- 99 workspace-local dependency edges
- 5 extracted external manifests
- 86 extracted artifacts
- 47 scanned public API packages
- 3,079 public API items
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

From a workspace-only dependency audit:

- Biggest aggregators are `k-os-backend`, `k-os-bevy`, and `zen`.
- Most depended-on foundations are `k-os-gpu-pipeline`, `k-os-kain`, `k-os-scene`, `k-os-game-framework`, and `k-os-mesh-processing`.

That means the safest place to centralize future wiring is the composition layer, not the leaf crates.

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

- Do not assume host crates are the right place for new logic. Prefer pushing ownership down into a domain crate and surfacing it through composition data.
- Avoid adding new string-literal crate IDs or hardcoded asset paths when a manifest or schema already exists nearby.
- `k-os-plugin` exists, but dynamic library loading is not the easiest first answer for this workspace. Static Cargo composition plus generated registries is simpler and safer for the current architecture.
- `cargo metadata` is the fastest reliable way to inspect the workspace graph; use `--format-version 1`.
- `public_api_registry.json` is now the closest thing this workspace has to generated headers. Use it when you need to answer “what is callable from this crate?” before reaching for global `rg` on `pub fn`.
- `api_bloat_pressure.json` is the cleanup-priority layer on top of the raw public API index. Use it to decide where crate-root curation and `pub(crate)` tightening will buy the most relief first.
- `integration_registry.json` is the curated composition layer. It assigns each crate a stability tier and recommended entrypoints so integrators do not have to consume the full raw public surface.
- `adapter_manifests.json` projects the curated composition layer into host-oriented adapter targets. Right now the generated targets are `tauri`, `bevy`, `zen`, and `external`.
- `src-tauri/build.rs` enforces crate documentation parity against [`M:\K_OS\docs\CARGO_ARSENAL.md`](M:\K_OS\docs\CARGO_ARSENAL.md). Any new Tauri dependency added to [`M:\K_OS\src-tauri\Cargo.toml`](M:\K_OS\src-tauri\Cargo.toml) must also be documented there or `cargo check -p k-os-backend` will fail before Rust compilation finishes.
- The workspace root manifest is virtual, so a root `build.rs` will not run. Shared generation work must live in a real package like `k-os-workspace-registry`.
- Builds of `k-os-backend`, `k-os-bevy`, and `zen` now regenerate the workspace registry because they depend on `k-os-workspace-registry`, but arbitrary leaf-crate builds will not. If universal pre-build sync becomes necessary, add an `xtask` or wrapper command rather than trying to force it through the virtual workspace root.
- `DIRECTORY.md` is helpful background, but it is not the authoritative Rust workspace contract. Check manifests and crate entrypoints directly before changing wiring.

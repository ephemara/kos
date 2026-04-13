# k-os-kain - Agent Notes

## Purpose
`k-os-kain` is the K_OS-side registry/runtime bridge for Kain assets. It centralizes:
- manifest-backed source/runtime app discovery (`sources.json`, `runtime_apps.json`)
- typed domain/runtime/target enums used across Tauri + Rust callers
- workspace-relative path resolution for domains/imports/generated outputs
- CLI-backed compile/run helpers for ad-hoc Kain execution
- generated registry access for embedded SPIR-V/runtime metadata

Primary sources:
- [`M:/K_OS/crates/k-os-kain/src/lib.rs`](M:/K_OS/crates/k-os-kain/src/lib.rs)
- [`M:/K_OS/crates/k-os-kain/manifests/sources.json`](M:/K_OS/crates/k-os-kain/manifests/sources.json)
- [`M:/K_OS/crates/k-os-kain/manifests/runtime_apps.json`](M:/K_OS/crates/k-os-kain/manifests/runtime_apps.json)

## Data Flow And Ownership
1. Startup callers query `list_sources()` / `list_runtime_apps()`; both are lazily loaded into `OnceCell` caches from manifest JSON.
2. Feature layers filter by domain/runtime/host using typed selectors (`sources_for_domain`, `runtime_apps_for_kind`, `runtime_apps_for_host`).
3. Build/run entry points (`compile_source`, `build_file`, `run_source`) resolve the `kain` CLI binary and invoke deterministic command templates.
4. Generated registries (`generated::spv`, `generated::runtime`) provide compile-time embedded metadata used by runtime lookups.
5. Validation helpers parse generated `.spv` with `naga` and emit per-shader health summaries.

Ownership boundaries:
- This crate owns registry contracts, path derivation, and CLI orchestration wrappers.
- It does not own UI/domain mapping policy in hosts (for example `src-tauri` command dispatch), which must stay synchronized with enum growth.
- Manifest content is data-owned under `manifests/*.json`; code should consume it rather than hardcode asset ids.

## Current Data Snapshot
From manifest JSON as of this run:
- Source assets: `54`
- Runtime apps: `9`

## Extension Points
- Add new source/runtime records in manifest JSON first, then regenerate runtime/SPIR-V registries as needed.
- Prefer adding enum variants + `as_str()` mappings in one change-set to avoid host drift.
- Use `KAIN_BIN_PATH` for environment-specific compiler routing instead of hardcoding binary locations.
- Extend validation by layering domain-specific checks over `validate_all_shaders_for_domain`.

## Known Risks / Edge Cases
- `load_manifest` and `load_runtime_manifest` panic on malformed/missing JSON; service layers should treat this crate as fail-fast at startup.
- `find_workspace_root` requires both `Cargo.toml` and `package.json`; non-standard checkout layouts can resolve incorrect roots.
- `compile_source`/`run_source` use PID-based temp names, which are low-collision but still shared-temp-directory dependent.
- Domain/runtime enum expansion can regress downstream exhaustive matches (recent `KainDomain::Fluid` drift in Tauri mapper is an example class).

## Validation Commands
From [`M:/K_OS`](M:/K_OS):

```powershell
cargo check -p k-os-kain --all-targets
cargo test -p k-os-kain
```

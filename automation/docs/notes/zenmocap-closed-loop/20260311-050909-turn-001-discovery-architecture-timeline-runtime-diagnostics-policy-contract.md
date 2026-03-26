# ZenMocap Note - Timeline Runtime Diagnostics Policy Contract

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)

## Summary

- Moved timeline diagnostics refresh/visibility control into a shared engine-owned manifest consumed by backend and frontend diagnostics surfaces.

## What Changed

- Added policy manifest: `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Added typed loader/validator: `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs`.
- Exposed policy via Tauri command: `mocap_get_timeline_runtime_diagnostics_policy`.
- Enforced policy field visibility in backend diagnostics report generation.
- Updated ZenMocap diagnostics polling and UI rendering to consume backend policy through typed service contracts.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)

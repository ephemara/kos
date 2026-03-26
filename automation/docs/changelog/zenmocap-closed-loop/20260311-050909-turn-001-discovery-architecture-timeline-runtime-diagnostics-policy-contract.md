# Changelog - Timeline Runtime Diagnostics Policy Contract

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)

## Added

- `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`
- `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs`
- Tauri command `mocap_get_timeline_runtime_diagnostics_policy`

## Updated

- `src-tauri/src/mocap/mocap.rs` now enforces diagnostics field visibility from manifest policy.
- `src-mocap/features/ZenMocap/MocapService.ts` now exposes typed diagnostics policy fetch.
- `src-mocap/features/ZenMocap/ZenMocap.tsx` now drives diagnostics polling cadence from backend policy.
- `src-mocap/features/ZenMocap/ui/LiveLinkStatus.tsx` and `ui/GpuDoctorPanel.tsx` now render diagnostics fields based on shared visibility policy.
- `src-mocap/features/ZenMocap/timelinePersistencePolicy.ts` no longer owns diagnostics refresh literals.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass, 1 test)
- `npx tsc --noEmit` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass, 1 test)

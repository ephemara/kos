# ZenMocap Closed Loop Changelog

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: event-first-diagnostics-drift-contract

## Changes

- Added diagnostics drift thresholds to the shared engine diagnostics manifest and policy loader.
- Emitted `mocap://timeline_runtime_diagnostics_changed` from timeline runtime mutation commands.
- Unified diagnostics report construction in backend for both command and event paths.
- Switched frontend diagnostics refresh to event-first with policy polling fallback.
- Added queue-vs-ledger drift warning rendering in status and GPU doctor diagnostics surfaces.
- Extended frontend diagnostics policy typing with new drift fields.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) (pass)
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (pass, 3 tests)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (fails on existing unrelated `KainDomain` match exhaustiveness)

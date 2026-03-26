# ZenMocap Note - Timeline Runtime Diagnostics Surface

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)

## Summary

- Added a typed diagnostics command boundary for timeline runtime ownership and ledger health, then surfaced it in the ZenMocap STATUS panel with policy-driven refresh behavior.

## Details

- Backend: `src-tauri/src/mocap/mocap.rs`
  - Added `TimelineRuntimeDiagnosticsReport`.
  - Added `mocap_get_timeline_runtime_diagnostics`.
  - Added test `diagnostics_report_reflects_runtime_state`.
- Command registration: `src-tauri/src/main.rs`
  - Registered `mocap_get_timeline_runtime_diagnostics`.
- Frontend service: `src-mocap/features/ZenMocap/MocapService.ts`
  - Added `getTimelineRuntimeDiagnostics()` and report interface.
- Frontend policy: `src-mocap/features/ZenMocap/timelinePersistencePolicy.ts`
  - Added diagnostics config (`enabled`, `refresh_interval_ms`) + validation.
- Frontend status UX: `src-mocap/features/ZenMocap/ZenMocap.tsx` and `ui/LiveLinkStatus.tsx`
  - Polls diagnostics by policy interval.
  - Shows active take binding state (`BOUND`/`MISSING`/`NONE`) and track/event counts.

## Verification

- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test).

## Follow-on

- Emit runtime diagnostics-changed events from timeline runtime command mutations to reduce polling-only dependency.
- Add manifest-owned track namespace/ownership contract and include violation reporting in diagnostics.

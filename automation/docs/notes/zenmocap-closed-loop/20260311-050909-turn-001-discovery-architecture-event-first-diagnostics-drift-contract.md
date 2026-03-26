# ZenMocap Closed Loop Note

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: event-first-diagnostics-drift-contract

## Summary

- Upgraded timeline runtime diagnostics from polling-only to event-first updates with a manifest-owned drift warning contract.

## What Changed

- Extended `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` with:
  - `drift.warn_pending_request_count`
  - `drift.warn_queue_vs_ledger_gap`
- Added typed drift policy support and validation in `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs`.
- Updated `src-tauri/src/mocap/mocap.rs` to emit `mocap://timeline_runtime_diagnostics_changed` after timeline runtime mutations:
  - apply runtime requests
  - reset runtime state
  - set active take
  - commit runtime events to take
  - hydrate from take
- Refactored diagnostics snapshot building into a shared backend helper used by both pull command and emitted event payloads.
- Updated `src-mocap/features/ZenMocap/ZenMocap.tsx` to subscribe to diagnostics-changed events and apply payloads immediately, while retaining policy interval polling fallback.
- Updated diagnostics UI surfaces:
  - `src-mocap/features/ZenMocap/ui/LiveLinkStatus.tsx`
  - `src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx`
  to show policy-driven queue/ledger drift warnings.
- Updated `src-mocap/features/ZenMocap/MocapService.ts` diagnostics policy type to include drift fields.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass.
- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) -> pass.
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir `M:/K_OS`) -> pass (3 tests).
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> fail due pre-existing unrelated `KainDomain` non-exhaustive match in `src-tauri/src/kain_commands.rs`.

## Next Recommendation

- Add focused UI tests for diagnostics drift threshold behavior and visibility-policy matrix coverage in `LiveLinkStatus` and `GpuDoctorPanel`.

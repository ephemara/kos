# ZenMocap Changelog - Timeline Runtime Diagnostics Surface

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)

## What Changed

- Added `mocap_get_timeline_runtime_diagnostics` command in `src-tauri/src/mocap/mocap.rs`.
- Added typed diagnostics report payload:
  - `active_take_path`
  - `active_take_exists`
  - `active_track_count`
  - `active_track_ids`
  - `event_log_size`
- Registered diagnostics command in `src-tauri/src/main.rs`.
- Added frontend diagnostics API and types in `src-mocap/features/ZenMocap/MocapService.ts`.
- Added policy-controlled diagnostics refresh settings in `timelinePersistencePolicy.ts`.
- Added STATUS-panel diagnostics rendering in `ZenMocap.tsx` and `ui/LiveLinkStatus.tsx`.
- Added backend unit test `diagnostics_report_reflects_runtime_state`.

## Verification

- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test).

## Why It Matters

- Runtime persistence ownership drift is now observable without ad hoc debugging.
- ZenMocap now has a typed diagnostics seam to extend with track ownership and replay integrity health over upcoming turns.

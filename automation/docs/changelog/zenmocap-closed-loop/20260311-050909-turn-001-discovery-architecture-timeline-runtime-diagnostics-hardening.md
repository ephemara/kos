# ZenMocap Closed-Loop Changelog

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)
Slice: timeline-runtime-diagnostics-hardening

## Added

- Expanded timeline diagnostics contract fields in `src-tauri/src/mocap/mocap.rs`:
  - `track_keyframe_counts`,
  - `latest_event_timestamp_ms`,
  - `event_source_counts`.

## Changed

- `mocap_get_timeline_runtime_diagnostics` now returns richer per-track and per-source ledger state.
- `diagnostics_report_reflects_runtime_state` unit test now validates enriched report payload fields.
- `src-mocap/features/ZenMocap/MocapService.ts` report interface updated to match backend diagnostics schema.
- `src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx` now renders timeline runtime diagnostics plus pending bridge queue and bridge error signals.
- `src-mocap/features/ZenMocap/ZenMocap.tsx` now auto-opens GPU Doctor when timeline bridge errors occur.

## Verification

- Pass: `npx tsc --noEmit` (`M:/K_OS/src-mocap`).
- Pass: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml`.

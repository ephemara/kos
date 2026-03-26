# ZenMocap Closed-Loop Note

Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)
Slice: timeline-runtime-diagnostics-hardening
Date: 2026-03-11

## Summary

This slice hardened ZenMocap timeline runtime observability by expanding backend diagnostics payloads and wiring them directly into GPU Doctor with frontend queue-drift context.

## What Changed

- Extended `TimelineRuntimeDiagnosticsReport` in `src-tauri/src/mocap/mocap.rs` with:
  - `track_keyframe_counts`,
  - `latest_event_timestamp_ms`,
  - `event_source_counts`.
- Kept diagnostics ownership centralized in `mocap_get_timeline_runtime_diagnostics` and preserved active-take existence checks.
- Updated diagnostics unit test (`diagnostics_report_reflects_runtime_state`) to assert new report fields.
- Updated `src-mocap/features/ZenMocap/MocapService.ts` with matching TypeScript contract fields.
- Updated `src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx` to display timeline runtime diagnostics in the Info tab and include pending bridge queue + bridge error context.
- Updated `src-mocap/features/ZenMocap/ZenMocap.tsx` to pass queue/error diagnostics props and auto-open GPU Doctor on timeline bridge failures.

## Why This Matters

- Makes runtime take-binding drift and ledger/source health observable in one operational surface.
- Reduces ambiguity when sequencer queue state and backend runtime state diverge.
- Keeps frontend diagnostics aligned with backend ownership contracts through typed report expansion.

## Verification

- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test).

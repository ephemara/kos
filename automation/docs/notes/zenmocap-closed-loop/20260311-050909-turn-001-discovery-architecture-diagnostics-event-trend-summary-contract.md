# ZenMocap Note - Diagnostics Event Trend Summary Contract

Date: 2026-03-12
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture

## Summary

- Added policy-driven diagnostics event trend summaries so high-severity reason trends are available immediately in event payload metadata.

## Details

- Extended diagnostics event policy with summary knobs:
  - `include_trend_summary`
  - `trend_summary_min_severity`
  - `trend_summary_top_count`
- Backend `mocap://timeline_runtime_diagnostics_changed` payload now includes `mutation.trend_summary` with minimum/highest severity, escalated reason count, and top escalated trends.
- Frontend parser/contracts and STATUS/GPU Doctor surfaces now render this summary directly for event-first callouts.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts` (pass)
- `npx tsc --noEmit` (pass)

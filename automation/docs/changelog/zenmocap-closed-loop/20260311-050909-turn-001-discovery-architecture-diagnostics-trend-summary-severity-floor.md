# Changelog - ZenMocap Closed Loop

Date: 2026-03-12
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: diagnostics-event-trend-summary-severity-floor

## What Changed

- Added `event.trend_summary_min_severity` in engine diagnostics policy manifest.
- Added policy validation for trend summary minimum severity in `timeline_runtime_diagnostics_policy.rs`.
- Updated backend diagnostics-changed payload trend summary to include `minimum_severity` and policy-driven escalation filtering.
- Updated frontend diagnostics contracts/parsing/fallback parity for the new trend summary field.
- Updated ZenMocap event listener to trigger immediate GPU Doctor callout on escalated trend summaries.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` (pass)
- `npx tsc --noEmit` (pass)

## Next Up

- Add backend/frontend synthetic diagnostics snapshot parity tests for trend severity/action outputs.
- Add manifest-owned trend cooldown/decay windows for automatic de-escalation of stale spikes.

# ZenMocap Closed Loop Note

Date: 2026-03-12
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: diagnostics-event-trend-summary-severity-floor

## Summary

- Added a manifest-owned severity floor for diagnostics event trend summaries so escalation filtering is data-driven.
- Synced backend payload, frontend parser/types, fallback parity checks, and UI escalation behavior to the same contract.

## Implementation

- `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`
  - Added `event.trend_summary_min_severity = "warn"`.
- `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs`
  - Added event schema field and enum validation for trend summary minimum severity.
- `src-tauri/src/mocap/mocap.rs`
  - Trend summary now publishes `minimum_severity` and filters escalated reasons by policy minimum severity.
- `src-mocap/features/ZenMocap/MocapService.ts`
  - Extended diagnostics policy and trend summary types with `trend_summary_min_severity` and `minimum_severity`.
- `src-mocap/features/ZenMocap/timelineDiagnosticsEvent.ts`
  - Added strict payload coercion for trend summary minimum severity.
- `src-mocap/features/ZenMocap/timelineDiagnosticsFallbackPolicy.ts`
  - Added fallback trend summary minimum severity.
- `src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts`
  - Added parity assertion for `trend_summary_min_severity`.
- `src-mocap/features/ZenMocap/ZenMocap.tsx`
  - Event listener now opens GPU Doctor when trend summary reports warn/error escalation.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` (pass)
- `npx tsc --noEmit` (pass)

## Next Recommendation

- Add a backend/frontend parity suite that compares trend severity/action output for identical synthetic snapshots.
- Add policy-owned trend cooldown/decay windows to de-escalate stale spikes automatically.

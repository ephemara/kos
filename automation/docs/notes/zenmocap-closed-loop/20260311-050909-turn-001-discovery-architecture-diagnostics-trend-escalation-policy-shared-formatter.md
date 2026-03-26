# ZenMocap Closed Loop Note

- Run: `20260311-050909-turn-001-discovery-architecture`
- Turn: discovery / architecture
- Slice: diagnostics trend escalation policy + shared formatter contract
- Date: 2026-03-12

## What Changed

- Expanded diagnostics trend policy in `zen-mocap-engine` manifest to include full-reason threshold coverage and per-threshold warn/error action hints.
- Hardened engine policy validation and added `trend_action_hint_for_count` for deterministic threshold-driven guidance.
- Updated backend diagnostics trend materialization so action hints are escalation-aware instead of fixed descriptor fallbacks.
- Synced frontend diagnostics policy contracts/fallback policy to the new trend schema.
- Updated shared trend resolver to prioritize policy-derived severity/action over stale backend trend payloads when reason counts are present.
- Added focused frontend tests for trend resolver behavior and updated parity/matrix diagnostics tests.

## Why It Matters

- Trend escalation guidance is now fully policy-owned and threshold-aware, which improves operator consistency between STATUS and GPU Doctor surfaces.
- Frontend and backend now share stronger contract parity for trend severity/action semantics, reducing drift risk.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` (pass)
- `npx tsc --noEmit` (pass)

## Next Recommendation

- Emit trend escalation summaries alongside diagnostics mutation events for immediate high-severity UI signaling.

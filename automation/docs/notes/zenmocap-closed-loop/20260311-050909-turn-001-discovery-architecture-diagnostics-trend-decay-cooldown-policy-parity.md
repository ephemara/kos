# ZenMocap Discovery Note - Diagnostics Trend Decay/Cooldown Policy Parity

Run ID: 20260311-050909-turn-001-discovery-architecture  
Turn: 1 (discovery-architecture)  
Date: 2026-03-12

## Slice Summary

Aligned diagnostics trend decay/cooldown contracts end-to-end so backend runtime trend synthesis and frontend fallback/parity logic consume the same manifest-owned fields.

## What Changed

- Added `trend.decay_window_ms` and `trend.cooldown_window_ms` to `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` trend schema + validation to enforce minimum values and expose both fields through the typed policy contract.
- Synced frontend fallback contract in `src-mocap/features/ZenMocap/timelineDiagnosticsFallbackPolicy.ts` and removed duplicate conflicting trend window literals.
- Extended fallback-vs-manifest parity checks in `src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts` to assert `decay_window_ms` and `cooldown_window_ms` parity.
- Updated diagnostics policy matrix fixture in `src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` to include required trend window fields.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_applies_trend_cooldown_window --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` (pass)
- `npx tsc --noEmit` (pass)

## Next Recommendation

Add explicit backend/frontend synthetic snapshot parity tests that compare backend-generated `recent_reason_trends` and frontend `resolveTimelineReasonTrends` output for identical input snapshots to lock severity/action parity as policy evolves.

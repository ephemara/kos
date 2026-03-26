# Diagnostics Trend Decay + Cooldown Contract

Date: 2026-03-12
Run: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)

## Summary

This slice converted timeline diagnostics trend escalation from unbounded count-based severity into a manifest-owned, time-windowed contract.

## What Changed

- Added `trend.decay_window_ms` and `trend.cooldown_window_ms` in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Extended policy validation in `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` (minimum bounds and cooldown <= decay invariant).
- Refactored backend runtime diagnostics mutation history to timestamped entries in `src-tauri/src/mocap/mocap.rs`.
- Added diagnostics snapshot metadata (`generated_at_ms`, `recent_reason_last_seen_ms`) for deterministic cross-surface trend evaluation.
- Applied cooldown de-escalation on backend trend severity/action hint synthesis while preserving counts in the decay window.
- Updated frontend trend resolver and policy typing (`src-mocap/features/ZenMocap/MocapService.ts`, `timelineReasonTrend.ts`) to match cooldown semantics when recomputing from counts.
- Synced fallback policy + parity assertions (`timelineDiagnosticsFallbackPolicy.ts`, `timelineDiagnosticsPolicyParity.test.ts`).

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib`
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml`
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_applies_trend_cooldown_window --manifest-path M:/K_OS/src-tauri/Cargo.toml`
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml`
- `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts`
- `npx tsc --noEmit`

## Next

- Add synthetic snapshot parity fixtures that compare backend report synthesis and frontend resolver output for identical trend-window inputs.
- Consider publishing this diagnostics trend-window contract through a Kain supermotion-facing registry for broader runtime pipeline alignment.

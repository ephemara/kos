# ZenMocap Changelog - Diagnostics Trend Decay/Cooldown Policy Parity

Date: 2026-03-12  
Run ID: 20260311-050909-turn-001-discovery-architecture

## Added

- Manifest-owned diagnostics trend window fields:
  - `trend.decay_window_ms`
  - `trend.cooldown_window_ms`

## Changed

- Extended `timeline_runtime_diagnostics_policy` Rust schema/validation to include and validate trend window fields.
- Synced frontend fallback diagnostics policy to include decay/cooldown windows and removed duplicate conflicting literals.
- Expanded parity test coverage so fallback policy and engine manifest cannot drift on trend window values.
- Updated diagnostics UI policy matrix fixtures to include required trend window fields.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib`
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_applies_trend_cooldown_window --manifest-path M:/K_OS/src-tauri/Cargo.toml`
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx`
- `npx tsc --noEmit`

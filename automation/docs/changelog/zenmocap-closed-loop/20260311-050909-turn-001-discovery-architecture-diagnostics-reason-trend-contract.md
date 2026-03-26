# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Agent: Scope Architect

## What Changed

- Added diagnostics trend policy fields in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`:
  - `[trend].reason_history_limit`
  - `[trend].top_reason_count`
  - `[field_visibility].show_recent_reason_counts`
- Extended typed diagnostics policy validation/export in `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs`.
- Extended backend diagnostics state/report in `src-tauri/src/mocap/mocap.rs` with bounded mutation reason history and `recent_reason_counts` output.
- Updated frontend diagnostics contracts and UI in `src-mocap/features/ZenMocap` to consume and render reason trend counts with policy gating.
- Extended diagnostics parity/matrix tests to guard trend-field and visibility parity.
- Added `KainDomain::Kainscript` mapping in `src-tauri/src/kain_commands.rs` to restore backend test compilation.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` (pass)
- `npx tsc --noEmit` (pass)

## Next Up

- Add policy-driven trend escalation thresholds per reason so diagnostics can automatically mark trend states as info/warn/error.
- Promote a shared trend formatting utility across STATUS and GPU Doctor to keep reason trend presentation fully contract-driven.

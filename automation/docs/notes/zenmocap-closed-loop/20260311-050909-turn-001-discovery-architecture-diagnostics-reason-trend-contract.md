# ZenMocap Closed Loop Note

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture

## Slice

Diagnostics Reason Trend Contract

## Summary

Added a manifest-owned diagnostics reason-trend contract and wired bounded trend reporting across engine policy, backend diagnostics, and frontend STATUS/GPU Doctor surfaces.

## What Changed

- Added `[trend]` policy fields and `show_recent_reason_counts` visibility in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Extended typed policy contract/validation in `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs`.
- Extended `src-tauri/src/mocap/mocap.rs` diagnostics runtime state + report with `recent_reason_counts` derived from policy-bounded mutation history.
- Updated diagnostics contracts/UI in `src-mocap/features/ZenMocap` to render reason trends under policy visibility control.
- Added parity/matrix test coverage for trend fields and visibility behavior.
- Fixed unrelated backend compile blocker by adding `KainDomain::Kainscript` source mapping in `src-tauri/src/kain_commands.rs`.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` (pass)
- `npx tsc --noEmit` (pass)

## Next Recommendation

Add manifest-backed trend escalation semantics (`warn`/`error` thresholds by reason) and a shared frontend trend formatter so STATUS and GPU Doctor produce deterministic operator actions when reason counts spike.

# ZenMocap Changelog Entry

Date: 2026-03-12
Run: `20260311-050909-turn-001-discovery-architecture`
Scope: diagnostics trend escalation policy + shared formatter contract

## Added

- Manifest-level diagnostics trend escalation action hints (`warn_action_hint`, `error_action_hint`) in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Frontend trend resolver coverage via `src-mocap/features/ZenMocap/timelineReasonTrend.test.ts`.

## Changed

- Trend defaults/thresholds expanded and aligned across engine manifest, backend policy model, and frontend fallback policy.
- Backend diagnostics trend payload construction now uses threshold-driven escalation action hints when warn/error thresholds are crossed.
- Frontend `timelineReasonTrend` now recomputes from reason counts when available to preserve policy-authoritative severity/action output.
- Policy parity test now verifies threshold action-hint parity in addition to threshold numeric parity.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib`
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml`
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml`
- `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx`
- `npx tsc --noEmit`

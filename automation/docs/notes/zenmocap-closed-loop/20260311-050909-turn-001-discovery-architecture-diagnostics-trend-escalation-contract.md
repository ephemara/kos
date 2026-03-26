# ZenMocap Note - Diagnostics Trend Escalation Contract

Date: 2026-03-12
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture

## Summary

- Added a manifest-backed diagnostics trend escalation slice that now drives backend trend severity/action guidance and shared frontend trend rendering.

## Details

- Backend diagnostics report now includes structured `recent_reason_trends` entries so trend severity/action guidance is contract-owned instead of UI heuristics.
- Added shared frontend formatter/resolver (`src-mocap/features/ZenMocap/timelineReasonTrend.ts`) used by both STATUS and GPU Doctor surfaces.
- Expanded fallback parity and matrix tests so trend threshold drift is detected early.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed.
- `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` passed.
- `npx tsc --noEmit` passed.

# ZenMocap Changelog - Diagnostics Trend Escalation Contract

Date: 2026-03-12
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture

## What Changed

- Extended diagnostics trend policy usage across backend/frontend boundaries to support manifest-owned escalation semantics.
- Added backend `recent_reason_trends` payload in timeline runtime diagnostics report.
- Added shared frontend trend resolver/formatter and routed STATUS/GPU Doctor trend rows through one contract.
- Expanded diagnostics parity and matrix tests for trend threshold and rendering consistency.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` (pass)
- `npx tsc --noEmit` (pass)

## Next

- Emit trend severity deltas in diagnostics-changed event payloads and add policy-owned trend cooldown/decay windows.

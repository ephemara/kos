# ZenMocap Changelog - Diagnostics Event Trend Summary Contract

Date: 2026-03-12
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture

## Changes

- Added event trend summary policy fields in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Updated policy validation in `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` for trend summary controls.
- Extended `src-tauri/src/mocap/mocap.rs` diagnostics payload to include `mutation.trend_summary`.
- Updated `src-mocap/features/ZenMocap/MocapService.ts` and `timelineDiagnosticsEvent.ts` contracts/parsing for trend summary metadata.
- Added UI callouts in `ui/LiveLinkStatus.tsx` and `ui/GpuDoctorPanel.tsx` for event-level trend escalation state.
- Refreshed diagnostics test suite coverage for parser, parity, freshness, and policy-matrix rendering.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib`
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml`
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts`
- `npx tsc --noEmit`

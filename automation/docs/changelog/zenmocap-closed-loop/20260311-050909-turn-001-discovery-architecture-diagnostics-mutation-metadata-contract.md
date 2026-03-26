# ZenMocap Changelog - Diagnostics Mutation Metadata Contract

Date: 2026-03-11
Run: 20260311-050909-turn-001-discovery-architecture

## Added

- Manifest-owned diagnostics event metadata policy in `timeline_runtime_diagnostics_policy.toml`:
  - `event.include_reason`
  - `event.include_emitted_at_ms`
  - `event.allowed_reasons`
- Typed frontend diagnostics event coercion contract:
  - `src-mocap/features/ZenMocap/timelineDiagnosticsEvent.ts`
  - `timelineDiagnosticsEvent.test.ts` (structured + legacy payload coverage).

## Changed

- `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs`
  - added typed event policy schema and validation.
- `src-tauri/src/mocap/mocap.rs`
  - diagnostics-changed event now emits typed `{ report, mutation }` payloads,
  - active-take commit mutation reason split into `runtime_committed_to_active_take`,
  - added test coverage for policy-driven metadata redaction.
- `src-mocap/features/ZenMocap/ZenMocap.tsx`
  - diagnostics listener now parses/coerces both event payload shapes and stores mutation metadata.
- `src-mocap/features/ZenMocap/ui/LiveLinkStatus.tsx`
  - shows last diagnostics update reason.
- `src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx`
  - shows last diagnostics update reason/time in runtime info.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` (pass)
- `npx tsc --noEmit` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (failed on unrelated `KainDomain::Procedural` match exhaustiveness blocker)

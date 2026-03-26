# ZenMocap Discovery Note - Diagnostics Mutation Metadata Contract

Date: 2026-03-11
Run: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)

## Summary

Added a typed diagnostics-change metadata contract so timeline runtime mutation events carry policy-governed reason/timestamp context and frontend diagnostics surfaces can attribute state changes without relying on implicit behavior.

## What Changed

- Engine policy contract (`crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`):
  - added `[event]` settings for metadata emission and allowed mutation reason IDs.
- Engine policy loader (`crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs`):
  - added typed `TimelineRuntimeDiagnosticsEventPolicy` and compile-time validation (non-empty/unique reasons).
- Backend diagnostics event payload (`src-tauri/src/mocap/mocap.rs`):
  - emits `{ report, mutation }` payloads with policy-controlled reason/timestamp visibility,
  - distinguishes `runtime_committed_to_active_take` from generic take commit reason.
- Frontend compatibility bridge (`src-mocap/features/ZenMocap/timelineDiagnosticsEvent.ts`):
  - coerces both structured and legacy diagnostics event payloads,
  - prevents event-shape drift from breaking diagnostics refresh.
- Frontend UI integration:
  - `ZenMocap.tsx` now tracks latest mutation metadata,
  - `LiveLinkStatus.tsx` and `GpuDoctorPanel.tsx` render last update attribution details.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` -> pass (3 tests)
- `npx tsc --noEmit` -> pass
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> fail (existing unrelated `KainDomain::Procedural` non-exhaustive match in `src-tauri/src/kain_commands.rs`)

## Follow-Ups

- Add policy-matrix UI tests for mutation metadata visibility and fallback behavior.
- Promote mutation reason IDs to a shared enum-style contract to eliminate backend/policy string drift.

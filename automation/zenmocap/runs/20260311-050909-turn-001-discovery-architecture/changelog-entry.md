# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Agent: Scope Architect

## What Changed

- Added `resources/rig_topology_manifest.toml` and `src/rig/topology.rs` to make mocap topology selection data-driven.
- Replaced hardcoded COCO topology arrays in `session.rs` with manifest profile lookup by keypoint count.
- Added validation and tests for topology binding/profile integrity.

## Why It Matters

- Topology ownership moved out of inline runtime code into a reusable manifest contract.
- Future model/rig family expansion can add profiles and bindings without rewriting session pipeline internals.

## Verification

- `cargo test -p zen-mocap-engine topology --lib` (pass)

## Next Up

- Build animator-facing keyframe/timeline policy registry using the same manifest-driven pattern.
## Additional What Changed (This Run)

- Added `src/animator_plan.rs` with typed discovery priorities and cross-surface ownership metadata.
- Added planner tests for uniqueness, sort stability, and Kain mode-ID registry consistency.
- Exported planner module from `src/lib.rs`.

## Additional Verification (This Run)

- `cargo test -p zen-mocap-engine animator_plan::tests:: --lib` (failed due to existing `rig/mod.rs` compile errors `E0753` prior to test execution)

## Additional Changes (Animator Plan)

- Added `src/animator_plan.rs` as a typed discovery backlog/architecture contract.
- Exported new module via `src/lib.rs`.
- Added planner integrity tests; verification command passed (`cargo test -p zen-mocap-engine animator_plan::tests:: --lib`).

## Additional Changes (Timeline Edit Contract)

- Added `crates/zen-mocap-engine/resources/keyframe_edit_policy.toml` for policy-driven timeline behavior.
- Added `crates/zen-mocap-engine/src/timeline_edit.rs` with typed keyframe operation payloads and reversible patch semantics.
- Exported module in `crates/zen-mocap-engine/src/lib.rs`.

## Additional Verification (Timeline Edit Contract)

- `cargo test -p zen-mocap-engine timeline_edit::tests:: --lib` (pass, 5 tests)

## Additional Next Up

- Integrate Sequencer keyframe authoring with engine `KeyframeEditOp` transport so UI and take runtime share one mutation contract.

## Additional What Changed (Live Retarget Contract Hardening)

- Added live-retarget contract fields to `resources/rig_topology_manifest.toml` and strict schema validation in `src/rig/topology.rs`.
- Added `LiveRetargetContract` in `src/rig/mod.rs` and moved retarget reliability thresholds into manifest-owned data.
- Removed hardcoded COCO-17 gating from `session.rs` and `video_analyzer.rs`; compatibility now depends on topology contract availability.
- Replaced hardcoded topology arrays in `video_analyzer.rs` with manifest profile topology upload.
- Replaced hardcoded GPU-chain max-joint count with model-driven sizing in live and offline pipelines.

## Additional Verification (Live Retarget Contract Hardening)

- `cargo test -p zen-mocap-engine rig::topology::tests:: --lib` (pass)
- `cargo test -p zen-mocap-engine video_analyzer::tests::analyze_rejects_models_without_live_retarget_topology_contract --lib` (pass)

## Additional Next Up

- Apply the same manifest-contract pattern to timeline/keyframe editing constraints on turn 2 (`timeline-keyframe-edit-ops`).

## Additional Changes (Unified Retarget Contract Resolver)

- Added `resolve_retarget_contract`, `RetargetSurface`, and `ResolvedRetargetContract` to `crates/zen-mocap-engine/src/rig/mod.rs`.
- Refactored `session.rs` and `video_analyzer.rs` to use shared retarget contract resolution.
- Added focused resolver tests in `rig/mod.rs`.

## Additional Verification (Unified Retarget Contract Resolver)

- `cargo test -p zen-mocap-engine rig::tests:: --lib` (pass)
- `cargo test -p zen-mocap-engine video_analyzer::tests::analyze_rejects_models_without_live_retarget_topology_contract --lib` (pass)

## Additional Next Up

- Route Sequencer keyframe edits through engine `timeline_edit` operations and persist op payloads at the boundary.

## Additional Changes (Take Validation Contract)

- Added `crates/zen-mocap-engine/resources/take_validation_policy.toml` to move take integrity constraints into data.
- Added `validate_take` report/issue contract in `crates/zen-mocap-engine/src/take.rs` and enforced validation in `save_take`/`load_take`.
- Added focused take validation unit tests for valid payload acceptance and malformed payload rejection.

## Additional Verification (Take Validation Contract)

- `cargo test -p zen-mocap-engine take::tests:: --lib` (pass, 5 tests)

## Additional Next Up

- Use engine `KeyframeEditOp` payloads in Sequencer and run `take` validation before persistence/export boundaries.

## Additional Changes (Timeline Batch Contract)

- Added `crates/zen-mocap-engine/src/timeline_batch.rs` with typed envelope payloads (`TimelineEditEnvelope`) and transactional batch execution (`apply_timeline_edit_batch`).
- Added `crates/zen-mocap-engine/resources/timeline_batch_policy.toml` to make batch sizing, origin permissions, and supermotion mode override IDs data-driven.
- Added rollback-on-failure behavior so multi-op keyframe edits are atomic rather than partially applied.
- Exported `timeline_batch` from `crates/zen-mocap-engine/src/lib.rs`.

## Additional Verification (Timeline Batch Contract)

- `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` (pass, 4 tests)
- `cargo test -p zen-mocap-engine timeline_edit::tests:: --lib` (pass, 5 tests)

## Additional Next Up

- Turn 2 should route Sequencer keyframe actions through `TimelineEditEnvelope` batches and surface typed batch/operation errors in UI controls.

## Additional Changes (Timeline Event Ledger Contract)

- Added `crates/zen-mocap-engine/src/timeline_event.rs` with typed timeline edit event envelopes and manifest-backed source/session-frame validation.
- Added `crates/zen-mocap-engine/resources/timeline_event_policy.toml` for data-driven event caps, source registry, and monotonic timestamp policy.
- Exported `timeline_event` from `crates/zen-mocap-engine/src/lib.rs`.
- Extended `crates/zen-mocap-engine/src/take.rs` with persisted `timeline_edit_events` plus integrated log validation against both policy and take frame bounds.
- Added focused test coverage for timeline-event policy and take-bound validation.

## Additional Verification (Timeline Event Ledger Contract)

- `cargo test -p zen-mocap-engine timeline_event::tests:: --lib` (pass, 4 tests)
- `cargo test -p zen-mocap-engine take::tests:: --lib` (pass, 6 tests)

## Additional Next Up

- Turn 2 should emit `TimelineEditEvent` payloads directly from Sequencer keyframe actions (`source_id = sequencer-ui`) and persist them alongside take writes for replay/undo continuity.

## Additional Changes (Timeline Surface Contract)

- Added crates/zen-mocap-engine/resources/timeline_surface_contract.toml to bind timeline origins (sequencer-ui, hotkey, import, automation) to canonical timeline event sources.
- Added crates/zen-mocap-engine/src/timeline_surface_contract.rs with manifest validation + runtime resolver (timeline_event_source_for_origin).
- Added typed origin registry helpers in crates/zen-mocap-engine/src/timeline_batch.rs and reused them in policy-required-origin validation.
- Exported module from crates/zen-mocap-engine/src/lib.rs.

## Additional Verification (Timeline Surface Contract)

- cargo test -p zen-mocap-engine timeline_surface_contract::tests:: --lib (pass, 2 tests)
- cargo test -p zen-mocap-engine timeline_batch::tests:: --lib (pass, 4 tests)

## Additional Next Up

- Turn 2 should consume this contract when emitting TimelineEditEvent metadata from Sequencer keyframe operations, then persist event payloads with take saves.

## Additional Changes (Timeline Runtime Orchestration Contract)

- Added `crates/zen-mocap-engine/src/timeline_runtime.rs` with a single engine-owned API for atomic timeline edit execution + event emission.
- New runtime API composes `timeline_batch`, `timeline_event`, and `timeline_surface_contract` so origin-to-source mapping and event validation are enforced consistently.
- Added rollback semantics for downstream event failures and merged log validation failures, not just keyframe operation failures.
- Exported `timeline_runtime` module from `crates/zen-mocap-engine/src/lib.rs`.

## Additional Verification (Timeline Runtime Orchestration Contract)

- `cargo test -p zen-mocap-engine timeline_runtime::tests:: --lib` (pass, 3 tests)
- `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` (pass, 4 tests)

## Additional Next Up

- Route Sequencer keyframe actions through `TimelineRuntimeRequest` and persist returned events into take `timeline_edit_events` as the canonical edit ledger.

## Additional Changes (Timeline Bridge Contract)

- Added crates/zen-mocap-engine/resources/timeline_bridge_contract.toml to data-drive Sequencer action bindings for timeline edits.
- Added crates/zen-mocap-engine/src/timeline_bridge_contract.rs with typed action lookup APIs and manifest validation against 	imeline_edit and 	imeline_surface_contract.
- Exported 	imeline_bridge_contract from crates/zen-mocap-engine/src/lib.rs.

## Additional Verification (Timeline Bridge Contract)

- cargo test -p zen-mocap-engine timeline_bridge_contract::tests:: --lib (pass, 3 tests)
- cargo test -p zen-mocap-engine timeline_surface_contract::tests:: --lib (pass, 2 tests)
- cargo test -p zen-mocap-engine timeline_batch::tests:: --lib (pass, 4 tests)

## Additional Next Up

- Turn 2 should map Sequencer actions to this engine bridge contract and emit envelope/event payloads from action IDs.

## Additional Changes (Timeline Bridge Runtime Contract)

- Added `crates/zen-mocap-engine/src/timeline_bridge_runtime.rs` as a typed adapter from Sequencer action IDs to `TimelineRuntimeRequest`.
- Added strict operation-to-payload shape checks so action contracts fail fast when UI payloads drift from policy.
- Exported `timeline_bridge_runtime` via `crates/zen-mocap-engine/src/lib.rs`.

## Additional Verification (Timeline Bridge Runtime Contract)

- `cargo test -p zen-mocap-engine timeline_bridge_runtime::tests:: --lib` (pass, 3 tests)
- `cargo test -p zen-mocap-engine timeline_runtime::tests:: --lib` (pass, 3 tests)

## Additional Next Up

- Wire `src-mocap/features/Sequencer/useSequencer.ts` action emits to this adapter, then invoke runtime apply/persist via command boundary.

## Sequencer Runtime Flush Integration

- Added ACK-driven Sequencer queue dequeue semantics and runtime bridge error state controls.
- Wired ZenMocap to flush pending runtime requests through Tauri timeline command boundary.
- Aligned frontend runtime envelope serialization with backend contract.
- Verified with `npx tsc --noEmit` and `cargo check -p k-os-backend`.

## Sequencer Runtime Command Boundary

- Added `mocap_apply_timeline_runtime_requests` + `mocap_reset_timeline_runtime_state` in `src-tauri/src/mocap/mocap.rs` and registered both commands in `src-tauri/src/main.rs`.
- Added command-layer timeline runtime state registry to retain per-track runtime state and merged timeline event log across request commits.
- Extended `src-mocap/features/ZenMocap/MocapService.ts` with timeline runtime commit/reset APIs.
- Updated `src-mocap/features/ZenMocap/ZenMocap.tsx` queue flush to propagate bridge error state on backend commit failure.
- Expanded Vitest include patterns to run `src-mocap` tests and updated stale `timelineBridge` envelope assertion.

## Additional Changes (Timeline Runtime Take Persistence Boundary)

- Added `mocap_commit_timeline_runtime_to_take` in `src-tauri/src/mocap/mocap.rs` to persist runtime timeline events into take-owned `timeline_edit_events` with merge strategy (`append_unique`/`replace`) and optional runtime-state clear.
- Added `mocap_hydrate_timeline_runtime_from_take` to rebuild command-layer timeline state by replaying persisted take event logs.
- Added hydrate-time patch parity guardrail so corrupted/drifted event patches fail fast with explicit track/event diagnostics.
- Registered both commands in `src-tauri/src/main.rs`.
- Extended `src-mocap/features/ZenMocap/MocapService.ts` and `src-mocap/features/ZenMocap/hooks/useTakes.ts` to hydrate runtime state on take open and commit runtime events on take close.
- Extended `src-mocap/features/ZenMocap/types.ts` to include `timeline_edit_events` in `AnimationTake`.

## Additional Verification (Timeline Runtime Take Persistence Boundary)

- `cargo check -p zen-mocap-engine` (pass)
- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) (pass)
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (pass, 3 tests)
- `cargo check -p k-os-backend --manifest-path src-tauri/Cargo.toml` (fail, existing unrelated `KainDomain::Fluid` non-exhaustive match in `src-tauri/src/kain_commands.rs`)

## Additional Changes (Timeline Runtime Take Persistence Hardening)

- Hardened timeline runtime hydrate path in `src-tauri/src/mocap/mocap.rs` with persisted-patch parity validation during replay.
- Added `merge_strategy` to `TimelineRuntimeTakeCommitOptions` (`append_unique`/`replace`) for deterministic take-ledger ownership behavior.
- Updated ZenMocap take wiring (`useTakes.ts`, `ZenMocap.tsx`) to persist runtime ledgers with `replace` strategy on close/active-path flush.
- Added Rust tests covering hydrate patch mismatch rejection and valid replay acceptance.

## Additional Verification (Timeline Runtime Take Persistence Hardening)

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests:: --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> fail due existing unrelated `src-tauri/src/kain_commands.rs` (`KainDomain::Fluid` match arm missing).

## Additional Changes (Sequencer Session Take Ownership Contract)

- Added `src-mocap/features/ZenMocap/timelinePersistencePolicy.ts` to centralize timeline ACK/close persistence strategy and session take-path ownership behavior.
- Extended `src-mocap/features/ZenMocap/hooks/useTakes.ts` with `timelineCommitTakePath` and policy-driven ownership updates on open/close/rename/delete.
- Updated `src-mocap/features/ZenMocap/ZenMocap.tsx` runtime flush to persist by session-owned take target (not just open playback take state).

## Additional Verification (Sequencer Session Take Ownership Contract)

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `npx vitest run src-mocap/features/Sequencer/timelineBridge.test.ts src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir: `M:/K_OS`) -> pass (6 tests).

## Additional Changes (Timeline Runtime Diagnostics Surface)

- Added `mocap_get_timeline_runtime_diagnostics` in `src-tauri/src/mocap/mocap.rs` with typed report payload for active take binding health and runtime ledger stats.
- Registered diagnostics command in `src-tauri/src/main.rs`.
- Added `getTimelineRuntimeDiagnostics()` + `TimelineRuntimeDiagnosticsReport` in `src-mocap/features/ZenMocap/MocapService.ts`.
- Extended `src-mocap/features/ZenMocap/timelinePersistencePolicy.ts` with validated diagnostics refresh settings.
- Updated `src-mocap/features/ZenMocap/ZenMocap.tsx` + `ui/LiveLinkStatus.tsx` to fetch and display timeline runtime diagnostics in the STATUS panel.
- Added backend unit test `diagnostics_report_reflects_runtime_state` in `src-tauri/src/mocap/mocap.rs`.

## Additional Verification (Timeline Runtime Diagnostics Surface)

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test).

## Additional Changes (Timeline Runtime Diagnostics Hardening)

- Extended backend diagnostics payload in `src-tauri/src/mocap/mocap.rs`:
  - `track_keyframe_counts`,
  - `latest_event_timestamp_ms`,
  - `event_source_counts`.
- Updated diagnostics test `diagnostics_report_reflects_runtime_state` to assert new report fields.
- Updated frontend report typing in `src-mocap/features/ZenMocap/MocapService.ts`.
- Updated `src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx` to render timeline runtime ownership/ledger diagnostics and bridge queue drift context.
- Updated `src-mocap/features/ZenMocap/ZenMocap.tsx` to pass bridge diagnostics props and auto-open GPU Doctor on bridge errors.

## Additional Verification (Timeline Runtime Diagnostics Hardening)

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test).

## Additional Changes (Diagnostics Policy Frontend Parity)

- `src-mocap/features/ZenMocap/ZenMocap.tsx` now loads diagnostics policy via `mocap_get_timeline_runtime_diagnostics_policy` and applies manifest-driven refresh cadence.
- `src-mocap/features/ZenMocap/ui/LiveLinkStatus.tsx` and `src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx` now honor shared `field_visibility` policy flags when rendering timeline diagnostics.
- GPU Doctor now consumes parent-supplied timeline diagnostics snapshot, removing a redundant diagnostics invoke on panel open.

## Additional Verification (Diagnostics Policy Frontend Parity)

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir: `M:/K_OS`) -> pass (3 tests).

## Additional Changes (Manifest-Owned Timeline Diagnostics Policy)

- Added `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` as a shared diagnostics policy source (refresh + field visibility).
- Added `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with compile-time load/validation and exported it in `crates/zen-mocap-engine/src/lib.rs`.
- Added backend policy command `mocap_get_timeline_runtime_diagnostics_policy` and registered it in `src-tauri/src/main.rs`.
- Updated backend diagnostics report generation in `src-tauri/src/mocap/mocap.rs` to enforce policy visibility (redacted fields now follow manifest configuration).
- Updated frontend contracts and UI wiring (`MocapService.ts`, `ZenMocap.tsx`, `LiveLinkStatus.tsx`, `GpuDoctorPanel.tsx`) so both diagnostics surfaces consume the same backend-owned policy.
- Removed diagnostics refresh literals from `timelinePersistencePolicy.ts` to eliminate split policy ownership.

## Additional Verification (Manifest-Owned Timeline Diagnostics Policy)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass, 1 test)
- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass, 1 test)

## Additional Changes (Event-First Diagnostics + Drift Contract)

- Added diagnostics drift thresholds to `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` and typed validation in `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs`.
- Emitted `mocap://timeline_runtime_diagnostics_changed` from timeline runtime mutation commands in `src-tauri/src/mocap/mocap.rs`.
- Unified diagnostics snapshot construction in backend helper logic used for both command polling and event payloads.
- Updated `src-mocap/features/ZenMocap/ZenMocap.tsx` to refresh diagnostics event-first with policy polling fallback.
- Updated `src-mocap/features/ZenMocap/ui/LiveLinkStatus.tsx` and `ui/GpuDoctorPanel.tsx` to surface policy-driven queue-vs-ledger drift warnings.
- Updated `src-mocap/features/ZenMocap/MocapService.ts` diagnostics policy typing to include drift contract fields.

## Additional Verification (Event-First Diagnostics + Drift Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) (pass)
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (pass, 3 tests)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (fail, pre-existing unrelated `KainDomain` match exhaustiveness in `src-tauri/src/kain_commands.rs`)

## 2026-03-11 - Event-Driven Timeline Diagnostics Refresh

- Added backend diagnostics-change event emission (`mocap://timeline_runtime_diagnostics_changed`) across timeline runtime mutation commands.
- Switched ZenMocap diagnostics refresh to event-first in `ZenMocap.tsx`, keeping policy polling fallback.
- Fixed backend `KainDomain` registry mapping exhaustiveness (`Brush`, `Shader`) in `kain_commands.rs` to restore build/test path.

### Verification

- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx tsc --noEmit --pretty false` (pass)

## Additional Changes (Diagnostics Mutation Metadata Contract)

- Added diagnostics event metadata policy in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` under `[event]`.
- Extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with typed event policy validation.
- Updated `src-tauri/src/mocap/mocap.rs` to emit typed diagnostics-changed payloads with policy-controlled mutation metadata.
- Added frontend diagnostics payload coercion contract and tests in:
  - `src-mocap/features/ZenMocap/timelineDiagnosticsEvent.ts`
  - `src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts`
- Updated diagnostics UI consumers in `ZenMocap.tsx`, `LiveLinkStatus.tsx`, and `GpuDoctorPanel.tsx` to show latest mutation attribution.

## Additional Verification (Diagnostics Mutation Metadata Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` (pass)
- `npx tsc --noEmit` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (failed: unrelated `KainDomain::Procedural` non-exhaustive match in `src-tauri/src/kain_commands.rs`)

## Additional Next Up

- Add policy-matrix tests for diagnostics metadata/visibility rendering and fallback behavior.
- Consolidate diagnostics mutation reason IDs into a shared typed contract to prevent policy/command drift.

## Additional Changes (Diagnostics Event Contract Stabilization)

- Fixed `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` to keep one valid diagnostics event policy table.
- Updated diagnostics event payload building in `src-tauri/src/mocap/mocap.rs` so out-of-policy mutation reasons now fall back deterministically to the policy default reason.
- Updated backend event-policy test expectation to assert fallback reason behavior.
- Added missing `KainDomain::Procedural` mapping in `src-tauri/src/kain_commands.rs` to keep source registry mapping exhaustive.

## Additional Verification (Diagnostics Event Contract Stabilization)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` (pass)


## Additional Changes (Diagnostics Reason Taxonomy Contract)

- Added `event.reason_catalog` to `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` with policy-owned reason label/severity/action metadata.
- Extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with typed reason descriptors, loader validation, and descriptor lookup.
- Extended backend diagnostics event payload in `src-tauri/src/mocap/mocap.rs` with `mutation.reason_detail` sourced from policy.
- Updated frontend contracts/parser/UI (`MocapService.ts`, `timelineDiagnosticsEvent.ts`, `LiveLinkStatus.tsx`, `GpuDoctorPanel.tsx`, `ZenMocap.tsx`) to render policy-driven reason metadata.

## Additional Verification (Diagnostics Reason Taxonomy Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` (pass)
- `npx tsc --noEmit` (pass)


## Additional Changes (Diagnostics Policy-Matrix UI + Reason Parity Guard)

- Extracted fallback diagnostics policy from `ZenMocap.tsx` into `src-mocap/features/ZenMocap/timelineDiagnosticsFallbackPolicy.ts`.
- Added `src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts` to enforce reason-ID parity between frontend fallback policy and engine TOML policy contract.
- Added `src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` to validate diagnostics field-visibility and reason metadata rendering parity across STATUS and GPU Doctor.
- Added `@mocap` alias in `vitest.config.ts` so mocap UI tests resolve correctly.

## Additional Verification (Diagnostics Policy-Matrix UI + Reason Parity Guard)

- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` (pass, 3 tests)
- `npx tsc --noEmit` (pass)

## Additional Changes (Diagnostics Reason Trend Contract)

- Added `[trend]` policy fields (`reason_history_limit`, `top_reason_count`) and `show_recent_reason_counts` visibility control to `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with typed trend policy + validation.
- Extended `src-tauri/src/mocap/mocap.rs` diagnostics report with `recent_reason_counts` and policy-bounded reason-history tracking.
- Updated frontend diagnostics contracts/UI (`MocapService.ts`, `timelineDiagnosticsEvent.ts`, `LiveLinkStatus.tsx`, `GpuDoctorPanel.tsx`) to render trend counts with policy visibility gating.
- Extended diagnostics parity/matrix test coverage (`timelineDiagnosticsPolicyParity.test.ts`, `timelineDiagnosticsPolicyMatrix.test.tsx`) for trend-field alignment and visibility behavior.
- Added `KainDomain::Kainscript` handling in `src-tauri/src/kain_commands.rs` to restore backend compilation path for focused mocap tests.

## Additional Verification (Diagnostics Reason Trend Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` (pass)
- `npx tsc --noEmit` (pass)

## Additional Changes (Diagnostics Trend Escalation Contract + Shared Formatter)

- Extended diagnostics trend policy usage with explicit escalation thresholds consumed by backend/frontend contracts (`default_warn_count`, `default_error_count`, per-reason threshold map).
- Extended backend diagnostics report payload with `recent_reason_trends` so trend severity/action guidance is emitted as structured data.
- Added shared frontend trend contract (`timelineReasonTrend.ts`) and unified STATUS + GPU Doctor trend rendering through it.
- Extended fallback parity and UI policy-matrix tests to validate trend threshold parity and formatted trend output.

## Additional Verification (Diagnostics Trend Escalation Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` (pass)
- `npx tsc --noEmit` (pass)

## Additional Next Up

- Emit trend severity deltas in diagnostics-changed event payloads and add trend cooldown/decay policy for rolling severity behavior.

## Additional Changes (Diagnostics Event Trend Summary Contract)

- Added event-level diagnostics trend summary policy controls in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` and locked them in `timeline_runtime_diagnostics_policy.rs` validation.
- Extended Tauri diagnostics event payload (`src-tauri/src/mocap/mocap.rs`) with `mutation.trend_summary` for minimum/highest severity, escalated reason count, and top escalated trends.
- Updated frontend diagnostics contracts/parsing (`MocapService.ts`, `timelineDiagnosticsEvent.ts`) and UI surfaces (`ui/LiveLinkStatus.tsx`, `ui/GpuDoctorPanel.tsx`) to consume and display trend escalation summaries.
- Extended diagnostics parity and matrix tests to guard schema and render behavior for trend summary metadata.

## Additional Verification (Diagnostics Event Trend Summary Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts` (pass)
- `npx tsc --noEmit` (pass)

## Additional Next Up

- Add backend/frontend command-level parity tests for trend summary severity/action synthesis on shared synthetic snapshots.
- Add policy-driven trend cooldown/decay windows so escalation can decay over time instead of remaining elevated indefinitely.

## Additional Changes (Diagnostics Event Trend Summary Severity Floor)

- Added `event.trend_summary_min_severity = "warn"` to `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` to load/validate trend summary minimum severity.
- Updated `src-tauri/src/mocap/mocap.rs` to emit trend summaries with `minimum_severity` and policy-floor severity filtering.
- Updated frontend diagnostics schema/parsing/fallback parity (`MocapService.ts`, `timelineDiagnosticsEvent.ts`, `timelineDiagnosticsFallbackPolicy.ts`, `timelineDiagnosticsPolicyParity.test.ts`).
- Updated `ZenMocap.tsx` to trigger immediate GPU Doctor callout on escalated trend summary events.

## Additional Verification (Diagnostics Event Trend Summary Severity Floor)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` (pass)
- `npx tsc --noEmit` (pass)

## Additional Next Up

- Add backend/frontend synthetic snapshot parity tests for trend severity/action output.
- Add manifest-owned trend cooldown/decay windows for automatic post-spike de-escalation.

## Diagnostics Trend Decay + Cooldown Windows (2026-03-12)

- Added manifest-driven trend windows (`decay_window_ms`, `cooldown_window_ms`) to ZenMocap diagnostics policy.
- Switched backend mutation-reason history to timestamped entries and window-aware trend synthesis.
- Added diagnostics report metadata (`generated_at_ms`, `recent_reason_last_seen_ms`) for deterministic parity.
- Added cooldown-aware frontend trend resolver behavior and synced fallback policy contract.
- Added focused backend/frontend tests to lock cooldown de-escalation behavior.

## 2026-03-12 - Diagnostics Trend Decay/Cooldown Policy Parity

- Added manifest-owned diagnostics trend windows (`decay_window_ms`, `cooldown_window_ms`) in `timeline_runtime_diagnostics_policy.toml`.
- Extended Rust diagnostics policy schema/validation to include trend window constraints.
- Synced frontend fallback diagnostics policy with manifest trend windows and removed duplicate conflicting literals.
- Expanded parity tests and diagnostics UI policy fixture contracts for trend-window coverage.

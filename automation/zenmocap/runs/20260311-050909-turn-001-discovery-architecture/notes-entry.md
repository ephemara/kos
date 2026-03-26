# ZenMocap Closed Loop Note

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture

## Summary

- Established a data-driven rig topology contract in `zen-mocap-engine`, replacing hardcoded GPU topology arrays in the session hot path.

## Detailed Notes

- Added `rig_topology_manifest.toml` with keypoint-count bindings to named topology profiles.
- Implemented manifest parsing + validation in `src/rig/topology.rs` and wired `session.rs` to resolve by model keypoint count.
- This gives a coherent extension point for additional model families and retarget profiles without pipeline rewrites.

## Evidence

- `cargo test -p zen-mocap-engine topology --lib` passed (2 tests).
## Additional Notes (This Run)

- Added `animator_plan.rs` as a durable discovery contract that captures prioritized ZenMocap vertical slices and ownership boundaries.
- Added validation tests that ensure referenced Kain supermotion mode IDs remain valid against engine registry data.
- Targeted verification command failed due to existing compile errors in `rig/mod.rs` before new tests could run.

## Additional Notes (Animator Plan)

- Added `src/animator_plan.rs` to formalize discovery outputs in an engine-owned typed contract.
- The plan explicitly prioritizes reusable keyframe editing infrastructure before deeper retarget/runtime features.
- Verification: `cargo test -p zen-mocap-engine animator_plan::tests:: --lib` passed (2 tests).

## Additional Notes (Timeline Edit Contract)

- Added `src/timeline_edit.rs` as a typed engine-side keyframe edit boundary with reversible patch support (`apply_keyframe_edit`, `revert_keyframe_edit`).
- Added `resources/keyframe_edit_policy.toml` and compile-time manifest validation so frame limits, enabled interpolation modes, and operation toggles are data-driven.
- This establishes the contract required to move Sequencer edits from local hook mutations into engine-owned operations on turn 2.

## Additional Evidence (Timeline Edit Contract)

- `cargo test -p zen-mocap-engine timeline_edit::tests:: --lib` passed (5 tests).

## Additional Notes (Live Retarget Contract Hardening)

- Shifted live/offline retarget compatibility from hardcoded `keypoints == 17` checks into the topology manifest contract.
- Added typed contract fields to topology profiles for required reliable joints and threshold settings, then consumed those settings in `RigRetargeter`.
- Session and video analyzer now both resolve topology and contract through one engine-owned path, reducing drift between runtime surfaces.
- GPU-chain capacity and topology upload are now model/profile-driven in both live and offline paths.

## Additional Evidence

- `cargo test -p zen-mocap-engine rig::topology::tests:: --lib` passed (2 tests).
- `cargo test -p zen-mocap-engine video_analyzer::tests::analyze_rejects_models_without_live_retarget_topology_contract --lib` passed (1 test).

## Additional Notes (Unified Retarget Contract Resolver)

- Added `resolve_retarget_contract` and `RetargetSurface` in `crates/zen-mocap-engine/src/rig/mod.rs` so topology + live-retarget compatibility is resolved through one engine contract.
- Updated both `session.rs` and `video_analyzer.rs` to consume this shared resolver instead of duplicating compatibility checks.
- Added resolver tests for manifest-backed resolution and unknown-layout rejection to lock in behavior.

## Additional Evidence (Unified Retarget Contract Resolver)

- `cargo test -p zen-mocap-engine rig::tests:: --lib` passed (2 tests).
- `cargo test -p zen-mocap-engine video_analyzer::tests::analyze_rejects_models_without_live_retarget_topology_contract --lib` passed (1 test).

## Additional Notes (Take Validation Contract)

- Added manifest-backed take validation rules in `crates/zen-mocap-engine/resources/take_validation_policy.toml`.
- Added typed take validation reporting in `crates/zen-mocap-engine/src/take.rs` and enforced validation in both save/load code paths.
- Added checks for model-id manifest compatibility, frame/duration consistency, sequence + timestamp ordering, tags, and joint/rotation payload shape.

## Additional Evidence (Take Validation Contract)

- `cargo test -p zen-mocap-engine take::tests:: --lib` passed (5 tests).

## Additional Notes (Timeline Batch Contract)

- Added `crates/zen-mocap-engine/src/timeline_batch.rs` as a transactional timeline-edit envelope contract on top of `timeline_edit` operations.
- Added manifest-backed policy in `crates/zen-mocap-engine/resources/timeline_batch_policy.toml` for operation batch limits, allowed edit origins, and Kain-supermotion mode override constraints.
- `apply_timeline_edit_batch` now provides atomic apply-or-rollback behavior, preventing partially-applied UI mutation sequences when one operation fails.
- This closes a core architecture gap for next-turn Sequencer integration by giving frontend and engine one deterministic batch boundary.

## Additional Evidence (Timeline Batch Contract)

- `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` passed (4 tests).
- `cargo test -p zen-mocap-engine timeline_edit::tests:: --lib` passed (5 tests).

## Additional Notes (Timeline Event Ledger Contract)

- Added `crates/zen-mocap-engine/src/timeline_event.rs` to establish an engine-owned, typed event envelope for timeline edits (`op` + reversible patch + source/timestamp/session-frame metadata).
- Added `crates/zen-mocap-engine/resources/timeline_event_policy.toml` to externalize event log constraints (source registry, session frame bounds, per-take/per-track limits, timestamp monotonicity).
- Extended `crates/zen-mocap-engine/src/take.rs` with `timeline_edit_events` (serde-defaulted for backward compatibility) and integrated timeline event validation into `validate_take`.
- Added take validation coverage proving event logs that target frames outside take bounds are rejected with typed issue codes.

## Additional Evidence (Timeline Event Ledger Contract)

- `cargo test -p zen-mocap-engine timeline_event::tests:: --lib` passed (4 tests).
- `cargo test -p zen-mocap-engine take::tests:: --lib` passed (6 tests).

## Additional Notes (Timeline Surface Contract)

- Added timeline_surface_contract.toml and a typed resolver module so timeline batch origins and timeline event sources stay synchronized through one manifest-owned contract.
- This closes a drift risk before Sequencer integration: turn-2 UI wiring can now resolve event source IDs by typed origin instead of embedding string literals across frontend/command boundaries.
- Also promoted timeline origin IDs to shared typed API (TimelineEditOrigin::ALL + from_policy_id) so both policy validation and boundary adapters use one registry.

## Additional Evidence (Timeline Surface Contract)

- cargo test -p zen-mocap-engine timeline_surface_contract::tests:: --lib passed (2 tests).
- cargo test -p zen-mocap-engine timeline_batch::tests:: --lib passed (4 tests).

## Additional Notes (Timeline Runtime Orchestration Contract)

- Added `crates/zen-mocap-engine/src/timeline_runtime.rs` to close the integration gap between batch edits and event persistence.
- `apply_timeline_runtime_request` now provides one atomic runtime boundary for:
  - batch application,
  - origin-to-source event resolution,
  - event emission,
  - merged event-log validation,
  - and full keyframe rollback on downstream failure.
- This reduces contract drift risk before Sequencer integration by preventing callers from manually composing `timeline_batch` + `timeline_event` in inconsistent ways.

## Additional Evidence (Timeline Runtime Orchestration Contract)

- `cargo test -p zen-mocap-engine timeline_runtime::tests:: --lib` passed (3 tests).
- `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` passed (4 tests).

## Additional Notes (Timeline Bridge Contract)

- Added 	imeline_bridge_contract.toml and src/timeline_bridge_contract.rs in zen-mocap-engine to formalize Sequencer action -> (origin, keyframe operation, event source) bindings.
- Contract validation now guarantees Sequencer action mappings stay aligned with both 	imeline_edit enabled operations and 	imeline_surface_contract source routing.
- This removes string-literal drift risk before turn-2 Sequencer integration and gives UI/runtime one typed action registry to share.

## Additional Evidence (Timeline Bridge Contract)

- cargo test -p zen-mocap-engine timeline_bridge_contract::tests:: --lib passed (3 tests).
- cargo test -p zen-mocap-engine timeline_surface_contract::tests:: --lib passed (2 tests).
- cargo test -p zen-mocap-engine timeline_batch::tests:: --lib passed (4 tests).

## Additional Notes (Timeline Bridge Runtime Contract)

- Added `crates/zen-mocap-engine/src/timeline_bridge_runtime.rs` to map Sequencer action commands into validated timeline runtime envelopes/requests.
- Action IDs now resolve through `timeline_bridge_contract` and enforce operation/payload compatibility before timeline mutation.
- This provides a clean ownership seam for upcoming Sequencer runtime wiring without hardcoded origin/operation mapping in UI hooks.

## Additional Evidence (Timeline Bridge Runtime Contract)

- `cargo test -p zen-mocap-engine timeline_bridge_runtime::tests:: --lib` passed (3 tests).
- `cargo test -p zen-mocap-engine timeline_runtime::tests:: --lib` passed (3 tests).

## Sequencer Runtime Flush Integration

- Integrated Sequencer pending-request flush into ZenMocap root runtime flow (`ZenMocap.tsx`) using `mocap_apply_timeline_runtime_requests`.
- Queue draining is now ACK-based (`acknowledgeTimelineRuntimeRequests`) and bridge errors are surfaced via `setTimelineBridgeError`.
- Adjusted timeline runtime envelope fields to Rust serde names/types (`origin`, numeric `requested_supermotion_mode_id`).
- Verification: `npx tsc --noEmit` pass, `cargo check -p k-os-backend` pass.

## Discovery Slice: Sequencer Runtime Command Boundary

- Added backend command `mocap_apply_timeline_runtime_requests` to apply queued sequencer runtime requests through `zen-mocap-engine` timeline runtime contracts.
- Added process-local `TimelineRuntimeState` (per-track state + merged event log) and reset command `mocap_reset_timeline_runtime_state`.
- Wired `MocapService.applyTimelineRuntimeRequests` and front-end flush handling to expose bridge commit failures in hook state.
- Expanded Vitest include scope to execute `src-mocap` tests directly.
- Verification: `npx vitest run src-mocap/features/Sequencer/timelineBridge.test.ts`, `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts`, `npx tsc --noEmit`, `cargo check -p k-os-backend --manifest-path src-tauri/Cargo.toml`.

## Discovery Slice: Timeline Runtime Take Persistence Boundary

- Added command-layer persistence/hydration boundaries in `src-tauri/src/mocap/mocap.rs` for timeline runtime state:
  - take commit command persists runtime event logs into take-owned `timeline_edit_events` with merge strategy support.
  - take hydrate command replays persisted events back into runtime track state and verifies patch parity.
- Wired command registration in `src-tauri/src/main.rs` and frontend service/hook integration in `MocapService.ts` + `useTakes.ts` so take open/close now hydrates/persists timeline runtime state.
- Extended frontend take contract in `types.ts` to include `timeline_edit_events` for explicit replay-aware ownership.

## Verification

- `cargo check -p zen-mocap-engine` -> pass.
- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` -> pass (3 tests).
- `cargo check -p k-os-backend --manifest-path src-tauri/Cargo.toml` -> fail (pre-existing unrelated `KainDomain::Fluid` non-exhaustive match in `src-tauri/src/kain_commands.rs`).

## Discovery Slice: Timeline Runtime Take Persistence Hardening

- Added hydrate replay parity enforcement in `src-tauri/src/mocap/mocap.rs`; persisted timeline events now fail hydrate when replay patch state diverges.
- Added typed merge strategy in `TimelineRuntimeTakeCommitOptions` so runtime-to-take persistence can be `append_unique` or canonical `replace`.
- Updated ZenMocap take lifecycle wiring to commit with `replace` on active take close and to opportunistically persist after runtime ACK when an active take path is known.
- Added targeted Rust tests for hydrate mismatch rejection and successful replay hydration.

## Verification

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests:: --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> fail (existing unrelated `KainDomain::Fluid` non-exhaustive match in `src-tauri/src/kain_commands.rs`).

## Discovery Slice: Sequencer Session Take Ownership Contract

- Added `src-mocap/features/ZenMocap/timelinePersistencePolicy.ts` as a single policy contract for timeline runtime persistence behavior (`ack_commit`, `close_take_commit`, and `session_take_path` ownership semantics).
- Introduced `timelineCommitTakePath` in `src-mocap/features/ZenMocap/hooks/useTakes.ts` so timeline runtime ACK persistence no longer depends on `activeTakePath` visibility.
- `openTake` now hydrates runtime state and registers active runtime take ownership; rename/delete lifecycle now rebinds or clears ownership consistently.
- `closeTake` now uses policy-driven commit options and can retain sequencer session ownership for subsequent runtime ACK commits.
- Updated `src-mocap/features/ZenMocap/ZenMocap.tsx` to persist ACKed runtime events through `timelineCommitTakePath` using policy merge strategy.

## Verification

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `npx vitest run src-mocap/features/Sequencer/timelineBridge.test.ts src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir: `M:/K_OS`) -> pass (6 tests).

## Discovery Slice: Timeline Runtime Diagnostics Surface

- Added backend runtime diagnostics command in `src-tauri/src/mocap/mocap.rs` (`mocap_get_timeline_runtime_diagnostics`) so timeline ownership and ledger health are queryable from one typed boundary.
- Added typed diagnostics payload fields for active take binding, take-exists status, active track count/IDs, and timeline event-log size.
- Registered command in `src-tauri/src/main.rs` and exposed typed frontend API in `src-mocap/features/ZenMocap/MocapService.ts`.
- Extended `timelinePersistencePolicy.ts` with a data-driven diagnostics refresh policy (`enabled`, `refresh_interval_ms`) and validation.
- Wired `ZenMocap.tsx` status flow to poll diagnostics using policy settings and render the report in `LiveLinkStatus.tsx` (BOUND/MISSING/NONE + track/event counts).
- Added backend unit test coverage for diagnostics snapshot semantics (`diagnostics_report_reflects_runtime_state`).

## Verification

- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test).

## Discovery Slice: Timeline Runtime Diagnostics Hardening

- Expanded `TimelineRuntimeDiagnosticsReport` in `src-tauri/src/mocap/mocap.rs` with richer ledger observability (`track_keyframe_counts`, `latest_event_timestamp_ms`, `event_source_counts`).
- Preserved a single command-owned diagnostics seam (`mocap_get_timeline_runtime_diagnostics`) and extended diagnostics test assertions for new fields.
- Updated `src-mocap/features/ZenMocap/MocapService.ts` report typing to keep frontend/backend diagnostics contracts aligned.
- Wired `src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx` to fetch and render runtime diagnostics (active take binding, pending queue size, source histogram, per-track keyframe counts, last event timestamp).
- Extended `GpuDoctorPanel` + `ZenMocap.tsx` integration to treat Sequencer bridge failures as first-class diagnostics signals and auto-open diagnostics when bridge errors appear.

## Verification

- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test).

## Discovery Slice: Diagnostics Policy Frontend Parity

- Wired `ZenMocap.tsx` to fetch `TimelineRuntimeDiagnosticsPolicy` from Tauri and use policy-owned `refresh.interval_ms` for diagnostics polling cadence.
- Updated diagnostics UI integration so both `LiveLinkStatus.tsx` and `GpuDoctorPanel.tsx` consume shared diagnostics policy visibility flags.
- Removed duplicate diagnostics fetch path from GPU Doctor open flow by passing parent-owned diagnostics snapshot into the panel.

## Verification

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir: `M:/K_OS`) -> pass (3 tests).

## Discovery Slice: Manifest-Owned Timeline Diagnostics Policy

- Added a shared diagnostics policy manifest in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` to own refresh cadence and diagnostics field visibility outside frontend literals.
- Added typed loader/validator module `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` and exported it from `lib.rs`.
- Updated backend command layer (`src-tauri/src/mocap/mocap.rs`) to:
  - expose policy via `mocap_get_timeline_runtime_diagnostics_policy`,
  - apply policy visibility redaction in `mocap_get_timeline_runtime_diagnostics`.
- Registered the new command in `src-tauri/src/main.rs`.
- Updated frontend contracts and surfaces:
  - `MocapService.ts` now fetches policy,
  - `ZenMocap.tsx` drives diagnostics polling via policy refresh interval,
  - `LiveLinkStatus.tsx` and `GpuDoctorPanel.tsx` gate field rendering by policy visibility.
- Removed diagnostics cadence literals from `timelinePersistencePolicy.ts` to avoid split ownership.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass.
- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass.

## Discovery Slice: Event-First Diagnostics + Drift Contract

- Added drift-threshold ownership to the shared engine diagnostics policy (`timeline_runtime_diagnostics_policy.toml` + typed drift policy in `timeline_runtime_diagnostics_policy.rs`) so warning behavior is data-driven, not component literals.
- Added backend diagnostics-changed event emission (`mocap://timeline_runtime_diagnostics_changed`) from timeline runtime mutation commands in `src-tauri/src/mocap/mocap.rs`.
- Refactored diagnostics report generation to one backend helper used by both polling command and emitted event payloads.
- Updated `ZenMocap.tsx` diagnostics flow to consume event payloads immediately and preserve policy interval polling as a resilience fallback.
- Updated `LiveLinkStatus.tsx` and `GpuDoctorPanel.tsx` to evaluate queue-vs-ledger drift via policy thresholds using pending request count and diagnostics ledger size.
- Updated diagnostics policy TS contract in `MocapService.ts` with `drift.warn_pending_request_count` and `drift.warn_queue_vs_ledger_gap`.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass.
- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) -> pass.
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` -> pass (3 tests).
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> fail on existing unrelated `src-tauri/src/kain_commands.rs` `KainDomain` match exhaustiveness.

## Discovery Slice: Event-Driven Timeline Diagnostics Refresh

- Emitted `mocap://timeline_runtime_diagnostics_changed` from timeline runtime mutation commands in `src-tauri/src/mocap/mocap.rs`.
- Reused the backend diagnostics report builder as event payload to preserve policy-based field visibility/redaction parity.
- Updated `src-mocap/features/ZenMocap/ZenMocap.tsx` to listen for diagnostics-changed events and refresh immediately, while keeping policy interval polling as fallback.
- Unblocked backend verification by adding exhaustive `KainDomain::Brush` and `KainDomain::Shader` mapping arms in `src-tauri/src/kain_commands.rs`.

## Verification

- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `npx tsc --noEmit --pretty false` (workdir: `M:/K_OS`) -> pass

## Additional Notes (Diagnostics Mutation Metadata Contract)

- Added a manifest-owned diagnostics event metadata contract in `timeline_runtime_diagnostics_policy.toml` (`[event]`) to control reason/timestamp emission and allowed mutation reason IDs from one source.
- Extended policy loader validation in `timeline_runtime_diagnostics_policy.rs` to enforce non-empty, unique `allowed_reasons`.
- Added typed diagnostics-changed backend payload (`{ report, mutation }`) in `src-tauri/src/mocap/mocap.rs` and policy-gated reason/timestamp redaction.
- Added frontend compatibility adapter `timelineDiagnosticsEvent.ts` + tests so ZenMocap supports both structured payloads and legacy report-only events without regressions.
- Wired `ZenMocap.tsx`, `LiveLinkStatus.tsx`, and `GpuDoctorPanel.tsx` to show latest diagnostics mutation reason/time for runtime attribution.

## Additional Evidence (Diagnostics Mutation Metadata Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed (1 test).
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` passed (3 tests).
- `npx tsc --noEmit` passed.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` failed on existing unrelated `KainDomain::Procedural` non-exhaustive match in `src-tauri/src/kain_commands.rs`.

## Additional Notes (Diagnostics Event Contract Stabilization)

- Corrected diagnostics policy manifest shape by consolidating to one `[event]` section and explicit allowed reason IDs.
- Hardened backend diagnostics event payload behavior so unknown mutation reasons normalize to a policy fallback reason instead of disappearing.
- Added adjacent compile unblock in `src-tauri/src/kain_commands.rs` for `KainDomain::Procedural`, restoring focused backend testability for mocap command surfaces.

## Additional Evidence (Diagnostics Event Contract Stabilization)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed.
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` passed.


## Additional Notes (Diagnostics Reason Taxonomy Contract)

- Implemented a manifest-backed diagnostics reason taxonomy in `timeline_runtime_diagnostics_policy.toml` (`event.reason_catalog`) so reason presentation metadata is engine-owned data, not UI heuristics.
- Added strict schema checks in `timeline_runtime_diagnostics_policy.rs` for reason catalog integrity (unique IDs, severity enum, non-empty label/action, and exact allowlist parity).
- Updated backend diagnostics-changed payload metadata in `mocap.rs` to include `reason_detail` from policy lookup.
- Updated frontend type/parsing/UI flow to consume and render policy reason descriptors in STATUS and GPU Doctor.

## Additional Evidence (Diagnostics Reason Taxonomy Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed (1 test).
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` passed (3 tests).
- `npx tsc --noEmit` passed.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).


## Additional Notes (Diagnostics Policy-Matrix UI + Reason Parity Guard)

- Extracted fallback diagnostics policy into `src-mocap/features/ZenMocap/timelineDiagnosticsFallbackPolicy.ts` so fallback reason definitions are centralized and reusable.
- Added `timelineDiagnosticsPolicyParity.test.ts` to compare fallback policy reason IDs against `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Added component-level diagnostics policy-matrix test coverage in `ui/timelineDiagnosticsPolicyMatrix.test.tsx` for STATUS/GPU Doctor visibility gating and reason metadata rendering.
- Added `@mocap` resolve alias in `vitest.config.ts` to unblock mocap component tests under Vitest.

## Additional Evidence (Diagnostics Policy-Matrix UI + Reason Parity Guard)

- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` passed (3 tests).
- `npx tsc --noEmit` passed.

## Additional Notes (Diagnostics Reason Trend Contract)

- Added a manifest-owned diagnostics trend contract (`[trend]`) and policy visibility flag (`show_recent_reason_counts`) so reason-trend rendering is data-driven.
- Added backend trend accounting in `src-tauri/src/mocap/mocap.rs` using bounded runtime reason history and deterministic top-count reporting in diagnostics snapshots.
- Updated frontend diagnostics contracts/parsers/UI to consume `recent_reason_counts` with backward-compatible payload coercion.
- Added parity/policy-matrix tests for new trend fields and visibility behavior.
- Unblocked backend mocap verification by adding `KainDomain::Kainscript` source mapping in `src-tauri/src/kain_commands.rs`.

## Additional Evidence (Diagnostics Reason Trend Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed (1 test).
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` passed (9 tests).
- `npx tsc --noEmit` passed.

## Additional Notes (Diagnostics Trend Escalation Contract + Shared Formatter)

- Added a manifest-backed escalation contract for diagnostics reason trends and wired it across engine policy, backend report generation, and frontend diagnostics rendering.
- Backend diagnostics now emit structured trend entries (`recent_reason_trends`) with policy-derived severity and action guidance, reducing UI-side heuristics.
- Added a shared frontend resolver/formatter (`timelineReasonTrend.ts`) so STATUS and GPU Doctor present the same trend semantics.
- Expanded policy parity and UI matrix tests to prevent trend-threshold and formatting drift.

## Additional Evidence (Diagnostics Trend Escalation Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed.
- `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` passed (8 tests).
- `npx tsc --noEmit` passed.

## Additional Notes (Diagnostics Event Trend Summary Contract)

- Added policy-owned event trend summary controls (`include_trend_summary`, `trend_summary_min_severity`, `trend_summary_top_count`) so diagnostics escalation metadata is contract-driven.
- Backend diagnostics-changed payload now includes `mutation.trend_summary` with minimum/highest severity, escalated reason count, and top escalated reason trends.
- STATUS and GPU Doctor now render immediate escalation summaries from event metadata, improving high-severity visibility without poll lag.
- Frontend parser and fallback policy parity checks were updated to keep summary schema aligned with engine policy.

## Additional Evidence (Diagnostics Event Trend Summary Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts` (pass)
- `npx tsc --noEmit` (pass)

## Additional Notes (Diagnostics Event Trend Summary Severity Floor)

- Added manifest-owned `event.trend_summary_min_severity` to diagnostics policy and validated it in `timeline_runtime_diagnostics_policy.rs`.
- Updated backend diagnostics event payload to include `trend_summary.minimum_severity` and severity-floor filtering before top-count truncation.
- Updated frontend diagnostics contract/parsing and fallback parity tests so trend summary payload shape remains aligned with engine policy.
- Updated ZenMocap event listener to trigger immediate GPU Doctor callout when trend summary escalates above info.

## Additional Evidence (Diagnostics Event Trend Summary Severity Floor)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed.
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` passed (11 tests).
- `npx tsc --noEmit` passed.

## Diagnostics Trend Decay + Cooldown Windows Contract

- Added policy-owned trend windows in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`:
  - `trend.decay_window_ms = 300000`
  - `trend.cooldown_window_ms = 120000`
- Extended engine policy validation in `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` so trend windows are bounded and coherent.
- Refactored backend diagnostics history in `src-tauri/src/mocap/mocap.rs` to timestamped reason entries and windowed trend computation.
- Added backend diagnostics report fields: `generated_at_ms` and `recent_reason_last_seen_ms`.
- Updated frontend contracts/resolver in `src-mocap/features/ZenMocap/MocapService.ts` and `timelineReasonTrend.ts` to apply cooldown de-escalation when recomputing trends from counts.
- Updated fallback policy + parity test in `timelineDiagnosticsFallbackPolicy.ts` and `timelineDiagnosticsPolicyParity.test.ts`.
- Added cooldown-focused tests:
  - Rust: `diagnostics_report_applies_trend_cooldown_window`
  - TS: `timelineReasonTrend.test.ts` cooldown case

Verification:
- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_applies_trend_cooldown_window --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts` (pass)
- `npx tsc --noEmit` (pass)

## 2026-03-12 - Diagnostics Trend Decay/Cooldown Policy Parity

- Aligned diagnostics trend window contracts across manifest, Rust policy schema, and frontend fallback/parity surfaces.
- Added `trend.decay_window_ms` and `trend.cooldown_window_ms` to engine policy manifest and validation.
- Removed duplicate fallback trend-window literals and expanded parity tests so fallback policy cannot drift from manifest windows.
- Updated diagnostics policy-matrix fixture contract to include trend windows.
- Verification passed for focused engine policy test, backend cooldown behavior test, relevant frontend vitest suites, and TypeScript compile.

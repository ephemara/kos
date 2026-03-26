# ZenMocap Run Handoff

Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Agent: Scope Architect

## What Changed

- Replaced hardcoded COCO-17 GPU topology arrays in `zen-mocap-engine` session runtime with a data-driven manifest registry.
- Added `resources/rig_topology_manifest.toml` with typed keypoint-to-profile bindings and the `coco17_live_v1` profile.
- Added `src/rig/topology.rs` loader/validator/tests to enforce profile integrity (binding presence, lengths, parent-index bounds, keypoint compatibility).
- Wired `session.rs` to resolve topology profile by model keypoint count and emit clear runtime error when no profile exists.
- Added topology identifier to startup logs so runtime behavior is traceable per profile.

## Touched Paths

- `M:/K_OS/crates/zen-mocap-engine/resources/rig_topology_manifest.toml`
- `M:/K_OS/crates/zen-mocap-engine/src/rig/topology.rs`
- `M:/K_OS/crates/zen-mocap-engine/src/rig/mod.rs`
- `M:/K_OS/crates/zen-mocap-engine/src/session.rs`

## Verification

- Commands:
  - `cargo test -p zen-mocap-engine topology --lib`
- Result:
  - Pass (2 tests):
    - `rig::topology::tests::has_coco17_profile_binding`
    - `rig::topology::tests::unknown_keypoint_layout_returns_none`

## Blockers

- No blocking failures in this slice.
- Remaining product blocker (known): live retarget path is still constrained to COCO-17 models only.

## Recommended Next Targets

- Animator turn should consume this manifest pattern by introducing a data-driven keyframe/timeline operation registry (snap mode, interpolation mode, per-track constraints) instead of embedding policy in component-level conditionals.
- Add a first pass of retarget profile selection in UI/session config (`retarget_profile_id`) and map it to this topology registry, preparing for non-COCO model families.
- Add integration test coverage for startup failure mode when a model keypoint layout has no topology binding.

## Additional Discovery Slice (This Run)

- Added `M:/K_OS/crates/zen-mocap-engine/src/animator_plan.rs` as an engine-owned, typed discovery backlog contract aligned to next-turn animator execution.
- Exported module from `M:/K_OS/crates/zen-mocap-engine/src/lib.rs`.
- Added integrity tests for slice ordering/uniqueness and Kain supermotion mode-ID alignment.

### Additional Verification

- Command: `cargo test -p zen-mocap-engine animator_plan::tests:: --lib`
- Result: failed before test execution due to existing compile errors in `M:/K_OS/crates/zen-mocap-engine/src/rig/mod.rs` (`E0753` inner doc comments).

### Additional Recommended Next Target

- Implement `timeline-keyframe-edit-ops` first on turn 2 using the new `animator_plan` contract as the source of truth.

## Additional Discovery Contract Update (Animator Plan)

- Added `M:/K_OS/crates/zen-mocap-engine/src/animator_plan.rs` to encode prioritized animator/engine vertical slices and ownership boundaries as typed data.
- Added module export in `M:/K_OS/crates/zen-mocap-engine/src/lib.rs`.
- Added tests to validate slice uniqueness/order and referenced Kain supermotion mode IDs.

### Verification (Animator Plan)

- `cargo test -p zen-mocap-engine animator_plan::tests:: --lib` -> pass (2 tests)

### Recommendation

- Turn 2 should execute `timeline-keyframe-edit-ops` from `animator_plan` first.

## Additional Discovery Slice (Timeline Edit Contract)

- Added engine-owned timeline keyframe edit contract in `M:/K_OS/crates/zen-mocap-engine/src/timeline_edit.rs`.
- Added `M:/K_OS/crates/zen-mocap-engine/resources/keyframe_edit_policy.toml` to externalize frame bounds, enabled interpolation modes, and operation policy (`upsert`, `remove`, `move`, optional `scale-range`).
- Exported the new module via `M:/K_OS/crates/zen-mocap-engine/src/lib.rs` so frontend and command layers can share one typed contract.
- `timeline_edit` now supports deterministic apply/revert patches for keyframe operations with policy-gated validation and explicit error taxonomy.

### Additional Verification (Timeline Edit Contract)

- `cargo test -p zen-mocap-engine timeline_edit::tests:: --lib` -> pass (5 tests)
  - `manifest_exposes_enabled_operations_and_interpolations`
  - `upsert_and_revert_restores_previous_state`
  - `move_returns_collision_when_overwrite_disabled`
  - `move_and_revert_restores_both_frames`
  - `remove_requires_existing_frame`

### Updated Next Recommendation

- Turn 2 (animator) should wire `src-mocap/features/Sequencer/useSequencer.ts` mutations through this engine contract and serialize `KeyframeEditOp` payloads at the boundary, rather than mutating track state ad hoc in the hook.

## Additional Discovery Slice (Live Retarget Contract Hardening)

- Extended `resources/rig_topology_manifest.toml` profile schema with live-retarget contract fields:
  - `live_retarget_enabled`
  - `live_retarget_required_joint_indices`
  - `live_retarget_min_reliable_joints`
- Extended `src/rig/topology.rs` validation to enforce live-retarget contract integrity (non-empty required set, threshold bounds, duplicate/out-of-range index rejection).
- Added `LiveRetargetContract` in `src/rig/mod.rs` and wired `RigRetargeter` reliability gating to consume manifest-driven required joints and minimum reliable count.
- Removed hardcoded `keypoints != 17` compatibility gates in both `session.rs` and `video_analyzer.rs`; compatibility is now expressed through topology profile + contract presence.
- Replaced hardcoded GPU-chain max-joint sizing (`17 * 8`) in session/video analyzer with model-driven sizing (`model_entry.keypoints * 8`).
- Replaced video analyzer hardcoded topology arrays with manifest topology upload (`topology_profile.parents/rest_lengths`).

### Additional Verification (Live Retarget Contract Hardening)

- `cargo test -p zen-mocap-engine rig::topology::tests:: --lib` -> pass (2 tests)
- `cargo test -p zen-mocap-engine video_analyzer::tests::analyze_rejects_models_without_live_retarget_topology_contract --lib` -> pass (1 test)

### Updated Blocker View

- Live/offline retarget compatibility is now topology-contract driven (no hardcoded COCO-17 branch), but only one enabled contract profile (`coco17_live_v1`) currently exists.
- Next expansion blocker is adding additional profile contracts plus index-mapping contracts for non-COCO layouts.

### Refined Next Target Recommendation

- Turn 2 should still prioritize `timeline-keyframe-edit-ops`, and should now mirror this run's contract model: load timeline edit constraints from manifest rather than per-component literals.

## Additional Discovery Slice (Unified Retarget Contract Resolver)

- Added `resolve_retarget_contract` and typed `RetargetSurface` in `M:/K_OS/crates/zen-mocap-engine/src/rig/mod.rs` to centralize model/topology/live-retarget compatibility resolution.
- Added `ResolvedRetargetContract` so runtime callers consume one shared contract payload (`topology_profile` + `live_retarget_contract`) instead of rebuilding compatibility logic per surface.
- Refactored both `M:/K_OS/crates/zen-mocap-engine/src/session.rs` and `M:/K_OS/crates/zen-mocap-engine/src/video_analyzer.rs` to use the shared resolver, eliminating duplicated compatibility checks and drift-prone error construction.
- Added resolver-focused tests in `rig/mod.rs` for success and unknown-layout rejection to lock behavior before turn-2 sequencer/contract wiring.

### Additional Verification (Unified Retarget Contract Resolver)

- `cargo test -p zen-mocap-engine rig::tests:: --lib` -> pass (2 tests)
- `cargo test -p zen-mocap-engine video_analyzer::tests::analyze_rejects_models_without_live_retarget_topology_contract --lib` -> pass (1 test)

### Updated Next Target Recommendation

- Turn 2 should route Sequencer keyframe mutations through `timeline_edit` op payloads and persist operation events, while keeping this same shared-contract pattern at frontend/engine boundaries.

## Additional Discovery Slice (Take Validation Contract)

- Added `M:/K_OS/crates/zen-mocap-engine/resources/take_validation_policy.toml` as a manifest-owned contract for take integrity rules (fps bounds, frame limits, metadata requirements, sequencing, and rotation payload constraints).
- Refactored `M:/K_OS/crates/zen-mocap-engine/src/take.rs` to add `validate_take` + typed validation report/issue structures and enforce validation in both `save_take` and `load_take`.
- Added checks for model manifest compatibility, frame-count/duration consistency, sequence/timestamp monotonicity, tag hygiene, and joint payload finiteness/range.
- Added focused take validation tests to lock in pass/fail behavior for valid takes and malformed payloads.

### Additional Verification (Take Validation Contract)

- `cargo test -p zen-mocap-engine take::tests:: --lib` -> pass (5 tests)
  - `validate_take_accepts_valid_take`
  - `validate_take_rejects_unknown_model`
  - `validate_take_rejects_sequence_gap`
  - `save_take_rejects_invalid_payload`
  - `load_take_rejects_corrupt_duration`

### Updated Next Recommendation

- Turn 2 should wire Sequencer actions to emit engine-owned `KeyframeEditOp` payloads, then run `take` validation before timeline persistence/export so invalid edits are rejected with typed issue codes.

## Additional Discovery Slice (Timeline Event Ledger Contract)

- Added `M:/K_OS/crates/zen-mocap-engine/src/timeline_event.rs` as an engine-owned timeline edit ledger contract that wraps `timeline_edit` operations into replay/persistence events.
- Added `M:/K_OS/crates/zen-mocap-engine/resources/timeline_event_policy.toml` so event limits, session frame bounds, timestamp ordering, and allowed source IDs are manifest-owned instead of hardcoded.
- Exported `timeline_event` from `M:/K_OS/crates/zen-mocap-engine/src/lib.rs` to keep frontend/command/runtime integration on one typed event boundary.
- Extended `M:/K_OS/crates/zen-mocap-engine/src/take.rs` with backward-compatible `timeline_edit_events` storage (`#[serde(default)]`) and validation via `validate_timeline_event_log_against_take`.
- Added take-level guardrail test that rejects timeline events targeting frames outside persisted take range.

### Additional Verification (Timeline Event Ledger Contract)

- `cargo test -p zen-mocap-engine timeline_event::tests:: --lib` -> pass (4 tests)
- `cargo test -p zen-mocap-engine take::tests:: --lib` -> pass (6 tests)

### Updated Next Target Recommendation

- Turn 2 should route `src-mocap/features/Sequencer/useSequencer.ts` keyframe actions through `timeline_edit` and emit `TimelineEditEvent` payloads (`source_id = sequencer-ui`) so ZenMocap can persist/replay/undo timeline edits across sessions and exports.

## Additional Discovery Slice (Timeline Batch Contract)

- Added `M:/K_OS/crates/zen-mocap-engine/src/timeline_batch.rs` to introduce an engine-owned transactional envelope for multi-op Sequencer edits.
- Added `M:/K_OS/crates/zen-mocap-engine/resources/timeline_batch_policy.toml` to externalize batch constraints (`allow_empty`, `max_operations`), allowed origins, and supermotion mode override policy.
- `apply_timeline_edit_batch` now validates origin/track/mode constraints up front, applies keyframe operations atomically, and rolls back prior edits on failure.
- Added typed `TimelineEditEnvelope`, `TimelineEditOrigin`, `TimelineEditBatchResult`, and `TimelineBatchError` for frontend/command-layer integration.
- Exported the module in `M:/K_OS/crates/zen-mocap-engine/src/lib.rs`.

### Additional Verification (Timeline Batch Contract)

- `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` -> pass (4 tests)
- `cargo test -p zen-mocap-engine timeline_edit::tests:: --lib` -> pass (5 tests)

### Updated Next Recommendation

- Turn 2 should replace `useSequencer.ts` direct keyframe mutation (`addKeyframe`/`removeKeyframe`) with emitted `TimelineEditEnvelope` batches and consume typed `TimelineBatchError` responses for deterministic UI rollback/reporting.
- After Sequencer wiring, persist operation batches into take/timeline surfaces so edits are replayable and auditable across load/export flows.

## Additional Discovery Slice (Timeline Surface Contract)

- Added M:/K_OS/crates/zen-mocap-engine/resources/timeline_surface_contract.toml to declare a manifest-owned mapping from TimelineEditOrigin to timeline event source_id.
- Added M:/K_OS/crates/zen-mocap-engine/src/timeline_surface_contract.rs with compile-time validation that:
  - every known origin is bound exactly once,
  - origin IDs are valid typed TimelineEditOrigin values,
  - mapped event sources are enabled by timeline_event policy.
- Exposed typed origin registry helpers in M:/K_OS/crates/zen-mocap-engine/src/timeline_batch.rs (TimelineEditOrigin::ALL, policy_id, from_policy_id) and switched required-origin policy validation to this shared typed source.
- Exported new module via M:/K_OS/crates/zen-mocap-engine/src/lib.rs.

### Additional Verification (Timeline Surface Contract)

- cargo test -p zen-mocap-engine timeline_surface_contract::tests:: --lib -> pass (2 tests)
- cargo test -p zen-mocap-engine timeline_batch::tests:: --lib -> pass (4 tests)

### Updated Next Recommendation

- Turn 2 should wire src-mocap/features/Sequencer/useSequencer.ts to emit TimelineEditEnvelope + TimelineEditEvent through this new contract, using timeline_event_source_for_origin(TimelineEditOrigin::SequencerUi) instead of hardcoded source_id strings.

## Additional Discovery Slice (Timeline Runtime Orchestration Contract)

- Added `M:/K_OS/crates/zen-mocap-engine/src/timeline_runtime.rs` as an engine-owned orchestration boundary that composes `timeline_batch`, `timeline_event`, and `timeline_surface_contract` into one atomic apply flow.
- Added typed request/result/error contract:
  - `TimelineRuntimeRequest` (session frame, base timestamp, envelopes)
  - `TimelineRuntimeResult` (applied batch + emitted events)
  - `TimelineRuntimeError` (batch failure, event build failure, timestamp overflow, merged-log validation failure)
- Implemented `apply_timeline_runtime_request` to:
  - apply a batch through `apply_timeline_edit_batch`
  - resolve event source IDs via `timeline_event_source_for_origin`
  - build per-op timeline events with monotonic batch-local timestamps
  - validate merged event logs before commit
  - roll back all applied keyframe edits on any downstream event/log failure.
- Exported module in `M:/K_OS/crates/zen-mocap-engine/src/lib.rs`.

### Additional Verification (Timeline Runtime Orchestration Contract)

- `cargo test -p zen-mocap-engine timeline_runtime::tests:: --lib` -> pass (3 tests)
- `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` -> pass (4 tests)

### Updated Next Target Recommendation

- Turn 2 should wire `M:/K_OS/src-mocap/features/Sequencer/useSequencer.ts` to emit `TimelineRuntimeRequest` payloads (rather than ad hoc keyframe mutation), then persist `TimelineRuntimeResult.emitted_events` into take `timeline_edit_events`.
- Frontend/command boundaries should treat `TimelineRuntimeError::EventLogValidation` as a deterministic rollback signal and surface issue codes directly in Sequencer UX.

## Additional Discovery Slice (Timeline Bridge Contract)

- Added M:/K_OS/crates/zen-mocap-engine/resources/timeline_bridge_contract.toml to declare canonical Sequencer action bindings (sequencer-add-keyframe, sequencer-remove-keyframe, sequencer-move-keyframe) plus import/automation bridge actions.
- Added M:/K_OS/crates/zen-mocap-engine/src/timeline_bridge_contract.rs with typed TimelineBridgeBinding resolvers for frontend/command boundaries (timeline_bridge_binding_for_action, timeline_bridge_bindings).
- Added compile-time contract validation that enforces:
  - action IDs are unique and non-empty,
  - origin IDs are valid typed TimelineEditOrigin values,
  - operation IDs are enabled by keyframe_edit_policy,
  - event source IDs match timeline_surface_contract for the selected origin.
- Exported module from M:/K_OS/crates/zen-mocap-engine/src/lib.rs.

### Additional Verification (Timeline Bridge Contract)

- cargo test -p zen-mocap-engine timeline_bridge_contract::tests:: --lib -> pass (3 tests)
- cargo test -p zen-mocap-engine timeline_surface_contract::tests:: --lib -> pass (2 tests)
- cargo test -p zen-mocap-engine timeline_batch::tests:: --lib -> pass (4 tests)

### Updated Next Recommendation

- Turn 2 should consume timeline_bridge_contract in src-mocap/features/Sequencer/useSequencer.ts so add/remove/move actions emit TimelineEditEnvelope + TimelineEditEvent metadata from action IDs (not hardcoded origin/source strings).

## Additional Discovery Slice (Timeline Bridge Runtime Contract)

- Added `M:/K_OS/crates/zen-mocap-engine/src/timeline_bridge_runtime.rs` as an engine-owned adapter that converts Sequencer action commands into `TimelineEditEnvelope` and `TimelineRuntimeRequest` payloads.
- The new adapter resolves action metadata through `timeline_bridge_contract` (`action_id -> origin/operation`) instead of hardcoded frontend mapping logic.
- Added strict payload/operation conformance checks (`ActionPayloadMismatch`) so invalid action shapes fail at the boundary before mutating timeline state.
- Exported module from `M:/K_OS/crates/zen-mocap-engine/src/lib.rs` for reuse by Tauri command handlers and future frontend bridge integration.

### Additional Verification (Timeline Bridge Runtime Contract)

- `cargo test -p zen-mocap-engine timeline_bridge_runtime::tests:: --lib` -> pass (3 tests)
- `cargo test -p zen-mocap-engine timeline_runtime::tests:: --lib` -> pass (3 tests)

### Updated Next Target Recommendation

- Turn 2 should wire `M:/K_OS/src-mocap/features/Sequencer/useSequencer.ts` actions to emit `SequencerActionCommand` payloads (`sequencer-add-keyframe`, `sequencer-remove-keyframe`, `sequencer-move-keyframe`) and forward them into this runtime adapter, then apply `TimelineRuntimeRequest` through the engine command boundary.

## Additional Discovery Slice (Sequencer Bridge Wiring)

- Added `M:/K_OS/src-mocap/features/Sequencer/timelineBridge.ts` as a frontend-owned contract registry for Sequencer timeline action IDs, origin/source bindings, and typed timeline runtime payload builders.
- Added module-load validation in the bridge contract so required action IDs remain present/unique (`sequencer-add-keyframe`, `sequencer-remove-keyframe`, `sequencer-move-keyframe`).
- Updated `M:/K_OS/src-mocap/features/Sequencer/useSequencer.ts` to emit bridge-generated runtime requests/events for `addKeyframe` and `removeKeyframe`, and added `moveKeyframe` with collision and missing-source guardrails.
- Added bridge runtime state exposure (`timelineBridgeState`) and queue management (`clearPendingTimelineRuntimeRequests`) from the Sequencer hook to support upcoming engine command integration.
- Exported bridge contracts from `M:/K_OS/src-mocap/features/Sequencer/index.ts`.
- Added focused bridge payload tests in `M:/K_OS/src-mocap/features/Sequencer/timelineBridge.test.ts`.

### Additional Verification (Sequencer Bridge Wiring)

- `npm run test -- src-mocap/features/Sequencer/timelineBridge.test.ts` -> fail (`No test files found`) because current Vitest config only includes `src-frontend/**/*.{test,spec}.{ts,tsx}`.
- `npx tsc --noEmit` -> pass.

### Updated Next Target Recommendation

- Next turn should wire ZenMocap command integration to consume `timelineBridgeState.pendingRequests` and forward them into engine timeline runtime APIs, then clear the queue only on acknowledged commit.
- Expand Vitest include scope (or add a dedicated `src-mocap` test command) so Sequencer bridge tests execute in CI/local validation.

## Additional Discovery Slice (Sequencer Runtime Flush Integration)

- Wired `M:/K_OS/src-mocap/features/ZenMocap/ZenMocap.tsx` to flush `sequencer.timelineBridgeState.pendingRequests` through `mocapService.applyTimelineRuntimeRequests(...)` and only dequeue committed entries via `acknowledgeTimelineRuntimeRequests(ack.applied_request_count)`.
- Extended `M:/K_OS/src-mocap/features/Sequencer/useSequencer.ts` with `acknowledgeTimelineRuntimeRequests(count)` and `setTimelineBridgeError(message)` so queue draining is ack-driven and bridge failures are surfaced in typed state.
- Updated `M:/K_OS/src-mocap/features/Sequencer/timelineBridge.ts` request payload contract to match Rust runtime serde fields (`origin` instead of `origin_id`, `requested_supermotion_mode_id: number | null`).
- Added explicit Sequencer runtime methods/types in `M:/K_OS/src-mocap/features/ZenMocap/MocapService.ts` for `mocap_apply_timeline_runtime_requests` and `mocap_reset_timeline_runtime_state`.

### Additional Verification (Sequencer Runtime Flush Integration)

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `cargo check -p k-os-backend` (workdir: `M:/K_OS`) -> pass.

### Updated Blocker View

- Runtime event log state in `src-tauri/src/mocap/mocap.rs` is still process-memory only and not yet committed into take `timeline_edit_events`; request commit is acknowledged but not persisted across app restarts.

### Updated Next Target Recommendation

- Next turn should persist acknowledged runtime `emitted_events` into take write/load boundaries (`zen-mocap-engine::take::timeline_edit_events`) and expose an explicit command boundary for loading/saving sequencer timeline state per take.

## Additional Discovery Slice (Sequencer Runtime Command Boundary)

- Added backend timeline runtime command integration in `M:/K_OS/src-tauri/src/mocap/mocap.rs`:
  - `mocap_apply_timeline_runtime_requests` applies queued `TimelineRuntimeRequest` payloads through `zen_mocap_engine::timeline_runtime::apply_timeline_runtime_request`.
  - added process-local `TimelineRuntimeState` (track registry + event log) so commits are stateful and validated against merged event history.
  - added `mocap_reset_timeline_runtime_state` for explicit runtime-state resets when session workflows need a clean slate.
- Registered both commands in `M:/K_OS/src-tauri/src/main.rs` Tauri invoke handler list.
- Extended `M:/K_OS/src-mocap/features/ZenMocap/MocapService.ts` with typed command wrappers:
  - `applyTimelineRuntimeRequests(requests)`
  - `resetTimelineRuntimeState()`
- Updated `M:/K_OS/src-mocap/features/Sequencer/useSequencer.ts` to expose `setTimelineBridgeError` so command-boundary failures can be surfaced in bridge state instead of only console logs.
- Updated `M:/K_OS/src-mocap/features/ZenMocap/ZenMocap.tsx` flush effect to:
  - clear bridge errors on successful commit ack,
  - set bridge error on failed runtime commit,
  - preserve queue drain semantics via `acknowledgeTimelineRuntimeRequests`.
- Expanded root Vitest include scope in `M:/K_OS/vitest.config.ts` to include `src-mocap/**/*.{test,spec}.{ts,tsx}` so mocap tests run directly.
- Updated stale assertion in `M:/K_OS/src-mocap/features/Sequencer/timelineBridge.test.ts` (`origin` field) to match current bridge envelope contract.

### Additional Verification (Sequencer Runtime Command Boundary)

- `npx vitest run src-mocap/features/Sequencer/timelineBridge.test.ts` -> pass (3 tests)
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` -> pass (3 tests)
- `npx tsc --noEmit` -> pass
- `cargo check -p k-os-backend --manifest-path src-tauri/Cargo.toml` -> pass (non-blocking existing DIRECTORY.md sentry warnings only)

### Updated Next Target Recommendation

- Next turn should persist bridge runtime commit outputs into take ownership boundaries (`timeline_edit_events`) and introduce a typed save/apply command path so Sequencer edits survive reload/export with deterministic replay.

## Additional Discovery Slice (Timeline Runtime Take Persistence Boundary)

- Added backend command boundary in `M:/K_OS/src-tauri/src/mocap/mocap.rs` for take-owned timeline persistence:
  - `mocap_commit_timeline_runtime_to_take` persists runtime event logs into take `timeline_edit_events` with merge strategy (`append_unique` | `replace`) and optional post-commit runtime-state clear.
  - `mocap_hydrate_timeline_runtime_from_take` rebuilds command-layer runtime state (track keyframes + event log) by replaying persisted take timeline events.
- Added deterministic hydrate guardrail: replayed patch must match persisted event patch, otherwise hydrate fails with explicit event/track context.
- Registered new commands in `M:/K_OS/src-tauri/src/main.rs` invoke handler.
- Extended frontend boundary:
  - `M:/K_OS/src-mocap/features/ZenMocap/MocapService.ts` now exposes typed commit/hydrate APIs.
  - `M:/K_OS/src-mocap/features/ZenMocap/hooks/useTakes.ts` hydrates runtime state on take open and commits timeline runtime events back into the active take path on close.
  - `M:/K_OS/src-mocap/features/ZenMocap/types.ts` now includes `timeline_edit_events` on `AnimationTake` plus a typed `TimelineEditEvent` transport shape.

### Additional Verification (Timeline Runtime Take Persistence Boundary)

- `cargo check -p zen-mocap-engine` -> pass.
- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` -> pass (3 tests).
- `cargo check -p k-os-backend --manifest-path src-tauri/Cargo.toml` -> fail due existing unrelated compile error in `src-tauri/src/kain_commands.rs` (`non-exhaustive patterns: KainDomain::Fluid not covered`).

### Updated Next Target Recommendation

- Connect Sequencer runtime commit acknowledgements to explicit take-path ownership (active sequencer take/session file) so timeline events are persisted continuously, not only on take close.
- Add focused Rust tests for `mocap_commit_timeline_runtime_to_take`/`mocap_hydrate_timeline_runtime_from_take` merge/hydrate behavior and patch-mismatch rejection paths.

## Additional Discovery Slice (Timeline Runtime Take Persistence Hardening)

- Hardened `mocap_hydrate_timeline_runtime_from_take` replay integrity in `M:/K_OS/src-tauri/src/mocap/mocap.rs`: hydrated events must now reproduce the same `patch` that was persisted, otherwise hydrate fails fast with track/event context.
- Extended `TimelineRuntimeTakeCommitOptions` with typed merge policy (`append_unique` | `replace`) and defaulted to append behavior for backward compatibility.
- Updated `M:/K_OS/src-mocap/features/ZenMocap/hooks/useTakes.ts` close-flow persistence to commit with `merge_strategy = replace` when closing an active take, keeping the take ledger canonical.
- Updated `M:/K_OS/src-mocap/features/ZenMocap/ZenMocap.tsx` flush path to commit runtime events to an active take path (when available) immediately after runtime ACK.
- Added focused Rust tests in `M:/K_OS/src-tauri/src/mocap/mocap.rs` for hydrate patch-mismatch rejection and replayable event-log acceptance.

### Additional Verification (Timeline Runtime Take Persistence Hardening)

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests:: --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> fail due existing unrelated compile error in `src-tauri/src/kain_commands.rs` (`KainDomain::Fluid` match arm missing). During the same run, an intermediate compile error in `mocap.rs` tests (`TimelineRuntimeState` debug bound via `expect_err`) was fixed.

### Updated Next Target Recommendation

- Add an explicit sequencer-session owned take-path contract so `applyTimelineRuntimeRequests` always knows the active persistence target, not just when a playback take is open.
- Consider promoting timeline take persistence strategy into a manifest-backed policy (default merge mode + clear-on-close behavior) to keep behavior data-driven across frontend/backend boundaries.

## Additional Discovery Slice (Sequencer Session Take Ownership Contract)

- Added `M:/K_OS/src-mocap/features/ZenMocap/timelinePersistencePolicy.ts` as a centralized, validated policy contract for timeline runtime ACK/close persistence behavior (merge strategy, close clear mode, take-path retention rules).
- Extended `M:/K_OS/src-mocap/features/ZenMocap/hooks/useTakes.ts` with explicit `timelineCommitTakePath` session ownership, separate from playback-only `activeTakePath`.
- `openTake` now hydrates runtime state and registers active runtime take ownership; `renameTake`/`deleteTake` now rebind or clear commit ownership according to policy.
- `closeTake` now commits via policy-driven options and can retain session take-path ownership for sequencer ACK persistence even after timeline playback panel closes.
- Updated `M:/K_OS/src-mocap/features/ZenMocap/ZenMocap.tsx` runtime flush path to use session-owned `timelineCommitTakePath` and policy-gated ACK persistence, removing the previous dependency on playback-open state.

### Additional Verification (Sequencer Session Take Ownership Contract)

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass
- `npx vitest run src-mocap/features/Sequencer/timelineBridge.test.ts src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir: `M:/K_OS`) -> pass (6 tests)

### Updated Next Target Recommendation

- Promote `timelinePersistencePolicy` from TS constant module to a shared manifest (engine/backend owned) so frontend and Tauri commands consume one persistence policy source.
- Add focused tests for `useTakes` session ownership transitions (open -> close -> rename -> delete) to lock timeline commit-target behavior across UI lifecycle events.

## Additional Discovery Slice (Timeline Runtime Active-Take Ownership Contract)

- Added explicit backend-owned take binding in `M:/K_OS/src-tauri/src/mocap/mocap.rs` via `TimelineRuntimeState.active_take_path` and the new command `mocap_set_timeline_runtime_active_take(path: Option<String>)`.
- Added active-binding persistence command `mocap_commit_timeline_runtime_to_active_take(options)` so ACK-driven runtime commits no longer require path plumbing from every UI callsite.
- Refactored take commit internals into `commit_runtime_state_to_take(...)` and aligned existing path-based commit to also update the runtime active binding.
- Updated hydrate flow (`mocap_hydrate_timeline_runtime_from_take`) to bind active take ownership when replaying persisted timeline event logs.
- Registered new commands in `M:/K_OS/src-tauri/src/main.rs`.
- Updated frontend contract in `M:/K_OS/src-mocap/features/ZenMocap/MocapService.ts` with typed wrappers:
  - `setTimelineRuntimeActiveTake(path | null)`
  - `commitTimelineRuntimeToActiveTake(options)`
- Wired `M:/K_OS/src-mocap/features/ZenMocap/hooks/useTakes.ts` to bind/unbind active take ownership on open/rename/delete/close transitions.
- Updated `M:/K_OS/src-mocap/features/ZenMocap/ZenMocap.tsx` ACK flush path to call `commitTimelineRuntimeToActiveTake` (policy-gated) rather than passing explicit take paths.

### Additional Verification (Timeline Runtime Active-Take Ownership Contract)

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `cargo check -p zen-mocap-engine` (workdir: `M:/K_OS`) -> pass.
- `cargo check -p k-os-backend --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> fail due existing unrelated compile error in `M:/K_OS/src-tauri/src/kain_commands.rs` (`non-exhaustive patterns: KainDomain::Fluid not covered`).

### Updated Next Target Recommendation

- Add a runtime command/report surface that exposes active timeline runtime ownership + queue/ledger stats to the frontend diagnostics panel so take-binding drift is observable.
- On the next animator/integration slice, route sequencer track identity/session ownership through a shared manifest contract (mirroring timeline bridge policies) so track-to-take persistence remains deterministic across imports and retarget flows.

## Additional Discovery Slice (Timeline Runtime Diagnostics Surface)

- Added backend diagnostics command `mocap_get_timeline_runtime_diagnostics` in `M:/K_OS/src-tauri/src/mocap/mocap.rs` to expose runtime ownership and ledger state from one typed surface:
  - `active_take_path`
  - `active_take_exists`
  - `active_track_count`
  - `active_track_ids`
  - `event_log_size`
- Registered diagnostics command in `M:/K_OS/src-tauri/src/main.rs` invoke handler.
- Added typed frontend service boundary in `M:/K_OS/src-mocap/features/ZenMocap/MocapService.ts` (`getTimelineRuntimeDiagnostics`) and report interface.
- Extended `M:/K_OS/src-mocap/features/ZenMocap/timelinePersistencePolicy.ts` with a policy-owned diagnostics section (`enabled`, `refresh_interval_ms`) and validation to keep refresh behavior data-driven.
- Wired `M:/K_OS/src-mocap/features/ZenMocap/ZenMocap.tsx` to poll diagnostics via policy interval and pass report state into status UI.
- Extended `M:/K_OS/src-mocap/features/ZenMocap/ui/LiveLinkStatus.tsx` with a timeline runtime diagnostics block (active-take binding health + track/event counts) so binding drift is visible during runtime.
- Added backend unit test `diagnostics_report_reflects_runtime_state` in `src-tauri/src/mocap/mocap.rs` to lock report semantics.

### Additional Verification (Timeline Runtime Diagnostics Surface)

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test).

### Updated Next Target Recommendation

- Move diagnostics polling from interval-only to event-aware refresh by emitting a `mocap://timeline_runtime_diagnostics_changed` event from timeline runtime command mutations, then falling back to policy interval only when idle.
- Add a shared track ownership contract (manifest-backed `track_id` namespace policy) across Sequencer + runtime persistence so diagnostics can also report ownership violations and stale-track conditions deterministically.
- Add focused frontend tests for diagnostics rendering states (`BOUND`, `MISSING`, `NONE`) in `LiveLinkStatus`.

## Additional Discovery Slice (Timeline Runtime Diagnostics Hardening)

- Extended backend diagnostics contract in `M:/K_OS/src-tauri/src/mocap/mocap.rs` by enriching `TimelineRuntimeDiagnosticsReport` with:
  - `track_keyframe_counts` (per-track keyframe cardinality),
  - `latest_event_timestamp_ms`,
  - `event_source_counts` (source->event count histogram).
- Kept the diagnostics command boundary (`mocap_get_timeline_runtime_diagnostics`) as the single runtime observability surface and preserved active-take existence checks.
- Updated frontend diagnostics typing in `M:/K_OS/src-mocap/features/ZenMocap/MocapService.ts` to match the expanded report contract.
- Updated `M:/K_OS/src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx` to fetch/display timeline runtime diagnostics in the Info tab and surface queue drift context (`Pending Queue`, source counts, per-track keyframe counts, last event time).
- Extended GPU Doctor error handling to include Sequencer bridge failures so runtime queue/ledger issues are visible in one diagnostics surface.
- Updated `M:/K_OS/src-mocap/features/ZenMocap/ZenMocap.tsx` to pass bridge diagnostics props (`pendingRequests.length`, `lastError`) and auto-open GPU Doctor on timeline bridge errors.
- Expanded backend unit coverage in `mocap.rs` diagnostics test to assert new fields are reported correctly.

### Additional Verification (Timeline Runtime Diagnostics Hardening)

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test).

### Updated Next Target Recommendation

- Move timeline diagnostics refresh cadence and field visibility into a shared manifest/policy contract consumed by both frontend diagnostics surfaces (`GpuDoctorPanel`, status tabs) and backend command layer, then add integration tests for bridge-queue vs runtime-ledger drift scenarios.

## Additional Discovery Slice (Diagnostics Policy Frontend Parity)

- Integrated frontend diagnostics cadence with backend/engine-owned `timeline_runtime_diagnostics_policy` by loading policy through `mocap_get_timeline_runtime_diagnostics_policy` in `ZenMocap.tsx`.
- Removed stale frontend diagnostics polling dependency on local persistence policy fields; polling interval now follows manifest-backed `refresh.interval_ms`.
- Extended `GpuDoctorPanel` integration to consume `timelineRuntimeDiagnosticsPolicy` + shared diagnostics payload from parent state rather than issuing a redundant diagnostics invoke on panel open.
- Aligned diagnostics field rendering in both STATUS (`LiveLinkStatus.tsx`) and GPU Doctor (`GpuDoctorPanel.tsx`) with policy `field_visibility` flags so UI behavior matches backend visibility contract.

### Additional Verification (Diagnostics Policy Frontend Parity)

- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass.
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir: `M:/K_OS`) -> pass (3 tests).

### Updated Next Recommendation

- Add focused UI tests for diagnostics policy visibility matrices (e.g., hide `event_source_counts`, hide `active_take_path`) in `LiveLinkStatus` and `GpuDoctorPanel` so policy drift is caught before release.
- Emit `mocap://timeline_runtime_diagnostics_changed` from timeline mutation commands to reduce polling dependence and move toward event-driven diagnostics refresh.

## Additional Discovery Slice (Manifest-Owned Timeline Diagnostics Policy)

- Added `M:/K_OS/crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` as the single diagnostics policy source (refresh cadence + field visibility).
- Added `M:/K_OS/crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with compile-time manifest loading and validation (`policy_id`, `refresh.interval_ms >= 250`).
- Exported policy module from `M:/K_OS/crates/zen-mocap-engine/src/lib.rs` and consumed it in Tauri command layer (`M:/K_OS/src-tauri/src/mocap/mocap.rs`).
- Added new command `mocap_get_timeline_runtime_diagnostics_policy` and registered it in `M:/K_OS/src-tauri/src/main.rs`.
- Hardened diagnostics boundary so backend now enforces policy-driven redaction/visibility in `mocap_get_timeline_runtime_diagnostics` (for example, `active_track_ids` hidden by policy).
- Updated frontend service/types in `M:/K_OS/src-mocap/features/ZenMocap/MocapService.ts` to consume policy via typed IPC.
- Updated `M:/K_OS/src-mocap/features/ZenMocap/ZenMocap.tsx` to fetch diagnostics policy once and drive diagnostics polling interval from backend policy (fallback policy retained for resilience).
- Updated diagnostics surfaces (`LiveLinkStatus.tsx`, `GpuDoctorPanel.tsx`) to consume policy visibility flags and render only approved fields.
- Simplified `timelinePersistencePolicy.ts` to remove diagnostics refresh literals now owned by backend manifest policy.

### Additional Verification (Manifest-Owned Timeline Diagnostics Policy)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass (1 test)
- `npx tsc --noEmit` (workdir: `M:/K_OS/src-mocap`) -> pass
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)

### Updated Next Target Recommendation

- Add backend-emitted diagnostics-change event hooks (`mocap://timeline_runtime_diagnostics_changed`) and switch ZenMocap refresh loop to event-first with policy interval fallback.
- Extend diagnostics policy with explicit queue-vs-ledger drift thresholds and add frontend integration tests that assert warning/escalation behavior when drift exceeds policy limits.

## Additional Discovery Slice (Event-First Diagnostics + Drift Contract)

- Extended `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` with a new `[drift]` section (`warn_pending_request_count`, `warn_queue_vs_ledger_gap`) so queue-vs-ledger warning thresholds are manifest-owned.
- Extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with typed `TimelineRuntimeDiagnosticsDriftPolicy` validation and policy export.
- Updated Tauri timeline runtime command layer (`src-tauri/src/mocap/mocap.rs`) to emit `mocap://timeline_runtime_diagnostics_changed` after timeline runtime mutations (`apply`, `reset`, active-take bind, commit, hydrate).
- Refactored diagnostics snapshot construction into a shared backend helper and reused it for both pull (`mocap_get_timeline_runtime_diagnostics`) and push event paths.
- Updated frontend diagnostics surface (`src-mocap/features/ZenMocap/ZenMocap.tsx`) to subscribe to diagnostics-changed events and use report payloads directly, while keeping policy interval polling as fallback.
- Updated diagnostics UIs (`LiveLinkStatus.tsx`, `GpuDoctorPanel.tsx`) to compute and surface policy-driven queue/ledger drift warnings using pending bridge queue count + diagnostics event ledger size.
- Updated frontend diagnostics policy type contract (`MocapService.ts`) to include new drift thresholds.

### Additional Verification (Event-First Diagnostics + Drift Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass (1 test)
- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) -> pass
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir `M:/K_OS`) -> pass (3 tests)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> fail due existing unrelated non-exhaustive `KainDomain` match in `src-tauri/src/kain_commands.rs` (`Brush`/`Shader` not covered)

### Updated Next Target Recommendation

- Add policy-matrix frontend tests for diagnostics drift warnings and field visibility gating in `LiveLinkStatus` and `GpuDoctorPanel`.
- Follow-up in backend with lightweight event reason payload metadata (if needed) once broader event bus shape is standardized.

## Additional Discovery Slice (Event-Driven Timeline Diagnostics Refresh)

- Added event emission on timeline runtime mutation commands in `M:/K_OS/src-tauri/src/mocap/mocap.rs` by injecting `AppHandle` into:
  - `mocap_apply_timeline_runtime_requests`
  - `mocap_reset_timeline_runtime_state`
  - `mocap_set_timeline_runtime_active_take`
  - `mocap_commit_timeline_runtime_to_take`
  - `mocap_commit_timeline_runtime_to_active_take`
  - `mocap_hydrate_timeline_runtime_from_take`
- Reused existing backend diagnostics report builder and now emit `mocap://timeline_runtime_diagnostics_changed` with a fresh diagnostics snapshot after each successful runtime mutation.
- Updated `M:/K_OS/src-mocap/features/ZenMocap/ZenMocap.tsx` to an event-first diagnostics model:
  - added listener for `mocap://timeline_runtime_diagnostics_changed`,
  - added shared `refreshTimelineRuntimeDiagnostics` fetch callback,
  - retained policy `refresh.interval_ms` polling as fallback/heartbeat.
- Applied adjacent backend hardening in `M:/K_OS/src-tauri/src/kain_commands.rs` to handle newly added `KainDomain::Brush` and `KainDomain::Shader`, removing an unrelated compile blocker that prevented mocap verification.

### Additional Verification (Event-Driven Diagnostics Refresh)

- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `npx tsc --noEmit --pretty false` (workdir: `M:/K_OS`) -> pass

### Updated Next Recommendation

- Add focused frontend tests around diagnostics event propagation and fallback poll behavior (event burst, listener teardown, and stale-state recovery).
- Promote diagnostics event payload to include mutation metadata (`reason`, request/take ids) while preserving report-redaction policy semantics.

## Additional Discovery Slice (Diagnostics Mutation Metadata Contract)

- Extended `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` with a manifest-owned `[event]` contract (`include_reason`, `include_emitted_at_ms`, `allowed_reasons`) so diagnostics event metadata is data-driven instead of implicit literals.
- Extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with typed `TimelineRuntimeDiagnosticsEventPolicy` schema validation (non-empty/unique allowed reasons).
- Added typed backend diagnostics event payload in `src-tauri/src/mocap/mocap.rs`:
  - `TimelineRuntimeDiagnosticsChangedPayload`
  - `TimelineRuntimeDiagnosticsMutationMetadata`
  - policy-gated metadata emission via `build_timeline_runtime_diagnostics_changed_payload(...)`.
- Updated runtime mutation reason routing so active-take commit emits `runtime_committed_to_active_take` (instead of sharing the generic take reason).
- Added frontend payload compatibility adapter in `src-mocap/features/ZenMocap/timelineDiagnosticsEvent.ts` to support both:
  - new structured payloads (`{ report, mutation }`), and
  - legacy report-only payloads.
- Wired `src-mocap/features/ZenMocap/ZenMocap.tsx` listener to parse/coerce diagnostics event payloads and surface mutation metadata to diagnostics UI surfaces.
- Updated `LiveLinkStatus.tsx` and `GpuDoctorPanel.tsx` to expose the last diagnostics mutation reason/time for runtime attribution.
- Added focused tests:
  - `src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts`
  - `src-tauri/src/mocap/mocap.rs` unit test `diagnostics_changed_payload_respects_event_policy`.

### Additional Verification (Diagnostics Mutation Metadata Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass (1 test).
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` -> pass (3 tests).
- `npx tsc --noEmit` -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> fail due pre-existing unrelated compile error in `src-tauri/src/kain_commands.rs` (`KainDomain::Procedural` non-exhaustive match).

### Updated Next Target Recommendation

- Add policy-matrix frontend tests for diagnostics mutation attribution and field-visibility gating in `LiveLinkStatus` and `GpuDoctorPanel`.
- Extract timeline diagnostics mutation reason IDs into a shared engine/backend enum-style contract to prevent drift between policy allowlist and command emit sites.

## Additional Discovery Slice (Diagnostics Event Contract Stabilization)

- Fixed diagnostics policy manifest integrity by consolidating `M:/K_OS/crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` to a single `[event]` section (previous duplicate section risked policy-load failure/drift).
- Hardened backend event emission in `M:/K_OS/src-tauri/src/mocap/mocap.rs` so diagnostics mutation reasons are always deterministic: unknown reasons now normalize to a policy-backed fallback instead of silently redacting reason metadata.
- Kept diagnostics payload contract aligned with policy toggles (`include_reason`, `include_emitted_at_ms`) while preserving report redaction behavior.
- Applied adjacent compile unblock in `M:/K_OS/src-tauri/src/kain_commands.rs` by handling `KainDomain::Procedural` in source registry mapping so focused backend mocap tests can execute.

### Additional Verification (Diagnostics Event Contract Stabilization)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass (1 test)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` -> pass (3 tests)

### Updated Next Target Recommendation

- Next discovery/integration slice should externalize diagnostics event reason taxonomy and UI presentation metadata into a shared engine contract (reason label/severity/actionability) so STATUS and GPU Doctor surfaces can render reason-specific guidance without per-component heuristics.
- After that, add focused frontend integration tests around event-first diagnostics refresh ordering (event burst + poll fallback race) to guarantee no stale overwrite when both channels update concurrently.


## Additional Discovery Slice (Diagnostics Reason Taxonomy Contract)

- Extended `M:/K_OS/crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` with manifest-owned `event.reason_catalog` entries (`reason_id`, `label`, `severity`, `action_hint`) for every allowed diagnostics mutation reason.
- Extended `M:/K_OS/crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with typed `TimelineRuntimeDiagnosticsReasonDescriptor`, validation for catalog/allowlist parity, and a reason lookup API used by downstream surfaces.
- Updated backend diagnostics payload in `M:/K_OS/src-tauri/src/mocap/mocap.rs` so mutation metadata now includes policy-driven `reason_detail` (`reason_id`, label, severity, action hint), while preserving existing reason fallback behavior.
- Updated frontend diagnostics contracts/parsing in:
  - `M:/K_OS/src-mocap/features/ZenMocap/MocapService.ts`
  - `M:/K_OS/src-mocap/features/ZenMocap/timelineDiagnosticsEvent.ts`
  - `M:/K_OS/src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts`
- Updated diagnostics UI consumption in:
  - `M:/K_OS/src-mocap/features/ZenMocap/ui/LiveLinkStatus.tsx`
  - `M:/K_OS/src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx`
  so STATUS/Doctor render policy-owned labels/severity/action hints instead of raw reason IDs.
- Updated fallback policy in `M:/K_OS/src-mocap/features/ZenMocap/ZenMocap.tsx` to match the new backend event catalog shape.

### Additional Verification (Diagnostics Reason Taxonomy Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass (1 test)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` -> pass (3 tests)
- `npx tsc --noEmit` -> pass
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)

### Updated Next Target Recommendation

- Add policy-matrix UI tests that assert severity/action rendering and visibility gating parity between STATUS and GPU Doctor for all catalog reasons.
- Introduce a timeline-runtime diagnostics mutation counter contract (`reason_id -> rolling count`) to support trend-aware warnings and reduce reliance on single-event snapshots.

## Additional Discovery Slice (Diagnostics Event/Poll Freshness Guard)

- Improved: added M:/K_OS/src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.ts to centralize diagnostics snapshot versioning and stale-update acceptance rules (timelineDiagnosticsVersion, shouldApplyTimelineDiagnosticsUpdate).
- Improved: wired M:/K_OS/src-mocap/features/ZenMocap/ZenMocap.tsx refresh/event paths to reject stale polling snapshots when a newer diagnostics-changed event has already been applied.
- Improved: polling refresh now only clears mutation metadata when it wins with a newer diagnostics version, preserving event attribution during equal-version heartbeats.
- Improved: added focused frontend tests in M:/K_OS/src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts for version computation and stale poll rejection after newer event payloads.

### Additional Verification (Diagnostics Event/Poll Freshness Guard)

- npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts -> pass (6 tests)
- npx tsc --noEmit (workdir: M:/K_OS) -> pass

### Updated Next Target Recommendation

- Add focused component-level policy-matrix tests for LiveLinkStatus and GpuDoctorPanel (field visibility gates + severity-driven reason rendering).
- Add backend/frontend reason-catalog parity guard test so fallback policy IDs and manifest reason IDs cannot drift silently.


## Additional Discovery Slice (Diagnostics Policy-Matrix UI Tests + Reason Parity Guard)

- Improved: extracted `FALLBACK_TIMELINE_DIAGNOSTICS_POLICY` from `M:/K_OS/src-mocap/features/ZenMocap/ZenMocap.tsx` into `M:/K_OS/src-mocap/features/ZenMocap/timelineDiagnosticsFallbackPolicy.ts` so fallback reason metadata has a single frontend source of truth.
- Improved: added `M:/K_OS/src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts` to enforce reason-ID parity between frontend fallback policy and engine manifest (`crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`).
- Improved: added component-level policy-matrix coverage in `M:/K_OS/src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` for STATUS (`LiveLinkStatus`) and GPU Doctor (`GpuDoctorPanel`) to verify field-visibility gates and reason severity/action rendering.
- Improved: added `@mocap` alias to `M:/K_OS/vitest.config.ts` so mocap UI component tests resolve shared mocap primitives consistently.

### Additional Verification (Diagnostics Policy-Matrix + Parity Guard)

- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` -> pass (3 tests)
- `npx tsc --noEmit` -> pass

### Updated Next Target Recommendation

- Add a manifest-backed diagnostics reason trend contract (`reason_id -> rolling_count/window_ms`) in `zen-mocap-engine` and expose it through diagnostics payloads so STATUS/GPU Doctor can render trend-aware escalation instead of snapshot-only guidance.
- Add a backend/frontend policy parity check for `field_visibility` and drift thresholds (not only reason IDs) to fully lock fallback-policy drift.

## Additional Discovery Slice (Diagnostics Reason Trend Contract)

- Added manifest-owned diagnostics trend policy in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` (`[trend] reason_history_limit`, `top_reason_count`) and field visibility flag `show_recent_reason_counts`.
- Extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with typed trend policy validation and export.
- Extended backend runtime diagnostics in `src-tauri/src/mocap/mocap.rs`:
  - runtime state now tracks bounded recent mutation reasons,
  - diagnostics report now includes `recent_reason_counts` (top reasons within policy history window),
  - reason normalization is centralized and reused by event payload + trend accounting.
- Updated frontend diagnostics contracts and rendering:
  - `src-mocap/features/ZenMocap/MocapService.ts` includes `trend` policy + `recent_reason_counts` report field,
  - `src-mocap/features/ZenMocap/ui/LiveLinkStatus.tsx` and `ui/GpuDoctorPanel.tsx` now render reason trend rows under policy visibility gating,
  - `src-mocap/features/ZenMocap/timelineDiagnosticsEvent.ts` now normalizes legacy payloads by defaulting missing `recent_reason_counts` to `{}`.
- Extended diagnostics parity/policy matrix coverage:
  - `src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts` now checks fallback parity for trend + reason-count visibility fields,
  - `src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` now asserts reason-trend visibility gating in STATUS/GPU Doctor.
- Cleared a backend compile blocker uncovered during verification by adding `KainDomain::Kainscript` mapping in `src-tauri/src/kain_commands.rs`.

### Additional Verification (Diagnostics Reason Trend Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass (1 test)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> initial timeout/fail (pre-existing non-exhaustive `KainDomain::Kainscript` match in `src-tauri/src/kain_commands.rs`), then pass after adding mapping arm
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` -> pass (9 tests)
- `npx tsc --noEmit` -> pass

### Updated Next Target Recommendation

- Next discovery/integration slice should move diagnostics reason trend computation into a shared frontend utility contract (sorting/formatting policy) and add explicit trend severity escalation rules (`warn`/`error`) in manifest so STATUS and GPU Doctor can surface deterministic operator guidance without UI heuristics.

## Additional Discovery Slice (Diagnostics Trend Escalation Contract + Shared Formatter)

- Improved: extended `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` trend contract usage with explicit default and per-reason escalation thresholds now consumed end-to-end (`default_warn_count`, `default_error_count`, `trend.reason_thresholds`).
- Improved: hardened `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` validation and APIs for trend severity/action resolution (`trend_severity_for_count`, `trend_action_hint_for_count`) including threshold hint validation.
- Improved: extended backend diagnostics report in `src-tauri/src/mocap/mocap.rs` with typed `recent_reason_trends` (reason_id, label, count, severity, action_hint), sourced from manifest policy and reason catalogs.
- Improved: added shared frontend trend formatter/resolver contract `src-mocap/features/ZenMocap/timelineReasonTrend.ts` and routed both STATUS (`ui/LiveLinkStatus.tsx`) and GPU Doctor (`ui/GpuDoctorPanel.tsx`) through it.
- Improved: expanded frontend diagnostics contracts and parsers to carry `recent_reason_trends` and extended fallback policy parity to include trend threshold parity checks (`timelineDiagnosticsPolicyParity.test.ts`).
- Improved: added focused tests for trend formatting/escalation behavior (`timelineReasonTrend.test.ts`) and refreshed policy-matrix coverage (`ui/timelineDiagnosticsPolicyMatrix.test.tsx`).

### Additional Verification (Diagnostics Trend Escalation Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass (1 test)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` -> pass (8 tests)
- `npx tsc --noEmit` -> pass

### Updated Next Target Recommendation

- Next discovery/integration slice should expose diagnostics trend escalation summaries in the backend event payload (`mocap://timeline_runtime_diagnostics_changed`) so trend severity deltas can be consumed event-first without waiting for polling snapshots.
- After that, add a policy-owned cooldown/decay window for trend counts (for example, timestamped rolling windows) so repeated historical spikes do not keep STATUS/GPU Doctor in elevated severity indefinitely.

## Additional Discovery Slice (Diagnostics Trend Escalation Policy + Shared Formatter Contract)

- Improved: extended `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` with richer trend escalation thresholds (`default_warn_count`, `default_error_count`) and per-reason threshold coverage for all diagnostics mutation reasons.
- Improved: added per-reason trend escalation action hints (`warn_action_hint`, `error_action_hint`) in policy threshold entries so operator guidance is policy-owned.
- Improved: extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` to validate optional escalation action hints and expose `trend_action_hint_for_count` for runtime consumers.
- Improved: updated backend diagnostics trend emission in `src-tauri/src/mocap/mocap.rs` so `recent_reason_trends.action_hint` uses threshold escalation hints when warn/error thresholds are crossed.
- Improved: expanded frontend diagnostics policy shape (`src-mocap/features/ZenMocap/MocapService.ts`) to include optional threshold escalation action hints.
- Improved: aligned frontend fallback diagnostics policy (`src-mocap/features/ZenMocap/timelineDiagnosticsFallbackPolicy.ts`) with engine defaults/thresholds and escalation action hints.
- Improved: hardened policy parity guard (`src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts`) so threshold action-hint drift between fallback policy and engine manifest fails tests.
- Improved: updated shared frontend trend utility (`src-mocap/features/ZenMocap/timelineReasonTrend.ts`) to:
  - compute trend severity from policy thresholds,
  - derive action hints from threshold warn/error escalation hints,
  - recompute from reason counts when present (backend trend list is fallback-only when counts are absent).
- Improved: added focused resolver tests in `src-mocap/features/ZenMocap/timelineReasonTrend.test.ts` for escalation hint selection and policy-authoritative recomputation behavior.
- Improved: refreshed diagnostics policy matrix coverage (`src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx`) for updated trend policy defaults/thresholds.

### Additional Verification (Diagnostics Trend Escalation Policy + Shared Formatter Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass (1 test)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` -> pass (5 tests)
- `npx tsc --noEmit` -> pass

### Updated Next Target Recommendation

- Next discovery/integration slice should attach trend escalation summaries to event metadata (`mocap://timeline_runtime_diagnostics_changed`) so high-severity trend state can trigger immediate UI-level callouts without waiting for polling or panel context.
- After that, add command-level tests that assert policy escalation parity between backend-computed `recent_reason_trends` and frontend `timelineReasonTrend` resolver output for the same synthetic diagnostics snapshots.

## Additional Discovery Slice (Diagnostics Event Trend Summary Contract)

- Extended engine diagnostics event policy in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` with explicit event summary controls (`include_trend_summary`, `trend_summary_min_severity`, `trend_summary_top_count`) so escalation metadata is policy-owned.
- Hardened policy validation/default expectations in `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` to reject invalid summary settings and keep event summary behavior deterministic.
- Extended backend diagnostics event payload in `src-tauri/src/mocap/mocap.rs` with `mutation.trend_summary` (`minimum_severity`, `highest_severity`, `escalated_reason_count`, `top_reasons`) and policy-filtered escalation selection.
- Updated frontend diagnostics contracts/parsing in `src-mocap/features/ZenMocap/MocapService.ts` and `timelineDiagnosticsEvent.ts` to consume trend summaries with backward-compatible mutation metadata.
- Surfaced trend escalation summary metadata in STATUS and GPU Doctor (`ui/LiveLinkStatus.tsx`, `ui/GpuDoctorPanel.tsx`) for immediate high-severity callouts without waiting for follow-up poll interpretation.
- Expanded parity and UI coverage (`timelineDiagnosticsPolicyParity.test.ts`, `timelineDiagnosticsEvent.test.ts`, `ui/timelineDiagnosticsPolicyMatrix.test.tsx`, `timelineDiagnosticsFreshness.test.ts`, `timelineReasonTrend.test.ts`) to lock policy/schema behavior.

### Additional Verification (Diagnostics Event Trend Summary Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass (1 test)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts` -> pass (11 tests)
- `npx tsc --noEmit` -> pass

### Updated Next Target Recommendation

- Add command-level parity tests that feed synthetic diagnostics snapshots through backend trend summary synthesis and frontend trend resolver to guarantee identical severity/action output across surfaces.
- Add policy-owned trend cooldown/decay windows so sustained historical spikes can de-escalate deterministically over time.

## Additional Discovery Slice (Diagnostics Event Trend Summary Severity Floor)

- Extended `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` event contract with `trend_summary_min_severity = "warn"` so diagnostics escalation filtering is manifest-owned instead of hardcoded.
- Extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` schema with `event.trend_summary_min_severity` and strict enum validation (`info|warn|error`).
- Updated `src-tauri/src/mocap/mocap.rs` trend-summary payload to publish `minimum_severity` and filter escalated trends by policy minimum severity rank before truncation.
- Updated frontend diagnostics contracts/parsing in `src-mocap/features/ZenMocap/MocapService.ts` and `timelineDiagnosticsEvent.ts` to require and coerce trend summary minimum severity.
- Updated fallback policy + parity tests (`timelineDiagnosticsFallbackPolicy.ts`, `timelineDiagnosticsPolicyParity.test.ts`) so frontend fallback and engine manifest stay aligned for trend summary filtering.
- Updated `ZenMocap.tsx` event listener to open GPU Doctor when trend summary reports non-info escalation, enabling immediate event-first operator callouts.
- Expanded diagnostics test coverage (`timelineDiagnosticsEvent.test.ts`, `timelineDiagnosticsFreshness.test.ts`, `timelineReasonTrend.test.ts`, `ui/timelineDiagnosticsPolicyMatrix.test.tsx`) for new payload and policy shape.

### Additional Verification (Diagnostics Event Trend Summary Severity Floor)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass (1 test)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` -> pass (11 tests)
- `npx tsc --noEmit` -> pass

### Updated Next Target Recommendation

- Add backend/frontend parity tests that compare identical synthetic diagnostics snapshots against backend-emitted `recent_reason_trends` and frontend `resolveTimelineReasonTrends` output to detect threshold/action drift.
- Add manifest-owned trend cooldown/decay windows so stale historical spikes naturally de-escalate without requiring runtime resets.

## Additional Discovery Slice (Diagnostics Trend Decay + Cooldown Windows Contract)

- Improved: extended `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` with manifest-owned trend windows (`trend.decay_window_ms`, `trend.cooldown_window_ms`) so escalation decays naturally over time instead of growing unbounded.
- Improved: extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` to validate the new window contract (`>= 1000ms`, cooldown <= decay) and expose values through the typed policy surface.
- Improved: refactored `src-tauri/src/mocap/mocap.rs` timeline diagnostics history storage to timestamped entries (`TimelineMutationReasonEntry`) and windowed report synthesis.
- Improved: diagnostics report now emits `generated_at_ms` and `recent_reason_last_seen_ms` alongside counts/trends, enabling deterministic frontend parity and stale-spike cooldown handling.
- Improved: trend severity/action in backend now de-escalates to `info` when a reason is outside `cooldown_window_ms`, while still preserving count visibility inside the broader decay window.
- Improved: updated frontend diagnostics contract + resolver (`src-mocap/features/ZenMocap/MocapService.ts`, `timelineReasonTrend.ts`) to apply the same cooldown behavior when recomputing trends from counts.
- Improved: aligned fallback policy and parity checks (`timelineDiagnosticsFallbackPolicy.ts`, `timelineDiagnosticsPolicyParity.test.ts`) with the new trend-window policy shape.
- Improved: added backend and frontend tests for cooldown behavior (`diagnostics_report_applies_trend_cooldown_window`, `timelineReasonTrend.test.ts` cooldown case).
- Checked relevant Kain integration surface (`crates/k-os-kain`) for this slice and confirmed no direct diagnostics trend contract ownership there yet; no code changes required for this turn.

### Additional Verification (Diagnostics Trend Decay + Cooldown Windows Contract)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass (1 test)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_applies_trend_cooldown_window --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts` -> pass (4 tests)
- `npx tsc --noEmit` -> pass

### Updated Next Target Recommendation

- Add backend/frontend synthetic parity fixtures for trend windows so identical snapshots are asserted through both `build_timeline_runtime_diagnostics_report` and `resolveTimelineReasonTrends` with shared expected outputs.
- Promote trend-window policy into a Kain-facing diagnostics registry contract (`k-os-kain` supermotion domain metadata) so future runtime shader/supermotion adapters can consume severity windows without duplicating literals.

## Additional Discovery Slice (Diagnostics Trend Decay/Cooldown Policy Parity)

- Added manifest-owned trend windows in `M:/K_OS/crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`:
  - `trend.decay_window_ms = 300000`
  - `trend.cooldown_window_ms = 120000`
- Extended `M:/K_OS/crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` schema + validation to enforce trend window minimums and expose them through typed policy.
- Synced frontend fallback policy in `M:/K_OS/src-mocap/features/ZenMocap/timelineDiagnosticsFallbackPolicy.ts` and removed duplicate conflicting trend-window literals.
- Expanded fallback-manifest parity checks in `M:/K_OS/src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts` to include both trend window fields.
- Updated diagnostics UI policy-matrix fixture in `M:/K_OS/src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` with required trend window fields.

### Additional Verification (Diagnostics Trend Decay/Cooldown Policy Parity)

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` -> pass (1 test)
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_applies_trend_cooldown_window --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass (1 test)
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` -> pass (6 tests)
- `npx tsc --noEmit` -> pass

### Updated Next Target Recommendation

- Add backend/frontend synthetic snapshot parity tests that compare backend-generated `recent_reason_trends` with frontend `resolveTimelineReasonTrends` output for identical snapshots to lock severity/action parity as policy evolves.

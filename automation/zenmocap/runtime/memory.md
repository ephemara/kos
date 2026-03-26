# ZenMocap Loop Memory

Use this file as the durable memory across automation intervals.
Keep it short and high signal.

## Product Intent

- ZenMocap is standalone inside `K_OS`, but it is allowed to reuse shared `K_OS` crates, systems, and UI pieces.
- The long-term target is not just "mocap capture"; it is a fuller animator/editing environment with stronger take editing, keyframes, retargeting, and runtime robustness.
- `crates/zen-mocap-engine` should keep becoming a real owner crate.
- `crates/k-os-kain` and the Kain omni pipeline should be used more aggressively for shaders, generation, and pipeline intelligence.

## Loop Rules

- Keep the loop closed: every run should leave enough state for the next run to continue without guessing.
- Prefer vertical slices over random scattered edits.
- Prefer data-driven manifests and contracts over new literals.
- Turn 5 is the broader validation turn.
- Turn 6 is the documentation and changelog turn.

## Update Guidance

When a run finishes, append:

- what was actually improved
- what still hurts
- exact blockers
- what the next turn should likely attack

## Run 20260311-050909-turn-001-discovery-architecture (Turn 1)

- Added `crates/zen-mocap-engine/src/animator_plan.rs` as a typed discovery backlog contract for upcoming animator/engine turns.
- Prioritized slices: keyframe edit-op contract, retarget profile registry, supermotion mode routing, take validation rules.
- Added tests that validate slice ordering/uniqueness and referenced Kain mode IDs.
- Verification attempt (`cargo test -p zen-mocap-engine animator_plan::tests:: --lib`) failed before test execution due to existing compile issue in `crates/zen-mocap-engine/src/rig/mod.rs` (`E0753` doc comments).
- Next turn should execute `timeline-keyframe-edit-ops` first.

## Run 20260311-050909-turn-001-discovery-architecture (2026-03-11)

- Improved: moved live GPU topology ownership from hardcoded arrays in `session.rs` into `resources/rig_topology_manifest.toml` with typed loader/validator in `src/rig/topology.rs`.
- Improved: session now resolves topology profile by model keypoint layout and logs active profile id at startup.
- Verified: `cargo test -p zen-mocap-engine topology --lib` passed (2 tests).
- Still hurts: live retargeting remains COCO-17 only; non-17 layouts are still explicitly rejected in runtime.
- Blockers: none technical in this slice; next turn should target animator/keyframe system with the same manifest-first architecture.

## Correction for Turn 1 Animator Plan Verification

- Initial `animator_plan` verification failed earlier due transient compile-state mismatch; re-run succeeded.
- Verified: `cargo test -p zen-mocap-engine animator_plan::tests:: --lib` passed (2 tests).

## Run 20260311-050909-turn-001-discovery-architecture (Timeline Edit Contract Slice)

- Improved: added `crates/zen-mocap-engine/src/timeline_edit.rs` with typed keyframe edit operations and reversible apply/revert patch semantics.
- Improved: added `crates/zen-mocap-engine/resources/keyframe_edit_policy.toml` so frame limits, interpolation support, and operation enablement are manifest-driven.
- Improved: exported `timeline_edit` in `crates/zen-mocap-engine/src/lib.rs` to make the contract consumable across frontend/engine boundaries.
- Verified: `cargo test -p zen-mocap-engine timeline_edit::tests:: --lib` passed (5 tests).
- Still hurts: Sequencer (`src-mocap/features/Sequencer/useSequencer.ts`) still mutates keyframes locally and does not yet emit engine `KeyframeEditOp` payloads.
- Next turn: route Sequencer add/remove/move actions through this engine contract and persist operation payloads into take/timeline surfaces.

## Run 20260311-050909-turn-001-discovery-architecture (Live Retarget Contract Hardening)

- Improved: extended `rig_topology_manifest.toml` with live-retarget contract fields (`live_retarget_enabled`, required reliable joints, threshold) and enforced schema validation in `src/rig/topology.rs`.
- Improved: added `LiveRetargetContract` in `src/rig/mod.rs` and made `RigRetargeter` reliability gating data-driven from topology profile contract.
- Improved: removed hardcoded COCO-17 gating in `session.rs` and `video_analyzer.rs`; compatibility now resolves through topology contract presence.
- Improved: replaced hardcoded `17 * 8` GPU capacity and offline topology arrays with model/profile-driven values.
- Verified: `cargo test -p zen-mocap-engine rig::topology::tests:: --lib` passed (2 tests).
- Verified: `cargo test -p zen-mocap-engine video_analyzer::tests::analyze_rejects_models_without_live_retarget_topology_contract --lib` passed (1 test).
- Still hurts: non-COCO model families still need explicit topology + joint-mapping contracts to become retarget-capable.
- Next turn should attack animator keyframe op routing (`timeline-keyframe-edit-ops`) using the same manifest-contract architecture.

## Run 20260311-050909-turn-001-discovery-architecture (Unified Retarget Contract Resolver)

- Improved: centralized topology/live-retarget compatibility resolution in `src/rig/mod.rs` via `resolve_retarget_contract`, `RetargetSurface`, and `ResolvedRetargetContract`.
- Improved: refactored `session.rs` and `video_analyzer.rs` to consume the shared resolver, removing duplicated compatibility logic.
- Verified: `cargo test -p zen-mocap-engine rig::tests:: --lib` passed (2 tests).
- Verified: `cargo test -p zen-mocap-engine video_analyzer::tests::analyze_rejects_models_without_live_retarget_topology_contract --lib` passed (1 test).
- Still hurts: Sequencer frontend still mutates local keyframes directly and is not yet bound to engine `timeline_edit` op payloads.
- Next turn: implement Sequencer -> engine `timeline_edit` op routing and persist operation payloads.

Current run time: 2026-03-11T08:35:30.1743954-04:00


## Run 20260311-050909-turn-001-discovery-architecture (Take Validation Contract Slice)

- Improved: added `crates/zen-mocap-engine/resources/take_validation_policy.toml` as a manifest-owned contract for take integrity rules (fps, frame bounds, metadata, sequencing, rotations).
- Improved: refactored `crates/zen-mocap-engine/src/take.rs` to add typed `TakeValidationIssue`/`TakeValidationReport` and centralized `validate_take` checks.
- Improved: enforced validation at persistence boundaries (`save_take`, `load_take`) so malformed takes fail fast with explicit issue codes/messages.
- Improved: added tests covering acceptance of valid takes and rejection of unknown model IDs, sequence gaps, invalid save payloads, and corrupted load payloads.
- Verified: `cargo test -p zen-mocap-engine take::tests:: --lib` passed (5 tests).
- Still hurts: frontend Sequencer still performs direct local keyframe mutation and does not emit engine `KeyframeEditOp` payloads.
- Next turn should likely attack: Sequencer -> engine `timeline_edit` op routing, then apply `take` validation contract before persistence/export.

## Run 20260311-050909-turn-001-discovery-architecture (Timeline Batch Contract)

- Improved: added `crates/zen-mocap-engine/src/timeline_batch.rs` as an engine-owned transactional boundary for multi-operation timeline edits.
- Improved: added `crates/zen-mocap-engine/resources/timeline_batch_policy.toml` to data-drive batch limits, request origins, and supermotion mode override IDs.
- Improved: `apply_timeline_edit_batch` now enforces origin/track/mode validation and atomic rollback on failure, preventing partial Sequencer mutation application.
- Improved: linked supermotion mode override validation to `SUPERMOTION_LIVELINK_MODES` so timeline-intent routing stays aligned with Kain registry constraints.
- Verified: `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` passed (4 tests).
- Verified: `cargo test -p zen-mocap-engine timeline_edit::tests:: --lib` passed (5 tests).
- Still hurts: `src-mocap/features/Sequencer/useSequencer.ts` still mutates keyframes locally and does not yet emit engine `TimelineEditEnvelope` batches.
- Next turn should attack: wire Sequencer add/remove/move flows to `timeline_batch` and persist operation batches for replayable timeline edits.

## Run 20260311-050909-turn-001-discovery-architecture (Timeline Event Ledger Contract)

- Improved: added `crates/zen-mocap-engine/src/timeline_event.rs` as engine-owned timeline edit event envelope contract on top of `timeline_edit` operations.
- Improved: added `crates/zen-mocap-engine/resources/timeline_event_policy.toml` so allowed event sources, session-frame bounds, per-take/per-track caps, and timestamp ordering are manifest-driven.
- Improved: extended `crates/zen-mocap-engine/src/take.rs` with `timeline_edit_events` (`#[serde(default)]`) and wired `validate_take` to enforce timeline event policy + take frame-bound alignment.
- Verified: `cargo test -p zen-mocap-engine timeline_event::tests:: --lib` passed (4 tests).
- Verified: `cargo test -p zen-mocap-engine take::tests:: --lib` passed (6 tests).
- Still hurts: `src-mocap/features/Sequencer/useSequencer.ts` still mutates keyframes directly and does not emit engine `TimelineEditEvent` payloads.
- Next turn should likely attack: route Sequencer add/remove/move through `timeline_edit` + `timeline_event` (`source_id = sequencer-ui`) and persist those events with take writes.

## Run 20260311-050909-turn-001-discovery-architecture (Timeline Surface Contract Slice)

- Improved: added crates/zen-mocap-engine/resources/timeline_surface_contract.toml as canonical timeline-origin to timeline-event-source mapping.
- Improved: added crates/zen-mocap-engine/src/timeline_surface_contract.rs with compile-time contract validation and timeline_event_source_for_origin resolver.
- Improved: promoted TimelineEditOrigin typed registry APIs (ALL, policy_id, from_policy_id) and reused them in timeline_batch manifest validation.
- Verified: cargo test -p zen-mocap-engine timeline_surface_contract::tests:: --lib passed (2 tests).
- Verified: cargo test -p zen-mocap-engine timeline_batch::tests:: --lib passed (4 tests).
- Still hurts: src-mocap/features/Sequencer/useSequencer.ts has not yet been wired to engine timeline envelopes/events.
- Next turn should likely attack: Sequencer add/remove/move routing through TimelineEditEnvelope + TimelineEditEvent using timeline_event_source_for_origin.

Current run time: 2026-03-11T10:45:03.4221621-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Timeline Runtime Orchestration Contract)

- Improved: added `crates/zen-mocap-engine/src/timeline_runtime.rs` to compose `timeline_batch`, `timeline_event`, and `timeline_surface_contract` into a single atomic runtime boundary.
- Improved: added typed `TimelineRuntimeRequest`, `TimelineRuntimeResult`, and `TimelineRuntimeError` contracts for future frontend/command integration.
- Improved: `apply_timeline_runtime_request` now applies batches, emits origin-mapped events, validates merged event logs, and rolls back keyframe mutations if event build/log validation fails.
- Improved: exported `timeline_runtime` in `crates/zen-mocap-engine/src/lib.rs`.
- Verified: `cargo test -p zen-mocap-engine timeline_runtime::tests:: --lib` passed (3 tests).
- Verified: `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` passed (4 tests).
- Still hurts: `src-mocap/features/Sequencer/useSequencer.ts` still mutates keyframes locally and does not yet call this runtime contract.
- Next turn should likely attack: route Sequencer add/remove/move actions into `TimelineRuntimeRequest` and persist `TimelineRuntimeResult.emitted_events` in take `timeline_edit_events`.

Current run time: 2026-03-11T11:32:57.2265833-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Timeline Bridge Contract Slice)

- Improved: added `crates/zen-mocap-engine/resources/timeline_bridge_contract.toml` to register Sequencer action IDs with origin/operation/event-source bindings.
- Improved: added `crates/zen-mocap-engine/src/timeline_bridge_contract.rs` with typed lookup APIs and compile-time contract validation against `timeline_edit` enabled operations and `timeline_surface_contract` source mappings.
- Improved: exported `timeline_bridge_contract` from `crates/zen-mocap-engine/src/lib.rs`.
- Verified: `cargo test -p zen-mocap-engine timeline_bridge_contract::tests:: --lib` passed (3 tests).
- Verified: `cargo test -p zen-mocap-engine timeline_surface_contract::tests:: --lib` passed (2 tests).
- Verified: `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` passed (4 tests).
- Still hurts: `src-mocap/features/Sequencer/useSequencer.ts` still mutates local keyframes directly and has not yet consumed bridge action IDs.
- Next turn should attack: route Sequencer add/remove/move through `timeline_bridge_contract` action IDs and emit/persist envelope+event payloads.

Current run time: 2026-03-11T11:35:33.2694456-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Timeline Bridge Runtime Contract)

- Improved: added crates/zen-mocap-engine/src/timeline_bridge_runtime.rs as a typed adapter from Sequencer action IDs to TimelineEditEnvelope and TimelineRuntimeRequest.
- Improved: introduced SequencerActionCommand + SequencerActionPayload contracts with strict action/operation conformance checks to prevent bridge-policy drift.
- Improved: exported timeline_bridge_runtime in crates/zen-mocap-engine/src/lib.rs for Tauri command and frontend boundary reuse.
- Verified: cargo test -p zen-mocap-engine timeline_bridge_runtime::tests:: --lib passed (3 tests).
- Verified: cargo test -p zen-mocap-engine timeline_runtime::tests:: --lib passed (3 tests).
- Still hurts: src-mocap/features/Sequencer/useSequencer.ts still applies keyframe mutations locally and does not yet emit runtime action commands.
- Next turn should attack: emit SequencerActionCommand batches from Sequencer add/remove/move flows, then route through runtime apply + take event persistence.

Current run time: 2026-03-11T12:34:23.6045552-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Sequencer Bridge Wiring Slice)

- Improved: added `src-mocap/features/Sequencer/timelineBridge.ts` as a frontend-owned action binding registry + typed timeline runtime payload builders for `sequencer-add-keyframe`, `sequencer-remove-keyframe`, and `sequencer-move-keyframe`.
- Improved: wired `src-mocap/features/Sequencer/useSequencer.ts` add/remove keyframe actions through bridge request/event emission and added `moveKeyframe` with collision/missing-frame guardrails.
- Improved: exposed bridge queue + ledger state (`timelineBridgeState`, `clearPendingTimelineRuntimeRequests`) so command-layer integration can flush runtime requests deterministically.
- Improved: exported bridge contracts from `src-mocap/features/Sequencer/index.ts`.
- Verified: `npx tsc --noEmit` passed.
- Verification blocker: `npm run test -- src-mocap/features/Sequencer/timelineBridge.test.ts` returned `No test files found` because current Vitest include pattern only scans `src-frontend/**/*.{test,spec}.{ts,tsx}`.
- Still hurts: Sequencer bridge requests are emitted but not yet forwarded to engine runtime command boundaries.
- Next turn should likely attack: consume `timelineBridgeState.pendingRequests` in ZenMocap command integration and clear queue entries only on engine-acknowledged commits.

Current run time: 2026-03-11T12:35:10.7208434-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Sequencer Runtime Flush Integration)

- Improved: wired `src-mocap/features/ZenMocap/ZenMocap.tsx` to flush `timelineBridgeState.pendingRequests` into `mocap_apply_timeline_runtime_requests` and dequeue only acknowledged request count.
- Improved: added `acknowledgeTimelineRuntimeRequests(count)` + `setTimelineBridgeError(message)` to `src-mocap/features/Sequencer/useSequencer.ts` so queue management is commit-driven and bridge failures are visible in state.
- Improved: aligned frontend runtime envelope contract in `src-mocap/features/Sequencer/timelineBridge.ts` with Rust serde field names/types (`origin`, numeric `requested_supermotion_mode_id`).
- Improved: exposed typed runtime flush/reset methods in `src-mocap/features/ZenMocap/MocapService.ts` for command-layer integration.
- Verified: `npx tsc --noEmit` passed.
- Verified: `cargo check -p k-os-backend` passed.
- Still hurts: timeline runtime event log is in-memory only on Tauri side; emitted events are not yet persisted into take `timeline_edit_events`.
- Next turn should likely attack: persist runtime emitted events into take save/load flows and add explicit per-take timeline state command boundaries.

Current run time: 2026-03-11T13:37:16.9294492-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Sequencer Runtime Command Boundary)

- Improved: added `mocap_apply_timeline_runtime_requests` + `mocap_reset_timeline_runtime_state` in `src-tauri/src/mocap/mocap.rs` to commit Sequencer runtime request queues through engine-owned timeline runtime contracts.
- Improved: introduced command-layer `TimelineRuntimeState` (track registry + merged event log) so request validation is stateful and replay-aware.
- Improved: wired `MocapService.applyTimelineRuntimeRequests` and upgraded `ZenMocap.tsx` queue flush integration to clear bridge errors on ack and publish commit failures via `useSequencer` bridge error state.
- Improved: expanded `vitest.config.ts` include scope so `src-mocap` tests execute directly; updated stale `timelineBridge` test assertion for `origin` envelope field.
- Verified: `npx vitest run src-mocap/features/Sequencer/timelineBridge.test.ts` passed (3 tests).
- Verified: `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` passed (3 tests).
- Verified: `npx tsc --noEmit` passed.
- Verified: `cargo check -p k-os-backend --manifest-path src-tauri/Cargo.toml` passed (with existing non-blocking DIRECTORY.md sentry warnings).
- Still hurts: timeline runtime commit state is currently process-local and not yet persisted to take assets (`timeline_edit_events`) on save/export.
- Next turn should attack: persist committed runtime events into take ownership flows and add reload/replay parity checks.

Current run time: 2026-03-11T13:37:10.1508443-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Timeline Runtime Take Persistence Boundary)

- Improved: added take-owned timeline persistence command boundary in `src-tauri/src/mocap/mocap.rs` (`mocap_commit_timeline_runtime_to_take`) with merge strategies (`append_unique`, `replace`) and optional runtime-state clear-on-commit.
- Improved: added timeline runtime hydration command (`mocap_hydrate_timeline_runtime_from_take`) that replays take `timeline_edit_events` into runtime track state and enforces replay patch parity checks.
- Improved: registered new commands in `src-tauri/src/main.rs` and extended `src-mocap/features/ZenMocap/MocapService.ts` with typed commit/hydrate APIs.
- Improved: updated `src-mocap/features/ZenMocap/hooks/useTakes.ts` to hydrate runtime state on take open and commit runtime event logs on take close.
- Improved: extended `src-mocap/features/ZenMocap/types.ts` to include `timeline_edit_events` in `AnimationTake` transport contract.
- Verified: `cargo check -p zen-mocap-engine` passed.
- Verified: `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) passed.
- Verified: `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` passed (3 tests).
- Verification blocker: `cargo check -p k-os-backend --manifest-path src-tauri/Cargo.toml` failed due existing unrelated `KainDomain::Fluid` non-exhaustive match in `src-tauri/src/kain_commands.rs`.
- Next turn should likely attack: explicit active-sequencer take-path ownership so runtime commits persist continuously on ACK, not only when closing an opened take.

Current run time: 2026-03-11T14:35:08.4093559-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Timeline Runtime Take Persistence Hardening)

- Improved: hardened `mocap_hydrate_timeline_runtime_from_take` replay validation by requiring persisted `patch` parity with replayed patch state.
- Improved: extended `TimelineRuntimeTakeCommitOptions` with merge strategy (`append_unique` | `replace`) and default-preserving behavior.
- Improved: updated `useTakes.ts` + `ZenMocap.tsx` to commit runtime event ledgers with `replace` when active take ownership exists.
- Improved: added focused Rust tests for hydrate rejection on patch drift and hydrate success on replayable logs.
- Verified: `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) passed.
- Verification blocker: `cargo test -p k-os-backend mocap::mocap::tests:: --manifest-path M:/K_OS/src-tauri/Cargo.toml` failed due existing unrelated compile error in `src-tauri/src/kain_commands.rs` (`KainDomain::Fluid` non-exhaustive match).
- Next turn should likely attack: explicit sequencer-session take-path ownership to persist runtime ACK commits continuously without relying on playback-take lifecycle.

Current run time: 2026-03-11T14:40:17.7749920-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Sequencer Session Take Ownership Contract)

- Improved: added `src-mocap/features/ZenMocap/timelinePersistencePolicy.ts` as centralized policy for timeline ACK/close commit strategy and session take-path ownership semantics.
- Improved: extended `src-mocap/features/ZenMocap/hooks/useTakes.ts` with `timelineCommitTakePath` so runtime event persistence has an explicit session-owned take target independent of playback-open `activeTakePath`.
- Improved: `openTake` now sets runtime active-take ownership; `renameTake`/`deleteTake` rebind or clear ownership under policy rules.
- Improved: `src-mocap/features/ZenMocap/ZenMocap.tsx` runtime flush now commits ACKed runtime events using session-owned take target and policy merge strategy.
- Verified: `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) passed.
- Verified: `npx vitest run src-mocap/features/Sequencer/timelineBridge.test.ts src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir `M:/K_OS`) passed (6 tests).
- Still hurts: persistence policy is TS-owned; backend/runtime still needs a shared manifest-backed source of truth for policy parity.
- Next turn should likely attack: move persistence policy into shared manifest consumed by both frontend and Tauri command layer.

Current run time: 2026-03-11T15:34:51.0557321-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Timeline Runtime Active-Take Ownership Contract)

- Improved: added explicit active-take ownership to `src-tauri/src/mocap/mocap.rs` (`TimelineRuntimeState.active_take_path`) and command `mocap_set_timeline_runtime_active_take`.
- Improved: added `mocap_commit_timeline_runtime_to_active_take` so sequencer ACK persistence can commit against backend-owned take binding instead of repeatedly passing paths.
- Improved: refactored runtime take persistence into shared helper `commit_runtime_state_to_take` and aligned explicit-path commit/hydrate flows to synchronize active ownership.
- Improved: updated `src-mocap/features/ZenMocap/MocapService.ts`, `hooks/useTakes.ts`, and `ZenMocap.tsx` to bind/unbind active take ownership on open/rename/delete/close and commit ACKs through the active-binding command.
- Verified: `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) passed.
- Verified: `cargo check -p zen-mocap-engine` passed.
- Verification blocker: `cargo check -p k-os-backend --manifest-path M:/K_OS/src-tauri/Cargo.toml` still fails on pre-existing unrelated `KainDomain::Fluid` non-exhaustive match in `src-tauri/src/kain_commands.rs`.
- Next turn should likely attack: runtime diagnostics/report command for active take binding + ledger stats and sequencer track ownership contract alignment.

Current run time: 2026-03-11T15:36:21.3125792-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Timeline Runtime Diagnostics Surface)

- Improved: added `mocap_get_timeline_runtime_diagnostics` + `TimelineRuntimeDiagnosticsReport` in `src-tauri/src/mocap/mocap.rs` to expose active-take binding health and runtime ledger stats from one typed command boundary.
- Improved: registered the command in `src-tauri/src/main.rs` and added frontend service contract `getTimelineRuntimeDiagnostics` in `src-mocap/features/ZenMocap/MocapService.ts`.
- Improved: extended `src-mocap/features/ZenMocap/timelinePersistencePolicy.ts` with validated diagnostics refresh settings (`diagnostics.enabled`, `diagnostics.refresh_interval_ms`) to keep diagnostics cadence data-driven.
- Improved: wired `src-mocap/features/ZenMocap/ZenMocap.tsx` and `ui/LiveLinkStatus.tsx` to show timeline runtime diagnostics (active take state + track/event counts) in STATUS panel.
- Verified: `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) passed.
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Still hurts: diagnostics refresh is polling-based; timeline runtime commands do not yet emit diagnostics-changed events.
- Next turn should likely attack: event-driven diagnostics updates + manifest-backed track ownership contract so diagnostics can report namespace/ownership violations.

Current run time: 2026-03-11T16:34:19.3025869-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Timeline Runtime Diagnostics Hardening)

- Improved: expanded `TimelineRuntimeDiagnosticsReport` in `src-tauri/src/mocap/mocap.rs` with `track_keyframe_counts`, `latest_event_timestamp_ms`, and `event_source_counts` for richer runtime observability.
- Improved: hardened diagnostics test coverage (`diagnostics_report_reflects_runtime_state`) to assert enriched report fields.
- Improved: aligned frontend diagnostics contract in `src-mocap/features/ZenMocap/MocapService.ts` with backend payload schema.
- Improved: updated `src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx` to display runtime ownership/ledger diagnostics and bridge queue/error drift context.
- Improved: updated `src-mocap/features/ZenMocap/ZenMocap.tsx` to auto-open GPU Doctor on timeline bridge errors and pass pending-queue/error diagnostics props.
- Verified: `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) passed.
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Still hurts: diagnostics refresh cadence/field visibility remain UI-owned and should move to shared manifest policy across status and doctor surfaces.
- Next turn should likely attack: manifest-owned diagnostics policy + integration checks for frontend queue vs backend ledger drift.

Current run time: 2026-03-11T16:38:31.0399428-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Diagnostics Policy Frontend Parity)

- Improved: updated `src-mocap/features/ZenMocap/ZenMocap.tsx` to load `TimelineRuntimeDiagnosticsPolicy` via `mocap_get_timeline_runtime_diagnostics_policy` and drive diagnostics polling from manifest-owned refresh settings.
- Improved: updated `src-mocap/features/ZenMocap/ui/LiveLinkStatus.tsx` and `src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx` to honor diagnostics `field_visibility` policy flags for frontend/backend parity.
- Improved: removed redundant diagnostics fetch on GPU Doctor open by wiring parent diagnostics state into panel props.
- Verified: `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) passed.
- Verified: `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir `M:/K_OS`) passed (3 tests).
- Still hurts: diagnostics updates remain polling-driven and should become event-driven from timeline runtime mutation commands.
- Next turn should likely attack: emit diagnostics-changed events and add policy-matrix UI tests for STATUS/GPU Doctor rendering.

Current run time: 2026-03-11T17:35:37.0111294-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Manifest-Owned Timeline Diagnostics Policy Contract)

- Improved: added `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` and `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` so diagnostics refresh cadence + field visibility are manifest-owned and validated at load.
- Improved: exported diagnostics policy from `crates/zen-mocap-engine/src/lib.rs` and added backend command `mocap_get_timeline_runtime_diagnostics_policy` in `src-tauri/src/mocap/mocap.rs` (registered in `src-tauri/src/main.rs`).
- Improved: backend diagnostics report now enforces policy visibility flags in `mocap_get_timeline_runtime_diagnostics` (for example, `active_track_ids` redacted when disabled by policy).
- Improved: frontend now consumes the backend policy contract via `MocapService.ts`; `ZenMocap.tsx` uses policy refresh interval for polling and both `LiveLinkStatus.tsx` + `GpuDoctorPanel.tsx` gate rendered fields by policy visibility.
- Improved: removed diagnostics refresh ownership from `src-mocap/features/ZenMocap/timelinePersistencePolicy.ts` to avoid split policy literals.
- Verified: `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed (1 test).
- Verified: `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) passed.
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Still hurts: diagnostics updates remain interval-polled only; mutation commands do not yet emit diagnostics-changed events.
- Next turn should likely attack: event-first diagnostics refresh (`mocap://timeline_runtime_diagnostics_changed`) with policy interval fallback and queue-vs-ledger drift threshold contracts.

Current run time: 2026-03-11T17:37:09.3703227-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Event-First Diagnostics + Drift Contract)

- Improved: extended `timeline_runtime_diagnostics_policy` with manifest-owned drift thresholds (`warn_pending_request_count`, `warn_queue_vs_ledger_gap`).
- Improved: updated `src-tauri/src/mocap/mocap.rs` to emit `mocap://timeline_runtime_diagnostics_changed` on timeline runtime mutations (apply/reset/active-take/commit/hydrate).
- Improved: unified backend diagnostics report construction through a shared helper used by both command polling and event payloads.
- Improved: updated `ZenMocap.tsx` diagnostics flow to consume event payloads first and retain policy interval fallback polling.
- Improved: added policy-driven queue-vs-ledger drift warnings in `LiveLinkStatus.tsx` and `GpuDoctorPanel.tsx`.
- Verified: `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed; `npx tsc --noEmit` passed; `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` passed (3 tests).
- Verification blocker: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` failed due unrelated existing `KainDomain` non-exhaustive match in `src-tauri/src/kain_commands.rs`.
- Next turn should likely attack: frontend diagnostics policy-matrix tests and optional event payload reason metadata standardization.

Current run time: 2026-03-11T18:36:37.2633945-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Event-Driven Timeline Diagnostics Refresh)

- Improved: timeline runtime mutation commands in `src-tauri/src/mocap/mocap.rs` now emit `mocap://timeline_runtime_diagnostics_changed` after successful state mutations (apply/reset/bind/commit/hydrate).
- Improved: reused backend diagnostics report builder so emitted event payload stays policy-redacted and schema-aligned with `mocap_get_timeline_runtime_diagnostics`.
- Improved: `src-mocap/features/ZenMocap/ZenMocap.tsx` now listens for diagnostics-changed events and refreshes diagnostics immediately, with policy interval polling retained as fallback heartbeat.
- Improved: fixed unrelated backend compile blocker in `src-tauri/src/kain_commands.rs` by adding `KainDomain::Brush` and `KainDomain::Shader` match arms.
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Verified: `npx tsc --noEmit --pretty false` (workdir `M:/K_OS`) passed.
- Still hurts: diagnostics flow has no explicit frontend tests for event/poll interplay and listener teardown.
- Next turn should likely attack: diagnostics event integration tests + mutation metadata in diagnostics-changed payload.

Current run time: 2026-03-11T18:37:42.6327849-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Diagnostics Mutation Metadata Contract)

- Improved: added manifest-owned diagnostics event metadata policy in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` (`event.include_reason`, `event.include_emitted_at_ms`, `event.allowed_reasons`).
- Improved: extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with typed event policy validation and export.
- Improved: backend diagnostics event in `src-tauri/src/mocap/mocap.rs` now emits typed `{ report, mutation }` payloads and differentiates `runtime_committed_to_active_take` reason.
- Improved: added frontend diagnostics payload coercion + tests (`src-mocap/features/ZenMocap/timelineDiagnosticsEvent.ts`, `timelineDiagnosticsEvent.test.ts`) and surfaced last mutation metadata in `LiveLinkStatus` + `GpuDoctorPanel`.
- Verified: `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed (1 test).
- Verified: `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` passed (3 tests).
- Verified: `npx tsc --noEmit` passed.
- Verification blocker: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` failed due existing unrelated compile error in `src-tauri/src/kain_commands.rs` (`KainDomain::Procedural` non-exhaustive match).
- Next turn should likely attack: shared typed diagnostics mutation reason contract + policy-matrix diagnostics rendering tests.

Current run time: 2026-03-11T19:37:45.2751101-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Diagnostics Event Contract Stabilization)

- Improved: fixed duplicate `[event]` manifest drift in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` and kept diagnostics event reasons policy-owned.
- Improved: hardened `src-tauri/src/mocap/mocap.rs` diagnostics payload behavior so out-of-policy reasons normalize to a deterministic policy fallback instead of silently redacting reason metadata.
- Improved: patched unrelated compile blocker in `src-tauri/src/kain_commands.rs` by adding `KainDomain::Procedural` mapping, restoring focused `k-os-backend` mocap test execution.
- Verified: `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed (1 test).
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Verified: `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` passed (3 tests).
- Still hurts: diagnostics reason metadata remains id-only; frontend surfaces still infer meaning without a shared label/severity taxonomy contract.
- Next turn should likely attack: manifest-backed diagnostics mutation taxonomy (`reason -> label/severity/action`) and policy-matrix UI assertions for status/doctor render consistency.

Current run time: 2026-03-11T19:37:05.2639989-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Diagnostics Event/Poll Freshness Guard)

- Improved: added frontend diagnostics freshness contract (timelineDiagnosticsFreshness.ts) and wired ZenMocap.tsx to reject stale poll snapshots after newer diagnostics events.
- Improved: preserved diagnostics mutation attribution during equal-version poll heartbeats; clear now happens only when a strictly newer poll snapshot is accepted.
- Verified: npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts passed (6 tests).
- Verified: npx tsc --noEmit passed.
- Still hurts: UI coverage for diagnostics policy visibility/severity matrices is still thin at component-render level.
- Next turn should likely attack: component-level STATUS/GPU Doctor policy-matrix tests + reason-catalog parity guards.

Current run time: 2026-03-11T21:37:14.1978449-04:00


## Run 20260311-050909-turn-001-discovery-architecture (Diagnostics Reason Taxonomy Contract)

- Improved: extended `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` with manifest-owned `event.reason_catalog` entries to define diagnostics reason label/severity/action metadata.
- Improved: extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with typed reason descriptor validation and allowlist/catalog parity checks.
- Improved: backend diagnostics event payload in `src-tauri/src/mocap/mocap.rs` now includes policy-derived `mutation.reason_detail` while preserving fallback normalization for unknown reasons.
- Improved: frontend diagnostics contracts/parsing/UI now consume `reason_detail` (`MocapService.ts`, `timelineDiagnosticsEvent.ts`, `LiveLinkStatus.tsx`, `GpuDoctorPanel.tsx`, `ZenMocap.tsx`).
- Verified: `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed (1 test).
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Verified: `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` passed (3 tests).
- Verified: `npx tsc --noEmit` passed.
- Next turn should likely attack: policy-matrix UI tests for reason catalog rendering/visibility parity and diagnostics reason trend counters (`reason_id -> rolling count`) for stronger operator guidance.

Current run time: 2026-03-11T21:37:01.4680027-04:00


## Run 20260311-050909-turn-001-discovery-architecture (Diagnostics Policy-Matrix UI + Reason Parity Guard)

- Improved: extracted fallback diagnostics policy into `src-mocap/features/ZenMocap/timelineDiagnosticsFallbackPolicy.ts` to eliminate duplicated reason catalog literals in `ZenMocap.tsx`.
- Improved: added `src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts` to assert reason-ID parity between frontend fallback policy and engine policy manifest.
- Improved: added component-level policy-matrix diagnostics tests in `src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` covering visibility gating and reason severity/action rendering in both STATUS and GPU Doctor.
- Improved: updated `vitest.config.ts` with `@mocap` alias so mocap UI tests resolve shared primitives under Vitest.
- Verified: `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` passed (3 tests).
- Verified: `npx tsc --noEmit` passed.
- Still hurts: parity guard currently locks reason IDs only; `field_visibility` and drift-threshold parity are not yet validated against manifest.
- Next turn should likely attack: manifest-backed diagnostics reason trend counters + expanded frontend/backend fallback parity checks for full diagnostics policy shape.

Current run time: 2026-03-11T22:34:07.8271402-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Diagnostics Reason Trend Contract)

- Improved: added manifest-owned diagnostics trend contract (`[trend] reason_history_limit`, `top_reason_count`) plus `field_visibility.show_recent_reason_counts` in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Improved: extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with typed trend policy validation and export.
- Improved: extended backend runtime diagnostics in `src-tauri/src/mocap/mocap.rs` to track bounded recent mutation reasons and publish policy-bounded `recent_reason_counts` in diagnostics snapshots.
- Improved: updated frontend diagnostics contracts/parser/UI (`MocapService.ts`, `timelineDiagnosticsEvent.ts`, `LiveLinkStatus.tsx`, `GpuDoctorPanel.tsx`) to consume and render reason trend counts with policy visibility gating.
- Improved: expanded diagnostics parity/matrix tests (`timelineDiagnosticsPolicyParity.test.ts`, `timelineDiagnosticsPolicyMatrix.test.tsx`) to guard trend-field and visibility parity.
- Verified: `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed (1 test).
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test) after fixing existing unrelated `KainDomain::Kainscript` non-exhaustive match in `src-tauri/src/kain_commands.rs`.
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Verified: `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` passed (9 tests).
- Verified: `npx tsc --noEmit` passed.
- Still hurts: trend severity/escalation behavior is not yet policy-owned; UI currently renders counts without escalation semantics.
- Next turn should likely attack: add manifest-backed trend escalation rules (warn/error thresholds per reason) and shared frontend formatter contract for deterministic STATUS/GPU Doctor operator guidance.

Current run time: 2026-03-11T22:44:55.5047860-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Diagnostics Trend Escalation Contract + Shared Formatter)

- Improved: extended diagnostics trend escalation contract usage across engine policy, backend report, and frontend surfaces.
- Improved: backend report (`src-tauri/src/mocap/mocap.rs`) now publishes `recent_reason_trends` with policy-derived severity + action hints.
- Improved: added shared frontend trend contract (`src-mocap/features/ZenMocap/timelineReasonTrend.ts`) and routed STATUS (`LiveLinkStatus.tsx`) + GPU Doctor (`GpuDoctorPanel.tsx`) trend rendering through it.
- Improved: extended frontend diagnostics contracts/parsers (`MocapService.ts`, `timelineDiagnosticsEvent.ts`) to carry `recent_reason_trends` with legacy fallback handling.
- Improved: expanded parity and UI matrix tests plus new utility coverage (`timelineDiagnosticsPolicyParity.test.ts`, `timelineDiagnosticsPolicyMatrix.test.tsx`, `timelineReasonTrend.test.ts`).
- Verified: `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed (1 test).
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Verified: `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` passed (8 tests).
- Verified: `npx tsc --noEmit` passed.
- Next turn should likely attack: include trend severity deltas in diagnostics-changed event payloads and add policy-owned trend cooldown/decay windows.

Current run time: 2026-03-12T03:41:19.2647089-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Diagnostics Trend Escalation Policy + Shared Formatter)

- Improved: expanded diagnostics trend thresholds and added policy-owned warn/error escalation action hints for all mutation reasons in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Improved: extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` validation and helper APIs (`trend_action_hint_for_count`) for threshold-aware action guidance.
- Improved: updated backend trend synthesis in `src-tauri/src/mocap/mocap.rs` so `recent_reason_trends.action_hint` follows threshold escalation hints when warn/error levels are crossed.
- Improved: synced frontend policy surface (`MocapService.ts` + `timelineDiagnosticsFallbackPolicy.ts`) with escalation hint fields and parity checks.
- Improved: tightened shared trend resolver behavior (`timelineReasonTrend.ts`) to recompute from reason counts when present and use backend trend arrays only as fallback.
- Improved: added focused resolver tests (`timelineReasonTrend.test.ts`) and refreshed diagnostics matrix/parity tests.
- Verified: `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed.
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed.
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed.
- Verified: `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` passed (5 tests).
- Verified: `npx tsc --noEmit` passed.
- Next turn should likely attack: include escalation summary metadata in `mocap://timeline_runtime_diagnostics_changed` payload for instant high-severity UI alerts.

Current run time: 2026-03-12T03:43:17.5482073-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Diagnostics Event Trend Summary Contract)

- Improved: extended diagnostics event policy with summary controls (`include_trend_summary`, `trend_summary_min_severity`, `trend_summary_top_count`) in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Improved: backend diagnostics-changed payload in `src-tauri/src/mocap/mocap.rs` now publishes `mutation.trend_summary` with minimum/highest severity, escalated reason count, and policy-bounded top escalated trends.
- Improved: frontend contracts/parser/UI now consume event trend summaries (`MocapService.ts`, `timelineDiagnosticsEvent.ts`, `LiveLinkStatus.tsx`, `GpuDoctorPanel.tsx`) for immediate escalation callouts.
- Improved: expanded diagnostics test coverage and parity guards across event parser, freshness, policy parity, trend resolver, and policy-matrix UI tests.
- Verified: `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed (1 test).
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Verified: `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts` passed (11 tests).
- Verified: `npx tsc --noEmit` passed.
- Next turn should likely attack: command-level backend/frontend trend summary parity tests plus policy-owned cooldown/decay windows for trend escalation.

Current run time: 2026-03-12T04:41:41.8211148-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Diagnostics Event Trend Summary Severity Floor)

- Improved: added `event.trend_summary_min_severity = "warn"` to `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` and validated enum values in `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs`.
- Improved: updated `src-tauri/src/mocap/mocap.rs` diagnostics event payload trend summary to include `minimum_severity` and apply policy-driven severity-floor filtering.
- Improved: updated frontend diagnostics contracts/parsing/fallback parity (`MocapService.ts`, `timelineDiagnosticsEvent.ts`, `timelineDiagnosticsFallbackPolicy.ts`, `timelineDiagnosticsPolicyParity.test.ts`) for the new field.
- Improved: updated `src-mocap/features/ZenMocap/ZenMocap.tsx` to open GPU Doctor immediately when diagnostics event trend summary escalates above info.
- Verified: `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed (1 test).
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Verified: `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` passed (11 tests).
- Verified: `npx tsc --noEmit` passed.
- Next turn should likely attack: backend/frontend synthetic diagnostics snapshot parity assertions for trend severity/action output, then manifest-owned trend cooldown/decay windows.

Current run time: 2026-03-12T04:42:18.4224969-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Diagnostics Trend Decay/Cooldown Policy Parity)

- Improved: added manifest-owned diagnostics trend windows (`trend.decay_window_ms`, `trend.cooldown_window_ms`) in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Improved: extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` validation + typed policy export for trend windows.
- Improved: synced frontend fallback diagnostics policy and parity checks (`timelineDiagnosticsFallbackPolicy.ts`, `timelineDiagnosticsPolicyParity.test.ts`) to lock trend window drift.
- Improved: updated diagnostics policy matrix fixture (`ui/timelineDiagnosticsPolicyMatrix.test.tsx`) with required trend window fields.
- Verified: `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed (1 test).
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_applies_trend_cooldown_window --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Verified: `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` passed (6 tests).
- Verified: `npx tsc --noEmit` passed.
- Next turn should likely attack: synthetic backend/frontend diagnostics trend parity tests for severity/action output on identical snapshots.

Current run time: 2026-03-12T10:36:51.3740073-04:00

## Run 20260311-050909-turn-001-discovery-architecture (Diagnostics Trend Decay + Cooldown Windows Contract)

- Improved: added manifest-owned diagnostics trend windows (`trend.decay_window_ms = 300000`, `trend.cooldown_window_ms = 120000`) in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Improved: extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with trend-window validation invariants (`>= 1000ms`, cooldown <= decay).
- Improved: refactored `src-tauri/src/mocap/mocap.rs` mutation-reason history to timestamped entries and added time-windowed trend synthesis.
- Improved: backend diagnostics report now includes `generated_at_ms` and `recent_reason_last_seen_ms` to support deterministic frontend parity.
- Improved: frontend trend resolver + contracts (`src-mocap/features/ZenMocap/MocapService.ts`, `timelineReasonTrend.ts`) now apply cooldown de-escalation when recomputing from reason counts.
- Improved: aligned fallback/parity coverage (`timelineDiagnosticsFallbackPolicy.ts`, `timelineDiagnosticsPolicyParity.test.ts`) with new trend-window policy fields.
- Verified: `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` passed (1 test).
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_applies_trend_cooldown_window --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Verified: `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` passed (1 test).
- Verified: `npx vitest run src-mocap/features/ZenMocap/timelineReasonTrend.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts` passed (4 tests).
- Verified: `npx tsc --noEmit` passed.
- Next turn should likely attack: backend/frontend synthetic parity fixtures for identical trend-window snapshots and optional Kain-facing trend-window registry export for supermotion pipeline consumers.

Current run time: 2026-03-12T10:37:11.5600100-04:00

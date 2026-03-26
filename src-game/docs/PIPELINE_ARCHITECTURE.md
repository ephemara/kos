# K_OS Game Pipeline Architecture

Date: 2026-03-11

## Objective

Build `src-game` as a standalone game engine product surface with data-driven orchestration, while reusing existing K_OS strategic owners.

Companion docs:
- `src-game/docs/CRATE_ARCHITECTURE.md`
- `src-game/docs/AUTOMATION_GUIDE.md`

## Current ownership model

- `k-os-game-runtime`: owns pipeline manifests, validation, preflight checks, deterministic execution planning, and runner adapter resolution.
- `k-os-scene`: canonical authored scene data owner.
- `k-os-eval`: derived-state and graph evaluation owner.
- `k-os-renderer`: renderer contract owner.
- `k-os-gpu-pipeline`: shared GPU infra owner.
- `k-os-kain`: source/runtime/shader authoring owner.
- `k-os-bevy`: runtime host/bootstrap adapter.

For the intended full game-product crate map, see `src-game/docs/CRATE_ARCHITECTURE.md`.

## Pipeline manifest strategy

Manifest location:
- `src-game/config/pipeline.toml`

Each stage is declared as data with:
- `id`
- `kind`
- `profile`
- `depends_on`
- stage-kind specific payload fields

Supported stage kinds in this increment:
- `scene`
- `kain_hot_reload`
- `narrative_graph`
- `data_registry`
- `cook`
- `build`
- `export`

`data_registry` currently orchestrates:
- input bindings
- gameplay tags
- actor archetypes
- AI agents
- camera rigs
- sequencer timelines
- visual scripting graph registries

Execution profiles are manifest data and bind each stage to:
- runtime host
- renderer contract
- UI shell
- feature flags

## Validation guarantees

`k-os-game-runtime` enforces:
- non-empty product metadata
- profile existence and shape
- unique stage IDs
- stage dependency existence
- no self-dependencies
- stage-kind payload correctness
- dependency cycle rejection
- data-registry schema policy shape (when declared under `[data_registry.schemas.*]`)
- strict data-registry policy coverage when `data_registry.strict_schema = true`
- stage-schema policy shape for non-registry stages (when declared under `[stage_schemas.schemas.*]`)
- strict non-registry stage policy coverage when `stage_schemas.strict_schema = true`

## Preflight guarantees

Preflight is manifest-driven (`[preflight]`) and checks file-system prerequisites before runtime execution.

Behavior:
- aggregates required paths from `preflight.required_paths`
- includes stage-referenced assets/directories automatically
- resolves relative paths against configured or default workspace root
- can run in strict (`fail_on_missing = true`) or warn mode (`false`)

## Runner adapter guarantees

Runner configuration is manifest-driven (`[runner]`, `[runner.adapters]`).

Behavior:
- resolves adapter IDs by stage kind
- supports strict adapter binding (`strict_adapter_binding = true`)
- provides deterministic per-stage execution records for runtime host wiring
- supports built-in adapter execution preflight in `k-os-game-runtime` with per-stage success/failure status and detail payloads

Built-in adapter coverage in this increment:
- `scene`: validates scene asset readability, schema match, and actor array presence
- `kain_hot_reload`: validates source registry/watch-root topology and produces watch summary
- `data_registry`: validates registry `version` and `registry_kind` contract plus manifest-driven schema policy (`expected_version`, `supported_versions`, `required_tables`, optional `migration_hook`)
- `narrative_graph`: validates graph readability and entry-node viability
- `cook`: validates recipe TOML readability, input asset existence, and target-platform contract; emits cook contract artifact into stage `output_dir`
- `build`: validates build package TOML readability, cooked output directory contract, and target-platform contract; emits artifact directory contract and runtime executable placeholder
- `export`: validates export package TOML readability, source bundle directory existence, and package-format contract; emits export artifact at `export_path`

Packaging artifact provenance:
- `cook.contract.json` includes deterministic source hashes (`sha256`) for recipe and input assets plus discovered registry versions from `*.registry.toml` inputs.
- `build.contract.json` includes deterministic source hashes for package/executable assets plus upstream source contracts from cooked output and propagated registry versions.
- export artifact contract includes deterministic package hash plus upstream source contracts and propagated registry versions from build artifacts.

Data registry policy source:
- `[data_registry]`
- `[data_registry.schemas.<registry_kind>]`

Schema policy behavior:
- optional strict mode requiring every `data_registry` stage to have a matching schema policy
- version compatibility gate per registry kind
- migration hook gate when a supported legacy version is not the expected version
- required top-level table/array checks to catch malformed registries early

Non-registry stage schema policy source:
- `[stage_schemas]`
- `[stage_schemas.schemas.<stage_kind>]`

Non-registry policy behavior:
- currently targets `scene`, `kain_hot_reload`, `narrative_graph`, `cook`, `build`, and `export` stage kinds
- enforces `schema_version` presence for any stage kind with declared policy
- applies version compatibility gate (`expected_version` + `supported_versions`)
- requires `migration_hook` when stage `schema_version` is supported but not expected
- validates required payload fields declared under `required_fields`

## Runtime host bootstrap guarantees

`k-os-bevy` now consumes pipeline runtime data during host startup.

Boot behavior:
- resolves pipeline bootstrap config from environment data:
  - `KOS_GAME_PIPELINE_ENABLED` (default `true`)
  - `KOS_GAME_PIPELINE_MANIFEST` (default `${workspace_root}/src-game/config/pipeline.toml`)
  - `KOS_GAME_PIPELINE_WORKSPACE_ROOT` (default auto-detected workspace root)
  - `KOS_GAME_PIPELINE_PRESET` (optional launch preset id; profile aliases and `<profile>.default` supported)
  - `KOS_GAME_PIPELINE_PROFILE` (optional preferred profile id; defaults to `editor_preview` when present)
  - `KOS_GAME_PIPELINE_FAIL_FAST` (default `false`)
  - `KOS_GAME_PIPELINE_EMIT_ARTIFACTS` (default `true`)
- executes `k-os-game-runtime` bootstrap flow:
  - load + validate manifest
  - resolve `GameProductLaunchPreset` from a framework-owned launch preset matrix (`<profile>.default` + profile-id alias)
  - build deterministic execution plan
  - run preflight checks
  - run built-in adapter execution
- emits host-consumable startup messages for every stage execution record with:
  - stage id
  - stage kind
  - profile
  - adapter id
  - status
  - detail
- persists host-visible bootstrap state as a Bevy resource for downstream systems/plugins.
- persists launch preset state as `GameProductLaunchPreset` so host/runtime code can consume product identity, profile contracts, and bundled runtime-policy defaults without re-parsing manifest profile maps.

`k-os-bevy` also persists a data-driven gameplay registry cache resource from successful
`data_registry` stage records:
- ingests registry assets declared by stage payload (`registry_asset`) under the workspace root
- keys cache entries by manifest-declared `registry_kind`
- records runtime metadata per registry:
  - stage id
  - profile
  - merge strategy
  - resolved asset path
  - registry version
  - required-table entry counts derived from `[data_registry.schemas.<registry_kind>].required_tables`
- tracks ingest errors without hard-failing host startup when execution already succeeded

`k-os-bevy` now projects that cache into runtime-consumable gameplay bindings:
- resolves runtime gameplay policy from selected launch preset defaults:
  - `GameProductLaunchPreset.runtime_required_registry_kinds`
  - `GameProductLaunchPreset.runtime_strict_readiness`
- applies environment overrides when set:
  - `KOS_GAME_RUNTIME_REQUIRED_REGISTRIES`
  - `KOS_GAME_RUNTIME_STRICT_READINESS`
- derives runtime bindings from loaded registry assets:
  - input context -> action counts
  - gameplay tag domain -> value counts
  - actor archetype IDs
  - camera rig IDs
  - visual graph IDs
- applies cross-registry contract checks:
  - `hero.default.input_context` must resolve to a loaded input context
  - `hero.default.default_camera_rig` must resolve to a loaded camera rig
- persists runtime-facing resources for downstream ECS systems:
  - `GameRuntimeRegistryBindings`
  - `RuntimeReadinessState`

`k-os-bevy` also projects AI runtime ownership through `k-os-game-ai`:
- consumes `ai_agents` registry snapshots from `GameDataRegistryState`
- validates cross-table AI contracts:
  - every `agents[*].state_tree` must resolve in `state_trees[*].id`
  - every `agents[*].blackboard` must resolve in `[blackboards.*]`
- persists downstream AI-facing runtime state in:
  - `GameAiRuntimeState`
- runs deterministic data-driven AI decision ticks using registry-authored policy:
  - `[runtime_tick].phase_order`
  - `[runtime_tick].default_blackboard_value_template`
  - `[[decision_overrides]]` per agent + phase
- persists decision/mutation runtime state in:
  - `GameAiDecisionRuntimeState`

`k-os-bevy` now projects AI decisions into gameplay action bindings through `k-os-game-play`:
- consumes:
  - `GameAiDecisionRuntimeState`
  - `GameRuntimeRegistryBindings`
  - `actor_archetypes` registry route config under `[ai_action_projection]`
- validates action-route contracts:
  - `[[ai_action_projection.routes]]` requires:
    - `decision_prefix`
    - `gameplay_action`
  - optional route fields:
    - `agent`
    - `phase`
    - `input_action`
    - `camera_rig`
    - `priority`
- route selection is deterministic by:
  - highest `priority`
  - longest `decision_prefix` tie-break
- persists downstream gameplay-facing action projection state in:
  - `GameRuntimeActionBindings`

`k-os-bevy` now projects gameplay action bindings into camera-runtime ownership through `k-os-game-camera`:
- consumes:
  - `GameDataRegistryState` (`camera_rigs` snapshot)
  - `GameRuntimeRegistryBindings` (default player rig fallback)
  - `GameRuntimeActionBindings` (agent gameplay actions + optional camera hints)
  - `GameCameraDispatchState` (sequencer-derived camera rig override lane)
- validates camera registry contract:
  - required `[[rigs]]` entries with `id` + `mode`
  - required `[runtime_view]` table for host camera-application policy:
    - `apply_to_host_camera`
    - optional tuning fields:
      - `fallback_focus`
      - `fallback_arm_length`
      - `spring_arm_height_ratio`
      - `rail_height_offset`
      - `rail_distance_scale`
      - `freefly_height_offset`
      - `freefly_distance_scale`
      - `dispatch_intensity_radius_scale`
      - `dispatch_intensity_height_scale`
  - optional `[action_projection]` with `[[action_projection.routes]]`
    - required fields:
      - `gameplay_action_prefix`
      - `target_rig`
    - optional route fields:
      - `agent`
      - `phase`
      - `blend_seconds`
      - `priority`
  - required `[sequencer_projection]` with `[[sequencer_projection.routes]]`
    - required fields:
      - `binding_target_prefix`
      - `target_rig`
    - optional route fields:
      - `blend_seconds`
      - `min_intensity`
      - `priority`
- deterministic route selection:
  - highest `priority`
  - longest `gameplay_action_prefix` tie-break
- deterministic sequencer camera-dispatch ranking:
  - highest `priority`
  - longest `binding_target_prefix` tie-break
  - highest dispatch `intensity` tie-break
- deterministic camera fallback chain:
  - sequencer dispatch projected rig (`sequencer_projection.routes[*]`)
  - gameplay camera hint (`agent_camera_rigs`)
  - runtime default player rig
  - previous active rig (if still valid)
  - first declared camera rig in registry
- persists downstream camera-facing runtime state in:
  - `GameCameraDispatchState`
  - `GameCameraRuntimeState`
  - `GameCameraViewRuntimeState`
- host camera-application lane:
  - derives deterministic `orbit_focus`, `orbit_radius`, and `camera_translation` in `k-os-game-camera`
  - applies that state to Bevy `MainCamera` + `PanOrbitCamera` only when `runtime_view.apply_to_host_camera = true`

`k-os-bevy` now projects gameplay action bindings into sequencer-runtime ownership through `k-os-game-sequencer`:
- consumes:
  - `GameDataRegistryState` (`sequencer_timelines` snapshot)
  - `GameRuntimeActionBindings` (agent gameplay actions + active phase)
  - `GameCameraRuntimeState` (active rig/mode filters for cinematic route contracts)
- validates sequencer registry contract:
  - required `[[timelines]]` entries with `id`
  - optional `[action_projection]` with `[[action_projection.routes]]`
    - required fields:
      - `gameplay_action_prefix`
      - `target_timeline`
    - optional route fields:
      - `agent`
      - `phase`
      - `camera_rig`
      - `camera_mode`
      - `playback_rate`
      - `loop`
      - `priority`
      - `event`
  - optional `[playback_policy]` with:
    - `default_timeline`
    - `default_rate`
    - `allow_looping_default`
- deterministic route selection:
  - highest `priority`
  - longest `gameplay_action_prefix` tie-break
- deterministic sequencer fallback chain:
  - `playback_policy.default_timeline`
  - previous active timeline (if still valid)
  - first declared timeline in registry
- persists downstream sequencer-facing runtime state in:
  - `GameSequencerRuntimeState`

`k-os-bevy` now evaluates active sequencer timelines into deterministic runtime dispatch ownership through `k-os-game-sequencer`:
- consumes:
  - `GameDataRegistryState` (`sequencer_timelines` snapshot)
  - `GameSequencerRuntimeState` (active timeline/phase/agent)
  - `GameRuntimeActionBindings` + `GameCameraRuntimeState` (optional route filters)
- validates optional `[runtime_dispatch]` contract:
  - `default_track_intensity`
  - `max_tracks_per_frame`
  - `max_events_per_frame`
  - `[[runtime_dispatch.routes]]`
    - required: `track_prefix`
    - optional: `agent`, `phase`, `camera_mode`, `binding_target`, `effect_kind`, `event_id`, `intensity`, `priority`
- deterministic dispatch-route ranking:
  - highest `priority`
  - longest `track_prefix` tie-break
- runtime dispatch outputs:
  - bounded active-track projections (`tracks_loaded <= max_tracks_per_frame`)
  - bounded event emission from `event.*` tracks (`events_emitted <= max_events_per_frame`)
  - deterministic route keys for debugging/replay parity
- persists sequencer dispatch state in:
  - `GameSequencerTrackDispatchState`

`k-os-bevy` now projects gameplay action bindings into input-runtime ownership through `k-os-game-input`:
- consumes:
  - `GameDataRegistryState` (`input_bindings` snapshot)
  - `GameRuntimeRegistryBindings` (default player input context fallback)
  - `GameRuntimeActionBindings` (agent gameplay actions + optional input-action hints)
  - `GameCameraRuntimeState` (active rig -> camera mode policy lane)
- validates input registry contract:
  - required `[[contexts]]` entries with `id`
  - required `[[contexts.actions]]` entries with `id`
  - optional `[action_projection]` with `[[action_projection.routes]]`
    - required fields:
      - `gameplay_action_prefix`
      - `input_action`
    - optional route fields:
      - `agent`
      - `phase`
      - `context`
      - `priority`
  - optional `[input_policy]` with:
    - `default_camera_mode`
    - `[[input_policy.camera_mode_aliases]]` (`rig_prefix`, `mode`)
    - `[[input_policy.rules]]`:
      - optional match fields: `agent`, `phase`, `camera_mode`, `gameplay_action_prefix`, `input_action`
      - optional behavior fields: `allow` (default `true`), `scale` (default `1.0`), `reason`, `priority`
  - optional `[input_host]` with:
    - `axis_deadzone`
    - `activation_threshold`
    - `max_mouse_delta`
    - `[[input_host.digital_axes]]` (`token`, `axis`)
- deterministic route selection:
  - prefers explicit `GameRuntimeActionBindings.agent_input_actions`
  - otherwise selects highest `priority`
  - longest `gameplay_action_prefix` tie-break
- deterministic input-context fallback:
  - runtime default player input context
  - highest-priority declared context
- deterministic camera-policy evaluation:
  - highest `priority`
  - longest `gameplay_action_prefix` tie-break
  - explicit `input_action` match wins final ties
- camera-policy outcomes:
  - optional per-agent gate (`allow = false`) with authored reason
  - optional per-agent input scale (`scale`) for downstream trigger/modifier lanes
- persists downstream input-facing runtime state in:
  - `GameInputRuntimeState`
  - `GameHostInputFrame`
  - `GameInputIntentState`

`k-os-bevy` now applies host raw input events through `k-os-game-input`:
- captures host input into `GameHostInputFrame` each frame (keyboard tokens + normalized `mouse_delta`)
- projects `GameHostInputFrame` + `GameInputRuntimeState` into `GameInputIntentState`
- applies authored policy controls from `input_host` and existing per-agent gate/scale rules for deterministic intent output

`k-os-bevy` now projects input intents into gameplay execution dispatch through `k-os-game-play`:
- consumes:
  - `GameInputIntentState`
  - `GameDataRegistryState` (`input_bindings` snapshot)
- validates optional `[runtime_execution]` contract:
  - `[[runtime_execution.routes]]`
    - required fields: `input_action`, `command_kind`
    - optional match fields: `agent`, `phase`, `input_kind`
    - optional behavior fields: `vector_space`, `linear_scale`, `angular_scale`, `active_only`, `priority`
- validates optional `[runtime_execution_apply]` contract:
  - `fixed_step_seconds`, `max_linear_speed`, `max_angular_speed`, `max_frame_steps`, `inactive_decay`
- validates optional `[runtime_execution_effects]` contract:
  - `max_events_per_frame`, `default_replication_channel`
  - `[[runtime_execution_effects.routes]]`
    - required: `command_prefix`
    - optional: `effect_kind`, `replication_channel`, `emit_inactive`, `agent`, `phase`, `priority`
- validates optional `[runtime_execution_transport]` contract:
  - `max_journal_events`, `rollback_window_frames`
  - `default_lane`, `default_reliability`, `default_rollback`
  - `[[runtime_execution_transport.channel_routes]]`
    - required: `channel_prefix`
    - optional: `lane`, `reliability`, `rollback`, `priority`
- validates optional `[runtime_execution_transport_backends]` contract:
  - `max_payloads_per_frame`
  - `default_backend`, `default_payload_kind`, `default_max_events_per_payload`
  - `[[runtime_execution_transport_backends.lane_backends]]`
    - required: `lane_prefix`
    - optional: `backend`, `payload_kind`, `max_events_per_payload`, `priority`
- deterministic execution-route ranking:
  - highest `priority`
  - explicit `input_kind` match tie-break
  - explicit `phase` match tie-break
  - explicit `agent` match tie-break
- persists gameplay-execution dispatch state in:
  - `GameExecutionCommandState`
- persists gameplay-owned application state in:
  - `GameExecutionApplicationState`
- persists gameplay-owned effect-event state in:
  - `GameExecutionEffectsState`
- persists gameplay-owned transport journal state in:
  - `GameExecutionTransportState`
- persists gameplay-owned backend adapter payload state in:
  - `GameExecutionTransportBackendState`
- `k-os-bevy` now consumes gameplay-applied deltas/velocities from `GameExecutionApplicationState` to mutate runtime anchor transforms and motion components
- `k-os-bevy` reconciles deterministic execution effects from gameplay-owned state for replication/replay-facing diagnostics
- `k-os-bevy` reconciles deterministic execution transport journal projections from effect events with channel-to-lane/reliability mapping and rollback-window metadata
- `k-os-bevy` reconciles deterministic transport backend payload projections (lane -> backend/payload kind batching + export cursor) from gameplay transport journal state

`k-os-bevy` also exposes a thin runtime diagnostics surface:
- egui window `Game Runtime`
- summarizes bootstrap/readiness, AI, action, camera, sequencer, input, intent, execution-command, execution-application, and execution-effects state
- includes execution-transport journal diagnostics (`ingested`, `retained`, `rollback_floor`, `replay_fingerprint`)
- includes execution-transport-backend diagnostics (`payloads`, `lanes`, `exported_through`, `rollback_floor`, `backend_fingerprint`)
- shows runtime agent anchor transform/motion values for live pipeline inspection

## Planning guarantees

Execution planning is deterministic:
- topological order over dependencies
- stable ordering by stage ID for same-priority stages
- output includes typed payloads ready for runtime adapter integration

## Live pipeline data assets

Current data sources in `src-game/assets`:
- `scenes/sandbox.kscene`
- `narrative/intro.kgraph`
- `gameplay/input.registry.toml`
- `gameplay/tags.registry.toml`
- `gameplay/actors.registry.toml`
- `gameplay/ai.registry.toml`
- `gameplay/cameras.registry.toml`
- `gameplay/sequencer.registry.toml`
- `gameplay/visual_scripts.registry.toml`
- `packaging/windows.cook.toml`
- `packaging/windows.build.toml`
- `packaging/windows.export.toml`

## Next pipeline increments

1. Route `K_OS Game` launcher entry to this bootstrap lane (`pipeline.toml` + preflight + built-in execution report + `GameProductLaunchPreset` resource).
2. Add manifest-authored explicit launch preset maps for per-preset runtime policy divergence beyond profile-default presets.
3. Replace placeholder executable/export emitters with true platform packager backends (zip writer + runtime bundle layout).
4. Connect transport backend payload lanes to concrete runtime/network adapters (`state_stream`, `rpc_bus`, `rollback_store`) for host or multiplayer dispatch.

# K_OS Game Crate Architecture

Date: 2026-03-11

## Purpose

This document defines the intended crate ownership model for `K_OS Game`.
It exists to stop the game-engine effort from turning into a second monolith spread across `k-os-bevy`, `sources/game`, and whichever legacy crate happens to be convenient.

The core rule is simple:
- domain crates own reusable truth
- `k-os-game-*` crates compose those truths into a game-engine product
- `k-os-bevy` is the host adapter, not the long-term product identity

## Design goals

- support a credible high-end game-engine feature set without recreating Unreal as one giant crate
- preserve data-driven ownership and keep manifests, registries, and authored assets first-class
- keep Bevy useful as a host now without binding the architecture to Bevy forever
- make plugins, editor tooling, and future scripting surfaces possible without leaking raw engine internals everywhere

## Existing crate owners

These already exist and should remain authoritative in their current problem spaces:

- `k-os-scene`
  - canonical authored scene data and scene graph concepts
- `k-os-scene-runtime`
  - runtime-facing scene state projection
- `k-os-eval`
  - derived evaluation, graph evaluation, and runtime-ready transforms
- `k-os-renderer`
  - renderer-facing contracts and render graph ownership
- `k-os-gpu-pipeline`
  - shared GPU infrastructure
- `k-os-kain`
  - language/toolchain/source-registry ownership for gameplay scripts, shaders, and generated runtime artifacts
- `k-os-animation`
  - raw animation-domain primitives and lower-level animation support
- `k-os-rig`
  - skeleton, IK, skinning, and rig-related primitives
- `k-os-asset-pipeline`
  - import/process/export pipeline primitives
- `k-os-plugin`
  - general plugin infrastructure and isolation primitives
- `k-os-bevy`
  - runtime host, ECS shell, window/input/platform integration adapter

## Required game-engine product crates

These are the crates that should define the actual game-engine product spine.

### `k-os-game-runtime`

Status:
- exists now

Owns:
- pipeline manifest schema
- execution planning
- stage validation
- preflight checks
- adapter resolution
- stage execution reports
- packaging-stage orchestration contracts

Does not own:
- gameplay rules
- AI authoring/runtime
- cinematic authoring
- editor UX

### `k-os-game-framework`

Status:
- exists now

Owns:
- canonical game-object model above raw ECS
- prefab/archetype definitions and instantiation contracts
- gameplay entity identity and stable handles
- game session/world bootstrap model
- save/load-facing object identity contracts
- shared gameplay component schema definitions for the game product layer

Why it matters:
- this is the missing center of gravity between low-level scene data and actual game behavior

Current first ownership slice:
- pipeline bootstrap state
- gameplay registry ingest state
- registry snapshot contracts derived from successful pipeline execution
- launcher/profile preset resolution (`GameProductLaunchPreset`) from manifest-owned product + profile data
- framework-owned launch preset matrix (`<profile>.default` + profile alias) with bundled runtime-policy defaults per preset

### `k-os-game-play`

Status:
- exists now

Owns:
- gameplay rules and feature systems
- interaction model
- damage/health/team/faction patterns
- inventory/equipment rules
- quest or mission state integration hooks
- higher-level action semantics built on top of input
- runtime gameplay system composition

Why it matters:
- without this crate, gameplay logic gets smeared across the host, registries, scripts, and whatever app crate is active

Current first ownership slice:
- runtime gameplay policy from env
- runtime gameplay bindings projected from loaded registries
- readiness-state derivation from bootstrap plus registry state
- ai-decision to gameplay-action projection from actor-registry route tables (`[ai_action_projection]`)
- execution-command projection from `GameInputIntentState` through authored `[runtime_execution.routes]`
- execution-application projection through authored `[runtime_execution_apply]` fixed-step policy
- execution-effects projection through authored `[runtime_execution_effects.routes]` with replication-channel metadata
- execution-transport journal projection through authored `[runtime_execution_transport]` channel mapping + rollback-window policy
- execution-transport backend payload projection through authored `[runtime_execution_transport_backends.lane_backends]` lane->backend mapping policy
- runtime-owned `GameExecutionCommandState`, `GameExecutionApplicationState`, `GameExecutionEffectsState`, `GameExecutionTransportState`, and `GameExecutionTransportBackendState` for gameplay-owned dispatch/application/effect/transport/backend semantics

### `k-os-game-ai`

Status:
- exists now

Owns:
- state trees
- behavior trees or utility AI
- blackboards
- perception interfaces
- gameplay query contracts
- decision-runtime integration
- authoring/runtime schema for AI graphs and agents

Why it matters:
- if AI lives inside `k-os-game-play`, it will become too broad too quickly

### `k-os-game-camera`

Status:
- exists now

Owns:
- camera rigs
- camera mode stack
- camera transitions and blending
- rails and spline camera contracts
- shake/impulse/camera effects
- gameplay and cinematic camera policy bridging

Why it matters:
- camera systems are large enough to deserve a stable owner, especially if the target is UE-style sophistication

Current first ownership slice:
- camera rig runtime projection from `camera_rigs` registry
- gameplay-action to camera-rig routing from `[action_projection.routes]`
- sequencer-track dispatch to camera-rig projection from `[sequencer_projection.routes]` (`GameCameraDispatchState`)
- deterministic active-rig fallback and blend policy (`GameCameraRuntimeState`)
- data-driven host camera view projection from `[runtime_view]` + active rig spec (`GameCameraViewRuntimeState`)

### `k-os-game-sequencer`

Status:
- exists now

Owns:
- timeline data model
- cinematic track/clip/section model
- event tracks
- sequence playback runtime
- binding of sequences to gameplay objects, cameras, animation, and narrative triggers
- editor/runtime shared sequence contracts

Why it matters:
- sequencer is a product pillar, not a helper module

Current first ownership slice:
- sequencer timeline runtime projection from `sequencer_timelines` registry
- gameplay-action/camera-driven timeline routing from `[action_projection.routes]`
- deterministic active timeline fallback and playback policy (`GameSequencerRuntimeState`)
- deterministic timeline track evaluation and runtime dispatch from `[runtime_dispatch.routes]` (`GameSequencerTrackDispatchState`)

### `k-os-game-narrative`

Status:
- missing

Owns:
- dialogue graphs
- quest and narrative-state progression
- branching conversation contracts
- narrative runtime evaluation
- bridges into sequencer, gameplay events, and UI presentation

Why it matters:
- this is a likely strategic differentiator for `K_OS Game`, especially with Kain and graph-driven evaluation

### `k-os-game-visual-scripting`

Status:
- missing

Owns:
- visual script graph schema
- graph compiler or runtime VM contracts
- node/kernel registration
- graph execution model
- bridge into Kain-authored node kernels where appropriate
- editor/runtime interchange format

Why it matters:
- current registry groundwork is useful, but it is not yet an authoritative visual-scripting owner

### `k-os-game-input`

Status:
- exists now

Owns:
- enhanced-input-style action maps
- input contexts and priorities
- triggers and modifiers
- rebinding and profile persistence
- gameplay-facing input abstraction independent of raw host events

Why it matters:
- input is too important to stay just a registry shape inside bootstrap

Current first ownership slice:
- input runtime projection from `input_bindings` registry contexts/actions
- gameplay-action to input-action routing via optional `[action_projection.routes]`
- camera-coupled input policy via optional `[input_policy]` (`camera_mode_aliases` + `rules`)
- host-input policy via optional `[input_host]` (`axis_deadzone`, `activation_threshold`, `max_mouse_delta`, `digital_axes`)
- deterministic active-context fallback using runtime default player context + priority ordering
- runtime-owned `GameInputRuntimeState` for gameplay-facing agent input bindings, policy gates/scales, and route diagnostics
- runtime-owned `GameHostInputFrame` + `GameInputIntentState` for host-event application into deterministic, policy-aware input intents

### `k-os-game-ui`

Status:
- missing

Owns:
- game UI runtime contracts
- HUD/widget/screen schema
- UI bindings to gameplay and narrative state
- authored game-facing menus and overlays
- eventual bridge for plugin-authored UI extensions

Why it matters:
- this keeps game UI from being trapped as ad hoc editor or frontend shell code

### `k-os-game-build`

Status:
- missing

Owns:
- cook/package/export implementation
- platform target profiles
- cooked artifact manifests
- runtime bundling rules
- build graph integration for shipping/dev/editor targets

Why it matters:
- package/build/export is now modeled in pipeline data, but it still needs a real owner crate

### `k-os-game-editor`

Status:
- missing

Owns:
- game-product editor tools and panels
- inspectors and authoring commands
- editor-to-runtime bridge contracts
- content browser conventions specific to game authoring
- workflow composition across scene, gameplay, camera, sequencer, and narrative systems

Why it matters:
- editor concerns should not accumulate in `k-os-bevy` or random frontend folders without one product owner

## Recommended dependency direction

- low-level domain crates feed upward into `k-os-game-*` crates
- `k-os-game-*` crates may depend on domain crates and on each other in carefully limited ways
- `k-os-bevy` depends on game-product crates as host/runtime adapters
- `sources/game` holds product data, docs, assets, and pipeline manifests

Preferred direction:

- `k-os-scene` -> `k-os-game-framework`
- `k-os-scene-runtime` -> `k-os-game-framework`
- `k-os-eval` -> `k-os-game-framework`, `k-os-game-narrative`, `k-os-game-visual-scripting`
- `k-os-kain` -> `k-os-game-play`, `k-os-game-ai`, `k-os-game-visual-scripting`, `k-os-game-ui`
- `k-os-animation` and `k-os-rig` -> `k-os-game-sequencer`, `k-os-game-camera`, `k-os-game-play`
- `k-os-renderer` and `k-os-gpu-pipeline` -> `k-os-game-camera`, `k-os-game-ui`, `k-os-game-editor`
- `k-os-asset-pipeline` -> `k-os-game-build`
- `k-os-plugin` -> `k-os-game-editor`, `k-os-game-ui`, future plugin SDK layers
- `k-os-game-framework` -> `k-os-game-play`, `k-os-game-ai`, `k-os-game-camera`, `k-os-game-sequencer`, `k-os-game-narrative`, `k-os-game-visual-scripting`, `k-os-game-input`
- `k-os-game-runtime` -> pipeline/bootstrap orchestration into these crates
- `k-os-bevy` -> host adapter for runtime/editor sessions using the game crates

## Anti-patterns to avoid

- do not place foundational gameplay systems back into `k-os-bevy`
- do not create one mega-crate that owns gameplay, AI, cameras, sequencer, narrative, and UI together
- do not create a second source of truth for scene or asset state just because the game product needs special behavior
- do not let raw Bevy ECS types become the public product API
- do not make `k-os-game-runtime` mean both "pipeline runtime" and "all gameplay runtime systems"

## Recommended build order

The build order should follow ownership gaps, not feature fantasy.

### Phase 1: establish the core gameplay spine

- create `k-os-game-framework`
- create `k-os-game-play`
- create `k-os-game-ai`

This phase gives the engine a real game-facing ownership model.

Current status:
- `k-os-game-framework` created
- `k-os-game-play` created
- `k-os-game-ai` created (registry validation + data-driven decision tick/blackboard mutation runtime slice)
- `k-os-game-camera` created (registry-driven camera rig routing + runtime state projection)
- `k-os-game-sequencer` created (registry-driven timeline routing + playback policy state projection)
- `k-os-game-input` created (registry-driven input context/action projection from gameplay action runtime state)
- `k-os-game-input` expanded (camera-coupled policy gates/modifiers from `input_policy` registry data)
- `k-os-game-input` expanded (host-event application lane from `GameHostInputFrame` -> `GameInputIntentState` with registry-driven `input_host` policy)
- `k-os-game-play` expanded (execution-command projection from `GameInputIntentState` via authored `[runtime_execution.routes]`)
- `k-os-game-play` expanded (fixed-step execution application projection via authored `[runtime_execution_apply]`)
- `k-os-game-play` expanded (execution-effects projection via authored `[runtime_execution_effects]` for deterministic channelized effect events)
- `k-os-game-play` expanded (execution-transport backend payload projection via authored `[runtime_execution_transport_backends]` lane backend policy)

### Phase 2: establish product-defining systems

- expand `k-os-game-camera` beyond routing into camera mode stack, rails, and effect lanes
- create `k-os-game-sequencer`
- create `k-os-game-narrative`

This phase turns the engine from "playable runtime infrastructure" into a differentiated product.

### Phase 3: complete authoring and extensibility

- create `k-os-game-visual-scripting`
- create `k-os-game-ui`
- create `k-os-game-editor`
- create `k-os-game-build`

This phase completes the editor, plugin, and shipping pipeline story.

## Suggested first responsibilities per missing crate

To keep future runs disciplined, the first increment for each missing crate should be intentionally narrow.

- `k-os-game-framework`
  - prefab/archetype schema
  - stable game-object identity
  - runtime spawn contract
- `k-os-game-play`
  - gameplay session state
  - interaction and rule-system hooks
  - gameplay registry-to-runtime binding promotion
- `k-os-game-ai`
  - blackboard schema
  - state-tree schema
  - runtime decision tick contract
- `k-os-game-camera`
  - camera rig schema
  - blend contract
  - active camera stack resource
- `k-os-game-sequencer`
  - timeline schema
  - event track model
  - sequence runtime evaluation contract
- `k-os-game-narrative`
  - dialogue graph schema
  - narrative state resource
  - quest/event bridge contract
- `k-os-game-visual-scripting`
  - graph schema
  - node registration contract
  - runtime evaluation interface
- `k-os-game-input`
  - action map schema
  - trigger/modifier contract
  - runtime mapping state
- `k-os-game-ui`
  - screen/widget schema
  - gameplay-state binding contract
  - runtime HUD surface contract
- `k-os-game-editor`
  - tool/plugin registration contract
  - editor panel registry
  - authoring command bus
- `k-os-game-build`
  - cook/build/export implementation against existing pipeline stage data

## Bottom line

Yes, `K_OS Game` should have a gameplay crate.
But it should not stop there.

The right move is a coherent `k-os-game-*` product layer where:
- `k-os-game-framework` defines the game-facing model
- `k-os-game-play` owns gameplay systems
- specialized crates own AI, camera, sequencer, narrative, UI, and build
- `k-os-bevy` stays the host, not the identity

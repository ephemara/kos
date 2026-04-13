# K_OS Crates to Game Engine Map

Date: 2026-03-11

## Summary

`K_OS` already contains a large percentage of a serious engine stack.

The crates folder is not "supporting tech around an engine idea".
It is much closer to an engine platform whose domains still need to be unified into a coherent `K_OS Game` product.

The real work is:

- product unification
- runtime/editor integration
- canonical gameplay authoring model
- live iteration workflow
- clearer crate ownership for game-facing features

## Core finding

For a game engine, the crates break down into three groups:

1. already strategic engine owners
2. high-value game-engine feature domains
3. support/platform crates that should be composed into the product

## 1. Strategic engine owners

These are the crates that already look like the real backbone of a future engine.

### `k-os-scene`

Role:

- canonical authored state
- handles and component storage
- game-scene source-of-truth candidate

Why it matters:

- this should become the long-term home of authored game scene state, not raw Bevy ECS state
- matches the architecture standard's scene-data layer

Relevant files:

- `M:/K_OS/crates/k-os-scene/src/lib.rs`
- `M:/K_OS/docs/K_OS_ENGINE_ARCHITECTURE_STANDARD.md`

### `k-os-eval`

Role:

- DAG evaluation
- dirty propagation
- topological scheduling
- cached derived state

Why it matters:

- this is one of the strongest differentiators in the repo
- ideal for gameplay graph evaluation, animation derivation, material resolution, rig evaluation, build products, and live-preview invalidation
- strongly supports a "no legacy friction" workflow because derived state can stay centralized instead of getting smeared across random systems

Relevant files:

- `M:/K_OS/crates/k-os-eval/src/lib.rs`
- `M:/K_OS/docs/K_OS_ENGINE_ARCHITECTURE_STANDARD.md`

### `k-os-gpu-pipeline`

Role:

- pipeline cache
- buffer pooling
- staging
- performance telemetry
- hot reload support
- compute-heavy domain infrastructure

Why it matters:

- this is one of the most reusable engine-core crates in the repo
- should remain the authoritative GPU infrastructure owner across DCC and game runtime
- already gives you a stronger-than-average foundation for shader-heavy tooling, GPU simulation, and content processing

Relevant files:

- `M:/K_OS/crates/k-os-gpu-pipeline/README.md`
- `M:/K_OS/crates/reference.md`

### `k-os-renderer`

Role:

- viewport/session contract
- render graph
- selection/picking
- renderer service thread
- bridge boundary toward evaluated mesh sources

Why it matters:

- this is the long-term renderer identity candidate for `K_OS Game`
- even if Bevy is used as the current runtime host, this crate should own the renderer contract and scene-to-render interfaces
- it is already moving in the right direction through bridge contracts and service-based ownership

Relevant files:

- `M:/K_OS/crates/k-os-renderer/src/lib.rs`
- `M:/K_OS/docs/NATIVE_RENDERER_PROGRESS.md`

### `k-os-kain`

Role:

- source registry
- multi-target compile layer
- shader/runtime authoring boundary
- future gameplay scripting spine

Why it matters:

- this is the best shot at making the engine fundamentally more fluid than Unity/Unreal
- likely future owner for:
  - gameplay scripts
  - runtime behaviors
  - shaders/material graphs
  - tool scripts
  - graph-node execution kernels

Relevant files:

- `M:/K_OS/crates/k-os-kain/Cargo.toml`
- `M:/K_OS/src-frontend/kain/bridge/KAINBridge.ts`
- `M:/K_OS/src-frontend/systems/kain/KAINBridge.ts`

## 2. High-value game-engine feature domains

These crates are highly useful for a game engine and represent major feature leverage.

### `k-os-rig`

Role:

- skeletons
- skinning
- IK
- solver boundaries

Game-engine relevance:

- core character pipeline
- runtime retargeting and animation tooling foundation
- editor rig authoring and procedural rig support

### `k-os-animation`

Role:

- clip metadata
- mocap clip conversion baseline

Game-engine relevance:

- still smaller than the rest, but clearly intended as the animation domain owner
- should grow into authored animation clips, blend trees/state machines, runtime animation graphs, and sequencer/timeline interoperability

### `zen-mocap-engine`

Role:

- real-time GPU mocap
- IK solving
- motion synthesis
- DCC/runtime output
- Kain-authored compute chain

Game-engine relevance:

- not just a standalone product: also an engine-grade animation authoring and live character input domain
- can become a direct differentiator for animation, retargeting, procedural motion, runtime body driving, and virtual production

### `k-os-material`

Role:

- material library
- PBR definitions
- texture slots
- presets
- validation and serialization

Game-engine relevance:

- foundation for a unified material authoring model
- should connect to `k-os-kain` and `k-os-renderer` for runtime material/shader ownership

### `k-os-baking`

Role:

- normal/AO/curvature/thickness/ID baking
- GPU and CPU fallback paths

Game-engine relevance:

- strong content-pipeline value for game asset production
- directly supports authoring workflows for environment and character assets

### `k-os-mesh-processing`

Role:

- decimation
- repair
- subdivision
- UV unwrap
- optimization
- spatial queries

Game-engine relevance:

- exactly the kind of offline/authoring-side engine utility stack that reduces external-tool dependence
- important for import cleanup, LOD generation, collision proxies, optimization passes, and procedural mesh tooling

### `k-os-sim`

Role:

- CFD
- fluid
- physics
- quantum

Game-engine relevance:

- useful for effects, gameplay simulation, and specialty systems
- probably not phase-1 engine identity, but strategically powerful later

### `k-os-sculpt`

Role:

- GPU sculpt
- brush domain
- tangents
- viewport payload handoff

Game-engine relevance:

- mostly authoring-side rather than runtime-core
- still extremely valuable for the "integrated DCC + engine" strategy

### `k-os-asset-pipeline`

Role:

- import/export
- metadata extraction
- validation
- caching
- thumbnail generation
- scene/mesh/texture/material/animation asset types

Game-engine relevance:

- one of the most directly useful crates for a game engine editor
- can become the content browser/import pipeline backbone

### `k-os-io`

Role:

- storage
- asset metadata and handles
- compression
- transactions
- import/export storage backend

Game-engine relevance:

- essential for project storage, content addressing, asset DB behavior, and package/build outputs

### `k-os-plugin`

Role:

- dynamic plugins
- capabilities
- resource limits
- runtime loading

Game-engine relevance:

- strong foundation for extension and mod/plugin ecosystems
- should probably sit above a more product-specific game-plugin API later, but the substrate is already useful

### `k-os-undo`

Role:

- undo/redo
- merging
- memory budgeting

Game-engine relevance:

- editor-critical
- especially valuable for graph editing, content browser operations, scene edits, and animation editing

### `kos-proto`

Role:

- shared protocol
- Bevy/Tauri/React messaging
- TS bindings
- KRUE reactive UI protocol

Game-engine relevance:

- extremely useful for a remote/editor-hosted architecture
- already suggests a "single-source-of-truth protocol" model for editor/runtime/UI sync

## 3. Product support and host layers

These crates are important, but should remain composed support layers rather than the identity of the engine.

### `k-os-bevy`

Role:

- runtime host
- viewport app
- tool/UI surfaces
- leash IPC

Why it matters:

- this is the best bootstrap runtime and native host
- it is already doing meaningful product work
- but it should not become the only architectural owner of scene, renderer, or gameplay concepts

### `k-os-scene-runtime`

Role:

- runtime scene/mesh state split

Why it matters:

- useful as a bridge crate between scene authoring and live runtime state
- likely important for game-play mode and preview mode separation

### `k-os-wasm`

Role:

- web/WASM bridge

Why it matters:

- useful for browser tooling, preview, web deployment experiments, and Kain runtime targets

## Missing or underpowered for a full game-engine product

This is where the real gaps are.

### 1. Canonical gameplay framework crate

You do not yet have a clearly named game-runtime/gameplay domain owner such as:

- `k-os-game-runtime`
- `k-os-game-framework`
- `k-os-game-play`

That is the most obvious missing ownership boundary.

### 2. Full animation runtime and sequencer ownership

You have strong raw pieces, but not yet one clearly authoritative game-facing animation stack for:

- state machines
- blend trees
- playable graph
- cinematic sequencer
- timeline authoring
- event tracks
- retarget-runtime integration

### 3. Unified prefab / archetype / gameplay-entity authoring model

This is needed to turn the existing systems into a coherent game-engine workflow.

### 4. Build/export product pipeline for games

You have content and runtime pieces, but not yet the explicit game-product build lane:

- project packaging
- cooked asset outputs
- platform targets
- standalone runtime bundling

### 5. Canonical narrative / behavior graph domain

This is likely one of your biggest opportunities.
It does not appear to exist yet as an authoritative owner crate.

## Strongest product angle

The strongest `K_OS Game` angle is not "we also have rendering and ECS."

It is:

- integrated DCC + engine
- Kain-first live scripting and shaders
- graph-driven evaluation
- runtime/editor convergence
- mocap/rigging/animation sophistication as a native strength
- less external-tool dependence for content iteration

That is a real engine identity.

## Recommended game-engine crate map

Suggested new ownership layer:

- `crates/k-os-game-runtime`
- `crates/k-os-game-editor`
- `crates/k-os-game-framework`
- `crates/k-os-game-play`
- `crates/k-os-game-build`
- `crates/k-os-game-narrative`

Recommended dependency direction:

- `k-os-scene` owns authored entities/components
- `k-os-eval` owns derived evaluation
- `k-os-renderer` owns renderer contracts
- `k-os-gpu-pipeline` owns shared GPU infrastructure
- `k-os-kain` owns gameplay/script/shader source compilation
- `k-os-game-*` crates compose these into an actual engine product
- `k-os-bevy` remains runtime host/bootstrap layer

## Bottom line

The crates folder already contains enough useful tech to justify building a full game engine product on top of K_OS.

The next problem is not "do we have the firepower?"

The next problem is "how do we unify these owner crates into one clear game-engine authoring and runtime model without creating a second monolith?"

## Source notes

Primary local sources:

- `M:/K_OS/crates/reference.md`
- `M:/K_OS/docs/K_OS_ENGINE_ARCHITECTURE_STANDARD.md`
- `M:/K_OS/crates/k-os-renderer/src/lib.rs`
- `M:/K_OS/crates/k-os-gpu-pipeline/README.md`
- `M:/K_OS/crates/k-os-eval/src/lib.rs`
- `M:/K_OS/crates/k-os-rig/src/lib.rs`
- `M:/K_OS/crates/k-os-animation/src/lib.rs`
- `M:/K_OS/crates/k-os-material/README.md`
- `M:/K_OS/crates/k-os-plugin/README.md`
- `M:/K_OS/crates/k-os-baking/README.md`
- `M:/K_OS/crates/k-os-mesh-processing/README.md`
- `M:/K_OS/crates/zen-mocap-engine/README.md`

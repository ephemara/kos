# K_OS Domain Migration Task Doc

> Status: actionable repo task plan
>
> Scope: historical migration record for turning `k-os-engine` into a compatibility shell while moving ownership into domain crates. The crate now lives in `archive/k-os-engine/`.
>
> Basis: current workspace layout, `docs/K_OS_ENGINE_ARCHITECTURE_STANDARD.md`, `docs/CARGO_ARSENAL.md`, and `crates/reference.md`

## Executive Summary

The next meaningful architecture work is not "add more crates".
The workspace already contains `k-os-sculpt`, `k-os-sim`, and `k-os-io`.
At the time this document was written they were wrapper crates over `k-os-engine`, not real ownership boundaries.

The immediate job is to invert ownership:

1. finish making `k-os-kain` authoritative for KAIN source and shader registry concerns
2. finish making `k-os-gpu-pipeline` authoritative for shared GPU pipeline infrastructure
3. move domain code out of `k-os-engine`
4. keep `k-os-engine` as a compatibility shell until all first-order consumers migrate

## Current Structural Problems

These are the concrete issues this plan addresses.

- `crates/k-os-engine/src/modules/` is a catch-all for unrelated domains: sculpting, simulation, storage, rigging, paint, scatter, mesh primitives, core glue
- `crates/k-os-engine/src/gpu/pipelines/` mixes unrelated domains at one level: sculpt kernels, PBR generation, layer blend, subdivision, marching cubes tables, SPIR-V loading
- `crates/k-os-engine/src/brushes/` and `crates/k-os-engine/src/gpu/brush/` split one brush system across CPU metadata and GPU alpha generation/cache paths without a domain owner
- sculpt runtime is split between `crates/k-os-engine/src/modules/sculpting/sculpt.rs` and `crates/k-os-engine/src/gpu/pipelines/sculpt.rs`
- `crates/k-os-engine/src/material/animation.rs` is animation logic living in the wrong domain
- `crates/k-os-engine/src/gpu/brush/AlphaGen/` duplicates files that already exist in `crates/k-os-engine/src/gpu/brush/`
- `src-tauri` and `crates/k-os-bevy` still depend directly on `k-os-engine` internals instead of domain crates

## Dependency Rules

### Allowed

Feature crates may depend on:

- `k-os-scene`
- `k-os-eval`
- `k-os-gpu-pipeline`
- `k-os-kain`
- `k-os-animation`
- `k-os-material`

### Avoid

- feature crates depending sideways on each other
- renderer owning canonical scene state
- engine owning new foundational systems
- duplicated GPU infra in multiple crates
- Tauri commands implementing domain logic

## Target End State

### `k-os-engine`

Owns only:

- compatibility re-exports
- temporary shim modules
- migration notes
- legacy API forwarding for `src-tauri` and `crates/k-os-bevy`

Must not gain:

- new domain systems
- new canonical data models
- new shared GPU infrastructure

### `k-os-kain`

Authoritative for:

- KAIN domain directories
- source manifests
- compile helpers
- shader validation
- domain-to-source metadata

### `k-os-gpu-pipeline`

Authoritative for shared GPU infrastructure:

- device-adjacent pipeline cache
- shared buffer pool
- hot reload support
- common GPU upload bridges
- shared staging/readback helpers
- shader registry abstractions that are not sculpt-specific

Not authoritative for:

- sculpt business logic
- simulation solvers
- material semantics
- photogrammetry algorithms

## Target Ownership Map

This is the exact target crate for current `k-os-engine` paths.

### Keep in `k-os-engine` only as compatibility shell

- `crates/k-os-engine/src/lib.rs`
- `crates/k-os-engine/src/modules/mod.rs`
- `crates/k-os-engine/src/kain/mod.rs`
- temporary `pub use` re-exports that forward to real owner crates

### Move to `k-os-sculpt`

- `crates/k-os-engine/src/brushes/`
- `crates/k-os-engine/src/modules/sculpting/`
- `crates/k-os-engine/src/gpu/brush/`
- `crates/k-os-engine/src/gpu/pipelines/sculpt.rs`
- `crates/k-os-engine/src/gpu/pipelines/sculpt_*.wgsl`
- sculpt-facing pieces of `crates/k-os-engine/src/gpu/pipelines/spirv_loader.rs`
- sculpt-related tests:
  - `crates/k-os-engine/tests/brush_kain_integration.rs`
  - `crates/k-os-engine/tests/brush_profile_minimal.rs`

Target sub-layout:

- `crates/k-os-sculpt/src/brushes/`
- `crates/k-os-sculpt/src/runtime/`
- `crates/k-os-sculpt/src/gpu/brush/`
- `crates/k-os-sculpt/src/gpu/pipelines/`
- `crates/k-os-sculpt/src/kain/`
- `crates/k-os-sculpt/tests/`

### Move to `k-os-sim`

- `crates/k-os-engine/src/modules/simulation/`
- simulation-facing GPU kernels if later added under engine
- simulation command wrappers currently exposed through engine re-exports

Target sub-layout:

- `crates/k-os-sim/src/cfd/`
- `crates/k-os-sim/src/fluid/`
- `crates/k-os-sim/src/physics/`
- `crates/k-os-sim/src/quantum/`
- `crates/k-os-sim/src/runtime/`
- `crates/k-os-sim/tests/`

### Move to `k-os-io`

- `crates/k-os-engine/src/modules/storage/`
- `crates/k-os-engine/src/modules/file_ops.rs`
- import/export registries under `crates/k-os-engine/src/config/schemas/` that are purely IO-format related:
  - `export_formats.json`
  - `export_formats.schema.json`

Split inside `k-os-io`:

- import/export adapters
- storage engine
- file ops
- format registry

Important:
Keep import/export separate from storage in module layout even if both live in `k-os-io`.

Target sub-layout:

- `crates/k-os-io/src/import_export/`
- `crates/k-os-io/src/storage/`
- `crates/k-os-io/src/file_ops/`
- `crates/k-os-io/src/config/`
- `crates/k-os-io/tests/`

### Move to `k-os-rig` in a later phase

- `crates/k-os-engine/src/modules/rig/`

### Move to `k-os-photogrammetry` in a later phase

- `crates/k-os-engine/src/photogrammetry/`
- photogrammetry-specific GPU texture projection support that belongs to that domain

### Move to `k-os-animation`

- `crates/k-os-engine/src/material/animation.rs`
- related animation tests in `crates/k-os-engine/tests/animation_*`
- animation docs under `crates/k-os-engine/docs/task_8_*`

This is a correctness move, not a cosmetic one.
Animation code does not belong under `material/`.

### Keep in or route through `k-os-gpu-pipeline`

Shared infra should move here or be normalized here instead of being reimplemented in every domain:

- engine-level shared buffer pool concepts
- shared staging helpers
- common mesh upload bridge logic
- common performance monitoring
- pipeline cache behavior

Review and consolidate:

- `crates/k-os-engine/src/gpu/buffer_pool.rs`
- `crates/k-os-engine/src/gpu/staging.rs`
- generic pieces of `crates/k-os-engine/src/gpu/device.rs`
- mesh upload bridge logic already partially represented in `k-os-gpu-pipeline`

### Keep in `k-os-kain`

- `crates/k-os-kain/domains/`
- `crates/k-os-kain/manifests/`
- `crates/k-os-kain/src/lib.rs`

Consumers should depend on `k-os-kain` directly for domain/source registry metadata rather than routing through `k-os-engine::kain`.

## Move Order

This is the safest order for the repo as it exists today.

### Phase 0: establish boundaries without moving files yet

- stop adding new shared logic to `k-os-engine`
- stop adding new direct `k_os_engine::modules::*` imports in `src-tauri` and `crates/k-os-bevy`
- route all new domain-facing code through `k-os-sculpt`, `k-os-sim`, or `k-os-io`
- route all new KAIN registry work through `k-os-kain`
- route all new shared GPU infra through `k-os-gpu-pipeline`

### Phase 1: finish authority crates

#### 1A. Finish `k-os-kain`

- make `src-tauri` use `k-os-kain` directly wherever possible
- reduce `k-os-engine::kain` to forwarding shims
- move sculpt shader registry concepts out of engine-owned naming

#### 1B. Finish `k-os-gpu-pipeline`

- define the shared GPU infra surface
- migrate engine-local buffer/staging duplication toward it
- document what domains may own privately vs what must be shared

This phase must complete before large domain extraction.

### Phase 2: make `k-os-sculpt` the real sculpt owner

Order inside sculpt:

1. move CPU brush metadata and registries
2. move sculpt runtime and mesh handle logic
3. move GPU brush alpha system
4. move GPU sculpt pipeline
5. move sculpt KAIN/SPIR-V glue
6. delete `AlphaGen` duplication
7. convert engine exports to compatibility re-exports

### Phase 3: make `k-os-sim` the real simulation owner

Order inside sim:

1. move `cfd`
2. move `fluid`
3. move `physics`
4. move `quantum`
5. move Tauri commands to thin adapters calling `k-os-sim`

### Phase 4: make `k-os-io` the real IO owner

Order inside io:

1. move storage internals
2. move import/export adapters
3. move file ops
4. separate adapter modules from storage modules
5. move Tauri commands to thin adapters calling `k-os-io`

### Phase 5: add `k-os-rig`

Move:

- skeleton
- IK
- skinning
- solver
- command adapters

### Phase 6: add `k-os-photogrammetry`

Move the whole photogrammetry domain out together.
Do not strand half the feature in engine and half in the new crate.

### Phase 7: move animation to `k-os-animation`

Move:

- `material/animation.rs`
- animation tests
- animation-facing command and serialization helpers

### Phase 8: shrink `k-os-engine` to compatibility shell

At this point engine should mostly contain:

- `pub use` shims
- deprecation notes
- a small amount of compatibility glue

## Compatibility Shim Rules

Shims are allowed only to preserve build stability during migration.

### Allowed shim patterns

- `k-os-engine` re-exporting from owner crate
- thin adapter functions forwarding arguments and return values
- deprecated module paths preserved temporarily with comments

### Forbidden shim patterns

- copying implementation code into both old and new locations
- making the new crate call back into engine for domain behavior
- using shims as a permanent architecture

### Shim standard

Each shim should:

- be a one-hop forwarder only
- have a comment marking the owner crate
- avoid local state or branching
- be deleted after downstream callers migrate

## Safe To Parallelize

These tasks are safe to assign to separate agents with low collision risk.

### Safe now

- document the public API each wrapper crate should own
- inventory all `k_os_engine::*` imports in `src-tauri`
- inventory all `k_os_engine::*` imports in `crates/k-os-bevy`
- identify all direct engine imports in other crates
- design target module layout for `k-os-sculpt`
- design target module layout for `k-os-sim`
- design target module layout for `k-os-io`
- move tests from engine into target crates after code moves
- remove `gpu/brush/AlphaGen/` duplication after confirming no unique content

### Safe after Phase 1B

- consolidate shared staging/buffer infra into `k-os-gpu-pipeline`
- move brush registry and CPU sculpt runtime into `k-os-sculpt`
- move simulation modules into `k-os-sim`
- move storage/import-export into `k-os-io`

### Not safe to parallelize

- simultaneous edits to `crates/k-os-engine/src/lib.rs`
- simultaneous edits to `crates/k-os-engine/src/modules/mod.rs`
- simultaneous edits to the same Tauri command registration lists
- simultaneous broad search-and-replace of `k_os_engine` imports
- moving sculpt GPU code before `k-os-gpu-pipeline` shared infra rules are settled

## Immediate Task Backlog

These are the next concrete repo tasks.

### Task 1: codify authority boundaries

- update docs to state `k-os-kain` owns KAIN source registry
- update docs to state `k-os-gpu-pipeline` owns shared GPU infra
- mark `k-os-engine` as compatibility-first for new work

### Task 2: remove wrapper-crate inversion

Current bad direction:

- `k-os-sculpt -> k-os-engine`
- `k-os-sim -> k-os-engine`
- `k-os-io -> k-os-engine`

Target direction:

- `src-tauri -> k-os-sculpt|k-os-sim|k-os-io`
- `crates/k-os-bevy -> k-os-sculpt` and renderer-focused crates
- `k-os-engine -> owner crates` only for compatibility re-export

### Task 3: sculpt extraction plan

- create target folders inside `k-os-sculpt`
- move brush metadata first
- move sculpt runtime second
- move GPU sculpt third
- convert engine modules into re-export shims

### Task 4: simulation extraction plan

- move `modules/simulation/*` into `k-os-sim`
- keep Tauri commands as thin adapters
- avoid introducing a sim-specific duplicate GPU infra layer

### Task 5: IO extraction plan

- move `modules/storage/*`
- move `file_ops.rs`
- separate storage internals from import/export adapters

### Task 6: animation correctness move

- move `crates/k-os-engine/src/material/animation.rs` into `k-os-animation`
- update imports and tests

### Task 7: duplicate brush cleanup

- diff `gpu/brush/AlphaGen/` against `gpu/brush/`
- delete duplicates after verification
- keep one canonical location under sculpt ownership

## Success Criteria

The migration is succeeding when all of the following are true.

- new domain logic lands in owner crates, not `k-os-engine`
- `src-tauri` depends on owner crates for domain APIs
- `crates/k-os-bevy` depends on owner crates for sculpt and renderer-facing APIs
- `k-os-engine` mostly re-exports instead of implementing
- there is one canonical shared GPU infra crate
- there is one canonical KAIN registry crate
- there is no duplicate `AlphaGen` tree
- animation logic no longer lives under `material/`
- `modules/` and `gpu/pipelines/` stop acting as catch-all directories

## Notes For Agents

- prefer moving ownership before doing cosmetic folder cleanup
- do not move files into new crates while leaving dependency direction inverted
- do not add new foundational systems to `k-os-engine`
- if a helper is reusable across domains, evaluate `k-os-gpu-pipeline`, `k-os-scene`, or `k-os-eval` before placing it anywhere else
- if a shader/source registry concern is involved, default to `k-os-kain`

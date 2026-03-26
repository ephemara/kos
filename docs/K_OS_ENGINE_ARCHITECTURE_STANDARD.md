# K_OS Engine Architecture Standard

> Status: Proposed standard for future refactors
>
> Audience: K_OS core development, AI coding agents, engine contributors

## Purpose

This document defines the long-term architecture standard for K_OS as a large-scale DCC suite.

K_OS is not a single modeling app. It is a suite of interoperating systems:

- sculpt
- materials
- baking
- retopo
- rigging
- animation
- mocap
- simulation
- asset import/export
- viewport/rendering

Because of that, K_OS must not evolve as a pile of app-local mutable state.
It must evolve as a layered data/evaluation architecture with strict boundaries.

## Golden Rules

### 1. Data-Oriented, Not Object-Oriented

Heavy scene data must be stored in cache-friendly layouts.

- Prefer contiguous storage for transforms, mesh data, particle data, and animation streams.
- Separate data from logic.
- Avoid pointer-chasing across large graphs of small stateful objects.
- Treat the scene as a database, not as a nest of smart objects.

### 2. Library-First, Not Reinvent-Everything

Before building core infrastructure from scratch, audit the ecosystem first.

- Prefer battle-tested libraries for solved problems.
- Focus custom engineering effort on K_OS-specific workflows, evaluation, and GPU orchestration.
- New foundational code should require a strong reason to exist.

Examples of acceptable external dependency categories:

- math / color science
- mesh processing
- collision / ray queries
- serialization
- ECS storage
- animation clip primitives
- GPU support libraries

### 3. State Is Derived, Not Pushed

Scene evaluation must flow through a dependency graph.

- Operators consume inputs and produce outputs.
- Operators do not mutate unrelated global state directly.
- Dirty propagation and evaluation order are centralized.
- Lazy evaluation is preferred over eager recomputation.

## Core Architecture

K_OS standardizes on four layers.

### Layer 1: Scene Data Layer

This is the canonical source of truth for authored project state.

Responsibilities:

- stable entity/object IDs
- canonical scene components
- authored mesh references
- authored materials
- authored animation data
- authored mocap takes
- authored rig relationships
- authored app/tool state that belongs to the project

Rules:

- No rendering logic
- No GPU buffer ownership
- No derived caches
- No baked viewport data

Recommended implementation:

- `bevy_ecs` or equivalent ECS-style storage is acceptable here
- scene handles and stable IDs must be owned here

### Layer 2: Evaluation Layer

This is the brain of the engine.

Responsibilities:

- dependency graph (DAG)
- dirty propagation
- topological scheduling
- lazy evaluation
- cache lifetime management
- invalidation rules

Rules:

- determines what must recompute
- determines when something is clean or dirty
- determines evaluation order
- never hides side effects in random app code

Examples of evaluated nodes:

- mesh source
- sculpt deformation
- subdivision
- normals/tangents
- material resolution
- rig binding
- mocap retarget
- animation clip derivation
- viewport buffer build
- bake input preparation
- export artifact generation

### Layer 3: GPU Bridge Layer

This is the transport boundary between CPU-side data and GPU-side execution.

Responsibilities:

- buffer ownership
- staging/readback
- upload APIs
- shader-compatible struct contracts
- memory layout enforcement
- queue submission helpers

Rules:

- this is the only layer allowed to understand both scene/evaluation data and WGPU buffer mechanics
- all GPU-bound structs must use explicit, stable layout contracts
- operator crates must not independently invent ad hoc upload paths

Terminology:

- Use `zero-allocation GPU bridge` or `zero-repacking bridge`
- Do not casually call `queue.write_buffer()` "zero-copy"
- CPU->GPU transfer is still a copy on discrete memory architectures

### Layer 4: Operator Crates

These are the muscles of the suite.

Examples:

- sculpt
- mocap
- baking
- mesh processing
- rigging
- simulation
- materials

Responsibilities:

- consume inputs from the scene/evaluation system
- perform specific transforms or computations
- produce outputs back into evaluated nodes or artifacts

Rules:

- operators do not own canonical scene state
- operators may own local execution caches
- operators may own compiled pipelines / solver warm state / scratch buffers
- operators must not become alternate scene databases

## ECS and DAG

### Policy

ECS is allowed and recommended for scene storage.
DAG is still required for derived evaluation.

Why:

- ECS solves data layout, scheduling, and component access
- DAG solves dependency ordering, invalidation, and lazy recomputation

K_OS must not confuse the two.

### Approved Hybrid Model

- ECS stores source components
- DAG tracks derived nodes and dependencies
- GPU bridge materializes evaluated data into GPU buffers
- operators execute against those buffers and evaluated handles

## GPU Data Contract Standard

All GPU-facing structs must follow strict rules.

Rules:

- use explicit layout (`#[repr(C)]` in Rust)
- derive `Pod` / `Zeroable` where appropriate
- match WGSL/SPIR-V memory layout exactly
- use a single source of truth for GPU-facing struct shape

Recommended pattern:

- Rust host struct
- shader struct
- generated or validated compatibility

AI agent rule:

- if an agent adds a new shader-visible struct, it must also add or update the exact host-side memory contract

## Forbidden Patterns

The following are architecture violations.

- feature UI owning canonical scene state
- ad hoc cross-app mutation through direct global object access
- operator crates reaching into unrelated app state
- multiple independent upload pipelines for the same data class
- temporary `Vec` repacking of large GPU-bound datasets unless explicitly justified
- app-local caches pretending to be source of truth
- "update everything on every frame" when a dirty/lazy path is possible

## Recommended Crate Direction

K_OS already has several good crate boundaries:

- `k-os-mesh-processing`
- `k-os-material`
- `k-os-baking`
- `k-os-gpu-pipeline`
- `k-os-undo`
- `k-os-asset-pipeline`
- `zen-mocap-engine`

`k-os-engine` is still too broad.

### Recommended future split

These are target boundaries, not mandatory immediate moves.

- `k-os-scene`
  - canonical scene data
  - stable handles
  - IDs / scene component schemas

- `k-os-eval`
  - DAG
  - dirty flags
  - dependency scheduling
  - cache invalidation policy

- `k-os-animation`
  - animation clip data
  - retarget outputs
  - timeline/sequencer-facing derived data

- `k-os-sculpt`
  - sculpt operators
  - deformation node evaluation

- `k-os-sim`
  - CFD / fluid / particle / physics operators

- `k-os-io`
  - import/export adapters
  - file format transformations

Existing specialized crates should remain specialized where possible.

### Important constraint

Do not split `k-os-engine` into many crates before the data and evaluation contracts are defined.

Correct order:

1. define scene data contracts
2. define DAG contracts
3. define GPU bridge contracts
4. move operators behind those contracts
5. then split crates by stable boundaries

## Migration Strategy

### Phase 1: Standardize contracts

- define shared scene handles
- define node/evaluation interfaces
- define GPU bridge API
- define artifact metadata contracts

### Phase 2: Introduce evaluator

- start with a small DAG for mesh and animation dependencies
- keep old imperative flows working while the graph becomes authoritative

### Phase 3: Migrate high-value systems

Priority order:

1. mesh -> subdivision -> normals -> viewport buffers
2. mocap take -> retarget -> animation asset
3. material assignment -> preview -> bake input
4. export artifact generation

### Phase 4: Extract crates

- move code only after boundaries are already real

## How AI Agents Should Work In This Repo

AI agents must follow these rules:

- do not invent new foundational systems when an existing crate or library already fits
- prefer extending scene/evaluation contracts over adding special-case app glue
- keep data contracts centralized
- do not add hidden mutations across features
- when building GPU paths, enforce layout correctness and reuse the bridge layer
- when in doubt, add metadata and registries rather than ad hoc branching

## Short Decision Summary

- Yes to data-oriented design
- Yes to library-first
- Yes to ECS for source data
- Yes to DAG for derived state
- Yes to a strict GPU bridge layer
- Yes to splitting `k-os-engine`
- No to using ECS alone as a replacement for the evaluator
- No to calling all CPU->GPU transfer "zero-copy"
- No to arbitrary crate splitting before contracts exist

## Current Assessment of K_OS

Today K_OS already contains pieces of the future architecture:

- identity/registry systems
- local node graph systems
- GPU pipeline/cache infrastructure
- dirty flag mechanisms
- specialized engine crates

But it does not yet have a single suite-wide dependency/evaluation layer.

That is the next major architectural milestone.

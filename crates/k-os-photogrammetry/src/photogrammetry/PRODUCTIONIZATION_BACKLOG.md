# Photogrammetry Productionization Backlog

Date: 2026-03-11
Owner crate: `crates/k-os-photogrammetry`
Scope: Convert TODO-heavy surfaces into an executable backlog with clear implementation ownership.

## Current status summary
- Orchestrator-level input validation is in place in `mod.rs`.
- PBR extraction now has configurable heuristics and tests.
- Reconstruction now uses DLT triangulation with reprojection filtering and deterministic fixture tests.
- Core pipeline still contains algorithmic placeholder implementations for mesh generation fallback behavior and parts of PBR baking.
- Mesh generation now uses an explicit strategy/fallback config contract instead of implicit fallback behavior.
- PBR extraction now validates renderer-facing map contracts (dimensions/channels/pixel-length, with optional non-uniformity constraints).
- Crate unit tests pass; crate is not yet production-ready without algorithm and integration completion.

## TODO classification by file

### Algorithmic placeholders
- `reconstruction.rs`
  - Replace synthetic point cloud generation with DLT-based triangulation + reprojection error filtering.
- `mesh_generation.rs`
  - [x] Introduce explicit `MeshGenerationConfig` strategy/fallback contract so placeholder behavior is declarative. (Completed 2026-03-11)
  - Replace triangle-fan interim path with production reconstruction strategy (Poisson/marching cubes or stable bridge path).
- `texture_projection.rs`
  - Improve pose-aware weighting model with geometry visibility and seam-aware blending quality metrics.
- `pbr_extraction.rs`
  - [x] Normal map: geometry-informed UV bake with deterministic fallback for unsampled texels. (Completed 2026-03-11)
  - Roughness/metallic: move from heuristics to calibrated estimators.
  - AO/height: replace uniform defaults with geometry-driven bake paths.
- `feature_matching.rs`
  - [x] Replace identity placeholder with normalized 8-point estimation + rank-2 enforcement. (Completed 2026-03-11)
  - [x] Upgrade relative-pose estimation from fixed translation placeholder to essential matrix decomposition with cheirality candidate selection. (Completed 2026-03-11)
  - Add robust refinement/re-scoring pass after RANSAC model selection to improve outlier rejection quality.

### Integration gaps
- Frontend photogrammetry authoring/service flow is still not first-class in suite UX.
- Renderer/material integration of extracted PBR maps is not validated end-to-end in crate-level integration tests.
- Python/Open3D bridge behaviors are documented but not contract-tested through this crate.

### Test gaps
- Missing deterministic fixture-based reconstruction tests.
- Missing cross-language integration tests for bridge failure/success paths.
- Missing property-based tests for geometry and map invariants.

## Priority backlog

### P0 (next two passes)
1. [x] Implement DLT triangulation with deterministic fixture test coverage. (Completed 2026-03-11)
2. [x] Replace texture projection checkerboard with minimal real multi-view blending path. (Completed 2026-03-11)
3. [x] Add end-to-end smoke test fixture proving non-placeholder point cloud/mesh/atlas generation. (Completed 2026-03-11)

### P1
1. Implement production mesh generation owner path (native or bridge) behind the `MeshGenerationConfig` strategy contract.
2. Add integration test coverage for Python bridge and failure handling semantics.
3. [x] Add renderer-facing validation for PBR map dimensions/channels and non-uniformity expectations. (Completed 2026-03-11)
4. Add iterative multi-view pose-graph optimization/bundle-adjustment pass after pairwise essential decomposition.

### P2
1. Upgrade PBR estimators to physically-grounded methods calibrated on capture datasets.
2. Add quality metrics harness (reprojection error, coverage, seam/blend quality, PBR map confidence).
3. Add memory/performance benchmark suite for 2/20/100 image runs.

## Low-risk hardening landed this pass
- Removed feature-gated warning drift in `feature_detection.rs` by:
  - gating `Context` import to `feature = "photogrammetry"`
  - allowing unused variables only on non-photogrammetry build path for wrapper methods
- Added explicit mesh-generation ownership contract in `mesh_generation.rs`:
  - `MeshGenerationConfig` + typed `MeshGenerationStrategy` and `SparseCloudFallback`
  - default behavior remains compatibility-safe (`triangle_fan_compat` + `compatibility_quad`)
  - new unit test verifies alternate sparse-cloud fallback (`empty_mesh`) contract path

## Definition of production-ready (target)
- No placeholder geometry/texture stages on default photogrammetry path.
- Fixture-backed deterministic tests for reconstruction and texture output.
- Explicitly versioned extraction/config contracts for downstream renderer/material consumers.
- Documented failure modes and recovery behavior for all bridge boundaries.

# Prompt 11 - Photogrammetry Productionization Audit

Date: 2026-03-11
Scope: `crates/k-os-photogrammetry`

## Summary
This pass converts photogrammetry TODOs from scattered comments into an executable backlog and lands a low-risk runtime hardening change in the orchestrator.

## Landed code changes
- Added centralized input validation in `PhotogrammetryPipeline::validate_input`.
- `reconstruct` now fails fast on invalid requests before entering expensive pipeline stages.
- Added unit tests for valid input and two common invalid-input classes.

### Validation now enforces
- Input image count range: 2-500.
- Non-zero, bounded processing options (`max_features`, `min_matches`, `texture_resolution`).
- `mesh_quality` finite and within `0.0..=1.0`.
- Per-image RGBA buffer integrity (`width * height * 4`) with overflow-safe checks.
- Camera intrinsic sanity for focal length, principal point, and distortion coefficients.

## TODO classification

### Algorithmic placeholders
- `reconstruction.rs`: real DLT triangulation.
- `mesh_generation.rs`: Poisson/marching-cubes ownership in Rust-native path or robust bridge.
- `texture_projection.rs`: multi-view projection and blending quality path.
- `pbr_extraction.rs`: real normal/roughness/metallic/AO/height estimators.
- `feature_matching.rs` (doc-declared): full 8-point + robust refinement path where needed.

### Integration gaps
- Frontend photogrammetry service/UI flow is still TODO in implementation docs.
- Renderer/material pipeline usage of extracted PBR maps is not validated in production paths.
- Python/Open3D and GPU shader paths are described but not fully exercised by crate-level integration tests.

### Test gaps
- End-to-end reconstruction test fixtures (real image sets) are missing.
- Cross-language RPC integration tests are missing.
- Property-based invariants for map completeness and geometry integrity are missing.

## Backlog (priority order)
1. P0: Add reconstruction fixture tests (`small`, `medium`) with deterministic acceptance criteria.
2. P0: Implement DLT triangulation in `reconstruction.rs` with reprojection-error assertions.
3. P1: Replace mesh-generation stub with a production path (bridge or native) behind explicit strategy selection.
4. P1: Add integration test for Python/Open3D bridge and failure handling.
5. P1: Replace texture projection checkerboard fallback with multi-view weighted blending.
6. P2: Upgrade PBR extraction heuristics to physically grounded estimators with validation metrics.

## Architectural notes
- This run intentionally avoided expanding placeholder algorithms in-place without tests.
- The validation gate reduces invalid-data fanout and aligns with future distributed or queued photogrammetry execution.
- Next pass should target one P0 algorithmic owner change plus fixture-driven tests in the same PR.

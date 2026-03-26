# Prompt 11 - Photogrammetry Mesh Generation Strategy Contract Pass

Date: 2026-03-11
Scope: `crates/k-os-photogrammetry/src/photogrammetry/mesh_generation.rs`

## What changed
- Added `MeshGenerationConfig` as the explicit ownership contract for mesh generation behavior.
- Added `MeshGenerationStrategy` (`triangle_fan_compat`) as the first strategy enum, making interim topology behavior explicit.
- Added `SparseCloudFallback` enum with two outcomes:
  - `compatibility_quad` (default, legacy-safe)
  - `empty_mesh` (strict fallback for downstream ownership)
- Added `MeshGenerator::with_config(...)` to enable data-driven strategy selection.
- Preserved `MeshGenerator::new(...)` behavior via default config to avoid regressions.
- Added test `test_sparse_cloud_empty_fallback_returns_empty_mesh` validating fallback policy behavior.
- Re-exported mesh config and policy types through photogrammetry `mod.rs` so API consumers can configure behavior through crate-owned contracts.

## Architectural impact
- Replaces implicit sparse-cloud handling with a typed domain contract.
- Enables future production mesh owners (Poisson/marching-cubes/bridge) to plug into `MeshGenerationStrategy` without changing the orchestrator API.
- Improves pipeline clarity while keeping current behavior stable by default.

## Remaining high-priority backlog
1. Implement a production strategy variant under `MeshGenerationStrategy` and promote it to default when validated.
2. Add deterministic quality/completeness metrics to compare strategy outputs.
3. Validate strategy selection from renderer-facing integration path to ensure no hidden fallback drift.

## Verification
- `cargo test -p k-os-photogrammetry` (pass; includes new sparse-fallback test)

# Prompt 11 - Photogrammetry Normal Map UV Bake Hardening (2026-03-11)

## Context
Prompt 11 (Photogrammetry Productionization Audit) still listed normal-map extraction as a TODO in `pbr_extraction.rs`.
The prior implementation emitted a fully flat normal map for every texel, which hid geometric signal and made quality validation weak.

## What changed
- Replaced the flat normal placeholder implementation in `crates/k-os-photogrammetry/src/photogrammetry/pbr_extraction.rs` with a geometry-informed UV splat bake:
  - Uses `(uv, normal)` vertex pairs from `TriangleMesh`.
  - Normalizes and accumulates normals into mapped texture texels.
  - Averages and re-normalizes per texel before encoding to RGB normal-map space.
  - Falls back to configured `flat_normal_rgb` for texels without valid samples.
- Added helper encoding function for deterministic `[-1, 1] -> [0, 255]` conversion.
- Added tests:
  - `test_normal_map_generation_uses_mesh_uv_normals`
  - `test_normal_map_generation_falls_back_when_mesh_samples_missing`

## Architectural impact
- Improves productionization without changing external API contracts.
- Keeps behavior data-driven through `PBRExtractionConfig.flat_normal_rgb` fallback.
- Reduces placeholder behavior in a renderer-facing output map while preserving safety for sparse/invalid geometry inputs.

## Verification
- `cargo test -p k-os-photogrammetry`
  - Result: pass (33 passed, 0 failed)

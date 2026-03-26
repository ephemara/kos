# Prompt 11 - Photogrammetry PBR Extraction Heuristics Pass

Date: 2026-03-11
Scope: `crates/k-os-photogrammetry/src/photogrammetry/pbr_extraction.rs`

## What changed
- Introduced `PBRExtractionConfig` as a typed data surface for fallback values and heuristic thresholds.
- Added `PBRExtractor::with_config(...)` so future domain owners can inject profile-specific extraction behavior without touching algorithm code.
- Added atlas buffer integrity validation in `extract_albedo` to fail early on malformed atlas payloads.
- Replaced uniform roughness placeholder map with deterministic luminance-variance roughness estimation.
- Replaced uniform metallic placeholder map with deterministic brightness/saturation heuristic classification.
- Routed flat-normal, AO, and height defaults through config instead of inline literals.
- Added focused unit tests for new roughness and metallic estimators.

## Architectural impact
- Moves extraction behavior away from scattered literals toward a single typed config contract.
- Keeps placeholder status explicit while providing materially better signal maps for downstream renderer/material integration testing.
- Preserves backward compatibility via `Default` config and unchanged `PBRExtractor::new(...)` behavior.

## Remaining high-priority backlog
1. Replace heuristic roughness/metallic with physically grounded estimators calibrated against capture datasets.
2. Implement geometry-aware normal and height baking (mesh-space and tangent-space correctness).
3. Add AO bake path and quality metrics harness for confidence thresholds.
4. Add integration test that validates non-uniform map outputs through renderer/material preview path.

## Verification
- `cargo test -p k-os-photogrammetry` (pass; 15 tests)
- Existing crate warnings remain in `feature_detection.rs` and are unchanged by this pass.

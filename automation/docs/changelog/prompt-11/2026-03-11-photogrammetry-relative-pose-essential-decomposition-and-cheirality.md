# Changelog - Prompt 11 Photogrammetry Productionization

Date: 2026-03-11
Scope: `crates/k-os-photogrammetry`

## What changed
- Replaced fixed-translation relative pose placeholder in `feature_matching.rs` with an essential-matrix decomposition pipeline.
- Added intrinsics-derived calibration matrix support for pose estimation and essential-matrix constraint enforcement before decomposition.
- Implemented four-candidate `(R, t)` hypothesis generation and cheirality scoring through triangulated correspondence checks.
- Added normalized triangulation helper used only for candidate validation in pose selection.
- Fixed reverse-direction pose graph propagation by inverting the relative pose when resolving unknown `image_a` from known `image_b`.
- Added deterministic unit tests for:
  - synthetic fixture translation-direction recovery in relative pose estimation
  - minimum-correspondence guard behavior for relative pose estimation
- Updated photogrammetry backlog/README to record placeholder removal and refocus next steps on optimization and remaining production gaps.

## Why it matters
- Removes a major algorithmic placeholder from the default SfM pipeline path.
- Improves geometric consistency of camera pose initialization before downstream triangulation and mesh generation.
- Leaves a clearer production roadmap where next risk is optimization quality rather than missing core geometry math.

## Verification
- `cargo test -p k-os-photogrammetry` passed (27/27).

## Next up
- Add bundle-adjustment/pose-graph refinement after pairwise essential decomposition.
- Continue replacing mesh and PBR extraction compatibility fallbacks with production owner paths.

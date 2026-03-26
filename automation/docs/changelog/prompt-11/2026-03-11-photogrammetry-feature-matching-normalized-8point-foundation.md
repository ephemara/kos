# Changelog - Prompt 11 Photogrammetry Productionization

Date: 2026-03-11
Scope: `crates/k-os-photogrammetry`

## What changed
- Implemented normalized 8-point fundamental matrix estimation in `feature_matching.rs`.
- Added rank-2 enforcement and matrix denormalization to produce valid epipolar geometry candidates during RANSAC.
- Replaced simplified keypoint-distance epipolar error with Sampson-distance approximation.
- Made RANSAC deterministic using seeded RNG (`StdRng::seed_from_u64(42)`) for stable automation and test behavior.
- Added deterministic tests for:
  - fixture correspondence fit quality under estimated fundamental matrix
  - degenerate correspondence rejection in estimator
  - outlier-contaminated set handling in RANSAC
- Updated crate docs/backlog to reflect completion of the fundamental matrix placeholder removal.

## Why it matters
- Moves a core photogrammetry stage from placeholder behavior to geometry-backed estimation.
- Reduces false confidence from identity-matrix scoring and improves inlier selection quality.
- Provides deterministic test and execution behavior suitable for recurring automation passes.

## Verification
- `cargo test -p k-os-photogrammetry` passed (25/25).

## Next up
- Replace simplified relative pose estimation with essential matrix decomposition and cheirality validation.

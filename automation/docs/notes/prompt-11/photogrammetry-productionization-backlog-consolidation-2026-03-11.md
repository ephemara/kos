# Prompt 11 - Photogrammetry Productionization Backlog Consolidation

Date: 2026-03-11
Scope: `crates/k-os-photogrammetry`

## Summary
This Prompt 11 continuation converts the remaining photogrammetry TODO surface into a crate-local executable backlog and lands a low-risk compile-hygiene cleanup in feature-gated code paths.

## Code updates
- Updated `crates/k-os-photogrammetry/src/photogrammetry/feature_detection.rs`:
  - gated `anyhow::Context` import behind `feature = "photogrammetry"`
  - added `cfg_attr(not(feature = "photogrammetry"), allow(unused_variables))` on wrapper methods that intentionally no-op without the feature
- Result: crate-level warning drift was removed for default build/check paths.

## Documentation updates
- Added authoritative crate-local backlog:
  - `crates/k-os-photogrammetry/src/photogrammetry/PRODUCTIONIZATION_BACKLOG.md`
- Linked backlog from photogrammetry module README:
  - `crates/k-os-photogrammetry/src/photogrammetry/README.md`

## Productionization backlog model
- TODOs are classified into:
  - Algorithmic placeholders
  - Integration gaps
  - Test gaps
- Work is prioritized by P0/P1/P2 with concrete next-pass slices and owner intent.

## Verification
- `cargo check -p k-os-photogrammetry --lib` (pass)
- `cargo test -p k-os-photogrammetry --lib` (pass, 15/15)

## Next best slice
- Implement DLT triangulation with deterministic fixture tests as first P0 algorithm pass.

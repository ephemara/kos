# 2026-03-11 - Prompt 11 - Photogrammetry normal-map UV bake hardening

## Summary
Implemented a low-risk productionization slice in photogrammetry PBR extraction by replacing uniform flat normal-map output with geometry-informed UV baking plus deterministic fallback.

## Code changes
- Updated `crates/k-os-photogrammetry/src/photogrammetry/pbr_extraction.rs`:
  - Replaced `generate_normal_map(...)` placeholder path.
  - Added normal accumulation/normalization across UV-mapped texels.
  - Added fallback logic for unsampled texels using `flat_normal_rgb`.
  - Added normal component encoder helper.
  - Added two unit tests for non-uniform geometric output and fallback behavior.
- Updated docs:
  - `crates/k-os-photogrammetry/src/photogrammetry/PRODUCTIONIZATION_BACKLOG.md`
  - `crates/k-os-photogrammetry/src/photogrammetry/README.md`

## Verification
- `cargo test -p k-os-photogrammetry` => pass (33/33)

## Notes
This keeps roughness/metallic and AO/height TODOs intact, but removes one remaining normal-map placeholder in the default extraction path.

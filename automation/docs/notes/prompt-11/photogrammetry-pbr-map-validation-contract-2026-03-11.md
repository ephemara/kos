# Prompt 11 Notes: Photogrammetry PBR Validation Contract

Date: 2026-03-11
Prompt: 11 - Photogrammetry Productionization Audit

## What was implemented
- Added a typed, data-driven renderer-facing contract for photogrammetry PBR outputs in `pbr_extraction.rs`.
- Introduced map identifiers and validation schema:
  - `PBRMapKind`
  - `TextureValidationRule`
  - `PBRMapValidationContract`
- Extended `PBRExtractionConfig` with `validation_contract` and defaults.
- Added `PBRMaps::validate_against(...)` to enforce:
  - width/height alignment against atlas dimensions
  - expected channels per map
  - expected pixel buffer length
  - optional non-uniformity requirements
- Wired contract validation into `PBRExtractor::extract(...)` for fail-fast validation.
- Re-exported contract types from `photogrammetry::mod.rs` for downstream consumption.

## Why this matters
- Makes renderer integration assumptions explicit and testable.
- Prevents silent propagation of malformed PBR outputs into downstream material pipelines.
- Keeps validation behavior configurable through typed data, not hardcoded call-site logic.

## Tests added
- `test_extract_validates_renderer_contract_success_path`
- `test_extract_fails_on_contract_channel_mismatch`
- `test_extract_fails_on_required_non_uniformity`

## Verification
- Command: `cargo test -p k-os-photogrammetry`
- Result: pass (31 passed, 0 failed)

## Architectural note
- This tranche lands a low-risk P1 backlog item without changing ownership boundaries.
- Remaining productionization work still includes mesh-generation owner path, Python bridge integration tests, and bundle-adjustment refinement.

# 2026-03-11 - Prompt 11 - Photogrammetry PBR Heuristics + Config Hardening

## What changed
- Added typed `PBRExtractionConfig` and `PBRExtractor::with_config(...)` in photogrammetry PBR extraction.
- Added atlas pixel-buffer length validation before albedo extraction.
- Upgraded roughness and metallic placeholder generation from uniform constants to deterministic texture-driven heuristics.
- Added tests covering roughness variability and metallic classification behavior.
- Added run note:
  - `automation/docs/notes/prompt-11/photogrammetry-pbr-extraction-heuristics-2026-03-11.md`

## Why
Prompt 11 requires productionization progress without unsafe overreach. This pass improves output quality and configurability while preserving existing orchestration boundaries and low regression risk.

## Verification
- `cargo test -p k-os-photogrammetry` (pass)

## Result
- Photogrammetry PBR extraction now has a data-driven configuration boundary and non-uniform fallback maps suitable for better downstream preview validation while full production algorithms are still pending.

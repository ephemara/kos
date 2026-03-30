# k-os-material repair lane

This subtree is the cleaned migration target for the material domain.

## What was repaired
- Core material value types and their owning shapes
  - `TextureSlot`
  - `TextureInfo`
  - `Material`
  - `MaterialLibrary`
  - `MaterialPreset`
- PBR-facing helpers that are clearly domain logic:
  - clamping and validation of scalar properties
  - transparency / emissive checks
  - texture slot naming and file suffix helpers
  - material cloning, naming, lookup, merge, and persistence intent
- Imported authored behavior was normalized into smaller Kain modules instead of one dense scaffold.

## What remains skeletal
- GPU / renderer / engine bridge code is intentionally not reified here.
- Runtime upload, WGPU binding, shader execution, and host-specific material editor glue stay as adapter concerns.
- Anything that depends on Bevy, Tauri, or runtime backend state should be treated as integration code outside this repair lane.

## Notes
This directory is the readable material migration target under `M:\K_OS\kain\repair\material`.
It should preserve the useful authored domain layer while staying honest about what still belongs to backend or renderer code.

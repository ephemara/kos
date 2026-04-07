# k-os-animation repair lane

This subtree is a repaired migration target for `k-os-animation`.

## What was repaired
- Restored a real constructor surface instead of leaving the imported scaffold at one narrow factory.
- Added a second constructor for imported clips so the domain can represent non-mocap assets without lying about them.
- Added small helpers for common checks and derived values:
  - `channel_count`
  - `duration_seconds`
  - `is_mocap`
  - `has_external_path`
  - `normalized_format`
- Kept the original asset shape and source-kind enum intact so the import structure still reads like the upstream Rust source.

## What was preserved
- The core `AnimationSourceKind` variants.
- The `AnimationClipAsset` fields and their intent.
- The mocap constructor signature and its default channels.
- The basic test intent: build a clip, confirm duration, confirm source kind.

## What is still skeletal
- No full animation evaluation pipeline.
- No timeline blending, retarget graph, or runtime integration.
- No host-facing asset registry or persistence layer.
- Validation is intentionally light; this is a repair lane, not a finished runtime.

## Notes
The raw importer output in `M:\K_OS\kain\animation\animation.kn` is still the import scaffold. This subtree is the cleaner migration target for further authored Kain repair.

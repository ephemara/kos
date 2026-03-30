# Kain raw scaffold triage

This is a practical classification of the imported K_OS Kain scaffold after the raw/full-pass import and the first repaired lanes.

Evidence used:
- imported scaffold map in `M:\K_OS\kain\IMPORT_SUMMARY.md`
- repair lanes under `M:\K_OS\kain\repair\`
- repair patterns from `M:\K_OS\kain\notes\REPAIR_PATTERNS.md`

## Rewrite in Kain
These domains are semantically deep enough that the raw scaffold is mostly a liability. They need authored Kain, not just repair.

- `k-os-scene` (`kain/scene/scene_a.kn`, `kain/scene/scene_b.kn`)
  - The repaired scene lane shows the importer can preserve contracts, but deep ECS/render traversal is still thin.
  - Rewrite the core scene model, entity bookkeeping, and import/export boundaries in clean Kain.
- `k-os-renderer`
  - Rendering lifecycle, selection, stats, and shader-facing seams are too stateful to trust in hollow scaffold form.
  - Keep the host/backend bridge thin, but rewrite the domain logic in Kain.
- `k-os-eval`
  - Evaluation should be authored around explicit scene/runtime contracts, not left as a generated shell.
- `k-os-gpu-pipeline`
  - This is one of the current critical cleanup candidates in the workspace registry snapshot.
  - Rewrite the core pipeline graph and artifact contract, then wrap host-only execution points.
- `k-os-material`
  - Also a critical cleanup candidate.
  - Material graphs and parameter normalization should be rewritten, not patched in place.
- `k-os-kain`
  - The importer and manifest layer are already the control surface for the rest of the tree.
  - The durable pieces here should be rewritten with strong manifest contracts, not left as a broad scaffold.
- `k-os-workspace-registry`
  - Registry generation is already data-driven and should stay explicit, but the contract and merge rules need authored clarity.

## Wrap with native/backend support
These domains have real Kain value, but the useful shape is a Kain core wrapped by host integrations, codecs, or runtime adapters.

- `k-os-asset-pipeline`
  - The repaired subtree shows the hot paths are constructor/cache/orchestration logic.
  - Core pipeline coordination belongs in Kain; host codecs, importers, and format-specific edges stay wrapped.
- `k-os-animation`
  - The repaired lane already restored constructors and derived helpers.
  - Kain should own animation contracts and normalization; runtime playback and host asset plumbing should wrap it.
- `k-os-mesh-processing`
  - Most of the value is in transformation and cleanup rules, but backends and heavy geometry adapters should remain wrapped.
- `k-os-rig`
  - Rig contracts and pose math are good Kain candidates, but import/export and engine adapters should stay backend-wrapped.
- `k-os-baking`
  - Bake orchestration, staging, and manifest flow belong in Kain; the actual backend execution is a wrapper problem.
- `k-os-photogrammetry`
  - Pipeline control and data shaping belong in Kain, but sensor/file/codec integration is host-side.
- `k-os-scatter`
  - Good candidate for authored rules plus backend execution wrappers.
- `k-os-plugin`
  - The repaired config/plugin lane shows the contract surface can be cleaned up, but dynamic loading and OS-specific edges remain wrappers.
- `zen-*` shell-facing crates (`zen`, `zen-host`, `zen-kain-api`, `zen-kain-modules`, `zen-runtime`)
  - These should mostly expose and route Kain-backed capability, not absorb deep domain logic.

## Keep mostly native / host-side
These areas should stay primarily in native Rust / host integration unless a very specific Kain contract emerges.

- `k-os-bevy`
  - Host composition, not domain truth.
- `k-os-game-runtime`
  - Runtime orchestration and execution plumbing are host concerns.
- `k-os-game-framework`, `k-os-game-input`, `k-os-game-camera`, `k-os-game-play`, `k-os-game-ai`, `k-os-game-sequencer`, `k-os-sim`
  - These are mostly runtime/system integration layers; Kain can feed them, but should not swallow them wholesale.
- `k-os-io`, `k-os-external`, `k-os-wasm`, `k-os-undo`, `kos-proto`, `k-os-config`, `zen-core`, `zen-editor`, `zen-assets`
  - These are mostly host/runtime plumbing, schema, or integration boundaries.
- `k-os-sculpt`
  - Keep the native interaction and backend-specific kernel work here unless a narrow Kain contract proves useful.
- `k-os-bevy-lab`, `k-os-brushes`, `k-os-gizmo`, `k-os-hdr`, `k-os-asset-pipeline` edge adapters
  - Treat as host-side experimentation or adapter surfaces unless they become stable authored contracts.

## Importer unlocks with the highest payoff
Keep this short. These are the things that would unlock many domains at once.

1. **Preserve constructor and cache bodies more faithfully.**
   - The repairs in `animation`, `asset_pipeline`, and `scene` all show the same loss pattern: empty builders, broken caches, and missing normalization.
   - If the importer keeps field wiring, defaults, and stable ordering, many domains become repairable instead of hollow.

2. **Keep small helper chains intact when they are already the contract.**
   - The importer currently strips too much chain-heavy logic.
   - That hurts loaders, registries, and derived-value helpers across `k-os-kain`, `k-os-config`, and the pipeline crates.

3. **Improve manifest and registry boundary preservation.**
   - The most useful imported shapes are manifest-driven loaders and lookup tables.
   - Better preservation here would unlock `workspace_registry`, `asset_pipeline`, `plugin`, and the Kain runtime manifests together.

4. **Distinguish core domain logic from host/backend seams during import.**
   - Right now the importer often keeps the type shape but loses the line between authored logic and adapter code.
   - That makes `scene`, `renderer`, `material`, and `eval` look flatter than they really are.

## Bottom line
- Rewrite the semantic cores: scene, renderer, eval, material, GPU pipeline, workspace registry.
- Wrap the mid-layer pipelines: animation, asset pipeline, rig, baking, scatter, photogrammetry, plugin.
- Keep the host/runtime shells native: game/runtime, Zen shell layers, IO, config, wasm, undo, and the editor/asset composition crates.

The raw scaffold is useful as evidence. It is not yet trustworthy as an implementation.

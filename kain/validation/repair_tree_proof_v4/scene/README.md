# k-os-scene repair lane

This subtree is the cleaned migration target for the scene domain.

## What was repaired

- Core scene contracts: handles, mesh source data, transform, parent, name, viewport, subdivision, take, and animation components
- `SceneWorld` ownership and entity bookkeeping
- Mesh creation, deletion, update, and metadata accessors
- Partial buffer updates for mesh positions and normals
- Basic scene asset bridging for mesh/take/animation records

## What remains skeletal

- Deep render integration and any host-facing Bevy scheduling are still thin integration seams
- Full picking, editor gizmos, outline rendering, and imported-scene traversal remain intentionally conservative where upstream runtime detail was too host-shaped
- Anything that depends on real ECS internals or downstream rendering backends should still be treated as adapter code, not finished domain logic

## Notes

This lane is meant to replace the raw import dump under `M:\K_OS\kain\scene\scene.kn` with something readable and reusable.
It keeps the important contracts intact, but trims away the worst of the generated noise.

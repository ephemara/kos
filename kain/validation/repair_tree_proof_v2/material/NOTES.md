# Material repair notes

## Repaired domain surface
- The imported material system is split into focused pieces instead of one flattened dump.
- PBR scalar properties are treated as stable domain values with explicit clamping and validation.
- Texture management is kept as a first-class material concern, not buried inside renderer code.
- Library operations keep the important ownership rules: add, lookup, rename, duplicate, merge, save/load intent.
- Presets are kept as authored material recipes, not backend scaffolding.

## Skeletal by design
- No shader compilation or GPU buffer upload logic.
- No renderer-specific bind group construction.
- No host UI/editor workflow.
- No attempt to restore every imported test or adapter from the raw scaffold.

## Practical boundary
If a function needs a renderer, ECS, or platform bridge to make sense, it should not live in this subtree as finished logic.
If it is about material meaning, naming, storage, presets, or value shape, it belongs here.

# Scene repair notes

## Repaired surface

- Preserved the imported scene ECS model instead of flattening it into ad hoc helpers.
- Kept `SceneWorld` as the owning boundary for mesh / take / animation entities.
- Added explicit constructors for the common component types so callers do not depend on raw field construction everywhere.
- Kept partial update helpers because they are a stable domain contract for editor-style mutation.

## Skeletal surface

- Rendering, selection visualization, and object picking are not expanded beyond the minimum needed to keep the domain legible.
- Import flows for nested scenes are treated as bridge code and should be reviewed against host/runtime behavior before relying on them.

## Follow-up

If the next pass needs more value, the best candidates are:
1. tighten `SceneTransformComponent` helpers
2. split world bookkeeping from import orchestration
3. add more explicit validation around transform and vertex buffer updates

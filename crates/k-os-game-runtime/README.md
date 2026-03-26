# k-os-game-runtime

Data-driven pipeline planning for the K_OS Game product surface.

This crate currently owns:
- pipeline manifest schema for `scene`, `kain_hot_reload`, `data_registry`, `narrative_graph`, `cook`, `build`, and `export` stages
- manifest validation (profiles, dependencies, stage payload requirements, runtime policy shape)
- data-driven stage schema evolution policy for non-registry stages via `[stage_schemas.schemas.*]`
- runtime gameplay policy defaults via `[runtime_policy]` (required registries + strict readiness)
- deterministic dependency-ordered execution planning
- preflight checks for asset and source requirements
- runner adapter resolution and built-in adapter execution

Built-in adapter execution validates concrete subsystem inputs and can emit packaging artifacts for:
- scene bootstrap payloads (`.kscene` schema + actor list)
- Kain hot-reload source/watch topology
- data registry compatibility (`registry_kind` + version)
- narrative graph entry-node viability
- cook recipe inputs and target-platform contract + `cook.contract.json` artifact
- build package cooked-output contract + emitted artifact directory contract
- export package source-dir and package-format contract + emitted export artifact

Packaging artifact emission now includes deterministic provenance metadata:
- SHA-256 hashes of source package/recipe/input assets
- upstream contract lineage between `cook -> build -> export`
- propagated registry version chain derived from source `.registry.toml` inputs

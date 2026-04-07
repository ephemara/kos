# Registry / Config / Plugin repair lane

This subtree is the cleaned Kain migration target for the registry/config/plugin domain.

## Layout
- `registry.kn` - workspace registry and API registry contracts
- `config.kn` - config loader / registry / schema / watcher surface
- `plugin.kn` - plugin context, manager, resource limits, and error surface
- `NOTES.md` - repair notes and remaining boundary stubs

## Intent
The raw imports in:
- `M:\K_OS\kain\workspace_registry\workspace_registry.kn`
- `M:\K_OS\kain\config\config.kn`
- `M:\K_OS\kain\plugin\plugin.kn`

are broad scaffolds. This lane keeps the authored structure, but trims the noise and marks host-specific edges as explicit seams.

## What is repaired here
- Registry documents and lookup helpers are grouped into a single readable contract.
- Config loading, validation, persistence, and hot-reload flow are split into smaller surfaces.
- Plugin context, manager, limits, and monitor types are kept as separate responsibilities instead of one giant import body.

## What stays skeletal
- OS-dependent file watching and filesystem persistence remain boundary stubs.
- Dynamic library loading and symbol resolution remain host integration points.
- Full schema generation and validator plumbing are intentionally thin in this lane.

This is a repair subtree, not a lie of completion.
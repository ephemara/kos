# Workspace Registry Proof

- Registry version: 1
- Workspace package count: 47
- Workspace-local dependency edges: 104
- Aggregators: k-os-backend, k-os-bevy, zen
- External manifests: 6
- Extracted artifacts: 105

## External Manifests
- `kain_runtime_apps` -> `crates/k-os-kain/manifests/runtime_apps.json` (owner `k-os-kain`, 10 items)
- `kain_spirv_sources` -> `crates/k-os-kain/manifests/sources.json` (owner `k-os-kain`, 57 items)
- `kain_upstream_capabilities` -> `crates/k-os-kain/manifests/upstream_capabilities.json` (owner `k-os-kain`, 13 items)
- `zen_host_api` -> `apps/zen/resources/host_api.toml` (owner `zen`, 23 items)
- `zen_modules` -> `apps/zen/resources/modules.toml` (owner `zen`, 1 items)
- `zen_runtime` -> `apps/zen/resources/runtime.toml` (owner `zen`, 6 items)

## Top Dependency Hubs
- `k-os-backend`: 23 local deps, hosts [backend], capabilities [build-script, gpu, ipc-proxy, k-os, kain, workspace-host]
- `zen`: 16 local deps, hosts [zen], capabilities [artifact-provider, gpu, kain, kain-ui-host, native-renderer, workspace-host, zen]
- `k-os-bevy`: 12 local deps, hosts [bevy], capabilities [bevy-renderer, gpu, k-os, workspace-host]
- `k-os-sculpt`: 6 local deps, hosts [backend, bevy], capabilities [gpu, k-os, mesh-edit, sculpt, stroke-application]
- `k-os-renderer`: 5 local deps, hosts [], capabilities [gpu, k-os, kain]
- `k-os-game-play`: 4 local deps, hosts [], capabilities [game, k-os]
- `k-os-scene-runtime`: 4 local deps, hosts [], capabilities [gpu, k-os]
- `k-os-wasm`: 4 local deps, hosts [], capabilities [gpu, k-os]

## Artifact Providers
- `k-os-kain`: 80 artifacts via [cargo_metadata, manifest_extraction, workspace_metadata.inference, workspace_metadata.override]
- `zen`: 25 artifacts via [cargo_metadata, manifest_extraction, workspace_metadata.inference, workspace_metadata.override]

# Workspace Registry Proof

- Registry version: 1
- Workspace package count: 47
- Workspace-local dependency edges: 104
- Aggregators: k-os-backend, k-os-bevy, zen
- External manifests: 5
- Extracted artifacts: 92

## External Manifests
- `kain_runtime_apps` -> `crates/k-os-kain/manifests/runtime_apps.json` (owner `k-os-kain`, 10 items)
- `kain_spirv_sources` -> `crates/k-os-kain/manifests/sources.json` (owner `k-os-kain`, 57 items)
- `zen_host_api` -> `crates/zen/resources/host_api.toml` (owner `zen`, 23 items)
- `zen_modules` -> `crates/zen/resources/modules.toml` (owner `zen`, 1 items)
- `zen_runtime` -> `crates/zen/resources/runtime.toml` (owner `zen`, 6 items)

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
- `k-os-kain`: 67 artifacts via [cargo_metadata, manifest_extraction, workspace_metadata.inference, workspace_metadata.override]
- `zen`: 25 artifacts via [cargo_metadata, manifest_extraction, workspace_metadata.inference, workspace_metadata.override]

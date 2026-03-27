# Zen Contract Surface

> Purpose: define the stable, Zen-facing contract layer that tells the host which crates, entrypoints, and tool capabilities it should consume while the renderer unification work lands.
>
> Audience: Delta, Scribe, and future agents wiring Zen host/UI/tool surfaces.

## What This Is

This document is the durable schema note for the Zen integration boundary.

It does not replace Cargo or the generated registries. It tells host-facing code which generated surfaces are authoritative and which crate APIs should be treated as stable entrypoints for composition.

## Source Of Truth

The contract surface is derived from:

1. [`M:\K_OS\Cargo.toml`](M:/K_OS/Cargo.toml)
2. [`M:\K_OS\crates\k-os-workspace-registry\generated\json\integration_registry.json`](M:/K_OS/crates/k-os-workspace-registry/generated/json/integration_registry.json)
3. [`M:\K_OS\crates\k-os-workspace-registry\generated\json\adapter_manifests.json`](M:/K_OS/crates/k-os-workspace-registry/generated/json/adapter_manifests.json)
4. [`M:\K_OS\crates\k-os-workspace-registry\generated\json\public_api_registry.json`](M:/K_OS/crates/k-os-workspace-registry/generated/json/public_api_registry.json)
5. [`M:\K_OS\docs\zen_renderer_unification.md`](M:/K_OS/docs/zen_renderer_unification.md)

## Stability Tiers

- `host-api`: Zen host roots and other composition roots that should remain the primary host-facing surfaces.
- `integration`: crates that are intended to be consumed by Zen or another host through the generated registry and adapter manifests.
- `internal`: implementation crates that are visible to the workspace but should not be treated as default host integration surfaces.

Delta should prefer `host-api` and `integration` surfaces when wiring the host. It should avoid deep `pub` traversal unless a crate is explicitly promoted into the generated contract.

## Canonical Zen-Facing Crates

### `zen`

Zen is the native host and presentation shell. It should consume registry data and host contracts, but it should not own duplicate renderer truth.

### `zen-host`

[`M:\K_OS\crates\zen-host\src\lib.rs`](M:/K_OS/crates/zen-host/src/lib.rs) defines the host action and binding surface.

Recommended entrypoints:

- `ZenHostApi`
- `ZenHostAction`
- `ZenHostBinding`
- `ZenHostBindingKind`
- `load`
- `summary`
- `action`
- `binding`
- `actions`
- `bindings`

### `zen-kain-api`

[`M:\K_OS\crates\zen-kain-api\src\lib.rs`](M:/K_OS/crates/zen-kain-api/src/lib.rs) defines the Kain shell contract that Zen should consume.

Recommended entrypoints:

- `ZenKainContract`
- `ZenKainActionContract`
- `ZenKainBindingContract`
- `ZenKainShellContract`
- `from_host_and_modules`
- `emit_toml`

### `zen-kain-modules`

This crate owns the registry of Zen shell modules and should be used as the module discovery layer, not as a general purpose renderer boundary.

Recommended entrypoints:

- `ZenKainModuleRegistry`
- `ZenResolvedShell`
- `ZenShellModule`

## Registry Lookups Delta Should Use

Delta should wire against the generated registry APIs instead of hardcoding package names or tool assumptions.

Recommended lookups:

- `workspace_registry()`
- `integration_registry()`
- `adapter_manifests()`
- `adapter_manifest_for_target("zen")`
- `integration_contract_for_package("zen-host")`
- `integration_contract_for_package("zen-kain-api")`
- `integration_contract_for_package("zen-kain-modules")`
- `packages_for_host("zen")`

## Zen Adapter Targets

The current Zen adapter target is `zen`.

The registry also exposes cross-host adapter targets for the same composition layer:

- `tauri`
- `bevy`
- `zen`
- `external`

## Contract Rules

1. Treat generated registry data as the host contract surface, not as an optional report.
2. Prefer explicit recommended entrypoints over arbitrary `pub` visibility.
3. Treat `host-api` crates as the highest-confidence host boundary.
4. Treat `integration` crates as allowed host dependencies, but not as free-for-all APIs.
5. Treat `internal` crates as implementation details unless a future registry pass promotes them.
6. Keep Zen-facing discovery data in the registry or manifests, not in frontend string literals.

## Handoff Guidance

If Delta is wiring Zen UI or host tools, it should:

- ask the registry for the `zen` adapter manifest
- query the Zen integration contracts by package name
- use the recommended entrypoints from this document and the generated registry
- avoid reintroducing direct crate discovery logic in the host or frontend

If the contract surface changes, update the generated registry and this document together so the host-facing story stays readable.

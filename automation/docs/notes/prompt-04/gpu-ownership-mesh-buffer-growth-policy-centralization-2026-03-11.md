# Prompt 04 - GPU Ownership Consolidation (Mesh Buffer Growth Policy)

Date: 2026-03-11

## Goal

Move one shared GPU subsystem policy out of renderer-local ownership and into `k-os-gpu-pipeline` as the single source of truth.

## What changed

- Added shared typed buffer growth contract in [`M:/K_OS/crates/k-os-gpu-pipeline/src/mesh_bridge.rs`](M:/K_OS/crates/k-os-gpu-pipeline/src/mesh_bridge.rs):
  - `GpuMeshBufferGrowthPolicy`
  - `next_buffer_capacity_with_policy(required, current, policy)`
  - `next_buffer_capacity(required, current)` default helper
- Exported the new shared API from [`M:/K_OS/crates/k-os-gpu-pipeline/src/lib.rs`](M:/K_OS/crates/k-os-gpu-pipeline/src/lib.rs).
- Removed duplicated growth constants + helper from [`M:/K_OS/crates/k-os-renderer/src/bridge.rs`](M:/K_OS/crates/k-os-renderer/src/bridge.rs) and switched renderer allocation sizing to the shared function.
- Moved growth-policy unit coverage into the owner crate (`k-os-gpu-pipeline`) and removed renderer-local duplicate tests.
- Updated crate ownership notes in [`M:/K_OS/crates/k-os-gpu-pipeline/AGENT_NOTES.md`](M:/K_OS/crates/k-os-gpu-pipeline/AGENT_NOTES.md).

## Architectural impact

- Buffer growth heuristics for evaluator->GPU mesh upload are now owned by `k-os-gpu-pipeline`, not scattered across renderer consumers.
- Renderer remains a consumer of shared upload infrastructure and no longer owns this shared policy detail.
- Growth policy is now data-contract-driven (typed struct + default), enabling future tuning without re-implementing logic in multiple crates.

## Verification

- `cargo test -p k-os-gpu-pipeline next_capacity -- --nocapture` passed (4/4 tests in `mesh_bridge::tests::*next_capacity*`).
- `cargo check -p k-os-renderer` passed.

## Next recommended slice

- Move mesh buffer allocation usage flags and minimum sizing defaults into a shared typed upload profile so future renderer and domain consumers can select policy by profile key instead of ad hoc constants.

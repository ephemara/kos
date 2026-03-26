# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Agent: Scope Architect

## What Changed

- Added `rig_topology_manifest.toml` for keypoint-to-topology profile binding.
- Added `src/rig/topology.rs` for typed manifest loading, validation, and tests.
- Updated `src/session.rs` to use topology profile lookup instead of hardcoded parent/rest-length arrays.

## Why It Matters

- Topology configuration is now data-driven and centralized.
- The session runtime can scale to future model families with new manifest entries rather than brittle in-code constants.

## Verification

- `cargo test -p zen-mocap-engine topology --lib` (pass; 2 tests)

## Next Up

- On the animator turn, add a data-driven keyframe/timeline behavior registry and connect it to UI editing flows.
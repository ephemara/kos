# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: timeline-bridge-contract

## What Changed

- Added `resources/timeline_bridge_contract.toml` to declare Sequencer action bindings to timeline origins, keyframe operation IDs, and event source IDs.
- Added `src/timeline_bridge_contract.rs` with typed action binding resolvers and compile-time validation.
- Validation now enforces alignment across `timeline_edit` operation policy and `timeline_surface_contract` source routing.
- Exported `timeline_bridge_contract` module from `src/lib.rs`.

## Why It Matters

- Sequencer integration can now target a single manifest-owned action contract instead of duplicating origin/source/operation string literals in UI and runtime code.

## Verification

- `cargo test -p zen-mocap-engine timeline_bridge_contract::tests:: --lib` (pass)
- `cargo test -p zen-mocap-engine timeline_surface_contract::tests:: --lib` (pass)
- `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` (pass)

## Next Up

- Implement Sequencer action routing through the bridge contract and persist envelope/event payloads on take boundaries.
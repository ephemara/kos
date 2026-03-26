# ZenMocap Closed Loop Note

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: timeline-bridge-contract

## Summary

- Added an engine-owned Sequencer action bridge contract so UI actions are mapped to typed timeline origin/operation/event-source metadata through one manifest.

## Details

- Added `crates/zen-mocap-engine/resources/timeline_bridge_contract.toml` to register Sequencer actions and cross-surface bridge actions.
- Added `crates/zen-mocap-engine/src/timeline_bridge_contract.rs` with typed lookup APIs and compile-time validation against:
  - `timeline_edit` enabled operation policy,
  - `timeline_surface_contract` origin->event source mapping.
- Exported module via `crates/zen-mocap-engine/src/lib.rs`.

## Evidence

- `cargo test -p zen-mocap-engine timeline_bridge_contract::tests:: --lib` passed (3 tests).
- `cargo test -p zen-mocap-engine timeline_surface_contract::tests:: --lib` passed (2 tests).
- `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` passed (4 tests).

## Next Recommendation

- Turn 2 should consume `timeline_bridge_binding_for_action` from Sequencer add/remove/move handlers so envelopes/events are emitted from action IDs rather than inline strings.
# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: timeline-bridge-runtime-contract

## What Changed

- Added `crates/zen-mocap-engine/src/timeline_bridge_runtime.rs` to convert Sequencer action IDs into typed `TimelineEditEnvelope` and `TimelineRuntimeRequest` payloads.
- Added typed Sequencer action transport contracts (`SequencerActionCommand`, `SequencerActionPayload`) with serde support for command boundary payloads.
- Added action/payload compatibility checks so bridge contract operation IDs and incoming payload types must match.
- Exported `timeline_bridge_runtime` from `crates/zen-mocap-engine/src/lib.rs`.

## Verification

- `cargo test -p zen-mocap-engine timeline_bridge_runtime::tests:: --lib` (pass)
- `cargo test -p zen-mocap-engine timeline_runtime::tests:: --lib` (pass)

## Next Up

- Bind Sequencer UI actions to bridge action IDs and forward through runtime adapter to eliminate direct keyframe mutation in `useSequencer.ts`.

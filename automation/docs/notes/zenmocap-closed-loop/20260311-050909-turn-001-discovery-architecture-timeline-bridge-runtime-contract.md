# ZenMocap Closed Loop Note

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: timeline-bridge-runtime-contract

## Summary

- Added an engine-owned runtime bridge adapter that maps Sequencer action IDs into validated timeline runtime requests.

## What Changed

- Added `crates/zen-mocap-engine/src/timeline_bridge_runtime.rs`.
- Added typed `SequencerActionCommand` and `SequencerActionPayload` contracts for action-level transport.
- Added `runtime_request_from_sequencer_actions` and `envelope_from_sequencer_action` to compose `TimelineRuntimeRequest` payloads from bridge action IDs.
- Added strict action/payload shape validation to prevent action registry drift from mutating timeline state.
- Exported module in `crates/zen-mocap-engine/src/lib.rs`.

## Why This Matters

- Frontend and command layers can now operate on stable action IDs while engine keeps ownership of origin/operation routing.
- This closes the gap between `timeline_bridge_contract` and `timeline_runtime`, reducing custom glue code for turn-2 Sequencer integration.

## Verification

- `cargo test -p zen-mocap-engine timeline_bridge_runtime::tests:: --lib` (pass, 3 tests)
- `cargo test -p zen-mocap-engine timeline_runtime::tests:: --lib` (pass, 3 tests)

## Next Recommendation

- Wire `src-mocap/features/Sequencer/useSequencer.ts` to emit `SequencerActionCommand` payloads and pass them through this adapter before runtime apply/persist paths.

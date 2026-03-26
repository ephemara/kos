# ZenMocap Closed Loop Note

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: timeline-edit-contract

## Summary

- Established an engine-owned, policy-driven keyframe edit contract for timeline operations.

## Details

- Added `crates/zen-mocap-engine/src/timeline_edit.rs` with typed operations (`upsert`, `remove`, `move`) and deterministic apply/revert patch semantics.
- Added `crates/zen-mocap-engine/resources/keyframe_edit_policy.toml` as a manifest source of truth for frame bounds, enabled interpolation modes, and operation toggles.
- Exported `timeline_edit` from `crates/zen-mocap-engine/src/lib.rs` so frontend and command boundaries can share one contract.

## Verification

- `cargo test -p zen-mocap-engine timeline_edit::tests:: --lib` passed (5 tests).

## Next Turn Hook

- Animator turn should route `useSequencer.ts` keyframe mutations through serialized engine `KeyframeEditOp` payloads.

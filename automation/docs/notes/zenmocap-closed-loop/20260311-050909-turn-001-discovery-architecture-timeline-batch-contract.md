# ZenMocap Closed Loop Note

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: timeline-batch-contract

## Summary

- Added an engine-owned transactional timeline edit batch contract so Sequencer can submit deterministic keyframe operation envelopes rather than mutating local arrays directly.

## Detailed Notes

- Created `crates/zen-mocap-engine/src/timeline_batch.rs`.
- Introduced typed payloads: `TimelineEditEnvelope`, `TimelineEditOrigin`, `AppliedTimelineEditEnvelope`, `TimelineEditBatchResult`, `TimelineBatchError`.
- Added `apply_timeline_edit_batch` with atomic apply-or-rollback behavior built on top of existing `timeline_edit` operations.
- Added `crates/zen-mocap-engine/resources/timeline_batch_policy.toml` to drive:
  - max operations per batch
  - empty-batch behavior
  - allowed request origins
  - allowed supermotion mode override IDs
- Integrated Kain boundary validation by checking requested mode IDs against `SUPERMOTION_LIVELINK_MODES`.

## Evidence

- `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` passed (4 tests).
- `cargo test -p zen-mocap-engine timeline_edit::tests:: --lib` passed (5 tests).

## Recommended Next Step

- On turn 2, replace `src-mocap/features/Sequencer/useSequencer.ts` direct keyframe edits with emitted `TimelineEditEnvelope` batches and typed error handling.

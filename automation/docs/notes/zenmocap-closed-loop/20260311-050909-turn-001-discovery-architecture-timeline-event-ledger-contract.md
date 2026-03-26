# ZenMocap Note - Timeline Event Ledger Contract

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)

## Summary

- Added an engine-owned timeline edit event ledger contract so keyframe operations can be persisted, replayed, and validated across runtime boundaries.

## What Improved

- Added `crates/zen-mocap-engine/src/timeline_event.rs` with typed `TimelineEditEvent` envelopes and helpers for event construction/validation.
- Added `crates/zen-mocap-engine/resources/timeline_event_policy.toml` to move event source IDs, session-frame bounds, and event-count limits into manifest data.
- Extended `crates/zen-mocap-engine/src/take.rs` with backward-compatible `timeline_edit_events` persistence (`#[serde(default)]`) and event-log validation against take frame range.
- Added focused tests for policy behavior and take-bound event rejection.

## Verification

- `cargo test -p zen-mocap-engine timeline_event::tests:: --lib` (pass, 4 tests)
- `cargo test -p zen-mocap-engine take::tests:: --lib` (pass, 6 tests)

## Next Recommendation

- Animator turn should route `src-mocap/features/Sequencer/useSequencer.ts` keyframe actions through `timeline_edit` + `timeline_event` so sequencer edits become durable engine events (`source_id = sequencer-ui`).

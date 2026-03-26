# Changelog - Timeline Event Ledger Contract

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)

## Added

- `crates/zen-mocap-engine/src/timeline_event.rs` with typed timeline edit event envelopes and policy-driven validation.
- `crates/zen-mocap-engine/resources/timeline_event_policy.toml` for data-owned source registry, session-frame bounds, and event caps.
- `AnimationTake.timeline_edit_events` in `crates/zen-mocap-engine/src/take.rs` with serde-defaulted backward compatibility.

## Changed

- `validate_take` now validates timeline event logs against both manifest policy and persisted `frame_count` bounds.
- `crates/zen-mocap-engine/src/lib.rs` now exports `timeline_event`.

## Verification

- `cargo test -p zen-mocap-engine timeline_event::tests:: --lib` (pass, 4 tests)
- `cargo test -p zen-mocap-engine take::tests:: --lib` (pass, 6 tests)

## Follow-Up

- Wire Sequencer keyframe operations to emit persisted `TimelineEditEvent` payloads during authoring/export.

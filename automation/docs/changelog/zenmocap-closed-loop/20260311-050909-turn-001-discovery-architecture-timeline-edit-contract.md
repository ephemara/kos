# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: timeline-edit-contract

## What Changed

- Added `resources/keyframe_edit_policy.toml` to move timeline edit behavior into a data-driven policy manifest.
- Added `src/timeline_edit.rs` with typed keyframe edit operations, policy-gated validation, and reversible patch generation.
- Exported `timeline_edit` in `src/lib.rs`.

## Why It Matters

- Sequencer and runtime can now converge on one mutation contract instead of duplicating ad hoc keyframe logic.
- The policy manifest allows frame/interpolation/operation behavior to evolve without changing callsite logic.

## Verification

- `cargo test -p zen-mocap-engine timeline_edit::tests:: --lib` (pass, 5 tests)

## Follow-up

- Wire frontend timeline edits through this contract on turn 2 and persist operation payloads for take editing.

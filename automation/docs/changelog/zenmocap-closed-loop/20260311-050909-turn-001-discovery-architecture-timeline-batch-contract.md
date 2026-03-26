# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Agent: Scope Architect
Slice: timeline-batch-contract

## What Changed

- Added `crates/zen-mocap-engine/src/timeline_batch.rs` with a typed, transactional batch contract for timeline keyframe edits.
- Added `crates/zen-mocap-engine/resources/timeline_batch_policy.toml` to externalize batch sizing, origin gating, and supermotion mode override constraints.
- Exported `timeline_batch` in `crates/zen-mocap-engine/src/lib.rs`.

## Why It Matters

- Establishes a stable frontend-engine boundary for Sequencer edit routing.
- Prevents partial edit application via rollback-on-failure semantics.
- Keeps behavior policy-driven and aligned with Kain mode registry constraints.

## Verification

- `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` (pass)
- `cargo test -p zen-mocap-engine timeline_edit::tests:: --lib` (pass)

## Next Up

- Wire Sequencer add/remove/move actions to `TimelineEditEnvelope` batches and surface typed failure reasons in UI.

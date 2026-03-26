# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Agent: Scope Architect
Slice: timeline-runtime-orchestration

## What Changed

- Added `crates/zen-mocap-engine/src/timeline_runtime.rs` as a single runtime integration API for timeline mutation + event emission.
- Introduced `TimelineRuntimeRequest/Result/Error` as the typed boundary for frontend/command surfaces.
- `apply_timeline_runtime_request` now:
  - applies envelopes via `apply_timeline_edit_batch`,
  - maps origins to event sources through `timeline_event_source_for_origin`,
  - emits timeline events with monotonic per-batch timestamps,
  - validates the merged event log,
  - and rolls back track edits if event construction or log validation fails.
- Exported `timeline_runtime` from `crates/zen-mocap-engine/src/lib.rs`.

## Why It Matters

- Eliminates unsafe manual composition of batch + event contracts in callers.
- Gives upcoming Sequencer integration one deterministic and rollback-safe engine boundary.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime::tests:: --lib` (pass)
- `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` (pass)

## Next Up

- Route Sequencer keyframe actions through `TimelineRuntimeRequest` and persist returned events with take writes.

# ZenMocap Closed Loop Note

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: timeline-runtime-orchestration

## Summary

- Added an engine-owned runtime orchestration boundary that atomically applies timeline batches and emits validated timeline edit events.

## Details

- Added `crates/zen-mocap-engine/src/timeline_runtime.rs` with `TimelineRuntimeRequest`, `TimelineRuntimeResult`, and `TimelineRuntimeError`.
- Added `apply_timeline_runtime_request` to compose `timeline_batch`, `timeline_event`, and `timeline_surface_contract` into one deterministic contract.
- Runtime now resolves event `source_id` from origin bindings, emits monotonic batch-local timestamps, validates merged event logs, and rolls back keyframe edits on downstream failure.
- Exported `timeline_runtime` in `crates/zen-mocap-engine/src/lib.rs`.

## Evidence

- `cargo test -p zen-mocap-engine timeline_runtime::tests:: --lib` passed (3 tests).
- `cargo test -p zen-mocap-engine timeline_batch::tests:: --lib` passed (4 tests).

## Next

- Use this runtime contract as the sole Sequencer mutation boundary and persist `emitted_events` into take `timeline_edit_events`.

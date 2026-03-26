# ZenMocap Closed Loop Note

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: unified-retarget-contract-resolver

## Summary

- Consolidated retarget compatibility resolution into one engine-owned contract resolver consumed by both live session and offline video analysis paths.

## Detailed Notes

- Added `RetargetSurface`, `ResolvedRetargetContract`, and `resolve_retarget_contract(...)` in `crates/zen-mocap-engine/src/rig/mod.rs`.
- Resolver now owns topology profile lookup and live-retarget contract construction/error mapping, eliminating duplicated logic in runtime surfaces.
- Updated `session.rs` and `video_analyzer.rs` to consume the shared resolver so both paths stay aligned as topology profiles expand.
- Added resolver tests for manifest-backed success and unknown keypoint layout rejection.

## Evidence

- `cargo test -p zen-mocap-engine rig::tests:: --lib` passed (2 tests).
- `cargo test -p zen-mocap-engine video_analyzer::tests::analyze_rejects_models_without_live_retarget_topology_contract --lib` passed (1 test).

## Next Turn Recommendation

- On turn 2, route Sequencer `add/remove/move` keyframe actions through `timeline_edit` operation contracts and serialize operation payloads for take/timeline persistence.

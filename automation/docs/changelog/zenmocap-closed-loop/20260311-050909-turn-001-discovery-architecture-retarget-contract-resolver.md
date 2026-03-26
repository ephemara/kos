# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Agent: Scope Architect
Slice: unified-retarget-contract-resolver

## What Changed

- Added `resolve_retarget_contract` + `RetargetSurface` + `ResolvedRetargetContract` to `crates/zen-mocap-engine/src/rig/mod.rs`.
- Refactored `crates/zen-mocap-engine/src/session.rs` to use shared retarget contract resolution.
- Refactored `crates/zen-mocap-engine/src/video_analyzer.rs` to use the same shared retarget contract resolution.
- Added focused resolver tests in `rig/mod.rs`.

## Why It Matters

- Live and offline retarget compatibility now shares one ownership point, reducing drift and future regression risk as new topology bindings/profile contracts are introduced.

## Verification

- `cargo test -p zen-mocap-engine rig::tests:: --lib` (pass)
- `cargo test -p zen-mocap-engine video_analyzer::tests::analyze_rejects_models_without_live_retarget_topology_contract --lib` (pass)

## Next Up

- Bind frontend Sequencer edits to engine `timeline_edit` op contracts and persist operation payloads.

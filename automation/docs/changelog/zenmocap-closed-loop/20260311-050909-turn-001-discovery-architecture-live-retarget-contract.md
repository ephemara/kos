# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: live-retarget-contract-hardening

## What Changed

- Added live-retarget contract fields to `crates/zen-mocap-engine/resources/rig_topology_manifest.toml`.
- Extended topology schema validation in `crates/zen-mocap-engine/src/rig/topology.rs`.
- Added `LiveRetargetContract` and manifest-driven reliability gating in `crates/zen-mocap-engine/src/rig/mod.rs`.
- Replaced hardcoded model compatibility gates in `crates/zen-mocap-engine/src/session.rs` and `crates/zen-mocap-engine/src/video_analyzer.rs` with topology-contract checks.
- Replaced hardcoded GPU joint capacity and offline topology arrays with model/profile-driven values.

## Why It Matters

- Live and offline retarget paths now share one compatibility contract instead of diverging hardcoded assumptions.
- Adding new model families is now primarily a manifest + contract exercise.

## Verification

- `cargo test -p zen-mocap-engine rig::topology::tests:: --lib` (pass)
- `cargo test -p zen-mocap-engine video_analyzer::tests::analyze_rejects_models_without_live_retarget_topology_contract --lib` (pass)

## Next Up

- Build timeline/keyframe operation contracts as data-driven manifests on turn 2.

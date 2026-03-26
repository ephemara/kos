# ZenMocap Closed Loop Note - Animator Plan Slice

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture

## Summary

- Added `crates/zen-mocap-engine/src/animator_plan.rs` as a typed discovery contract for next-turn animator/engine implementation.

## Detailed Notes

- Introduced `CapabilitySlice` + `CapabilityArea` data model to encode:
  - priority ordering
  - ownership paths (engine/frontend)
  - Kain supermotion mode dependencies
  - blockers and concrete next-turn recommendations
- Seeded prioritized slices:
  - timeline keyframe edit ops
  - retarget profile registry
  - supermotion mode routing
  - take validation rules

## Evidence

- `cargo test -p zen-mocap-engine animator_plan::tests:: --lib` passed (2 tests).

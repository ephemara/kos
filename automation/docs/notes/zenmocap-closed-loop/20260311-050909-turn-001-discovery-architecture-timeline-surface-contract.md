# ZenMocap Closed Loop Note

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: timeline-surface-contract

## Summary

- Introduced a typed, manifest-owned timeline surface contract that binds edit origins to event source IDs.

## Details

- Added crates/zen-mocap-engine/resources/timeline_surface_contract.toml as the canonical origin-to-source mapping.
- Added crates/zen-mocap-engine/src/timeline_surface_contract.rs with compile-time validation against TimelineEditOrigin and enabled timeline-event sources.
- Promoted TimelineEditOrigin helpers in timeline_batch.rs (ALL, policy_id, from_policy_id) and used them to validate required policy coverage.

## Evidence

- cargo test -p zen-mocap-engine timeline_surface_contract::tests:: --lib passed (2 tests).
- cargo test -p zen-mocap-engine timeline_batch::tests:: --lib passed (4 tests).

## Next

- Use timeline_event_source_for_origin(TimelineEditOrigin::SequencerUi) during Sequencer action routing so UI events do not hardcode source IDs.

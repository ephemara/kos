# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Agent: Scope Architect
Slice: timeline-surface-contract

## What Changed

- Added resources/timeline_surface_contract.toml for canonical timeline-origin to timeline-event-source mapping.
- Added src/timeline_surface_contract.rs with strict contract validation and a typed resolver API.
- Updated src/timeline_batch.rs to expose typed origin IDs and consume shared origin registry for manifest validation.
- Exported timeline_surface_contract in src/lib.rs.

## Why It Matters

- Prevents drift between timeline batch origin policy and timeline event source policy.
- Gives turn-2 Sequencer integration a single source-of-truth mapping instead of repeating literals.

## Verification

- cargo test -p zen-mocap-engine timeline_surface_contract::tests:: --lib (pass)
- cargo test -p zen-mocap-engine timeline_batch::tests:: --lib (pass)

## Next Up

- Route Sequencer edits through TimelineEditEnvelope + TimelineEditEvent using the new origin-source resolver.

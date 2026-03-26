# ZenMocap Changelog - Timeline Runtime Take Persistence Boundary

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture

## Added

- New Tauri command `mocap_commit_timeline_runtime_to_take` to persist runtime timeline event logs into take `timeline_edit_events`.
- New Tauri command `mocap_hydrate_timeline_runtime_from_take` to reconstruct runtime timeline state by replaying take event logs.
- Merge strategy support for take commit (`append_unique`, `replace`) plus optional runtime-state clear after successful commit.
- Hydration patch-parity validation to detect drift/corruption between persisted event patch and replayed patch.
- Frontend API surface updates in `MocapService` and `useTakes` to invoke hydrate on open and commit on close.
- Frontend take schema update to include `timeline_edit_events` in `AnimationTake`.

## Verification

- `cargo check -p zen-mocap-engine` (pass)
- `npx tsc --noEmit` in `M:/K_OS/src-mocap` (pass)
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (pass)
- `cargo check -p k-os-backend --manifest-path src-tauri/Cargo.toml` (fail: unrelated pre-existing `KainDomain::Fluid` match exhaustiveness error in `src-tauri/src/kain_commands.rs`)

## Follow-up

- Add command-layer tests around commit merge strategy behavior and hydrate patch mismatch errors.
- Integrate automatic per-ack take commit path for active sequencer editing sessions.

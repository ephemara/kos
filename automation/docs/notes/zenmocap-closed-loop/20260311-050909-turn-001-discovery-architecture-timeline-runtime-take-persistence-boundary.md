# ZenMocap Note - Timeline Runtime Take Persistence Boundary

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)

## Summary

- Introduced command-layer take persistence and hydration boundaries so timeline runtime event logs can be committed into take ownership (`timeline_edit_events`) and replayed back into runtime state deterministically.

## What Was Added

- `mocap_commit_timeline_runtime_to_take` in `src-tauri/src/mocap/mocap.rs`:
  - commits in-memory runtime event log into a take,
  - supports merge strategy (`append_unique`, `replace`),
  - optionally clears runtime state after commit.
- `mocap_hydrate_timeline_runtime_from_take`:
  - loads take event ledger,
  - replays events into runtime track state,
  - enforces replay patch parity against persisted patch payload.
- Frontend integration:
  - `MocapService` typed command methods for commit/hydrate.
  - `useTakes` hydrates on open, commits on close.
  - `AnimationTake` now carries `timeline_edit_events` in frontend type contract.

## Verification

- `cargo check -p zen-mocap-engine` (pass)
- `npx tsc --noEmit` in `M:/K_OS/src-mocap` (pass)
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (pass, 3 tests)
- `cargo check -p k-os-backend --manifest-path src-tauri/Cargo.toml` (failed due existing unrelated `KainDomain::Fluid` non-exhaustive match in `src-tauri/src/kain_commands.rs`)

## Next Recommended Slice

- Bind sequencer runtime commits to an explicit active take/session path and persist continuously on acknowledged runtime commits, not only on take close.
- Add focused Rust tests for commit merge behavior and hydrate patch-parity rejection paths.

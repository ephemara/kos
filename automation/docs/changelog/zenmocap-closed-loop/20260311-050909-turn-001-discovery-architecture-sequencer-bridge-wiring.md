# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: sequencer-bridge-wiring

## What Changed

- Added `src-mocap/features/Sequencer/timelineBridge.ts` with a typed, data-driven action binding registry and runtime payload builders for Sequencer timeline operations.
- Updated `src-mocap/features/Sequencer/useSequencer.ts` so `addKeyframe`, `removeKeyframe`, and new `moveKeyframe` emit engine-compatible timeline runtime request payloads while preserving local track mutation behavior.
- Added bridge state management in the Sequencer hook (`timelineBridgeState`, pending request queue, emitted event ledger, error channel, queue clear helper).
- Exported bridge contracts via `src-mocap/features/Sequencer/index.ts`.
- Added `src-mocap/features/Sequencer/timelineBridge.test.ts` to verify action bindings and payload shapes.

## Why It Matters

- Frontend timeline edits now produce deterministic, replayable action payloads aligned with engine timeline contracts, reducing integration drift and unblocking command-boundary wiring.

## Verification

- `npm run test -- src-mocap/features/Sequencer/timelineBridge.test.ts` (fail: Vitest include scope excludes `src-mocap` tests)
- `npx tsc --noEmit` (pass)

## Next Up

- Add a ZenMocap command integration step that flushes `timelineBridgeState.pendingRequests` into engine timeline runtime APIs and records commit/rollback feedback in Sequencer UX.

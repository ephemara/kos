# Changelog - ZenMocap Sequencer Session Take Ownership Contract

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture

## What Changed

- Added `timelinePersistencePolicy.ts` to centralize timeline runtime persistence and take-path ownership strategy.
- Added `timelineCommitTakePath` ownership in `useTakes` so ACK persistence can target a session-owned take path.
- Updated ZenMocap runtime flush to commit through session take ownership rather than playback panel state.

## Why It Matters

- Sequencer timeline edits can now persist continuously to the intended take even when a take is not currently open in the timeline viewer.
- Persistence behavior is no longer scattered across hook/component literals; policy is centralized and validated.

## Verification

- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) passed.
- `npx vitest run src-mocap/features/Sequencer/timelineBridge.test.ts src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir `M:/K_OS`) passed (6 tests).

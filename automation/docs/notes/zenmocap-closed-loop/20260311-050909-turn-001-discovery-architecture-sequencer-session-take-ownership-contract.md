# ZenMocap Note - Sequencer Session Take Ownership Contract

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture

## Summary

- Added explicit sequencer-session take ownership so timeline runtime ACK persistence can continue after the playback take panel is closed.

## Details

- Added `src-mocap/features/ZenMocap/timelinePersistencePolicy.ts` as a validated single-source policy for:
  - ACK persistence enablement and merge strategy
  - take-close commit behavior and runtime clear rules
  - session take-path retention/rebind/clear behavior
- Extended `useTakes` with `timelineCommitTakePath` and lifecycle ownership updates across open/close/rename/delete.
- Updated `ZenMocap.tsx` runtime flush path to commit using session-owned take path policy instead of relying on `activeTakePath` (playback-open state).

## Verification

- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) passed.
- `npx vitest run src-mocap/features/Sequencer/timelineBridge.test.ts src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir `M:/K_OS`) passed (6 tests).

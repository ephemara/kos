# ZenMocap Closed Loop Note

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: sequencer-bridge-wiring

## Summary

- Wired the `src-mocap` Sequencer hook to emit engine-aligned timeline runtime requests/events from typed action IDs (`add/remove/move`) instead of only mutating local keyframe arrays.

## Details

- Added `M:/K_OS/src-mocap/features/Sequencer/timelineBridge.ts` as a frontend-owned, data-driven bridge registry and payload builder:
  - action binding registry (`sequencer-add-keyframe`, `sequencer-remove-keyframe`, `sequencer-move-keyframe`),
  - typed runtime request/envelope/op payload contracts,
  - module-load validation for required/unique action IDs.
- Updated `M:/K_OS/src-mocap/features/Sequencer/useSequencer.ts` to:
  - queue deterministic timeline runtime requests and emitted bridge events for add/remove/move,
  - expose `timelineBridgeState` + `clearPendingTimelineRuntimeRequests`,
  - add `moveKeyframe(trackId, fromFrame, toFrame)` with collision/missing-frame guardrails,
  - normalize keyframe interpolation defaults (`linear`) at the bridge boundary.
- Exported bridge contracts from `M:/K_OS/src-mocap/features/Sequencer/index.ts` for command/runtime integration surfaces.
- Added `M:/K_OS/src-mocap/features/Sequencer/timelineBridge.test.ts` with focused contract payload coverage.

## Evidence

- `npm run test -- src-mocap/features/Sequencer/timelineBridge.test.ts` failed with `No test files found` because current Vitest include pattern only scans `src-frontend/**/*.{test,spec}.{ts,tsx}`.
- `npx tsc --noEmit` passed.

## Next Recommendation

- Next animator turn should add a Sequencer->engine command adapter that consumes `timelineBridgeState.pendingRequests` and applies them through the Rust `timeline_bridge_runtime`/`timeline_runtime` boundary, then clears the queue on acknowledged commit.

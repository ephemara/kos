# ZenMocap Note — Sequencer Runtime Command Boundary

Run: `20260311-050909-turn-001-discovery-architecture`
Turn: `1` (discovery-architecture)

## What Changed

- Added `mocap_apply_timeline_runtime_requests` in `src-tauri/src/mocap/mocap.rs` to commit queued Sequencer `TimelineRuntimeRequest` payloads through engine timeline runtime contracts.
- Added in-memory `TimelineRuntimeState` (track map + merged event log) so timeline runtime validation operates on real evolving state instead of stateless one-off calls.
- Added `mocap_reset_timeline_runtime_state` for explicit command-side state resets.
- Registered both commands in `src-tauri/src/main.rs`.
- Added service wrappers in `src-mocap/features/ZenMocap/MocapService.ts` and error-surface wiring in `src-mocap/features/Sequencer/useSequencer.ts` + `src-mocap/features/ZenMocap/ZenMocap.tsx`.
- Expanded `vitest.config.ts` include paths so `src-mocap` test files run under project Vitest.

## Why This Slice Matters

This removes the remaining gap between frontend bridge queue emission and backend engine runtime application. Sequencer timeline operations now have a concrete command boundary and structured commit feedback path, reducing drift between UI mutation intent and engine-owned timeline state transitions.

## Verification

- `npx vitest run src-mocap/features/Sequencer/timelineBridge.test.ts` (pass)
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (pass)
- `npx tsc --noEmit` (pass)
- `cargo check -p k-os-backend --manifest-path src-tauri/Cargo.toml` (pass)

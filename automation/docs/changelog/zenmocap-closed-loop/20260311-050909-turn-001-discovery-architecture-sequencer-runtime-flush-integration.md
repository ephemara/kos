# ZenMocap Changelog - Sequencer Runtime Flush Integration

Date: 2026-03-11
Run: `20260311-050909-turn-001-discovery-architecture`

## Added

- ACK-driven Sequencer timeline request dequeue API in `src-mocap/features/Sequencer/useSequencer.ts`.
- Sequencer runtime error channel setter (`setTimelineBridgeError`) in hook return surface.
- ZenMocap runtime flush effect in `src-mocap/features/ZenMocap/ZenMocap.tsx` that commits pending requests via `mocap_apply_timeline_runtime_requests`.

## Changed

- Timeline bridge request payload contract aligned with engine/Tauri serde (`origin`, numeric `requested_supermotion_mode_id`).
- `MocapService` now exposes typed runtime flush/reset methods for sequencer command integration.

## Verification

- `npx tsc --noEmit` (pass)
- `cargo check -p k-os-backend` (pass)

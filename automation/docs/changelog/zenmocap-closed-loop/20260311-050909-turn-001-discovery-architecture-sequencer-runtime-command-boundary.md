# ZenMocap Changelog — Sequencer Runtime Command Boundary

- Added Tauri command `mocap_apply_timeline_runtime_requests` in `src-tauri/src/mocap/mocap.rs` to apply frontend timeline runtime request batches via `zen-mocap-engine` runtime contracts.
- Added `TimelineRuntimeState` command-layer registry (per-track runtime state + merged event log) and reset command `mocap_reset_timeline_runtime_state`.
- Registered new mocap commands in `src-tauri/src/main.rs`.
- Extended `src-mocap/features/ZenMocap/MocapService.ts` with typed timeline runtime commit/reset service methods.
- Extended `src-mocap/features/Sequencer/useSequencer.ts` with bridge error setter export and used it from `src-mocap/features/ZenMocap/ZenMocap.tsx` flush integration for explicit commit failure reporting.
- Expanded Vitest include scope in `vitest.config.ts` to run `src-mocap` tests directly; fixed stale envelope assertion in `src-mocap/features/Sequencer/timelineBridge.test.ts` (`origin` field).

Verification:
- `npx vitest run src-mocap/features/Sequencer/timelineBridge.test.ts` (pass)
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (pass)
- `npx tsc --noEmit` (pass)
- `cargo check -p k-os-backend --manifest-path src-tauri/Cargo.toml` (pass)

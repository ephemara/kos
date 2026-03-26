# ZenMocap Closed-Loop Changelog

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)
Slice: timeline-runtime-active-take-ownership

## Added

- New Tauri command `mocap_set_timeline_runtime_active_take` to bind/unbind active runtime take ownership.
- New Tauri command `mocap_commit_timeline_runtime_to_active_take` to persist timeline runtime ledger using owned active take path.
- New frontend service APIs `setTimelineRuntimeActiveTake` and `commitTimelineRuntimeToActiveTake`.

## Changed

- `TimelineRuntimeState` now owns `active_take_path` in `src-tauri/src/mocap/mocap.rs`.
- Timeline runtime take commit flow refactored into shared helper (`commit_runtime_state_to_take`) and existing explicit-path commit now synchronizes active ownership.
- Hydration from take now binds active ownership automatically.
- `useTakes` now synchronizes backend active-take ownership across open/close/rename/delete transitions.
- `ZenMocap.tsx` ACK flush now commits via active ownership contract (policy-gated) instead of explicit path passing.

## Verification

- Pass: `npx tsc --noEmit` (`M:/K_OS/src-mocap`).
- Pass: `cargo check -p zen-mocap-engine` (`M:/K_OS`).
- Fail (pre-existing unrelated): `cargo check -p k-os-backend --manifest-path M:/K_OS/src-tauri/Cargo.toml` due `KainDomain::Fluid` non-exhaustive match in `src-tauri/src/kain_commands.rs`.

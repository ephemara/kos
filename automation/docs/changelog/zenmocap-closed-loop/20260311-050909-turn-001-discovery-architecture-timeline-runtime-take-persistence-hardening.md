# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture

## Changes

- Added merge policy support to runtime take commits via `TimelineRuntimeTakeCommitOptions.merge_strategy` (`append_unique` | `replace`).
- Hardened take hydration: runtime state replay now rejects persisted events when replay patch output diverges from stored patch data.
- Updated ZenMocap take/runtime integration to prefer canonical `replace` persistence for active take ownership during close/flush flows.
- Added focused Rust tests for hydrate patch mismatch rejection and successful replay hydration.

## Verification

- `npx tsc --noEmit` (pass)
- `cargo test -p k-os-backend mocap::mocap::tests:: --manifest-path M:/K_OS/src-tauri/Cargo.toml` (fail: unrelated existing `KainDomain::Fluid` non-exhaustive match in `src-tauri/src/kain_commands.rs`)

## Next

- Add explicit sequencer-session take-path ownership so ACK-based runtime commits can persist continuously without relying on take close lifecycle.

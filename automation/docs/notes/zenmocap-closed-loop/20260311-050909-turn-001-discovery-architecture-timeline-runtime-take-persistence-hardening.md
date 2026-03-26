# ZenMocap Note - Timeline Runtime Take Persistence Hardening

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)

## Summary

- Hardened timeline runtime take hydration with replay patch parity checks.
- Added typed merge strategy control for runtime-to-take event ledger persistence.
- Updated ZenMocap lifecycle wiring to use canonical `replace` persistence when an active take path is owned.

## Details

- `src-tauri/src/mocap/mocap.rs`
  - `TimelineRuntimeTakeCommitOptions` now includes `merge_strategy` (`append_unique` | `replace`).
  - `hydrate_runtime_state_from_event_log` now validates replayed patch equality against persisted event patches.
  - Added tests for patch mismatch rejection and valid replay hydration.
- `src-mocap/features/ZenMocap/hooks/useTakes.ts`
  - Active take close commit now uses `merge_strategy: 'replace'`.
- `src-mocap/features/ZenMocap/ZenMocap.tsx`
  - Runtime request ACK path commits to active take path when present.

## Verification

- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) -> pass.
- `cargo test -p k-os-backend mocap::mocap::tests:: --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> fail due unrelated existing compile error in `src-tauri/src/kain_commands.rs` (`KainDomain::Fluid` non-exhaustive match).

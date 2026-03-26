# ZenMocap Changelog - Timeline Runtime Diagnostics Event Refresh

Date: 2026-03-11
Run: 20260311-050909-turn-001-discovery-architecture

## Added

- Event-driven timeline runtime diagnostics refresh path:
  - backend emits `mocap://timeline_runtime_diagnostics_changed` after successful timeline runtime mutations,
  - frontend listens and refreshes diagnostics immediately.

## Changed

- `src-tauri/src/mocap/mocap.rs`
  - timeline runtime mutation commands now accept `AppHandle` where needed and emit diagnostics-changed updates post-mutation.
  - diagnostics-changed payload reuses policy-redacted diagnostics report shape.
- `src-mocap/features/ZenMocap/ZenMocap.tsx`
  - diagnostics refresh flow is now event-first with policy polling fallback.
- `src-tauri/src/kain_commands.rs`
  - added exhaustive `KainDomain` mapping for `Brush` and `Shader` domains.

## Verification

- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` (pass)
- `npx tsc --noEmit --pretty false` (pass)

# ZenMocap Discovery Note - Timeline Runtime Diagnostics Event Refresh

Date: 2026-03-11
Run: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)

## Summary

Converted ZenMocap timeline diagnostics updates to an event-first model while retaining policy-driven polling fallback. Backend timeline runtime mutations now emit a diagnostics invalidation event with a fresh policy-redacted diagnostics snapshot, and the frontend consumes that event to refresh status/doctor surfaces immediately.

## What Changed

- Backend command layer (`src-tauri/src/mocap/mocap.rs`):
  - Added diagnostics-changed event emission on successful timeline runtime mutations:
    - request apply
    - runtime reset
    - active take bind/unbind
    - runtime-to-take commit (explicit and active-take variants)
    - runtime hydrate from take
  - Reused diagnostics report builder for event payloads to preserve manifest policy visibility/redaction parity.
- Frontend integration (`src-mocap/features/ZenMocap/ZenMocap.tsx`):
  - Added listener for `mocap://timeline_runtime_diagnostics_changed`.
  - Added shared diagnostics refresh callback used by both event listener and fallback polling loop.
  - Kept policy `refresh.interval_ms` polling as heartbeat/fallback when no events are emitted.
- Adjacent fix (`src-tauri/src/kain_commands.rs`):
  - Added `KainDomain::Brush` and `KainDomain::Shader` registry mapping arms to restore backend compile exhaustiveness.

## Verification

- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_report_reflects_runtime_state --manifest-path M:/K_OS/src-tauri/Cargo.toml` -> pass
- `npx tsc --noEmit --pretty false` (workdir: `M:/K_OS`) -> pass

## Follow-Ups

- Add frontend tests that validate event-driven refresh behavior, teardown, and polling fallback.
- Consider adding structured mutation metadata to diagnostics-changed payload for richer UI attribution.

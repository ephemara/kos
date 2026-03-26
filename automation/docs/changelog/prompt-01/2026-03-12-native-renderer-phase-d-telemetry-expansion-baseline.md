# 2026-03-12 - Native Renderer Phase D Telemetry Expansion Baseline

## Summary
Completed Prompt 01 Task 22.1 by expanding renderer `FrameStats` and wiring runtime measurements for mesh sync timing, selection latency, and GPU memory usage.

## Changes
- `crates/k-os-renderer/src/types.rs`
  - Added `mesh_sync_time_ms`, `selection_latency_ms`, `gpu_memory_bytes` to `FrameStats`
- `crates/k-os-renderer/src/service.rs`
  - Added timing instrumentation for dirty mesh sync during redraw requests
  - Added selection latency timing + smoothing on `RequestSelection`
- `crates/k-os-renderer/src/lib.rs`
  - Extended frame-stat aggregation with resident GPU memory estimate
- `src-frontend/services/viewportClient.ts`
  - Updated TypeScript `FrameStats` interface to match backend contract
- `src-frontend/features/viewport/NativeViewport.tsx`
  - Added diagnostics HUD lines for new telemetry fields
- `.kiro/specs/native-renderer-migration/tasks.md`
  - Marked Task 22.1 complete with status note
- `docs/NATIVE_RENDERER_PROGRESS.md`
  - Added 2026-03-12 telemetry baseline section

## Verification
- `cargo check -p k-os-renderer` passed
- `cargo test -p k-os-renderer service::tests -- --nocapture` passed
- `npx tsc --noEmit --pretty false` passed

## Impact
Renderer observability is now sufficient to guide Phase D debug UI and profiling work with concrete metrics instead of inferred behavior.

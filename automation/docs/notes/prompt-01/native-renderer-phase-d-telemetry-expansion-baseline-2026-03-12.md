# Prompt 01 - Native Renderer Completion Sweep

## Run Slice
- Date: 2026-03-12
- Focus: Phase D Task 22.1 telemetry expansion (`FrameStats` observability baseline)

## Why This Slice
Phase C shared-mesh propagation is complete, but the migration lacked direct visibility into mesh-sync cost, selection responsiveness, and GPU memory footprint. Task 22.1 required making those values first-class telemetry so future polish and benchmark work can be data-driven.

## Implemented
1. Expanded renderer telemetry contract in `crates/k-os-renderer/src/types.rs`:
- Added `mesh_sync_time_ms`
- Added `selection_latency_ms`
- Added `gpu_memory_bytes`

2. Added runtime population paths:
- `crates/k-os-renderer/src/service.rs`
  - Measures per-redraw dirty mesh sync time (bridge/source sync path) and writes `mesh_sync_time_ms`
  - Measures `RequestSelection` latency and updates smoothed `selection_latency_ms` per viewport
- `crates/k-os-renderer/src/lib.rs`
  - Extended `current_frame_stats(...)` with resident GPU memory estimate (`gpu_memory_bytes`) from attached mesh geometry totals

3. Updated frontend stats contract and diagnostics display:
- `src-frontend/services/viewportClient.ts` updated `FrameStats` TS interface
- `src-frontend/features/viewport/NativeViewport.tsx` diagnostics HUD now shows:
  - mesh sync time
  - selection latency
  - GPU upload bytes
  - GPU memory bytes

4. Updated migration docs/checklists:
- `.kiro/specs/native-renderer-migration/tasks.md` marks Task 22.1 complete with concrete status note
- `docs/NATIVE_RENDERER_PROGRESS.md` adds a new telemetry baseline section for 2026-03-12

## Verification
- `cargo check -p k-os-renderer` passed
- `cargo test -p k-os-renderer service::tests -- --nocapture` passed (5/5)
- `npx tsc --noEmit --pretty false` passed

## Architectural Notes
- Telemetry remains contract-owned by `k-os-renderer`; no renderer observability logic was moved into `k-os-engine`.
- Selection latency is smoothed (EWMA) to improve signal quality for overlay/debug consumption.
- GPU memory is currently an estimated resident size based on geometry payload dimensions; future Task 22.2/22.3 can refine this with allocator-level instrumentation from `k-os-gpu-pipeline`.

## Next High-Value Continuation
- Execute Task 22.2 (debug overlay UI) using these new stats as the data source.
- Add Task 22.3 trace spans around redraw, mesh sync, and picking paths for offline profiling.

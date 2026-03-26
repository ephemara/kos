# GPU Backend Cleanup Plan

## Phase 1: Stabilize GPU Path (Immediate)
1. Add blocking sync debugging to identify race conditions
2. Fix buffer synchronization between compute passes
3. Remove CPU fallback paths once GPU is stable

## Phase 2: Remove Legacy Code (Week 1)
- Delete `archive/k-os-engine/src/modules/sculpting/brushes/deprecated/`
- Remove legacy brush mappings in sculpt.rs
- Clean up CPU-GPU sync points

## Phase 3: Optimize Buffer Management (Week 2)
- Replace Vec<> allocations with GPU buffers
- Implement proper buffer lifecycle
- Add memory leak detection

## Phase 4: Performance Optimization (Week 3)
- Remove blocking sync once stable
- Optimize indirect dispatch
- Add GPU-side culling

## Files to Clean

### Remove Entirely:
- `archive/k-os-engine/src/modules/sculpting/brushes/deprecated/legacy_sculpt_wgsl.rs`

### Heavily Refactor:
- `archive/k-os-engine/src/modules/sculpting/sculpt.rs` (40+ Vec allocations)
- `archive/k-os-engine/src/modules/sculpting/raycast.rs` (22 Vec allocations)
- `archive/k-os-engine/src/modules/sculpting/mask.rs` (14 Vec allocations)

### Add Synchronization:
- All queue.submit() calls need device.poll() for debugging
- Buffer barriers between compute passes
- Proper async readback handling

## Performance Targets
- <100K polys: CPU path (optional)
- 100K-1M polys: GPU path with optimizations
- >1M polys: Full GPU path with all features

## Testing Strategy
1. Enable K_OS_GPU_SYNC=1 for debugging
2. Test with 10K, 100K, 1M, 5M polys
3. Remove sync once stable

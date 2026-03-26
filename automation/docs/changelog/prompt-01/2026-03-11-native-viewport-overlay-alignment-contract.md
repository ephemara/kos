# 2026-03-11 - Native Viewport Overlay Alignment Contract

## Summary
Implemented Prompt 1 vertical slice for Phase B overlay alignment by introducing a shared coordinate contract and wiring brush/HUD overlay placement to it.

## Changes
- Added `src-frontend/features/viewport/overlayCoordinates.ts`:
  - shared coordinate and bounds contract for native viewport overlays.
  - conversion utilities for client/local/NDC mapping.
  - live overlay bounds hook for resize/scroll/DPI updates.
- Updated `src-frontend/features/viewport/NativeViewport.tsx`:
  - refactored pointer NDC conversions to shared mapping.
  - updated gizmo viewport sizing to shared overlay bounds.
  - added brush cursor overlay rendering.
  - anchored diagnostics HUD as viewport-relative overlay.
- Updated migration docs/tasks:
  - `.kiro/specs/native-renderer-migration/tasks.md` task 12 and subtasks set to complete.
  - `docs/NATIVE_RENDERER_PROGRESS.md` updated with 2026-03-11 overlay contract status note.

## Verification
- `npx tsc --noEmit --pretty false` passed.
- `npx vite build` passed (existing warnings only).
- `npx vitest run src-frontend/engine/__tests__/viewportManager.test.ts` passed (48/48).

## Impact
- Native overlay behavior now depends on one reusable coordinate contract rather than repeated ad hoc math.
- Phase B KSculpt pilot completeness improved with concrete overlay alignment ownership moved to shared native viewport controller.

# Prompt 01 Notes - Native Renderer Overlay Alignment Contract

Date: 2026-03-11
Prompt: Prompt 1 - Native Renderer Completion Sweep

## Scope selected
Completed the pending Phase B overlay vertical slice in native viewport integration:
- Task 12.1 overlay coordinate system
- Task 12.2 brush cursor overlay
- Task 12.3 HUD overlay anchoring

## Why this slice
This was the highest-value unfinished Phase B item that:
- improves native-view UX correctness now,
- removes repeated per-handler coordinate math,
- establishes a reusable contract for Phase D input/focus polish.

## Implementation details
1. Added shared coordinate contract module:
- `src-frontend/features/viewport/overlayCoordinates.ts`
- provides data-driven conversion utilities:
  - client -> overlay local
  - overlay local -> NDC
  - client -> NDC
  - NDC -> overlay local
- adds `useViewportOverlayCoordinates` hook with live bounds tracking for resize, scroll, and DPI changes.

2. Refactored `NativeViewport` to consume shared mapping:
- `src-frontend/features/viewport/NativeViewport.tsx`
- replaced repeated `getBoundingClientRect()` math in pointer handlers with shared conversion helpers.
- updated gizmo camera viewport sizing to use shared overlay bounds.

3. Added overlay features on top of shared contract:
- brush cursor indicator rendered in React overlay layer and positioned from hit-tracked pointer mapping.
- diagnostics HUD moved to explicit viewport-relative anchored overlay position.
- gizmo SVG viewbox now tracks shared overlay width/height.

4. Migration docs/task status updates:
- marked task 12 + subtasks complete in `.kiro/specs/native-renderer-migration/tasks.md`.
- added architecture status note in `docs/NATIVE_RENDERER_PROGRESS.md`.

## Architectural effect
- `NativeViewport` now has a single overlay coordinate source of truth.
- future overlay/input/focus work can extend one contract instead of adding app-local math.
- keeps renderer ownership boundaries intact (no new logic moved into `k-os-engine`).

## Edge cases handled
- zero-size bounds guarded in conversions.
- NDC conversions clamp to `[0,1]` UV space before remapping.
- overlay rect updates only when values actually change to avoid render churn.
- cursor overlay hides on no-hit and pointer release.

## Remaining follow-up
- multi-monitor and mixed-DPI precision validation is still required (Task 21.1).
- this pass does not yet implement viewport keyboard focus routing (Task 21.3).

## Verification run
- `npx tsc --noEmit --pretty false` -> passed
- `npx vite build` -> passed (existing non-blocking warnings unchanged)
- `npx vitest run src-frontend/engine/__tests__/viewportManager.test.ts` -> passed (48/48)

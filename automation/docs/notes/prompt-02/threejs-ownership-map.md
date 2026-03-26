# Prompt 02 - Three.js Ownership Audit and Deletion Sequence

Date: 2026-03-11
Scope: `M:/K_OS` (frontend-first audit for live Three.js ownership)

## Audit Method

Commands used:
- `rg -n --no-ignore --hidden "from 'three'" M:/K_OS/src-frontend M:/K_OS/package.json`
- `rg -n --no-ignore --hidden 'from "three"' M:/K_OS/src-frontend M:/K_OS/package.json`
- `rg -n --no-ignore --hidden "@react-three/fiber|@react-three/drei|@react-three/postprocessing" M:/K_OS/src-frontend M:/K_OS/package.json`
- `rg -n --no-ignore --hidden "StudioStage" M:/K_OS/src-frontend M:/K_OS/src-tauri M:/K_OS/crates`

## Current Ownership Map (By Responsibility)

### 1) Visible Rendering Ownership (keep temporarily)
- `src-frontend/systems/three/StudioStage.ts`
- `src-frontend/ui/viewport/WebViewport.tsx`
- `src-frontend/features/*` high-usage surfaces still rendering with Three directly (notably: sculpting, atlas, paint, greeble, weight, retopo, compose)

Why keep temporarily:
- These are still active presentation/runtime paths and cannot be removed safely without equivalent native contracts in place.

### 2) Hidden State Carrier Ownership (replace next)
- `src-frontend/ui/lookdev/lookdevStore.ts`
- `src-frontend/ui/lookdev/lookdevRegistry.ts`
- `src-frontend/features/paint/*` state + engine integration surfaces
- `src-frontend/features/material/kautopbr/*` preview state coupling

Why replace next:
- These bind app state to Three object lifecycle and are primary blockers for deleting fallback ownership without breaking app behavior.

### 3) Input Routing Ownership (replace next)
- `src-frontend/systems/three/GizmoSystem.ts`
- `src-frontend/systems/three/KGizmo.ts`
- Pointer/camera interaction loops in `features/*` that rely on Three controls

Why replace next:
- Input ownership can be migrated to shared native viewport/input bridges with lower risk than full renderer replacement.

### 4) Preview/Material Fallback Ownership (replace next)
- `src-frontend/features/material/kautopbr/ui/PreviewViewport.tsx`
- `src-frontend/ui/materials/UnifiedMaterialDock.tsx`
- Lookdev + PMREM/HDR dependent preview flow

Why replace next:
- Material preview can be vertically sliced into native/runtime contracts and then removed from Three fallback incrementally.

### 5) Experimental or Non-core Usage (delete now / isolate)
- Dead leaves removed:
  - `src-frontend/lib/hooks/useThreeSession.ts`
  - `src-frontend/lib/hooks/useAltCamera.ts`
  - `src-frontend/features/atlas/KAtlasUVEditor_old.tsx`

Why delete now:
- No call sites remained in repository search; these were stale and represented dead Three-era ownership surfaces.

## Three.js Pressure Hotspots (import concentration)

Grouped by top-level frontend area from grep evidence:
- `features/sculpting` (14)
- `features/weight` (12)
- `features/atlas` (12)
- `features/paint` (10)
- `features/compose` (8)
- `features/greeble` (8)
- `systems/three` (7)

Interpretation:
- Highest deletion ROI starts by reducing hidden state/input ownership in `systems/three` and state-coupled feature engines, then deprecating app-by-app rendering ownership.

## Executable Deletion Order (Next Tranches)

1. Tranche A (completed): dead leaf deletion
- Remove unreferenced Three-era utility hooks.
- Result: done in this pass.

2. Tranche B (completed): experimental/dead legacy isolation
- Remove unreferenced legacy atlas editor leaf that still imported `three`.
- Keep historical references only in changelog/notes docs.

3. Tranche C: state carrier extraction before renderer deletion
- Introduce/extend shared native state contracts for lookdev + paint/preview state.
- Move state mutation ownership out of `StudioStage` references.

4. Tranche D: input routing migration
- Route gizmo/camera pointer interactions through shared native input bridge.
- Keep Three presentation path only as compatibility shell during transition.

5. Tranche E: app-level preview replacement
- Replace KAutoPBR and material preview path ownership with native/runtime material contracts.

6. Tranche F: WebViewport + StudioStage de-ownership
- Once state/input/preview no longer require Three internals, remove `WebViewport.tsx` ownership and retire `systems/three` runtime to compatibility stubs.

## Classification Summary

- `keep temporarily`: active visible rendering surfaces required for current runtime.
- `replace next`: hidden state/input/preview owners that block safe renderer deletion.
- `delete now`: dead, unreferenced leaf nodes (completed this pass).

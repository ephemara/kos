# Prompt 06 - Technical Debt Re-entry Pass (Compose Export Utility Reactivation)

Date: 2026-03-11
Category: Technical Debt Re-entry Pass
Scope: Reactivate `src-frontend/features/compose/engine/exportUtility.ts` from exclusion-based type debt.

## Why this slice

`exportUtility.ts` is a production-facing compose export path but was excluded from TypeScript checks and wrapped with `@ts-nocheck`. This pass re-enters it into the active TS/build pipeline with explicit bit-depth contracts.

## Changes made

1. Removed local type-check suppression in compose export utility:
- Deleted top and bottom `// @ts-nocheck` markers in `exportUtility.ts`.

2. Fixed PNG bit-depth contract mismatch:
- Added `toPngBitDepth(bitDepth: 8 | 16 | 32): 8 | 16`.
- Routed PNG export path through this mapper so 32-bit requests are explicitly downgraded to 16-bit for compatibility.
- This resolves `TS2345` and documents behavior that was previously implicit.

3. Reactivated the file in project TS scope:
- Removed `src-frontend/features/compose/engine/exportUtility.ts` from `tsconfig.json` `exclude`.

## Architectural impact

- Reduces exclusion-driven debt on an active runtime surface.
- Replaces hidden behavior with a typed, explicit export-depth contract.
- Keeps the implementation stable while improving compile-time guarantees.

## Verification

Commands run:

```powershell
npx tsc --noEmit --pretty false
npx vite build
npx vitest run
npx vitest run src-frontend/tests/backend-frontend-hybrid.test.ts
```

Results:
- `npx tsc --noEmit --pretty false`: pass
- `npx vite build`: pass (existing non-blocking chunk/dynamic-import warnings unchanged)
- `npx vitest run`: timed out at 244s in this environment
- `npx vitest run src-frontend/tests/backend-frontend-hybrid.test.ts`: pass (10/10)

## Remaining exclusions after this pass

- `src-frontend/features/quantum/**`
- `src-frontend/features/tecton/**`
- `src-frontend/ui/ConfigEditor/**`
- `src-frontend/features/material/kautopbr/ui/AnimatedPreviewDemo.tsx`
- `src-frontend/features/material/kautopbr/ui/AnimationTrackListDemo.tsx`
- `src-frontend/features/bake/engine/bakeEngine.ts`

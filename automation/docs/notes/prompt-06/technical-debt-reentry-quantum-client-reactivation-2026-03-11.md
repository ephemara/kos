# Prompt 06 - Technical Debt Re-entry Pass (Quantum Client Reactivation)

Date: 2026-03-11
Category: Technical Debt Re-entry Pass
Scope: Reactivate `src-frontend/services/quantumClient.ts` from exclusion-based type debt.

## Why this slice

`tsconfig.json` still excluded `src-frontend/services/quantumClient.ts`, which left an actively imported production-facing service outside TypeScript correctness checks. This pass reintroduces the file under type checking with minimal behavioral change.

## Changes made

1. Removed type-check suppression in quantum export client:
- Deleted top and bottom `// @ts-nocheck` markers.
- Added typed error conversion helper (`toErrorMessage(error: unknown)`) for safe message formatting.
- Introduced reusable callback alias (`ExportProgressCallback`) to avoid repeated inline function types.

2. Fixed strict `BlobPart` compatibility for GLB export:
- Converted `Uint8Array` payload to explicit `ArrayBuffer` source before `Blob` construction.
- This resolves TS2322 under current lib typings where `Uint8Array<ArrayBufferLike>` is not accepted directly as `BlobPart`.

3. Reactivated the service in project TS scope:
- Removed `src-frontend/services/quantumClient.ts` from `tsconfig.json` `exclude` list.

## Architectural impact

- Reduces exclusion-driven debt without broad-scope churn.
- Keeps runtime behavior intact while improving contract correctness at compile time.
- Improves service-layer confidence for `KQuantum` and related hybrid tests that dynamically import this client.

## Verification

Commands run:

```powershell
npx tsc --noEmit --pretty false
npx vite build
npx vitest run src-frontend/tests/backend-frontend-hybrid.test.ts
```

Results:
- `npx tsc --noEmit --pretty false`: pass
- `npx vite build`: pass (existing non-blocking warnings unchanged)
- `npx vitest run src-frontend/tests/backend-frontend-hybrid.test.ts`: pass (10/10)

## Remaining exclusions to revisit later

- `src-frontend/features/quantum/**` (folder-level debt)
- `src-frontend/features/tecton/**`
- `src-frontend/ui/ConfigEditor/**`
- `src-frontend/features/material/kautopbr/ui/AnimatedPreviewDemo.tsx`
- `src-frontend/features/material/kautopbr/ui/AnimationTrackListDemo.tsx`
- `src-frontend/features/bake/engine/bakeEngine.ts`
- `src-frontend/features/compose/engine/exportUtility.ts`

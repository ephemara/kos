# Prompt 6 - Technical Debt Re-entry Pass

Date: 2026-03-11
Scope: TypeScript exclusion reduction in `M:/K_OS/tsconfig.json`

## Summary
This pass reduces exclusion-based debt by reactivating selected production-facing files in project type-check/build flows while preserving known high-risk deferred surfaces.

## Reactivated this run
Removed these file-level exclusions from `tsconfig.json`:
- `src-frontend/services/exportService.ts`
- `src-frontend/services/retopoClient.ts`
- `src-frontend/state/createStore.ts`
- `src-frontend/systems/kain/KAINConsole.tsx`
- `src-frontend/ui/dcc/NodeGraph.tsx`

## Classification
- `reactivate`
  - `exportService.ts`, `retopoClient.ts`, `createStore.ts`, `KAINConsole.tsx`, `NodeGraph.tsx`
  - Rationale: active runtime/editor surfaces and safe to re-enter parse/module checks in current state.
- `defer`
  - `src-frontend/features/quantum/**`
  - `src-frontend/features/tecton/**`
  - `src-frontend/ui/ConfigEditor/**`
  - `src-frontend/features/material/kautopbr/ui/*Demo.tsx`
  - `src-frontend/features/bake/engine/bakeEngine.ts`
  - `src-frontend/features/compose/engine/exportUtility.ts`
  - `src-frontend/services/quantumClient.ts`
  - Rationale: broad/high-churn or integration-heavy zones likely to require coordinated cleanup beyond this run.
- `archive`
  - none this pass.

## Architectural note
This keeps the debt-reduction move low-risk and incremental: single-file excludes are pulled back into the project pipeline first, while large feature clusters remain explicitly deferred until a dedicated remediation pass.

## Verification
- `npx tsc --noEmit --pretty false` -> pass
- `npx vite build` -> pass (with existing chunking/dynamic-import warnings)
- `npx vitest run` -> timed out at 184s in this environment
- `npx vitest run src-frontend/engine/__tests__/viewportManager.test.ts` -> pass (48/48)

## Next suggested tranche
1. Reactivate `src-frontend/services/quantumClient.ts` with a dedicated service-contract typing pass.
2. Treat `quantum` and `tecton` as separate debt projects with per-folder acceptance gates.
3. Remove `@ts-nocheck` progressively from reactivated files as follow-on hardening work.

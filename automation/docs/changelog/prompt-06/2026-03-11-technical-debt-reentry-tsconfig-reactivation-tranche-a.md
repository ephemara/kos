# 2026-03-11 - Prompt 6 - Technical Debt Re-entry - Tsconfig Reactivation Tranche A

## What changed
- Reduced `tsconfig.json` exclusions by reactivating five active single-file surfaces:
  - `src-frontend/services/exportService.ts`
  - `src-frontend/services/retopoClient.ts`
  - `src-frontend/state/createStore.ts`
  - `src-frontend/systems/kain/KAINConsole.tsx`
  - `src-frontend/ui/dcc/NodeGraph.tsx`
- Added Prompt 6 run notes:
  - `automation/docs/notes/prompt-06/technical-debt-reentry-pass-2026-03-11.md`

## Why
The repo relied on exclusion-driven debt suppression for active code. This tranche pulls low-risk file-level excludes back into verification flow without expanding architectural risk.

## Verification
- `npx tsc --noEmit --pretty false` -> pass
- `npx vite build` -> pass (non-blocking existing warnings)
- `npx vitest run` -> timeout at 184s (environment/runtime limit)
- `npx vitest run src-frontend/engine/__tests__/viewportManager.test.ts` -> pass (48/48)

## Result
- Fewer `tsconfig.json` exclusions are required than before.
- Active runtime/editor files now participate in project type-check/build gates.

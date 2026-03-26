# 2026-03-11 - Prompt 06 - Compose Export Utility Reactivation (Tranche C)

- Removed `@ts-nocheck` guards from `src-frontend/features/compose/engine/exportUtility.ts`.
- Added typed PNG depth normalization helper (`toPngBitDepth`) and fixed PNG branch to satisfy `8 | 16` contract.
- Removed `src-frontend/features/compose/engine/exportUtility.ts` from `tsconfig.json` excludes.
- Verification:
  - `npx tsc --noEmit --pretty false` -> pass
  - `npx vite build` -> pass
  - `npx vitest run` -> timed out (244s)
  - `npx vitest run src-frontend/tests/backend-frontend-hybrid.test.ts` -> pass (10/10)

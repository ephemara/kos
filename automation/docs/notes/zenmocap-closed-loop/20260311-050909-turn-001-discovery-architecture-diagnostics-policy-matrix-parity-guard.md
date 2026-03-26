# ZenMocap Discovery Note

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1 (discovery-architecture)
Slice: diagnostics-policy-matrix-parity-guard

## Summary

- Centralized frontend fallback diagnostics policy into `src-mocap/features/ZenMocap/timelineDiagnosticsFallbackPolicy.ts`.
- Added frontend/backend reason catalog parity guard in `src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts`.
- Added component-level diagnostics policy matrix tests in `src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` for STATUS and GPU Doctor.
- Added `@mocap` alias to `vitest.config.ts` so mocap component tests resolve shared paths.

## Verification

- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` (pass)
- `npx tsc --noEmit` (pass)

## Next Recommendation

- Add manifest-backed diagnostics reason trend counters and expand parity checks to include drift + field visibility settings.

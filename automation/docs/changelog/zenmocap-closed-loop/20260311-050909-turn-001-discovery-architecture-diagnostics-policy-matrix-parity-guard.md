# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: diagnostics-policy-matrix-parity-guard

## What Changed

- Refactored fallback diagnostics policy out of `ZenMocap.tsx` into `timelineDiagnosticsFallbackPolicy.ts`.
- Added reason-ID parity guard test between frontend fallback policy and engine manifest (`timelineDiagnosticsPolicyParity.test.ts`).
- Added UI policy-matrix diagnostics tests for `LiveLinkStatus` and `GpuDoctorPanel`.
- Added `@mocap` alias in `vitest.config.ts` for mocap test resolution.

## Verification

- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsPolicyParity.test.ts src-mocap/features/ZenMocap/ui/timelineDiagnosticsPolicyMatrix.test.tsx` (3 passed)
- `npx tsc --noEmit` (pass)

## Next Up

- Extend parity guard to full diagnostics policy shape and add trend-aware diagnostics counters.

# ZenMocap Closed-Loop Changelog

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Phase: discovery-architecture

## Added

- src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.ts with shared diagnostics version/freshness helpers.
- src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts covering version selection and stale poll rejection.

## Changed

- src-mocap/features/ZenMocap/ZenMocap.tsx now rejects stale diagnostics polling snapshots after newer event payloads and preserves mutation metadata on equal-version refreshes.

## Verification

- npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts (pass)
- npx tsc --noEmit (pass)

# 2026-03-12 - Diagnostics Trend Decay + Cooldown Contract

- Added policy-owned trend time windows (`decay_window_ms`, `cooldown_window_ms`) to `timeline_runtime_diagnostics_policy.toml`.
- Added validation for trend-window invariants in `timeline_runtime_diagnostics_policy.rs`.
- Switched backend diagnostics mutation history to timestamped entries and window-aware trend synthesis in `src-tauri/src/mocap/mocap.rs`.
- Added diagnostics report metadata (`generated_at_ms`, `recent_reason_last_seen_ms`) to support deterministic frontend parity.
- Updated frontend trend resolver, fallback policy, and parity tests to preserve backend/frontend trend-window coherence.
- Added focused cooldown de-escalation tests in both Rust and TypeScript suites.

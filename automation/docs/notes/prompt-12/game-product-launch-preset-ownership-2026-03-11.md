# Prompt 12 - K_OS Game Product Layer Buildout (Launcher Preset Ownership)

Date: 2026-03-11

## Goal

Move launcher/profile product ownership out of `k-os-bevy` host-local logic and into a `k-os-game-*` owner crate.

## What changed

- Added `GameProductLaunchPreset` to `crates/k-os-game-framework/src/lib.rs`.
- Added `resolve_game_product_launch_preset(manifest, requested_profile)` in `k-os-game-framework`.
- Added framework tests for:
  - explicit profile selection,
  - default fallback to `editor_preview`,
  - missing profile error path.
- Updated `crates/k-os-bevy/src/main.rs` bootstrap to:
  - read optional `KOS_GAME_PIPELINE_PROFILE`,
  - resolve launch preset via `k-os-game-framework`,
  - insert `GameProductLaunchPreset` resource,
  - fail fast on invalid profile selection.

## Architectural impact

- Product identity/profile resolution is now crate-owned (`k-os-game-framework`) rather than host-owned (`k-os-bevy`).
- `k-os-bevy` remains a host adapter consuming game-product contracts.
- Launcher/profile behavior is data-driven from manifest profiles, with explicit env override only for profile selection.

## Verification

- `cargo test -p k-os-game-framework` passed (3/3).
- `cargo check -p k-os-bevy` passed.

## Next recommended slice

- Add a crate-owned launch profile matrix (`editor`, `runtime`, `shipping`) with explicit runtime policy defaults, then have launcher choose by preset id without direct env coupling.

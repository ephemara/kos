# Prompt 12 - Game Launch Preset Matrix Runtime Policy Defaults (2026-03-11)

## Objective

Continue K_OS Game product-layer ownership by replacing host-local runtime policy selection with a framework-owned launch preset matrix contract.

## What was implemented

- Extended `k-os-game-framework` launch preset ownership:
  - added `GameProductLaunchPreset.preset_id`
  - added bundled runtime policy defaults on each preset:
    - `runtime_required_registry_kinds`
    - `runtime_strict_readiness`
  - added `GameProductLaunchPresetMatrix` + `build_game_product_launch_preset_matrix(...)`
  - updated preset resolution to support:
    - explicit preset id request
    - profile-id fallback to `<profile>.default`
    - defaulting to `editor_preview.default` when present
- Extended `k-os-game-play` with `GamePipelineRuntimePolicy::from_launch_preset_with_env_overrides(...)`.
- Updated `k-os-bevy` bootstrap:
  - new optional env input `KOS_GAME_PIPELINE_PRESET`
  - resolves launch preset using both preset-id and profile inputs
  - derives runtime policy from selected launch preset defaults, then applies env overrides

## Architectural impact

- Runtime policy defaults are now packaged into product-layer launch presets instead of being selected solely from manifest policy in host bootstrap.
- `k-os-bevy` remains a host adapter while `k-os-game-framework` owns launcher/profile contract composition.

## Verification

- `cargo test -p k-os-game-framework` passed (5/5).
- `cargo check -p k-os-game-play` passed.
- `cargo check -p k-os-bevy` passed.

## Next recommended slice

- Add manifest-authored explicit preset maps for profile variants with diverging runtime policy defaults (beyond generated `<profile>.default` presets).

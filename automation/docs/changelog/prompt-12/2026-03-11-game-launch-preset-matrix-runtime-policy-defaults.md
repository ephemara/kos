# 2026-03-11 - Game Launch Preset Matrix Runtime Policy Defaults

## Changed

- `crates/k-os-game-framework/src/lib.rs`
  - expanded `GameProductLaunchPreset` with `preset_id`, `runtime_required_registry_kinds`, and `runtime_strict_readiness`
  - added `GameProductLaunchPresetMatrix`
  - added `build_game_product_launch_preset_matrix(...)`
  - updated `resolve_game_product_launch_preset(...)` to resolve by preset id and profile fallback
  - added/updated launch preset resolution tests
- `crates/k-os-game-play/src/lib.rs`
  - added `GamePipelineRuntimePolicy::from_launch_preset_with_env_overrides(...)`
  - centralized policy env override application
- `crates/k-os-bevy/src/main.rs`
  - added bootstrap env support for `KOS_GAME_PIPELINE_PRESET`
  - switched runtime policy derivation to selected launch preset defaults
- `src-game/docs/PIPELINE_ARCHITECTURE.md`
  - documented preset-id selection and preset-driven runtime policy source
- `src-game/docs/CRATE_ARCHITECTURE.md`
  - documented framework launch preset matrix ownership
- `src-game/docs/RUN_LOG_2026-03-11.md`
  - added Run 19 entry

## Verification

- `cargo test -p k-os-game-framework`
- `cargo check -p k-os-game-play`
- `cargo check -p k-os-bevy`

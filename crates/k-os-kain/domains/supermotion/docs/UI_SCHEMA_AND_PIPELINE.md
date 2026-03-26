# ZenMocap UI Schema + Pipeline Guide

This document explains how to drive ZenMocap shaders from UI data, how mode IDs map to behavior, and how parameters flow into the GPU pipeline.

## 1) Files and their roles

- `mograph_supermotion.kn`
  - General motion shader (50 modes, IDs `0..49`).
- `mocap_supermotion_livelink.kn`
  - Mocap-specialized shader (16 modes, IDs `0..15`) that outputs joint transforms + quaternions.
- `mograph_supermotion_modes.json`
  - Mode ID to mode name mapping for `mograph_supermotion`.
- `mocap_supermotion_modes.json`
  - Mode ID to mode name mapping for `mocap_supermotion_livelink`.
- `mograph_supermotion_ui_schema.json`
  - UI control metadata for each `mograph_supermotion` mode.
- `mocap_supermotion_ui_schema.json`
  - UI control metadata for each mocap mode.
- `MOCAP_WGPU_CHAIN.md`
  - GPU pass order and slot contracts.
- `wgpu_tauri_mocap_chain_example.rs`
  - Rust template showing chained `wgpu` dispatch and bind-group wiring.

## 2) Core data model

Both shaders use the same command model per instance/joint:

- `mod_type[i]` (or `mod_type[joint]`): integer mode ID.
- `params_a[i]`: `Vec4` lane pack.
- `params_b[i]`: `Vec4` lane pack.
- `params_c[i]`: `Vec4` lane pack.

Lane convention:

- `a.x`, `a.y`, `a.z`: primary mode parameters.
- `a.w`: per-instance/per-joint step/phase offset (time staggering).
- `b.*`, `c.*`: extra parameters for advanced modes.

The UI schema gives labels, ranges, defaults, and tooltips for these lanes.

## 3) Difference between mode manifest and UI schema

Mode manifest (`*_modes.json`) is the stable, minimal ID registry:

- `id`: integer used by shader branch.
- `name`: human-readable mode key.

UI schema (`*_ui_schema.json`) is presentation metadata:

- slider labels
- min/max/default
- grouping (`classic`, `complex`, `ultra`, `stabilize`, etc.)
- global controls

Use manifests as source of truth for ID/name mapping in saved data.
Use UI schema for generating editor controls dynamically.

## 4) UI schema format

Top-level structure:

- `schema_version`: schema revision for compatibility checks.
- `shader`: target shader name.
- `target`: expected consumer (`ui_controls`).
- `notes`: implementation notes.
- `global_params`: controls not tied to one mode.
- `mode_ui`: control definitions per mode ID.

Each `mode_ui` entry:

- `id`: mode ID.
- `name`: mode name.
- `group`: category for UI tabs/sections.
- `params`: list of lane bindings.

Each param entry:

- `key`: lane key (example `a.x`, `b.y`, `global_intensity`).
- `label`: UI label.
- `min`, `max`, `default`: numeric slider bounds.
- optional `tooltip`.

## 5) Runtime mapping (UI -> GPU buffers)

Per object/joint:

1. User selects mode by name in UI.
2. Resolve name -> `id` from `*_modes.json`.
3. Write mode ID to `mod_type[index]`.
4. Initialize `params_a/b/c` with zeros.
5. For each UI control in `mode_ui.params`, write value into target lane.
6. Write global controls (`time`, `global_intensity`, `floor_y`, etc.) into uniform data.
7. Dispatch compute.

Example mapping:

- UI slider `"Speed"` key `a.x` value `2.5` -> `params_a[index].x = 2.5`.
- UI slider `"Twist"` key `c.y` value `0.8` -> `params_c[index].y = 0.8`.

## 6) Recommended save format

Persist mode configuration as data, not hardcoded behavior:

```json
{
  "mode": "overdrive",
  "mode_id": 49,
  "a": [5.0, 1.0, 0.0, 0.05],
  "b": [1.0, 0.6, 0.0, 0.0],
  "c": [1.0, 1.0, 0.0, 0.0]
}
```

Load path:

- Prefer `mode_id` if valid.
- Validate `mode` against manifest.
- Clamp all values to schema ranges before writing to GPU.

## 7) Full mocap chain flow

Typical processing order:

1. `mocap_denoise`
   - Adaptive smoothing on raw joints.
2. `mocap_skeleton`
   - Enforce anatomical distances.
3. `mocap_physics`
   - Floor clamp/foot lock and collision pushout.
4. `mocap_supermotion_livelink`
   - Apply stylization modes and produce quaternions.
5. `mocap_livelink` (optional)
   - Recompute orientation-only quats from final joints.

Use pass 4 quaternion output directly when it already matches your target retargeting behavior.

## 8) Validation checklist

- Verify every mode ID in UI schema exists in mode manifest.
- Ensure all `key` lanes are in `{a.x,a.y,a.z,a.w,b.x,b.y,b.z,b.w,c.x,c.y,c.z,c.w}` or declared global keys.
- Clamp values on CPU before buffer upload.
- Keep `eps > 0`.
- Keep `joint_count` and buffer lengths consistent.

## 9) Quick integration pattern (Tauri + Rust)

- Load `*_modes.json` and `*_ui_schema.json` once at startup.
- Generate controls from schema.
- On value change, update CPU-side parameter arrays.
- Upload arrays with `queue.write_buffer`.
- Encode passes in order from `wgpu_tauri_mocap_chain_example.rs`.
- Present final joints/quats to your content browser/animation track system.

## 10) Extending safely

When adding new shader modes:

1. Add branch in `.kn` with new `mode` ID.
2. Add `{id,name}` to `*_modes.json`.
3. Add UI entry in `*_ui_schema.json`.
4. Rebuild SPIR-V with `build_spirv.bat`.
5. Add migration defaults if existing saved clips need compatibility.

If these three files stay in sync (`.kn`, modes manifest, UI schema), tooling remains stable and fully data-driven.

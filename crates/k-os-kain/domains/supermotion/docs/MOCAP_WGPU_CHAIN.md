# ZenMocap WGPU Chain (Tauri)

This documents the GPU compute pass order and slot contracts for the current ZenMocap SPIR-V set.

## Dispatch order

1. `mocap_denoise.spv`
2. `mocap_skeleton.spv`
3. `mocap_physics.spv`
4. `mocap_supermotion_livelink.spv`
5. `mocap_livelink.spv` (optional if pass 4 quaternion output is sufficient)

Use `dispatch_x = ceil(joint_count / 64)` if `LOCAL_SIZE_X = 64`.

## Buffer conventions

- Joint stream is `Float4` per joint (`x,y,z,w`).
- Parent table is `Int` per joint.
- Mode stream is `Int` per joint.
- Param streams are `Vec4` per joint.

## Slot contracts

### `mocap_denoise.kn`
- `@0` `raw_joints` (storage float)
- `@1` `history_joints` (storage float)
- `@2` `out_joints` (storage float)
- `@3..@11` scalars (`joint_count`, `delta_time`, `min_cutoff`, `beta`, `d_cutoff`, `jitter_response`, `max_blend`, `min_blend`, `eps`)

### `mocap_skeleton.kn`
- `@0` `in_joints`
- `@1` `out_joints`
- `@2` `parents`
- `@3` `rest_lengths`
- `@4..@8` scalars (`joint_count`, `stiffness`, `solver_iterations`, `max_correction`, `eps`)

### `mocap_physics.kn`
- `@0` `in_joints`
- `@1` `prev_joints`
- `@2` `out_joints`
- `@3..@17` scalars (`joint_count`, `floor_y`, `lock_velocity_thresh`, `lock_blend`, `repel_strength`, `delta_time`, `eps`, `ankle_start`, `ankle_end`, `toe_start`, `toe_end`, `capsule_a_joint`, `capsule_b_joint`, `capsule_radius`, `limb_radius`)

### `mocap_supermotion_livelink.kn`
- `@0` `in_joints` (`Vec4`)
- `@1` `prev_joints` (`Vec4`)
- `@2` `parents` (`Int`)
- `@3` `mod_type` (`Int`)
- `@4` `params_a` (`Vec4`)
- `@5` `params_b` (`Vec4`)
- `@6` `params_c` (`Vec4`)
- `@7` `out_joints` (`Vec4`)
- `@8` `out_rotations` (`Vec4 quaternion`)
- `@9..@15` scalars (`joint_count`, `time_sec`, `delta_time`, `floor_y`, `global_intensity`, `random_seed`, `eps`)

### `mocap_livelink.kn`
- `@0` `in_joints` (float stream)
- `@1` `parents`
- `@2` `out_rotations` (float stream)
- `@3` `joint_count`
- `@4` `eps`

## Runtime note

If your KAIN runtime currently exposes each scalar as a separate binding, keep that model.
If you move to packed uniform structs on the Rust side, keep alignment and binding indirection consistent with your KAIN SPIR-V reflection/runtime.

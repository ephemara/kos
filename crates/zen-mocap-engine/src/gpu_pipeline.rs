//! ZenMocap GPU Compute Pipeline
//!
//! Four KAIN-compiled SPIR-V shaders run in sequence every frame,
//! replacing the entire CPU-side filter + IK + physics + rotation pass.
//!
//! Pipeline order (data flows left → right):
//!
//!   ONNX output
//!     → [denoise]   One-Euro adaptive filter (per joint, parallel)
//!     → [skeleton]  GPU FABRIK bone-length enforcement
//!     → [physics]   Floor contact + foot-lock + capsule self-collision
//!     → [livelink]  Rotation matrix → quaternion (Shepperd decomp)
//!     → UDP / LiveLink broadcast
//!
//! All shaders were authored in KAIN and compiled with:
//!   kain <shader>.kn -t spirv -o <shader>.spv
//!
//! Dispatch: 1D grid, one thread per joint (COCO-17 = 17 threads by default).
//! Thread group: [17, 1, 1] — fits in a single warp/wavefront on all GPUs.

pub use k_os_kain::generated::spv::MOCAP_AUDIO_MOTION_BYTES as AUDIO_MOTION_SPV;
pub use k_os_kain::generated::spv::MOCAP_BLEND_BYTES as BLEND_SPV;
pub use k_os_kain::generated::spv::MOCAP_CLOTH_SIM_BYTES as CLOTH_SIM_SPV;
pub use k_os_kain::generated::spv::MOCAP_CONTACT_WELD_BYTES as CONTACT_WELD_SPV;
pub use k_os_kain::generated::spv::MOCAP_CROWD_BYTES as CROWD_SPV;
pub use k_os_kain::generated::spv::MOCAP_DENOISE_BYTES as DENOISE_SPV;
pub use k_os_kain::generated::spv::MOCAP_FACIAL_BLEND_BYTES as FACIAL_BLEND_SPV;
pub use k_os_kain::generated::spv::MOCAP_HAND_FK_BYTES as HAND_FK_SPV;
pub use k_os_kain::generated::spv::MOCAP_IK_REACH_BYTES as IK_REACH_SPV;
pub use k_os_kain::generated::spv::MOCAP_LIVELINK_BYTES as LIVELINK_SPV;
pub use k_os_kain::generated::spv::MOCAP_MIRROR_BYTES as MIRROR_SPV;
pub use k_os_kain::generated::spv::MOCAP_PHYSICS_BYTES as PHYSICS_SPV;
pub use k_os_kain::generated::spv::MOCAP_POSE_MATCH_BYTES as POSE_MATCH_SPV;
pub use k_os_kain::generated::spv::MOCAP_POSE_NORMALIZE_BYTES as POSE_NORMALIZE_SPV;
pub use k_os_kain::generated::spv::MOCAP_RETARGET_BYTES as RETARGET_SPV;
pub use k_os_kain::generated::spv::MOCAP_SKELETON_BYTES as SKELETON_SPV;
pub use k_os_kain::generated::spv::MOCAP_SPRING_FOLLOW_BYTES as SPRING_FOLLOW_SPV;
pub use k_os_kain::generated::spv::MOCAP_STABILIZE_ROOT_BYTES as STABILIZE_ROOT_SPV;
pub use k_os_kain::generated::spv::MOCAP_SUPERMOTION_LIVELINK_BYTES as SUPERMOTION_LIVELINK_SPV;
pub use k_os_kain::generated::spv::MOCAP_VELOCITY_SMOOTH_BYTES as VELOCITY_SMOOTH_SPV;
pub use k_os_kain::generated::spv::MOGRAPH_SUPERMOTION_BYTES as MOGRAPH_SPV;

use std::num::NonZeroU64;

// ─── Embedded SPIR-V Binaries ─────────────────────────────────────────────────
// Compiled from ../../k-os-kain/generated/spv/supermotion via the shared domains/build_spirv.bat pipeline.

pub use k_os_kain::generated::spv::PREPROCESS_BYTES as PREPROCESS_SPV;

/// MoGraph procedural overlay shader — compiled from `mograph_supermotion.kn`.
///
/// 50 motion primitives (orbit, heartbeat, lissajous, lattice, overdrive, …)
/// running in a single heterogeneous dispatch. Each instance carries its own
/// `mod_type` uniform so the GPU evaluates all modes in parallel with zero
/// CPU branching overhead. A 4-octave turbulence pass runs on every instance
/// regardless of mode for always-on micromotion.
///
/// This stage is **optional** — it runs after the mandatory PIPELINE_STAGES
/// chain only when `mograph_enabled` is true in the session config. Keeps
/// the live mocap path clean; mograph is purely additive post-process.

// ─── Pipeline Stage Descriptor ────────────────────────────────────────────────

/// Data-driven descriptor for a single SPIR-V compute pass.
/// Add new passes to `PIPELINE_STAGES` — no code changes elsewhere needed.
#[derive(Debug, Clone)]
pub struct GpuStage {
    /// Human-readable name used in debug markers and perf counters.
    pub name:       &'static str,
    /// Embedded SPIR-V bytecode.
    pub spirv:      &'static [u8],
    /// Thread group size along X (number of joints per dispatch).
    pub local_x:    u32,
    /// WGSL entry point name. All KAIN shaders export `main`.
    pub entry:      &'static str,
    /// Rough byte-size of the uniform push-constants block for this stage.
    pub uniform_bytes: u32,
}

/// Ordered pipeline — stages run sequentially, reading from the previous stage's output.
///
/// To add a new KAIN compute pass:
///   1. Write `my_pass.kn`, compile → `my_pass.spv`
///   2. `pub const MY_PASS_SPV: &[u8] = include_bytes!(...);`
///   3. Add an entry here
pub const PIPELINE_STAGES: &[GpuStage] = &[
    GpuStage {
        name:          "denoise",
        spirv:         DENOISE_SPV,
        local_x:       17,          // one thread per COCO keypoint
        entry:         "main",
        uniform_bytes: 48,          // 12 floats/uints (min_cutoff, beta, d_cutoff, …)
    },
    GpuStage {
        name:          "skeleton",
        spirv:         SKELETON_SPV,
        local_x:       17,
        entry:         "main",
        uniform_bytes: 20,          // joint_count, stiffness, iterations, max_corr, eps
    },
    GpuStage {
        name:          "physics",
        spirv:         PHYSICS_SPV,
        local_x:       17,
        entry:         "main",
        uniform_bytes: 72,          // floor_y, lock thresh, foot indices, capsule params, …
    },
    GpuStage {
        name:          "livelink",
        spirv:         LIVELINK_SPV,
        local_x:       17,
        entry:         "main",
        uniform_bytes: 8,           // joint_count, eps
    },
];

// ─── Default Uniform Values ───────────────────────────────────────────────────
// Data-driven defaults — tune via IKConstraintParams without recompiling.

/// One-Euro filter params (loaded into denoise stage uniforms).
#[derive(Debug, Clone, Copy)]
#[repr(C)]
pub struct DenoiseUniforms {
    pub joint_count:     u32,
    pub _pad0:           [u32; 3],
    pub delta_time:      f32,
    pub min_cutoff:      f32,   // 1.0 Hz — adjust via IK panel
    pub beta:            f32,   // 0.007 — IK panel filter_beta
    pub d_cutoff:        f32,   // 1.0 Hz derivative cutoff
    pub jitter_response: f32,   // 0.5 — sensitivity to micro-jitter
    pub max_blend:       f32,   // 0.95 — maximum filter alpha
    pub min_blend:       f32,   // 0.05 — keeps filter alive at rest
    pub eps:             f32,   // 1e-6
}

impl Default for DenoiseUniforms {
    fn default() -> Self {
        Self {
            joint_count:     17,
            _pad0:           [0, 0, 0],
            delta_time:      0.033,  // ~30 fps
            min_cutoff:      1.0,
            beta:            0.007,
            d_cutoff:        1.0,
            jitter_response: 0.5,
            max_blend:       0.95,
            min_blend:       0.05,
            eps:             1e-6,
        }
    }
}

/// Skeleton FABRIK constraint uniforms.
#[derive(Debug, Clone, Copy)]
#[repr(C)]
pub struct SkeletonUniforms {
    pub joint_count:       u32,
    pub _pad0:             [u32; 3],
    pub stiffness:         f32,   // 0.85 — from IK panel foot_lock_strength
    pub solver_iterations: i32,   // 3 — GPU-parallel FABRIK
    pub max_correction:    f32,   // 0.02 — IK panel bone_length_tolerance
    pub eps:               f32,
}

impl Default for SkeletonUniforms {
    fn default() -> Self {
        Self {
            joint_count:       17,
            _pad0:             [0, 0, 0],
            stiffness:         0.85,
            solver_iterations: 3,
            max_correction:    0.02,
            eps:               1e-6,
        }
    }
}

/// Physics + foot-lock + capsule uniforms.
#[derive(Debug, Clone, Copy)]
#[repr(C)]
pub struct PhysicsUniforms {
    pub joint_count:           u32,
    pub _pad0:                 [u32; 3],
    pub floor_y:               f32,   // 0.0 — world floor level
    pub lock_velocity_thresh:  f32,   // 0.02 m/frame — foot-lock gate
    pub lock_blend:            f32,   // 0.9 — lock strength
    pub repel_strength:        f32,   // 1.0 — capsule push strength
    pub delta_time:            f32,
    pub eps:                   f32,
    pub ankle_start:           i32,   // COCO index 15 (left ankle)
    pub ankle_end:             i32,   // COCO index 16 (right ankle)
    pub toe_start:             i32,   // -1 (no toe joints in COCO-17)
    pub toe_end:               i32,
    pub capsule_a_joint:       u32,   // 11 (left hip) — torso capsule A
    pub capsule_b_joint:       u32,   // 12 (right hip) — torso capsule B
    pub capsule_radius:        f32,   // 0.15 m torso radius
    pub limb_radius:           f32,   // 0.05 m limb radius
    pub _pad:                  f32,
}

impl Default for PhysicsUniforms {
    fn default() -> Self {
        Self {
            joint_count:          17,
            _pad0:                [0, 0, 0],
            floor_y:              0.0,
            lock_velocity_thresh: 0.02,
            lock_blend:           0.9,
            repel_strength:       1.0,
            delta_time:           0.033,
            eps:                  1e-6,
            ankle_start:          15,
            ankle_end:            16,
            toe_start:            -1,
            toe_end:              -1,
            capsule_a_joint:      11,
            capsule_b_joint:      12,
            capsule_radius:       0.15,
            limb_radius:          0.05,
            _pad:                 0.0,
        }
    }
}

/// LiveLink rotation-extraction uniforms.
#[derive(Debug, Clone, Copy)]
#[repr(C)]
pub struct LiveLinkUniforms {
    pub joint_count: u32,
    pub _pad0:       [u32; 3],
    pub eps:         f32,
    pub _pad1:       [f32; 3],
}

impl Default for LiveLinkUniforms {
    fn default() -> Self {
        Self { joint_count: 17, _pad0: [0, 0, 0], eps: 1e-6, _pad1: [0.0, 0.0, 0.0] }
    }
}

// ─── MoGraph Stage ────────────────────────────────────────────────────────────

/// Standalone descriptor for the mograph overlay — separate from `PIPELINE_STAGES`
/// since it's opt-in, not part of the mandatory mocap chain.
pub const MOGRAPH_STAGE: GpuStage = GpuStage {
    name:          "mograph_supermotion",
    spirv:         MOGRAPH_SPV,
    local_x:       64,   // arbitrary instance count (joints × procedural layers)
    entry:         "main",
    uniform_bytes: 60,   // instance_count, time, intensity, seed, eps + 3 local_size
};

/// Uniform block for the mograph overlay dispatch.
///
/// `mod_types`, `params_a/b/c` are GPU-side `StorageBuffer<Vec4>` — uploaded
/// once per frame from the per-joint procedural config built by the frontend's
/// `ProceduralMotion.ts` MOTION_LIBRARY mapping.
#[derive(Debug, Clone, Copy)]
#[repr(C)]
pub struct MographUniforms {
    pub instance_count:    u32,
    pub time_sec:          f32,
    pub global_intensity:  f32,  // master wet knob — IK panel "procedural_blend"
    pub random_seed:       f32,  // per-take seed for reproducible randomness
    pub eps:               f32,
}

impl Default for MographUniforms {
    fn default() -> Self {
        Self {
            instance_count:   17,   // COCO joint count
            time_sec:         0.0,
            global_intensity: 0.0,  // off by default — user enables in IK panel
            random_seed:      42.0,
            eps:             1e-6,
        }
    }
}

// ─── Mode ID constants (mirrors mograph_supermotion.kn comment block) ─────────
// Data-driven: frontend reads these to build the MOTION_LIBRARY → mod_type mapping.

pub const MOGRAPH_MODES: &[(&str, u32)] = &[
    ("orbit",            0),
    ("float",            1),
    ("pulse",            2),
    ("shake",            3),
    ("elastic",          4),
    ("pendulum",         5),
    ("wobble",           6),
    ("figure8",          7),
    ("heartbeat",        8),
    ("bounce",           9),
    ("tumble",          10),
    ("strobe",          11),
    ("corkscrew",       12),
    ("shiver",          13),
    ("sway",            14),
    ("yoyo",            15),
    ("crab",            16),
    ("lissajous",       17),
    ("flip",            18),
    ("tremor",          19),
    ("scan",            20),
    ("warp",            21),
    ("drift",           22),
    ("bobble",          23),
    ("twist",           24),
    ("helix_rise",      25),
    ("gyro_spin",       26),
    ("inhale",          27),
    ("jitter_pulse",    28),
    ("spiral_sink",     29),
    ("saw_bounce",      30),
    ("ribbon",          31),
    ("cork_orbit",      32),
    ("phase_march",     33),
    ("quake",           34),
    ("spring_twist",    35),
    ("vortex_pull",     36),
    ("lantern",         37),
    ("zigzag",          38),
    ("boomerang",       39),
    ("roll_wave",       40),
    ("cardioid",        41),
    ("screwdrive",      42),
    ("glitch_snap",     43),
    ("orbit_lissajous", 44),
    ("squash_run",      45),
    ("turbulence_ramp", 46),
    ("precession",      47),
    ("lattice",         48),
    ("overdrive",       49),
];

// ─── SuperMotion + LiveLink Fused Stage ──────────────────────────────────────

/// Fused mograph + livelink shader — `mocap_supermotion_livelink.kn`.
///
/// Replaces the two-pass [mograph → livelink] sequence with a single dispatch:
/// - Applies per-joint mocap-specialized motion modifiers (16 modes)
/// - Computes velocity from prev/current positions on GPU (no CPU vel upload)
/// - Constructs rotation basis from the *modified* forward vector
/// - Runs full Shepperd quaternion decomp
/// - Writes both `out_joints` (positions) and `out_rotations` (quats) in one go
///
/// Modes that can only work in fused form (need vel + rotation simultaneously):
///   8  lean        — bone tilts toward velocity vec (follow-through)
///   9  vortex      — orbit + bone aims along tangent
///   15 overdrive   — pos extrapolation + rotation aligns to trajectory
///
/// Use this instead of running MOGRAPH_STAGE + LIVELINK_STAGE separately
/// when any joint uses a velocity-dependent or rotation-coupling mode.

pub const SUPERMOTION_LIVELINK_STAGE: GpuStage = GpuStage {
    name:          "supermotion_livelink",
    spirv:         SUPERMOTION_LIVELINK_SPV,
    local_x:       17,
    entry:         "main",
    uniform_bytes: 64, // joint_count, time, dt, floor_y, intensity, seed, eps + 3 sizes
};

/// Supermotion-LiveLink uniform block.
#[derive(Debug, Clone, Copy)]
#[repr(C)]
pub struct SupermotionLiveLinkUniforms {
    pub joint_count:      u32,
    pub _pad0:            [u32; 3],
    pub time_sec:         f32,
    pub delta_time:       f32,
    pub floor_y:          f32,
    pub global_intensity: f32,
    pub random_seed:      f32,
    pub eps:              f32,
    _pad: f32,
}

impl Default for SupermotionLiveLinkUniforms {
    fn default() -> Self {
        Self {
            joint_count:      17,
            _pad0:            [0, 0, 0],
            time_sec:         0.0,
            delta_time:       0.033,
            floor_y:          0.0,
            global_intensity: 0.0, // off by default
            random_seed:      42.0,
            eps:              1e-6,
            _pad:             0.0,
        }
    }
}

/// Per-joint mode IDs for supermotion_livelink — parallel to MOGRAPH_MODES
/// but mocap-specific (velocity-aware, skeleton-topology-aware).
pub const SUPERMOTION_LIVELINK_MODES: &[(&str, u32)] = &[
    ("passthrough",       0),
    ("velocity_tail",     1),
    ("drag",              2),
    ("foot_lock",         3),
    ("spiral_stabilize",  4),
    ("jitter_kill",       5),
    ("aim_up",            6),
    ("swing",             7),
    ("lean",              8),  // follow-through: bone tilts toward velocity
    ("vortex",            9),  // orbit + aim along tangent (fused-only)
    ("shock",            10),
    ("pose_noise",       11),
    ("magnet_root",      12),
    ("breathe_chain",    13),
    ("floor_snap",       14),
    ("overdrive",        15), // extrapolation + rotation aligns to trajectory (fused-only)
];

// ─── Extended Shader Library ──────────────────────────────────────────────────

/// GPU animation blend tree — `mocap_blend.kn`.
///
/// Lerps two pose buffers (take_a, take_b) per joint using `alpha_per_joint + alpha_bias`.
/// `alpha_bias` = global crossfade; `alpha_per_joint` = per-joint override.
/// Enables non-linear blend trees: 80% take_A globally but 100% take_B for one hand.

pub const BLEND_STAGE: GpuStage = GpuStage {
    name:          "mocap_blend",
    spirv:         BLEND_SPV,
    local_x:       17,
    entry:         "main",
    uniform_bytes: 16, // joint_count, alpha_bias, eps + pad
};

/// Audio-reactive joint driver — `mocap_audio_motion.kn`.
///
/// Reduces FFT bins to bass/mid/high scalars on GPU, then maps to `group_map` tags:
///   0 hips  → bass (vertical + sway)
///   1 arms  → mid  (lateral, L/R via joint parity)
///   2 hands → high (twitchy small-amplitude)
///   3 other → full-band subtle
///
/// `joint as Float * 0.37` irrational phase offset — no two joints in unison.
/// FFT data: upload `kiss_fftr` output from Rust audio thread each frame.

pub const AUDIO_MOTION_STAGE: GpuStage = GpuStage {
    name:          "mocap_audio_motion",
    spirv:         AUDIO_MOTION_SPV,
    local_x:       17,
    entry:         "main",
    uniform_bytes: 56, // joint_count, fft_count, bass/mid/high_end, gains, time, eps
};

/// Two-bone goal IK — `mocap_ik_reach.kn`.
///
/// Dispatches per **effector** (not per joint). Typically 4 threads (hands + feet).
/// Each thread walks parents[] twice: effector → parent → grandparent.
/// Law of cosines elbow solve with bend-plane preservation from cross product of original chain.
/// `reach_stiffness` lerps between solved and unsolved — soft-blend, no snapping.
/// `chain_softness` shrinks max reach to prevent gimbal lock at full extension.
///
/// **Runtime contract:** `out_joints` must be pre-filled with `in_joints` before
/// this dispatch — only overwrites [grandparent, parent, effector] per chain.

pub const IK_REACH_STAGE: GpuStage = GpuStage {
    name:          "mocap_ik_reach",
    spirv:         IK_REACH_SPV,
    local_x:       4,  // dispatch = effector_count (typically 4: both hands + feet)
    entry:         "main",
    uniform_bytes: 24, // effector_count, joint_count, stiffness, softness, eps
};

/// COCO-17 → custom rig remapper — `mocap_retarget.kn`.
///
/// `mapping[rig_joint] = coco_joint_index` or -1 for synthesized joints.
/// Synthesized joints: walk to COCO parent position + `rig_rest_offsets * offset_scale`.
/// `offset_scale` globally scales rest-pose proportions for height-mismatched rigs.
/// Same -1 convention used by Unreal's IK Retargeter internally.

pub const RETARGET_STAGE: GpuStage = GpuStage {
    name:          "mocap_retarget",
    spirv:         RETARGET_SPV,
    local_x:       64, // rig joint count (arbitrary, driven by rig_joint_count uniform)
    entry:         "main",
    uniform_bytes: 20, // rig_joint_count, coco_joint_count, offset_scale, eps
};

// ─── Tier 1–3 Shader Library ─────────────────────────────────────────────────

// ── Tier 1: Pipeline Foundations ─────────────────────────────────────────────

/// Critically-damped spring follower — `mocap_spring_follow.kn`  (4,124B)
///
/// Second-order follower per joint: accel = -k*(pos-target) - d*vel.
/// Per-joint stiffness/damping buffers — hips stiff (0.9/0.8), hands loose (0.15/0.1).
/// Integrates velocity in-place (`velocity` buffer is read+write).
/// Produces secondary motion: lag, overshoot, settle. Not a smoother — a dynamic.

pub const SPRING_FOLLOW_STAGE: GpuStage = GpuStage {
    name:          "mocap_spring_follow",
    spirv:         SPRING_FOLLOW_SPV,
    local_x:       17,
    entry:         "main",
    uniform_bytes: 16, // dt, eps, joint_count + pad
};

/// Root-origin skeleton normalizer — `mocap_pose_normalize.kn`  (4,348B)
///
/// Translates hip to origin; per-bone scale = ref_length / current_length * scale_factor.
/// Required preprocessing before `mocap_retarget` when capture subject ≠ rig proportions.

pub const POSE_NORMALIZE_STAGE: GpuStage = GpuStage {
    name:          "mocap_pose_normalize",
    spirv:         POSE_NORMALIZE_SPV,
    local_x:       17,
    entry:         "main",
    uniform_bytes: 20, // root_joint, scale_factor, eps, joint_count + pad
};

/// Root motion extractor — `mocap_stabilize_root.kn`  (4,156B)
///
/// Splits locomotion velocity (single Vec4 in out_velocity[0]) from body-relative motion
/// (all joints translated to hip-origin in out_local).
/// Exponential-smoothed velocity: v = prev*(1-t) + v_raw*t.
/// UE5/Unity NavMesh requirement — drives capsule movement separately from animation.

pub const STABILIZE_ROOT_STAGE: GpuStage = GpuStage {
    name:          "mocap_stabilize_root",
    spirv:         STABILIZE_ROOT_SPV,
    local_x:       17,
    entry:         "main",
    uniform_bytes: 24, // root_idx, dt, smoothing, joint_count, eps + pad
};

// ── Tier 2: Quality & Advanced ────────────────────────────────────────────────

/// Velocity-domain Gaussian smoother — `mocap_velocity_smooth.kn`  (5,196B)
///
/// Accumulates velocity over a ring buffer of N frames. Applies Gaussian-like
/// falloff (1/(1+(k²/2σ²)) — no exp needed) then re-integrates. Preserves
/// sharp velocity spikes (foot-strike, hand-clap) while removing low-freq drift.
/// Complement to `mocap_denoise` — operates in velocity space, not position space.

pub const VELOCITY_SMOOTH_STAGE: GpuStage = GpuStage {
    name:          "mocap_velocity_smooth",
    spirv:         VELOCITY_SMOOTH_SPV,
    local_x:       17,
    entry:         "main",
    uniform_bytes: 28, // ring_size, ring_head, sigma, joint_count, dt, eps + pad
};

/// Precision contact constraint — `mocap_contact_weld.kn`  (4,616B)
///
/// Per-joint direct weld: solved = src*(1 - mask*stiffness) + contact*(mask*stiffness).
/// Parent correction propagated 50% down to children for cheap IK-like chain adjustment.
/// Use after `mocap_ik_reach` for toe/fingertip precision freeze.

pub const CONTACT_WELD_STAGE: GpuStage = GpuStage {
    name:          "mocap_contact_weld",
    spirv:         CONTACT_WELD_SPV,
    local_x:       17,
    entry:         "main",
    uniform_bytes: 16, // stiffness, eps, joint_count + pad
};

/// GPU motion matching database search — `mocap_pose_match.kn`  (3,216B)
///
/// Each thread scores one pose in the database: Σ dot(diff,diff)*weight[j].
/// Dispatch = pose_count. CPU reads out_score[], finds argmin, blends.
/// Used by locomotion systems (FIFA/Skate-style) — no IK, no blend trees,
/// just "which recorded pose fits current state best?"

pub const POSE_MATCH_STAGE: GpuStage = GpuStage {
    name:          "mocap_pose_match",
    spirv:         POSE_MATCH_SPV,
    local_x:       64, // dispatch = pose_count (typically hundreds to thousands)
    entry:         "main",
    uniform_bytes: 16, // pose_count, joint_count, eps + pad
};

// ── Tier 3: Future Features ───────────────────────────────────────────────────

/// Symmetric L↔R flip — `mocap_mirror.kn`  (2,724B)
///
/// swap_map[j] = source joint index for joint j (or -1 = identity).
/// mirror_x = -1.0 flips X axis. Lets you capture one side and mirror to other.
/// Minimal shader — 27 lines, 2.7KB. Useful for paired motion symmetry.

pub const MIRROR_STAGE: GpuStage = GpuStage {
    name:          "mocap_mirror",
    spirv:         MIRROR_SPV,
    local_x:       17,
    entry:         "main",
    uniform_bytes: 16, // joint_count, mirror_x, eps + pad
};

/// Multi-agent crowd separation — `mocap_crowd.kn`  (4,592B)
///
/// One thread = one character root. Accumulates repulsion from all neighbors
/// within neighbor_radius, velocity-limited to max_speed. Cheap O(n²) but
/// n = actor count (typically 4–64), not joint count. Zero skeleton overhead.

pub const CROWD_STAGE: GpuStage = GpuStage {
    name:          "mocap_crowd",
    spirv:         CROWD_SPV,
    local_x:       64, // dispatch = actor_count
    entry:         "main",
    uniform_bytes: 28, // actor_count, dt, radius, strength, max_speed, eps + pad
};

/// Position-Based Dynamics cloth sim — `mocap_cloth_sim.kn`  (4,356B)
///
/// Verlet integration with gravity + attachment projection per point:
///   pred = cur + (cur-prev)*damp + gravity*dt²
///   solved = pred*(1 - mask*k) + pin*(mask*k)
/// Designed for garment hem/cape points attached to body skeleton joints.

pub const CLOTH_SIM_STAGE: GpuStage = GpuStage {
    name:          "mocap_cloth_sim",
    spirv:         CLOTH_SIM_SPV,
    local_x:       64,
    entry:         "main",
    uniform_bytes: 28, // dt, gravity, damping, stiffness, eps, point_count + pad
};

/// Finger forward kinematics — `mocap_hand_fk.kn`  (5,288B)
///
/// Per-joint bend+spread angle → world position from parent.
/// Uses canonical base_dir + sine modulation (no full rotation matrix needed).
/// Ready to consume MediaPipe hand landmark bend angles directly.
/// hand_side buffer encodes -1.0 (left) / +1.0 (right) for spread mirroring.

pub const HAND_FK_STAGE: GpuStage = GpuStage {
    name:          "mocap_hand_fk",
    spirv:         HAND_FK_SPV,
    local_x:       21, // 5 fingers × ~4 joints + wrist
    entry:         "main",
    uniform_bytes: 16, // joint_count, angle_scale, eps + pad
};

/// Facial blendshape driver — `mocap_facial_blend.kn`  (4,620B)
///
/// One thread per blendshape channel. Computes dot(pb-pa, axis)*scale + bias
/// where pa/pb are facial landmark pairs (e.g. top-lip / bottom-lip for MouthOpen).
/// Output `out_weights[ch]` drives morph targets in UE5 MetaHuman / Unity ARKit.
/// Per-channel idx_a/idx_b/axis/scale/bias = fully data-driven rig config.

pub const FACIAL_BLEND_STAGE: GpuStage = GpuStage {
    name:          "mocap_facial_blend",
    spirv:         FACIAL_BLEND_SPV,
    local_x:       52, // ARKit 52-channel blendshape set
    entry:         "main",
    uniform_bytes: 16, // blend_count, landmark_count, eps + pad
};

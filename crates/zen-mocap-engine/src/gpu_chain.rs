//! ZenMocap GPU Compute Chain — wgpu dispatch layer
//!
//! Integrates `wgpu_tauri_mocap_chain_example.rs` into the engine as the
//! production-ready compute dispatcher. Every frame:
//!
//! ```text
//! CPU uploads raw COCO joints → GPU
//!   pass 1: mocap_denoise      → denoise_out
//!   pass 2: mocap_skeleton     → skeleton_out
//!   pass 3: mocap_physics      → physics_out
//!   pass 4: mocap_supermotion_livelink → supermotion_out + quat_out
//!   pass 5: mocap_livelink (optional) → livelink_quat_out
//! CPU reads back quat_out → JointFrame → broadcast
//! ```
//!
//! ## Multi-person design
//!
//! `joint_count` = `person_count * 17` (COCO flat layout).
//! Dispatch = `ceil(joint_count / 64)` workgroups.
//! The GPU doesn't care who owns which joint — add more people,
//! change one integer. `mocap_crowd.kn` handles root separation afterwards.
//!
//! ## Tauri / wgpu integration
//!
//! wgpu in Tauri (non-WebGPU) is backed by Vulkan/DX12/Metal via `wgpu`.
//! We request the `high_performance` power preference and use STORAGE buffers.
//! No `unsafe` — all wgpu APIs are safe.

use bytemuck::{Pod, Zeroable, cast_slice, bytes_of};
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::broadcast;
use wgpu::{
    BindGroupEntry,
    BufferDescriptor, BufferUsages,
    CommandEncoderDescriptor, ComputePassDescriptor, ComputePipelineDescriptor,
    Device, Queue,
    ShaderModuleDescriptor, ShaderSource,
};

use crate::gpu_pipeline::{
    DenoiseUniforms, SkeletonUniforms, PhysicsUniforms,
    SupermotionLiveLinkUniforms, LiveLinkUniforms,
    DENOISE_SPV, SKELETON_SPV, PHYSICS_SPV,
    SUPERMOTION_LIVELINK_SPV, LIVELINK_SPV,
};
use crate::types::{Joint, GpuHealthEvent, GpuInfo, PipelineEvent, set_gpu_adapter_info};

fn be(binding: u32, buffer: &wgpu::Buffer) -> wgpu::BindGroupEntry<'_> {
    wgpu::BindGroupEntry {
        binding,
        resource: buffer.as_entire_binding(),
    }
}

const COCO_JOINTS_PER_PERSON: usize = 17;

// Data-driven default profile for mocap_supermotion_livelink.
// Tuple = (joint_index_in_person, mode_id, params_a, params_b, params_c).
// Keep default runtime strictly passthrough (mode 0) until user/config explicitly
// enables procedural supermotion. This guarantees static-frame stability.
const SUPERMOTION_DEFAULT_PROFILE: &[(usize, i32, [f32; 4], [f32; 4], [f32; 4])] = &[];

fn default_supermotion_commands(max_joints: usize) -> (Vec<i32>, Vec<GpuVec4>, Vec<GpuVec4>, Vec<GpuVec4>) {
    let mut mod_type = vec![0i32; max_joints];
    let mut params_a = vec![GpuVec4::default(); max_joints];
    let mut params_b = vec![GpuVec4::default(); max_joints];
    let mut params_c = vec![GpuVec4::default(); max_joints];

    let people = (max_joints + (COCO_JOINTS_PER_PERSON - 1)) / COCO_JOINTS_PER_PERSON;
    for person in 0..people {
        let base = person * COCO_JOINTS_PER_PERSON;
        for (joint_idx, mode, a, b, c) in SUPERMOTION_DEFAULT_PROFILE {
            let idx = base + joint_idx;
            if idx >= max_joints {
                continue;
            }
            mod_type[idx] = *mode;
            params_a[idx] = GpuVec4(*a);
            params_b[idx] = GpuVec4(*b);
            params_c[idx] = GpuVec4(*c);
        }
    }

    (mod_type, params_a, params_b, params_c)
}

// ─── Vec4 wire type ───────────────────────────────────────────────────────────

/// GPU-side joint representation: [x, y, z, confidence].
/// Matches the `Vec4` convention used by every KAIN shader.
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, Default, Debug)]
pub struct GpuVec4(pub [f32; 4]);

impl From<&Joint> for GpuVec4 {
    fn from(j: &Joint) -> Self {
        Self([j.position[0], j.position[1], j.position[2], j.confidence])
    }
}

impl From<GpuVec4> for Joint {
    fn from(g: GpuVec4) -> Self {
        Joint {
            position:   [g.0[0], g.0[1], g.0[2]],
            confidence: g.0[3],
        }
    }
}

fn clamp01(v: f32) -> f32 {
    if v.is_finite() { v.clamp(0.0, 1.0) } else { 0.0 }
}

fn clamp11(v: f32) -> f32 {
    if v.is_finite() { v.clamp(-1.0, 1.0) } else { 0.0 }
}

fn sanitize_solved_joint(solved: GpuVec4, raw: GpuVec4) -> Joint {
    let raw_x = clamp01(raw.0[0]);
    let raw_y = clamp01(raw.0[1]);
    let raw_z = clamp11(raw.0[2]);

    let mut x = if solved.0[0].is_finite() { solved.0[0] } else { raw_x };
    let mut y = if solved.0[1].is_finite() { solved.0[1] } else { raw_y };
    let mut z = if solved.0[2].is_finite() { solved.0[2] } else { raw_z };

    x = clamp01(x);
    y = clamp01(y);
    z = clamp11(z);

    // Safety rail: keep procedural passes from pulling a joint impossibly far
    // from detector output within one frame.
    const MAX_DELTA: f32 = 0.20;
    let dx = x - raw_x;
    let dy = y - raw_y;
    let dz = z - raw_z;
    let len_sq = dx * dx + dy * dy + dz * dz;
    if len_sq > MAX_DELTA * MAX_DELTA {
        let scale = MAX_DELTA / len_sq.sqrt();
        x = raw_x + dx * scale;
        y = raw_y + dy * scale;
        z = raw_z + dz * scale;
    }

    // Use detector confidence; GPU positional passes should not override trust.
    let confidence = clamp01(raw.0[3]);
    Joint { position: [x, y, z], confidence }
}

// ─── Uniform structs (byte-compatible with KAIN binding layout) ───────────────
// Re-use typed structs from gpu_pipeline.rs.
// These are separate here only to add Pod/Zeroable derives for bytemuck.

unsafe impl Pod     for DenoiseUniforms {}
unsafe impl Zeroable for DenoiseUniforms {}
unsafe impl Pod     for SkeletonUniforms {}
unsafe impl Zeroable for SkeletonUniforms {}
unsafe impl Pod     for PhysicsUniforms {}
unsafe impl Zeroable for PhysicsUniforms {}
unsafe impl Pod     for SupermotionLiveLinkUniforms {}
unsafe impl Zeroable for SupermotionLiveLinkUniforms {}
unsafe impl Pod     for LiveLinkUniforms {}
unsafe impl Zeroable for LiveLinkUniforms {}

// ─── Compute pipelines ────────────────────────────────────────────────────────

struct MocapPipelines {
    denoise:     wgpu::ComputePipeline,
    skeleton:    wgpu::ComputePipeline,
    physics:     wgpu::ComputePipeline,
    supermotion: wgpu::ComputePipeline,
    livelink:    wgpu::ComputePipeline,
}

impl MocapPipelines {
    fn new(device: &Device) -> Self {
        let mk = |label: &str, spirv: &[u8]| {
            // wgpu requires 4-byte aligned SPIR-V
            let words: Vec<u32> = spirv
                .chunks_exact(4)
                .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
                .collect();
            let module = device.create_shader_module(ShaderModuleDescriptor {
                label:  Some(label),
                source: ShaderSource::SpirV(std::borrow::Cow::Owned(words)),
            });
            device.create_compute_pipeline(&ComputePipelineDescriptor {
                label:  Some(label),
                // Derive layout from shader bindings so StorageBuffer/Uniform
                // interfaces stay correctly wired even as .kn bindings evolve.
                layout: None,
                module: &module,
                entry_point: Some(label),
                compilation_options: Default::default(),
                cache: None,
            })
        };
        Self {
            denoise:     mk("mocap_denoise",              DENOISE_SPV),
            skeleton:    mk("mocap_skeleton",             SKELETON_SPV),
            physics:     mk("mocap_physics",              PHYSICS_SPV),
            supermotion: mk("mocap_supermotion_livelink", SUPERMOTION_LIVELINK_SPV),
            livelink:    mk("mocap_livelink",             LIVELINK_SPV),
        }
    }
}

// ─── GPU buffer pool ──────────────────────────────────────────────────────────

struct MocapBuffers {
    /// Raw COCO joints from ONNX (written by CPU each frame)
    raw_joints:      wgpu::Buffer,
    /// Previous frame joints (for velocity / history in denoise)
    history_joints:  wgpu::Buffer,
    /// Pass outputs
    denoise_out:     wgpu::Buffer,
    skeleton_out:    wgpu::Buffer,
    physics_out:     wgpu::Buffer,
    supermotion_out: wgpu::Buffer,
    /// Quaternion output — read back by CPU
    quat_out:        wgpu::Buffer,
    livelink_quat:   wgpu::Buffer,
    /// Topology buffers (written once at init)
    parents:         wgpu::Buffer,
    rest_lengths:    wgpu::Buffer,
    prev_joints:     wgpu::Buffer,
    /// Supermotion per-joint command streams
    mod_type:        wgpu::Buffer,
    params_a:        wgpu::Buffer,
    params_b:        wgpu::Buffer,
    params_c:        wgpu::Buffer,
    /// CPU-readable staging buffer for quat readback
    readback:        wgpu::Buffer,
}

impl MocapBuffers {
    fn new(device: &Device, max_joints: usize) -> Self {
        let joint_bytes = (max_joints * std::mem::size_of::<GpuVec4>()) as u64;
        let quat_bytes  = joint_bytes; // quats also [f32;4] per joint

        let storage = |label: &str, size: u64, cpu_readable: bool| {
            // Many stage buffers are both compute IO and copy sources for
            // inter-pass/history/readback transfers.
            let mut usage = BufferUsages::STORAGE | BufferUsages::COPY_DST | BufferUsages::COPY_SRC;
            if cpu_readable { usage |= BufferUsages::COPY_SRC; }
            device.create_buffer(&BufferDescriptor {
                label: Some(label),
                size,
                usage,
                mapped_at_creation: false,
            })
        };

        let upload = |label: &str, size: u64| {
            device.create_buffer(&BufferDescriptor {
                label: Some(label),
                size,
                usage: BufferUsages::STORAGE | BufferUsages::COPY_DST,
                mapped_at_creation: false,
            })
        };

        Self {
            raw_joints:      storage("raw_joints",      joint_bytes, false),
            history_joints:  storage("history_joints",  joint_bytes, false),
            denoise_out:     storage("denoise_out",     joint_bytes, false),
            skeleton_out:    storage("skeleton_out",    joint_bytes, false),
            physics_out:     storage("physics_out",     joint_bytes, false),
            supermotion_out: storage("supermotion_out", joint_bytes, false),
            quat_out:        storage("quat_out",        quat_bytes,  true),
            livelink_quat:   storage("livelink_quat",   quat_bytes,  true),
            parents:         upload("parents",          (max_joints * 4) as u64),
            rest_lengths:    upload("rest_lengths",     (max_joints * 4) as u64),
            prev_joints:     storage("prev_joints",     joint_bytes, false),
            mod_type:        upload("mod_type",         (max_joints * 4) as u64),
            params_a:        upload("params_a",         joint_bytes),
            params_b:        upload("params_b",         joint_bytes),
            params_c:        upload("params_c",         joint_bytes),
            readback:        device.create_buffer(&BufferDescriptor {
                label: Some("readback"),
                size: quat_bytes,
                usage: BufferUsages::MAP_READ | BufferUsages::COPY_DST,
                mapped_at_creation: false,
            }),
        }
    }
}

// ─── Scalar uniform buffers (KAIN scalar binding model) ─────────────────────

struct DenoiseUniformBuffers {
    joint_count: wgpu::Buffer,
    delta_time: wgpu::Buffer,
    min_cutoff: wgpu::Buffer,
    beta: wgpu::Buffer,
    d_cutoff: wgpu::Buffer,
    jitter_response: wgpu::Buffer,
    max_blend: wgpu::Buffer,
    min_blend: wgpu::Buffer,
    eps: wgpu::Buffer,
}

struct SkeletonUniformBuffers {
    joint_count: wgpu::Buffer,
    stiffness: wgpu::Buffer,
    solver_iterations: wgpu::Buffer,
    max_correction: wgpu::Buffer,
    eps: wgpu::Buffer,
}

struct PhysicsUniformBuffers {
    joint_count: wgpu::Buffer,
    floor_y: wgpu::Buffer,
    lock_velocity_thresh: wgpu::Buffer,
    lock_blend: wgpu::Buffer,
    repel_strength: wgpu::Buffer,
    delta_time: wgpu::Buffer,
    eps: wgpu::Buffer,
    ankle_start: wgpu::Buffer,
    ankle_end: wgpu::Buffer,
    toe_start: wgpu::Buffer,
    toe_end: wgpu::Buffer,
    capsule_a_joint: wgpu::Buffer,
    capsule_b_joint: wgpu::Buffer,
    capsule_radius: wgpu::Buffer,
    limb_radius: wgpu::Buffer,
}

struct SupermotionUniformBuffers {
    joint_count: wgpu::Buffer,
    time_sec: wgpu::Buffer,
    delta_time: wgpu::Buffer,
    floor_y: wgpu::Buffer,
    global_intensity: wgpu::Buffer,
    random_seed: wgpu::Buffer,
    eps: wgpu::Buffer,
}

struct LiveLinkUniformBuffers {
    joint_count: wgpu::Buffer,
    eps: wgpu::Buffer,
}

struct MocapUniforms {
    denoise: DenoiseUniformBuffers,
    skeleton: SkeletonUniformBuffers,
    physics: PhysicsUniformBuffers,
    supermotion: SupermotionUniformBuffers,
    livelink: LiveLinkUniformBuffers,
}

impl MocapUniforms {
    fn new(device: &Device) -> Self {
        let mk = |label: &str| {
            device.create_buffer(&BufferDescriptor {
                label: Some(label),
                size: 4,
                usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
                mapped_at_creation: false,
            })
        };
        Self {
            denoise: DenoiseUniformBuffers {
                joint_count: mk("u_denoise_joint_count"),
                delta_time: mk("u_denoise_delta_time"),
                min_cutoff: mk("u_denoise_min_cutoff"),
                beta: mk("u_denoise_beta"),
                d_cutoff: mk("u_denoise_d_cutoff"),
                jitter_response: mk("u_denoise_jitter_response"),
                max_blend: mk("u_denoise_max_blend"),
                min_blend: mk("u_denoise_min_blend"),
                eps: mk("u_denoise_eps"),
            },
            skeleton: SkeletonUniformBuffers {
                joint_count: mk("u_skeleton_joint_count"),
                stiffness: mk("u_skeleton_stiffness"),
                solver_iterations: mk("u_skeleton_solver_iterations"),
                max_correction: mk("u_skeleton_max_correction"),
                eps: mk("u_skeleton_eps"),
            },
            physics: PhysicsUniformBuffers {
                joint_count: mk("u_physics_joint_count"),
                floor_y: mk("u_physics_floor_y"),
                lock_velocity_thresh: mk("u_physics_lock_velocity_thresh"),
                lock_blend: mk("u_physics_lock_blend"),
                repel_strength: mk("u_physics_repel_strength"),
                delta_time: mk("u_physics_delta_time"),
                eps: mk("u_physics_eps"),
                ankle_start: mk("u_physics_ankle_start"),
                ankle_end: mk("u_physics_ankle_end"),
                toe_start: mk("u_physics_toe_start"),
                toe_end: mk("u_physics_toe_end"),
                capsule_a_joint: mk("u_physics_capsule_a_joint"),
                capsule_b_joint: mk("u_physics_capsule_b_joint"),
                capsule_radius: mk("u_physics_capsule_radius"),
                limb_radius: mk("u_physics_limb_radius"),
            },
            supermotion: SupermotionUniformBuffers {
                joint_count: mk("u_supermotion_joint_count"),
                time_sec: mk("u_supermotion_time_sec"),
                delta_time: mk("u_supermotion_delta_time"),
                floor_y: mk("u_supermotion_floor_y"),
                global_intensity: mk("u_supermotion_global_intensity"),
                random_seed: mk("u_supermotion_random_seed"),
                eps: mk("u_supermotion_eps"),
            },
            livelink: LiveLinkUniformBuffers {
                joint_count: mk("u_livelink_joint_count"),
                eps: mk("u_livelink_eps"),
            },
        }
    }

    fn write_all(
        &self,
        queue:  &Queue,
        d:  &DenoiseUniforms,
        s:  &SkeletonUniforms,
        p:  &PhysicsUniforms,
        sm: &SupermotionLiveLinkUniforms,
        ll: &LiveLinkUniforms,
    ) {
        queue.write_buffer(&self.denoise.joint_count, 0, bytes_of(&d.joint_count));
        queue.write_buffer(&self.denoise.delta_time, 0, bytes_of(&d.delta_time));
        queue.write_buffer(&self.denoise.min_cutoff, 0, bytes_of(&d.min_cutoff));
        queue.write_buffer(&self.denoise.beta, 0, bytes_of(&d.beta));
        queue.write_buffer(&self.denoise.d_cutoff, 0, bytes_of(&d.d_cutoff));
        queue.write_buffer(&self.denoise.jitter_response, 0, bytes_of(&d.jitter_response));
        queue.write_buffer(&self.denoise.max_blend, 0, bytes_of(&d.max_blend));
        queue.write_buffer(&self.denoise.min_blend, 0, bytes_of(&d.min_blend));
        queue.write_buffer(&self.denoise.eps, 0, bytes_of(&d.eps));

        queue.write_buffer(&self.skeleton.joint_count, 0, bytes_of(&s.joint_count));
        queue.write_buffer(&self.skeleton.stiffness, 0, bytes_of(&s.stiffness));
        queue.write_buffer(&self.skeleton.solver_iterations, 0, bytes_of(&s.solver_iterations));
        queue.write_buffer(&self.skeleton.max_correction, 0, bytes_of(&s.max_correction));
        queue.write_buffer(&self.skeleton.eps, 0, bytes_of(&s.eps));

        queue.write_buffer(&self.physics.joint_count, 0, bytes_of(&p.joint_count));
        queue.write_buffer(&self.physics.floor_y, 0, bytes_of(&p.floor_y));
        queue.write_buffer(&self.physics.lock_velocity_thresh, 0, bytes_of(&p.lock_velocity_thresh));
        queue.write_buffer(&self.physics.lock_blend, 0, bytes_of(&p.lock_blend));
        queue.write_buffer(&self.physics.repel_strength, 0, bytes_of(&p.repel_strength));
        queue.write_buffer(&self.physics.delta_time, 0, bytes_of(&p.delta_time));
        queue.write_buffer(&self.physics.eps, 0, bytes_of(&p.eps));
        queue.write_buffer(&self.physics.ankle_start, 0, bytes_of(&p.ankle_start));
        queue.write_buffer(&self.physics.ankle_end, 0, bytes_of(&p.ankle_end));
        queue.write_buffer(&self.physics.toe_start, 0, bytes_of(&p.toe_start));
        queue.write_buffer(&self.physics.toe_end, 0, bytes_of(&p.toe_end));
        queue.write_buffer(&self.physics.capsule_a_joint, 0, bytes_of(&p.capsule_a_joint));
        queue.write_buffer(&self.physics.capsule_b_joint, 0, bytes_of(&p.capsule_b_joint));
        queue.write_buffer(&self.physics.capsule_radius, 0, bytes_of(&p.capsule_radius));
        queue.write_buffer(&self.physics.limb_radius, 0, bytes_of(&p.limb_radius));

        queue.write_buffer(&self.supermotion.joint_count, 0, bytes_of(&sm.joint_count));
        queue.write_buffer(&self.supermotion.time_sec, 0, bytes_of(&sm.time_sec));
        queue.write_buffer(&self.supermotion.delta_time, 0, bytes_of(&sm.delta_time));
        queue.write_buffer(&self.supermotion.floor_y, 0, bytes_of(&sm.floor_y));
        queue.write_buffer(&self.supermotion.global_intensity, 0, bytes_of(&sm.global_intensity));
        queue.write_buffer(&self.supermotion.random_seed, 0, bytes_of(&sm.random_seed));
        queue.write_buffer(&self.supermotion.eps, 0, bytes_of(&sm.eps));

        queue.write_buffer(&self.livelink.joint_count, 0, bytes_of(&ll.joint_count));
        queue.write_buffer(&self.livelink.eps, 0, bytes_of(&ll.eps));
    }
}

// ─── GpuChain ─────────────────────────────────────────────────────────────────

/// The live wgpu compute chain.
///
/// Create once per session with `GpuChain::new()`, then call
/// `process_frame()` each time new COCO joints arrive from ONNX.
/// The live wgpu compute chain.
///
/// Create once per session with `GpuChain::new()`, then call
/// `process_frame()` each time new COCO joints arrive from ONNX.
///
/// Pass `event_tx` (from `MocapSession::subscribe()`) so the chain can
/// broadcast `GpuHealth` events directly when the device reports an error.
pub struct GpuChain {
    device:    Device,
    queue:     Queue,
    pipelines: MocapPipelines,
    buffers:   MocapBuffers,
    uniforms:  MocapUniforms,
    max_joints: usize,
    /// Adapter metadata (cached for `get_info()`).
    pub adapter_name:    String,
    pub adapter_backend: String,
    pub adapter_driver:  String,
    pub adapter_driver_info: String,
    pub adapter_device_type: String,
    history_seeded: AtomicBool,
}

impl GpuChain {
    /// Initialize wgpu adapter → device → pipelines + buffers.
    ///
    /// `max_joints` = `max_persons * 17`.
    /// `event_tx`: optional broadcast sender — if Some, GPU device errors are forwarded
    ///             as `PipelineEvent::GpuHealth` so the frontend can display them.
    pub async fn new(
        max_joints: usize,
        event_tx: Option<broadcast::Sender<PipelineEvent>>,
    ) -> Result<Self, String> {
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends:             wgpu::Backends::all(),
            ..Default::default()
        });

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference:       wgpu::PowerPreference::HighPerformance,
                force_fallback_adapter: false,
                compatible_surface:     None,
            })
            .await
            .ok_or("No GPU adapter found")?;

        let info = adapter.get_info();
        let adapter_name        = info.name.clone();
        let adapter_backend     = format!("{:?}", info.backend);
        let adapter_driver      = info.driver.clone();
        let adapter_driver_info = info.driver_info.clone();
        let adapter_device_type = format!("{:?}", info.device_type);

        log::info!(
            "[gpu-chain] Adapter: {} ({}) | Driver: {} | Type: {}",
            adapter_name, adapter_backend, adapter_driver, adapter_device_type
        );

        let adapter_limits = adapter.limits();
        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label:              Some("zen-mocap-gpu"),
                    // Keep feature requirements minimal so SPIR-V is validated
                    // through wgpu's standard shader path on all backends.
                    required_features:  wgpu::Features::empty(),
                    required_limits:    adapter_limits,
                    memory_hints:       wgpu::MemoryHints::Performance,
                },
                None,  // trace_path — set to Some(path) to enable wgpu-trace
            )
            .await
            .map_err(|e| format!("GPU device init failed: {e}"))?;

        // ── Device error handler (GPU doctor) ────────────────────────────────
        // wgpu calls this on the NEXT device poll after an uncaptured error.
        // We classify the error and broadcast a GpuHealth event to the frontend.
        device.on_uncaptured_error(Box::new(move |error| {
            let (kind, message) = match &error {
                wgpu::Error::OutOfMemory { .. } => (
                    "out_of_memory".to_string(),
                    "GPU out of memory. Reduce resolution or close other GPU apps.".to_string(),
                ),
                wgpu::Error::Validation { description, .. } => (
                    "validation".to_string(),
                    format!("GPU validation error: {description}"),
                ),
                wgpu::Error::Internal { description, .. } => (
                    "internal".to_string(),
                    format!("GPU internal error: {description}"),
                ),
            };
            log::error!("[gpu-doctor] {kind}: {message}");
            if let Some(ref tx) = event_tx {
                let evt = GpuHealthEvent {
                    kind,
                    message,
                    timestamp_ms: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as f64,
                };
                tx.send(PipelineEvent::GpuHealth(evt)).ok();
            }
        }));

        let pipelines = MocapPipelines::new(&device);
        let buffers   = MocapBuffers::new(&device, max_joints);
        let uniforms  = MocapUniforms::new(&device);

        // Initialize supermotion command streams to a safe, low-amplitude default profile.
        // This keeps the procedural pass active without destabilizing the base mocap solve.
        let zero_joint_vec4 = vec![0.0f32; max_joints * 4];
        let (mod_type, params_a, params_b, params_c) = default_supermotion_commands(max_joints);
        queue.write_buffer(&buffers.mod_type, 0, cast_slice(&mod_type));
        queue.write_buffer(&buffers.params_a, 0, cast_slice(&params_a));
        queue.write_buffer(&buffers.params_b, 0, cast_slice(&params_b));
        queue.write_buffer(&buffers.params_c, 0, cast_slice(&params_c));
        queue.write_buffer(&buffers.history_joints, 0, cast_slice(&zero_joint_vec4));
        queue.write_buffer(&buffers.prev_joints, 0, cast_slice(&zero_joint_vec4));

        // Cache adapter info for the GPU Doctor command (mocap_get_gpu_info)
        set_gpu_adapter_info(GpuInfo {
            name:        adapter_name.clone(),
            backend:     adapter_backend.clone(),
            driver:      adapter_driver.clone(),
            driver_info: adapter_driver_info.clone(),
            vram_bytes:  0, // wgpu doesn't expose VRAM directly
            device_type: adapter_device_type.clone(),
        });

        Ok(Self {
            device, queue, pipelines, buffers, uniforms, max_joints,
            adapter_name,
            adapter_backend,
            adapter_driver,
            adapter_driver_info,
            adapter_device_type,
            history_seeded: AtomicBool::new(false),
        })
    }

    /// Upload parents + rest_lengths topology (call once after init, or on rig change).
    pub fn upload_topology(&self, parents: &[i32], rest_lengths: &[f32]) {
        self.queue.write_buffer(&self.buffers.parents,      0, cast_slice(parents));
        self.queue.write_buffer(&self.buffers.rest_lengths, 0, cast_slice(rest_lengths));
    }

    /// Run the full 5-pass GPU chain for one frame.
    ///
    /// - `joints`: flat slice of COCO joints, length = `person_count * 17`
    /// - `dt`: frame delta time in seconds
    /// - `time_sec`: monotonic time for procedural effects
    ///
    /// Returns the GPU-solved joints, ready to broadcast over UDP.
    pub async fn process_frame(
        &self,
        joints:   &[Joint],
        dt:       f32,
        time_sec: f32,
    ) -> Result<Vec<Joint>, String> {
        let joint_count = joints.len().min(self.max_joints) as u32;
        if joint_count == 0 { return Ok(vec![]); }

        // ── Upload raw joints ─────────────────────────────────────────────────
        let raw: Vec<GpuVec4> = joints.iter().map(GpuVec4::from).collect();
        self.queue.write_buffer(&self.buffers.raw_joints, 0, cast_slice(&raw));

        // Seed history-dependent buffers on first frame so denoise/physics
        // don't compute giant velocities from uninitialized memory.
        if !self.history_seeded.swap(true, Ordering::AcqRel) {
            self.queue.write_buffer(&self.buffers.history_joints, 0, cast_slice(&raw));
            self.queue.write_buffer(&self.buffers.prev_joints, 0, cast_slice(&raw));
        }

        // ── Write uniforms ────────────────────────────────────────────────────
        let d  = DenoiseUniforms { joint_count, delta_time: dt, ..Default::default() };
        let s  = SkeletonUniforms { joint_count, ..Default::default() };
        let p  = PhysicsUniforms { joint_count, delta_time: dt, ..Default::default() };
        let mut sm = SupermotionLiveLinkUniforms::default();
        sm.joint_count  = joint_count;
        sm.delta_time   = dt;
        sm.time_sec     = time_sec;
        let ll = LiveLinkUniforms { joint_count, ..Default::default() };
        self.uniforms.write_all(&self.queue, &d, &s, &p, &sm, &ll);

        // ── Encode 5 compute passes ───────────────────────────────────────────
        let mut encoder = self.device.create_command_encoder(
            &CommandEncoderDescriptor { label: Some("zen-mocap-frame") }
        );

        // KAIN shaders expose LOCAL_SIZE_* uniforms and may compile with
        // backend-specific workgroup assumptions. Dispatching one workgroup
        // per joint guarantees coverage even if local size metadata changes.
        let dispatch = joint_count.max(1);

        // Pass 1 — denoise
        {
            self.device.push_error_scope(wgpu::ErrorFilter::Validation);
            let bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label:   Some("bg_denoise"),
                layout:  &self.pipelines.denoise.get_bind_group_layout(0),
                entries: &[
                    be(0, &self.buffers.raw_joints),
                    be(1, &self.buffers.history_joints),
                    be(2, &self.buffers.denoise_out),
                    be(3, &self.uniforms.denoise.joint_count),
                    be(4, &self.uniforms.denoise.delta_time),
                    be(5, &self.uniforms.denoise.min_cutoff),
                    be(6, &self.uniforms.denoise.beta),
                    be(7, &self.uniforms.denoise.d_cutoff),
                    be(8, &self.uniforms.denoise.jitter_response),
                    be(9, &self.uniforms.denoise.max_blend),
                    be(10, &self.uniforms.denoise.min_blend),
                    be(11, &self.uniforms.denoise.eps),
                ],
            });
            if let Some(err) = self.device.pop_error_scope().await {
                return Err(format!("bg_denoise validation failed: {err}"));
            }
            let mut c = encoder.begin_compute_pass(&ComputePassDescriptor {
                label: Some("pass_denoise"), timestamp_writes: None,
            });
            c.set_pipeline(&self.pipelines.denoise);
            c.set_bind_group(0, &bg, &[]);
            c.dispatch_workgroups(dispatch, 1, 1);
        }

        // Pass 2 — skeleton
        {
            self.device.push_error_scope(wgpu::ErrorFilter::Validation);
            let bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label:   Some("bg_skeleton"),
                layout:  &self.pipelines.skeleton.get_bind_group_layout(0),
                entries: &[
                    be(0, &self.buffers.denoise_out),
                    be(1, &self.buffers.skeleton_out),
                    be(2, &self.buffers.parents),
                    be(3, &self.buffers.rest_lengths),
                    be(4, &self.uniforms.skeleton.joint_count),
                    be(5, &self.uniforms.skeleton.stiffness),
                    be(6, &self.uniforms.skeleton.solver_iterations),
                    be(7, &self.uniforms.skeleton.max_correction),
                    be(8, &self.uniforms.skeleton.eps),
                ],
            });
            if let Some(err) = self.device.pop_error_scope().await {
                return Err(format!("bg_skeleton validation failed: {err}"));
            }
            let mut c = encoder.begin_compute_pass(&ComputePassDescriptor {
                label: Some("pass_skeleton"), timestamp_writes: None,
            });
            c.set_pipeline(&self.pipelines.skeleton);
            c.set_bind_group(0, &bg, &[]);
            c.dispatch_workgroups(dispatch, 1, 1);
        }

        // Pass 3 — physics
        {
            self.device.push_error_scope(wgpu::ErrorFilter::Validation);
            let bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label:   Some("bg_physics"),
                layout:  &self.pipelines.physics.get_bind_group_layout(0),
                entries: &[
                    be(0, &self.buffers.skeleton_out),
                    be(1, &self.buffers.prev_joints),
                    be(2, &self.buffers.physics_out),
                    be(3, &self.uniforms.physics.joint_count),
                    be(4, &self.uniforms.physics.floor_y),
                    be(5, &self.uniforms.physics.lock_velocity_thresh),
                    be(6, &self.uniforms.physics.lock_blend),
                    be(7, &self.uniforms.physics.repel_strength),
                    be(8, &self.uniforms.physics.delta_time),
                    be(9, &self.uniforms.physics.eps),
                    be(10, &self.uniforms.physics.ankle_start),
                    be(11, &self.uniforms.physics.ankle_end),
                    be(12, &self.uniforms.physics.toe_start),
                    be(13, &self.uniforms.physics.toe_end),
                    be(14, &self.uniforms.physics.capsule_a_joint),
                    be(15, &self.uniforms.physics.capsule_b_joint),
                    be(16, &self.uniforms.physics.capsule_radius),
                    be(17, &self.uniforms.physics.limb_radius),
                ],
            });
            if let Some(err) = self.device.pop_error_scope().await {
                return Err(format!("bg_physics validation failed: {err}"));
            }
            let mut c = encoder.begin_compute_pass(&ComputePassDescriptor {
                label: Some("pass_physics"), timestamp_writes: None,
            });
            c.set_pipeline(&self.pipelines.physics);
            c.set_bind_group(0, &bg, &[]);
            c.dispatch_workgroups(dispatch, 1, 1);
        }

        // Pass 4 — supermotion + livelink (fused)
        {
            self.device.push_error_scope(wgpu::ErrorFilter::Validation);
            let bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label:   Some("bg_supermotion"),
                layout:  &self.pipelines.supermotion.get_bind_group_layout(0),
                entries: &[
                    be(0, &self.buffers.physics_out),
                    be(1, &self.buffers.prev_joints),
                    be(2, &self.buffers.parents),
                    be(3, &self.buffers.mod_type),
                    be(4, &self.buffers.params_a),
                    be(5, &self.buffers.params_b),
                    be(6, &self.buffers.params_c),
                    be(7, &self.buffers.supermotion_out),
                    be(8, &self.buffers.quat_out),
                    be(9, &self.uniforms.supermotion.joint_count),
                    be(10, &self.uniforms.supermotion.time_sec),
                    be(11, &self.uniforms.supermotion.delta_time),
                    be(12, &self.uniforms.supermotion.floor_y),
                    be(13, &self.uniforms.supermotion.global_intensity),
                    be(14, &self.uniforms.supermotion.random_seed),
                    be(15, &self.uniforms.supermotion.eps),
                ],
            });
            if let Some(err) = self.device.pop_error_scope().await {
                return Err(format!("bg_supermotion validation failed: {err}"));
            }
            let mut c = encoder.begin_compute_pass(&ComputePassDescriptor {
                label: Some("pass_supermotion"), timestamp_writes: None,
            });
            c.set_pipeline(&self.pipelines.supermotion);
            c.set_bind_group(0, &bg, &[]);
            c.dispatch_workgroups(dispatch, 1, 1);
        }

        // Pass 5 — livelink (final re-orient pass, optional)
        {
            self.device.push_error_scope(wgpu::ErrorFilter::Validation);
            let bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label:   Some("bg_livelink"),
                layout:  &self.pipelines.livelink.get_bind_group_layout(0),
                entries: &[
                    be(0, &self.buffers.supermotion_out),
                    be(1, &self.buffers.parents),
                    be(2, &self.buffers.livelink_quat),
                    be(3, &self.uniforms.livelink.joint_count),
                    be(4, &self.uniforms.livelink.eps),
                ],
            });
            if let Some(err) = self.device.pop_error_scope().await {
                return Err(format!("bg_livelink validation failed: {err}"));
            }
            let mut c = encoder.begin_compute_pass(&ComputePassDescriptor {
                label: Some("pass_livelink"), timestamp_writes: None,
            });
            c.set_pipeline(&self.pipelines.livelink);
            c.set_bind_group(0, &bg, &[]);
            c.dispatch_workgroups(dispatch, 1, 1);
        }

        // ── Copy solved positions to readback buffer ───────────────────────────
        let readback_bytes = (joint_count as u64) * std::mem::size_of::<GpuVec4>() as u64;
        encoder.copy_buffer_to_buffer(
            &self.buffers.supermotion_out, 0,
            &self.buffers.readback,        0,
            readback_bytes,
        );

        // ── Also swap raw → history for next frame ────────────────────────────
        encoder.copy_buffer_to_buffer(
            &self.buffers.raw_joints, 0,
            &self.buffers.history_joints, 0,
            readback_bytes,
        );
        encoder.copy_buffer_to_buffer(
            &self.buffers.supermotion_out, 0,
            &self.buffers.prev_joints, 0,
            readback_bytes,
        );

        self.device.push_error_scope(wgpu::ErrorFilter::Validation);
        self.queue.submit(std::iter::once(encoder.finish()));
        self.device.poll(wgpu::MaintainBase::Wait);
        if let Some(err) = self.device.pop_error_scope().await {
            return Err(format!("GPU validation error during frame dispatch: {err}"));
        }

        // ── Async readback ────────────────────────────────────────────────────
        let readback_slice = self.buffers.readback.slice(..readback_bytes);
        let (tx, rx) = tokio::sync::oneshot::channel();
        readback_slice.map_async(wgpu::MapMode::Read, move |res| { tx.send(res).ok(); });
        self.device.poll(wgpu::MaintainBase::Wait);
        rx.await
            .map_err(|_| "GPU readback channel dropped".to_string())?
            .map_err(|e| format!("GPU buffer map error: {e}"))?;

        let solved: Vec<Joint> = {
            let data = readback_slice.get_mapped_range();
            let vecs: &[GpuVec4] = bytemuck::cast_slice(&data);
            vecs[..joint_count as usize]
                .iter()
                .zip(raw.iter())
                .map(|(s, r)| sanitize_solved_joint(*s, *r))
                .collect()
        };
        self.buffers.readback.unmap();

        Ok(solved)
    }
}

#[cfg(test)]
#[path = "gpu_chain_tests.rs"]
mod tests;

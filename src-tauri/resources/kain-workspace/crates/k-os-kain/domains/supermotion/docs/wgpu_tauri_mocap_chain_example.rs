// ZenMocap GPU chain example (wgpu + Tauri-friendly Rust side).
// This is a template file: wire your real device/pipeline/buffer creation around it.
// Pass order:
// 1) mocap_denoise -> 2) mocap_skeleton -> 3) mocap_physics
// 4) mocap_supermotion_livelink -> 5) mocap_livelink (optional final re-orient)

use bytemuck::{Pod, Zeroable};
use wgpu::util::DeviceExt;

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct Vec4(pub [f32; 4]);

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct DenoiseUniforms {
    pub joint_count: u32,
    pub _pad0: [u32; 3],
    pub delta_time: f32,
    pub min_cutoff: f32,
    pub beta: f32,
    pub d_cutoff: f32,
    pub jitter_response: f32,
    pub max_blend: f32,
    pub min_blend: f32,
    pub eps: f32,
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct SkeletonUniforms {
    pub joint_count: u32,
    pub _pad0: [u32; 3],
    pub stiffness: f32,
    pub solver_iterations: i32,
    pub max_correction: f32,
    pub eps: f32,
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct PhysicsUniforms {
    pub joint_count: u32,
    pub _pad0: [u32; 3],
    pub floor_y: f32,
    pub lock_velocity_thresh: f32,
    pub lock_blend: f32,
    pub repel_strength: f32,
    pub delta_time: f32,
    pub eps: f32,
    pub ankle_start: i32,
    pub ankle_end: i32,
    pub toe_start: i32,
    pub toe_end: i32,
    pub capsule_a_joint: u32,
    pub capsule_b_joint: u32,
    pub capsule_radius: f32,
    pub limb_radius: f32,
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct SupermotionUniforms {
    pub joint_count: u32,
    pub _pad0: [u32; 3],
    pub time_sec: f32,
    pub delta_time: f32,
    pub floor_y: f32,
    pub global_intensity: f32,
    pub random_seed: f32,
    pub eps: f32,
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct LivelinkUniforms {
    pub joint_count: u32,
    pub _pad0: [u32; 3],
    pub eps: f32,
    pub _pad1: [f32; 3],
}

pub struct MocapPipelines {
    pub denoise: wgpu::ComputePipeline,
    pub skeleton: wgpu::ComputePipeline,
    pub physics: wgpu::ComputePipeline,
    pub supermotion: wgpu::ComputePipeline,
    pub livelink: wgpu::ComputePipeline,
}

pub struct MocapBuffers {
    // Float4 joint buffers (XYZ + confidence/unused W)
    pub raw_joints: wgpu::Buffer,
    pub history_joints: wgpu::Buffer,
    pub denoise_out: wgpu::Buffer,
    pub skeleton_out: wgpu::Buffer,
    pub physics_out: wgpu::Buffer,
    pub supermotion_out_joints: wgpu::Buffer,

    // Topology/reference
    pub parents_i32: wgpu::Buffer,
    pub rest_lengths_f32: wgpu::Buffer,

    // Physics params that are joint-dependent
    pub prev_joints: wgpu::Buffer,

    // Supermotion command streams
    pub mod_type_i32: wgpu::Buffer,
    pub params_a_vec4: wgpu::Buffer,
    pub params_b_vec4: wgpu::Buffer,
    pub params_c_vec4: wgpu::Buffer,

    // Quaternion outputs
    pub supermotion_quat_out: wgpu::Buffer,
    pub livelink_quat_out: wgpu::Buffer,
}

pub struct MocapUniformBuffers {
    pub denoise: wgpu::Buffer,
    pub skeleton: wgpu::Buffer,
    pub physics: wgpu::Buffer,
    pub supermotion: wgpu::Buffer,
    pub livelink: wgpu::Buffer,
}

pub fn create_uniform_buffers(device: &wgpu::Device) -> MocapUniformBuffers {
    let mk = |label: &str, size: usize| {
        device.create_buffer(&wgpu::BufferDescriptor {
            label: Some(label),
            size: size as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        })
    };
    MocapUniformBuffers {
        denoise: mk("u_denoise", std::mem::size_of::<DenoiseUniforms>()),
        skeleton: mk("u_skeleton", std::mem::size_of::<SkeletonUniforms>()),
        physics: mk("u_physics", std::mem::size_of::<PhysicsUniforms>()),
        supermotion: mk("u_supermotion", std::mem::size_of::<SupermotionUniforms>()),
        livelink: mk("u_livelink", std::mem::size_of::<LivelinkUniforms>()),
    }
}

pub fn write_uniforms(
    queue: &wgpu::Queue,
    ubo: &MocapUniformBuffers,
    d: DenoiseUniforms,
    s: SkeletonUniforms,
    p: PhysicsUniforms,
    sm: SupermotionUniforms,
    ll: LivelinkUniforms,
) {
    queue.write_buffer(&ubo.denoise, 0, bytemuck::bytes_of(&d));
    queue.write_buffer(&ubo.skeleton, 0, bytemuck::bytes_of(&s));
    queue.write_buffer(&ubo.physics, 0, bytemuck::bytes_of(&p));
    queue.write_buffer(&ubo.supermotion, 0, bytemuck::bytes_of(&sm));
    queue.write_buffer(&ubo.livelink, 0, bytemuck::bytes_of(&ll));
}

pub fn encode_mocap_pipeline(
    device: &wgpu::Device,
    encoder: &mut wgpu::CommandEncoder,
    pipelines: &MocapPipelines,
    buffers: &MocapBuffers,
    ubo: &MocapUniformBuffers,
    joint_count: u32,
) {
    // Bindings exactly match .kn @ slots.
    // Strategy: each scalar uniform is read from one packed UBO (one binding).
    // If your current KAIN runtime expects 1-scalar-per-binding, replace these with split uniform buffers.

    let dispatch_x = ((joint_count + 63) / 64).max(1);

    // Pass 1: mocap_denoise
    {
        let layout = pipelines.denoise.get_bind_group_layout(0);
        let bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("bg_mocap_denoise"),
            layout: &layout,
            entries: &[
                be(0, &buffers.raw_joints),
                be(1, &buffers.history_joints),
                be(2, &buffers.denoise_out),
                be(3, &ubo.denoise),
            ],
        });
        let mut c = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("pass_mocap_denoise"),
            timestamp_writes: None,
        });
        c.set_pipeline(&pipelines.denoise);
        c.set_bind_group(0, &bg, &[]);
        c.dispatch_workgroups(dispatch_x, 1, 1);
    }

    // Pass 2: mocap_skeleton
    {
        let layout = pipelines.skeleton.get_bind_group_layout(0);
        let bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("bg_mocap_skeleton"),
            layout: &layout,
            entries: &[
                be(0, &buffers.denoise_out),
                be(1, &buffers.skeleton_out),
                be(2, &buffers.parents_i32),
                be(3, &buffers.rest_lengths_f32),
                be(4, &ubo.skeleton),
            ],
        });
        let mut c = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("pass_mocap_skeleton"),
            timestamp_writes: None,
        });
        c.set_pipeline(&pipelines.skeleton);
        c.set_bind_group(0, &bg, &[]);
        c.dispatch_workgroups(dispatch_x, 1, 1);
    }

    // Pass 3: mocap_physics
    {
        let layout = pipelines.physics.get_bind_group_layout(0);
        let bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("bg_mocap_physics"),
            layout: &layout,
            entries: &[
                be(0, &buffers.skeleton_out),
                be(1, &buffers.prev_joints),
                be(2, &buffers.physics_out),
                be(3, &ubo.physics),
            ],
        });
        let mut c = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("pass_mocap_physics"),
            timestamp_writes: None,
        });
        c.set_pipeline(&pipelines.physics);
        c.set_bind_group(0, &bg, &[]);
        c.dispatch_workgroups(dispatch_x, 1, 1);
    }

    // Pass 4: mocap_supermotion_livelink
    {
        let layout = pipelines.supermotion.get_bind_group_layout(0);
        let bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("bg_mocap_supermotion"),
            layout: &layout,
            entries: &[
                be(0, &buffers.physics_out),
                be(1, &buffers.prev_joints),
                be(2, &buffers.parents_i32),
                be(3, &buffers.mod_type_i32),
                be(4, &buffers.params_a_vec4),
                be(5, &buffers.params_b_vec4),
                be(6, &buffers.params_c_vec4),
                be(7, &buffers.supermotion_out_joints),
                be(8, &buffers.supermotion_quat_out),
                be(9, &ubo.supermotion),
            ],
        });
        let mut c = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("pass_mocap_supermotion"),
            timestamp_writes: None,
        });
        c.set_pipeline(&pipelines.supermotion);
        c.set_bind_group(0, &bg, &[]);
        c.dispatch_workgroups(dispatch_x, 1, 1);
    }

    // Pass 5: mocap_livelink (optional): recompute orientation only from final positions.
    {
        let layout = pipelines.livelink.get_bind_group_layout(0);
        let bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("bg_mocap_livelink"),
            layout: &layout,
            entries: &[
                be(0, &buffers.supermotion_out_joints),
                be(1, &buffers.parents_i32),
                be(2, &buffers.livelink_quat_out),
                be(3, &ubo.livelink),
            ],
        });
        let mut c = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("pass_mocap_livelink"),
            timestamp_writes: None,
        });
        c.set_pipeline(&pipelines.livelink);
        c.set_bind_group(0, &bg, &[]);
        c.dispatch_workgroups(dispatch_x, 1, 1);
    }
}

fn be(binding: u32, buffer: &wgpu::Buffer) -> wgpu::BindGroupEntry<'_> {
    wgpu::BindGroupEntry {
        binding,
        resource: buffer.as_entire_binding(),
    }
}

pub fn make_storage_buffer<T: Pod>(
    device: &wgpu::Device,
    label: &str,
    data: &[T],
    writable: bool,
) -> wgpu::Buffer {
    let mut usage = wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST;
    if !writable {
        usage |= wgpu::BufferUsages::COPY_SRC;
    }
    device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some(label),
        contents: bytemuck::cast_slice(data),
        usage,
    })
}

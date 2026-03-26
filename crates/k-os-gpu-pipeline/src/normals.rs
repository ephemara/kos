//! GPU Normal Recalculation Pipeline
//!
//! 3-pass compute shader for incremental normal updates:
//!   Pass 1: Clear normals for dirty vertices
//!   Pass 2: Accumulate face normals -> vertices (atomic fixed-point)
//!   Pass 3: Normalize accumulated normals
//!
//! Uses fixed-point arithmetic (16.16 format) for atomic float addition
//! since WGSL doesn't have atomicAdd for floats.

use bytemuck::{Pod, Zeroable};
use wgpu::util::DeviceExt;

/// Parameters for normal recalculation
#[repr(C)]
#[derive(Copy, Clone, Debug, Zeroable, Pod)]
pub struct NormalParams {
    /// Total number of faces in mesh (for bounds checking)
    pub face_count: u32,
    /// Number of vertices in mesh
    pub vertex_count: u32,
    /// Number of candidates (dirty vertices)
    pub candidate_count: u32,
    /// Number of dirty faces to process (the optimization!)
    pub dirty_faces_count: u32,
}

/// GPU Normal Recalculation Engine
pub struct GpuNormalCompute {
    clear_pipeline: wgpu::ComputePipeline,
    accumulate_pipeline: wgpu::ComputePipeline,
    normalize_pipeline: wgpu::ComputePipeline,
    bind_group_layout: wgpu::BindGroupLayout,
}

const NORMALS_SHADER: &str = r#"
struct NormalParams {
    face_count: u32,
    vertex_count: u32,
    candidate_count: u32,
    dirty_faces_count: u32,
}

@group(0) @binding(0) var<uniform> params: NormalParams;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> indices: array<u32>;
@group(0) @binding(3) var<storage, read> candidates: array<u32>;
@group(0) @binding(4) var<storage, read_write> normals_fixed: array<atomic<i32>>;
@group(0) @binding(5) var<storage, read_write> normals_out: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> dirty_mask: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read> dirty_faces: array<u32>;

const FIXED_SCALE: f32 = 65536.0;

fn float_to_fixed(f: f32) -> i32 {
    return i32(clamp(f, -32768.0, 32767.0) * FIXED_SCALE);
}

fn fixed_to_float(i: i32) -> f32 {
    return f32(i) / FIXED_SCALE;
}

@compute @workgroup_size(256)
fn clear_normals(@builtin(global_invocation_id) id: vec3<u32>) {
    let idx = id.x;
    if (idx >= params.candidate_count) {
        return;
    }

    let vertex_idx = candidates[idx];
    if (vertex_idx >= params.vertex_count) {
        return;
    }

    let base = vertex_idx * 3u;
    atomicStore(&normals_fixed[base + 0u], 0);
    atomicStore(&normals_fixed[base + 1u], 0);
    atomicStore(&normals_fixed[base + 2u], 0);

    let word_idx = vertex_idx / 32u;
    let bit_idx = vertex_idx % 32u;
    atomicOr(&dirty_mask[word_idx], 1u << bit_idx);
}

@compute @workgroup_size(256)
fn accumulate_face_normals(@builtin(global_invocation_id) id: vec3<u32>) {
    let idx = id.x;
    if (idx >= params.dirty_faces_count) {
        return;
    }

    let face_idx = dirty_faces[idx];
    if (face_idx >= params.face_count) {
        return;
    }

    let base = face_idx * 3u;
    let i0 = indices[base + 0u];
    let i1 = indices[base + 1u];
    let i2 = indices[base + 2u];

    if (i0 >= params.vertex_count || i1 >= params.vertex_count || i2 >= params.vertex_count) {
        return;
    }

    let p0 = positions[i0].xyz;
    let p1 = positions[i1].xyz;
    let p2 = positions[i2].xyz;

    let edge1 = p1 - p0;
    let edge2 = p2 - p0;
    let face_normal = cross(edge1, edge2);

    let len_sq = dot(face_normal, face_normal);
    if (len_sq < 0.0000001) {
        return;
    }

    let nx = float_to_fixed(face_normal.x);
    let ny = float_to_fixed(face_normal.y);
    let nz = float_to_fixed(face_normal.z);

    let b0 = i0 * 3u;
    atomicAdd(&normals_fixed[b0 + 0u], nx);
    atomicAdd(&normals_fixed[b0 + 1u], ny);
    atomicAdd(&normals_fixed[b0 + 2u], nz);

    let b1 = i1 * 3u;
    atomicAdd(&normals_fixed[b1 + 0u], nx);
    atomicAdd(&normals_fixed[b1 + 1u], ny);
    atomicAdd(&normals_fixed[b1 + 2u], nz);

    let b2 = i2 * 3u;
    atomicAdd(&normals_fixed[b2 + 0u], nx);
    atomicAdd(&normals_fixed[b2 + 1u], ny);
    atomicAdd(&normals_fixed[b2 + 2u], nz);
}

@compute @workgroup_size(256)
fn normalize_normals(@builtin(global_invocation_id) id: vec3<u32>) {
    let idx = id.x;
    if (idx >= params.candidate_count) {
        return;
    }

    let vertex_idx = candidates[idx];
    if (vertex_idx >= params.vertex_count) {
        return;
    }

    let base = vertex_idx * 3u;
    let nx_fixed = atomicLoad(&normals_fixed[base + 0u]);
    let ny_fixed = atomicLoad(&normals_fixed[base + 1u]);
    let nz_fixed = atomicLoad(&normals_fixed[base + 2u]);

    var normal = vec3<f32>(
        fixed_to_float(nx_fixed),
        fixed_to_float(ny_fixed),
        fixed_to_float(nz_fixed)
    );

    let len = length(normal);
    if (len > 0.0001) {
        normal = normal / len;
    } else {
        normal = vec3<f32>(0.0, 1.0, 0.0);
    }

    normals_out[vertex_idx] = vec4<f32>(normal, 0.0);

    let word_idx = vertex_idx / 32u;
    let bit_idx = vertex_idx % 32u;
    atomicAnd(&dirty_mask[word_idx], ~(1u << bit_idx));
}
"#;

impl GpuNormalCompute {
    pub fn new(device: &wgpu::Device) -> Self {
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("normals_shader"),
            source: wgpu::ShaderSource::Wgsl(NORMALS_SHADER.into()),
        });

        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("normals_bind_group_layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 4,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 5,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 6,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 7,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("normals_pipeline_layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let clear_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("clear_normals_pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("clear_normals"),
            compilation_options: Default::default(),
            cache: None,
        });

        let accumulate_pipeline =
            device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                label: Some("accumulate_face_normals_pipeline"),
                layout: Some(&pipeline_layout),
                module: &shader,
                entry_point: Some("accumulate_face_normals"),
                compilation_options: Default::default(),
                cache: None,
            });

        let normalize_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("normalize_normals_pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("normalize_normals"),
            compilation_options: Default::default(),
            cache: None,
        });

        Self {
            clear_pipeline,
            accumulate_pipeline,
            normalize_pipeline,
            bind_group_layout,
        }
    }

    pub fn encode_recalculate_normals(
        &self,
        device: &wgpu::Device,
        encoder: &mut wgpu::CommandEncoder,
        buffers: &GpuNormalBuffers,
        params: NormalParams,
    ) {
        if params.candidate_count == 0 || params.face_count == 0 {
            return;
        }

        let params_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("normal_params_buffer"),
            contents: bytemuck::bytes_of(&params),
            usage: wgpu::BufferUsages::UNIFORM,
        });

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("normals_bind_group"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: params_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: buffers.positions.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: buffers.indices.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: buffers.candidates.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: buffers.normals_fixed.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 5,
                    resource: buffers.normals_out.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 6,
                    resource: buffers.dirty_mask.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 7,
                    resource: buffers.dirty_faces.as_entire_binding(),
                },
            ],
        });

        {
            let workgroups = (params.candidate_count + 255) / 256;
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("clear_normals_pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.clear_pipeline);
            pass.set_bind_group(0, &bind_group, &[]);
            pass.dispatch_workgroups(workgroups, 1, 1);
        }

        {
            let workgroups = (params.dirty_faces_count + 255) / 256;
            if workgroups > 0 {
                let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                    label: Some("accumulate_face_normals_pass"),
                    timestamp_writes: None,
                });
                pass.set_pipeline(&self.accumulate_pipeline);
                pass.set_bind_group(0, &bind_group, &[]);
                pass.dispatch_workgroups(workgroups, 1, 1);
            }
        }

        {
            let workgroups = (params.candidate_count + 255) / 256;
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("normalize_normals_pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.normalize_pipeline);
            pass.set_bind_group(0, &bind_group, &[]);
            pass.dispatch_workgroups(workgroups, 1, 1);
        }
    }
}

pub struct GpuNormalBuffers {
    pub positions: wgpu::Buffer,
    pub indices: wgpu::Buffer,
    pub candidates: wgpu::Buffer,
    pub normals_fixed: wgpu::Buffer,
    pub normals_out: wgpu::Buffer,
    pub dirty_mask: wgpu::Buffer,
    pub dirty_faces: wgpu::Buffer,
    pub vertex_count: u32,
    pub face_count: u32,
}

impl GpuNormalBuffers {
    pub fn new(
        device: &wgpu::Device,
        positions_buffer: &wgpu::Buffer,
        indices: &[u32],
        vertex_count: u32,
        max_candidates: u32,
    ) -> Self {
        let face_count = (indices.len() / 3) as u32;

        let indices_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("normal_indices_buffer"),
            contents: bytemuck::cast_slice(indices),
            usage: wgpu::BufferUsages::STORAGE,
        });

        let candidates_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("normal_candidates_buffer"),
            size: (max_candidates * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let normals_fixed_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("normals_fixed_buffer"),
            size: (vertex_count * 3 * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE,
            mapped_at_creation: false,
        });

        let normals_out_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("normals_out_buffer"),
            size: (vertex_count * 4 * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });

        let mask_words = (vertex_count + 31) / 32;
        let dirty_mask_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("dirty_mask_buffer"),
            size: (mask_words * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE,
            mapped_at_creation: false,
        });

        let max_dirty_faces = (max_candidates * 6).min(face_count);
        let dirty_faces_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("dirty_faces_buffer"),
            size: (max_dirty_faces * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        Self {
            positions: positions_buffer.clone(),
            indices: indices_buffer,
            candidates: candidates_buffer,
            normals_fixed: normals_fixed_buffer,
            normals_out: normals_out_buffer,
            dirty_mask: dirty_mask_buffer,
            dirty_faces: dirty_faces_buffer,
            vertex_count,
            face_count,
        }
    }

    pub fn from_existing_positions(
        device: &wgpu::Device,
        indices: &[u32],
        vertex_count: u32,
        max_candidates: u32,
    ) -> (wgpu::Buffer, wgpu::Buffer, wgpu::Buffer, wgpu::Buffer, u32) {
        let face_count = (indices.len() / 3) as u32;

        let indices_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("normal_indices_buffer"),
            contents: bytemuck::cast_slice(indices),
            usage: wgpu::BufferUsages::STORAGE,
        });

        let normals_fixed_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("normals_fixed_buffer"),
            size: (vertex_count * 3 * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE,
            mapped_at_creation: false,
        });

        let normals_out_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("normals_out_buffer"),
            size: (vertex_count * 4 * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });

        let mask_words = (vertex_count + 31) / 32;
        let dirty_mask_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("dirty_mask_buffer"),
            size: (mask_words * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE,
            mapped_at_creation: false,
        });

        let _ = max_candidates;
        (
            indices_buffer,
            normals_fixed_buffer,
            normals_out_buffer,
            dirty_mask_buffer,
            face_count,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_params_size() {
        assert_eq!(std::mem::size_of::<NormalParams>(), 16);
    }
}

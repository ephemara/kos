//! GPU Loop Subdivision Pipeline v2 - Production Quality
//!
//! Architecture:
//! - CPU: Build topology (edge dedup, adjacency) - O(n), cacheable
//! - GPU: Compute positions with proper Loop weights - parallel, fast
//!
//! Performance:
//! - First run: ~5-10ms (CPU topology + GPU positions)
//! - Cached run: ~2-5ms (GPU only)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use wgpu::util::DeviceExt;

// ============================================================================
// RESULT TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuSubdivideResult {
    pub positions: Vec<f32>,
    pub normals: Vec<f32>,
    pub indices: Vec<u32>,
    pub vertex_count: usize,
    pub face_count: usize,
    pub time_ms: f64,
    pub topology_ms: f64,
    pub gpu_ms: f64,
}

// ============================================================================
// TOPOLOGY DATA (CPU-computed, GPU-uploadable)
// ============================================================================

/// Edge key for deduplication (always stores min vertex first)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct EdgeKey(u32, u32);

impl EdgeKey {
    fn new(a: u32, b: u32) -> Self {
        if a < b {
            EdgeKey(a, b)
        } else {
            EdgeKey(b, a)
        }
    }
}

/// Subdivision topology computed on CPU
#[derive(Debug, Clone)]
pub struct SubdivisionTopology {
    /// Original vertex count
    pub orig_vertex_count: u32,
    /// Number of unique edges (= number of new edge vertices)
    pub edge_count: u32,
    /// New vertex count = orig_vertex_count + edge_count
    pub new_vertex_count: u32,
    /// New face count = orig_face_count * 4
    pub new_face_count: u32,

    /// For each original vertex: list of neighbor vertex indices
    /// Stored as CSR (Compressed Sparse Row) format for GPU
    pub neighbor_offsets: Vec<u32>,
    pub neighbor_data: Vec<u32>,

    /// For CPU index generation
    pub face_edge_vertices: Vec<u32>,

    /// Per-edge endpoint vertex indices
    /// [edge_idx * 2 + 0] = v0, [edge_idx * 2 + 1] = v1
    pub edge_endpoints: Vec<u32>,

    /// Per-edge opposite vertices from adjacent faces
    /// For interior edges both are set; otherwise values are u32::MAX
    pub edge_opposites: Vec<u32>,

    /// New index buffer (pre-computed on CPU since it's pure topology)
    pub new_indices: Vec<u32>,
}

impl SubdivisionTopology {
    /// Build topology from mesh indices (CPU, O(faces + edges))
    pub fn build(indices: &[u32], vertex_count: usize) -> Self {
        let face_count = indices.len() / 3;

        // Step 1: Build edge map + adjacency + edge-to-face mapping
        let mut edge_map: HashMap<EdgeKey, u32> = HashMap::new();
        let mut neighbors: Vec<Vec<u32>> = vec![Vec::new(); vertex_count];
        let mut edge_faces: HashMap<EdgeKey, Vec<u32>> = HashMap::new();
        let mut next_edge_idx = 0u32;

        for face_idx in 0..face_count {
            let i0 = indices[face_idx * 3];
            let i1 = indices[face_idx * 3 + 1];
            let i2 = indices[face_idx * 3 + 2];

            for &(a, b) in &[(i0, i1), (i1, i2), (i2, i0)] {
                let key = EdgeKey::new(a, b);
                edge_map.entry(key).or_insert_with(|| {
                    let idx = next_edge_idx;
                    next_edge_idx += 1;
                    idx
                });
                edge_faces.entry(key).or_default().push(face_idx as u32);

                if !neighbors[a as usize].contains(&b) {
                    neighbors[a as usize].push(b);
                }
                if !neighbors[b as usize].contains(&a) {
                    neighbors[b as usize].push(a);
                }
            }
        }

        let edge_count = next_edge_idx;
        let new_vertex_count = vertex_count as u32 + edge_count;
        let new_face_count = (face_count * 4) as u32;

        // Step 2: Convert adjacency to CSR format
        let mut neighbor_offsets = Vec::with_capacity(vertex_count + 1);
        let mut neighbor_data = Vec::new();
        let mut offset = 0u32;

        for nbrs in neighbors.iter().take(vertex_count) {
            neighbor_offsets.push(offset);
            for &neighbor in nbrs {
                neighbor_data.push(neighbor);
                offset += 1;
            }
        }
        neighbor_offsets.push(offset);

        // Step 3: Build per-face edge vertex indices
        let mut face_edge_vertices = Vec::with_capacity(face_count * 3);
        for face_idx in 0..face_count {
            let i0 = indices[face_idx * 3];
            let i1 = indices[face_idx * 3 + 1];
            let i2 = indices[face_idx * 3 + 2];

            let e01 = vertex_count as u32 + edge_map[&EdgeKey::new(i0, i1)];
            let e12 = vertex_count as u32 + edge_map[&EdgeKey::new(i1, i2)];
            let e20 = vertex_count as u32 + edge_map[&EdgeKey::new(i2, i0)];

            face_edge_vertices.push(e01);
            face_edge_vertices.push(e12);
            face_edge_vertices.push(e20);
        }

        // Step 3b: Build per-edge endpoint/opposite tables for GPU edge weights
        let mut edge_endpoints = vec![0u32; edge_count as usize * 2];
        let mut edge_opposites = vec![u32::MAX; edge_count as usize * 2];

        for (edge_key, &edge_idx) in &edge_map {
            let base = edge_idx as usize * 2;
            edge_endpoints[base] = edge_key.0;
            edge_endpoints[base + 1] = edge_key.1;
        }

        let find_opposite = |face_idx: usize, a: u32, b: u32| -> Option<u32> {
            for i in 0..3 {
                let vi = indices[face_idx * 3 + i];
                if vi != a && vi != b {
                    return Some(vi);
                }
            }
            None
        };

        for (edge_key, faces) in &edge_faces {
            if faces.len() != 2 {
                continue;
            }
            let edge_idx = edge_map[edge_key] as usize;
            if let (Some(opp0), Some(opp1)) = (
                find_opposite(faces[0] as usize, edge_key.0, edge_key.1),
                find_opposite(faces[1] as usize, edge_key.0, edge_key.1),
            ) {
                let base = edge_idx * 2;
                edge_opposites[base] = opp0;
                edge_opposites[base + 1] = opp1;
            }
        }

        // Step 4: Build new index buffer (4 triangles per original)
        let mut new_indices = Vec::with_capacity(face_count * 12);
        for face_idx in 0..face_count {
            let i0 = indices[face_idx * 3];
            let i1 = indices[face_idx * 3 + 1];
            let i2 = indices[face_idx * 3 + 2];

            let e01 = face_edge_vertices[face_idx * 3];
            let e12 = face_edge_vertices[face_idx * 3 + 1];
            let e20 = face_edge_vertices[face_idx * 3 + 2];

            new_indices.extend_from_slice(&[i0, e01, e20]);
            new_indices.extend_from_slice(&[e01, i1, e12]);
            new_indices.extend_from_slice(&[e20, e12, i2]);
            new_indices.extend_from_slice(&[e01, e12, e20]);
        }

        SubdivisionTopology {
            orig_vertex_count: vertex_count as u32,
            edge_count,
            new_vertex_count,
            new_face_count,
            neighbor_offsets,
            neighbor_data,
            face_edge_vertices,
            edge_endpoints,
            edge_opposites,
            new_indices,
        }
    }
}

// ============================================================================
// GPU SUBDIVISION ENGINE v2
// ============================================================================

pub struct GpuSubdivideEngineV2 {
    smooth_original_pipeline: wgpu::ComputePipeline,
    compute_edge_verts_pipeline: wgpu::ComputePipeline,
    bind_group_layout: wgpu::BindGroupLayout,
}

impl GpuSubdivideEngineV2 {
    pub fn new(device: &wgpu::Device) -> Self {
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Subdivide V2 Bind Group Layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
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
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
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
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 5,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 6,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 7,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Subdivide V2 Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Subdivide V2 Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("subdivide_v2.wgsl").into()),
        });

        let smooth_original_pipeline =
            device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                label: Some("Smooth Original Vertices Pipeline"),
                layout: Some(&pipeline_layout),
                module: &shader,
                entry_point: Some("smooth_original_vertices"),
                compilation_options: Default::default(),
                cache: None,
            });

        let compute_edge_verts_pipeline =
            device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                label: Some("Compute Edge Vertices Pipeline"),
                layout: Some(&pipeline_layout),
                module: &shader,
                entry_point: Some("compute_edge_vertices"),
                compilation_options: Default::default(),
                cache: None,
            });

        Self {
            smooth_original_pipeline,
            compute_edge_verts_pipeline,
            bind_group_layout,
        }
    }

    /// Perform subdivision with pre-computed topology
    pub fn subdivide_with_topology(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        positions: &[f32],
        indices: &[u32],
        topology: &SubdivisionTopology,
    ) -> Result<GpuSubdivideResult, String> {
        let start = std::time::Instant::now();

        let positions_in = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Positions In"),
            contents: bytemuck::cast_slice(positions),
            usage: wgpu::BufferUsages::STORAGE,
        });

        let indices_in = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Indices In"),
            contents: bytemuck::cast_slice(indices),
            usage: wgpu::BufferUsages::STORAGE,
        });

        let positions_out = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Positions Out"),
            size: (topology.new_vertex_count as usize * 3 * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });

        let neighbor_offsets_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Neighbor Offsets"),
            contents: bytemuck::cast_slice(&topology.neighbor_offsets),
            usage: wgpu::BufferUsages::STORAGE,
        });

        let neighbor_data_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Neighbor Data"),
            contents: bytemuck::cast_slice(&topology.neighbor_data),
            usage: wgpu::BufferUsages::STORAGE,
        });

        let edge_endpoints_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Edge Endpoints"),
            contents: bytemuck::cast_slice(&topology.edge_endpoints),
            usage: wgpu::BufferUsages::STORAGE,
        });

        let edge_opposites_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Edge Opposites"),
            contents: bytemuck::cast_slice(&topology.edge_opposites),
            usage: wgpu::BufferUsages::STORAGE,
        });

        #[repr(C)]
        #[derive(Copy, Clone, bytemuck::Pod, bytemuck::Zeroable)]
        struct Uniforms {
            orig_vertex_count: u32,
            edge_count: u32,
            _pad0: u32,
            _pad1: u32,
        }

        let uniforms = Uniforms {
            orig_vertex_count: topology.orig_vertex_count,
            edge_count: topology.edge_count,
            _pad0: 0,
            _pad1: 0,
        };

        let uniform_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Subdivide Uniforms"),
            contents: bytemuck::bytes_of(&uniforms),
            usage: wgpu::BufferUsages::UNIFORM,
        });

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Subdivide V2 Bind Group"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: positions_in.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: indices_in.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: positions_out.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: neighbor_offsets_buf.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: neighbor_data_buf.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 5,
                    resource: edge_endpoints_buf.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 6,
                    resource: edge_opposites_buf.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 7,
                    resource: uniform_buf.as_entire_binding(),
                },
            ],
        });

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Subdivide V2 Encoder"),
        });

        let workgroup_size = 256u32;

        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("Smooth Original Pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.smooth_original_pipeline);
            pass.set_bind_group(0, &bind_group, &[]);
            pass.dispatch_workgroups(
                (topology.orig_vertex_count + workgroup_size - 1) / workgroup_size,
                1,
                1,
            );
        }

        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("Edge Vertices Pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.compute_edge_verts_pipeline);
            pass.set_bind_group(0, &bind_group, &[]);
            pass.dispatch_workgroups(
                (topology.edge_count + workgroup_size - 1) / workgroup_size,
                1,
                1,
            );
        }

        let staging = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Positions Staging"),
            size: (topology.new_vertex_count as usize * 3 * 4) as u64,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        encoder.copy_buffer_to_buffer(
            &positions_out,
            0,
            &staging,
            0,
            (topology.new_vertex_count as usize * 3 * 4) as u64,
        );

        queue.submit(std::iter::once(encoder.finish()));

        let (tx, rx) = std::sync::mpsc::channel();
        staging
            .slice(..)
            .map_async(wgpu::MapMode::Read, move |result| {
                let _ = tx.send(result);
            });
        let _ = device.poll(wgpu::PollType::Wait);
        rx.recv()
            .map_err(|e| format!("Channel error: {:?}", e))?
            .map_err(|e| format!("Map error: {:?}", e))?;

        let data = staging.slice(..).get_mapped_range();
        let new_positions: Vec<f32> = bytemuck::cast_slice(&data).to_vec();
        drop(data);
        staging.unmap();

        let gpu_ms = start.elapsed().as_secs_f64() * 1000.0;

        Ok(GpuSubdivideResult {
            positions: new_positions,
            normals: Vec::new(),
            indices: topology.new_indices.clone(),
            vertex_count: topology.new_vertex_count as usize,
            face_count: topology.new_face_count as usize,
            time_ms: gpu_ms,
            topology_ms: 0.0,
            gpu_ms,
        })
    }

    /// Perform a single subdivision level
    pub fn subdivide_once(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        positions: &[f32],
        indices: &[u32],
    ) -> Result<GpuSubdivideResult, String> {
        let vertex_count = positions.len() / 3;
        let topology = SubdivisionTopology::build(indices, vertex_count);
        self.subdivide_with_topology(device, queue, positions, indices, &topology)
    }
}

// ============================================================================
// HIGH-LEVEL API
// ============================================================================

use crate::gpu::device::GpuComputeDevice;
use once_cell::sync::OnceCell;
use parking_lot::Mutex;

static GPU_SUBDIVIDE_V2: OnceCell<Arc<Mutex<GpuSubdivideEngineV2>>> = OnceCell::new();

fn get_engine_v2() -> Result<Arc<Mutex<GpuSubdivideEngineV2>>, String> {
    if let Some(engine) = GPU_SUBDIVIDE_V2.get() {
        return Ok(engine.clone());
    }

    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_lock = gpu.lock();

    let engine = GpuSubdivideEngineV2::new(&gpu_lock.device);
    let arc = Arc::new(Mutex::new(engine));

    GPU_SUBDIVIDE_V2
        .set(arc.clone())
        .map_err(|_| "Already initialized")?;
    Ok(arc)
}

/// Production-quality GPU subdivision
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn gpu_subdivide_v2(
    positions: Vec<f32>,
    indices: Vec<u32>,
    levels: u32,
) -> Result<GpuSubdivideResult, String> {
    let levels = levels.min(4);
    let total_start = std::time::Instant::now();

    let (device, queue) = {
        let gpu = GpuComputeDevice::get_or_init_blocking()?;
        let lock = gpu.lock();
        (lock.device.clone(), lock.queue.clone())
    };

    let engine = get_engine_v2()?;
    let engine_lock = engine.lock();

    let mut current_positions = positions;
    let mut current_indices = indices;
    let mut total_topology_ms = 0.0;
    let mut total_gpu_ms = 0.0;

    for _level in 0..levels {
        let vertex_count = current_positions.len() / 3;

        let topo_start = std::time::Instant::now();
        let topology = SubdivisionTopology::build(&current_indices, vertex_count);
        let topo_ms = topo_start.elapsed().as_secs_f64() * 1000.0;
        total_topology_ms += topo_ms;

        let result = engine_lock.subdivide_with_topology(
            &device,
            &queue,
            &current_positions,
            &current_indices,
            &topology,
        )?;

        total_gpu_ms += result.gpu_ms;
        current_positions = result.positions;
        current_indices = result.indices;
    }

    let total_ms = total_start.elapsed().as_secs_f64() * 1000.0;

    Ok(GpuSubdivideResult {
        positions: current_positions.clone(),
        normals: Vec::new(),
        indices: current_indices.clone(),
        vertex_count: current_positions.len() / 3,
        face_count: current_indices.len() / 3,
        time_ms: total_ms,
        topology_ms: total_topology_ms,
        gpu_ms: total_gpu_ms,
    })
}

/// GPU subdivide V2 + register with sculpt backend (no IPC round-trip!)
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn gpu_subdivide_v2_and_register(
    _positions: Vec<f32>,
    _indices: Vec<u32>,
    _levels: u32,
) -> Result<(GpuSubdivideResult, u64), String> {
    Err("gpu_subdivide_v2_and_register remains a compatibility wrapper in k-os-engine".to_string())
}

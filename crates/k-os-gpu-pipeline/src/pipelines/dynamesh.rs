//! GPU-Accelerated Dynamesh Remeshing
//!
//! ZBrush-style dynamesh using WGPU compute shaders.
//! Performance target: 100K triangles @ 128³ resolution in <100ms

use bytemuck::{Pod, Zeroable};
use glam::Vec3;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use wgpu::util::DeviceExt;

use crate::gpu::device::GpuComputeDevice;

use super::marching_cubes_tables::{EDGE_TABLE, TRI_TABLE};

// ============================================================================
// TYPES
// ============================================================================

#[repr(C)]
#[derive(Copy, Clone, Debug, Zeroable, Pod)]
pub struct GpuTriangle {
    pub a: [f32; 4],
    pub b: [f32; 4],
    pub c: [f32; 4],
}

#[repr(C)]
#[derive(Copy, Clone, Debug, Zeroable, Pod)]
pub struct SdfBuildParams {
    pub grid_min: [f32; 4],
    pub grid_max: [f32; 4],
    pub resolution: u32,
    pub triangle_count: u32,
    pub cell_size: f32,
    pub _pad: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuDynameshParams {
    pub resolution: u32,
    pub smooth_steps: u32,
    pub padding: f32,
    pub iso_level: f32,
    pub vertex_smooth: u32,
}

impl Default for GpuDynameshParams {
    fn default() -> Self {
        // Better defaults for clean remesh
        Self {
            resolution: 128,
            smooth_steps: 3,  // More SDF smoothing helps
            padding: 0.08,    // More padding to avoid edge artifacts
            iso_level: 0.001, // Small epsilon avoids numerical noise at surface
            vertex_smooth: 3, // More vertex smoothing for clean mesh
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuDynameshResult {
    pub positions: Vec<f32>,
    pub indices: Vec<u32>,
    pub normals: Vec<f32>,
    pub time_ms: f64,
    pub stats: GpuDynameshStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuDynameshStats {
    pub original_vertices: usize,
    pub original_triangles: usize,
    pub output_vertices: usize,
    pub output_triangles: usize,
    pub grid_resolution: u32,
    pub sdf_build_ms: f64,
    pub sdf_smooth_ms: f64,
    pub marching_cubes_ms: f64,
    pub vertex_smooth_ms: f64,
    pub gpu_used: bool,
}

// ============================================================================
// GPU DYNAMESH ENGINE
// ============================================================================

pub struct GpuDynameshEngine {
    sdf_build_pipeline: wgpu::ComputePipeline,
    sdf_smooth_pipeline: wgpu::ComputePipeline,
    sdf_build_layout: wgpu::BindGroupLayout,
    sdf_smooth_layout: wgpu::BindGroupLayout,
    params_buffer: wgpu::Buffer,
    workgroup_size: u32,
}

impl GpuDynameshEngine {
    pub fn new(device: &wgpu::Device) -> Self {
        let workgroup_size = 4; // 4x4x4 = 64 threads (safe for all GPUs)
        let build_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("gpu_dynamesh_build_shader"),
            source: wgpu::ShaderSource::Wgsl(DYNAMESH_BUILD_WGSL.into()),
        });

        let smooth_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("gpu_dynamesh_smooth_shader"),
            source: wgpu::ShaderSource::Wgsl(DYNAMESH_SMOOTH_WGSL.into()),
        });

        let sdf_build_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("dynamesh_sdf_build_layout"),
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
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
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

        let sdf_smooth_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("dynamesh_sdf_smooth_layout"),
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
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
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

        let sdf_build_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("dynamesh_sdf_build_pipeline"),
            layout: Some(
                &device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: None,
                    bind_group_layouts: &[&sdf_build_layout],
                    push_constant_ranges: &[],
                }),
            ),
            module: &build_shader,
            entry_point: Some("build_sdf"),
            compilation_options: Default::default(),
            cache: None,
        });

        let sdf_smooth_pipeline =
            device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                label: Some("dynamesh_sdf_smooth_pipeline"),
                layout: Some(
                    &device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                        label: None,
                        bind_group_layouts: &[&sdf_smooth_layout],
                        push_constant_ranges: &[],
                    }),
                ),
                module: &smooth_shader,
                entry_point: Some("smooth_sdf"),
                compilation_options: Default::default(),
                cache: None,
            });

        let params_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("dynamesh_params"),
            size: std::mem::size_of::<SdfBuildParams>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        Self {
            sdf_build_pipeline,
            sdf_smooth_pipeline,
            sdf_build_layout,
            sdf_smooth_layout,
            params_buffer,
            workgroup_size,
        }
    }

    pub fn remesh(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        positions: &[f32],
        indices: &[u32],
        params: &GpuDynameshParams,
    ) -> Result<GpuDynameshResult, String> {
        let total_start = Instant::now();
        if positions.len() % 3 != 0 {
            return Err("positions must be [x,y,z,...] format".into());
        }
        if indices.len() % 3 != 0 {
            return Err("indices must be triangle list".into());
        }

        let vertex_count = positions.len() / 3;
        let triangle_count = indices.len() / 3;
        if triangle_count == 0 {
            return Err("No triangles to remesh".into());
        }

        // SMART AUTO-RESOLUTION: Scale based on input complexity
        // Goal: Output roughly similar triangle count to input (not 20x more!)
        //
        // Heuristic: For a sphere, marching cubes at resolution R produces ~12*R² triangles
        // To match input triangle count T, we want R ≈ sqrt(T/12)
        //
        // Examples:
        //   6000 tris → sqrt(6000/12) = 22 → clamp to 64 (minimum)
        //   50000 tris → sqrt(50000/12) = 64
        //   100000 tris → sqrt(100000/12) = 91
        //   500000 tris → sqrt(500000/12) = 204

        let target_resolution = ((triangle_count as f64 / 12.0).sqrt()) as u32;

        // Clamp to reasonable range: 48-256
        // Allow user to request higher if they want, but warn them
        let auto_resolution = target_resolution.clamp(48, 256);

        let effective_resolution = if params.resolution > auto_resolution * 2 {
            // User requested much higher than auto - warn and cap
            log::warn!(
                "[GpuDynamesh] Resolution {} too high for {} tris mesh. Auto-scaling to {} to prevent polygon explosion.",
                params.resolution, triangle_count, auto_resolution
            );
            auto_resolution
        } else {
            // Use what user requested (or auto if lower)
            params.resolution.min(auto_resolution.max(64))
        };

        // GPU timeout protection: also limit based on compute work
        let max_work = 50_000_000u64;
        let voxel_count = (effective_resolution as u64).pow(3);
        let total_work = voxel_count * triangle_count as u64;

        let final_resolution = if total_work > max_work {
            let safe_res = ((max_work as f64 / triangle_count as f64).cbrt()) as u32;
            let clamped = safe_res.max(48).min(effective_resolution);
            log::warn!(
                "[GpuDynamesh] GPU work limit - reducing {} → {}",
                effective_resolution,
                clamped
            );
            clamped
        } else {
            effective_resolution
        };

        // Use final resolution for the rest
        let params = GpuDynameshParams {
            resolution: final_resolution,
            ..params.clone()
        };

        let (min, max) = compute_aabb(positions)?;
        let extent = max - min;
        let max_dim = extent.x.max(extent.y).max(extent.z);
        let padding = max_dim * params.padding;
        let grid_min = min - Vec3::splat(padding);
        let grid_max = max + Vec3::splat(padding);
        let grid_extent = grid_max - grid_min;
        let cell_size =
            grid_extent.x.max(grid_extent.y).max(grid_extent.z) / (params.resolution as f32 - 1.0);

        let gpu_triangles: Vec<GpuTriangle> = indices
            .chunks(3)
            .map(|tri| {
                let (i0, i1, i2) = (tri[0] as usize, tri[1] as usize, tri[2] as usize);
                GpuTriangle {
                    a: [
                        positions[i0 * 3],
                        positions[i0 * 3 + 1],
                        positions[i0 * 3 + 2],
                        0.0,
                    ],
                    b: [
                        positions[i1 * 3],
                        positions[i1 * 3 + 1],
                        positions[i1 * 3 + 2],
                        0.0,
                    ],
                    c: [
                        positions[i2 * 3],
                        positions[i2 * 3 + 1],
                        positions[i2 * 3 + 2],
                        0.0,
                    ],
                }
            })
            .collect();

        let sdf_build_start = Instant::now();
        let res = params.resolution as usize;
        let grid_size = res * res * res;

        let triangles_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("dynamesh_triangles"),
            contents: bytemuck::cast_slice(&gpu_triangles),
            usage: wgpu::BufferUsages::STORAGE,
        });
        // Initialize SDF grids to large positive value (outside mesh by default)
        let sdf_init: Vec<f32> = vec![1000.0f32; grid_size];
        let sdf_buffer_a = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("dynamesh_sdf_a"),
            contents: bytemuck::cast_slice(&sdf_init),
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
        });
        let sdf_buffer_b = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("dynamesh_sdf_b"),
            contents: bytemuck::cast_slice(&sdf_init),
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
        });
        let staging_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("dynamesh_staging"),
            size: (grid_size * 4) as u64,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let build_params = SdfBuildParams {
            grid_min: [grid_min.x, grid_min.y, grid_min.z, 0.0],
            grid_max: [grid_max.x, grid_max.y, grid_max.z, 0.0],
            resolution: params.resolution,
            triangle_count: triangle_count as u32,
            cell_size,
            _pad: 0,
        };
        queue.write_buffer(&self.params_buffer, 0, bytemuck::bytes_of(&build_params));

        let sdf_build_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("dynamesh_sdf_build_bg"),
            layout: &self.sdf_build_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: triangles_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: sdf_buffer_a.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.params_buffer.as_entire_binding(),
                },
            ],
        });

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("dynamesh_encoder"),
        });
        {
            let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("dynamesh_sdf_build_pass"),
                timestamp_writes: None,
            });
            cpass.set_pipeline(&self.sdf_build_pipeline);
            cpass.set_bind_group(0, &sdf_build_bind_group, &[]);
            let wg = (params.resolution + self.workgroup_size - 1) / self.workgroup_size;
            cpass.dispatch_workgroups(wg, wg, wg);
        }
        queue.submit(std::iter::once(encoder.finish()));
        let _ = device.poll(wgpu::PollType::Wait);
        let sdf_build_ms = sdf_build_start.elapsed().as_secs_f64() * 1000.0;

        let sdf_smooth_start = Instant::now();
        let mut current_sdf = &sdf_buffer_a;
        let mut next_sdf = &sdf_buffer_b;
        for _ in 0..params.smooth_steps {
            let smooth_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("dynamesh_sdf_smooth_bg"),
                layout: &self.sdf_smooth_layout,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: current_sdf.as_entire_binding(),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: next_sdf.as_entire_binding(),
                    },
                    wgpu::BindGroupEntry {
                        binding: 2,
                        resource: self.params_buffer.as_entire_binding(),
                    },
                ],
            });
            let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("dynamesh_smooth_encoder"),
            });
            {
                let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                    label: Some("dynamesh_sdf_smooth_pass"),
                    timestamp_writes: None,
                });
                cpass.set_pipeline(&self.sdf_smooth_pipeline);
                cpass.set_bind_group(0, &smooth_bind_group, &[]);
                let wg = (params.resolution + self.workgroup_size - 1) / self.workgroup_size;
                cpass.dispatch_workgroups(wg, wg, wg);
            }
            queue.submit(std::iter::once(encoder.finish()));
            let _ = device.poll(wgpu::PollType::Wait);
            std::mem::swap(&mut current_sdf, &mut next_sdf);
        }
        let sdf_smooth_ms = sdf_smooth_start.elapsed().as_secs_f64() * 1000.0;

        let mc_start = Instant::now();
        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("dynamesh_readback_encoder"),
        });
        encoder.copy_buffer_to_buffer(current_sdf, 0, &staging_buffer, 0, (grid_size * 4) as u64);
        queue.submit(std::iter::once(encoder.finish()));

        let sdf_values = {
            let slice = staging_buffer.slice(..);
            let (tx, rx) = std::sync::mpsc::channel();
            slice.map_async(wgpu::MapMode::Read, move |result| {
                tx.send(result).unwrap();
            });
            let _ = device.poll(wgpu::PollType::Wait);
            rx.recv()
                .unwrap()
                .map_err(|e| format!("Map failed: {:?}", e))?;
            let data = slice.get_mapped_range();
            let values: Vec<f32> = bytemuck::cast_slice(&data).to_vec();
            drop(data);
            staging_buffer.unmap();
            values
        };

        let (mc_positions, mc_indices) = run_marching_cubes(
            &sdf_values,
            params.resolution as usize,
            grid_min,
            cell_size,
            params.iso_level,
        );
        let mc_ms = mc_start.elapsed().as_secs_f64() * 1000.0;

        // Filter out tiny disconnected components (islands from numerical noise)
        // Keep only components with > 1% of total triangles
        let filter_start = Instant::now();
        let (filtered_positions, filtered_indices) =
            filter_small_components(&mc_positions, &mc_indices, 0.01);
        let _filter_ms = filter_start.elapsed().as_secs_f64() * 1000.0;
        let smooth_start = Instant::now();
        let mut world_positions = filtered_positions;
        let final_indices = filtered_indices;
        if params.vertex_smooth > 0 {
            laplacian_smooth_mesh(&mut world_positions, &final_indices, params.vertex_smooth);
        }
        let normals = compute_normals_from_faces(&world_positions, &final_indices);
        let smooth_ms = smooth_start.elapsed().as_secs_f64() * 1000.0;

        let total_ms = total_start.elapsed().as_secs_f64() * 1000.0;
        let output_vertices = world_positions.len() / 3;
        let output_triangles = final_indices.len() / 3;

        Ok(GpuDynameshResult {
            positions: world_positions,
            indices: final_indices,
            normals,
            time_ms: total_ms,
            stats: GpuDynameshStats {
                original_vertices: vertex_count,
                original_triangles: triangle_count,
                output_vertices,
                output_triangles,
                grid_resolution: params.resolution,
                sdf_build_ms,
                sdf_smooth_ms,
                marching_cubes_ms: mc_ms,
                vertex_smooth_ms: smooth_ms,
                gpu_used: true,
            },
        })
    }
}

fn compute_aabb(positions: &[f32]) -> Result<(Vec3, Vec3), String> {
    if positions.len() % 3 != 0 || positions.is_empty() {
        return Err("Invalid positions array".into());
    }
    let mut min = Vec3::splat(f32::INFINITY);
    let mut max = Vec3::splat(f32::NEG_INFINITY);
    for chunk in positions.chunks(3) {
        let v = Vec3::new(chunk[0], chunk[1], chunk[2]);
        min = min.min(v);
        max = max.max(v);
    }
    Ok((min, max))
}

fn laplacian_smooth_mesh(positions: &mut [f32], indices: &[u32], iterations: u32) {
    let vc = positions.len() / 3;
    for _ in 0..iterations {
        let mut adj: Vec<Vec<usize>> = vec![Vec::new(); vc];
        for tri in indices.chunks(3) {
            let (a, b, c) = (tri[0] as usize, tri[1] as usize, tri[2] as usize);
            adj[a].push(b);
            adj[a].push(c);
            adj[b].push(a);
            adj[b].push(c);
            adj[c].push(a);
            adj[c].push(b);
        }
        for n in &mut adj {
            n.sort_unstable();
            n.dedup();
        }
        let new_pos: Vec<[f32; 3]> = (0..vc)
            .into_par_iter()
            .map(|i| {
                let nb = &adj[i];
                if nb.is_empty() {
                    return [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
                }
                let (mut sx, mut sy, mut sz) = (0.0f32, 0.0f32, 0.0f32);
                for &n in nb {
                    sx += positions[n * 3];
                    sy += positions[n * 3 + 1];
                    sz += positions[n * 3 + 2];
                }
                let n = nb.len() as f32;
                [
                    positions[i * 3] * 0.5 + (sx / n) * 0.5,
                    positions[i * 3 + 1] * 0.5 + (sy / n) * 0.5,
                    positions[i * 3 + 2] * 0.5 + (sz / n) * 0.5,
                ]
            })
            .collect();
        for (i, p) in new_pos.iter().enumerate() {
            positions[i * 3] = p[0];
            positions[i * 3 + 1] = p[1];
            positions[i * 3 + 2] = p[2];
        }
    }
}

fn compute_normals_from_faces(positions: &[f32], indices: &[u32]) -> Vec<f32> {
    let vc = positions.len() / 3;
    let mut normals = vec![0.0f32; vc * 3];
    for tri in indices.chunks(3) {
        let (i0, i1, i2) = (tri[0] as usize, tri[1] as usize, tri[2] as usize);
        let a = Vec3::new(
            positions[i0 * 3],
            positions[i0 * 3 + 1],
            positions[i0 * 3 + 2],
        );
        let b = Vec3::new(
            positions[i1 * 3],
            positions[i1 * 3 + 1],
            positions[i1 * 3 + 2],
        );
        let c = Vec3::new(
            positions[i2 * 3],
            positions[i2 * 3 + 1],
            positions[i2 * 3 + 2],
        );
        let fn_ = (b - a).cross(c - a);
        for idx in [i0, i1, i2] {
            normals[idx * 3] += fn_.x;
            normals[idx * 3 + 1] += fn_.y;
            normals[idx * 3 + 2] += fn_.z;
        }
    }
    for chunk in normals.chunks_mut(3) {
        let len = (chunk[0] * chunk[0] + chunk[1] * chunk[1] + chunk[2] * chunk[2]).sqrt();
        if len > 0.0001 {
            chunk[0] /= len;
            chunk[1] /= len;
            chunk[2] /= len;
        } else {
            chunk[1] = 1.0;
        }
    }
    normals
}

/// Filter out small disconnected mesh components (islands)
/// Uses Union-Find to identify connected components, keeps only large ones
///
/// min_ratio: Minimum fraction of total triangles a component must have (0.01 = 1%)
fn filter_small_components(
    positions: &[f32],
    indices: &[u32],
    min_ratio: f32,
) -> (Vec<f32>, Vec<u32>) {
    if indices.is_empty() {
        return (positions.to_vec(), indices.to_vec());
    }

    let vertex_count = positions.len() / 3;
    let triangle_count = indices.len() / 3;

    // Union-Find data structure
    let mut parent: Vec<usize> = (0..vertex_count).collect();
    let mut rank: Vec<usize> = vec![0; vertex_count];

    fn find(parent: &mut [usize], x: usize) -> usize {
        if parent[x] != x {
            parent[x] = find(parent, parent[x]); // Path compression
        }
        parent[x]
    }

    fn union(parent: &mut [usize], rank: &mut [usize], x: usize, y: usize) {
        let rx = find(parent, x);
        let ry = find(parent, y);
        if rx != ry {
            if rank[rx] < rank[ry] {
                parent[rx] = ry;
            } else if rank[rx] > rank[ry] {
                parent[ry] = rx;
            } else {
                parent[ry] = rx;
                rank[rx] += 1;
            }
        }
    }

    // Build connected components from triangle adjacency
    for tri in indices.chunks(3) {
        let (a, b, c) = (tri[0] as usize, tri[1] as usize, tri[2] as usize);
        union(&mut parent, &mut rank, a, b);
        union(&mut parent, &mut rank, b, c);
    }

    // Flatten parent pointers and count triangles per component
    let mut component_sizes: std::collections::HashMap<usize, usize> =
        std::collections::HashMap::new();
    for tri in indices.chunks(3) {
        let root = find(&mut parent, tri[0] as usize);
        *component_sizes.entry(root).or_insert(0) += 1;
    }

    // Find threshold (min triangles to keep)
    let min_triangles = ((triangle_count as f32) * min_ratio).max(1.0) as usize;

    // Collect roots of large components
    let large_roots: std::collections::HashSet<usize> = component_sizes
        .iter()
        .filter(|(_, &count)| count >= min_triangles)
        .map(|(&root, _)| root)
        .collect();

    if large_roots.is_empty() {
        // Keep everything if no component is large enough (edge case)
        return (positions.to_vec(), indices.to_vec());
    }

    // Filter triangles and remap vertices
    let mut kept_triangles: Vec<[u32; 3]> = Vec::new();
    let mut used_vertices: std::collections::HashSet<usize> = std::collections::HashSet::new();

    for tri in indices.chunks(3) {
        let root = find(&mut parent, tri[0] as usize);
        if large_roots.contains(&root) {
            kept_triangles.push([tri[0], tri[1], tri[2]]);
            used_vertices.insert(tri[0] as usize);
            used_vertices.insert(tri[1] as usize);
            used_vertices.insert(tri[2] as usize);
        }
    }

    // Build new positions and vertex remap
    let mut new_positions: Vec<f32> = Vec::with_capacity(used_vertices.len() * 3);
    let mut vertex_remap: std::collections::HashMap<usize, u32> = std::collections::HashMap::new();
    let mut sorted_verts: Vec<usize> = used_vertices.into_iter().collect();
    sorted_verts.sort_unstable();

    for &old_idx in &sorted_verts {
        let new_idx = (new_positions.len() / 3) as u32;
        vertex_remap.insert(old_idx, new_idx);
        new_positions.push(positions[old_idx * 3]);
        new_positions.push(positions[old_idx * 3 + 1]);
        new_positions.push(positions[old_idx * 3 + 2]);
    }

    // Build new indices
    let new_indices: Vec<u32> = kept_triangles
        .iter()
        .flat_map(|tri| {
            [
                vertex_remap[&(tri[0] as usize)],
                vertex_remap[&(tri[1] as usize)],
                vertex_remap[&(tri[2] as usize)],
            ]
        })
        .collect();

    (new_positions, new_indices)
}

fn run_marching_cubes(
    sdf: &[f32],
    res: usize,
    grid_min: Vec3,
    cell_size: f32,
    iso: f32,
) -> (Vec<f32>, Vec<u32>) {
    let mut positions = Vec::new();
    let mut indices = Vec::new();
    let idx = |x: usize, y: usize, z: usize| z * res * res + y * res + x;
    let pos = |x: usize, y: usize, z: usize| {
        grid_min + Vec3::new(x as f32, y as f32, z as f32) * cell_size
    };

    for z in 0..res - 1 {
        for y in 0..res - 1 {
            for x in 0..res - 1 {
                let v = [
                    sdf[idx(x, y, z)] - iso,
                    sdf[idx(x + 1, y, z)] - iso,
                    sdf[idx(x + 1, y + 1, z)] - iso,
                    sdf[idx(x, y + 1, z)] - iso,
                    sdf[idx(x, y, z + 1)] - iso,
                    sdf[idx(x + 1, y, z + 1)] - iso,
                    sdf[idx(x + 1, y + 1, z + 1)] - iso,
                    sdf[idx(x, y + 1, z + 1)] - iso,
                ];
                let mut cube_idx = 0u8;
                for i in 0..8 {
                    if v[i] < 0.0 {
                        cube_idx |= 1 << i;
                    }
                }
                let edges = EDGE_TABLE[cube_idx as usize];
                if edges == 0 {
                    continue;
                }

                let p = [
                    pos(x, y, z),
                    pos(x + 1, y, z),
                    pos(x + 1, y + 1, z),
                    pos(x, y + 1, z),
                    pos(x, y, z + 1),
                    pos(x + 1, y, z + 1),
                    pos(x + 1, y + 1, z + 1),
                    pos(x, y + 1, z + 1),
                ];
                let edge_verts: [(usize, usize); 12] = [
                    (0, 1),
                    (1, 2),
                    (2, 3),
                    (3, 0),
                    (4, 5),
                    (5, 6),
                    (6, 7),
                    (7, 4),
                    (0, 4),
                    (1, 5),
                    (2, 6),
                    (3, 7),
                ];
                let mut vert_list = [[0.0f32; 3]; 12];
                for i in 0..12 {
                    if edges & (1 << i) != 0 {
                        let (a, b) = edge_verts[i];
                        let t = if (v[b] - v[a]).abs() > 0.00001 {
                            -v[a] / (v[b] - v[a])
                        } else {
                            0.5
                        };
                        let interp = p[a] + (p[b] - p[a]) * t;
                        vert_list[i] = [interp.x, interp.y, interp.z];
                    }
                }

                let tri_row = &TRI_TABLE[cube_idx as usize];
                let mut i = 0;
                while i < 16 && tri_row[i] != -1 {
                    let base = (positions.len() / 3) as u32;
                    for j in 0..3 {
                        let vl = &vert_list[tri_row[i + j] as usize];
                        positions.extend_from_slice(vl);
                    }
                    indices.extend_from_slice(&[base, base + 1, base + 2]);
                    i += 3;
                }
            }
        }
    }
    (positions, indices)
}

const DYNAMESH_BUILD_WGSL: &str = r#"
struct SdfBuildParams { grid_min: vec4<f32>, grid_max: vec4<f32>, resolution: u32, triangle_count: u32, cell_size: f32, _pad: u32 };
struct Triangle { a: vec4<f32>, b: vec4<f32>, c: vec4<f32> };
@group(0) @binding(0) var<storage, read> triangles: array<Triangle>;
@group(0) @binding(1) var<storage, read_write> sdf_grid: array<f32>;
@group(0) @binding(2) var<uniform> params: SdfBuildParams;

// Closest point on triangle to point p (robust Ericson method)
fn closest_pt(p: vec3<f32>, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>) -> vec3<f32> {
    let ab = b - a; let ac = c - a; let ap = p - a;
    let d1 = dot(ab, ap); let d2 = dot(ac, ap);
    if d1 <= 0.0 && d2 <= 0.0 { return a; }
    let bp = p - b; let d3 = dot(ab, bp); let d4 = dot(ac, bp);
    if d3 >= 0.0 && d4 <= d3 { return b; }
    let vc = d1 * d4 - d3 * d2;
    if vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0 { return a + ab * (d1 / (d1 - d3)); }
    let cp = p - c; let d5 = dot(ab, cp); let d6 = dot(ac, cp);
    if d6 >= 0.0 && d5 <= d6 { return c; }
    let vb = d5 * d2 - d1 * d6;
    if vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0 { return a + ac * (d2 / (d2 - d6)); }
    let va = d3 * d6 - d5 * d4;
    if va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0 { return b + (c - b) * ((d4 - d3) / ((d4 - d3) + (d5 - d6))); }
    let dn = 1.0 / (va + vb + vc);
    return a + ab * (vb * dn) + ac * (vc * dn);
}

// Ray-triangle intersection (Möller–Trumbore)
fn ray_tri(o: vec3<f32>, d: vec3<f32>, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>) -> bool {
    let e1 = b - a; let e2 = c - a; let h = cross(d, e2); let det = dot(e1, h);
    if abs(det) < 0.00001 { return false; }
    let f = 1.0 / det; let s = o - a; let u = f * dot(s, h);
    if u < 0.0 || u > 1.0 { return false; }
    let q = cross(s, e1); let v = f * dot(d, q);
    if v < 0.0 || u + v > 1.0 { return false; }
    let t = f * dot(e2, q);
    return t > 0.0001;  // Only count forward hits
}

// Count ray hits for inside/outside test using a single direction
fn count_ray_hits(origin: vec3<f32>, dir: vec3<f32>) -> u32 {
    var hits = 0u;
    for (var i = 0u; i < params.triangle_count; i++) {
        let t = triangles[i];
        if ray_tri(origin, dir, t.a.xyz, t.b.xyz, t.c.xyz) { hits++; }
    }
    return hits;
}

@compute @workgroup_size(4, 4, 4) 
fn build_sdf(@builtin(global_invocation_id) gid: vec3<u32>) {
    let res = params.resolution;
    if gid.x >= res || gid.y >= res || gid.z >= res { return; }
    let idx = gid.z * res * res + gid.y * res + gid.x;
    let p = params.grid_min.xyz + vec3<f32>(f32(gid.x), f32(gid.y), f32(gid.z)) * params.cell_size;
    
    // Find minimum distance to any triangle
    var min_dist = 1e9;
    for (var i = 0u; i < params.triangle_count; i++) { 
        let t = triangles[i]; 
        let closest = closest_pt(p, t.a.xyz, t.b.xyz, t.c.xyz);
        let d = distance(p, closest);
        min_dist = min(min_dist, d); 
    }
    
    // ROBUST inside/outside: Use 6 axis-aligned rays and vote
    // A point is inside if majority of rays hit odd number of times
    var inside_votes = 0u;
    
    // +X, -X, +Y, -Y, +Z, -Z rays
    let dirs = array<vec3<f32>, 6>(
        vec3<f32>(1.0, 0.0, 0.0),
        vec3<f32>(-1.0, 0.0, 0.0),
        vec3<f32>(0.0, 1.0, 0.0),
        vec3<f32>(0.0, -1.0, 0.0),
        vec3<f32>(0.0, 0.0, 1.0),
        vec3<f32>(0.0, 0.0, -1.0)
    );
    
    // Small jitter to avoid edge cases
    let jitter = vec3<f32>(0.00017, 0.00013, 0.00011);
    let origin = p + jitter;
    
    for (var r = 0u; r < 6u; r++) {
        let hits = count_ray_hits(origin, dirs[r]);
        if (hits & 1u) == 1u {
            inside_votes++;
        }
    }
    
    // Majority vote: 4+ out of 6 rays say inside = inside
    let is_inside = inside_votes >= 4u;
    
    // Sign the distance
    if is_inside {
        sdf_grid[idx] = -min_dist;
    } else {
        sdf_grid[idx] = min_dist;
    }
}
"#;

const DYNAMESH_SMOOTH_WGSL: &str = r#"
struct SdfBuildParams { grid_min: vec4<f32>, grid_max: vec4<f32>, resolution: u32, triangle_count: u32, cell_size: f32, _pad: u32 };
@group(0) @binding(0) var<storage, read> sdf_in: array<f32>;
@group(0) @binding(1) var<storage, read_write> sdf_out: array<f32>;
@group(0) @binding(2) var<uniform> params: SdfBuildParams;

@compute @workgroup_size(4, 4, 4) fn smooth_sdf(@builtin(global_invocation_id) gid: vec3<u32>) {
    let res = params.resolution;
    if gid.x >= res || gid.y >= res || gid.z >= res { return; }
    let x = gid.x; let y = gid.y; let z = gid.z;
    let idx = z * res * res + y * res + x;
    if x == 0u || y == 0u || z == 0u || x == res - 1u || y == res - 1u || z == res - 1u { sdf_out[idx] = sdf_in[idx]; return; }
    let c = sdf_in[idx];
    let avg = (sdf_in[idx - 1u] + sdf_in[idx + 1u] + sdf_in[idx - res] + sdf_in[idx + res] + sdf_in[idx - res * res] + sdf_in[idx + res * res]) / 6.0;
    sdf_out[idx] = c * 0.5 + avg * 0.5;
}
"#;

#[cfg(not(target_arch = "wasm32"))]
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use std::sync::Arc;
#[cfg(not(target_arch = "wasm32"))]
static GPU_DYNAMESH: OnceCell<Arc<Mutex<GpuDynameshEngine>>> = OnceCell::new();
#[cfg(target_arch = "wasm32")]
mod wasm_dynamesh {
    use super::*;
    use std::cell::RefCell;
    thread_local! {
        pub static DYNAMESH_ENGINE_WASM: RefCell<Option<Arc<Mutex<GpuDynameshEngine>>>> = RefCell::new(None);
    }
}

pub fn get_or_init_dynamesh_engine() -> Result<Arc<Mutex<GpuDynameshEngine>>, String> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        if let Some(engine) = GPU_DYNAMESH.get() {
            return Ok(engine.clone());
        }
        let gpu = GpuComputeDevice::get_or_init_blocking()?;
        let engine = GpuDynameshEngine::new(&gpu.lock().device);
        let engine_arc = Arc::new(Mutex::new(engine));
        GPU_DYNAMESH
            .set(engine_arc.clone())
            .map_err(|_| "Already initialized")?;
        Ok(engine_arc)
    }
    #[cfg(target_arch = "wasm32")]
    {
        let gpu = GpuComputeDevice::get_or_init_blocking()?;
        let device = gpu.lock().device.clone();
        wasm_dynamesh::DYNAMESH_ENGINE_WASM.with(|cell| {
            if cell.borrow().is_none() {
                *cell.borrow_mut() = Some(Arc::new(Mutex::new(GpuDynameshEngine::new(&device))));
            }
            cell.borrow()
                .clone()
                .ok_or("Dynamesh init failed".to_string())
        })
    }
}

#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn gpu_dynamesh(
    positions: Vec<f32>,
    indices: Vec<u32>,
    params: Option<GpuDynameshParams>,
) -> Result<GpuDynameshResult, String> {
    let p = params.unwrap_or_default();
    let engine = get_or_init_dynamesh_engine()?;
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_lock = gpu.lock();
    let engine_lock = engine.lock();
    let result = engine_lock.remesh(&gpu_lock.device, &gpu_lock.queue, &positions, &indices, &p);
    result
}

#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn gpu_dynamesh_benchmark(
    vertex_count: u32,
    resolution: u32,
) -> Result<GpuDynameshStats, String> {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let mut positions = Vec::with_capacity(vertex_count as usize * 3);
    for _ in 0..vertex_count {
        let (x, y, z): (f32, f32, f32) = (
            rng.gen_range(-1.0..1.0),
            rng.gen_range(-1.0..1.0),
            rng.gen_range(-1.0..1.0),
        );
        let len = (x * x + y * y + z * z).sqrt().max(0.001);
        positions.extend_from_slice(&[x / len, y / len, z / len]);
    }
    let indices: Vec<u32> = (0..vertex_count).collect();
    gpu_dynamesh(
        positions,
        indices,
        Some(GpuDynameshParams {
            resolution,
            smooth_steps: 2,
            padding: 0.05,
            iso_level: 0.0,
            vertex_smooth: 2,
        }),
    )
    .map(|r| r.stats)
}

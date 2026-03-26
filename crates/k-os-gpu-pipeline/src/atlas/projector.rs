#![cfg(not(target_arch = "wasm32"))]
//! GPU Atlas Projector
//!
//! High-performance UV projection using WGPU compute shaders.
//! Handles 1M+ vertices in milliseconds.

use bytemuck::{Pod, Zeroable};
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::gpu::GpuComputeDevice;

/// Global atlas handle counter
static NEXT_HANDLE: AtomicU64 = AtomicU64::new(1);

/// Global atlas instance storage
static ATLAS_INSTANCES: Lazy<Mutex<HashMap<u64, GpuAtlasProjector>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Projection mode enum matching WGSL shader
#[derive(Clone, Copy, Debug)]
#[repr(u32)]
pub enum ProjectionMode {
    Box = 0,
    PlanarX = 1,
    PlanarY = 2,
    PlanarZ = 3,
    Cylindrical = 4,
    Spherical = 5,
}

impl ProjectionMode {
    pub fn from_str(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "BOX" | "BOX_6AXIS" => Self::Box,
            "PLANAR_X" => Self::PlanarX,
            "PLANAR_Y" | "PLANAR_AXIS" => Self::PlanarY,
            "PLANAR_Z" => Self::PlanarZ,
            "CYLINDRICAL" => Self::Cylindrical,
            "SPHERICAL" => Self::Spherical,
            _ => Self::Box, // Default to box
        }
    }
}

/// Uniform buffer for projection parameters
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct ProjectParams {
    mode: u32,
    vertex_count: u32,
    scale: f32,
    offset_u: f32,
    offset_v: f32,
    _padding: u32,
}

/// GPU Atlas Projector - manages buffers and compute pipeline
pub struct GpuAtlasProjector {
    vertex_count: u32,
    positions_buffer: wgpu::Buffer,
    normals_buffer: wgpu::Buffer,
    uvs_buffer: wgpu::Buffer,
    params_buffer: wgpu::Buffer,
    pipeline: wgpu::ComputePipeline,
    bind_group: wgpu::BindGroup,
}

impl GpuAtlasProjector {
    /// Create a new GPU atlas projector for a mesh
    pub fn new(
        device: &wgpu::Device,
        positions: &[f32], // xyz interleaved
        normals: &[f32],   // xyz interleaved
    ) -> Result<Self, String> {
        let vertex_count = (positions.len() / 3) as u32;

        if vertex_count == 0 {
            return Err("No vertices provided".to_string());
        }

        log::info!(
            "[GpuAtlasProjector] Initializing for {} vertices",
            vertex_count
        );

        // Create shader module
        let shader_source = include_str!("atlas_project.wgsl");
        let shader_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("atlas_project_shader"),
            source: wgpu::ShaderSource::Wgsl(shader_source.into()),
        });

        // Create buffers
        let positions_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("atlas_positions"),
            size: (positions.len() * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let normals_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("atlas_normals"),
            size: (normals.len() * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        // UV buffer: 2 floats per vertex
        let uv_size = (vertex_count as usize * 2 * 4) as u64;
        let uvs_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("atlas_uvs"),
            size: uv_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });

        let params_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("atlas_params"),
            size: std::mem::size_of::<ProjectParams>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        // Create bind group layout
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("atlas_bind_group_layout"),
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
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        // Create bind group
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("atlas_bind_group"),
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: params_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: positions_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: normals_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: uvs_buffer.as_entire_binding(),
                },
            ],
        });

        // Create pipeline
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("atlas_pipeline_layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("atlas_project_pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader_module,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

        Ok(Self {
            vertex_count,
            positions_buffer,
            normals_buffer,
            uvs_buffer,
            params_buffer,
            pipeline,
            bind_group,
        })
    }

    /// Upload mesh data to GPU
    pub fn upload_mesh(&self, queue: &wgpu::Queue, positions: &[f32], normals: &[f32]) {
        queue.write_buffer(&self.positions_buffer, 0, bytemuck::cast_slice(positions));
        queue.write_buffer(&self.normals_buffer, 0, bytemuck::cast_slice(normals));
    }

    /// Run projection and return UVs
    pub fn project(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        mode: ProjectionMode,
        scale: f32,
        offset_u: f32,
        offset_v: f32,
    ) -> Vec<f32> {
        let start = std::time::Instant::now();

        // Update params
        let params = ProjectParams {
            mode: mode as u32,
            vertex_count: self.vertex_count,
            scale,
            offset_u,
            offset_v,
            _padding: 0,
        };
        queue.write_buffer(&self.params_buffer, 0, bytemuck::bytes_of(&params));

        // Create staging buffer for readback
        let uv_size = (self.vertex_count as usize * 2 * 4) as u64;
        let staging_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("atlas_staging"),
            size: uv_size,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        // Dispatch compute
        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("atlas_encoder"),
        });

        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("atlas_project_pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.pipeline);
            pass.set_bind_group(0, &self.bind_group, &[]);

            // 256 threads per workgroup
            let workgroup_count = (self.vertex_count + 255) / 256;
            pass.dispatch_workgroups(workgroup_count, 1, 1);
        }

        // Copy to staging
        encoder.copy_buffer_to_buffer(&self.uvs_buffer, 0, &staging_buffer, 0, uv_size);

        queue.submit(std::iter::once(encoder.finish()));

        // Map and read back
        let buffer_slice = staging_buffer.slice(..);
        let (sender, receiver) = std::sync::mpsc::channel();
        buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
            sender.send(result).unwrap();
        });

        let _ = device.poll(wgpu::PollType::Wait);
        receiver.recv().unwrap().expect("Failed to map buffer");

        let data = buffer_slice.get_mapped_range();
        let uvs: Vec<f32> = bytemuck::cast_slice(&data).to_vec();
        drop(data);
        staging_buffer.unmap();

        let elapsed = start.elapsed();
        log::info!(
            "[GpuAtlasProjector] Projected {} verts in {:.2}ms ({:.1}M verts/sec)",
            self.vertex_count,
            elapsed.as_secs_f64() * 1000.0,
            self.vertex_count as f64 / elapsed.as_secs_f64() / 1_000_000.0
        );

        uvs
    }
}

// ============================================================================
// Instance Management (Handle-based API)
// ============================================================================

/// Create a new atlas instance and return its handle
pub fn create_instance(positions: &[f32], normals: &[f32]) -> Result<u64, String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_lock = gpu.lock();

    let projector = GpuAtlasProjector::new(&gpu_lock.device, positions, normals)?;
    projector.upload_mesh(&gpu_lock.queue, positions, normals);

    let handle = NEXT_HANDLE.fetch_add(1, Ordering::Relaxed);
    ATLAS_INSTANCES.lock().insert(handle, projector);

    log::info!("[GpuAtlas] Created instance {}", handle);
    Ok(handle)
}

/// Run projection on an instance
pub fn project_instance(
    handle: u64,
    mode: &str,
    scale: f32,
    offset_u: f32,
    offset_v: f32,
) -> Result<Vec<f32>, String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_lock = gpu.lock();

    let instances = ATLAS_INSTANCES.lock();
    let projector = instances
        .get(&handle)
        .ok_or_else(|| format!("Atlas instance {} not found", handle))?;

    let mode = ProjectionMode::from_str(mode);
    Ok(projector.project(
        &gpu_lock.device,
        &gpu_lock.queue,
        mode,
        scale,
        offset_u,
        offset_v,
    ))
}

/// Dispose of an atlas instance
pub fn dispose_instance(handle: u64) -> Result<(), String> {
    let removed = ATLAS_INSTANCES.lock().remove(&handle);
    if removed.is_some() {
        log::info!("[GpuAtlas] Disposed instance {}", handle);
        Ok(())
    } else {
        Err(format!("Atlas instance {} not found", handle))
    }
}

//! GPU Atlas Island Packer
//!
//! MaxRects-style bin packing for UV islands using GPU compute.
//! For simplicity, we use a shelf-based algorithm which is GPU-friendly.

use bytemuck::{Pod, Zeroable};
use once_cell::sync::Lazy;
use parking_lot::Mutex;

use crate::gpu::GpuComputeDevice;

/// Island bounding box (matches WGSL struct)
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, Debug)]
pub struct Island {
    pub min_u: f32,
    pub min_v: f32,
    pub max_u: f32,
    pub max_v: f32,
    pub offset_u: f32,
    pub offset_v: f32,
    pub packed: u32,
    pub _padding: u32,
}

impl Island {
    pub fn new(min_u: f32, min_v: f32, max_u: f32, max_v: f32) -> Self {
        Self {
            min_u,
            min_v,
            max_u,
            max_v,
            offset_u: 0.0,
            offset_v: 0.0,
            packed: 0,
            _padding: 0,
        }
    }

    pub fn width(&self) -> f32 {
        self.max_u - self.min_u
    }

    pub fn height(&self) -> f32 {
        self.max_v - self.min_v
    }

    pub fn area(&self) -> f32 {
        self.width() * self.height()
    }
}

/// Pack parameters (matches WGSL struct)
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct PackParams {
    island_count: u32,
    padding: f32,
    target_size: f32,
    _padding: u32,
}

/// GPU Atlas Packer
pub struct GpuAtlasPacker {
    _islands: Vec<Island>,
    pipeline: wgpu::ComputePipeline,
    bind_group_layout: wgpu::BindGroupLayout,
}

impl GpuAtlasPacker {
    pub fn new(device: &wgpu::Device) -> Self {
        // Create shader module
        let shader_source = include_str!("atlas_pack.wgsl");
        let shader_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("atlas_pack_shader"),
            source: wgpu::ShaderSource::Wgsl(shader_source.into()),
        });

        // Create bind group layout
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("atlas_pack_bind_group_layout"),
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
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        // Create pipeline
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("atlas_pack_pipeline_layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("atlas_pack_pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader_module,
            entry_point: Some("pack_row"),
            compilation_options: Default::default(),
            cache: None,
        });

        Self {
            _islands: Vec::new(),
            pipeline,
            bind_group_layout,
        }
    }

    /// Pack islands and return offsets
    pub fn pack(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        islands: Vec<Island>,
        padding: f32,
    ) -> Vec<Island> {
        if islands.is_empty() {
            return Vec::new();
        }

        let start = std::time::Instant::now();
        let island_count = islands.len();

        // Sort islands by height (descending) for better shelf packing
        let mut sorted_islands = islands.clone();
        sorted_islands.sort_by(|a, b| b.height().partial_cmp(&a.height()).unwrap());

        // Create buffers
        let params = PackParams {
            island_count: island_count as u32,
            padding,
            target_size: 1.0, // Pack into 0-1 UV space
            _padding: 0,
        };

        let params_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("pack_params"),
            size: std::mem::size_of::<PackParams>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        queue.write_buffer(&params_buffer, 0, bytemuck::bytes_of(&params));

        let islands_size = (island_count * std::mem::size_of::<Island>()) as u64;
        let islands_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("pack_islands"),
            size: islands_size,
            usage: wgpu::BufferUsages::STORAGE
                | wgpu::BufferUsages::COPY_DST
                | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });
        queue.write_buffer(&islands_buffer, 0, bytemuck::cast_slice(&sorted_islands));

        let staging_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("pack_staging"),
            size: islands_size,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        // Create bind group
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("pack_bind_group"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: params_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: islands_buffer.as_entire_binding(),
                },
            ],
        });

        // Dispatch compute
        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("pack_encoder"),
        });

        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("pack_pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.pipeline);
            pass.set_bind_group(0, &bind_group, &[]);

            // One workgroup per island (simple approach)
            // For large island counts, could batch differently
            pass.dispatch_workgroups(island_count as u32, 1, 1);
        }

        // Copy to staging
        encoder.copy_buffer_to_buffer(&islands_buffer, 0, &staging_buffer, 0, islands_size);

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
        let result: Vec<Island> = bytemuck::cast_slice(&data).to_vec();
        drop(data);
        staging_buffer.unmap();

        let elapsed = start.elapsed();
        let packed_count = result.iter().filter(|i| i.packed == 1).count();

        log::info!(
            "[GpuAtlasPacker] Packed {}/{} islands in {:.2}ms",
            packed_count,
            island_count,
            elapsed.as_secs_f64() * 1000.0
        );

        result
    }
}

// ============================================================================
// CPU-side island detection (needed before GPU packing)
// ============================================================================

/// Detect UV islands from mesh UVs using connected components
/// Returns (island_ids per vertex, island bounds)
pub fn detect_islands(
    uvs: &[f32],     // u,v interleaved
    indices: &[u32], // Triangle indices
) -> (Vec<u32>, Vec<Island>) {
    use std::collections::{HashSet, VecDeque};

    let vertex_count = uvs.len() / 2;
    if vertex_count == 0 {
        return (Vec::new(), Vec::new());
    }

    // Build adjacency list from triangle indices
    let mut adjacency: Vec<HashSet<usize>> = vec![HashSet::new(); vertex_count];

    for tri in indices.chunks(3) {
        if tri.len() == 3 {
            let a = tri[0] as usize;
            let b = tri[1] as usize;
            let c = tri[2] as usize;

            if a < vertex_count && b < vertex_count && c < vertex_count {
                adjacency[a].insert(b);
                adjacency[a].insert(c);
                adjacency[b].insert(a);
                adjacency[b].insert(c);
                adjacency[c].insert(a);
                adjacency[c].insert(b);
            }
        }
    }

    // BFS to find connected components
    let mut island_ids = vec![u32::MAX; vertex_count];
    let mut islands: Vec<Island> = Vec::new();
    let mut current_island = 0u32;

    for start in 0..vertex_count {
        if island_ids[start] != u32::MAX {
            continue; // Already assigned
        }

        // BFS from this vertex
        let mut queue = VecDeque::new();
        queue.push_back(start);
        island_ids[start] = current_island;

        let mut min_u = f32::MAX;
        let mut min_v = f32::MAX;
        let mut max_u = f32::MIN;
        let mut max_v = f32::MIN;

        while let Some(v) = queue.pop_front() {
            // Update bounds
            let u = uvs[v * 2];
            let vu = uvs[v * 2 + 1];
            min_u = min_u.min(u);
            min_v = min_v.min(vu);
            max_u = max_u.max(u);
            max_v = max_v.max(vu);

            // Visit neighbors
            for &neighbor in &adjacency[v] {
                if island_ids[neighbor] == u32::MAX {
                    island_ids[neighbor] = current_island;
                    queue.push_back(neighbor);
                }
            }
        }

        islands.push(Island::new(min_u, min_v, max_u, max_v));
        current_island += 1;
    }

    (island_ids, islands)
}

/// Apply island offsets to UVs
pub fn apply_island_offsets(uvs: &mut [f32], island_ids: &[u32], packed_islands: &[Island]) {
    let vertex_count = uvs.len() / 2;

    for i in 0..vertex_count {
        let island_id = island_ids[i] as usize;
        if island_id < packed_islands.len() {
            let island = &packed_islands[island_id];
            if island.packed == 1 {
                uvs[i * 2] += island.offset_u;
                uvs[i * 2 + 1] += island.offset_v;
            }
        }
    }
}

// ============================================================================
// Static packer instance
// ============================================================================

static PACKER: Lazy<Mutex<Option<GpuAtlasPacker>>> = Lazy::new(|| Mutex::new(None));

/// Get or create the global packer
fn get_packer(device: &wgpu::Device) -> parking_lot::MutexGuard<'static, Option<GpuAtlasPacker>> {
    let mut guard = PACKER.lock();
    if guard.is_none() {
        *guard = Some(GpuAtlasPacker::new(device));
    }
    guard
}

/// Pack islands using GPU
pub fn pack_islands_gpu(uvs: &[f32], indices: &[u32], padding: f32) -> Result<Vec<f32>, String> {
    let start = std::time::Instant::now();

    // Detect islands on CPU (BFS)
    let (island_ids, islands) = detect_islands(uvs, indices);

    if islands.is_empty() {
        return Ok(uvs.to_vec());
    }

    log::info!("[GpuAtlasPacker] Detected {} islands", islands.len());

    // Pack on GPU
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_lock = gpu.lock();

    let mut packer_guard = get_packer(&gpu_lock.device);
    let packer = packer_guard.as_mut().unwrap();

    let packed_islands = packer.pack(&gpu_lock.device, &gpu_lock.queue, islands, padding);

    // Apply offsets
    let mut result_uvs = uvs.to_vec();
    apply_island_offsets(&mut result_uvs, &island_ids, &packed_islands);

    let elapsed = start.elapsed();
    log::info!(
        "[GpuAtlasPacker] Total pack time: {:.2}ms",
        elapsed.as_secs_f64() * 1000.0
    );

    Ok(result_uvs)
}

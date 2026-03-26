//! GPU Spatial Grid
//!
//! 3D spatial hash grid built entirely on GPU via compute shaders.
//! Used for O(1) radius queries in sculpting, collision, etc.
//!
//! Build process (3 passes):
//!   1. Count: Atomically count vertices per cell
//!   2. Prefix Sum: Compute cell offsets (exclusive scan)
//!   3. Scatter: Place vertex indices into buckets
//!
//! Query process:
//!   Given center + radius, find overlapping cells, collect candidates.

use bytemuck::{Pod, Zeroable};
use wgpu::util::DeviceExt;

/// Uniform params for grid build/query shaders
///
/// CRITICAL: WGSL vec3 has 16-byte alignment, not 12!
/// Layout must match WGSL exactly:
///   bounds_min: vec4<f32>  offset 0,  size 16
///   bounds_max: vec4<f32>  offset 16, size 16  
///   cell_size: f32         offset 32, size 4
///   grid_dims_x: u32       offset 36, size 4
///   grid_dims_y: u32       offset 40, size 4
///   grid_dims_z: u32       offset 44, size 4
///   vertex_count: u32      offset 48, size 4
///   cell_count: u32        offset 52, size 4
///   _pad: vec2<u32>        offset 56, size 8
///   TOTAL: 64 bytes
#[repr(C)]
#[derive(Copy, Clone, Debug, Zeroable, Pod)]
pub struct GridParams {
    /// World-space bounds min
    pub bounds_min: [f32; 4],
    /// World-space bounds max
    pub bounds_max: [f32; 4],
    /// Cell size in world units
    pub cell_size: f32,
    /// Grid dimensions X (cells per axis) - split to avoid vec3 alignment issues
    pub grid_dims_x: u32,
    /// Grid dimensions Y
    pub grid_dims_y: u32,
    /// Grid dimensions Z
    pub grid_dims_z: u32,
    /// Total vertex count
    pub vertex_count: u32,
    /// Total cell count (dims.x * dims.y * dims.z)
    pub cell_count: u32,
    /// Padding for 16-byte alignment
    pub _pad: [u32; 2],
}

impl GridParams {
    pub fn new(
        bounds_min: [f32; 3],
        bounds_max: [f32; 3],
        cell_size: f32,
        vertex_count: u32,
    ) -> Self {
        // Safety: Ensure minimum 1 cell per axis to prevent 0-size buffer panic
        let safe_cell_size = cell_size.max(0.001);
        let dims_x = ((bounds_max[0] - bounds_min[0]) / safe_cell_size)
            .ceil()
            .max(1.0) as u32;
        let dims_y = ((bounds_max[1] - bounds_min[1]) / safe_cell_size)
            .ceil()
            .max(1.0) as u32;
        let dims_z = ((bounds_max[2] - bounds_min[2]) / safe_cell_size)
            .ceil()
            .max(1.0) as u32;
        let cell_count = dims_x * dims_y * dims_z;

        Self {
            bounds_min: [bounds_min[0], bounds_min[1], bounds_min[2], 0.0],
            bounds_max: [bounds_max[0], bounds_max[1], bounds_max[2], 0.0],
            cell_size: safe_cell_size,
            grid_dims_x: dims_x,
            grid_dims_y: dims_y,
            grid_dims_z: dims_z,
            vertex_count: vertex_count.max(1), // Safety: at least 1 vertex
            cell_count: cell_count.max(1),     // Safety: at least 1 cell
            _pad: [0; 2],
        }
    }
}

/// Query params for sphere queries
#[repr(C)]
#[derive(Copy, Clone, Debug, Zeroable, Pod)]
pub struct QueryParams {
    /// Query center
    pub center: [f32; 4],
    /// Query radius
    pub radius: f32,
    /// Max candidates to return
    pub max_candidates: u32,
    /// Padding
    pub _pad: [u32; 2],
}

/// GPU Spatial Grid for O(1) radius queries
pub struct GpuSpatialGrid {
    /// Atomic count per cell (built in pass 1)
    pub cell_counts: wgpu::Buffer,
    /// Prefix sum offsets (built in pass 2)
    pub cell_offsets: wgpu::Buffer,
    /// Vertex indices sorted by cell (built in pass 3)
    pub vertex_indices: wgpu::Buffer,
    /// Grid params uniform buffer
    pub params_buffer: wgpu::Buffer,
    /// Cached params
    pub params: GridParams,

    // Build pipelines (4 entry points)
    clear_pipeline: wgpu::ComputePipeline,
    count_pipeline: wgpu::ComputePipeline,
    prefix_sum_pipeline: wgpu::ComputePipeline,
    scatter_pipeline: wgpu::ComputePipeline,

    /// Build bind group layout
    build_bind_group_layout: wgpu::BindGroupLayout,

    // Query pipelines (3 entry points)
    query_clear_pipeline: wgpu::ComputePipeline,
    query_sphere_pipeline: wgpu::ComputePipeline,
    query_indirect_pipeline: wgpu::ComputePipeline,

    /// Query bind group layout
    query_bind_group_layout: wgpu::BindGroupLayout,

    // Query buffers
    /// Query params uniform
    pub query_params_buffer: wgpu::Buffer,
    /// Candidates output buffer
    pub candidates_buffer: wgpu::Buffer,
    /// Indirect dispatch buffer for Level 5
    pub indirect_buffer: wgpu::Buffer,
    /// Max candidates (for buffer sizing)
    pub max_candidates: u32,
    /// Atomic counter buffer (separated from candidates for pure index buffer)
    pub counter_buffer: wgpu::Buffer,
}

impl GpuSpatialGrid {
    /// Create a new spatial grid
    pub fn new(
        device: &wgpu::Device,
        bounds_min: [f32; 3],
        bounds_max: [f32; 3],
        cell_size: f32,
        max_vertices: u32,
    ) -> Self {
        let params = GridParams::new(bounds_min, bounds_max, cell_size, max_vertices);

        // SAFETY: WGPU panics on 0-size buffers. GridParams::new() guarantees >=1
        let safe_cell_count = params.cell_count.max(1) as u64;
        let safe_vertex_count = max_vertices.max(1) as u64;

        // Create buffers with guaranteed non-zero sizes
        let cell_counts = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("spatial_grid_cell_counts"),
            size: safe_cell_count * 4, // u32 per cell
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let cell_offsets = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("spatial_grid_cell_offsets"),
            size: safe_cell_count * 4,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let vertex_indices = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("spatial_grid_vertex_indices"),
            size: safe_vertex_count * 4, // u32 per vertex
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let params_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("spatial_grid_params"),
            contents: bytemuck::cast_slice(&[params]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Build bind group layout
        let build_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("spatial_grid_build_layout"),
                entries: &[
                    // Params uniform
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
                    // Positions (input)
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
                    // Cell counts (read-write atomic)
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
                    // Cell offsets (read-write)
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
                    // Vertex indices (output)
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
                ],
            });

        // Query bind group layout
        let query_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("spatial_grid_query_layout"),
                entries: &[
                    // Grid params
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
                    // Query params
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                    // Positions (input)
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
                    // Cell offsets (input)
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
                    // Vertex indices (input)
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
                    // Candidates output
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
                    // Indirect dispatch buffer (output)
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
                    // Atomic counter buffer
                    wgpu::BindGroupLayoutEntry {
                        binding: 7,
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

        // Compile shaders and create pipelines
        let build_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("spatial_grid_build_shader"),
            source: wgpu::ShaderSource::Wgsl(GRID_BUILD_WGSL.into()),
        });

        let query_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("spatial_grid_query_shader"),
            source: wgpu::ShaderSource::Wgsl(GRID_QUERY_WGSL.into()),
        });

        let build_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("spatial_grid_build_pipeline_layout"),
                bind_group_layouts: &[&build_bind_group_layout],
                push_constant_ranges: &[],
            });

        let query_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("spatial_grid_query_pipeline_layout"),
                bind_group_layouts: &[&query_bind_group_layout],
                push_constant_ranges: &[],
            });

        // Create all 4 build pipelines for the 3-pass grid construction
        let clear_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("spatial_grid_clear_pipeline"),
            layout: Some(&build_pipeline_layout),
            module: &build_shader,
            entry_point: Some("clear_counts"),
            compilation_options: wgpu::PipelineCompilationOptions::default(),
            cache: None,
        });

        let count_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("spatial_grid_count_pipeline"),
            layout: Some(&build_pipeline_layout),
            module: &build_shader,
            entry_point: Some("count_cells"),
            compilation_options: wgpu::PipelineCompilationOptions::default(),
            cache: None,
        });

        let prefix_sum_pipeline =
            device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                label: Some("spatial_grid_prefix_sum_pipeline"),
                layout: Some(&build_pipeline_layout),
                module: &build_shader,
                entry_point: Some("prefix_sum"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                cache: None,
            });

        let scatter_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("spatial_grid_scatter_pipeline"),
            layout: Some(&build_pipeline_layout),
            module: &build_shader,
            entry_point: Some("scatter"),
            compilation_options: wgpu::PipelineCompilationOptions::default(),
            cache: None,
        });

        // Create all 3 query pipelines
        let query_clear_pipeline =
            device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                label: Some("spatial_grid_query_clear_pipeline"),
                layout: Some(&query_pipeline_layout),
                module: &query_shader,
                entry_point: Some("clear_candidates"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                cache: None,
            });

        let query_sphere_pipeline =
            device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                label: Some("spatial_grid_query_sphere_pipeline"),
                layout: Some(&query_pipeline_layout),
                module: &query_shader,
                entry_point: Some("query_sphere"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                cache: None,
            });

        let query_indirect_pipeline =
            device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                label: Some("spatial_grid_query_indirect_pipeline"),
                layout: Some(&query_pipeline_layout),
                module: &query_shader,
                entry_point: Some("write_indirect"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                cache: None,
            });

        // Create query buffers
        // Max candidates = max_vertices (brush can hit any vertex in theory)
        let max_candidates = max_vertices.max(1);

        let query_params_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("spatial_grid_query_params"),
            size: std::mem::size_of::<QueryParams>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        // candidates now pure indices
        let candidates_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("spatial_grid_candidates"),
            size: (max_candidates as u64) * 4,
            usage: wgpu::BufferUsages::STORAGE
                | wgpu::BufferUsages::COPY_SRC
                | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        // Separate counter buffer
        let counter_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("spatial_grid_counter"),
            size: 4, // single atomic u32
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let indirect_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("spatial_grid_indirect"),
            size: 12, // 3 x u32 (x, y, z workgroup counts)
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::INDIRECT,
            mapped_at_creation: false,
        });

        Self {
            cell_counts,
            cell_offsets,
            vertex_indices,
            params_buffer,
            params,
            clear_pipeline,
            count_pipeline,
            prefix_sum_pipeline,
            scatter_pipeline,
            build_bind_group_layout,
            query_clear_pipeline,
            query_sphere_pipeline,
            query_indirect_pipeline,
            query_bind_group_layout,
            query_params_buffer,
            candidates_buffer,
            indirect_buffer,
            max_candidates,
            counter_buffer,
        }
    }

    /// Get cell count
    pub fn cell_count(&self) -> u32 {
        self.params.cell_count
    }

    /// Get grid dimensions
    pub fn grid_dims(&self) -> [u32; 3] {
        [
            self.params.grid_dims_x,
            self.params.grid_dims_y,
            self.params.grid_dims_z,
        ]
    }

    /// Encode grid build passes (4-pass: clear, count, prefix sum, scatter)
    /// Must be called whenever positions change
    pub fn encode_build(
        &self,
        device: &wgpu::Device,
        encoder: &mut wgpu::CommandEncoder,
        positions_buffer: &wgpu::Buffer,
    ) {
        let workgroup_size = 256u32;
        let vertex_workgroups = (self.params.vertex_count + workgroup_size - 1) / workgroup_size;
        let cell_workgroups = (self.params.cell_count + workgroup_size - 1) / workgroup_size;

        // Create bind group for build passes
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("spatial_grid_build_bg"),
            layout: &self.build_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.params_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: positions_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.cell_counts.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: self.cell_offsets.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: self.vertex_indices.as_entire_binding(),
                },
            ],
        });

        // Pass 0: Clear cell counts to zero
        {
            let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("spatial_grid_clear_pass"),
                timestamp_writes: None,
            });
            cpass.set_pipeline(&self.clear_pipeline);
            cpass.set_bind_group(0, &bind_group, &[]);
            cpass.dispatch_workgroups(cell_workgroups, 1, 1);
        }

        // Pass 1: Count vertices per cell (atomic increments)
        {
            let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("spatial_grid_count_pass"),
                timestamp_writes: None,
            });
            cpass.set_pipeline(&self.count_pipeline);
            cpass.set_bind_group(0, &bind_group, &[]);
            cpass.dispatch_workgroups(vertex_workgroups, 1, 1);
        }

        // Pass 2: Prefix sum (exclusive scan for cell offsets)
        // Note: Single-threaded for now, works fine for moderate cell counts
        {
            let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("spatial_grid_prefix_sum_pass"),
                timestamp_writes: None,
            });
            cpass.set_pipeline(&self.prefix_sum_pipeline);
            cpass.set_bind_group(0, &bind_group, &[]);
            cpass.dispatch_workgroups(1, 1, 1); // Single workgroup for sequential scan
        }

        // Pass 3a: Clear cell counts again (reused as per-cell insertion counters in scatter)
        {
            let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("spatial_grid_clear_before_scatter"),
                timestamp_writes: None,
            });
            cpass.set_pipeline(&self.clear_pipeline);
            cpass.set_bind_group(0, &bind_group, &[]);
            cpass.dispatch_workgroups(cell_workgroups, 1, 1);
        }

        // Pass 3b: Scatter vertices into sorted buckets
        // Uses atomicAdd on cleared cell_counts as insertion index into each bucket
        {
            let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("spatial_grid_scatter_pass"),
                timestamp_writes: None,
            });
            cpass.set_pipeline(&self.scatter_pipeline);
            cpass.set_bind_group(0, &bind_group, &[]);
            cpass.dispatch_workgroups(vertex_workgroups, 1, 1);
        }
    }

    /// Get bind group layout for external use
    pub fn build_bind_group_layout(&self) -> &wgpu::BindGroupLayout {
        &self.build_bind_group_layout
    }

    /// Get query bind group layout for external use
    pub fn query_bind_group_layout(&self) -> &wgpu::BindGroupLayout {
        &self.query_bind_group_layout
    }

    /// Update query params for next query
    pub fn update_query_params(&self, queue: &wgpu::Queue, center: [f32; 3], radius: f32) {
        let params = QueryParams {
            center: [center[0], center[1], center[2], 0.0],
            radius,
            max_candidates: self.max_candidates,
            _pad: [0; 2],
        };
        queue.write_buffer(
            &self.query_params_buffer,
            0,
            bytemuck::cast_slice(&[params]),
        );
    }

    /// Encode sphere query (3-pass: clear, query, write_indirect)
    /// Call update_query_params first, then encode_query, then submit
    /// After submission, candidates_buffer contains vertex indices within sphere
    /// and indirect_buffer has dispatch counts for Level 5 indirect dispatch
    pub fn encode_query(
        &self,
        device: &wgpu::Device,
        encoder: &mut wgpu::CommandEncoder,
        positions_buffer: &wgpu::Buffer,
    ) {
        // Create bind group for query passes
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("spatial_grid_query_bg"),
            layout: &self.query_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.params_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: self.query_params_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: positions_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: self.cell_offsets.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: self.vertex_indices.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 5,
                    resource: self.candidates_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 6,
                    resource: self.indirect_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 7,
                    resource: self.counter_buffer.as_entire_binding(),
                },
            ],
        });

        // Pass 1: Clear candidates + indirect buffer
        {
            let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("spatial_grid_query_clear"),
                timestamp_writes: None,
            });
            cpass.set_pipeline(&self.query_clear_pipeline);
            cpass.set_bind_group(0, &bind_group, &[]);
            cpass.dispatch_workgroups(1, 1, 1);
        }

        // Pass 2: Query sphere - find all vertices within radius
        // Dispatch enough workgroups to cover ALL cells (no artificial cap!)
        // OLD: let max_query_cells = self.params.cell_count.min(10_000); // ← BOTTLENECK!
        // FIX: Use actual cell count - the shader will skip cells outside query region
        let query_workgroups = (self.params.cell_count + 255) / 256;
        {
            let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("spatial_grid_query_sphere"),
                timestamp_writes: None,
            });
            cpass.set_pipeline(&self.query_sphere_pipeline);
            cpass.set_bind_group(0, &bind_group, &[]);
            cpass.dispatch_workgroups(query_workgroups, 1, 1);
        }

        // Pass 3: Write indirect dispatch buffer for Level 5
        {
            let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("spatial_grid_query_indirect"),
                timestamp_writes: None,
            });
            cpass.set_pipeline(&self.query_indirect_pipeline);
            cpass.set_bind_group(0, &bind_group, &[]);
            cpass.dispatch_workgroups(1, 1, 1);
        }
    }
}

// WGSL Shader Sources (embedded)
pub const GRID_BUILD_WGSL: &str = include_str!("grid_build.wgsl");
pub const GRID_QUERY_WGSL: &str = include_str!("query.wgsl");

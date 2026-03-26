use bytemuck::{Pod, Zeroable};
use std::collections::HashMap;
use wgpu::util::DeviceExt;

use super::spirv_loader::SPIRV_SHADERS;

// ============================================================================
// MODULAR KERNEL SHADERS (ZBrush-style)
// Each kernel family is a separate WGSL file with multiple entry points
// ============================================================================
const STAMP_WGSL: &str = include_str!("sculpt_stamp.wgsl");
const SMOOTH_WGSL: &str = include_str!("sculpt_smooth.wgsl");
const PINCH_WGSL: &str = include_str!("sculpt_pinch.wgsl");
const GRAB_WGSL: &str = include_str!("sculpt_grab.wgsl");
const PHYSICS_WGSL: &str = include_str!("sculpt_physics.wgsl");
const CRYSTAL_WGSL: &str = include_str!("sculpt_crystal.wgsl");

// BrushParams MUST match WGSL struct layout exactly!
// WGSL pads uniform buffers to 16-byte alignment = 96 bytes total
// Layout: 2 x vec4 (32) + 8 x f32/u32 (32) + 8 x u32 pad (32) = 96 bytes
#[repr(C)]
#[derive(Copy, Clone, Debug, Zeroable, Pod)]
pub struct BrushParams {
    pub center: [f32; 4],
    pub normal: [f32; 4],
    pub radius: f32,
    pub strength: f32, // formerly intensity
    pub hardness: f32, // formerly falloff
    pub spacing: f32,
    pub op: u32, // maps to 'kernel' in new shaders
    pub subtract: u32,
    pub front_faces_only: u32,
    pub accumulate: u32,
    pub vertex_count: u32,
    pub candidate_count: u32,
    pub alpha_enabled: u32,
    pub alpha_scale: f32,
    pub jitter_position: f32,
    pub jitter_rotation: f32,
    pub jitter_strength: f32,
    pub random_seed: f32,
    pub extra0: f32,
    pub extra1: f32,
    pub extra2: f32,
    pub extra3: f32,
    pub pressure_curve_idx: u32,
    pub speed_curve_idx: u32,
    pub tilt_curve_idx: u32,
    pub _pad: u32,
}

impl BrushParams {
    pub fn new(center: [f32; 3], normal: [f32; 3], radius: f32, intensity: f32) -> Self {
        Self {
            center: [center[0], center[1], center[2], 0.0],
            normal: [normal[0], normal[1], normal[2], 0.0],
            radius,
            strength: intensity,
            hardness: 2.0,
            spacing: 0.0,
            op: 0, // Will be set later
            subtract: 0,
            front_faces_only: 0,
            accumulate: 0,
            vertex_count: 0,
            candidate_count: 0,
            alpha_enabled: 0,
            alpha_scale: 1.0,
            jitter_position: 0.0,
            jitter_rotation: 0.0,
            jitter_strength: 0.0,
            random_seed: 0.0,
            extra0: 0.0,
            extra1: 0.0,
            extra2: 0.0,
            extra3: 0.0,
            pressure_curve_idx: 0,
            speed_curve_idx: 0,
            tilt_curve_idx: 0,
            _pad: 0,
        }
    }

    /// Enable alpha texture modulation
    pub fn with_alpha(mut self, scale: f32) -> Self {
        self.alpha_enabled = 1;
        self.alpha_scale = scale;
        self
    }
}

#[derive(Clone, Copy, Debug)]
#[repr(u32)]
pub enum SculptOp {
    // Standard Brushes
    Clay = 0,
    Inflate = 1,
    Flatten = 2,
    Pinch = 3,
    Crease = 4,
    Draw = 5,
    Layer = 6,
    Dam = 7,
    HPolish = 8,
    Rake = 9,
    SnakeHook = 10,
    ClayStrips = 11,
    // Simulation Brushes
    Melt = 12,
    Gravity = 13,
    Twist = 14,
    Repel = 15,
    Magnet = 16,
    Blob = 17,
    Spike = 18,
    Crystallize = 19,
    Terrace = 20,
    Terra = 21,
    Magma = 22,
    Thermal = 23,
    Erode = 24,
    Growth = 25,
    Bloom = 26,
    // Experimental Brushes
    Elastic = 27,
    VectorField = 28,
    Hologram = 29,
    Attractor = 30,
    Grab = 31,
}

impl From<SculptOp> for u32 {
    fn from(v: SculptOp) -> Self {
        v as u32
    }
}

pub struct GpuMeshBuffers {
    pub vertex_count: u32,
    pub face_count: u32,
    pub positions: wgpu::Buffer,
    pub normals: wgpu::Buffer,
    /// Face indices (u32 × 3 per face) - uploaded once, topology is static
    pub indices: Option<wgpu::Buffer>,
    /// Fixed-point normals accumulator (i32 × 3 per vertex) for atomic accumulation
    pub normals_fixed: Option<wgpu::Buffer>,
    /// Dirty vertex bitmask (1 bit per vertex) for GPU normal recalculation
    pub dirty_mask: Option<wgpu::Buffer>,
    /// Pre-filtered list of dirty face indices (CPU builds this from topology)
    pub dirty_faces: Option<wgpu::Buffer>,
}

pub struct GpuCandidates {
    pub count: u32,
    pub indices: wgpu::Buffer,
}

/// Sparse readback output: [count, idx0, pos0.xyz, norm0.xyz, idx1, pos1.xyz, norm1.xyz, ...]
/// Format: count (u32) + N * (idx: u32, pos: vec3<f32>, norm: vec3<f32>) = count + N * 7 floats
///
/// DOUBLE-BUFFERED for async readback:
/// - GPU writes to compact_buffer → staging_back
/// - CPU reads from staging_front (previous frame's data)
/// - Swap front/back when GPU is done
pub struct SparsePositionReadback {
    /// Buffer containing [count, idx0, pos0.xyz, norm0.xyz, idx1, pos1.xyz, norm1.xyz, ...]
    pub compact_buffer: wgpu::Buffer,
    /// Maximum number of vertices that can be compacted
    pub max_vertices: u32,
    /// Staging buffer A (front = CPU reading)
    pub staging_front: wgpu::Buffer,
    /// Staging buffer B (back = GPU writing)
    pub staging_back: wgpu::Buffer,
    /// Which buffer is currently "front" (0 or 1, for swap tracking)
    pub front_index: u8,
    /// Whether back buffer has valid data ready to swap
    pub back_ready: bool,
    /// Whether this is the first frame (no previous data available)
    pub first_frame: bool,
}

// ============================================================================
// KERNEL PIPELINE CACHE - One per kernel family, with entry point pipelines
// ============================================================================

/// Kernel family enumeration - matches BrushKernel from brushes/asset.rs
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum KernelFamily {
    Stamp,   // Clay, Inflate, Draw, Layer, Blob
    Smooth,  // Smooth, Relax, Polish
    Pinch,   // Pinch, Crease, Dam Standard
    Grab,    // Grab, Snake Hook, Move, Twist
    Flatten, // Flatten, Scrape, Fill
    Physics, // Attractor, Magnet, Elastic, Turbulence, Gravity
    Crystal, // Crystal Growth, Voronoi Shatter, Bismuth
}

/// Per-kernel pipeline cache
pub struct KernelPipelines {
    /// entry_point name -> pipeline
    pub pipelines: HashMap<String, wgpu::ComputePipeline>,
}

pub struct GpuSculptCompute {
    // === LEGACY PIPELINES (for backward compat) ===
    pipeline_all: wgpu::ComputePipeline,
    pipeline_candidates: wgpu::ComputePipeline,
    pipeline_compact: wgpu::ComputePipeline,
    bind_group_layout_all: wgpu::BindGroupLayout,
    bind_group_layout_candidates: wgpu::BindGroupLayout,
    bind_group_layout_compact: wgpu::BindGroupLayout,
    /// Extended layout for smooth kernel (bindings 0-5 with neighbor buffers)
    _bind_group_layout_smooth: wgpu::BindGroupLayout,

    // === MODULAR KERNEL PIPELINES (new system) ===
    kernel_pipelines: HashMap<KernelFamily, KernelPipelines>,

    /// Bind group layout for alpha texture (Group 1)
    alpha_bind_group_layout: wgpu::BindGroupLayout,
    /// Dummy alpha bind group (1x1 white texture) for when no alpha is selected
    dummy_alpha_bind_group: wgpu::BindGroup,
    /// Legacy V1 params buffer (128 bytes)
    params_buffer: wgpu::Buffer,
    /// V2 params buffer (384 bytes) for BrushParamsGpuV2
    params_buffer_v2: wgpu::Buffer,
    workgroup_size: u32,
}

impl GpuSculptCompute {
    pub fn new(device: &wgpu::Device, queue: &wgpu::Queue) -> Self {
        let workgroup_size = 256;

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("sculpt_wgpu_compute"),
            source: wgpu::ShaderSource::Wgsl(SCULPT_WGSL.into()),
        });

        // === GROUP 0: Mesh Data ===
        let bind_group_layout_all =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("sculpt_wgpu_bgl_all"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Storage { read_only: false },
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

        let bind_group_layout_candidates =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("sculpt_wgpu_bgl_candidates"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Storage { read_only: false },
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
                    // 4: counter (atomic/read-only)
                    wgpu::BindGroupLayoutEntry {
                        binding: 4,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Storage { read_only: true }, // Read-only for brush
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                ],
            });

        // Extended layout for smooth kernel (needs neighbor topology)
        // Bindings 0-3 same as candidates, plus 4-5 for neighbor buffers
        let bind_group_layout_smooth =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("sculpt_wgpu_bgl_smooth"),
                entries: &[
                    // 0: positions (read-write)
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Storage { read_only: false },
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                    // 1: normals (read-write)
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
                    // 2: params (uniform)
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
                    // 3: candidates (read)
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
                    // 4: neighbor_offsets (CSR format - read)
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
                    // 5: neighbor_indices (read)
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
                    // 6: counter (read)
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
                ],
            });

        // Compact pipeline for sparse readback
        let bind_group_layout_compact =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("sculpt_wgpu_bgl_compact"),
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
                    // 3: counter (read)
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
                    // 4: normals (read)
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
                ],
            });

        // === GROUP 1: Alpha Texture ===
        let alpha_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("sculpt_alpha_bgl"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Texture {
                            sample_type: wgpu::TextureSampleType::Float { filterable: true },
                            view_dimension: wgpu::TextureViewDimension::D2,
                            multisampled: false,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                ],
            });

        // === DUMMY ALPHA TEXTURE (1x1 white) ===
        let dummy_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("sculpt_dummy_alpha"),
            size: wgpu::Extent3d {
                width: 1,
                height: 1,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::R8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &dummy_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &[255u8], // White = full weight
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(1),
                rows_per_image: Some(1),
            },
            wgpu::Extent3d {
                width: 1,
                height: 1,
                depth_or_array_layers: 1,
            },
        );
        let dummy_view = dummy_texture.create_view(&wgpu::TextureViewDescriptor::default());
        let dummy_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("sculpt_dummy_sampler"),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        let dummy_alpha_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("sculpt_dummy_alpha_bg"),
            layout: &alpha_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&dummy_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&dummy_sampler),
                },
            ],
        });

        // === PIPELINE LAYOUTS (Group 0 + Group 1) ===
        let pipeline_layout_all = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("sculpt_wgpu_pl_all"),
            bind_group_layouts: &[&bind_group_layout_all, &alpha_bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline_layout_candidates =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("sculpt_wgpu_pl_candidates"),
                bind_group_layouts: &[&bind_group_layout_candidates, &alpha_bind_group_layout],
                push_constant_ranges: &[],
            });

        let pipeline_layout_compact =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("sculpt_wgpu_pl_compact"),
                bind_group_layouts: &[&bind_group_layout_compact],
                push_constant_ranges: &[],
            });

        // Smooth kernel layout with neighbor data
        let pipeline_layout_smooth =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("sculpt_wgpu_pl_smooth"),
                bind_group_layouts: &[&bind_group_layout_smooth, &alpha_bind_group_layout],
                push_constant_ranges: &[],
            });

        let pipeline_all = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("sculpt_wgpu_pipeline_all"),
            layout: Some(&pipeline_layout_all),
            module: &shader,
            entry_point: Some("main_all"),
            compilation_options: Default::default(),
            cache: None,
        });

        let pipeline_candidates =
            device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                label: Some("sculpt_wgpu_pipeline_candidates"),
                layout: Some(&pipeline_layout_candidates),
                module: &shader,
                entry_point: Some("main_candidates"),
                compilation_options: Default::default(),
                cache: None,
            });

        let pipeline_compact = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("sculpt_wgpu_pipeline_compact"),
            layout: Some(&pipeline_layout_compact),
            module: &shader,
            entry_point: Some("compact_positions"),
            compilation_options: Default::default(),
            cache: None,
        });

        // === INITIALIZE MODULAR KERNEL PIPELINES ===
        let mut kernel_pipelines: HashMap<KernelFamily, KernelPipelines> = HashMap::new();

        // Helper to create kernel pipeline
        let create_kernel = |device: &wgpu::Device,
                             wgsl: &str,
                             entry_points: &[&str],
                             layout: &wgpu::PipelineLayout|
         -> KernelPipelines {
            let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some("kernel_shader"),
                source: wgpu::ShaderSource::Wgsl(wgsl.into()),
            });
            let mut pipelines = HashMap::new();
            for &entry in entry_points {
                let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                    label: Some(&format!("kernel_{}", entry)),
                    layout: Some(layout),
                    module: &shader,
                    entry_point: Some(entry),
                    compilation_options: Default::default(),
                    cache: None,
                });
                pipelines.insert(entry.to_string(), pipeline);
            }
            KernelPipelines { pipelines }
        };

        // Stamp kernel (V2: clay, inflate, flatten, crease, layer, blob, hpolish, scrape)
        kernel_pipelines.insert(
            KernelFamily::Stamp,
            create_kernel(
                device,
                STAMP_WGSL,
                &[
                    "stamp_main",
                    "stamp_clay",
                    "stamp_inflate",
                    "stamp_flatten",
                    "stamp_crease",
                    "stamp_layer",
                    "stamp_blob",
                    "stamp_hpolish",
                    "stamp_scrape",
                ],
                &pipeline_layout_candidates,
            ),
        );

        // Smooth kernel (V2: main, relax, surface, sharpen, flatten_polish)
        kernel_pipelines.insert(
            KernelFamily::Smooth,
            create_kernel(
                device,
                SMOOTH_WGSL,
                &[
                    "smooth_main",
                    "smooth_relax",
                    "smooth_surface",
                    "smooth_sharpen",
                    "smooth_flatten_polish",
                ],
                &pipeline_layout_smooth,
            ),
        );

        // Pinch kernel (V2: main, crease, dam, inflate_pinch, magnify)
        kernel_pipelines.insert(
            KernelFamily::Pinch,
            create_kernel(
                device,
                PINCH_WGSL,
                &[
                    "pinch_main",
                    "pinch_crease",
                    "pinch_dam",
                    "pinch_inflate_pinch",
                    "pinch_magnify",
                ],
                &pipeline_layout_candidates,
            ),
        );

        // Grab kernel (V2: main, snake_hook, move, twist, rotate, scale, elastic)
        kernel_pipelines.insert(
            KernelFamily::Grab,
            create_kernel(
                device,
                GRAB_WGSL,
                &[
                    "grab_main",
                    "grab_snake_hook",
                    "grab_move",
                    "grab_twist",
                    "grab_rotate",
                    "grab_scale",
                    "grab_elastic",
                ],
                &pipeline_layout_candidates,
            ),
        );

        // Physics kernel (V2: attractor, magnet, elastic, inflate_pulse, turbulence, gravity_drop, wind, vortex)
        kernel_pipelines.insert(
            KernelFamily::Physics,
            create_kernel(
                device,
                PHYSICS_WGSL,
                &[
                    "physics_attractor",
                    "physics_magnet",
                    "physics_elastic",
                    "physics_inflate_pulse",
                    "physics_turbulence",
                    "physics_gravity_drop",
                    "physics_wind",
                    "physics_vortex",
                ],
                &pipeline_layout_candidates,
            ),
        );

        // Crystal kernel (V2: growth, shatter, bismuth, scales, facets)
        kernel_pipelines.insert(
            KernelFamily::Crystal,
            create_kernel(
                device,
                CRYSTAL_WGSL,
                &[
                    "crystal_growth",
                    "voronoi_shatter",
                    "crystal_bismuth",
                    "crystal_scales",
                    "crystal_facets",
                ],
                &pipeline_layout_candidates,
            ),
        );

        // Legacy V1 params buffer (128 bytes)
        let params_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("sculpt_wgpu_params_v1"),
            size: std::mem::size_of::<BrushParams>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        // V2.1 params buffer (464 bytes) - FINAL BOSS - for use with BrushParamsGpuV2
        let params_buffer_v2 = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("sculpt_wgpu_params_v2"),
            size: 464, // BrushParamsGpuV2::SIZE - FINAL BOSS
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        Self {
            pipeline_all,
            pipeline_candidates,
            pipeline_compact,
            bind_group_layout_all,
            bind_group_layout_candidates,
            bind_group_layout_compact,
            _bind_group_layout_smooth: bind_group_layout_smooth,
            kernel_pipelines,
            alpha_bind_group_layout,
            dummy_alpha_bind_group,
            params_buffer,
            params_buffer_v2,
            workgroup_size,
        }
    }

    /// Get the dummy alpha bind group (use when no alpha is selected)
    pub fn get_dummy_alpha_bind_group(&self) -> &wgpu::BindGroup {
        &self.dummy_alpha_bind_group
    }

    /// Get the alpha bind group layout (for creating alpha bind groups)
    pub fn get_alpha_bind_group_layout(&self) -> &wgpu::BindGroupLayout {
        &self.alpha_bind_group_layout
    }

    /// Get a kernel pipeline by family and entry point
    pub fn get_kernel_pipeline(
        &self,
        kernel: KernelFamily,
        entry_point: &str,
    ) -> Option<&wgpu::ComputePipeline> {
        self.kernel_pipelines
            .get(&kernel)?
            .pipelines
            .get(entry_point)
    }

    /// Get the V2 params buffer (384 bytes) for BrushParamsGpuV2
    pub fn get_params_buffer_v2(&self) -> &wgpu::Buffer {
        &self.params_buffer_v2
    }

    /// Get the legacy V1 params buffer (128 bytes)
    pub fn get_params_buffer(&self) -> &wgpu::Buffer {
        &self.params_buffer
    }

    /// Load a SPIR-V shader pipeline from the KAIN sculpting brush registry
    ///
    /// This method creates a compute pipeline from pre-compiled SPIR-V bytecode.
    /// The SPIR-V shaders are compiled from KAIN (.kn) source files and embedded
    /// at compile time.
    ///
    /// # Arguments
    /// * `device` - The wgpu device to create the pipeline on
    /// * `shader_name` - Name of the shader (e.g., "stamp_clay", "physics_attractor")
    ///
    /// # Returns
    /// * `Ok(ComputePipeline)` - The created compute pipeline
    /// * `Err(String)` - Error message if shader not found or pipeline creation fails
    ///
    /// # Example
    /// ```ignore
    /// let pipeline = sculpt_compute.load_spirv_pipeline(&device, "stamp_clay")?;
    /// ```
    pub fn load_spirv_pipeline(
        &self,
        device: &wgpu::Device,
        shader_name: &str,
    ) -> Result<wgpu::ComputePipeline, String> {
        // Get shader data from registry
        let shader_data = SPIRV_SHADERS
            .get(shader_name)
            .ok_or_else(|| format!("SPIR-V shader not found: {}", shader_name))?;

        // SPIR-V bytecode must be u32-aligned (4-byte words)
        // Verify alignment before casting
        if shader_data.bytecode.len() % 4 != 0 {
            return Err(format!(
                "SPIR-V bytecode for {} has invalid length (not multiple of 4)",
                shader_name
            ));
        }

        // Parse SPIR-V using naga (directly from u8 slice)
        let module = naga::front::spv::parse_u8_slice(
            shader_data.bytecode,
            &naga::front::spv::Options::default(),
        )
        .map_err(|e| format!("Failed to parse SPIR-V for {}: {:?}", shader_name, e))?;

        // Convert to WGSL using naga
        let info = naga::valid::Validator::new(
            naga::valid::ValidationFlags::all(),
            naga::valid::Capabilities::all(),
        )
        .validate(&module)
        .map_err(|e| format!("SPIR-V validation failed for {}: {:?}", shader_name, e))?;

        let wgsl =
            naga::back::wgsl::write_string(&module, &info, naga::back::wgsl::WriterFlags::empty())
                .map_err(|e| {
                    format!(
                        "Failed to convert SPIR-V to WGSL for {}: {:?}",
                        shader_name, e
                    )
                })?;

        // Create shader module from WGSL (wgpu 26 standard API)
        let shader_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some(&format!("spirv_{}", shader_name)),
            source: wgpu::ShaderSource::Wgsl(wgsl.into()),
        });

        // Determine which bind group layout to use based on kernel family
        let bind_group_layout = match shader_data.family {
            super::spirv_loader::KernelFamily::Stamp => &self.bind_group_layout_candidates,
            super::spirv_loader::KernelFamily::Physics => &self.bind_group_layout_candidates,
        };

        // Create pipeline layout (Group 0: mesh data, Group 1: alpha texture)
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some(&format!("spirv_{}_layout", shader_name)),
            bind_group_layouts: &[bind_group_layout, &self.alpha_bind_group_layout],
            push_constant_ranges: &[],
        });

        // Create compute pipeline
        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some(&format!("spirv_{}_pipeline", shader_name)),
            layout: Some(&pipeline_layout),
            module: &shader_module,
            entry_point: Some("main"), // KAIN shaders use "main" as entry point
            compilation_options: Default::default(),
            cache: None,
        });

        log::info!(
            "Loaded SPIR-V pipeline: {} (family: {:?}, size: {} bytes)",
            shader_name,
            shader_data.family,
            shader_data.bytecode.len()
        );

        Ok(pipeline)
    }

    /// Apply brush using SPIR-V shader (KAIN-compiled)
    ///
    /// This method uses pre-compiled SPIR-V shaders from KAIN (.kn) source files.
    /// Keeps WGSL pipeline intact for comparison and fallback.
    ///
    /// # Arguments
    /// * `device` - The wgpu device
    /// * `queue` - The wgpu queue for buffer updates
    /// * `encoder` - Command encoder for GPU operations
    /// * `mesh` - GPU mesh buffers (positions, normals)
    /// * `params` - Brush parameters (center, normal, radius, intensity)
    /// * `shader_name` - SPIR-V shader name (e.g., "stamp_clay", "physics_attractor")
    /// * `alpha_bind_group` - Optional alpha texture bind group
    ///
    /// # Returns
    /// * `Ok(())` - Success
    /// * `Err(String)` - Error message if pipeline loading or encoding fails
    ///
    /// # Example
    /// ```ignore
    /// sculpt_compute.encode_apply_brush_spirv(
    ///     &device,
    ///     &queue,
    ///     &mut encoder,
    ///     &mesh_buffers,
    ///     &params,
    ///     "stamp_clay",
    ///     None,
    /// )?;
    /// ```
    pub fn encode_apply_brush_spirv(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        mesh: &GpuMeshBuffers,
        params: &BrushParams,
        shader_name: &str,
        alpha_bind_group: Option<&wgpu::BindGroup>,
        candidates: Option<&GpuCandidates>,
    ) -> Result<(), String> {
        // Load SPIR-V pipeline (cached internally by wgpu)
        let pipeline = self.load_spirv_pipeline(device, shader_name)?;

        // Create bind group for mesh data
        // Use candidates layout if candidates provided, otherwise use all layout
        let bind_group = if let Some(cands) = candidates {
            device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("spirv_brush_bind_group_candidates"),
                layout: &self.bind_group_layout_candidates,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: mesh.positions.as_entire_binding(),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: mesh.normals.as_entire_binding(),
                    },
                    wgpu::BindGroupEntry {
                        binding: 2,
                        resource: self.params_buffer.as_entire_binding(),
                    },
                    wgpu::BindGroupEntry {
                        binding: 3,
                        resource: cands.indices.as_entire_binding(),
                    },
                ],
            })
        } else {
            device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("spirv_brush_bind_group_all"),
                layout: &self.bind_group_layout_all,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: mesh.positions.as_entire_binding(),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: mesh.normals.as_entire_binding(),
                    },
                    wgpu::BindGroupEntry {
                        binding: 2,
                        resource: self.params_buffer.as_entire_binding(),
                    },
                ],
            })
        };

        // Update params buffer with brush parameters
        queue.write_buffer(&self.params_buffer, 0, bytemuck::bytes_of(params));

        // Dispatch compute shader
        let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("spirv_brush_pass"),
            timestamp_writes: None,
        });

        cpass.set_pipeline(&pipeline);
        cpass.set_bind_group(0, &bind_group, &[]);

        // Set alpha bind group (or dummy if not provided)
        if let Some(alpha_bg) = alpha_bind_group {
            cpass.set_bind_group(1, alpha_bg, &[]);
        } else {
            cpass.set_bind_group(1, &self.dummy_alpha_bind_group, &[]);
        }

        // Calculate workgroups based on vertex count or candidate count
        let workgroups = if let Some(cands) = candidates {
            (cands.count + self.workgroup_size - 1) / self.workgroup_size
        } else {
            (mesh.vertex_count + self.workgroup_size - 1) / self.workgroup_size
        };
        cpass.dispatch_workgroups(workgroups, 1, 1);
        drop(cpass);

        Ok(())
    }

    /// Encode a brush stroke using the modular kernel system (ZBrush-style)
    ///
    /// # Arguments
    /// * `kernel` - Which kernel family (Stamp, Smooth, Pinch, etc.)
    /// * `entry_point` - Specific entry point within the kernel (e.g., "stamp_clay")
    /// * `params_gpu` - BrushParamsGpu from brushes::gpu_params
    #[allow(dead_code)]
    pub fn encode_kernel_brush(
        &self,
        device: &wgpu::Device,
        encoder: &mut wgpu::CommandEncoder,
        kernel: KernelFamily,
        entry_point: &str,
        mesh: &GpuMeshBuffers,
        candidates_buffer: &wgpu::Buffer,
        _counter_buffer: &wgpu::Buffer, // <--- Added!
        indirect_buffer: &wgpu::Buffer,
        params_data: &[u8], // BrushParamsGpu as bytes
        alpha_bind_group: Option<&wgpu::BindGroup>,
    ) -> Result<(), String> {
        // Get the pipeline for this kernel/entry_point combo
        let pipeline = self
            .get_kernel_pipeline(kernel, entry_point)
            .ok_or_else(|| format!("No pipeline for {:?}.{}", kernel, entry_point))?;

        // Create bind group for this brush stroke
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("kernel_brush_bg"),
            layout: &self.bind_group_layout_candidates,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: mesh.positions.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: mesh.normals.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.params_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: candidates_buffer.as_entire_binding(),
                },
            ],
        });

        // Write params to GPU
        // Note: caller should use queue.write_buffer before submitting
        // For now we trust params are already written
        let _ = params_data; // Params written by caller via queue.write_buffer

        // Encode compute pass
        let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("kernel_brush_pass"),
            timestamp_writes: None,
        });

        cpass.set_pipeline(pipeline);
        cpass.set_bind_group(0, &bind_group, &[]);
        cpass.set_bind_group(
            1,
            alpha_bind_group.unwrap_or(&self.dummy_alpha_bind_group),
            &[],
        );

        // Indirect dispatch - GPU decides workgroup count from spatial query
        cpass.dispatch_workgroups_indirect(indirect_buffer, 0);

        Ok(())
    }

    /// Create sparse readback buffers for efficient position+normal readback
    /// max_candidates should match the spatial grid's max_candidates
    ///
    /// DOUBLE-BUFFERED: Creates two staging buffers for async readback.
    /// GPU writes to back, CPU reads from front, swap when ready.
    pub fn create_sparse_readback(
        &self,
        device: &wgpu::Device,
        max_candidates: u32,
    ) -> SparsePositionReadback {
        // Format: [count (u32), idx0 (u32), pos0.xyz (3 f32), norm0.xyz (3 f32), idx1, ...]
        // Each entry = 1 u32 index + 3 f32 position + 3 f32 normal = 7 floats = 28 bytes
        // Total size = 4 bytes (count) + max_candidates * 28 bytes
        let buffer_size = (4 + max_candidates as u64 * 28) as u64;

        let compact_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("sparse_readback_compact"),
            size: buffer_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });

        // Double-buffered staging: front (CPU reads) and back (GPU writes)
        let staging_front = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("sparse_readback_staging_front"),
            size: buffer_size,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let staging_back = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("sparse_readback_staging_back"),
            size: buffer_size,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        SparsePositionReadback {
            compact_buffer,
            max_vertices: max_candidates,
            staging_front,
            staging_back,
            front_index: 0,
            back_ready: false,
            first_frame: true,
        }
    }

    /// Encode compact pass: gather modified positions AND normals into sparse buffer
    pub fn encode_compact_positions(
        &self,
        device: &wgpu::Device,
        encoder: &mut wgpu::CommandEncoder,
        positions_buffer: &wgpu::Buffer,
        normals_buffer: &wgpu::Buffer,
        candidates_buffer: &wgpu::Buffer,
        counter_buffer: &wgpu::Buffer,
        sparse_readback: &SparsePositionReadback,
        indirect_buffer: &wgpu::Buffer,
    ) {
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("sculpt_compact_bg"),
            layout: &self.bind_group_layout_compact,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: positions_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: candidates_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: sparse_readback.compact_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: counter_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: normals_buffer.as_entire_binding(),
                },
            ],
        });

        let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("sculpt_compact_pass"),
            timestamp_writes: None,
        });

        cpass.set_pipeline(&self.pipeline_compact);
        cpass.set_bind_group(0, &bind_group, &[]);

        // Use indirect dispatch - same workgroup count as brush apply
        cpass.dispatch_workgroups_indirect(indirect_buffer, 0);

        // Add explicit barrier after compact pass to ensure completion before readback
        drop(cpass);
        // Note: Memory barriers are handled implicitly by wgpu between compute passes
    }

    pub fn create_candidates(&self, device: &wgpu::Device, indices: &[u32]) -> GpuCandidates {
        let indices_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("sculpt_wgpu_candidates"),
            contents: bytemuck::cast_slice(indices),
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
        });

        GpuCandidates {
            count: indices.len() as u32,
            indices: indices_buf,
        }
    }

    pub fn create_mesh_buffers(
        &self,
        device: &wgpu::Device,
        positions_xyz: &[f32],
        normals_xyz: &[f32],
    ) -> Result<GpuMeshBuffers, String> {
        if positions_xyz.len() % 3 != 0 {
            return Err("positions_xyz must be [x,y,z,...]".into());
        }
        if normals_xyz.len() != positions_xyz.len() {
            return Err("normals_xyz length must match positions_xyz length".into());
        }

        let vertex_count = (positions_xyz.len() / 3) as u32;

        let mut pos4: Vec<[f32; 4]> = Vec::with_capacity(vertex_count as usize);
        let mut nor4: Vec<[f32; 4]> = Vec::with_capacity(vertex_count as usize);

        for i in 0..vertex_count as usize {
            let p = i * 3;
            pos4.push([
                positions_xyz[p],
                positions_xyz[p + 1],
                positions_xyz[p + 2],
                1.0,
            ]);
            nor4.push([normals_xyz[p], normals_xyz[p + 1], normals_xyz[p + 2], 0.0]);
        }

        let positions = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("sculpt_wgpu_positions"),
            contents: bytemuck::cast_slice(&pos4),
            usage: wgpu::BufferUsages::STORAGE
                | wgpu::BufferUsages::VERTEX
                | wgpu::BufferUsages::COPY_DST
                | wgpu::BufferUsages::COPY_SRC,
        });

        let normals = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("sculpt_wgpu_normals"),
            contents: bytemuck::cast_slice(&nor4),
            usage: wgpu::BufferUsages::STORAGE
                | wgpu::BufferUsages::VERTEX
                | wgpu::BufferUsages::COPY_DST
                | wgpu::BufferUsages::COPY_SRC,
        });

        Ok(GpuMeshBuffers {
            vertex_count,
            face_count: 0, // Set when init_normal_buffers is called
            positions,
            normals,
            indices: None,
            normals_fixed: None,
            dirty_mask: None,
            dirty_faces: None,
        })
    }

    /// Initialize buffers for GPU normal recalculation
    /// Call this once after create_mesh_buffers when indices are available
    pub fn init_normal_buffers(device: &wgpu::Device, mesh: &mut GpuMeshBuffers, indices: &[u32]) {
        let face_count = (indices.len() / 3) as u32;
        mesh.face_count = face_count;

        // Indices buffer (one-time upload, topology is static)
        let indices_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("sculpt_wgpu_indices"),
            contents: bytemuck::cast_slice(indices),
            usage: wgpu::BufferUsages::STORAGE,
        });
        mesh.indices = Some(indices_buffer);

        // Fixed-point normals accumulator (3 × i32 per vertex = 12 bytes/vert)
        let normals_fixed_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("sculpt_wgpu_normals_fixed"),
            size: (mesh.vertex_count * 3 * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE,
            mapped_at_creation: false,
        });
        mesh.normals_fixed = Some(normals_fixed_buffer);

        // Dirty vertex bitmask (1 bit per vertex, rounded up to u32)
        let mask_words = (mesh.vertex_count + 31) / 32;
        let dirty_mask_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("sculpt_wgpu_dirty_mask"),
            size: (mask_words * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE,
            mapped_at_creation: false,
        });
        mesh.dirty_mask = Some(dirty_mask_buffer);

        // Dirty faces buffer - sized for typical max brush stroke
        // Max ~6 faces per vertex (closed mesh), capped at face_count
        let max_dirty_faces = (mesh.vertex_count * 6).min(face_count).max(1024);
        let dirty_faces_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("sculpt_wgpu_dirty_faces"),
            size: (max_dirty_faces * 4) as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        mesh.dirty_faces = Some(dirty_faces_buffer);

        log::debug!(
            "GPU normal buffers initialized: {} faces, {} vertices, max {} dirty faces",
            face_count,
            mesh.vertex_count,
            max_dirty_faces
        );
    }

    pub fn encode_apply_brush_all(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        mesh: &GpuMeshBuffers,
        mut params: BrushParams,
        op: SculptOp,
        alpha_bind_group: Option<&wgpu::BindGroup>,
    ) {
        params.vertex_count = mesh.vertex_count;
        params.candidate_count = 0; // 0 = process all vertices
        params.op = op.into();

        queue.write_buffer(&self.params_buffer, 0, bytemuck::bytes_of(&params));

        // Use a dummy buffer for counter in "all" mode (not used, but binding required)
        // Creating a tiny dummy buffer for this fallback case
        let dummy_counter = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("dummy_counter"),
            contents: &[0, 0, 0, 0],
            usage: wgpu::BufferUsages::STORAGE,
        });
        // Dummy candidates (empty)
        let dummy_candidates = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("dummy_candidates"),
            size: 4,
            usage: wgpu::BufferUsages::STORAGE,
            mapped_at_creation: false,
        });

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("sculpt_wgpu_bg_all"),
            layout: &self.bind_group_layout_candidates, // Reusing candidates layout for consistency?
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: mesh.positions.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: mesh.normals.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.params_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: dummy_candidates.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: dummy_counter.as_entire_binding(),
                },
            ],
        });

        let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("sculpt_wgpu_pass"),
            timestamp_writes: None,
        });

        cpass.set_pipeline(&self.pipeline_all);
        cpass.set_bind_group(0, &bind_group, &[]);
        // Group 1: Alpha texture (use dummy if not provided - WGSL shader always expects it)
        let alpha_bg = alpha_bind_group.unwrap_or(&self.dummy_alpha_bind_group);
        cpass.set_bind_group(1, alpha_bg, &[]);

        let wg = (mesh.vertex_count + self.workgroup_size - 1) / self.workgroup_size;
        cpass.dispatch_workgroups(wg, 1, 1);
    }

    pub fn encode_apply_brush_candidates(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        mesh: &GpuMeshBuffers,
        candidates: &GpuCandidates,
        mut params: BrushParams,
        op: SculptOp,
        alpha_bind_group: Option<&wgpu::BindGroup>,
    ) {
        params.vertex_count = mesh.vertex_count;
        params.candidate_count = candidates.count;
        params.op = op.into();

        queue.write_buffer(&self.params_buffer, 0, bytemuck::bytes_of(&params));

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("sculpt_wgpu_bg_candidates"),
            layout: &self.bind_group_layout_candidates,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: mesh.positions.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: mesh.normals.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.params_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: candidates.indices.as_entire_binding(),
                },
            ],
        });

        let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("sculpt_wgpu_pass_candidates"),
            timestamp_writes: None,
        });

        cpass.set_pipeline(&self.pipeline_candidates);
        cpass.set_bind_group(0, &bind_group, &[]);
        // Group 1: Alpha texture (use dummy if not provided - WGSL shader always expects it)
        let alpha_bg = alpha_bind_group.unwrap_or(&self.dummy_alpha_bind_group);
        cpass.set_bind_group(1, alpha_bg, &[]);

        let wg = (candidates.count + self.workgroup_size - 1) / self.workgroup_size;
        cpass.dispatch_workgroups(wg, 1, 1);
    }

    /// Level 5: Indirect dispatch using GPU spatial grid's candidates + indirect buffers
    /// Only processes vertices within brush radius - no CPU->GPU sync of candidate list!
    pub fn encode_apply_brush_indirect(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        entry_point: &str,
        mesh: &GpuMeshBuffers,
        candidates_buffer: &wgpu::Buffer,
        counter_buffer: &wgpu::Buffer, // <--- Added!
        indirect_buffer: &wgpu::Buffer,
        mut params: BrushParams,
        op: SculptOp,
        alpha_bind_group: Option<&wgpu::BindGroup>,
    ) {
        params.vertex_count = mesh.vertex_count;
        params.candidate_count = 0; // Not used - shader reads from candidates[0]
        params.op = op.into();

        queue.write_buffer(&self.params_buffer, 0, bytemuck::bytes_of(&params));

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("sculpt_wgpu_bg_indirect"),
            layout: &self.bind_group_layout_candidates,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: mesh.positions.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: mesh.normals.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.params_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: candidates_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: counter_buffer.as_entire_binding(),
                },
            ],
        });

        let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("sculpt_wgpu_pass_indirect"),
            timestamp_writes: None,
        });

        // Find pipeline for this entry point
        let mut pipeline = &self.pipeline_candidates; // Default fallback

        // Search in modular kernels
        'search: for family_pipelines in self.kernel_pipelines.values() {
            if let Some(p) = family_pipelines.pipelines.get(entry_point) {
                pipeline = p;
                break 'search;
            }
        }

        cpass.set_pipeline(pipeline);
        cpass.set_bind_group(0, &bind_group, &[]);
        // Group 1: Alpha texture (use dummy if not provided - WGSL shader always expects it)
        let alpha_bg = alpha_bind_group.unwrap_or(&self.dummy_alpha_bind_group);
        cpass.set_bind_group(1, alpha_bg, &[]);

        // 🔥 Level 5: Indirect dispatch - GPU decides workgroup count!
        cpass.dispatch_workgroups_indirect(indirect_buffer, 0);
    }
}

pub const SCULPT_WGSL: &str = r#"
// K_OS GPU Sculpt Compute Shader - ALL 31 BRUSH OPERATIONS
// Matches CPU brush logic from sculpt.rs
// With Alpha Texture Support for pore/detail sculpting

struct BrushParams {
  center: vec4<f32>,
  normal: vec4<f32>,
  radius: f32,
  strength: f32,         // was intensity
  hardness: f32,         // was falloff
  spacing: f32,          // NEW (unused in legacy)
  op: u32,               // MOVED to offset 48
  subtract: u32,         // NEW (unused)
  front_faces_only: u32, // NEW (unused)
  accumulate: u32,       // NEW (unused)
  vertex_count: u32,     // Offset 64
  candidate_count: u32,  // Offset 68
  alpha_enabled: u32,    // Offset 72
  alpha_scale: f32,      // Offset 76
  
  jitter_pos: f32,       // Offset 80
  jitter_rot: f32,
  jitter_str: f32,
  rand_seed: f32,
  
  extra0: f32,           // Offset 96
  extra1: f32,
  extra2: f32,
  extra3: f32,
  
  pressure_idx: u32,     // Offset 112
  speed_idx: u32,
  tilt_idx: u32,
  _pad3: u32,
};

// SculptOp enum values (must match Rust enum)
const OP_CLAY: u32 = 0u;
const OP_INFLATE: u32 = 1u;
const OP_FLATTEN: u32 = 2u;
const OP_PINCH: u32 = 3u;
const OP_CREASE: u32 = 4u;
const OP_DRAW: u32 = 5u;
const OP_LAYER: u32 = 6u;
const OP_DAM: u32 = 7u;
const OP_HPOLISH: u32 = 8u;
const OP_RAKE: u32 = 9u;
const OP_SNAKE_HOOK: u32 = 10u;
const OP_CLAY_STRIPS: u32 = 11u;
const OP_MELT: u32 = 12u;
const OP_GRAVITY: u32 = 13u;
const OP_TWIST: u32 = 14u;
const OP_REPEL: u32 = 15u;
const OP_MAGNET: u32 = 16u;
const OP_BLOB: u32 = 17u;
const OP_SPIKE: u32 = 18u;
const OP_CRYSTALLIZE: u32 = 19u;
const OP_TERRACE: u32 = 20u;
const OP_TERRA: u32 = 21u;
const OP_MAGMA: u32 = 22u;
const OP_THERMAL: u32 = 23u;
const OP_ERODE: u32 = 24u;
const OP_GROWTH: u32 = 25u;
const OP_BLOOM: u32 = 26u;
const OP_ELASTIC: u32 = 27u;
const OP_VECTOR_FIELD: u32 = 28u;
const OP_HOLOGRAM: u32 = 29u;
const OP_ATTRACTOR: u32 = 30u;
const OP_GRAB: u32 = 31u;

// Group 0: Mesh data
@group(0) @binding(0)
var<storage, read_write> positions: array<vec4<f32>>;

@group(0) @binding(1)
var<storage, read_write> normals: array<vec4<f32>>;

@group(0) @binding(2)
var<uniform> params: BrushParams;

@group(0) @binding(3)
var<storage, read> candidates: array<u32>;

@group(0) @binding(4)
var<storage, read> counter: array<u32>;

// Group 1: Alpha texture (optional - bound when alpha_enabled = 1)
@group(1) @binding(0)
var alpha_texture: texture_2d<f32>;

@group(1) @binding(1)
var alpha_sampler: sampler;

// Sample alpha texture using projected brush-space UV
// Projects vertex position onto brush plane and maps to UV
fn sample_alpha(v: vec3<f32>, d: f32) -> f32 {
  if (params.alpha_enabled == 0u) {
    return 1.0;  // No alpha = full weight
  }
  
  // Create tangent frame on brush plane
  let brush_n = params.normal.xyz;
  let center = params.center.xyz;
  let radius = params.radius;
  
  // Pick arbitrary tangent (handle up-facing surfaces)
  var tangent: vec3<f32>;
  if (abs(brush_n.y) > 0.99) {
    tangent = normalize(cross(brush_n, vec3<f32>(1.0, 0.0, 0.0)));
  } else {
    tangent = normalize(cross(brush_n, vec3<f32>(0.0, 1.0, 0.0)));
  }
  let bitangent = normalize(cross(brush_n, tangent));
  
  // Project v onto brush plane to get local XY
  let local_x = dot(v, tangent);
  let local_y = dot(v, bitangent);
  
  // Map to UV: center is 0.5,0.5, edges at radius are 0,0 and 1,1
  let scale = params.alpha_scale;
  let uv = vec2<f32>(
    (local_x / radius) * 0.5 * scale + 0.5,
    (local_y / radius) * 0.5 * scale + 0.5
  );
  
  // Sample alpha (clamped to edge by sampler)
  let alpha_value = textureSampleLevel(alpha_texture, alpha_sampler, uv, 0.0).r;
  
  return alpha_value;
}

fn falloff_weight(d: f32, r: f32, power: f32) -> f32 {
  if (d >= r) { return 0.0; }
  let t = 1.0 - (d / r);
  return pow(t, power);
}

// Apply brush operation and return new position
fn apply_brush(p: vec3<f32>, n: vec3<f32>, v: vec3<f32>, d: f32, w: f32) -> vec3<f32> {
  let intensity = params.strength; // Use alias to keep logic same
  let radius = params.radius;
  let brush_normal = params.normal.xyz;
  let center = params.center.xyz;
  
  switch(params.op) {
    // === STANDARD BRUSHES ===
    case OP_CLAY: {
      return p + n * (intensity * w);
    }
    case OP_INFLATE: {
      let inflate_dir = normalize(v + n * 0.00001);
      return p + inflate_dir * (intensity * w);
    }
    case OP_FLATTEN: {
      let dist_to_plane = dot(v, brush_normal);
      let factor = dist_to_plane * 0.5 * w;
      return p - brush_normal * factor;
    }
    case OP_PINCH: {
      let pinch_strength = intensity * 0.05 * w;
      return p - v * pinch_strength;
    }
    case OP_CREASE: {
      let pinch_factor = intensity * 0.05 * w;
      let carve_disp = -intensity * 0.05 * w * 1.5;
      return p - v * pinch_factor + n * carve_disp;
    }
    case OP_DRAW: {
      return p + n * (intensity * w * 0.8);
    }
    case OP_LAYER: {
      let height_limit = radius * 0.3;
      let current_height = dot(v, n);
      let remaining = max(height_limit - current_height, 0.0);
      let layer_disp = min(intensity * 0.05 * w, remaining);
      return p + n * layer_disp;
    }
    case OP_DAM: {
      let dam_w = pow(w, 3.0);
      let pinch = v * intensity * 0.05 * dam_w * 0.3;
      let carve = n * (-intensity * 0.05 * dam_w * 1.5);
      return p - pinch + carve;
    }
    case OP_HPOLISH: {
      let dist_to_plane = dot(v, brush_normal);
      if (dist_to_plane > 0.0) {
        let flatten_amt = dist_to_plane * w * intensity * 0.7;
        return p - brush_normal * flatten_amt;
      }
      return p;
    }
    case OP_RAKE: {
      let groove_freq = 8.0;
      let tangent = normalize(cross(n, vec3<f32>(0.0, 1.0, 0.0)));
      let along_tangent = dot(v, tangent);
      let groove = sin(along_tangent * groove_freq);
      let rake_disp = intensity * 0.05 * w * groove;
      return p + n * rake_disp;
    }
    case OP_SNAKE_HOOK: {
      // Note: Snake hook needs drag_vec from CPU, use normal as fallback
      let elastic = pow(w, 0.3);
      return p + brush_normal * (intensity * elastic * 2.0);
    }
    case OP_CLAY_STRIPS: {
      let stripe = sin(p.x * 15.0 + p.z * 15.0) * 0.5 + 0.5;
      let strip_disp = intensity * 0.05 * w * stripe;
      return p + n * strip_disp;
    }
    
    // === SIMULATION BRUSHES ===
    case OP_MELT: {
      let melt_amt = intensity * 0.05 * 2.0 * w;
      return vec3<f32>(
        p.x + v.x * melt_amt * 0.5,
        p.y - melt_amt,
        p.z + v.z * melt_amt * 0.5
      );
    }
    case OP_GRAVITY: {
      let grav = intensity * 0.05 * 2.0 * w;
      return vec3<f32>(p.x, p.y - grav, p.z);
    }
    case OP_TWIST: {
      let ang = intensity * 0.05 * 5.0 * w;
      let s = sin(ang);
      let c = cos(ang);
      let k_dot_v = dot(brush_normal, v);
      let rotated = v * c + cross(brush_normal, v) * s + brush_normal * k_dot_v * (1.0 - c);
      return center + rotated;
    }
    case OP_REPEL: {
      if (d > 0.0001) {
        let push = intensity * 0.05 * 2.0 * w;
        return p + (v / d) * push;
      }
      return p;
    }
    case OP_MAGNET: {
      let pull = intensity * 0.05 * w;
      return p - v * pull;
    }
    case OP_BLOB: {
      let blob_disp = intensity * 0.05 * w * 1.35;
      return p + n * blob_disp;
    }
    case OP_SPIKE: {
      let spike_w = pow(w, 4.0);
      let spike_disp = intensity * 0.05 * spike_w * 3.0;
      return p + n * spike_disp;
    }
    case OP_CRYSTALLIZE: {
      let grid_sz = radius * 0.5;
      let strength = w * intensity;
      let target_pos = vec3<f32>(
        round(p.x / grid_sz) * grid_sz,
        round(p.y / grid_sz) * grid_sz,
        round(p.z / grid_sz) * grid_sz
      );
      return p + (target_pos - p) * strength;
    }
    case OP_TERRACE: {
      let step = radius * 0.2;
      let strength = w * intensity;
      let h = dot(p, brush_normal);
      let target_h = round(h / step) * step;
      let delta = (target_h - h) * strength;
      return p + brush_normal * delta;
    }
    case OP_TERRA: {
      let noise = sin(p.x * 10.0) * cos(p.z * 10.0);
      let uplift = intensity * 0.05 * (1.0 + noise) * w * 2.0;
      return p + n * uplift;
    }
    case OP_MAGMA: {
      let strength = intensity * 0.05 * w;
      var spread = vec3<f32>(0.0);
      if (d > 0.0001) {
        spread = (v / d) * strength * 0.5;
      }
      let noise = sin(p.x * 5.0 + p.y * 5.0) * strength * 0.5;
      return vec3<f32>(
        p.x + spread.x + noise,
        p.y - strength * 2.0,
        p.z + spread.z - noise
      );
    }
    case OP_THERMAL: {
      let strength = intensity * 0.05 * w;
      return p - n * strength * 0.5 - vec3<f32>(0.0, strength * 0.2, 0.0);
    }
    case OP_ERODE: {
      let erode_amt = intensity * 0.05 * w;
      return p - n * erode_amt;
    }
    case OP_GROWTH: {
      let growth_amt = intensity * 0.05 * w;
      let hash = sin(p.x * 12.9898 + p.y * 78.233) * 43758.5453;
      let branch = vec3<f32>(sin(hash) * 0.5, cos(hash) * 0.5, sin(hash * 2.0) * 0.5);
      return p + (n + branch) * growth_amt;
    }
    case OP_BLOOM: {
      let v_dot_n = dot(v, n);
      let v_tangent = v - n * v_dot_n;
      let len = length(v_tangent);
      if (len > 0.0001) {
        let bloom_amt = intensity * 0.05 * w;
        return p + (v_tangent / len) * bloom_amt + n * bloom_amt * 0.5;
      }
      return p;
    }
    
    // === EXPERIMENTAL BRUSHES ===
    case OP_ELASTIC: {
      let edge_factor = pow(d / radius, 2.0);
      let snap_back = 1.0 - edge_factor;
      let elastic_disp = brush_normal * (intensity * w * snap_back * 2.5);
      return p + elastic_disp;
    }
    case OP_VECTOR_FIELD: {
      let freq = 3.0;
      let curl_x = cos(p.y * freq) * sin(p.z * freq);
      let curl_y = cos(p.z * freq) * sin(p.x * freq);
      let curl_z = cos(p.x * freq) * sin(p.y * freq);
      let curl = normalize(vec3<f32>(curl_x, curl_y, curl_z));
      let flow = intensity * 0.05 * w * 2.0;
      return p + curl * flow;
    }
    case OP_HOLOGRAM: {
      let wave1 = sin(d * 20.0);
      let wave2 = sin(d * 15.0 + p.x * 10.0);
      let wave3 = sin(d * 25.0 - p.z * 8.0);
      let interference = (wave1 + wave2 + wave3) / 3.0;
      let holo_disp = intensity * 0.05 * w * interference * 0.5;
      return p + n * holo_disp;
    }
    case OP_ATTRACTOR: {
      let angle = sin(p.x * 5.0 + p.z * 5.0) * 3.14159;
      let attractor_offset = vec3<f32>(cos(angle), 0.0, sin(angle)) * radius * 0.3;
      let attractor_pos = center + attractor_offset;
      let to_attractor = attractor_pos - p;
      let pull_strength = intensity * 0.05 * w * 0.5;
      return p + normalize(to_attractor) * pull_strength;
    }
    case OP_GRAB: {
      let delta = vec3<f32>(params.extra0, params.extra1, params.extra2);
      return p + delta * w * intensity;
    }
    
    default: {
      return p + n * (intensity * w);
    }
  }
}

@compute @workgroup_size(256)
fn main_all(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.vertex_count) { return; }

  let p = positions[i].xyz;
  let c = params.center.xyz;
  let v = p - c;
  let d = length(v);

  var w = falloff_weight(d, params.radius, max(params.hardness, 0.001));
  if (w <= 0.0) { return; }

  // Apply alpha modulation (pore/detail sculpting)
  let alpha = sample_alpha(v, d);
  w = w * alpha;
  if (w <= 0.001) { return; }

  let n = normalize(normals[i].xyz);
  let new_pos = apply_brush(p, n, v, d, w);
  
  positions[i] = vec4<f32>(new_pos, 1.0);
  normals[i] = vec4<f32>(n, 0.0);
}

@compute @workgroup_size(256)
fn main_candidates(@builtin(global_invocation_id) gid: vec3<u32>) {
  let j = gid.x;
  
  // candidates = pure vertex IDs
  // counter = atomic count
  let candidate_count = counter[0];
  if (j >= candidate_count) { return; }

  // Vertex ID is at candidates[j]
  let i = candidates[j];
  if (i >= params.vertex_count) { return; }

  let p = positions[i].xyz;
  let c = params.center.xyz;
  let v = p - c;
  let d = length(v);

  var w = falloff_weight(d, params.radius, max(params.hardness, 0.001));
  if (w <= 0.0) { return; }

  // Apply alpha modulation (pore/detail sculpting)
  let alpha = sample_alpha(v, d);
  w = w * alpha;
  if (w <= 0.001) { return; }

  let n = normalize(normals[i].xyz);
  let new_pos = apply_brush(p, n, v, d, w);
  
  positions[i] = vec4<f32>(new_pos, 1.0);
  normals[i] = vec4<f32>(n, 0.0);
}

// ============================================================================
// SPARSE READBACK: Compact modified positions+normals for efficient CPU readback
// ============================================================================
// Bindings for compact_positions (different from sculpt bindings!):
// @group(0) @binding(0) positions: read-only
// @group(0) @binding(1) candidates: read-only  
// @group(0) @binding(2) compact_output: read-write
// @group(0) @binding(3) counter: read-only
// @group(0) @binding(4) normals: read-only

@group(0) @binding(0)
var<storage, read> positions_readonly: array<vec4<f32>>;

@group(0) @binding(1)
var<storage, read> candidates_readonly: array<u32>;

@group(0) @binding(2)
var<storage, read_write> compact_output: array<u32>;

@group(0) @binding(3)
var<storage, read> counter_readonly: atomic<u32>;

@group(0) @binding(4)
var<storage, read> normals_readonly: array<vec4<f32>>;

@compute @workgroup_size(256)
fn compact_positions(@builtin(global_invocation_id) gid: vec3<u32>) {
  let j = gid.x;
  
  // candidates_readonly = vertex IDs
  // counter_readonly = count
  let candidate_count = atomicLoad(&counter_readonly);
  
  // First thread writes the count
  if (j == 0u) {
    compact_output[0] = candidate_count;
  }
  
  if (j >= candidate_count) { return; }
  
  // Get vertex ID from candidates (direct index)
  let vertex_id = candidates_readonly[j];
  
  // Read position and normal
  let pos = positions_readonly[vertex_id];
  let norm = normals_readonly[vertex_id];
  
  // Output format: [count, idx0, pos0.xyz, norm0.xyz, idx1, pos1.xyz, norm1.xyz, ...]
  // Each entry = 7 u32s (index + 3 pos floats + 3 norm floats bitcast to u32)
  let out_base = 1u + j * 7u;  // +1 for count at [0]
  
  compact_output[out_base] = vertex_id;
  compact_output[out_base + 1u] = bitcast<u32>(pos.x);
  compact_output[out_base + 2u] = bitcast<u32>(pos.y);
  compact_output[out_base + 3u] = bitcast<u32>(pos.z);
  compact_output[out_base + 4u] = bitcast<u32>(norm.x);
  compact_output[out_base + 5u] = bitcast<u32>(norm.y);
  compact_output[out_base + 6u] = bitcast<u32>(norm.z);
}
"#;

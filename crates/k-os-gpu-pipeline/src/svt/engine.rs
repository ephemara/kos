//! SVT GPU Engine - Owns VRAM resources
//!
//! Initialize once with wgpu::Device and wgpu::Queue.
//! Manages page table texture, physical cache, and compute pipeline.

use std::borrow::Cow;
use wgpu::util::DeviceExt;

// --- CONSTANTS (The "Titan" Specs) ---
pub const TILE_SIZE: u32 = 128;
pub const VIRTUAL_SIZE: u32 = 16384; // 16K Texture
pub const PHYSICAL_SIZE: u32 = 4096; // 4K VRAM Cache
pub const PAGE_TABLE_SIZE: u32 = VIRTUAL_SIZE / TILE_SIZE; // 128x128

/// SVT Compute Shader (embedded)
pub const SVT_WGSL: &str = r#"
// BINDINGS
@group(0) @binding(0) var page_table: texture_storage_2d<rg32uint, read>;
@group(0) @binding(1) var physical_mem: texture_storage_2d<rgba8unorm, read_write>;

struct BrushParams {
    center_uv: vec2<f32>,
    radius: f32,
    _pad0: f32,
    color: vec4<f32>,
    virtual_size: f32, // 16384.0
    tile_size: f32,    // 128.0
    _pad1: vec2<f32>,
}
@group(0) @binding(2) var<uniform> brush: BrushParams;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    // 1. Calculate Virtual Pixel Coordinate
    let virtual_px = vec2<f32>(id.xy); 
    
    // Check distance to brush center
    let center_px = brush.center_uv * brush.virtual_size;
    if (distance(virtual_px, center_px) > brush.radius) {
        return;
    }

    // 2. SVT LOOKUP
    let page_x = u32(virtual_px.x / brush.tile_size);
    let page_y = u32(virtual_px.y / brush.tile_size);
    
    // Look up the physical page location (Rg32Uint)
    let phys_page = textureLoad(page_table, vec2<u32>(page_x, page_y));
    
    // 3. Physical Coordinate Calculation
    let tile_offset_x = u32(virtual_px.x) % u32(brush.tile_size);
    let tile_offset_y = u32(virtual_px.y) % u32(brush.tile_size);
    
    let phys_x = phys_page.x * u32(brush.tile_size) + tile_offset_x;
    let phys_y = phys_page.y * u32(brush.tile_size) + tile_offset_y;
    
    // 4. WRITE
    textureStore(physical_mem, vec2<u32>(phys_x, phys_y), brush.color);
}
"#;

pub struct SvtEngine {
    pub page_table_texture: wgpu::Texture,
    pub page_table_view: wgpu::TextureView,

    pub physical_texture: wgpu::Texture,
    pub physical_view: wgpu::TextureView,

    pub bind_group_layout: wgpu::BindGroupLayout,
    pub compute_pipeline: wgpu::ComputePipeline,
}

impl SvtEngine {
    pub fn new(device: &wgpu::Device) -> Self {
        // 1. Create Page Table (Indirection)
        let page_table_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("SVT Page Table"),
            size: wgpu::Extent3d {
                width: PAGE_TABLE_SIZE,
                height: PAGE_TABLE_SIZE,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rg32Uint,
            usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        let page_table_view =
            page_table_texture.create_view(&wgpu::TextureViewDescriptor::default());

        // 2. Create Physical Memory (The Real VRAM)
        let physical_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("SVT Physical Memory"),
            size: wgpu::Extent3d {
                width: PHYSICAL_SIZE,
                height: PHYSICAL_SIZE,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::STORAGE_BINDING
                | wgpu::TextureUsages::TEXTURE_BINDING
                | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });
        let physical_view = physical_texture.create_view(&wgpu::TextureViewDescriptor::default());

        // 3. Shader Bindings
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("SVT Bind Group Layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::ReadOnly,
                        format: wgpu::TextureFormat::Rg32Uint,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::ReadWrite,
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        view_dimension: wgpu::TextureViewDimension::D2,
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

        // 4. Create Pipeline
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("SVT Compute Shader"),
            source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(SVT_WGSL)),
        });

        let compute_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("SVT Pipeline"),
            layout: Some(
                &device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: Some("SVT Layout"),
                    bind_group_layouts: &[&bind_group_layout],
                    push_constant_ranges: &[],
                }),
            ),
            module: &shader,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

        Self {
            page_table_texture,
            page_table_view,
            physical_texture,
            physical_view,
            bind_group_layout,
            compute_pipeline,
        }
    }

    /// Dispatch a paint stroke!
    pub fn dispatch_stroke(
        &self,
        device: &wgpu::Device,
        _queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        brush_params: &[u8],
    ) {
        // 1. Upload Brush Params
        let brush_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("SVT Brush Params"),
            contents: brush_params,
            usage: wgpu::BufferUsages::UNIFORM,
        });

        // 2. Create BindGroup for this dispatch
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("SVT Stroke Bind Group"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&self.page_table_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&self.physical_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: brush_buffer.as_entire_binding(),
                },
            ],
        });

        // 3. Dispatch
        let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("SVT Paint Pass"),
            timestamp_writes: None,
        });
        cpass.set_pipeline(&self.compute_pipeline);
        cpass.set_bind_group(0, &bind_group, &[]);

        // Dispatch 16x16 workgroups (covers 128x128 pixel brush area)
        cpass.dispatch_workgroups(16, 16, 1);
    }
}

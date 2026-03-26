//! GPU Paint Module - WGPU Compute for 2D Painting

use bytemuck::{Pod, Zeroable};
use k_os_gpu_pipeline::device::GpuComputeDevice;
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Copy)]
pub struct Color {
    pub r: f32,
    pub g: f32,
    pub b: f32,
    pub a: f32,
}

impl Color {
    pub fn from_hex(hex: &str) -> Self {
        let hex = hex.trim_start_matches('#');
        let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0) as f32 / 255.0;
        let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0) as f32 / 255.0;
        let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0) as f32 / 255.0;
        Self { r, g, b, a: 1.0 }
    }
}

#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable)]
struct StrokeUniforms {
    from_x: f32,
    from_y: f32,
    to_x: f32,
    to_y: f32,
    color: [f32; 4],
    size: f32,
    opacity: f32,
    blend_mode: u32,
    _padding: u32,
}

pub struct GpuPaintEngine {
    canvas_texture: wgpu::Texture,
    canvas_view: wgpu::TextureView,
    stroke_pipeline: wgpu::ComputePipeline,
    stroke_bind_group_layout: wgpu::BindGroupLayout,
    uniform_buffer: wgpu::Buffer,
    width: u32,
    height: u32,
    history: Vec<Vec<u8>>,
    history_index: usize,
}

impl GpuPaintEngine {
    pub fn new(device: &wgpu::Device, queue: &wgpu::Queue, width: u32, height: u32) -> Self {
        let canvas_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Paint Canvas"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::STORAGE_BINDING
                | wgpu::TextureUsages::COPY_SRC
                | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        let canvas_view = canvas_texture.create_view(&wgpu::TextureViewDescriptor::default());

        let uniform_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Stroke Uniforms"),
            size: std::mem::size_of::<StrokeUniforms>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Paint Stroke Shader"),
            source: wgpu::ShaderSource::Wgsl(STROKE_SHADER.into()),
        });

        let stroke_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("Stroke Bind Group Layout"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::StorageTexture {
                            access: wgpu::StorageTextureAccess::ReadWrite,
                            format: wgpu::TextureFormat::Rgba8Unorm,
                            view_dimension: wgpu::TextureViewDimension::D2,
                        },
                        count: None,
                    },
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
                ],
            });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Stroke Pipeline Layout"),
            bind_group_layouts: &[&stroke_bind_group_layout],
            push_constant_ranges: &[],
        });

        let stroke_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("Stroke Pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("stroke_main"),
            compilation_options: Default::default(),
            cache: None,
        });

        let white_data: Vec<u8> = (0..width * height)
            .flat_map(|_| [255u8, 255u8, 255u8, 255u8])
            .collect();

        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &canvas_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &white_data,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(width * 4),
                rows_per_image: Some(height),
            },
            wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
        );

        Self {
            canvas_texture,
            canvas_view,
            stroke_pipeline,
            stroke_bind_group_layout,
            uniform_buffer,
            width,
            height,
            history: Vec::new(),
            history_index: 0,
        }
    }

    fn read_canvas(&self, device: &wgpu::Device, queue: &wgpu::Queue) -> Vec<u8> {
        let bytes_per_row = self.width * 4;
        let padded_bytes_per_row = (bytes_per_row + 255) & !255;

        let staging_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Canvas Staging"),
            size: (padded_bytes_per_row * self.height) as u64,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Canvas Read"),
        });

        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo {
                texture: &self.canvas_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::TexelCopyBufferInfo {
                buffer: &staging_buffer,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(padded_bytes_per_row),
                    rows_per_image: Some(self.height),
                },
            },
            wgpu::Extent3d {
                width: self.width,
                height: self.height,
                depth_or_array_layers: 1,
            },
        );

        queue.submit(std::iter::once(encoder.finish()));

        let buffer_slice = staging_buffer.slice(..);
        let (tx, rx) = std::sync::mpsc::channel();
        buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
            tx.send(result).unwrap();
        });
        let _ = device.poll(wgpu::PollType::Wait);
        rx.recv().unwrap().unwrap();

        let data = buffer_slice.get_mapped_range();
        let mut pixels = Vec::with_capacity((self.width * self.height * 4) as usize);
        for y in 0..self.height {
            let start = (y * padded_bytes_per_row) as usize;
            let end = start + (self.width * 4) as usize;
            pixels.extend_from_slice(&data[start..end]);
        }
        drop(data);
        staging_buffer.unmap();

        pixels
    }

    fn write_canvas(&self, queue: &wgpu::Queue, data: &[u8]) {
        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &self.canvas_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            data,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(self.width * 4),
                rows_per_image: Some(self.height),
            },
            wgpu::Extent3d {
                width: self.width,
                height: self.height,
                depth_or_array_layers: 1,
            },
        );
    }
}

const STROKE_SHADER: &str = r#"
struct Uniforms {
    from_pos: vec2<f32>,
    to_pos: vec2<f32>,
    color: vec4<f32>,
    size: f32,
    opacity: f32,
    blend_mode: u32,
    _padding: u32,
}

@group(0) @binding(0) var canvas: texture_storage_2d<rgba8unorm, read_write>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

fn sd_segment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
    return length(pa - ba * h);
}

@compute @workgroup_size(16, 16)
fn stroke_main(@builtin(global_invocation_id) id: vec3<u32>) {
    let dims = textureDimensions(canvas);
    if id.x >= dims.x || id.y >= dims.y {
        return;
    }

    let uv = vec2<f32>(f32(id.x) / f32(dims.x), f32(id.y) / f32(dims.y));
    let dist = sd_segment(uv, uniforms.from_pos, uniforms.to_pos);
    let radius = uniforms.size * 0.5;
    let alpha = 1.0 - smoothstep(radius * 0.7, radius, dist);

    if alpha < 0.001 {
        return;
    }

    let existing = textureLoad(canvas, vec2<i32>(id.xy));
    var final_color: vec4<f32>;

    if uniforms.blend_mode == 0u {
        let paint_alpha = alpha * uniforms.opacity;
        final_color = mix(existing, uniforms.color, paint_alpha);
    } else if uniforms.blend_mode == 1u {
        let smear_alpha = alpha * uniforms.opacity * 0.5;
        final_color = mix(existing, uniforms.color, smear_alpha);
    } else {
        let blend_alpha = alpha * uniforms.opacity * 0.3;
        let blended = (existing + uniforms.color) * 0.5;
        final_color = mix(existing, blended, blend_alpha);
    }

    textureStore(canvas, vec2<i32>(id.xy), final_color);
}
"#;

lazy_static! {
    static ref PAINT_ENGINES: Mutex<HashMap<u64, GpuPaintEngine>> = Mutex::new(HashMap::new());
    static ref NEXT_HANDLE: Mutex<u64> = Mutex::new(1);
}

fn next_handle() -> u64 {
    let mut h = NEXT_HANDLE.lock().unwrap();
    let handle = *h;
    *h += 1;
    handle
}

#[derive(serde::Serialize)]
pub struct CanvasData {
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

pub fn gpu_paint_init(width: u32, height: u32) -> Result<u64, String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();

    let engine = GpuPaintEngine::new(&gpu_guard.device, &gpu_guard.queue, width, height);
    let handle = next_handle();

    PAINT_ENGINES.lock().unwrap().insert(handle, engine);

    log::info!(
        "[GPU Paint] Initialized {}x{} canvas, handle {}",
        width,
        height,
        handle
    );
    Ok(handle)
}

pub fn gpu_paint_stroke(
    handle: u64,
    from_x: f32,
    from_y: f32,
    to_x: f32,
    to_y: f32,
    pressure: f32,
    color: String,
    size: f32,
    opacity: f32,
    blend_mode: String,
) -> Result<(), String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();

    let mut engines = PAINT_ENGINES.lock().unwrap();
    let engine = engines
        .get_mut(&handle)
        .ok_or_else(|| format!("Paint handle {} not found", handle))?;

    let c = Color::from_hex(&color);
    let blend_mode_u32 = match blend_mode.as_str() {
        "smear" => 1u32,
        "blend" => 2u32,
        _ => 0u32,
    };

    let uniforms = StrokeUniforms {
        from_x,
        from_y,
        to_x,
        to_y,
        color: [c.r, c.g, c.b, c.a],
        size: size * pressure,
        opacity: opacity * pressure,
        blend_mode: blend_mode_u32,
        _padding: 0,
    };

    gpu_guard
        .queue
        .write_buffer(&engine.uniform_buffer, 0, bytemuck::bytes_of(&uniforms));

    let bind_group = gpu_guard
        .device
        .create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Stroke Bind Group"),
            layout: &engine.stroke_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&engine.canvas_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: engine.uniform_buffer.as_entire_binding(),
                },
            ],
        });

    let mut encoder = gpu_guard
        .device
        .create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Stroke Encoder"),
        });

    {
        let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("Stroke Pass"),
            timestamp_writes: None,
        });
        pass.set_pipeline(&engine.stroke_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.dispatch_workgroups((engine.width + 15) / 16, (engine.height + 15) / 16, 1);
    }

    gpu_guard.queue.submit(std::iter::once(encoder.finish()));

    Ok(())
}

pub fn gpu_paint_end_stroke(handle: u64) -> Result<(), String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();

    let mut engines = PAINT_ENGINES.lock().unwrap();
    let engine = engines
        .get_mut(&handle)
        .ok_or_else(|| format!("Paint handle {} not found", handle))?;

    let data = engine.read_canvas(&gpu_guard.device, &gpu_guard.queue);

    if engine.history_index < engine.history.len() {
        engine.history.truncate(engine.history_index);
    }
    engine.history.push(data);
    engine.history_index = engine.history.len();

    if engine.history.len() > 20 {
        engine.history.remove(0);
        engine.history_index = engine.history.len();
    }

    Ok(())
}

pub fn gpu_paint_get_canvas(handle: u64) -> Result<CanvasData, String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();

    let engines = PAINT_ENGINES.lock().unwrap();
    let engine = engines
        .get(&handle)
        .ok_or_else(|| format!("Paint handle {} not found", handle))?;

    let data = engine.read_canvas(&gpu_guard.device, &gpu_guard.queue);

    Ok(CanvasData {
        data,
        width: engine.width,
        height: engine.height,
    })
}

pub fn gpu_paint_clear(handle: u64, color: String) -> Result<(), String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();

    let engines = PAINT_ENGINES.lock().unwrap();
    let engine = engines
        .get(&handle)
        .ok_or_else(|| format!("Paint handle {} not found", handle))?;

    let c = Color::from_hex(&color);
    let data: Vec<u8> = (0..engine.width * engine.height)
        .flat_map(|_| {
            [
                (c.r * 255.0) as u8,
                (c.g * 255.0) as u8,
                (c.b * 255.0) as u8,
                255u8,
            ]
        })
        .collect();

    engine.write_canvas(&gpu_guard.queue, &data);

    Ok(())
}

pub fn gpu_paint_undo(handle: u64) -> Result<bool, String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();

    let mut engines = PAINT_ENGINES.lock().unwrap();
    let engine = engines
        .get_mut(&handle)
        .ok_or_else(|| format!("Paint handle {} not found", handle))?;

    if engine.history_index > 1 {
        engine.history_index -= 1;
        if let Some(data) = engine.history.get(engine.history_index - 1) {
            engine.write_canvas(&gpu_guard.queue, data);
            return Ok(true);
        }
    }

    Ok(false)
}

pub fn gpu_paint_dispose(handle: u64) -> Result<(), String> {
    let mut engines = PAINT_ENGINES.lock().unwrap();

    if engines.remove(&handle).is_some() {
        log::info!("[GPU Paint] Disposed handle {}", handle);
        Ok(())
    } else {
        Err(format!("Paint handle {} not found", handle))
    }
}

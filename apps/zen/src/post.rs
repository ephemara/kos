use crate::config::RendererPostConfig;
use glam::Vec3;
use k_os_kain::{build_file, generated_spirv_by_id, workspace_root, KainCliTarget};
use std::borrow::Cow;
use std::fs;
use wgpu::util::DeviceExt;
use winit::dpi::PhysicalSize;

const OUTPUT_PIXEL_STRIDE_BYTES: u32 = 16;

pub struct ZenPostProcessor {
    config: RendererPostConfig,
    pipeline: Option<wgpu::ComputePipeline>,
    bind_group_layout: Option<wgpu::BindGroupLayout>,
    bind_group: Option<wgpu::BindGroup>,
    output_buffer: Option<wgpu::Buffer>,
    viewport_width_buffer: Option<wgpu::Buffer>,
    viewport_height_buffer: Option<wgpu::Buffer>,
    row_stride_buffer: Option<wgpu::Buffer>,
    time_buffer: Option<wgpu::Buffer>,
    camera_forward_buffer: Option<wgpu::Buffer>,
    sun_dir_buffer: Option<wgpu::Buffer>,
    sun_color_buffer: Option<wgpu::Buffer>,
    sky_top_buffer: Option<wgpu::Buffer>,
    sky_horizon_buffer: Option<wgpu::Buffer>,
    ground_color_buffer: Option<wgpu::Buffer>,
    fog_color_buffer: Option<wgpu::Buffer>,
    accent_color_buffer: Option<wgpu::Buffer>,
    shadow_color_buffer: Option<wgpu::Buffer>,
    fog_density_buffer: Option<wgpu::Buffer>,
    shadow_strength_buffer: Option<wgpu::Buffer>,
    glow_strength_buffer: Option<wgpu::Buffer>,
    haze_strength_buffer: Option<wgpu::Buffer>,
    sun_disk_power_buffer: Option<wgpu::Buffer>,
    output_texture: Option<wgpu::Texture>,
    output_view: Option<wgpu::TextureView>,
    size: PhysicalSize<u32>,
    row_stride_pixels: u32,
    status: String,
}

impl ZenPostProcessor {
    pub fn new(device: &wgpu::Device, config: RendererPostConfig, size: PhysicalSize<u32>) -> Self {
        let mut processor = Self {
            config,
            pipeline: None,
            bind_group_layout: None,
            bind_group: None,
            output_buffer: None,
            viewport_width_buffer: None,
            viewport_height_buffer: None,
            row_stride_buffer: None,
            time_buffer: None,
            camera_forward_buffer: None,
            sun_dir_buffer: None,
            sun_color_buffer: None,
            sky_top_buffer: None,
            sky_horizon_buffer: None,
            ground_color_buffer: None,
            fog_color_buffer: None,
            accent_color_buffer: None,
            shadow_color_buffer: None,
            fog_density_buffer: None,
            shadow_strength_buffer: None,
            glow_strength_buffer: None,
            haze_strength_buffer: None,
            sun_disk_power_buffer: None,
            output_texture: None,
            output_view: None,
            size,
            row_stride_pixels: 0,
            status: "ZEN POST disabled".to_string(),
        };

        if !processor.config.enabled {
            return processor;
        }

        match processor.try_initialize(device) {
            Ok(()) => processor,
            Err(err) => {
                processor.status = format!("ZEN POST degraded // {err}");
                processor
            }
        }
    }

    pub fn status(&self) -> &str {
        &self.status
    }

    pub fn is_ready(&self) -> bool {
        self.pipeline.is_some() && self.bind_group.is_some() && self.output_view.is_some()
    }

    pub fn output_view(&self) -> Option<&wgpu::TextureView> {
        self.output_view.as_ref()
    }

    pub fn resize(&mut self, device: &wgpu::Device, size: PhysicalSize<u32>) {
        self.size = size;
        if !self.config.enabled || self.pipeline.is_none() {
            return;
        }

        if let Err(err) = self.allocate_output_resources(device) {
            self.status = format!("ZEN POST degraded // {err}");
        } else {
            self.status = format!("ZEN POST ready // {}", self.config.shader_id);
        }
    }

    pub fn encode(
        &mut self,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        time_seconds: f32,
        camera_forward: Vec3,
        sun_dir: [f32; 3],
        sun_color: [f32; 4],
        accent: [f32; 4],
        fog_density: f32,
        shadow_strength: f32,
    ) -> Result<(), String> {
        if !self.is_ready() || self.size.width == 0 || self.size.height == 0 {
            return Ok(());
        }

        let bind_group = self.bind_group.as_ref().ok_or("missing post bind group")?;
        let pipeline = self.pipeline.as_ref().ok_or("missing post pipeline")?;
        let output_buffer = self
            .output_buffer
            .as_ref()
            .ok_or("missing post output buffer")?;
        let output_texture = self
            .output_texture
            .as_ref()
            .ok_or("missing post output texture")?;

        queue.write_buffer(
            self.viewport_width_buffer
                .as_ref()
                .ok_or("missing width buffer")?,
            0,
            bytemuck::cast_slice(&[self.size.width]),
        );
        queue.write_buffer(
            self.viewport_height_buffer
                .as_ref()
                .ok_or("missing height buffer")?,
            0,
            bytemuck::cast_slice(&[self.size.height]),
        );
        queue.write_buffer(
            self.row_stride_buffer
                .as_ref()
                .ok_or("missing row stride buffer")?,
            0,
            bytemuck::cast_slice(&[self.row_stride_pixels]),
        );
        queue.write_buffer(
            self.time_buffer.as_ref().ok_or("missing time buffer")?,
            0,
            bytemuck::cast_slice(&[time_seconds]),
        );
        queue.write_buffer(
            self.camera_forward_buffer
                .as_ref()
                .ok_or("missing camera forward buffer")?,
            0,
            bytemuck::cast_slice(&[[
                camera_forward.x,
                camera_forward.y,
                camera_forward.z,
                1.0_f32,
            ]]),
        );
        queue.write_buffer(
            self.sun_dir_buffer
                .as_ref()
                .ok_or("missing sun dir buffer")?,
            0,
            bytemuck::cast_slice(&[[sun_dir[0], sun_dir[1], sun_dir[2], 0.0_f32]]),
        );
        queue.write_buffer(
            self.sun_color_buffer
                .as_ref()
                .ok_or("missing sun color buffer")?,
            0,
            bytemuck::cast_slice(&[sun_color]),
        );
        queue.write_buffer(
            self.accent_color_buffer
                .as_ref()
                .ok_or("missing accent color buffer")?,
            0,
            bytemuck::cast_slice(&[accent]),
        );
        queue.write_buffer(
            self.fog_density_buffer
                .as_ref()
                .ok_or("missing fog density buffer")?,
            0,
            bytemuck::cast_slice(&[fog_density]),
        );
        queue.write_buffer(
            self.shadow_strength_buffer
                .as_ref()
                .ok_or("missing shadow strength buffer")?,
            0,
            bytemuck::cast_slice(&[shadow_strength]),
        );

        {
            let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("zen-kain-atmosphere-pass"),
                timestamp_writes: None,
            });
            compute_pass.set_pipeline(pipeline);
            compute_pass.set_bind_group(0, bind_group, &[]);
            compute_pass.dispatch_workgroups(self.size.width.max(1), self.size.height.max(1), 1);
        }

        encoder.copy_buffer_to_texture(
            wgpu::TexelCopyBufferInfo {
                buffer: output_buffer,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(self.row_stride_pixels * OUTPUT_PIXEL_STRIDE_BYTES),
                    rows_per_image: Some(self.size.height),
                },
            },
            wgpu::TexelCopyTextureInfo {
                texture: output_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::Extent3d {
                width: self.size.width,
                height: self.size.height,
                depth_or_array_layers: 1,
            },
        );

        Ok(())
    }

    fn try_initialize(&mut self, device: &wgpu::Device) -> Result<(), String> {
        ensure_shader_artifact(&self.config)?;
        let shader_bytes = load_shader_bytes(&self.config)?;
        let shader_wgsl = spirv_to_wgsl(&shader_bytes)?;
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("zen-kain-atmosphere-module"),
            source: wgpu::ShaderSource::Wgsl(Cow::Owned(shader_wgsl)),
        });

        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("zen-kain-atmosphere-layout"),
            entries: &[
                storage_layout_entry(0),
                uniform_layout_entry(1),
                uniform_layout_entry(2),
                uniform_layout_entry(3),
                uniform_layout_entry(4),
                uniform_layout_entry(5),
                uniform_layout_entry(6),
                uniform_layout_entry(7),
                uniform_layout_entry(8),
                uniform_layout_entry(9),
                uniform_layout_entry(10),
                uniform_layout_entry(11),
                uniform_layout_entry(12),
                uniform_layout_entry(13),
                uniform_layout_entry(14),
                uniform_layout_entry(15),
                uniform_layout_entry(16),
                uniform_layout_entry(17),
                uniform_layout_entry(18),
            ],
        });
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("zen-kain-atmosphere-pipeline-layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });
        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("zen-kain-atmosphere-pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some(self.config.shader_id.as_str()),
            compilation_options: Default::default(),
            cache: None,
        });

        self.bind_group_layout = Some(bind_group_layout);
        self.pipeline = Some(pipeline);
        self.viewport_width_buffer =
            Some(create_u32_buffer(device, "zen-post-width", self.size.width));
        self.viewport_height_buffer = Some(create_u32_buffer(
            device,
            "zen-post-height",
            self.size.height,
        ));
        self.row_stride_buffer = Some(create_u32_buffer(device, "zen-post-row-stride", 0));
        self.time_buffer = Some(create_f32_buffer(device, "zen-post-time", 0.0));
        self.camera_forward_buffer = Some(create_vec4_buffer(
            device,
            "zen-post-camera-forward",
            [0.0, 0.0, 1.0, 1.0],
        ));
        self.sun_dir_buffer = Some(create_vec4_buffer(
            device,
            "zen-post-sun-dir",
            [0.0, -1.0, 0.0, 0.0],
        ));
        self.sun_color_buffer = Some(create_vec4_buffer(
            device,
            "zen-post-sun-color",
            [1.0, 0.92, 0.84, 1.0],
        ));
        self.sky_top_buffer = Some(create_vec4_buffer(
            device,
            "zen-post-sky-top",
            self.config.sky_top,
        ));
        self.sky_horizon_buffer = Some(create_vec4_buffer(
            device,
            "zen-post-sky-horizon",
            self.config.sky_horizon,
        ));
        self.ground_color_buffer = Some(create_vec4_buffer(
            device,
            "zen-post-ground-color",
            self.config.ground_color,
        ));
        self.fog_color_buffer = Some(create_vec4_buffer(
            device,
            "zen-post-fog-color",
            self.config.fog_color,
        ));
        self.accent_color_buffer = Some(create_vec4_buffer(
            device,
            "zen-post-accent-color",
            [0.0, 0.0, 0.0, 1.0],
        ));
        self.shadow_color_buffer = Some(create_vec4_buffer(
            device,
            "zen-post-shadow-color",
            self.config.shadow_color,
        ));
        self.fog_density_buffer = Some(create_f32_buffer(device, "zen-post-fog-density", 0.02));
        self.shadow_strength_buffer =
            Some(create_f32_buffer(device, "zen-post-shadow-strength", 0.75));
        self.glow_strength_buffer = Some(create_f32_buffer(
            device,
            "zen-post-glow-strength",
            self.config.glow_strength,
        ));
        self.haze_strength_buffer = Some(create_f32_buffer(
            device,
            "zen-post-haze-strength",
            self.config.haze_strength,
        ));
        self.sun_disk_power_buffer = Some(create_f32_buffer(
            device,
            "zen-post-sun-disk-power",
            self.config.sun_disk_power,
        ));

        self.allocate_output_resources(device)?;
        self.status = format!("ZEN POST ready // {}", self.config.shader_id);
        Ok(())
    }

    fn allocate_output_resources(&mut self, device: &wgpu::Device) -> Result<(), String> {
        let width = self.size.width.max(1);
        let height = self.size.height.max(1);
        let row_stride_pixels = aligned_row_stride_pixels(width);
        let output_size =
            row_stride_pixels as u64 * height as u64 * OUTPUT_PIXEL_STRIDE_BYTES as u64;

        let output_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("zen-post-output-buffer"),
            size: output_size.max(OUTPUT_PIXEL_STRIDE_BYTES as u64),
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });
        let output_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("zen-post-output-texture"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba32Float,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        let output_view = output_texture.create_view(&wgpu::TextureViewDescriptor::default());

        self.output_buffer = Some(output_buffer);
        self.output_texture = Some(output_texture);
        self.output_view = Some(output_view);
        self.row_stride_pixels = row_stride_pixels;

        let layout = self
            .bind_group_layout
            .as_ref()
            .ok_or("missing post bind group layout")?;
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("zen-kain-atmosphere-bind-group"),
            layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self
                        .output_buffer
                        .as_ref()
                        .ok_or("missing post output buffer")?
                        .as_entire_binding(),
                },
                uniform_bind_group_entry(
                    1,
                    self.viewport_width_buffer
                        .as_ref()
                        .ok_or("missing width buffer")?,
                ),
                uniform_bind_group_entry(
                    2,
                    self.viewport_height_buffer
                        .as_ref()
                        .ok_or("missing height buffer")?,
                ),
                uniform_bind_group_entry(
                    3,
                    self.row_stride_buffer
                        .as_ref()
                        .ok_or("missing row stride buffer")?,
                ),
                uniform_bind_group_entry(
                    4,
                    self.time_buffer.as_ref().ok_or("missing time buffer")?,
                ),
                uniform_bind_group_entry(
                    5,
                    self.camera_forward_buffer
                        .as_ref()
                        .ok_or("missing camera forward buffer")?,
                ),
                uniform_bind_group_entry(
                    6,
                    self.sun_dir_buffer
                        .as_ref()
                        .ok_or("missing sun dir buffer")?,
                ),
                uniform_bind_group_entry(
                    7,
                    self.sun_color_buffer
                        .as_ref()
                        .ok_or("missing sun color buffer")?,
                ),
                uniform_bind_group_entry(
                    8,
                    self.sky_top_buffer
                        .as_ref()
                        .ok_or("missing sky top buffer")?,
                ),
                uniform_bind_group_entry(
                    9,
                    self.sky_horizon_buffer
                        .as_ref()
                        .ok_or("missing sky horizon buffer")?,
                ),
                uniform_bind_group_entry(
                    10,
                    self.ground_color_buffer
                        .as_ref()
                        .ok_or("missing ground color buffer")?,
                ),
                uniform_bind_group_entry(
                    11,
                    self.fog_color_buffer
                        .as_ref()
                        .ok_or("missing fog color buffer")?,
                ),
                uniform_bind_group_entry(
                    12,
                    self.accent_color_buffer
                        .as_ref()
                        .ok_or("missing accent color buffer")?,
                ),
                uniform_bind_group_entry(
                    13,
                    self.shadow_color_buffer
                        .as_ref()
                        .ok_or("missing shadow color buffer")?,
                ),
                uniform_bind_group_entry(
                    14,
                    self.fog_density_buffer
                        .as_ref()
                        .ok_or("missing fog density buffer")?,
                ),
                uniform_bind_group_entry(
                    15,
                    self.shadow_strength_buffer
                        .as_ref()
                        .ok_or("missing shadow strength buffer")?,
                ),
                uniform_bind_group_entry(
                    16,
                    self.glow_strength_buffer
                        .as_ref()
                        .ok_or("missing glow strength buffer")?,
                ),
                uniform_bind_group_entry(
                    17,
                    self.haze_strength_buffer
                        .as_ref()
                        .ok_or("missing haze strength buffer")?,
                ),
                uniform_bind_group_entry(
                    18,
                    self.sun_disk_power_buffer
                        .as_ref()
                        .ok_or("missing sun disk power buffer")?,
                ),
            ],
        });

        self.bind_group = Some(bind_group);
        Ok(())
    }
}

fn ensure_shader_artifact(config: &RendererPostConfig) -> Result<(), String> {
    let workspace = workspace_root();
    let source_path = workspace.join(&config.shader_source_path);
    let compiled_path = workspace.join(&config.shader_compiled_path);

    if !source_path.exists() {
        return Err(format!(
            "missing Kain post source '{}'",
            source_path.display()
        ));
    }

    let should_build = config.compile_on_startup
        || !compiled_path.exists()
        || is_source_newer(&source_path, &compiled_path);
    if !should_build {
        return Ok(());
    }

    if let Some(parent) = compiled_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("failed to create '{}': {err}", parent.display()))?;
    }

    let output = build_file(
        config.shader_source_path.clone(),
        KainCliTarget::Spirv,
        Some(config.shader_compiled_path.clone()),
    )
    .map_err(|err| format!("failed to invoke Kain build: {err}"))?;
    if !output.success {
        return Err(output
            .errors
            .unwrap_or_else(|| "Kain compiler did not provide an error".to_string()));
    }
    Ok(())
}

fn load_shader_bytes(config: &RendererPostConfig) -> Result<Vec<u8>, String> {
    let compiled_path = workspace_root().join(&config.shader_compiled_path);
    if compiled_path.exists() {
        return fs::read(&compiled_path)
            .map_err(|err| format!("failed to read '{}': {err}", compiled_path.display()));
    }

    generated_spirv_by_id(&config.shader_id)
        .map(|asset| asset.bytes.to_vec())
        .ok_or_else(|| format!("missing embedded Kain asset '{}'", config.shader_id))
}

fn is_source_newer(source: &std::path::Path, output: &std::path::Path) -> bool {
    let Ok(source_meta) = fs::metadata(source) else {
        return false;
    };
    let Ok(output_meta) = fs::metadata(output) else {
        return true;
    };
    let Ok(source_modified) = source_meta.modified() else {
        return false;
    };
    let Ok(output_modified) = output_meta.modified() else {
        return true;
    };
    source_modified > output_modified
}

fn spirv_to_wgsl(bytes: &[u8]) -> Result<String, String> {
    let module = naga::front::spv::parse_u8_slice(bytes, &naga::front::spv::Options::default())
        .map_err(|err| format!("Failed to parse SPIR-V: {err:?}"))?;
    let info = naga::valid::Validator::new(
        naga::valid::ValidationFlags::all(),
        naga::valid::Capabilities::all(),
    )
    .validate(&module)
    .map_err(|err| format!("Failed to validate SPIR-V module: {err:?}"))?;
    naga::back::wgsl::write_string(
        &module,
        &info,
        naga::back::wgsl::WriterFlags::EXPLICIT_TYPES,
    )
    .map_err(|err| format!("Failed to translate SPIR-V to WGSL: {err}"))
}

fn aligned_row_stride_pixels(width: u32) -> u32 {
    let raw_bytes = width.max(1) * OUTPUT_PIXEL_STRIDE_BYTES;
    let aligned_bytes =
        raw_bytes.div_ceil(wgpu::COPY_BYTES_PER_ROW_ALIGNMENT) * wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;
    aligned_bytes / OUTPUT_PIXEL_STRIDE_BYTES
}

fn storage_layout_entry(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::COMPUTE,
        ty: wgpu::BindingType::Buffer {
            ty: wgpu::BufferBindingType::Storage { read_only: false },
            has_dynamic_offset: false,
            min_binding_size: None,
        },
        count: None,
    }
}

fn uniform_layout_entry(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::COMPUTE,
        ty: wgpu::BindingType::Buffer {
            ty: wgpu::BufferBindingType::Uniform,
            has_dynamic_offset: false,
            min_binding_size: None,
        },
        count: None,
    }
}

fn uniform_bind_group_entry<'a>(
    binding: u32,
    buffer: &'a wgpu::Buffer,
) -> wgpu::BindGroupEntry<'a> {
    wgpu::BindGroupEntry {
        binding,
        resource: buffer.as_entire_binding(),
    }
}

fn create_u32_buffer(device: &wgpu::Device, label: &str, value: u32) -> wgpu::Buffer {
    device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some(label),
        contents: bytemuck::cast_slice(&[[value, 0_u32, 0_u32, 0_u32]]),
        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
    })
}

fn create_f32_buffer(device: &wgpu::Device, label: &str, value: f32) -> wgpu::Buffer {
    device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some(label),
        contents: bytemuck::cast_slice(&[[value, 0.0_f32, 0.0_f32, 0.0_f32]]),
        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
    })
}

fn create_vec4_buffer(device: &wgpu::Device, label: &str, value: [f32; 4]) -> wgpu::Buffer {
    device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some(label),
        contents: bytemuck::cast_slice(&[value]),
        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
    })
}

#[cfg(test)]
mod tests {
    use super::aligned_row_stride_pixels;

    #[test]
    fn aligns_rows_for_copy_into_texture() {
        assert_eq!(aligned_row_stride_pixels(1) * 16 % 256, 0);
        assert_eq!(aligned_row_stride_pixels(1920), 1920);
        assert!(aligned_row_stride_pixels(1541) >= 1541);
        assert_eq!(aligned_row_stride_pixels(1541) * 16 % 256, 0);
    }
}

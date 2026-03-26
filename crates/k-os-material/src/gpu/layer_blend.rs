//! GPU Layer Blending Pipeline
//!
//! GPU-accelerated layer compositing for KAutoPBR material system.
//! Supports 10 blend modes with mask and opacity control.
//!
//! Requirements: 2.6, 17.1, 17.2, 17.5

use bytemuck::{Pod, Zeroable};
use wgpu::util::DeviceExt;

/// Blend parameters for GPU shader (16-byte aligned)
#[repr(C)]
#[derive(Copy, Clone, Debug, Zeroable, Pod)]
pub struct BlendParams {
    /// Layer opacity (0.0-1.0)
    pub opacity: f32,
    /// Blend mode constant (0-9)
    pub blend_mode: u32,
    /// Has mask flag (0 = no mask, 1 = has mask)
    pub has_mask: u32,
    /// Invert mask flag (0 = normal, 1 = inverted)
    pub invert_mask: u32,
}

/// Blend mode constants matching WGSL shader
#[repr(u32)]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum BlendModeGpu {
    Normal = 0,
    Multiply = 1,
    Screen = 2,
    Overlay = 3,
    Add = 4,
    Subtract = 5,
    Divide = 6,
    Difference = 7,
    Darken = 8,
    Lighten = 9,
}

impl From<crate::autopbr::layer::BlendMode> for BlendModeGpu {
    fn from(mode: crate::autopbr::layer::BlendMode) -> Self {
        use crate::autopbr::layer::BlendMode;
        match mode {
            BlendMode::Normal => BlendModeGpu::Normal,
            BlendMode::Multiply => BlendModeGpu::Multiply,
            BlendMode::Screen => BlendModeGpu::Screen,
            BlendMode::Overlay => BlendModeGpu::Overlay,
            BlendMode::Add => BlendModeGpu::Add,
            BlendMode::Subtract => BlendModeGpu::Subtract,
            BlendMode::Divide => BlendModeGpu::Divide,
            BlendMode::Difference => BlendModeGpu::Difference,
            BlendMode::Darken => BlendModeGpu::Darken,
            BlendMode::Lighten => BlendModeGpu::Lighten,
        }
    }
}

/// GPU Layer Blending Engine
///
/// Provides GPU-accelerated layer compositing with support for:
/// - 10 blend modes (Normal, Multiply, Screen, Overlay, Add, Subtract, Divide, Difference, Darken, Lighten)
/// - Per-layer opacity control
/// - Optional mask textures with invert support
/// - Textures up to 16K resolution with automatic tiling for memory management
pub struct GpuLayerBlend {
    /// Compute pipeline for layer blending
    pipeline: wgpu::ComputePipeline,
    /// Bind group layout
    bind_group_layout: wgpu::BindGroupLayout,
    /// Sampler for texture sampling (if needed for future extensions)
    #[allow(dead_code)]
    sampler: wgpu::Sampler,
}

impl GpuLayerBlend {
    /// Create a new GPU layer blending engine
    pub fn new(device: &wgpu::Device) -> Self {
        // Create bind group layout
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Layer Blend Bind Group Layout"),
            entries: &[
                // Binding 0: Base texture (input)
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: false },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                // Binding 1: Layer texture (input)
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: false },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                // Binding 2: Mask texture (input, optional but always bound)
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: false },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                // Binding 3: Output texture (storage)
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::WriteOnly,
                        format: wgpu::TextureFormat::Rgba16Float,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                // Binding 4: Blend parameters (uniform)
                wgpu::BindGroupLayoutEntry {
                    binding: 4,
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

        // Load shader
        let shader_source = include_str!("layer_blend.wgsl");
        let shader_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Layer Blend Shader"),
            source: wgpu::ShaderSource::Wgsl(shader_source.into()),
        });

        // Create pipeline layout
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Layer Blend Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        // Create compute pipeline
        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("Layer Blend Pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader_module,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

        // Create sampler (for future extensions)
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("Layer Blend Sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });

        Self {
            pipeline,
            bind_group_layout,
            sampler,
        }
    }

    /// Encode layer blending operation into command encoder
    ///
    /// # Arguments
    /// * `encoder` - Command encoder to record commands into
    /// * `device` - GPU device for creating buffers
    /// * `base_texture` - Base texture view
    /// * `layer_texture` - Layer texture view to blend on top
    /// * `mask_texture` - Optional mask texture view (use dummy 1x1 white texture if None)
    /// * `output_texture` - Output texture view (must be Rgba16Float storage texture)
    /// * `params` - Blend parameters (opacity, blend mode, mask flags)
    /// * `width` - Texture width
    /// * `height` - Texture height
    pub fn encode_blend(
        &self,
        encoder: &mut wgpu::CommandEncoder,
        device: &wgpu::Device,
        base_texture: &wgpu::TextureView,
        layer_texture: &wgpu::TextureView,
        mask_texture: &wgpu::TextureView,
        output_texture: &wgpu::TextureView,
        params: &BlendParams,
        width: u32,
        height: u32,
    ) {
        // Create uniform buffer for parameters
        let params_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Layer Blend Params Buffer"),
            contents: bytemuck::bytes_of(params),
            usage: wgpu::BufferUsages::UNIFORM,
        });

        // Create bind group
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Layer Blend Bind Group"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(base_texture),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(layer_texture),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::TextureView(mask_texture),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: wgpu::BindingResource::TextureView(output_texture),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: params_buffer.as_entire_binding(),
                },
            ],
        });

        // Dispatch compute shader
        let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("Layer Blend Compute Pass"),
            timestamp_writes: None,
        });

        compute_pass.set_pipeline(&self.pipeline);
        compute_pass.set_bind_group(0, &bind_group, &[]);

        // Dispatch with 16x16 workgroups (matching shader workgroup_size)
        let workgroup_size_x = 16;
        let workgroup_size_y = 16;
        let dispatch_x = (width + workgroup_size_x - 1) / workgroup_size_x;
        let dispatch_y = (height + workgroup_size_y - 1) / workgroup_size_y;

        compute_pass.dispatch_workgroups(dispatch_x, dispatch_y, 1);
    }

    /// Blend two textures and return the result
    ///
    /// High-level API that handles texture creation and readback.
    /// For large textures (>8K), consider using tiled blending instead.
    ///
    /// # Arguments
    /// * `device` - GPU device
    /// * `queue` - GPU queue
    /// * `base_data` - Base image RGBA float data
    /// * `layer_data` - Layer image RGBA float data
    /// * `mask_data` - Optional mask image (grayscale, uses red channel)
    /// * `blend_mode` - Blend mode to use
    /// * `opacity` - Layer opacity (0.0-1.0)
    /// * `invert_mask` - Whether to invert the mask
    /// * `width` - Image width
    /// * `height` - Image height
    ///
    /// # Returns
    /// Blended image as RGBA float data
    pub fn blend_textures(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        base_data: &[f32],
        layer_data: &[f32],
        mask_data: Option<&[f32]>,
        blend_mode: BlendModeGpu,
        opacity: f32,
        invert_mask: bool,
        width: u32,
        height: u32,
    ) -> anyhow::Result<Vec<f32>> {
        // Validate input dimensions
        let expected_size = (width * height * 4) as usize;
        if base_data.len() != expected_size || layer_data.len() != expected_size {
            return Err(anyhow::anyhow!(
                "Input data size mismatch: expected {}, got base={}, layer={}",
                expected_size,
                base_data.len(),
                layer_data.len()
            ));
        }

        // Create textures
        let texture_size = wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        };

        let base_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Base Texture"),
            size: texture_size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba16Float,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        let layer_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Layer Texture"),
            size: texture_size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba16Float,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        let output_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Output Texture"),
            size: texture_size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba16Float,
            usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });

        // Upload base and layer data
        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &base_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            bytemuck::cast_slice(base_data),
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(width * 4 * std::mem::size_of::<f32>() as u32),
                rows_per_image: Some(height),
            },
            texture_size,
        );

        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &layer_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            bytemuck::cast_slice(layer_data),
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(width * 4 * std::mem::size_of::<f32>() as u32),
                rows_per_image: Some(height),
            },
            texture_size,
        );

        // Create or upload mask texture
        let mask_texture = if let Some(mask) = mask_data {
            let mask_tex = device.create_texture(&wgpu::TextureDescriptor {
                label: Some("Mask Texture"),
                size: texture_size,
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Rgba16Float,
                usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
                view_formats: &[],
            });

            queue.write_texture(
                wgpu::TexelCopyTextureInfo {
                    texture: &mask_tex,
                    mip_level: 0,
                    origin: wgpu::Origin3d::ZERO,
                    aspect: wgpu::TextureAspect::All,
                },
                bytemuck::cast_slice(mask),
                wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(width * 4 * std::mem::size_of::<f32>() as u32),
                    rows_per_image: Some(height),
                },
                texture_size,
            );

            mask_tex
        } else {
            // Create dummy 1x1 white texture for no mask
            let dummy_tex = device.create_texture(&wgpu::TextureDescriptor {
                label: Some("Dummy Mask Texture"),
                size: wgpu::Extent3d {
                    width: 1,
                    height: 1,
                    depth_or_array_layers: 1,
                },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Rgba16Float,
                usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
                view_formats: &[],
            });

            queue.write_texture(
                wgpu::TexelCopyTextureInfo {
                    texture: &dummy_tex,
                    mip_level: 0,
                    origin: wgpu::Origin3d::ZERO,
                    aspect: wgpu::TextureAspect::All,
                },
                bytemuck::cast_slice(&[1.0f32, 1.0, 1.0, 1.0]),
                wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(4 * std::mem::size_of::<f32>() as u32),
                    rows_per_image: Some(1),
                },
                wgpu::Extent3d {
                    width: 1,
                    height: 1,
                    depth_or_array_layers: 1,
                },
            );

            dummy_tex
        };

        // Create texture views
        let base_view = base_texture.create_view(&wgpu::TextureViewDescriptor::default());
        let layer_view = layer_texture.create_view(&wgpu::TextureViewDescriptor::default());
        let mask_view = mask_texture.create_view(&wgpu::TextureViewDescriptor::default());
        let output_view = output_texture.create_view(&wgpu::TextureViewDescriptor::default());

        // Create blend parameters
        let params = BlendParams {
            opacity,
            blend_mode: blend_mode as u32,
            has_mask: if mask_data.is_some() { 1 } else { 0 },
            invert_mask: if invert_mask { 1 } else { 0 },
        };

        // Encode blend operation
        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Layer Blend Encoder"),
        });

        self.encode_blend(
            &mut encoder,
            device,
            &base_view,
            &layer_view,
            &mask_view,
            &output_view,
            &params,
            width,
            height,
        );

        // Create staging buffer for readback
        let bytes_per_row = width * 4 * std::mem::size_of::<f32>() as u32;
        let padded_bytes_per_row = (bytes_per_row + 255) & !255; // Align to 256 bytes
        let buffer_size = (padded_bytes_per_row * height) as u64;

        let staging_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Staging Buffer"),
            size: buffer_size,
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        // Copy output texture to staging buffer
        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo {
                texture: &output_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::TexelCopyBufferInfo {
                buffer: &staging_buffer,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(padded_bytes_per_row),
                    rows_per_image: Some(height),
                },
            },
            texture_size,
        );

        // Submit and wait
        queue.submit(Some(encoder.finish()));

        // Read back data
        let buffer_slice = staging_buffer.slice(..);
        let (sender, receiver) = std::sync::mpsc::channel();
        buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
            sender.send(result).unwrap();
        });

        let _ = device.poll(wgpu::PollType::Wait);
        receiver.recv().unwrap()?;

        let data = buffer_slice.get_mapped_range();
        let mut result = vec![0.0f32; (width * height * 4) as usize];

        // Copy data, handling padding
        for y in 0..height {
            let src_offset = (y * padded_bytes_per_row) as usize;
            let dst_offset = (y * width * 4) as usize;
            let row_bytes = width as usize * 4 * std::mem::size_of::<f32>();

            let src_slice = &data[src_offset..src_offset + row_bytes];
            let dst_slice = &mut result[dst_offset..dst_offset + (width as usize * 4)];

            dst_slice.copy_from_slice(bytemuck::cast_slice(src_slice));
        }

        drop(data);
        staging_buffer.unmap();

        Ok(result)
    }

    /// Blend two large textures using tiling to avoid GPU memory exhaustion
    ///
    /// Automatically tiles the operation for textures larger than 8K resolution.
    /// This enables support for up to 16K textures as required by Requirement 17.5.
    ///
    /// # Arguments
    /// * `device` - GPU device
    /// * `queue` - GPU queue
    /// * `base_data` - Base image RGBA float data
    /// * `layer_data` - Layer image RGBA float data
    /// * `mask_data` - Optional mask image (grayscale, uses red channel)
    /// * `blend_mode` - Blend mode to use
    /// * `opacity` - Layer opacity (0.0-1.0)
    /// * `invert_mask` - Whether to invert the mask
    /// * `width` - Image width
    /// * `height` - Image height
    /// * `tile_size` - Tile size (default 4096 for 4K tiles)
    ///
    /// # Returns
    /// Blended image as RGBA float data
    pub fn blend_textures_tiled(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        base_data: &[f32],
        layer_data: &[f32],
        mask_data: Option<&[f32]>,
        blend_mode: BlendModeGpu,
        opacity: f32,
        invert_mask: bool,
        width: u32,
        height: u32,
        tile_size: u32,
    ) -> anyhow::Result<Vec<f32>> {
        // If texture is small enough, use non-tiled version
        if width <= tile_size && height <= tile_size {
            return self.blend_textures(
                device,
                queue,
                base_data,
                layer_data,
                mask_data,
                blend_mode,
                opacity,
                invert_mask,
                width,
                height,
            );
        }

        // Calculate number of tiles
        let tiles_x = (width + tile_size - 1) / tile_size;
        let tiles_y = (height + tile_size - 1) / tile_size;

        let mut result = vec![0.0f32; (width * height * 4) as usize];

        // Process each tile
        for tile_y in 0..tiles_y {
            for tile_x in 0..tiles_x {
                let x_start = tile_x * tile_size;
                let y_start = tile_y * tile_size;
                let x_end = (x_start + tile_size).min(width);
                let y_end = (y_start + tile_size).min(height);
                let tile_width = x_end - x_start;
                let tile_height = y_end - y_start;

                // Extract tile data
                let mut tile_base = Vec::with_capacity((tile_width * tile_height * 4) as usize);
                let mut tile_layer = Vec::with_capacity((tile_width * tile_height * 4) as usize);
                let mut tile_mask =
                    mask_data.map(|_| Vec::with_capacity((tile_width * tile_height * 4) as usize));

                for y in y_start..y_end {
                    for x in x_start..x_end {
                        let idx = ((y * width + x) * 4) as usize;
                        tile_base.extend_from_slice(&base_data[idx..idx + 4]);
                        tile_layer.extend_from_slice(&layer_data[idx..idx + 4]);
                        if let Some(mask) = mask_data {
                            tile_mask
                                .as_mut()
                                .unwrap()
                                .extend_from_slice(&mask[idx..idx + 4]);
                        }
                    }
                }

                // Blend tile
                let blended_tile = self.blend_textures(
                    device,
                    queue,
                    &tile_base,
                    &tile_layer,
                    tile_mask.as_deref(),
                    blend_mode,
                    opacity,
                    invert_mask,
                    tile_width,
                    tile_height,
                )?;

                // Copy tile back to result
                for y in 0..tile_height {
                    for x in 0..tile_width {
                        let src_idx = ((y * tile_width + x) * 4) as usize;
                        let dst_idx = (((y_start + y) * width + (x_start + x)) * 4) as usize;
                        result[dst_idx..dst_idx + 4]
                            .copy_from_slice(&blended_tile[src_idx..src_idx + 4]);
                    }
                }
            }
        }

        Ok(result)
    }

    /// Get recommended tile size based on available GPU memory
    ///
    /// Returns a conservative tile size that should work on most GPUs.
    /// For 16K textures, uses 4K tiles (4 tiles per dimension = 16 tiles total).
    pub fn recommended_tile_size() -> u32 {
        // 4K tiles are a good balance:
        // - 4096x4096 RGBA16Float = 128 MB per texture
        // - With base, layer, mask, output = ~512 MB total
        // - Most modern GPUs have 4GB+ VRAM, so this is safe
        4096
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blend_params_size() {
        // Verify 16-byte alignment
        assert_eq!(std::mem::size_of::<BlendParams>(), 16);
        assert_eq!(std::mem::align_of::<BlendParams>(), 4);
    }

    #[test]
    fn test_blend_mode_conversion() {
        use crate::material::layer::BlendMode;

        assert_eq!(BlendModeGpu::from(BlendMode::Normal) as u32, 0);
        assert_eq!(BlendModeGpu::from(BlendMode::Multiply) as u32, 1);
        assert_eq!(BlendModeGpu::from(BlendMode::Screen) as u32, 2);
        assert_eq!(BlendModeGpu::from(BlendMode::Overlay) as u32, 3);
        assert_eq!(BlendModeGpu::from(BlendMode::Add) as u32, 4);
        assert_eq!(BlendModeGpu::from(BlendMode::Subtract) as u32, 5);
        assert_eq!(BlendModeGpu::from(BlendMode::Divide) as u32, 6);
        assert_eq!(BlendModeGpu::from(BlendMode::Difference) as u32, 7);
        assert_eq!(BlendModeGpu::from(BlendMode::Darken) as u32, 8);
        assert_eq!(BlendModeGpu::from(BlendMode::Lighten) as u32, 9);
    }
}

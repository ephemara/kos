//! SVT PBR Tauri Commands - Multi-channel painting API
//!
//! Extends SVT with full PBR painting support:
//! - 5 channels: Albedo, Normal, Roughness, Metalness, Emission
//! - Blend modes: Normal, Multiply, Add, Overlay, Screen
//! - User-configurable resolution

use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::Mutex;

use super::pbr_engine::{PbrBrushParams, PbrChannel, SvtPbrEngine};
use super::PageTableManager;
use crate::gpu::device::GpuComputeDevice;

// ============================================================================
// SVT PBR INSTANCE
// ============================================================================

/// A registered SVT PBR instance with its engine and page manager
pub struct SvtPbrInstance {
    pub engine: SvtPbrEngine,
    pub manager: PageTableManager,
}

// ============================================================================
// GLOBAL REGISTRY
// ============================================================================

lazy_static! {
    static ref SVT_PBR_REGISTRY: Mutex<HashMap<u64, SvtPbrInstance>> = Mutex::new(HashMap::new());
    static ref NEXT_PBR_HANDLE: Mutex<u64> = Mutex::new(1000); // Start at 1000 to avoid conflicts with basic SVT
}

fn next_pbr_handle() -> u64 {
    let mut h = NEXT_PBR_HANDLE.lock().unwrap();
    let handle = *h;
    *h += 1;
    handle
}

// ============================================================================
// TS-FRIENDLY TYPES
// ============================================================================

/// Configuration for SVT PBR initialization
#[derive(serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SvtPbrConfig {
    pub virtual_width: Option<u32>,
    pub virtual_height: Option<u32>,
    pub physical_size: Option<u32>,
    pub tile_size: Option<u32>,
}

/// PBR stroke parameters from TypeScript
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PbrStrokeParams {
    pub center_uv: [f32; 2],
    pub radius: f32,
    #[serde(default = "default_hardness")]
    pub hardness: f32,
    #[serde(default = "default_flow")]
    pub flow: f32,
    #[serde(default)]
    pub blend_mode: u32,

    // Channel enables
    #[serde(default = "default_true")]
    pub albedo_enabled: bool,
    #[serde(default)]
    pub normal_enabled: bool,
    #[serde(default)]
    pub roughness_enabled: bool,
    #[serde(default)]
    pub metalness_enabled: bool,
    #[serde(default)]
    pub emission_enabled: bool,

    // Values
    #[serde(default = "default_white")]
    pub albedo_color: [f32; 4],
    #[serde(default = "default_half")]
    pub roughness_value: f32,
    #[serde(default)]
    pub metalness_value: f32,
    #[serde(default = "default_emission")]
    pub emission_color: [f32; 4],
    #[serde(default)]
    pub emission_strength: f32,
}

fn default_hardness() -> f32 {
    0.5
}
fn default_flow() -> f32 {
    1.0
}
fn default_true() -> bool {
    true
}
fn default_white() -> [f32; 4] {
    [1.0, 1.0, 1.0, 1.0]
}
fn default_half() -> f32 {
    0.5
}
fn default_emission() -> [f32; 4] {
    [1.0, 0.5, 0.0, 1.0]
}

/// Stats for the PBR SVT instance
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SvtPbrStats {
    pub virtual_width: u32,
    pub virtual_height: u32,
    pub physical_size: u32,
    pub tile_size: u32,
    pub loaded_tiles: u32,
    pub max_tiles: u32,
    pub channels: Vec<String>,
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Initialize a PBR SVT instance with 5 channels
///
/// Returns a handle to use for subsequent operations.
#[tauri::command]
pub fn svt_pbr_init(config: Option<SvtPbrConfig>) -> Result<u64, String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;
    let queue = &gpu_guard.queue;

    let config = config.unwrap_or_default();
    let virtual_width = config.virtual_width.unwrap_or(16384);
    let virtual_height = config.virtual_height.unwrap_or(16384);
    let physical_size = config.physical_size.unwrap_or(4096);
    let tile_size = config.tile_size.unwrap_or(128);

    // Create PBR engine
    let engine = SvtPbrEngine::new(
        device,
        virtual_width,
        virtual_height,
        physical_size,
        tile_size,
    );

    // Clear all channels to defaults
    engine.clear_all(device, queue);

    let manager = PageTableManager::new(virtual_width, physical_size, tile_size);

    let instance = SvtPbrInstance { engine, manager };

    let handle = next_pbr_handle();
    SVT_PBR_REGISTRY.lock().unwrap().insert(handle, instance);

    log::info!(
        "[SVT PBR] Initialized handle {} ({}x{} virtual, {}x{} physical, tile={})",
        handle,
        virtual_width,
        virtual_height,
        physical_size,
        physical_size,
        tile_size
    );

    Ok(handle)
}

/// Apply a PBR paint stroke to multiple channels at once
#[tauri::command]
pub fn svt_pbr_stroke(handle: u64, params: PbrStrokeParams) -> Result<(), String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;
    let queue = &gpu_guard.queue;

    let mut registry = SVT_PBR_REGISTRY.lock().unwrap();
    let instance = registry
        .get_mut(&handle)
        .ok_or_else(|| format!("SVT PBR handle {} not found", handle))?;

    // Request tiles in the brush region (center + 4 corners of bounding box)
    let r = params.radius;
    let tiles_to_load: Vec<(f32, f32)> = vec![
        (params.center_uv[0], params.center_uv[1]),
        (params.center_uv[0] - r, params.center_uv[1] - r),
        (params.center_uv[0] + r, params.center_uv[1] - r),
        (params.center_uv[0] - r, params.center_uv[1] + r),
        (params.center_uv[0] + r, params.center_uv[1] + r),
    ];

    let page_updates = instance.manager.request_tiles(tiles_to_load);

    // Upload page table updates to GPU
    if !page_updates.is_empty() {
        let mut page_data =
            vec![
                0u32;
                (instance.engine.virtual_width / instance.engine.tile_size).pow(2) as usize * 2
            ];

        // Fill with current state from manager
        for x in 0..(instance.engine.virtual_width / instance.engine.tile_size) {
            for y in 0..(instance.engine.virtual_width / instance.engine.tile_size) {
                if let Some((px, py)) = instance.manager.get_physical((x, y)) {
                    let idx = ((y * (instance.engine.virtual_width / instance.engine.tile_size)
                        + x)
                        * 2) as usize;
                    page_data[idx] = px;
                    page_data[idx + 1] = py;
                }
            }
        }

        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &instance.engine.page_table_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            bytemuck::cast_slice(&page_data),
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(
                    4 * 2 * (instance.engine.virtual_width / instance.engine.tile_size),
                ),
                rows_per_image: Some(instance.engine.virtual_width / instance.engine.tile_size),
            },
            wgpu::Extent3d {
                width: instance.engine.virtual_width / instance.engine.tile_size,
                height: instance.engine.virtual_width / instance.engine.tile_size,
                depth_or_array_layers: 1,
            },
        );
    }

    // Build GPU brush params
    let brush_params = PbrBrushParams {
        center_uv: params.center_uv,
        radius: params.radius,
        hardness: params.hardness,

        albedo_enabled: if params.albedo_enabled { 1.0 } else { 0.0 },
        normal_enabled: if params.normal_enabled { 1.0 } else { 0.0 },
        roughness_enabled: if params.roughness_enabled { 1.0 } else { 0.0 },
        metalness_enabled: if params.metalness_enabled { 1.0 } else { 0.0 },

        emission_enabled: if params.emission_enabled { 1.0 } else { 0.0 },
        blend_mode: params.blend_mode,
        flow: params.flow,
        _pad0: 0.0,

        albedo_color: params.albedo_color,
        normal_color: [0.5, 0.5, 1.0, 1.0], // Flat normal default
        roughness_value: params.roughness_value,
        metalness_value: params.metalness_value,
        emission_strength: params.emission_strength,
        _pad1: 0.0,

        emission_color: params.emission_color,

        virtual_size: instance.engine.virtual_width as f32,
        tile_size: instance.engine.tile_size as f32,
        _pad2: [0.0, 0.0],
    };

    // Dispatch stroke
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("SVT PBR Stroke Encoder"),
    });

    instance
        .engine
        .dispatch_stroke(device, queue, &mut encoder, &brush_params);

    queue.submit(std::iter::once(encoder.finish()));

    Ok(())
}

/// Export a specific channel as raw RGBA bytes
#[tauri::command]
pub fn svt_pbr_export_channel(handle: u64, channel: u32) -> Result<Vec<u8>, String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;
    let queue = &gpu_guard.queue;

    let registry = SVT_PBR_REGISTRY.lock().unwrap();
    let instance = registry
        .get(&handle)
        .ok_or_else(|| format!("SVT PBR handle {} not found", handle))?;

    let channel =
        PbrChannel::from_u32(channel).ok_or_else(|| format!("Invalid channel: {}", channel))?;

    let (texture, _) = instance.engine.get_channel_texture(channel);
    let physical_size = instance.engine.physical_size;

    let bytes_per_row = physical_size * 4;
    let padded_bytes_per_row = (bytes_per_row + 255) & !255;

    // Create staging buffer
    let staging_buffer = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("SVT PBR Export Staging"),
        size: (padded_bytes_per_row * physical_size) as u64,
        usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    });

    // Copy texture to buffer
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("SVT PBR Export"),
    });

    encoder.copy_texture_to_buffer(
        wgpu::TexelCopyTextureInfo {
            texture,
            mip_level: 0,
            origin: wgpu::Origin3d::ZERO,
            aspect: wgpu::TextureAspect::All,
        },
        wgpu::TexelCopyBufferInfo {
            buffer: &staging_buffer,
            layout: wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(padded_bytes_per_row),
                rows_per_image: Some(physical_size),
            },
        },
        wgpu::Extent3d {
            width: physical_size,
            height: physical_size,
            depth_or_array_layers: 1,
        },
    );

    queue.submit(std::iter::once(encoder.finish()));

    // Read back
    let buffer_slice = staging_buffer.slice(..);
    let (tx, rx) = std::sync::mpsc::channel();
    buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
        tx.send(result).unwrap();
    });

    let _ = device.poll(wgpu::PollType::Wait);
    rx.recv()
        .unwrap()
        .map_err(|e| format!("Map failed: {:?}", e))?;

    let data = buffer_slice.get_mapped_range();

    // Remove padding
    let mut pixels = Vec::with_capacity((physical_size * physical_size * 4) as usize);
    for y in 0..physical_size {
        let start = (y * padded_bytes_per_row) as usize;
        let end = start + (physical_size * 4) as usize;
        pixels.extend_from_slice(&data[start..end]);
    }

    drop(data);
    staging_buffer.unmap();

    Ok(pixels)
}

/// Clear a specific channel to its default value
#[tauri::command]
pub fn svt_pbr_clear_channel(handle: u64, channel: u32) -> Result<(), String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;
    let queue = &gpu_guard.queue;

    let registry = SVT_PBR_REGISTRY.lock().unwrap();
    let instance = registry
        .get(&handle)
        .ok_or_else(|| format!("SVT PBR handle {} not found", handle))?;

    let channel =
        PbrChannel::from_u32(channel).ok_or_else(|| format!("Invalid channel: {}", channel))?;

    instance.engine.clear_channel(device, queue, channel);

    log::info!(
        "[SVT PBR] Cleared channel {:?} for handle {}",
        channel,
        handle
    );

    Ok(())
}

/// Clear all channels to their default values
#[tauri::command]
pub fn svt_pbr_clear_all(handle: u64) -> Result<(), String> {
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;
    let queue = &gpu_guard.queue;

    let registry = SVT_PBR_REGISTRY.lock().unwrap();
    let instance = registry
        .get(&handle)
        .ok_or_else(|| format!("SVT PBR handle {} not found", handle))?;

    instance.engine.clear_all(device, queue);

    log::info!("[SVT PBR] Cleared all channels for handle {}", handle);

    Ok(())
}

/// Get stats about an SVT PBR instance
#[tauri::command]
pub fn svt_pbr_stats(handle: u64) -> Result<SvtPbrStats, String> {
    let registry = SVT_PBR_REGISTRY.lock().unwrap();
    let instance = registry
        .get(&handle)
        .ok_or_else(|| format!("SVT PBR handle {} not found", handle))?;

    Ok(SvtPbrStats {
        virtual_width: instance.engine.virtual_width,
        virtual_height: instance.engine.virtual_height,
        physical_size: instance.engine.physical_size,
        tile_size: instance.engine.tile_size,
        loaded_tiles: instance.manager.loaded_count() as u32,
        max_tiles: instance.manager.capacity(),
        channels: vec![
            "albedo".to_string(),
            "normal".to_string(),
            "roughness".to_string(),
            "metalness".to_string(),
            "emission".to_string(),
        ],
    })
}

/// Dispose an SVT PBR instance and free GPU resources
#[tauri::command]
pub fn svt_pbr_dispose(handle: u64) -> Result<(), String> {
    let mut registry = SVT_PBR_REGISTRY.lock().unwrap();

    if registry.remove(&handle).is_some() {
        log::info!("[SVT PBR] Disposed handle {}", handle);
        Ok(())
    } else {
        Err(format!("SVT PBR handle {} not found", handle))
    }
}

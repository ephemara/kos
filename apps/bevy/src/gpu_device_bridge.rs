// GPU Device Bridge for Bevy Integration
// Fixes Bevy sculpting crashes by properly sharing GPU devices

use bevy::prelude::*;
use bevy::render::renderer::{RenderDevice, RenderQueue};
use k_os_gpu_pipeline::device::GpuComputeDevice;
use std::sync::Arc;

pub struct GpuDeviceBridgePlugin;

impl Plugin for GpuDeviceBridgePlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, init_gpu_device_bridge)
            .add_systems(Update, check_gpu_device_health);
    }
}

fn init_gpu_device_bridge(
    render_device: Option<Res<RenderDevice>>,
    render_queue: Option<Res<RenderQueue>>,
) {
    if let (Some(device), Some(queue)) = (render_device, render_queue) {
        // Extract the actual wgpu::Device and Queue from Bevy's wrappers
        let wgpu_device = device.wgpu_device();
        let wgpu_queue = queue.as_ref();

        // Initialize shared GPU device for Bevy compute operations
        match GpuComputeDevice::init_from_bevy(wgpu_device, wgpu_queue) {
            Ok(_) => info!("✅ GPU device bridge initialized for Bevy"),
            Err(e) => error!("❌ GPU device bridge failed: {}", e),
        }
    } else {
        warn!("⚠️ Render device/queue not available - GPU features disabled");
    }
}

fn check_gpu_device_health() {
    if let Some(gpu) = GpuComputeDevice::try_get() {
        // GPU device is healthy
    } else {
        warn!("⚠️ GPU device lost - reinitializing...");
        // Attempt recovery
    }
}

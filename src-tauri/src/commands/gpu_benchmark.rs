//! Thin Tauri adapter for GPU benchmark commands.

use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Serialize, Deserialize)]
pub struct GpuBenchmarkResult {
    pub gpu_name: String,
    pub vertex_count: u32,
    pub stroke_count: u32,
    pub total_time_ms: f64,
    pub time_per_stroke_ms: f64,
    pub vertices_per_second: f64,
    pub success: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub fn gpu_sculpt_benchmark(vertex_count: u32, stroke_count: u32) -> GpuBenchmarkResult {
    use k_os_gpu_pipeline::device::GpuComputeDevice;
    use k_os_gpu_pipeline::sculpt::{BrushParams, GpuSculptCompute, SculptOp};

    let vertex_count = if vertex_count == 0 {
        100_000
    } else {
        vertex_count
    };
    let stroke_count = if stroke_count == 0 { 100 } else { stroke_count };

    let gpu = match GpuComputeDevice::get_or_init_blocking() {
        Ok(g) => g,
        Err(e) => {
            return GpuBenchmarkResult {
                gpu_name: "FAILED".to_string(),
                vertex_count,
                stroke_count,
                total_time_ms: 0.0,
                time_per_stroke_ms: 0.0,
                vertices_per_second: 0.0,
                success: false,
                error: Some(format!("GPU init failed: {e}")),
            };
        }
    };

    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;
    let queue = &gpu_guard.queue;
    let gpu_name = gpu_guard.adapter_info.name.clone();

    let compute = GpuSculptCompute::new(device, queue);
    let mut positions: Vec<f32> = Vec::with_capacity(vertex_count as usize * 3);
    let mut normals: Vec<f32> = Vec::with_capacity(vertex_count as usize * 3);

    for i in 0..vertex_count {
        let phi = (i as f32 / vertex_count as f32) * std::f32::consts::PI * 2.0;
        let theta = ((i as f32).sqrt() / (vertex_count as f32).sqrt()) * std::f32::consts::PI;

        let x = theta.sin() * phi.cos();
        let y = theta.cos();
        let z = theta.sin() * phi.sin();

        positions.extend_from_slice(&[x, y, z]);
        normals.extend_from_slice(&[x, y, z]);
    }

    let mesh = match compute.create_mesh_buffers(device, &positions, &normals) {
        Ok(m) => m,
        Err(e) => {
            return GpuBenchmarkResult {
                gpu_name,
                vertex_count,
                stroke_count,
                total_time_ms: 0.0,
                time_per_stroke_ms: 0.0,
                vertices_per_second: 0.0,
                success: false,
                error: Some(format!("Buffer creation failed: {e}")),
            };
        }
    };

    let start = Instant::now();

    for i in 0..stroke_count {
        let angle = (i as f32 / stroke_count as f32) * std::f32::consts::PI * 2.0;
        let brush_pos = [angle.cos() * 0.5, 0.0, angle.sin() * 0.5];
        let params = BrushParams::new(brush_pos, [0.0, 1.0, 0.0], 0.3, 0.05);

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("gpu_benchmark_encoder"),
        });

        compute.encode_apply_brush_all(
            device,
            queue,
            &mut encoder,
            &mesh,
            params,
            SculptOp::Clay,
            None,
        );

        queue.submit(std::iter::once(encoder.finish()));
    }

    let _ = device.poll(wgpu::PollType::Wait);

    let elapsed = start.elapsed();
    let total_time_ms = elapsed.as_secs_f64() * 1000.0;
    let time_per_stroke_ms = total_time_ms / stroke_count as f64;
    let vertices_per_second = (vertex_count as f64 * stroke_count as f64) / elapsed.as_secs_f64();

    GpuBenchmarkResult {
        gpu_name,
        vertex_count,
        stroke_count,
        total_time_ms,
        time_per_stroke_ms,
        vertices_per_second,
        success: true,
        error: None,
    }
}

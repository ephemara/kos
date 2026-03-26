use crate::config::KainConfig;
use k_os_kain::{generated_spirv_for_domain, KainDomain};
use k_os_renderer::{
    RenderGraph, RenderGraphExecutionContext, RenderGraphExecutionReport, ShadingMode,
};

pub struct KainRuntime {
    config: KainConfig,
    render_graph: RenderGraph,
    last_report: Option<RenderGraphExecutionReport>,
    last_error: Option<String>,
    frame_counter: u64,
    renderer_shader_count: usize,
}

impl KainRuntime {
    pub fn new(config: KainConfig) -> Self {
        let renderer_shader_count = generated_spirv_for_domain(KainDomain::Renderer).len();
        let mut runtime = Self {
            config,
            render_graph: RenderGraph::default(),
            last_report: None,
            last_error: None,
            frame_counter: 0,
            renderer_shader_count,
        };

        if runtime.config.validate_catalog_on_startup {
            let missing = runtime.render_graph.validate_catalog();
            if !missing.is_empty() {
                runtime.last_error = Some(format!(
                    "Missing renderer shader bindings: {}",
                    missing.join(", ")
                ));
            }
        }

        runtime
    }

    pub fn tick(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        viewport_width: u32,
        viewport_height: u32,
        vertex_count: u32,
        index_count: u32,
    ) {
        self.frame_counter = self.frame_counter.saturating_add(1);
        if !self.config.enable_dispatch {
            return;
        }
        if self.frame_counter % self.config.dispatch_interval_frames != 0 {
            return;
        }

        let ctx = RenderGraphExecutionContext {
            viewport_width: viewport_width.max(1),
            viewport_height: viewport_height.max(1),
            vertex_count: vertex_count.max(3),
            index_count: index_count.max(3),
            face_count: (index_count / 3).max(1),
            instance_count: 4,
            shading_mode: ShadingMode::Solid,
            allow_gpu_dispatch: true,
        };

        match self.render_graph.execute(device, queue, &ctx) {
            Ok(report) => {
                self.last_error = None;
                self.last_report = Some(report);
            }
            Err(error) => {
                self.last_error = Some(error);
            }
        }
    }

    pub fn title_suffix(&self) -> String {
        if let Some(report) = &self.last_report {
            format!(
                "KAIN {} pass(es) // {:.2}ms // {} KB",
                report.dispatched_passes.len(),
                report.duration.as_secs_f64() * 1000.0,
                report.allocated_bytes / 1024
            )
        } else if let Some(error) = &self.last_error {
            format!("KAIN degraded // {error}")
        } else if !self.config.enable_dispatch {
            format!(
                "KAIN staged // {} renderer shader(s) registered",
                self.renderer_shader_count
            )
        } else {
            format!(
                "KAIN warming // {} renderer shader(s)",
                self.renderer_shader_count
            )
        }
    }

    pub fn accent(&self, time_seconds: f32) -> [f32; 4] {
        let pass_factor = self
            .last_report
            .as_ref()
            .map(|report| report.dispatched_passes.len() as f32 / 8.0)
            .unwrap_or(0.35);
        let pulse = 0.55 + (time_seconds * 0.9).sin() * 0.25;
        let strength = (pass_factor * pulse).clamp(0.15, 1.0);
        [
            0.18 + 0.28 * strength,
            0.64 + 0.22 * strength,
            0.72 + 0.18 * strength,
            1.0,
        ]
    }
}

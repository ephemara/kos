use bevy::prelude::*;
use bevy::render::renderer::{RenderDevice, RenderQueue};
use bevy_egui::{egui, EguiContexts, EguiPrimaryContextPass};
use k_os_kain::{generated_spirv_by_id, validate_all_shaders_for_domain, KainDomain};
use serde::Deserialize;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use wgpu::util::DeviceExt;

const DEFAULT_CONFIG_PATH: &str = "config/supermotion_probe.toml";
const DEFAULT_SHADER_ID: &str = "mocap_supermotion_livelink";
const DEFAULT_MODES_PATH: &str = "../k-os-kain/domains/supermotion/mocap_supermotion_modes.json";
const DEFAULT_UI_SCHEMA_PATH: &str =
    "../k-os-kain/domains/supermotion/mocap_supermotion_ui_schema.json";

pub struct SupermotionLabPlugin;

impl Plugin for SupermotionLabPlugin {
    fn build(&self, app: &mut App) {
        let bootstrap = SupermotionBootstrap::load();
        app.insert_resource(bootstrap.config)
            .insert_resource(bootstrap.state)
            .insert_resource(bootstrap.kernel)
            .add_systems(EguiPrimaryContextPass, supermotion_probe_ui_system)
            .add_systems(Update, supermotion_probe_tick_system)
            .add_systems(Update, draw_supermotion_probe_gizmos);
    }
}

struct SupermotionBootstrap {
    config: SupermotionProbeConfig,
    state: SupermotionProbeState,
    kernel: SupermotionProbeKernel,
}

impl SupermotionBootstrap {
    fn load() -> Self {
        let config = SupermotionProbeConfig::load();
        let modes = load_json::<ModesRegistry>(&config.modes_path).unwrap_or_else(|err| {
            warn!("Supermotion probe failed to load modes registry: {err}");
            ModesRegistry::default()
        });
        let ui_schema = load_json::<UiSchema>(&config.ui_schema_path).unwrap_or_else(|err| {
            warn!("Supermotion probe failed to load UI schema: {err}");
            UiSchema::default()
        });

        let validation = validate_all_shaders_for_domain(KainDomain::Supermotion);
        let validation_passed = validation.iter().filter(|result| result.success).count();
        let validation_summary = format!(
            "{validation_passed}/{} supermotion shaders validated",
            validation.len()
        );

        let mut state = SupermotionProbeState::from_config(&config, modes, ui_schema, validation_summary);
        let mut kernel = SupermotionProbeKernel::default();

        match generated_spirv_by_id(&config.shader_id) {
            Some(shader) => {
                state.shader_label = shader.label.to_string();
                state.shader_compiled_path = shader.compiled_path.to_string();
                match compile_spirv_shader(shader.bytes) {
                    Ok(compiled) => {
                        state.entry_point = compiled.entry_point.clone();
                        state.workgroup_size = compiled.workgroup_size;
                        state.last_summary = format!(
                            "Shader ready: {} [{}x{}x{}]",
                            state.entry_point,
                            state.workgroup_size[0],
                            state.workgroup_size[1],
                            state.workgroup_size[2]
                        );
                        kernel.shader_id = config.shader_id.clone();
                        kernel.entry_point = compiled.entry_point;
                        kernel.workgroup_size = compiled.workgroup_size;
                        kernel.wgsl_source = compiled.wgsl;
                    }
                    Err(err) => {
                        state.last_error = Some(err.clone());
                        state.last_summary = "Shader bootstrap failed".to_string();
                    }
                }
            }
            None => {
                state.last_error = Some(format!(
                    "Embedded Kain SPIR-V asset not found: {}",
                    config.shader_id
                ));
                state.last_summary = "Shader asset missing".to_string();
            }
        }

        Self {
            config,
            state,
            kernel,
        }
    }
}

#[derive(Resource, Clone)]
struct SupermotionProbeConfig {
    config_path: PathBuf,
    shader_id: String,
    modes_path: PathBuf,
    ui_schema_path: PathBuf,
    joint_count: u32,
    default_mode_id: i32,
    auto_run: bool,
    auto_run_hz: f32,
    chain_spacing: f32,
    base_height: f32,
    lateral_wave: f32,
    depth_wave: f32,
    prev_lag: f32,
    floor_y: f32,
    global_intensity: f32,
    random_seed: f32,
    eps: f32,
}

impl SupermotionProbeConfig {
    fn load() -> Self {
        let lab_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let config_path = std::env::var("KOS_SUPERMOTION_PROBE_CONFIG")
            .map(PathBuf::from)
            .unwrap_or_else(|_| lab_root.join(DEFAULT_CONFIG_PATH));

        let file = if config_path.is_file() {
            match fs::read_to_string(&config_path) {
                Ok(raw) => toml::from_str::<SupermotionProbeFile>(&raw).unwrap_or_else(|err| {
                    warn!(
                        "Supermotion probe config parse failed for {}: {err}",
                        config_path.display()
                    );
                    SupermotionProbeFile::default()
                }),
                Err(err) => {
                    warn!(
                        "Supermotion probe config read failed for {}: {err}",
                        config_path.display()
                    );
                    SupermotionProbeFile::default()
                }
            }
        } else {
            SupermotionProbeFile::default()
        };

        Self {
            config_path,
            shader_id: file
                .shader_id
                .unwrap_or_else(|| DEFAULT_SHADER_ID.to_string()),
            modes_path: resolve_path(
                &lab_root,
                file.modes_path
                    .as_deref()
                    .unwrap_or(DEFAULT_MODES_PATH),
            ),
            ui_schema_path: resolve_path(
                &lab_root,
                file.ui_schema_path
                    .as_deref()
                    .unwrap_or(DEFAULT_UI_SCHEMA_PATH),
            ),
            joint_count: file.joint_count.unwrap_or(24).max(2),
            default_mode_id: file.default_mode_id.unwrap_or(4),
            auto_run: file.auto_run.unwrap_or(true),
            auto_run_hz: file.auto_run_hz.unwrap_or(6.0).clamp(0.25, 60.0),
            chain_spacing: file.chain_spacing.unwrap_or(0.22),
            base_height: file.base_height.unwrap_or(-1.5),
            lateral_wave: file.lateral_wave.unwrap_or(0.18),
            depth_wave: file.depth_wave.unwrap_or(0.12),
            prev_lag: file.prev_lag.unwrap_or(0.08).max(0.001),
            floor_y: file.floor_y.unwrap_or(-2.5),
            global_intensity: file.global_intensity.unwrap_or(1.0),
            random_seed: file.random_seed.unwrap_or(0.37),
            eps: file.eps.unwrap_or(0.0001).max(0.000001),
        }
    }
}

#[derive(Debug, Deserialize, Default)]
struct SupermotionProbeFile {
    shader_id: Option<String>,
    modes_path: Option<String>,
    ui_schema_path: Option<String>,
    joint_count: Option<u32>,
    default_mode_id: Option<i32>,
    auto_run: Option<bool>,
    auto_run_hz: Option<f32>,
    chain_spacing: Option<f32>,
    base_height: Option<f32>,
    lateral_wave: Option<f32>,
    depth_wave: Option<f32>,
    prev_lag: Option<f32>,
    floor_y: Option<f32>,
    global_intensity: Option<f32>,
    random_seed: Option<f32>,
    eps: Option<f32>,
}

#[derive(Debug, Clone, Deserialize, Default)]
struct ModesRegistry {
    #[serde(default)]
    shader: String,
    #[serde(default)]
    modes: Vec<ModeEntry>,
}

#[derive(Debug, Clone, Deserialize, Default)]
struct ModeEntry {
    id: i32,
    name: String,
}

#[derive(Debug, Clone, Deserialize, Default)]
struct UiSchema {
    #[serde(default)]
    shader: String,
    #[serde(default)]
    global_params: Vec<UiParam>,
    #[serde(default)]
    mode_ui: Vec<ModeUi>,
}

#[derive(Debug, Clone, Deserialize, Default)]
struct ModeUi {
    id: i32,
    name: String,
    #[serde(default)]
    group: String,
    #[serde(default)]
    params: Vec<UiParam>,
}

#[derive(Debug, Clone, Deserialize, Default)]
struct UiParam {
    key: String,
    label: String,
    min: f32,
    max: f32,
    default: f32,
    #[serde(default)]
    tooltip: Option<String>,
}

#[derive(Debug, Clone)]
struct CompiledSpirvShader {
    entry_point: String,
    workgroup_size: [u32; 3],
    wgsl: String,
}

#[derive(Resource)]
struct SupermotionProbeState {
    shader_id: String,
    shader_label: String,
    shader_compiled_path: String,
    entry_point: String,
    workgroup_size: [u32; 3],
    validation_summary: String,
    config_path: PathBuf,
    modes_path: PathBuf,
    ui_schema_path: PathBuf,
    modes: Vec<ModeEntry>,
    mode_ui: Vec<ModeUi>,
    global_params: Vec<UiParam>,
    values: BTreeMap<String, f32>,
    selected_mode_id: i32,
    joint_count: u32,
    auto_run: bool,
    auto_run_hz: f32,
    auto_timer: Timer,
    run_requested: bool,
    chain_spacing: f32,
    base_height: f32,
    lateral_wave: f32,
    depth_wave: f32,
    prev_lag: f32,
    show_input_chain: bool,
    show_output_chain: bool,
    last_dispatch: UVec3,
    last_run_duration_ms: f32,
    last_summary: String,
    last_error: Option<String>,
    input_positions: Vec<Vec3>,
    output_positions: Vec<Vec3>,
    output_rotations: Vec<Quat>,
    parent_indices: Vec<i32>,
}

impl SupermotionProbeState {
    fn from_config(
        config: &SupermotionProbeConfig,
        modes: ModesRegistry,
        ui_schema: UiSchema,
        validation_summary: String,
    ) -> Self {
        let mut values = BTreeMap::new();
        for param in &ui_schema.global_params {
            values.insert(param.key.clone(), param.default);
        }
        for mode in &ui_schema.mode_ui {
            for param in &mode.params {
                values.entry(param.key.clone()).or_insert(param.default);
            }
        }

        values.insert("global_intensity".to_string(), config.global_intensity);
        values.insert("floor_y".to_string(), config.floor_y);
        values.insert("random_seed".to_string(), config.random_seed);
        values.insert("eps".to_string(), config.eps);
        values.entry("a.w".to_string()).or_insert(0.01);

        let auto_timer = Timer::from_seconds(1.0 / config.auto_run_hz, TimerMode::Repeating);
        let selected_mode_id = if modes.modes.iter().any(|mode| mode.id == config.default_mode_id) {
            config.default_mode_id
        } else {
            modes.modes.first().map(|mode| mode.id).unwrap_or(0)
        };

        Self {
            shader_id: config.shader_id.clone(),
            shader_label: String::new(),
            shader_compiled_path: String::new(),
            entry_point: String::new(),
            workgroup_size: [1, 1, 1],
            validation_summary,
            config_path: config.config_path.clone(),
            modes_path: config.modes_path.clone(),
            ui_schema_path: config.ui_schema_path.clone(),
            modes: modes.modes,
            mode_ui: ui_schema.mode_ui,
            global_params: ui_schema.global_params,
            values,
            selected_mode_id,
            joint_count: config.joint_count,
            auto_run: config.auto_run,
            auto_run_hz: config.auto_run_hz,
            auto_timer,
            run_requested: true,
            chain_spacing: config.chain_spacing,
            base_height: config.base_height,
            lateral_wave: config.lateral_wave,
            depth_wave: config.depth_wave,
            prev_lag: config.prev_lag,
            show_input_chain: true,
            show_output_chain: true,
            last_dispatch: UVec3::ONE,
            last_run_duration_ms: 0.0,
            last_summary: "Waiting for GPU device".to_string(),
            last_error: None,
            input_positions: Vec::new(),
            output_positions: Vec::new(),
            output_rotations: Vec::new(),
            parent_indices: Vec::new(),
        }
    }

    fn mode_name(&self, mode_id: i32) -> &str {
        self.modes
            .iter()
            .find(|mode| mode.id == mode_id)
            .map(|mode| mode.name.as_str())
            .unwrap_or("unknown")
    }

    fn active_mode_ui(&self) -> Option<&ModeUi> {
        self.mode_ui
            .iter()
            .find(|mode_ui| mode_ui.id == self.selected_mode_id)
    }

    fn value(&self, key: &str) -> f32 {
        self.values.get(key).copied().unwrap_or(0.0)
    }

    fn set_value(&mut self, key: &str, value: f32) {
        self.values.insert(key.to_string(), value);
    }

    fn reset_active_mode_defaults(&mut self) {
        if let Some(mode_ui) = self.active_mode_ui().cloned() {
            for param in mode_ui.params {
                self.values.insert(param.key, param.default);
            }
        }
        self.run_requested = true;
    }

    fn retime_auto_run(&mut self) {
        self.auto_timer = Timer::from_seconds(1.0 / self.auto_run_hz.max(0.25), TimerMode::Repeating);
    }

    fn build_dispatch_input(&self, elapsed_seconds: f32) -> SupermotionDispatchInput {
        SupermotionDispatchInput {
            shader_id: self.shader_id.clone(),
            joint_count: self.joint_count.max(2),
            selected_mode_id: self.selected_mode_id,
            workgroup_size: self.workgroup_size,
            phase_step: self.value("a.w"),
            floor_y: self.value("floor_y"),
            global_intensity: self.value("global_intensity"),
            random_seed: self.value("random_seed"),
            eps: self.value("eps").max(0.000001),
            chain_spacing: self.chain_spacing,
            base_height: self.base_height,
            lateral_wave: self.lateral_wave,
            depth_wave: self.depth_wave,
            prev_lag: self.prev_lag.max(0.001),
            elapsed_seconds,
            values: self.values.clone(),
        }
    }
}

#[derive(Resource, Default)]
struct SupermotionProbeKernel {
    shader_id: String,
    entry_point: String,
    workgroup_size: [u32; 3],
    wgsl_source: String,
    bind_group_layout: Option<wgpu::BindGroupLayout>,
    pipeline: Option<wgpu::ComputePipeline>,
}

#[derive(Debug, Clone)]
struct SupermotionDispatchInput {
    shader_id: String,
    joint_count: u32,
    selected_mode_id: i32,
    workgroup_size: [u32; 3],
    phase_step: f32,
    floor_y: f32,
    global_intensity: f32,
    random_seed: f32,
    eps: f32,
    chain_spacing: f32,
    base_height: f32,
    lateral_wave: f32,
    depth_wave: f32,
    prev_lag: f32,
    elapsed_seconds: f32,
    values: BTreeMap<String, f32>,
}

#[derive(Debug)]
struct SupermotionDispatchOutput {
    input_positions: Vec<Vec3>,
    output_positions: Vec<Vec3>,
    output_rotations: Vec<Quat>,
    parent_indices: Vec<i32>,
    dispatch: UVec3,
    duration_ms: f32,
}

fn supermotion_probe_ui_system(mut contexts: EguiContexts, mut state: ResMut<SupermotionProbeState>) {
    let Ok(ctx) = contexts.ctx_mut() else {
        return;
    };

    let mut ui_changed = false;

    egui::Window::new("Supermotion Lab")
        .default_width(420.0)
        .default_pos(egui::pos2(18.0, 80.0))
        .show(ctx, |ui| {
            ui.label(format!("Shader: {}", state.shader_id));
            if !state.shader_label.is_empty() {
                ui.label(format!("Label: {}", state.shader_label));
            }
            if !state.entry_point.is_empty() {
                ui.label(format!(
                    "Entry: {} [{}x{}x{}]",
                    state.entry_point,
                    state.workgroup_size[0],
                    state.workgroup_size[1],
                    state.workgroup_size[2]
                ));
            }
            ui.label(state.validation_summary.clone());
            ui.small(format!("Config: {}", state.config_path.display()));
            ui.small(format!("Modes: {}", state.modes_path.display()));
            ui.small(format!("UI Schema: {}", state.ui_schema_path.display()));
            if !state.shader_compiled_path.is_empty() {
                ui.small(format!("SPV: {}", state.shader_compiled_path));
            }

            ui.separator();

            ui.horizontal(|ui| {
                if ui.button("Run Probe").clicked() {
                    state.run_requested = true;
                }
                if ui.button("Reset Mode Defaults").clicked() {
                    state.reset_active_mode_defaults();
                    ui_changed = true;
                }
            });

            ui.horizontal(|ui| {
                ui.checkbox(&mut state.auto_run, "Auto Run");
                let hz = &mut state.auto_run_hz;
                if ui
                    .add(egui::Slider::new(hz, 0.25..=30.0).text("Hz"))
                    .changed()
                {
                    state.retime_auto_run();
                }
            });

            let before_mode = state.selected_mode_id;
            egui::ComboBox::from_id_salt("supermotion_mode")
                .selected_text(state.mode_name(state.selected_mode_id))
                .show_ui(ui, |ui| {
                    let modes = state.modes.clone();
                    for mode in modes {
                        ui.selectable_value(&mut state.selected_mode_id, mode.id, &mode.name);
                    }
                });
            if before_mode != state.selected_mode_id {
                state.reset_active_mode_defaults();
                ui_changed = true;
            }

            ui.separator();
            ui.collapsing("Synthetic Chain Feed", |ui| {
                ui_changed |= ui
                    .add(egui::Slider::new(&mut state.joint_count, 2..=128).text("Joint Count"))
                    .changed();
                ui_changed |= ui
                    .add(egui::Slider::new(&mut state.base_height, -5.0..=5.0).text("Base Height"))
                    .changed();
                ui_changed |= ui
                    .add(egui::Slider::new(&mut state.chain_spacing, 0.05..=1.0).text("Chain Spacing"))
                    .changed();
                ui_changed |= ui
                    .add(egui::Slider::new(&mut state.lateral_wave, 0.0..=2.0).text("Lateral Wave"))
                    .changed();
                ui_changed |= ui
                    .add(egui::Slider::new(&mut state.depth_wave, 0.0..=2.0).text("Depth Wave"))
                    .changed();
                ui_changed |= ui
                    .add(egui::Slider::new(&mut state.prev_lag, 0.001..=0.5).text("Prev Lag"))
                    .changed();
                ui.checkbox(&mut state.show_input_chain, "Draw Input Chain");
                ui.checkbox(&mut state.show_output_chain, "Draw Output Chain");
            });

            ui.separator();
            ui.collapsing("Global Shader Params", |ui| {
                let params = state.global_params.clone();
                for param in params {
                    let mut value = state.value(&param.key);
                    let changed = ui
                        .add(
                            egui::Slider::new(&mut value, param.min..=param.max)
                                .text(param.label.clone()),
                        )
                        .changed();
                    if changed {
                        state.set_value(&param.key, value);
                        ui_changed = true;
                    }
                    if let Some(tooltip) = &param.tooltip {
                        ui.small(tooltip);
                    }
                }

                let mut random_seed = state.value("random_seed");
                if ui
                    .add(egui::Slider::new(&mut random_seed, 0.0..=8.0).text("Random Seed"))
                    .changed()
                {
                    state.set_value("random_seed", random_seed);
                    ui_changed = true;
                }

                let mut eps = state.value("eps");
                if ui
                    .add(egui::Slider::new(&mut eps, 0.000001..=0.05).text("Epsilon"))
                    .changed()
                {
                    state.set_value("eps", eps);
                    ui_changed = true;
                }
            });

            if let Some(mode_ui) = state.active_mode_ui().cloned() {
                ui.separator();
                ui.collapsing(
                    format!("Mode Params: {} ({})", mode_ui.name, mode_ui.group),
                    |ui| {
                        if mode_ui.params.is_empty() {
                            ui.label("This mode has no extra controls.");
                        }
                        for param in mode_ui.params {
                            let mut value = state.value(&param.key);
                            let changed = ui
                                .add(
                                    egui::Slider::new(&mut value, param.min..=param.max)
                                        .text(param.label.clone()),
                                )
                                .changed();
                            if changed {
                                state.set_value(&param.key, value);
                                ui_changed = true;
                            }
                            if let Some(tooltip) = &param.tooltip {
                                ui.small(tooltip);
                            }
                        }
                    },
                );
            }

            ui.separator();
            ui.label(format!(
                "Dispatch: {} x {} x {}",
                state.last_dispatch.x, state.last_dispatch.y, state.last_dispatch.z
            ));
            ui.label(format!("Last GPU run: {:.2} ms", state.last_run_duration_ms));
            ui.label(state.last_summary.clone());
            if let Some(err) = &state.last_error {
                ui.colored_label(egui::Color32::from_rgb(255, 120, 120), err);
            }
            if let Some(root) = state.output_positions.first() {
                ui.small(format!(
                    "Root Out: {:.3}, {:.3}, {:.3}",
                    root.x, root.y, root.z
                ));
            }
            if let Some(quat) = state.output_rotations.first() {
                ui.small(format!(
                    "Root Rot: {:.3}, {:.3}, {:.3}, {:.3}",
                    quat.x, quat.y, quat.z, quat.w
                ));
            }
        });

    if ui_changed {
        state.run_requested = true;
    }
}

fn supermotion_probe_tick_system(
    time: Res<Time>,
    render_device: Option<Res<RenderDevice>>,
    render_queue: Option<Res<RenderQueue>>,
    mut state: ResMut<SupermotionProbeState>,
    mut kernel: ResMut<SupermotionProbeKernel>,
) {
    state.auto_timer.tick(time.delta());
    let should_run = state.run_requested || (state.auto_run && state.auto_timer.just_finished());
    if !should_run {
        return;
    }

    let (Some(render_device), Some(render_queue)) = (render_device, render_queue) else {
        state.last_summary = "Waiting for Bevy render device".to_string();
        return;
    };

    state.run_requested = false;

    let device = render_device.wgpu_device();
    let queue = render_queue.as_ref();
    if let Err(err) = ensure_supermotion_pipeline(device, &mut kernel) {
        state.last_error = Some(err.clone());
        state.last_summary = "Pipeline creation failed".to_string();
        return;
    }

    let input = state.build_dispatch_input(time.elapsed_secs());
    match run_supermotion_probe(device, queue, &kernel, &input) {
        Ok(output) => {
            state.last_error = None;
            state.last_dispatch = output.dispatch;
            state.last_run_duration_ms = output.duration_ms;
            state.last_summary = format!(
                "{} mode on {} joints completed",
                state.mode_name(state.selected_mode_id),
                state.joint_count
            );
            state.input_positions = output.input_positions;
            state.output_positions = output.output_positions;
            state.output_rotations = output.output_rotations;
            state.parent_indices = output.parent_indices;
        }
        Err(err) => {
            state.last_error = Some(err.clone());
            state.last_summary = "Probe dispatch failed".to_string();
        }
    }
}

fn draw_supermotion_probe_gizmos(mut gizmos: Gizmos, state: Res<SupermotionProbeState>) {
    if state.parent_indices.is_empty() {
        return;
    }

    if state.show_input_chain {
        draw_chain_lines(
            &mut gizmos,
            &state.input_positions,
            &state.parent_indices,
            Color::srgb(0.25, 0.65, 1.0),
        );
    }

    if state.show_output_chain {
        draw_chain_lines(
            &mut gizmos,
            &state.output_positions,
            &state.parent_indices,
            Color::srgb(1.0, 0.45, 0.2),
        );
    }
}

fn draw_chain_lines(gizmos: &mut Gizmos, positions: &[Vec3], parents: &[i32], color: Color) {
    for (joint_index, parent) in parents.iter().enumerate() {
        if *parent < 0 {
            continue;
        }
        let parent_index = *parent as usize;
        if let (Some(&joint), Some(&parent_pos)) = (positions.get(joint_index), positions.get(parent_index)) {
            gizmos.line(parent_pos, joint, color);
        }
    }
}

fn ensure_supermotion_pipeline(
    device: &wgpu::Device,
    kernel: &mut SupermotionProbeKernel,
) -> Result<(), String> {
    if kernel.pipeline.is_some() && kernel.bind_group_layout.is_some() {
        return Ok(());
    }

    let bind_group_layout = create_supermotion_bind_group_layout(device);
    let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: Some("supermotion_probe_pipeline_layout"),
        bind_group_layouts: &[&bind_group_layout],
        push_constant_ranges: &[],
    });

    let shader_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some("supermotion_probe_shader_module"),
        source: wgpu::ShaderSource::Wgsl(kernel.wgsl_source.clone().into()),
    });

    let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
        label: Some("supermotion_probe_pipeline"),
        layout: Some(&pipeline_layout),
        module: &shader_module,
        entry_point: Some(&kernel.entry_point),
        compilation_options: Default::default(),
        cache: None,
    });

    kernel.bind_group_layout = Some(bind_group_layout);
    kernel.pipeline = Some(pipeline);
    Ok(())
}

fn run_supermotion_probe(
    device: &wgpu::Device,
    queue: &wgpu::Queue,
    kernel: &SupermotionProbeKernel,
    input: &SupermotionDispatchInput,
) -> Result<SupermotionDispatchOutput, String> {
    let pipeline = kernel
        .pipeline
        .as_ref()
        .ok_or_else(|| "Supermotion compute pipeline is not initialized".to_string())?;
    let bind_group_layout = kernel
        .bind_group_layout
        .as_ref()
        .ok_or_else(|| "Supermotion bind group layout is not initialized".to_string())?;

    let synthetic_chain = build_synthetic_chain(input);
    let joint_count = input.joint_count as usize;
    let out_bytes = (joint_count * std::mem::size_of::<[f32; 4]>()) as u64;

    let input_joints = create_storage_buffer(device, "supermotion_in_joints", &synthetic_chain.input_joints);
    let prev_joints = create_storage_buffer(device, "supermotion_prev_joints", &synthetic_chain.prev_joints);
    let parents = create_storage_buffer(device, "supermotion_parents", &synthetic_chain.parents);
    let mod_type = create_storage_buffer(device, "supermotion_mod_type", &synthetic_chain.mod_type);
    let params_a = create_storage_buffer(device, "supermotion_params_a", &synthetic_chain.params_a);
    let params_b = create_storage_buffer(device, "supermotion_params_b", &synthetic_chain.params_b);
    let params_c = create_storage_buffer(device, "supermotion_params_c", &synthetic_chain.params_c);
    let out_joints = create_zeroed_storage_buffer(device, "supermotion_out_joints", out_bytes);
    let out_rotations = create_zeroed_storage_buffer(device, "supermotion_out_rotations", out_bytes);

    let joint_count_uniform = create_uniform_u32(device, "supermotion_joint_count", input.joint_count);
    let time_uniform = create_uniform_f32(device, "supermotion_time_sec", input.elapsed_seconds);
    let delta_uniform = create_uniform_f32(device, "supermotion_delta_time", input.prev_lag);
    let floor_uniform = create_uniform_f32(device, "supermotion_floor_y", input.floor_y);
    let intensity_uniform =
        create_uniform_f32(device, "supermotion_global_intensity", input.global_intensity);
    let seed_uniform = create_uniform_f32(device, "supermotion_random_seed", input.random_seed);
    let eps_uniform = create_uniform_f32(device, "supermotion_eps", input.eps);

    let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: Some("supermotion_probe_bind_group"),
        layout: bind_group_layout,
        entries: &[
            bind_entry(0, &input_joints),
            bind_entry(1, &prev_joints),
            bind_entry(2, &parents),
            bind_entry(3, &mod_type),
            bind_entry(4, &params_a),
            bind_entry(5, &params_b),
            bind_entry(6, &params_c),
            bind_entry(7, &out_joints),
            bind_entry(8, &out_rotations),
            bind_entry(9, &joint_count_uniform),
            bind_entry(10, &time_uniform),
            bind_entry(11, &delta_uniform),
            bind_entry(12, &floor_uniform),
            bind_entry(13, &intensity_uniform),
            bind_entry(14, &seed_uniform),
            bind_entry(15, &eps_uniform),
        ],
    });

    let staging_joints = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("supermotion_out_joints_readback"),
        size: out_bytes,
        usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
        mapped_at_creation: false,
    });
    let staging_rotations = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("supermotion_out_rotations_readback"),
        size: out_bytes,
        usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
        mapped_at_creation: false,
    });

    let workgroup_x = kernel.workgroup_size[0].max(1);
    let dispatch = UVec3::new(input.joint_count.div_ceil(workgroup_x).max(1), 1, 1);
    let run_start = std::time::Instant::now();

    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("supermotion_probe_encoder"),
    });
    {
        let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("supermotion_probe_pass"),
            timestamp_writes: None,
        });
        pass.set_pipeline(pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.dispatch_workgroups(dispatch.x, dispatch.y, dispatch.z);
    }
    encoder.copy_buffer_to_buffer(&out_joints, 0, &staging_joints, 0, out_bytes);
    encoder.copy_buffer_to_buffer(&out_rotations, 0, &staging_rotations, 0, out_bytes);

    queue.submit(std::iter::once(encoder.finish()));
    let _ = device.poll(wgpu::PollType::Wait);

    let output_positions_raw = map_buffer_to_vec4(&staging_joints, device)?;
    let output_rotations_raw = map_buffer_to_vec4(&staging_rotations, device)?;
    let duration_ms = run_start.elapsed().as_secs_f64() as f32 * 1000.0;

    Ok(SupermotionDispatchOutput {
        input_positions: synthetic_chain
            .input_joints
            .iter()
            .map(|joint| Vec3::new(joint[0], joint[1], joint[2]))
            .collect(),
        output_positions: output_positions_raw
            .iter()
            .map(|joint| Vec3::new(joint[0], joint[1], joint[2]))
            .collect(),
        output_rotations: output_rotations_raw
            .iter()
            .map(|quat| {
                let candidate = Quat::from_xyzw(quat[0], quat[1], quat[2], quat[3]);
                if candidate.length_squared() > 0.0 {
                    candidate.normalize()
                } else {
                    Quat::IDENTITY
                }
            })
            .collect(),
        parent_indices: synthetic_chain.parents,
        dispatch,
        duration_ms,
    })
}

struct SyntheticChain {
    input_joints: Vec<[f32; 4]>,
    prev_joints: Vec<[f32; 4]>,
    parents: Vec<i32>,
    mod_type: Vec<i32>,
    params_a: Vec<[f32; 4]>,
    params_b: Vec<[f32; 4]>,
    params_c: Vec<[f32; 4]>,
}

fn build_synthetic_chain(input: &SupermotionDispatchInput) -> SyntheticChain {
    let joint_count = input.joint_count as usize;
    let mut input_joints = Vec::with_capacity(joint_count);
    let mut prev_joints = Vec::with_capacity(joint_count);
    let mut parents = Vec::with_capacity(joint_count);
    let mut mod_type = Vec::with_capacity(joint_count);
    let mut params_a = Vec::with_capacity(joint_count);
    let mut params_b = Vec::with_capacity(joint_count);
    let mut params_c = Vec::with_capacity(joint_count);

    for joint_index in 0..joint_count {
        let joint = joint_index as f32;
        let phase = joint * input.phase_step;
        let time_now = input.elapsed_seconds;
        let time_prev = (input.elapsed_seconds - input.prev_lag).max(0.0);
        let y = input.base_height + joint * input.chain_spacing;

        let input_pos = Vec3::new(
            (time_now * 0.7 + phase).sin() * input.lateral_wave,
            y,
            (time_now * 0.45 + phase * 0.5).cos() * input.depth_wave,
        );
        let prev_pos = Vec3::new(
            (time_prev * 0.7 + phase).sin() * input.lateral_wave,
            y,
            (time_prev * 0.45 + phase * 0.5).cos() * input.depth_wave,
        );

        input_joints.push([input_pos.x, input_pos.y, input_pos.z, 1.0]);
        prev_joints.push([prev_pos.x, prev_pos.y, prev_pos.z, 1.0]);
        parents.push(if joint_index == 0 { -1 } else { joint_index as i32 - 1 });
        mod_type.push(if joint_index == 0 { 0 } else { input.selected_mode_id });

        let mut a = [0.0; 4];
        let mut b = [0.0; 4];
        let mut c = [0.0; 4];
        apply_param_value(&mut a, &mut b, &mut c, "a.w", input.phase_step);
        for (key, value) in &input.values {
            apply_param_value(&mut a, &mut b, &mut c, key, *value);
        }
        params_a.push(a);
        params_b.push(b);
        params_c.push(c);
    }

    SyntheticChain {
        input_joints,
        prev_joints,
        parents,
        mod_type,
        params_a,
        params_b,
        params_c,
    }
}

fn apply_param_value(a: &mut [f32; 4], b: &mut [f32; 4], c: &mut [f32; 4], key: &str, value: f32) {
    let Some((channel, lane)) = parse_param_key(key) else {
        return;
    };
    match channel {
        'a' => a[lane] = value,
        'b' => b[lane] = value,
        'c' => c[lane] = value,
        _ => {}
    }
}

fn parse_param_key(key: &str) -> Option<(char, usize)> {
    let mut parts = key.split('.');
    let channel = parts.next()?.chars().next()?;
    let lane = match parts.next()? {
        "x" => 0,
        "y" => 1,
        "z" => 2,
        "w" => 3,
        _ => return None,
    };
    Some((channel, lane))
}

fn compile_spirv_shader(bytes: &[u8]) -> Result<CompiledSpirvShader, String> {
    let module = naga::front::spv::parse_u8_slice(bytes, &naga::front::spv::Options::default())
        .map_err(|err| format!("Failed to parse SPIR-V: {err:?}"))?;
    let entry_point = module
        .entry_points
        .iter()
        .find(|entry_point| entry_point.stage == naga::ShaderStage::Compute)
        .ok_or_else(|| "No compute entry point found in SPIR-V module".to_string())?;
    let entry_name = entry_point.name.clone();
    let workgroup_size = entry_point.workgroup_size;
    let info = naga::valid::Validator::new(
        naga::valid::ValidationFlags::all(),
        naga::valid::Capabilities::all(),
    )
    .validate(&module)
    .map_err(|err| format!("Failed to validate SPIR-V module: {err:?}"))?;
    let wgsl = naga::back::wgsl::write_string(
        &module,
        &info,
        naga::back::wgsl::WriterFlags::EXPLICIT_TYPES,
    )
    .map_err(|err| format!("Failed to translate SPIR-V to WGSL: {err}"))?;

    Ok(CompiledSpirvShader {
        entry_point: entry_name,
        workgroup_size,
        wgsl,
    })
}

fn create_supermotion_bind_group_layout(device: &wgpu::Device) -> wgpu::BindGroupLayout {
    let mut entries = Vec::new();
    for binding in 0..=8 {
        entries.push(wgpu::BindGroupLayoutEntry {
            binding,
            visibility: wgpu::ShaderStages::COMPUTE,
            ty: wgpu::BindingType::Buffer {
                ty: wgpu::BufferBindingType::Storage {
                    read_only: binding <= 6,
                },
                has_dynamic_offset: false,
                min_binding_size: None,
            },
            count: None,
        });
    }
    for binding in 9..=15 {
        entries.push(wgpu::BindGroupLayoutEntry {
            binding,
            visibility: wgpu::ShaderStages::COMPUTE,
            ty: wgpu::BindingType::Buffer {
                ty: wgpu::BufferBindingType::Uniform,
                has_dynamic_offset: false,
                min_binding_size: None,
            },
            count: None,
        });
    }

    device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: Some("supermotion_probe_bind_group_layout"),
        entries: &entries,
    })
}

fn create_storage_buffer<T: bytemuck::Pod>(
    device: &wgpu::Device,
    label: &str,
    contents: &[T],
) -> wgpu::Buffer {
    device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some(label),
        contents: bytemuck::cast_slice(contents),
        usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
    })
}

fn create_zeroed_storage_buffer(device: &wgpu::Device, label: &str, size: u64) -> wgpu::Buffer {
    device.create_buffer(&wgpu::BufferDescriptor {
        label: Some(label),
        size,
        usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    })
}

fn create_uniform_u32(device: &wgpu::Device, label: &str, value: u32) -> wgpu::Buffer {
    device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some(label),
        contents: bytemuck::cast_slice(&[[value, 0, 0, 0]]),
        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
    })
}

fn create_uniform_f32(device: &wgpu::Device, label: &str, value: f32) -> wgpu::Buffer {
    device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some(label),
        contents: bytemuck::cast_slice(&[[value, 0.0, 0.0, 0.0]]),
        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
    })
}

fn bind_entry(binding: u32, buffer: &wgpu::Buffer) -> wgpu::BindGroupEntry<'_> {
    wgpu::BindGroupEntry {
        binding,
        resource: buffer.as_entire_binding(),
    }
}

fn map_buffer_to_vec4(buffer: &wgpu::Buffer, device: &wgpu::Device) -> Result<Vec<[f32; 4]>, String> {
    let slice = buffer.slice(..);
    let (tx, rx) = mpsc::channel();
    slice.map_async(wgpu::MapMode::Read, move |result| {
        let _ = tx.send(result);
    });
    let _ = device.poll(wgpu::PollType::Wait);
    rx.recv()
        .map_err(|err| format!("Readback channel failed: {err}"))?
        .map_err(|err| format!("Readback map failed: {err:?}"))?;

    let data = slice.get_mapped_range();
    let output = bytemuck::cast_slice::<u8, [f32; 4]>(&data).to_vec();
    drop(data);
    buffer.unmap();
    Ok(output)
}

fn load_json<T>(path: &Path) -> Result<T, String>
where
    T: for<'de> Deserialize<'de>,
{
    let raw = fs::read_to_string(path)
        .map_err(|err| format!("Failed to read {}: {err}", path.display()))?;
    serde_json::from_str(&raw)
        .map_err(|err| format!("Failed to parse {}: {err}", path.display()))
}

fn resolve_path(root: &Path, candidate: &str) -> PathBuf {
    let path = PathBuf::from(candidate);
    if path.is_absolute() {
        path
    } else {
        root.join(path)
    }
}

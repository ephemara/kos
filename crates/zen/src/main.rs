#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod fabric;
mod input;
mod kain_runtime;
mod kain_ui_host;
mod post;
mod renderer_session;
mod theme;

use bytemuck::{Pod, Zeroable};
use config::{CameraConfig, RendererConfig, RuntimeConfig};
use egui_wgpu_backend::{RenderPass as EguiRenderPass, ScreenDescriptor};
use egui_winit::State as EguiWinitState;
use fabric::ZenFabricService;
use glam::{Mat4, Vec3};
use input::{Action, InputBindings, InputState, InputTrigger};
use kain_runtime::KainRuntime;
use kain_ui_host::{ZenKainUiHost, ZenViewportHud};
use renderer_session::ZenRendererSession;
use post::ZenPostProcessor;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use theme::{resolve_source_path, ZenUiTheme};
use wgpu::util::DeviceExt;
use winit::application::ApplicationHandler;
use winit::dpi::PhysicalSize;
use winit::event::{DeviceEvent, ElementState, MouseButton, MouseScrollDelta, WindowEvent};
use winit::event_loop::{ActiveEventLoop, ControlFlow, EventLoop};
use winit::keyboard::PhysicalKey;
use winit::window::{CursorGrabMode, Window, WindowAttributes};
use zen_core::{ZenCommand, ZenCommandEnvelope, ZenCommandSource, ZenEvent, ZenTransactionId};
use zen_runtime::ZenRuntimeSession;
use zen_scene::{Vertex, ZenScene};

const SCENE_SHADER_WGSL: &str = r#"
struct CameraUniform {
    view_proj: mat4x4<f32>,
    light_view_proj: mat4x4<f32>,
    view_pos: vec4<f32>,
    sun_dir: vec4<f32>,
    sun_color: vec4<f32>,
    render_params: vec4<f32>,
    style_params: vec4<f32>,
    accent: vec4<f32>,
};

@group(0) @binding(0)
var<uniform> camera: CameraUniform;
@group(0) @binding(1)
var shadow_map: texture_depth_2d;
@group(0) @binding(2)
var shadow_sampler: sampler_comparison;

struct VertexIn {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
};

struct VertexOut {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) world_position: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) light_clip: vec4<f32>,
};

@vertex
fn vs_main(input: VertexIn) -> VertexOut {
    var out: VertexOut;
    out.world_position = input.position;
    out.color = input.color;
    out.clip_position = camera.view_proj * vec4<f32>(input.position, 1.0);
    out.light_clip = camera.light_view_proj * vec4<f32>(input.position, 1.0);
    return out;
}

fn shadow_visibility(light_clip: vec4<f32>) -> f32 {
    let projected = light_clip.xyz / light_clip.w;
    if abs(projected.x) > 1.0 || abs(projected.y) > 1.0 || projected.z < 0.0 || projected.z > 1.0 {
        return 1.0;
    }

    let uv = projected.xy * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5, 0.5);
    let dims = vec2<f32>(textureDimensions(shadow_map));
    let texel = max(vec2<f32>(1.0) / dims, vec2<f32>(0.0005));
    let softness = camera.render_params.w;
    let compare_depth = projected.z - 0.0015;
    var visible = 0.0;

    for (var y = -1; y <= 1; y = y + 1) {
        for (var x = -1; x <= 1; x = x + 1) {
            let offset = vec2<f32>(f32(x), f32(y)) * texel * softness;
            visible = visible + textureSampleCompare(shadow_map, shadow_sampler, uv + offset, compare_depth);
        }
    }

    return visible / 9.0;
}

@fragment
fn fs_main(input: VertexOut) -> @location(0) vec4<f32> {
    let base = input.color;
    let xz = input.world_position.xz;
    let minor_cell = abs(fract(xz + vec2<f32>(0.5, 0.5)) - vec2<f32>(0.5, 0.5));
    let major_cell = abs(fract((xz / 5.0) + vec2<f32>(0.5, 0.5)) - vec2<f32>(0.5, 0.5));
    let minor_line = 1.0 - smoothstep(0.46, 0.5, min(minor_cell.x, minor_cell.y) * 2.0);
    let major_line = 1.0 - smoothstep(0.475, 0.5, min(major_cell.x, major_cell.y) * 2.0);
    let floor_mask = select(0.0, 1.0, abs(input.world_position.y) < 0.02);
    let grid_mix =
        floor_mask * camera.style_params.y * (minor_line * 0.24 + major_line * 0.82);

    let dpdx_world = dpdx(input.world_position);
    let dpdy_world = dpdy(input.world_position);
    var normal = normalize(cross(dpdy_world, dpdx_world));
    let view_dir = normalize(camera.view_pos.xyz - input.world_position);
    if dot(normal, view_dir) < 0.0 {
        normal = normal * -1.0;
    }

    let light_travel = normalize(camera.sun_dir.xyz);
    let to_light = normalize(-light_travel);
    let shadow = mix(1.0, shadow_visibility(input.light_clip), camera.render_params.z);
    let diffuse = max(dot(normal, to_light), 0.0) * shadow;
    let half_vec = normalize(to_light + view_dir);
    let specular = pow(max(dot(normal, half_vec), 0.0), 48.0) * shadow;
    let ambient = camera.render_params.x;
    let rim = pow(1.0 - max(dot(view_dir, normal), 0.0), 3.0) * camera.style_params.x;
    let sky_lift = clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
    let horizon_glow = pow(1.0 - abs(normal.y), 2.0) * 0.14;
    let accent_mix = 0.16 + floor_mask * 0.12;
    let tinted_base = mix(base, camera.accent.xyz, accent_mix);
    let bounce = vec3<f32>(0.06, 0.08, 0.11) * (0.1 + sky_lift * 0.12);
    let lit = tinted_base * (ambient + sky_lift * 0.18)
        + tinted_base * diffuse * camera.sun_color.xyz
        + camera.sun_color.xyz * specular * 0.28
        + camera.accent.xyz * rim * 0.24
        + bounce
        + camera.sun_color.xyz * horizon_glow
        + vec3<f32>(grid_mix);

    let distance_to_camera = distance(camera.view_pos.xyz, input.world_position);
    let fog_amount = 1.0 - exp(-distance_to_camera * camera.render_params.y);
    let fog_color = mix(
        vec3<f32>(0.05, 0.08, 0.1),
        camera.sun_color.xyz * 0.22 + camera.accent.xyz * 0.12,
        0.35 + sky_lift * 0.4,
    );
    let final_color = mix(lit, fog_color, clamp(fog_amount, 0.0, 0.92));
    return vec4<f32>(final_color, 1.0);
}
"#;

const SHADOW_SHADER_WGSL: &str = r#"
struct CameraUniform {
    view_proj: mat4x4<f32>,
    light_view_proj: mat4x4<f32>,
    view_pos: vec4<f32>,
    sun_dir: vec4<f32>,
    sun_color: vec4<f32>,
    render_params: vec4<f32>,
    style_params: vec4<f32>,
    accent: vec4<f32>,
};

@group(0) @binding(0)
var<uniform> camera: CameraUniform;

struct VertexIn {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
};

@vertex
fn vs_main(input: VertexIn) -> @builtin(position) vec4<f32> {
    return camera.light_view_proj * vec4<f32>(input.position, 1.0);
}
"#;

const BACKGROUND_SHADER_WGSL: &str = r#"
struct VertexOut {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@group(0) @binding(0)
var post_texture: texture_2d<f32>;

@vertex
fn vs_main(@builtin(vertex_index) index: u32) -> VertexOut {
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -3.0),
        vec2<f32>(-1.0, 1.0),
        vec2<f32>(3.0, 1.0)
    );
    var uvs = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 2.0),
        vec2<f32>(0.0, 0.0),
        vec2<f32>(2.0, 0.0)
    );

    var out: VertexOut;
    out.clip_position = vec4<f32>(positions[index], 0.0, 1.0);
    out.uv = uvs[index];
    return out;
}

@fragment
fn fs_main(input: VertexOut) -> @location(0) vec4<f32> {
    let dims = textureDimensions(post_texture);
    let x = clamp(i32(input.uv.x * f32(dims.x)), 0, i32(dims.x) - 1);
    let y = clamp(i32(input.uv.y * f32(dims.y)), 0, i32(dims.y) - 1);
    let color = textureLoad(post_texture, vec2<i32>(x, y), 0);
    return vec4<f32>(color.xyz, 1.0);
}
"#;

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct CameraUniform {
    view_proj: [[f32; 4]; 4],
    light_view_proj: [[f32; 4]; 4],
    view_pos: [f32; 4],
    sun_dir: [f32; 4],
    sun_color: [f32; 4],
    render_params: [f32; 4],
    style_params: [f32; 4],
    accent: [f32; 4],
}

pub(crate) struct FlyCamera {
    position: Vec3,
    yaw: f32,
    pitch: f32,
    fov_degrees: f32,
    near_plane: f32,
    far_plane: f32,
}

impl FlyCamera {
    fn new(config: &CameraConfig) -> Self {
        Self {
            position: Vec3::from_array(config.start_position),
            yaw: config.yaw,
            pitch: config.pitch,
            fov_degrees: config.fov_degrees,
            near_plane: config.near_plane,
            far_plane: config.far_plane,
        }
    }

    pub(crate) fn forward(&self) -> Vec3 {
        Vec3::new(
            self.yaw.cos() * self.pitch.cos(),
            self.pitch.sin(),
            self.yaw.sin() * self.pitch.cos(),
        )
        .normalize()
    }

    fn right(&self) -> Vec3 {
        self.forward().cross(Vec3::Y).normalize()
    }

    fn flat_forward(&self) -> Vec3 {
        Vec3::new(self.yaw.cos(), 0.0, self.yaw.sin()).normalize()
    }

    pub(crate) fn apply_look_delta(&mut self, dx: f64, dy: f64, sensitivity: f32) {
        self.yaw += dx as f32 * sensitivity;
        self.pitch = (self.pitch - dy as f32 * sensitivity).clamp(-1.45, 1.45);
    }

    pub(crate) fn focus_on(&mut self, target: Vec3, radius: f32) {
        let forward = self.forward_or_default();
        let distance = (radius * 2.6).max(2.75);
        let mut next_position = target - forward * distance;
        let min_height = target.y + radius * 0.35 + 0.65;
        if next_position.y < min_height {
            next_position.y = min_height;
        }
        self.position = next_position;
        self.look_at(target);
    }

    pub(crate) fn dolly(&mut self, amount: f32) {
        self.position += self.forward_or_default() * amount;
    }

    fn update(&mut self, dt: f32, input_state: &InputState, bindings: &InputBindings) {
        let mut movement = Vec3::ZERO;
        if input_state.is_action_active(bindings, Action::MoveForward) {
            movement += self.flat_forward();
        }
        if input_state.is_action_active(bindings, Action::MoveBackward) {
            movement -= self.flat_forward();
        }
        if input_state.is_action_active(bindings, Action::MoveLeft) {
            movement -= self.right();
        }
        if input_state.is_action_active(bindings, Action::MoveRight) {
            movement += self.right();
        }
        if input_state.is_action_active(bindings, Action::MoveUp) {
            movement += Vec3::Y;
        }
        if input_state.is_action_active(bindings, Action::MoveDown) {
            movement -= Vec3::Y;
        }

        if movement.length_squared() <= f32::EPSILON {
            return;
        }

        let boost = if input_state.is_action_active(bindings, Action::Boost) {
            bindings.camera.boost_multiplier
        } else {
            1.0
        };
        self.position += movement.normalize() * bindings.camera.move_speed * boost * dt;
    }

    fn look_at(&mut self, target: Vec3) {
        let direction = (target - self.position).normalize_or_zero();
        if direction.length_squared() <= f32::EPSILON {
            return;
        }
        self.yaw = direction.z.atan2(direction.x);
        self.pitch = direction.y.asin().clamp(-1.45, 1.45);
    }

    fn forward_or_default(&self) -> Vec3 {
        let forward = self.forward();
        if forward.length_squared() <= f32::EPSILON {
            Vec3::new(0.0, -0.12, -1.0).normalize()
        } else {
            forward
        }
    }

    fn view_projection(&self, aspect: f32) -> Mat4 {
        let view = Mat4::look_at_rh(self.position, self.position + self.forward(), Vec3::Y);
        let proj = Mat4::perspective_rh_gl(
            self.fov_degrees.to_radians(),
            aspect.max(0.1),
            self.near_plane,
            self.far_plane,
        );
        proj * view
    }
}

struct DepthTarget {
    texture: wgpu::Texture,
    view: wgpu::TextureView,
}

struct ShadowTarget {
    texture: wgpu::Texture,
    view: wgpu::TextureView,
}

struct ViewportTarget {
    texture: wgpu::Texture,
    view: wgpu::TextureView,
    depth_texture: wgpu::Texture,
    depth_view: wgpu::TextureView,
    size: PhysicalSize<u32>,
}

struct ZenUi {
    context: egui::Context,
    state: EguiWinitState,
    renderer: EguiRenderPass,
    screen: ScreenDescriptor,
    shell: ZenKainUiHost,
    theme: ZenUiTheme,
    viewport_texture_id: Option<egui::TextureId>,
    hot_reload_enabled: bool,
    hot_reload_interval: Duration,
    last_hot_reload_poll: Instant,
    theme_watch_path: Option<PathBuf>,
    theme_watch_modified: Option<std::time::SystemTime>,
}

impl DepthTarget {
    fn new(device: &wgpu::Device, size: PhysicalSize<u32>) -> Self {
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("zen-depth"),
            size: wgpu::Extent3d {
                width: size.width.max(1),
                height: size.height.max(1),
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Depth24Plus,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        Self { texture, view }
    }
}

impl ShadowTarget {
    fn new(device: &wgpu::Device, size: u32) -> Self {
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("zen-shadow-map"),
            size: wgpu::Extent3d {
                width: size.max(1),
                height: size.max(1),
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Depth32Float,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        Self { texture, view }
    }
}

impl ViewportTarget {
    fn new(device: &wgpu::Device, size: PhysicalSize<u32>) -> Self {
        let size = PhysicalSize::new(size.width.max(1), size.height.max(1));
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("zen-viewport-color"),
            size: wgpu::Extent3d {
                width: size.width,
                height: size.height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8UnormSrgb,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let depth_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("zen-viewport-depth"),
            size: wgpu::Extent3d {
                width: size.width,
                height: size.height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Depth24Plus,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });
        let depth_view = depth_texture.create_view(&wgpu::TextureViewDescriptor::default());
        Self {
            texture,
            view,
            depth_texture,
            depth_view,
            size,
        }
    }
}

impl ZenUi {
    fn new(
        window: &Window,
        device: &wgpu::Device,
        format: wgpu::TextureFormat,
        runtime_config: &RuntimeConfig,
    ) -> Result<Self, String> {
        let context = egui::Context::default();
        let theme = ZenUiTheme::load(&runtime_config.kain.ui.theme_manifest_path)?;
        context.style_mut(|style| theme.apply_to_style(style));
        let theme_watch_path = resolve_source_path(&runtime_config.kain.ui.theme_manifest_path);
        let theme_watch_modified = theme_watch_path
            .as_ref()
            .and_then(|path| std::fs::metadata(path).ok())
            .and_then(|meta| meta.modified().ok());

        let mut state = EguiWinitState::new(
            context.clone(),
            egui::ViewportId::ROOT,
            window,
            Some(window.scale_factor() as f32),
            None,
            Some(device.limits().max_texture_dimension_2d as usize),
        );
        state.set_max_texture_side(device.limits().max_texture_dimension_2d as usize);

        Ok(Self {
            context,
            state,
            renderer: EguiRenderPass::new(device, format, 1),
            screen: ScreenDescriptor {
                physical_width: window.inner_size().width,
                physical_height: window.inner_size().height,
                scale_factor: window.scale_factor() as f32,
            },
            shell: ZenKainUiHost::new(runtime_config.kain.ui.clone(), theme.clone()),
            theme,
            viewport_texture_id: None,
            hot_reload_enabled: runtime_config.kain.ui.hot_reload_enabled,
            hot_reload_interval: Duration::from_millis(runtime_config.kain.ui.hot_reload_poll_ms),
            last_hot_reload_poll: Instant::now(),
            theme_watch_path,
            theme_watch_modified,
        })
    }

    fn on_window_event(&mut self, window: &Window, event: &WindowEvent) -> bool {
        self.state.on_window_event(window, event).consumed
    }

    fn on_mouse_motion(&mut self, delta: (f64, f64)) {
        self.state.on_mouse_motion(delta);
    }

    fn resize(&mut self, window: &Window, size: PhysicalSize<u32>) {
        self.screen.physical_width = size.width;
        self.screen.physical_height = size.height;
        self.screen.scale_factor = window.scale_factor() as f32;
    }

    fn sync_viewport_texture(
        &mut self,
        device: &wgpu::Device,
        view: &wgpu::TextureView,
    ) -> Result<egui::TextureId, String> {
        if let Some(id) = self.viewport_texture_id {
            self.renderer
                .update_egui_texture_from_wgpu_texture(device, view, wgpu::FilterMode::Linear, id)
                .map_err(|err| format!("Failed to update Zen viewport texture: {err}"))?;
            Ok(id)
        } else {
            let id = self.renderer.egui_texture_from_wgpu_texture(
                device,
                view,
                wgpu::FilterMode::Linear,
            );
            self.viewport_texture_id = Some(id);
            Ok(id)
        }
    }

    fn viewport_request_size(&mut self) -> Option<[u32; 2]> {
        self.shell.take_viewport_request()
    }

    fn viewport_rect_pixels(&self) -> Option<[f32; 4]> {
        self.shell.viewport_rect_pixels()
    }

    fn poll_hot_reload(&mut self) {
        if !self.hot_reload_enabled
            || self.last_hot_reload_poll.elapsed() < self.hot_reload_interval
        {
            return;
        }
        self.last_hot_reload_poll = Instant::now();

        if let Some(path) = &self.theme_watch_path {
            let next_modified = std::fs::metadata(path)
                .ok()
                .and_then(|meta| meta.modified().ok());
            if next_modified != self.theme_watch_modified {
                if let Ok(theme) = ZenUiTheme::load(path.to_string_lossy().as_ref()) {
                    self.context.style_mut(|style| theme.apply_to_style(style));
                    self.theme = theme.clone();
                    self.shell.set_theme(theme);
                    self.theme_watch_modified = next_modified;
                }
            }
        }

        self.shell.poll_hot_reload();
    }

    fn render(
        &mut self,
        window: &Window,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        view: &wgpu::TextureView,
        scene: &mut ZenScene,
        runtime: &mut ZenRuntimeSession,
        camera: &mut FlyCamera,
        fabric_service: &mut ZenFabricService,
        renderer_config: &mut RendererConfig,
        hud: ZenViewportHud,
        kain_status: &str,
    ) -> Result<bool, String> {
        let raw_input = self.state.take_egui_input(window);
        self.poll_hot_reload();
        let mut scene_changed = false;
        let shell = &mut self.shell;
        let full_output = self.context.run(raw_input, |ctx| {
            scene_changed = shell.render(
                ctx,
                scene,
                runtime,
                camera,
                fabric_service,
                renderer_config,
                hud,
                kain_status,
            ) || scene_changed;
        });
        self.state
            .handle_platform_output(window, full_output.platform_output);

        let paint_jobs = self
            .context
            .tessellate(full_output.shapes, self.screen.scale_factor);

        self.renderer
            .add_textures(device, queue, &full_output.textures_delta)
            .map_err(|err| format!("Failed to upload egui textures: {err}"))?;
        self.renderer
            .update_buffers(device, queue, &paint_jobs, &self.screen);
        self.renderer
            .execute(encoder, view, &paint_jobs, &self.screen, None)
            .map_err(|err| format!("Failed to render egui overlay: {err}"))?;
        self.renderer
            .remove_textures(full_output.textures_delta)
            .map_err(|err| format!("Failed to retire egui textures: {err}"))?;

        Ok(scene_changed)
    }
}

struct ZenState {
    window: Arc<Window>,
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    surface_config: wgpu::SurfaceConfiguration,
    size: PhysicalSize<u32>,
    background_pipeline: wgpu::RenderPipeline,
    background_bind_group_layout: wgpu::BindGroupLayout,
    background_bind_group: Option<wgpu::BindGroup>,
    shadow_pipeline: wgpu::RenderPipeline,
    render_pipeline: wgpu::RenderPipeline,
    camera_buffer: wgpu::Buffer,
    shadow_camera_bind_group: wgpu::BindGroup,
    camera_bind_group: wgpu::BindGroup,
    depth_target: DepthTarget,
    shadow_target: ShadowTarget,
    viewport_target: ViewportTarget,
    camera: FlyCamera,
    bindings: InputBindings,
    input_state: InputState,
    mouse_look_active: bool,
    last_frame: Instant,
    last_title_update: Instant,
    started_at: Instant,
    runtime_config: RuntimeConfig,
    scene: ZenScene,
    renderer_session: ZenRendererSession,
    runtime: ZenRuntimeSession,
    fabric_service: ZenFabricService,
    last_cursor_position: Option<(f32, f32)>,
    ui: ZenUi,
    post_processor: ZenPostProcessor,
    kain_runtime: KainRuntime,
}

impl ZenState {
    async fn new(window: Arc<Window>, runtime_config: RuntimeConfig) -> Result<Self, String> {
        let size = window.inner_size();
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor::default());
        let surface = instance
            .create_surface(window.clone())
            .map_err(|err| format!("Failed to create Zen surface: {err}"))?;

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .map_err(|err| format!("Failed to request Zen adapter: {err}"))?;

        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                required_features: wgpu::Features::empty(),
                required_limits: adapter.limits(),
                memory_hints: wgpu::MemoryHints::Performance,
                label: Some("zen-device"),
                trace: wgpu::Trace::Off,
            })
            .await
            .map_err(|err| format!("Failed to create Zen device: {err}"))?;

        let surface_caps = surface.get_capabilities(&adapter);
        let surface_format = surface_caps
            .formats
            .iter()
            .copied()
            .find(|format| format.is_srgb())
            .unwrap_or(surface_caps.formats[0]);

        let surface_config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width: size.width.max(1),
            height: size.height.max(1),
            present_mode: surface_caps
                .present_modes
                .iter()
                .copied()
                .find(|mode| *mode == wgpu::PresentMode::Fifo)
                .unwrap_or(surface_caps.present_modes[0]),
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };
        surface.configure(&device, &surface_config);

        let bindings = InputBindings::load()?;
        let camera = FlyCamera::new(&runtime_config.camera);
        let scene = ZenScene::new_default();

        let camera_uniform = CameraUniform {
            view_proj: camera
                .view_projection(size.width.max(1) as f32 / size.height.max(1) as f32)
                .to_cols_array_2d(),
            light_view_proj: Mat4::IDENTITY.to_cols_array_2d(),
            view_pos: [camera.position.x, camera.position.y, camera.position.z, 1.0],
            sun_dir: [0.42, -1.0, 0.28, 0.0],
            sun_color: runtime_config.renderer.sun_color,
            render_params: [
                runtime_config.renderer.ambient_strength,
                runtime_config.renderer.fog_density,
                runtime_config.renderer.shadow_strength,
                runtime_config.renderer.shadow_softness,
            ],
            style_params: [runtime_config.renderer.rim_strength, 0.0, 0.0, 0.0],
            accent: [0.28, 0.84, 0.92, 1.0],
        };
        let camera_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("zen-camera-buffer"),
            contents: bytemuck::bytes_of(&camera_uniform),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });
        let shadow_target = ShadowTarget::new(&device, runtime_config.renderer.shadow_map_size);
        let shadow_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("zen-shadow-sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Nearest,
            compare: Some(wgpu::CompareFunction::LessEqual),
            lod_min_clamp: 0.0,
            lod_max_clamp: 1.0,
            ..Default::default()
        });
        let shadow_camera_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("zen-shadow-camera-layout"),
                entries: &[wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                }],
            });
        let shadow_camera_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("zen-shadow-camera-bind-group"),
            layout: &shadow_camera_bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: camera_buffer.as_entire_binding(),
            }],
        });
        let camera_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("zen-camera-layout"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Texture {
                            sample_type: wgpu::TextureSampleType::Depth,
                            view_dimension: wgpu::TextureViewDimension::D2,
                            multisampled: false,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 2,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Comparison),
                        count: None,
                    },
                ],
            });
        let camera_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("zen-camera-bind-group"),
            layout: &camera_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: camera_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&shadow_target.view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&shadow_sampler),
                },
            ],
        });

        let background_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("zen-background-shader"),
            source: wgpu::ShaderSource::Wgsl(BACKGROUND_SHADER_WGSL.into()),
        });
        let background_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("zen-background-layout"),
                entries: &[wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: false },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                }],
            });
        let background_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("zen-background-pipeline-layout"),
                bind_group_layouts: &[&background_bind_group_layout],
                push_constant_ranges: &[],
            });
        let background_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("zen-background-pipeline"),
            layout: Some(&background_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &background_shader,
                entry_point: Some("vs_main"),
                buffers: &[],
                compilation_options: Default::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &background_shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: wgpu::TextureFormat::Rgba8UnormSrgb,
                    blend: Some(wgpu::BlendState::REPLACE),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let shadow_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("zen-shadow-shader"),
            source: wgpu::ShaderSource::Wgsl(SHADOW_SHADER_WGSL.into()),
        });
        let shadow_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("zen-shadow-pipeline-layout"),
                bind_group_layouts: &[&shadow_camera_bind_group_layout],
                push_constant_ranges: &[],
            });
        let shadow_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("zen-shadow-pipeline"),
            layout: Some(&shadow_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shadow_shader,
                entry_point: Some("vs_main"),
                buffers: &[Vertex::desc()],
                compilation_options: Default::default(),
            },
            fragment: None,
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: Some(wgpu::Face::Back),
                polygon_mode: wgpu::PolygonMode::Fill,
                unclipped_depth: false,
                conservative: false,
            },
            depth_stencil: Some(wgpu::DepthStencilState {
                format: wgpu::TextureFormat::Depth32Float,
                depth_write_enabled: true,
                depth_compare: wgpu::CompareFunction::LessEqual,
                stencil: wgpu::StencilState::default(),
                bias: wgpu::DepthBiasState {
                    constant: 2,
                    slope_scale: 2.0,
                    clamp: 0.0,
                },
            }),
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("zen-scene-shader"),
            source: wgpu::ShaderSource::Wgsl(SCENE_SHADER_WGSL.into()),
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("zen-pipeline-layout"),
            bind_group_layouts: &[&camera_bind_group_layout],
            push_constant_ranges: &[],
        });
        let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("zen-render-pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[Vertex::desc()],
                compilation_options: Default::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: wgpu::TextureFormat::Rgba8UnormSrgb,
                    blend: Some(wgpu::BlendState::REPLACE),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: Some(wgpu::Face::Back),
                polygon_mode: wgpu::PolygonMode::Fill,
                unclipped_depth: false,
                conservative: false,
            },
            depth_stencil: Some(wgpu::DepthStencilState {
                format: wgpu::TextureFormat::Depth24Plus,
                depth_write_enabled: true,
                depth_compare: wgpu::CompareFunction::LessEqual,
                stencil: wgpu::StencilState::default(),
                bias: wgpu::DepthBiasState::default(),
            }),
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let depth_target = DepthTarget::new(&device, size);
        let viewport_target = ViewportTarget::new(&device, size);
        let post_processor =
            ZenPostProcessor::new(&device, runtime_config.renderer.post.clone(), size);
        let mut renderer_session = ZenRendererSession::new();
        renderer_session
            .sync_scene(
                &device,
                &scene,
                viewport_target.size,
                &runtime_config.renderer,
            )
            .map_err(|err| format!("Failed to initialize shared renderer session: {err}"))?;
        renderer_session
            .sync_camera(&camera)
            .map_err(|err| format!("Failed to initialize renderer camera: {err}"))?;
        let background_bind_group = post_processor.output_view().map(|view| {
            device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("zen-background-bind-group"),
                layout: &background_bind_group_layout,
                entries: &[wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(view),
                }],
            })
        });
        let ui = ZenUi::new(
            window.as_ref(),
            &device,
            surface_config.format,
            &runtime_config,
        )?;
        let fabric_service = ZenFabricService::new(runtime_config.kain.fabric.clone());
        let mut state = Self {
            window,
            surface,
            device,
            queue,
            surface_config,
            size,
            background_pipeline,
            background_bind_group_layout,
            background_bind_group,
            shadow_pipeline,
            render_pipeline,
            camera_buffer,
            shadow_camera_bind_group,
            camera_bind_group,
            depth_target,
            shadow_target,
            viewport_target,
            camera,
            bindings,
            input_state: InputState::default(),
            mouse_look_active: false,
            last_frame: Instant::now(),
            last_title_update: Instant::now(),
            started_at: Instant::now(),
            runtime_config: runtime_config.clone(),
            scene,
            renderer_session,
            runtime: ZenRuntimeSession::new(),
            fabric_service,
            last_cursor_position: None,
            ui,
            post_processor,
            kain_runtime: KainRuntime::new(runtime_config.kain),
        };
        state.update_camera_uniform();
        Ok(state)
    }

    fn resize(&mut self, size: PhysicalSize<u32>) {
        if size.width == 0 || size.height == 0 {
            return;
        }
        self.size = size;
        self.surface_config.width = size.width;
        self.surface_config.height = size.height;
        self.surface.configure(&self.device, &self.surface_config);
        self.depth_target = DepthTarget::new(&self.device, size);
        self.post_processor.resize(&self.device, size);
        self.background_bind_group = self.post_processor.output_view().map(|view| {
            self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("zen-background-bind-group"),
                layout: &self.background_bind_group_layout,
                entries: &[wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(view),
                }],
            })
        });
        self.ui.resize(self.window.as_ref(), size);
    }

    fn ensure_viewport_target(&mut self, size: PhysicalSize<u32>) {
        let size = PhysicalSize::new(size.width.max(1), size.height.max(1));
        if self.viewport_target.size != size {
            self.viewport_target = ViewportTarget::new(&self.device, size);
        }
    }

    fn update(&mut self) {
        let now = Instant::now();
        let dt = (now - self.last_frame).as_secs_f32();
        self.last_frame = now;

        self.camera.update(dt, &self.input_state, &self.bindings);
        let (vertex_count, index_count) = self.renderer_session.scene_counts();
        self.kain_runtime.tick(
            &self.device,
            &self.queue,
            self.viewport_target.size.width,
            self.viewport_target.size.height,
            vertex_count,
            index_count,
        );
        if let Err(err) = self.renderer_session.sync_camera(&self.camera) {
            eprintln!("{err}");
        }
        self.update_camera_uniform();

        if now.duration_since(self.last_title_update) >= Duration::from_millis(600) {
            self.last_title_update = now;
            let selection = self
                .scene
                .selected_details()
                .map(|details| {
                    format!(
                        "sel {}#{} [{}v/{}f] pos {:.1}, {:.1}, {:.1} scale {:.1}, {:.1}, {:.1} rotw {:.2}",
                        details.name,
                        details.summary.handle.raw(),
                        details.summary.vertex_count,
                        details.summary.face_count,
                        details.summary.translation[0],
                        details.summary.translation[1],
                        details.summary.translation[2],
                        details.summary.scale[0],
                        details.summary.scale[1],
                        details.summary.scale[2],
                        details.summary.rotation[3]
                    )
                })
                .unwrap_or_else(|| "sel none".to_string());
            self.window.set_title(&format!(
                "{} // mode {:?} // {} // {} // {} // {} // cam {:.1}, {:.1}, {:.1}",
                self.runtime_config.window.title,
                self.runtime.play_mode(),
                self.kain_runtime.title_suffix(),
                self.renderer_session.status_suffix(),
                self.post_processor.status(),
                selection,
                self.camera.position.x,
                self.camera.position.y,
                self.camera.position.z
            ));
        }
    }

    fn update_camera_uniform(&mut self) {
        let elapsed = self.started_at.elapsed().as_secs_f32();
        let accent = self.kain_runtime.accent(elapsed);
        let viewport_size = self.viewport_target.size;
        let aspect = viewport_size.width as f32 / viewport_size.height.max(1) as f32;
        let sun_dir =
            Vec3::from_array(self.runtime_config.renderer.sun_direction).normalize_or_zero();
        let scene_center = Vec3::new(0.0, 2.0, 0.0);
        let light_up = if sun_dir.dot(Vec3::Y).abs() > 0.98 {
            Vec3::Z
        } else {
            Vec3::Y
        };
        let light_position = scene_center - sun_dir * self.runtime_config.renderer.light_distance;
        let light_view = Mat4::look_at_rh(light_position, scene_center, light_up);
        let radius = self.runtime_config.renderer.light_projection_radius;
        let light_proj = Mat4::orthographic_rh_gl(
            -radius,
            radius,
            -radius,
            radius,
            self.runtime_config.renderer.light_near,
            self.runtime_config.renderer.light_far,
        );
        let uniform = CameraUniform {
            view_proj: self.camera.view_projection(aspect).to_cols_array_2d(),
            light_view_proj: (light_proj * light_view).to_cols_array_2d(),
            view_pos: [
                self.camera.position.x,
                self.camera.position.y,
                self.camera.position.z,
                1.0,
            ],
            sun_dir: [sun_dir.x, sun_dir.y, sun_dir.z, 0.0],
            sun_color: self.runtime_config.renderer.sun_color,
            render_params: [
                self.runtime_config.renderer.ambient_strength,
                self.runtime_config.renderer.fog_density,
                self.runtime_config.renderer.shadow_strength,
                self.runtime_config.renderer.shadow_softness,
            ],
            style_params: [
                self.runtime_config.renderer.rim_strength,
                self.runtime_config.renderer.grid_intensity,
                0.0,
                0.0,
            ],
            accent,
        };
        self.queue
            .write_buffer(&self.camera_buffer, 0, bytemuck::bytes_of(&uniform));
    }

    fn render(&mut self) -> Result<(), String> {
        let frame = match self.surface.get_current_texture() {
            Ok(frame) => frame,
            Err(wgpu::SurfaceError::Lost | wgpu::SurfaceError::Outdated) => {
                self.resize(self.size);
                return Ok(());
            }
            Err(wgpu::SurfaceError::OutOfMemory) => {
                return Err("Zen surface ran out of memory".to_string());
            }
            Err(wgpu::SurfaceError::Timeout) => {
                return Ok(());
            }
            Err(wgpu::SurfaceError::Other) => {
                return Ok(());
            }
        };

        let view = frame
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let accent = self
            .kain_runtime
            .accent(self.started_at.elapsed().as_secs_f32());
        let kain_status = format!(
            "{} // {}",
            self.kain_runtime.title_suffix(),
            self.post_processor.status()
        );
        let requested_viewport = self
            .ui
            .viewport_request_size()
            .map(|size| PhysicalSize::new(size[0].max(1), size[1].max(1)))
            .unwrap_or(self.viewport_target.size);
        let viewport_size_changed = self.viewport_target.size != requested_viewport;
        self.ensure_viewport_target(requested_viewport);
        if viewport_size_changed {
            if let Err(err) = self.renderer_session.sync_scene(
                &self.device,
                &self.scene,
                self.viewport_target.size,
                &self.runtime_config.renderer,
            ) {
                return Err(err);
            }
        }
        self.update_camera_uniform();

        let Some((vertex_buffer, index_buffer, index_count, vertex_count)) =
            self.renderer_session.scene_geometry()
        else {
            return Err("Zen shared renderer geometry not initialized".to_string());
        };

        let clear_color = self.ui.theme.surface_clear_color();
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("zen-render-encoder"),
            });

        self.post_processor.encode(
            &self.queue,
            &mut encoder,
            self.started_at.elapsed().as_secs_f32(),
            self.camera.forward(),
            self.runtime_config.renderer.sun_direction,
            self.runtime_config.renderer.sun_color,
            accent,
            self.runtime_config.renderer.fog_density,
            self.runtime_config.renderer.shadow_strength,
        )?;

        {
            let mut shadow_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("zen-shadow-pass"),
                color_attachments: &[],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.shadow_target.view,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Clear(1.0),
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            shadow_pass.set_pipeline(&self.shadow_pipeline);
            shadow_pass.set_bind_group(0, &self.shadow_camera_bind_group, &[]);
            shadow_pass.set_vertex_buffer(0, vertex_buffer.slice(..));
            shadow_pass.set_index_buffer(index_buffer.slice(..), wgpu::IndexFormat::Uint32);
            shadow_pass.draw_indexed(0..index_count, 0, 0..1);
        }

        let has_background = self.background_bind_group.is_some();
        if let Some(background_bind_group) = &self.background_bind_group {
            let mut background_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("zen-background-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &self.viewport_target.view,
                    resolve_target: None,
                    depth_slice: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(clear_color),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            background_pass.set_pipeline(&self.background_pipeline);
            background_pass.set_bind_group(0, background_bind_group, &[]);
            background_pass.draw(0..3, 0..1);
        }

        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("zen-scene-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &self.viewport_target.view,
                    resolve_target: None,
                    depth_slice: None,
                    ops: wgpu::Operations {
                        load: if has_background {
                            wgpu::LoadOp::Load
                        } else {
                            wgpu::LoadOp::Clear(clear_color)
                        },
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.viewport_target.depth_view,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Clear(1.0),
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            render_pass.set_pipeline(&self.render_pipeline);
            render_pass.set_bind_group(0, &self.camera_bind_group, &[]);
            render_pass.set_vertex_buffer(0, vertex_buffer.slice(..));
            render_pass.set_index_buffer(index_buffer.slice(..), wgpu::IndexFormat::Uint32);
            render_pass.draw_indexed(0..index_count, 0, 0..1);
        }

        {
            let _clear_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("zen-ui-clear-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    depth_slice: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(clear_color),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });
        }

        let viewport_texture_id = self
            .ui
            .sync_viewport_texture(&self.device, &self.viewport_target.view)?;

        let hud = ZenViewportHud {
            camera_position: self.camera.position.to_array(),
            camera_forward: self.camera.forward().to_array(),
            vertex_count,
            index_count,
            viewport_texture_id: Some(viewport_texture_id),
            viewport_extent: [
                self.viewport_target.size.width,
                self.viewport_target.size.height,
            ],
        };
        let overlay_changed = self.ui.render(
            self.window.as_ref(),
            &self.device,
            &self.queue,
            &mut encoder,
            &view,
            &mut self.scene,
            &mut self.runtime,
            &mut self.camera,
            &mut self.fabric_service,
            &mut self.runtime_config.renderer,
            hud,
            &kain_status,
        )?;
        if overlay_changed {
            self.sync_shared_renderer_scene()?;
        }

        self.queue.submit(std::iter::once(encoder.finish()));
        self.window.pre_present_notify();
        frame.present();
        Ok(())
    }

    fn set_mouse_look(&mut self, active: bool) {
        self.mouse_look_active = active;
        self.window.set_cursor_visible(!active);
        let grab_mode = if active {
            CursorGrabMode::Locked
        } else {
            CursorGrabMode::None
        };
        if self.window.set_cursor_grab(grab_mode).is_err() {
            let fallback = if active {
                CursorGrabMode::Confined
            } else {
                CursorGrabMode::None
            };
            let _ = self.window.set_cursor_grab(fallback);
        }
    }

    fn handle_mouse_wheel(&mut self, delta: MouseScrollDelta) {
        let amount = match delta {
            MouseScrollDelta::LineDelta(_, y) => y,
            MouseScrollDelta::PixelDelta(delta) => delta.y as f32 * 0.02,
        };
        self.camera
            .dolly(amount * self.bindings.camera.move_speed * 0.3);
    }

    fn sync_shared_renderer_scene(&mut self) -> Result<(), String> {
        self.renderer_session.sync_scene(
                &self.device,
                &self.scene,
                self.viewport_target.size,
                &self.runtime_config.renderer,
        )
    }

    fn handle_primary_click(&mut self) -> Result<(), String> {
        let Some(cursor) = self.last_cursor_position else {
            return Ok(());
        };
        let Some(ndc) = self.screen_ndc(cursor) else {
            return Ok(());
        };
        let selection = self
            .renderer_session
            .request_selection(ndc)
            .ok()
            .and_then(|result| result.hit.then_some(result.mesh_handle))
            .flatten()
            .or_else(|| {
                let Some((origin, direction)) = self.screen_ray(cursor) else {
                    return None;
                };
                self.scene.pick(origin, direction).map(|handle| handle.raw())
            });
        let changed = match selection {
            Some(handle_raw) => self.scene.select_raw_handle(handle_raw),
            None => self.scene.clear_selection(),
        };
        if changed {
            self.sync_shared_renderer_scene()?;
        }
        Ok(())
    }

    fn handle_action_trigger(&mut self, trigger: InputTrigger) {
        if self
            .bindings
            .trigger_matches_action(Action::FocusSelection, trigger)
        {
            self.dispatch_runtime_command(
                ZenCommandSource::ViewportHotkey("focus_selection".to_string()),
                ZenCommand::CameraFocusSelection,
            );
        }
        if self
            .bindings
            .trigger_matches_action(Action::FrameScene, trigger)
        {
            self.dispatch_runtime_command(
                ZenCommandSource::ViewportHotkey("frame_scene".to_string()),
                ZenCommand::CameraFrameScene,
            );
        }
    }

    fn focus_selected(&mut self) {
        if let Some(target) = self.scene.selected_focus_target() {
            self.camera
                .focus_on(Vec3::from_array(target.center), target.radius);
        }
    }

    fn frame_scene(&mut self) {
        if let Some(target) = self.scene.scene_focus_target() {
            self.camera
                .focus_on(Vec3::from_array(target.center), target.radius);
        }
    }

    fn dispatch_runtime_command(&mut self, source: ZenCommandSource, command: ZenCommand) {
        let transaction_id = ZenTransactionId::new(self.runtime.command_history().len() as u64 + 1);
        let envelope = ZenCommandEnvelope::new(transaction_id, source, command);
        match self.runtime.dispatch(&mut self.scene, envelope) {
            Ok(result) => {
                if result.scene_dirty {
                    if let Err(err) = self.sync_shared_renderer_scene() {
                        eprintln!("{err}");
                    }
                }
                self.apply_runtime_events(&result.events);
            }
            Err(err) => eprintln!("{err}"),
        }
    }

    fn apply_runtime_events(&mut self, events: &[ZenEvent]) {
        for event in events {
            match event {
                ZenEvent::CameraFocusRequested { .. } => self.focus_selected(),
                ZenEvent::CameraFrameRequested { .. } => self.frame_scene(),
                ZenEvent::ShellReloadRequested { .. }
                | ZenEvent::SceneChanged { .. }
                | ZenEvent::SelectionChanged { .. }
                | ZenEvent::PlayModeChanged { .. } => {}
            }
        }
    }

    fn screen_ray(&self, cursor: (f32, f32)) -> Option<(Vec3, Vec3)> {
        let viewport_rect = self.ui.viewport_rect_pixels()?;
        if self.viewport_target.size.width == 0 || self.viewport_target.size.height == 0 {
            return None;
        }

        let scale_factor = self.window.scale_factor() as f32;
        let cursor_px = (cursor.0 * scale_factor, cursor.1 * scale_factor);
        if cursor_px.0 < viewport_rect[0]
            || cursor_px.1 < viewport_rect[1]
            || cursor_px.0 > viewport_rect[0] + viewport_rect[2]
            || cursor_px.1 > viewport_rect[1] + viewport_rect[3]
        {
            return None;
        }

        let local_x = cursor_px.0 - viewport_rect[0];
        let local_y = cursor_px.1 - viewport_rect[1];
        let aspect =
            self.viewport_target.size.width as f32 / self.viewport_target.size.height as f32;
        let ndc_x = (local_x / viewport_rect[2].max(1.0)) * 2.0 - 1.0;
        let ndc_y = 1.0 - (local_y / viewport_rect[3].max(1.0)) * 2.0;
        let inverse = self.camera.view_projection(aspect).inverse();
        let near = inverse.project_point3(Vec3::new(ndc_x, ndc_y, -1.0));
        let far = inverse.project_point3(Vec3::new(ndc_x, ndc_y, 1.0));
        let direction = (far - near).normalize_or_zero();
        if direction.length_squared() <= f32::EPSILON {
            None
        } else {
            Some((near, direction))
        }
    }

    fn screen_ndc(&self, cursor: (f32, f32)) -> Option<[f32; 2]> {
        let viewport_rect = self.ui.viewport_rect_pixels()?;
        if self.viewport_target.size.width == 0 || self.viewport_target.size.height == 0 {
            return None;
        }

        let scale_factor = self.window.scale_factor() as f32;
        let cursor_px = (cursor.0 * scale_factor, cursor.1 * scale_factor);
        if cursor_px.0 < viewport_rect[0]
            || cursor_px.1 < viewport_rect[1]
            || cursor_px.0 > viewport_rect[0] + viewport_rect[2]
            || cursor_px.1 > viewport_rect[1] + viewport_rect[3]
        {
            return None;
        }

        let local_x = cursor_px.0 - viewport_rect[0];
        let local_y = cursor_px.1 - viewport_rect[1];
        let ndc_x = (local_x / viewport_rect[2].max(1.0)) * 2.0 - 1.0;
        let ndc_y = 1.0 - (local_y / viewport_rect[3].max(1.0)) * 2.0;
        Some([ndc_x, ndc_y])
    }
}

#[derive(Default)]
struct ZenApp {
    state: Option<ZenState>,
}

fn write_error_log_file(title: &str, message: &str) -> Option<PathBuf> {
    let log_path = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.join("zen-error.log")))
        .or_else(|| {
            std::env::current_dir()
                .ok()
                .map(|dir| dir.join("zen-error.log"))
        })?;
    let log_body = format!("{title}\n{message}\n");
    fs::write(&log_path, log_body).ok()?;
    Some(log_path)
}

fn append_session_log(message: &str) {
    let Some(log_path) = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.join("zen-session.log")))
        .or_else(|| {
            std::env::current_dir()
                .ok()
                .map(|dir| dir.join("zen-session.log"))
        })
    else {
        return;
    };

    let timestamp = format!("{:?}", std::time::SystemTime::now());
    if let Ok(mut file) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = writeln!(file, "[{timestamp}] {message}");
    }
}

fn report_fatal_error(title: &str, message: &str) {
    eprintln!("{title}: {message}");
    append_session_log(&format!("fatal: {title} // {message}"));
    let log_path = write_error_log_file(title, message);
    if cfg!(not(debug_assertions)) {
        let mut description = message.to_string();
        if let Some(path) = log_path {
            description.push_str("\n\nDetails written to:\n");
            description.push_str(&path.display().to_string());
        }
        let _ = rfd::MessageDialog::new()
            .set_title(title)
            .set_description(&description)
            .set_level(rfd::MessageLevel::Error)
            .show();
    }
}

impl ApplicationHandler for ZenApp {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        event_loop.set_control_flow(ControlFlow::Poll);
        if self.state.is_some() {
            return;
        }

        append_session_log("resumed: starting Zen boot");

        let runtime_config = match RuntimeConfig::load() {
            Ok(config) => config,
            Err(err) => {
                report_fatal_error("Zen startup failed", &err);
                event_loop.exit();
                return;
            }
        };
        append_session_log(&format!(
            "config: loaded runtime manifest // window '{}' {}x{}",
            runtime_config.window.title, runtime_config.window.width, runtime_config.window.height
        ));
        let window_title = runtime_config.window.title.clone();
        let window_width = runtime_config.window.width;
        let window_height = runtime_config.window.height;
        let min_width = runtime_config.window.min_width;
        let min_height = runtime_config.window.min_height;
        let attributes = WindowAttributes::default()
            .with_title(window_title)
            .with_inner_size(PhysicalSize::new(window_width, window_height))
            .with_min_inner_size(PhysicalSize::new(min_width, min_height));
        let window = match event_loop.create_window(attributes) {
            Ok(window) => Arc::new(window),
            Err(err) => {
                report_fatal_error("Zen window creation failed", &err.to_string());
                event_loop.exit();
                return;
            }
        };
        append_session_log("window: created native Zen window");

        match pollster::block_on(ZenState::new(window, runtime_config)) {
            Ok(state) => {
                append_session_log("startup: Zen state initialized");
                self.state = Some(state);
            }
            Err(err) => {
                report_fatal_error("Zen startup failed", &err);
                event_loop.exit();
            }
        }
    }

    fn window_event(
        &mut self,
        event_loop: &ActiveEventLoop,
        window_id: winit::window::WindowId,
        event: WindowEvent,
    ) {
        let Some(state) = self.state.as_mut() else {
            return;
        };
        if state.window.id() != window_id {
            return;
        }

        match event {
            WindowEvent::CloseRequested => {
                append_session_log("window: close requested");
                event_loop.exit()
            }
            WindowEvent::Resized(size) => state.resize(size),
            WindowEvent::ScaleFactorChanged { .. } => state.resize(state.window.inner_size()),
            WindowEvent::Focused(false) => {
                state.input_state.clear();
                state.set_mouse_look(false);
            }
            _ => {
                let egui_consumed = state.ui.on_window_event(state.window.as_ref(), &event);
                match event {
                    WindowEvent::KeyboardInput { event, .. } => {
                        if egui_consumed {
                            return;
                        }
                        if let PhysicalKey::Code(code) = event.physical_key {
                            if event.state == ElementState::Pressed && !event.repeat {
                                state.handle_action_trigger(InputTrigger::Key(code));
                            }
                            state
                                .input_state
                                .set_key(code, event.state == ElementState::Pressed);
                        }
                    }
                    WindowEvent::CursorMoved { position, .. } => {
                        state.last_cursor_position = Some((position.x as f32, position.y as f32));
                    }
                    WindowEvent::MouseInput {
                        state: button_state,
                        button,
                        ..
                    } => {
                        if egui_consumed {
                            return;
                        }
                        let pressed = button_state == ElementState::Pressed;
                        state.input_state.set_mouse(button, pressed);
                        if state
                            .input_state
                            .is_action_active(&state.bindings, Action::LookModifier)
                        {
                            state.set_mouse_look(true);
                        } else {
                            state.set_mouse_look(false);
                        }
                        if pressed && button == MouseButton::Left && !state.mouse_look_active {
                            if let Err(err) = state.handle_primary_click() {
                                eprintln!("{err}");
                            }
                        }
                    }
                    WindowEvent::MouseWheel { delta, .. } => state.handle_mouse_wheel(delta),
                    WindowEvent::RedrawRequested => {
                        if let Err(err) = state.render() {
                            report_fatal_error("Zen render failed", &err);
                            append_session_log("render: exiting after fatal render failure");
                            event_loop.exit();
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    fn device_event(
        &mut self,
        _event_loop: &ActiveEventLoop,
        _device_id: winit::event::DeviceId,
        event: DeviceEvent,
    ) {
        let Some(state) = self.state.as_mut() else {
            return;
        };

        if !state.mouse_look_active {
            return;
        }

        if let DeviceEvent::MouseMotion { delta } = event {
            state.ui.on_mouse_motion(delta);
            state
                .camera
                .apply_look_delta(delta.0, delta.1, state.bindings.camera.look_sensitivity);
        }
    }

    fn about_to_wait(&mut self, _event_loop: &ActiveEventLoop) {
        if let Some(state) = self.state.as_mut() {
            state.update();
            state.window.request_redraw();
        }
    }
}

fn main() {
    append_session_log("main: launching zen.exe");
    let event_loop = match EventLoop::new() {
        Ok(loop_instance) => loop_instance,
        Err(err) => {
            report_fatal_error(
                "Zen startup failed",
                &format!("Failed to create Zen event loop: {err}"),
            );
            return;
        }
    };
    let mut app = ZenApp::default();
    if let Err(err) = event_loop.run_app(&mut app) {
        report_fatal_error(
            "Zen event loop terminated",
            &format!("Zen event loop terminated with error: {err}"),
        );
    } else {
        append_session_log("main: event loop terminated cleanly");
    }
}

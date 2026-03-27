use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

const DEFAULT_RUNTIME_CONFIG: &str = include_str!("../resources/runtime.toml");

#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    pub window: WindowConfig,
    pub camera: CameraConfig,
    pub kain: KainConfig,
    pub renderer: RendererConfig,
}

#[derive(Debug, Clone)]
pub struct WindowConfig {
    pub title: String,
    pub width: u32,
    pub height: u32,
    pub min_width: u32,
    pub min_height: u32,
}

#[derive(Debug, Clone)]
pub struct CameraConfig {
    pub start_position: [f32; 3],
    pub yaw: f32,
    pub pitch: f32,
    pub fov_degrees: f32,
    pub near_plane: f32,
    pub far_plane: f32,
}

#[derive(Debug, Clone)]
pub struct KainConfig {
    pub validate_catalog_on_startup: bool,
    pub enable_dispatch: bool,
    pub dispatch_interval_frames: u64,
    pub ui: KainUiConfig,
    pub fabric: KainFabricConfig,
}

#[derive(Debug, Clone)]
pub struct KainUiConfig {
    pub enabled: bool,
    pub modules_manifest_path: String,
    pub workspace_manifest_path: String,
    pub theme_manifest_path: String,
    pub hot_reload_enabled: bool,
    pub hot_reload_poll_ms: u64,
    pub active_shell: String,
    pub host_api_path: String,
    pub root_component: String,
    pub show_runtime_inspector: bool,
}

#[derive(Debug, Clone)]
pub struct KainFabricConfig {
    pub enabled: bool,
    pub manifest_path: String,
}

#[derive(Debug, Clone)]
pub struct RendererConfig {
    pub shadow_map_size: u32,
    pub shadow_strength: f32,
    pub shadow_softness: f32,
    pub ambient_strength: f32,
    pub fog_density: f32,
    pub rim_strength: f32,
    pub grid_intensity: f32,
    pub sun_direction: [f32; 3],
    pub sun_color: [f32; 4],
    pub light_distance: f32,
    pub light_projection_radius: f32,
    pub light_near: f32,
    pub light_far: f32,
    pub post: RendererPostConfig,
}

#[derive(Debug, Clone)]
pub struct RendererPostConfig {
    pub enabled: bool,
    pub compile_on_startup: bool,
    pub shader_id: String,
    pub shader_source_path: String,
    pub shader_compiled_path: String,
    pub glow_strength: f32,
    pub haze_strength: f32,
    pub sun_disk_power: f32,
    pub sky_top: [f32; 4],
    pub sky_horizon: [f32; 4],
    pub ground_color: [f32; 4],
    pub fog_color: [f32; 4],
    pub shadow_color: [f32; 4],
}

impl RuntimeConfig {
    pub fn load() -> Result<Self, String> {
        let source = load_runtime_config_source()?;
        parse_runtime_config(&source)
    }
}

#[derive(Debug, Deserialize)]
struct RuntimeConfigFile {
    window: WindowConfigFile,
    camera: CameraConfigFile,
    kain: KainConfigFile,
    renderer: RendererConfigFile,
}

#[derive(Debug, Deserialize)]
struct WindowConfigFile {
    title: String,
    width: u32,
    height: u32,
    min_width: u32,
    min_height: u32,
}

#[derive(Debug, Deserialize)]
struct CameraConfigFile {
    start_position: [f32; 3],
    yaw: f32,
    pitch: f32,
    fov_degrees: f32,
    near_plane: f32,
    far_plane: f32,
}

#[derive(Debug, Deserialize)]
struct KainConfigFile {
    validate_catalog_on_startup: bool,
    enable_dispatch: bool,
    dispatch_interval_frames: u64,
    ui: Option<KainUiConfigFile>,
    fabric: Option<KainFabricConfigFile>,
}

#[derive(Debug, Deserialize)]
struct KainUiConfigFile {
    enabled: bool,
    source_path: Option<String>,
    modules_manifest_path: Option<String>,
    workspace_manifest_path: Option<String>,
    theme_manifest_path: Option<String>,
    hot_reload_enabled: Option<bool>,
    hot_reload_poll_ms: Option<u64>,
    active_shell: Option<String>,
    host_api_path: Option<String>,
    root_component: Option<String>,
    show_runtime_inspector: bool,
}

#[derive(Debug, Deserialize)]
struct KainFabricConfigFile {
    enabled: Option<bool>,
    manifest_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RendererConfigFile {
    shadow_map_size: u32,
    shadow_strength: f32,
    shadow_softness: f32,
    ambient_strength: f32,
    fog_density: f32,
    rim_strength: f32,
    grid_intensity: Option<f32>,
    sun_direction: [f32; 3],
    sun_color: [f32; 4],
    light_distance: f32,
    light_projection_radius: f32,
    light_near: f32,
    light_far: f32,
    post: RendererPostFile,
}

#[derive(Debug, Deserialize)]
struct RendererPostFile {
    enabled: bool,
    compile_on_startup: bool,
    shader_id: String,
    shader_source_path: String,
    shader_compiled_path: String,
    glow_strength: f32,
    haze_strength: f32,
    sun_disk_power: f32,
    sky_top: [f32; 4],
    sky_horizon: [f32; 4],
    ground_color: [f32; 4],
    fog_color: [f32; 4],
    shadow_color: [f32; 4],
}

fn load_runtime_config_source() -> Result<String, String> {
    if let Ok(explicit_path) = std::env::var("ZEN_RUNTIME_CONFIG_PATH") {
        let path = PathBuf::from(explicit_path);
        return fs::read_to_string(&path).map_err(|err| {
            format!(
                "Failed to read ZEN_RUNTIME_CONFIG_PATH '{}': {err}",
                path.display()
            )
        });
    }

    let mut candidates = Vec::new();
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            candidates.push(parent.join("zen").join("runtime.toml"));
            candidates.push(parent.join("runtime.toml"));
        }
    }
    candidates.push(
        k_os_kain::workspace_root()
            .join("crates")
            .join("zen")
            .join("resources")
            .join("runtime.toml"),
    );

    for candidate in candidates {
        if candidate.exists() {
            return fs::read_to_string(&candidate)
                .map_err(|err| format!("Failed to read '{}': {err}", candidate.display()));
        }
    }

    Ok(DEFAULT_RUNTIME_CONFIG.to_string())
}

fn parse_runtime_config(source: &str) -> Result<RuntimeConfig, String> {
    let parsed: RuntimeConfigFile = toml::from_str(source)
        .map_err(|err| format!("Failed to parse Zen runtime manifest: {err}"))?;

    Ok(RuntimeConfig {
        window: WindowConfig {
            title: if parsed.window.title.trim().is_empty() {
                "Zen // Native Renderer MVP".to_string()
            } else {
                parsed.window.title
            },
            width: parsed.window.width.max(640),
            height: parsed.window.height.max(480),
            min_width: parsed.window.min_width.max(480),
            min_height: parsed.window.min_height.max(320),
        },
        camera: CameraConfig {
            start_position: parsed.camera.start_position,
            yaw: parsed.camera.yaw,
            pitch: parsed.camera.pitch.clamp(-1.45, 1.45),
            fov_degrees: parsed.camera.fov_degrees.clamp(25.0, 120.0),
            near_plane: parsed.camera.near_plane.max(0.01),
            far_plane: parsed.camera.far_plane.max(10.0),
        },
        kain: KainConfig {
            validate_catalog_on_startup: parsed.kain.validate_catalog_on_startup,
            enable_dispatch: parsed.kain.enable_dispatch,
            dispatch_interval_frames: parsed.kain.dispatch_interval_frames.max(1),
            ui: parse_kain_ui_config(parsed.kain.ui),
            fabric: parse_kain_fabric_config(parsed.kain.fabric),
        },
        renderer: RendererConfig {
            shadow_map_size: parsed.renderer.shadow_map_size.clamp(512, 4096),
            shadow_strength: parsed.renderer.shadow_strength.clamp(0.0, 1.0),
            shadow_softness: parsed.renderer.shadow_softness.clamp(0.35, 4.0),
            ambient_strength: parsed.renderer.ambient_strength.clamp(0.05, 1.0),
            fog_density: parsed.renderer.fog_density.clamp(0.0, 0.5),
            rim_strength: parsed.renderer.rim_strength.clamp(0.0, 2.0),
            grid_intensity: parsed
                .renderer
                .grid_intensity
                .unwrap_or(0.85)
                .clamp(0.0, 2.0),
            sun_direction: parsed.renderer.sun_direction,
            sun_color: parsed.renderer.sun_color,
            light_distance: parsed.renderer.light_distance.clamp(4.0, 128.0),
            light_projection_radius: parsed.renderer.light_projection_radius.clamp(4.0, 128.0),
            light_near: parsed.renderer.light_near.max(0.01),
            light_far: parsed
                .renderer
                .light_far
                .max(parsed.renderer.light_near + 1.0),
            post: RendererPostConfig {
                enabled: parsed.renderer.post.enabled,
                compile_on_startup: parsed.renderer.post.compile_on_startup,
                shader_id: if parsed.renderer.post.shader_id.trim().is_empty() {
                    "renderer_zen_atmosphere".to_string()
                } else {
                    parsed.renderer.post.shader_id
                },
                shader_source_path: parsed.renderer.post.shader_source_path,
                shader_compiled_path: parsed.renderer.post.shader_compiled_path,
                glow_strength: parsed.renderer.post.glow_strength.clamp(0.0, 4.0),
                haze_strength: parsed.renderer.post.haze_strength.clamp(0.0, 4.0),
                sun_disk_power: parsed.renderer.post.sun_disk_power.clamp(2.0, 256.0),
                sky_top: parsed.renderer.post.sky_top,
                sky_horizon: parsed.renderer.post.sky_horizon,
                ground_color: parsed.renderer.post.ground_color,
                fog_color: parsed.renderer.post.fog_color,
                shadow_color: parsed.renderer.post.shadow_color,
            },
        },
    })
}

fn parse_kain_ui_config(parsed: Option<KainUiConfigFile>) -> KainUiConfig {
    let parsed = parsed.unwrap_or(KainUiConfigFile {
        enabled: true,
        source_path: Some("crates/zen/resources/zen_shell.kn".to_string()),
        modules_manifest_path: Some("crates/zen/resources/modules.toml".to_string()),
        workspace_manifest_path: Some("crates/zen/resources/workspace_ui.toml".to_string()),
        theme_manifest_path: Some("crates/zen/resources/theme.toml".to_string()),
        hot_reload_enabled: Some(true),
        hot_reload_poll_ms: Some(400),
        active_shell: Some("zen.shell.main".to_string()),
        host_api_path: Some("crates/zen/resources/host_api.toml".to_string()),
        root_component: Some("App".to_string()),
        show_runtime_inspector: false,
    });

    KainUiConfig {
        enabled: parsed.enabled,
        modules_manifest_path: parsed
            .modules_manifest_path
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("crates/zen/resources/modules.toml")
            .to_string(),
        workspace_manifest_path: parsed
            .workspace_manifest_path
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("crates/zen/resources/workspace_ui.toml")
            .to_string(),
        theme_manifest_path: parsed
            .theme_manifest_path
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("crates/zen/resources/theme.toml")
            .to_string(),
        hot_reload_enabled: parsed.hot_reload_enabled.unwrap_or(true),
        hot_reload_poll_ms: parsed.hot_reload_poll_ms.unwrap_or(400).clamp(100, 5_000),
        active_shell: parsed
            .active_shell
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("zen.shell.main")
            .to_string(),
        host_api_path: parsed
            .host_api_path
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("crates/zen/resources/host_api.toml")
            .to_string(),
        root_component: parsed
            .root_component
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| {
                parsed
                    .source_path
                    .as_deref()
                    .filter(|value| !value.trim().is_empty())
                    .map(|_| "App")
                    .unwrap_or("App")
            })
            .to_string(),
        show_runtime_inspector: parsed.show_runtime_inspector,
    }
}

fn parse_kain_fabric_config(parsed: Option<KainFabricConfigFile>) -> KainFabricConfig {
    let parsed = parsed.unwrap_or(KainFabricConfigFile {
        enabled: Some(true),
        manifest_path: Some("crates/k-os-kain/fabric/zen-dcc/KAIN.fabric.toml".to_string()),
    });

    KainFabricConfig {
        enabled: parsed.enabled.unwrap_or(true),
        manifest_path: parsed
            .manifest_path
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("crates/k-os-kain/fabric/zen-dcc/KAIN.fabric.toml")
            .to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_default_runtime_manifest() {
        let config = parse_runtime_config(DEFAULT_RUNTIME_CONFIG)
            .expect("default runtime config should parse");
        assert!(config.window.width >= config.window.min_width);
        assert!(config.camera.fov_degrees >= 25.0);
        assert!(config.kain.dispatch_interval_frames >= 1);
        assert!(!config.kain.ui.modules_manifest_path.is_empty());
        assert!(!config.kain.ui.active_shell.is_empty());
        assert!(!config.kain.ui.host_api_path.is_empty());
        assert!(!config.kain.fabric.manifest_path.is_empty());
        assert!(config.renderer.shadow_map_size >= 512);
        assert!(config.renderer.grid_intensity >= 0.0);
        assert!(!config.renderer.post.shader_id.is_empty());
    }
}

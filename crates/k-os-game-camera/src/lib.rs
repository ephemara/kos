use bevy_ecs::prelude::Resource;
use k_os_game_framework::{
    GameDataRegistryState, GameRuntimeActionBindings, GameRuntimeRegistryBindings,
};
use std::collections::BTreeMap;

const DEFAULT_CAMERA_REGISTRY_KIND: &str = "camera_rigs";
const DEFAULT_TRANSITION_SECONDS: f32 = 0.2;

#[derive(Debug, Clone, PartialEq, Resource)]
pub struct GameCameraRuntimeState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub registry_kind: String,
    pub registry_version: Option<String>,
    pub active_rig: Option<String>,
    pub previous_rig: Option<String>,
    pub transition_seconds: f32,
    pub available_rigs: Vec<String>,
    pub rig_modes: BTreeMap<String, String>,
    pub action_routes_loaded: usize,
    pub selected_route: Option<String>,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Resource)]
pub struct GameCameraViewRuntimeState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub active_rig: Option<String>,
    pub active_mode: Option<String>,
    pub view_source: String,
    pub apply_to_host_camera: bool,
    pub orbit_focus: [f32; 3],
    pub orbit_radius: f32,
    pub camera_translation: [f32; 3],
    pub blend_seconds: f32,
    pub issues: Vec<String>,
}

impl Default for GameCameraViewRuntimeState {
    fn default() -> Self {
        Self {
            ready: false,
            status: "pending".to_string(),
            detail: "awaiting camera runtime rig selection".to_string(),
            active_rig: None,
            active_mode: None,
            view_source: "none".to_string(),
            apply_to_host_camera: false,
            orbit_focus: [0.0, 1.5, 0.0],
            orbit_radius: 6.0,
            camera_translation: [0.0, 2.5, 6.0],
            blend_seconds: DEFAULT_TRANSITION_SECONDS,
            issues: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Resource)]
pub struct GameCameraDispatchState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub registry_kind: String,
    pub registry_version: Option<String>,
    pub routes_loaded: usize,
    pub selected_route: Option<String>,
    pub selected_track_id: Option<String>,
    pub selected_binding_target: Option<String>,
    pub selected_intensity: f32,
    pub active_rig: Option<String>,
    pub blend_seconds: Option<f32>,
    pub issues: Vec<String>,
}

impl Default for GameCameraDispatchState {
    fn default() -> Self {
        Self {
            ready: false,
            status: "pending".to_string(),
            detail: "awaiting camera registry state".to_string(),
            registry_kind: DEFAULT_CAMERA_REGISTRY_KIND.to_string(),
            registry_version: None,
            routes_loaded: 0,
            selected_route: None,
            selected_track_id: None,
            selected_binding_target: None,
            selected_intensity: 0.0,
            active_rig: None,
            blend_seconds: None,
            issues: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct GameSequencerCameraDispatchInput {
    pub track_id: String,
    pub binding_target: String,
    pub route_key: String,
    pub intensity: f32,
}

pub fn derive_runtime_camera_dispatch_state(
    registry_state: Option<&GameDataRegistryState>,
    sequencer_dispatch_inputs: &[GameSequencerCameraDispatchInput],
    previous: Option<&GameCameraDispatchState>,
) -> GameCameraDispatchState {
    let mut state = GameCameraDispatchState::default();

    let Some(registry_state) = registry_state else {
        return state;
    };

    let Some(snapshot) = registry_state.loaded.get(DEFAULT_CAMERA_REGISTRY_KIND) else {
        state.status = "degraded".to_string();
        state.detail = format!(
            "missing required '{}' registry in runtime cache",
            DEFAULT_CAMERA_REGISTRY_KIND
        );
        state.issues = registry_state.errors.clone();
        state.issues.push(state.detail.clone());
        return state;
    };

    state.registry_version = Some(snapshot.version.clone());
    state.issues = registry_state.errors.clone();

    let document = match load_registry_document(&snapshot.asset_path) {
        Ok(document) => document,
        Err(error) => {
            state.status = "degraded".to_string();
            state.detail = "failed to parse camera registry".to_string();
            state.issues.push(error);
            return state;
        }
    };

    let (rigs, _) = parse_rigs(&document, &mut state.issues);
    let available_rigs: Vec<String> = rigs.keys().cloned().collect();
    let routes = parse_sequencer_projection_routes(&document, &mut state.issues);
    state.routes_loaded = routes.len();

    let selected = select_sequencer_projection(
        &routes,
        sequencer_dispatch_inputs,
        previous,
        &available_rigs,
    );
    state.selected_route = selected.route_key;
    state.selected_track_id = selected.track_id;
    state.selected_binding_target = selected.binding_target;
    state.selected_intensity = selected.intensity;

    if let Some(candidate_rig) = selected.rig {
        if available_rigs.iter().any(|rig_id| rig_id == &candidate_rig) {
            state.active_rig = Some(candidate_rig);
            state.blend_seconds = selected.blend_seconds;
        } else {
            state.issues.push(format!(
                "sequencer-projected camera rig '{}' is not declared in camera registry",
                candidate_rig
            ));
        }
    }

    state.ready = state.issues.is_empty() && state.active_rig.is_some();
    state.status = if state.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    state.detail = if state.ready {
        format!(
            "camera dispatch ready with active rig '{}'",
            state.active_rig.clone().unwrap_or_default()
        )
    } else if sequencer_dispatch_inputs.is_empty() {
        "camera dispatch waiting for sequencer track inputs".to_string()
    } else {
        "camera dispatch has unresolved routing or registry issues".to_string()
    };

    state
}

impl Default for GameCameraRuntimeState {
    fn default() -> Self {
        Self {
            ready: false,
            status: "pending".to_string(),
            detail: "awaiting camera registry state".to_string(),
            registry_kind: DEFAULT_CAMERA_REGISTRY_KIND.to_string(),
            registry_version: None,
            active_rig: None,
            previous_rig: None,
            transition_seconds: DEFAULT_TRANSITION_SECONDS,
            available_rigs: Vec::new(),
            rig_modes: BTreeMap::new(),
            action_routes_loaded: 0,
            selected_route: None,
            issues: Vec::new(),
        }
    }
}

#[derive(Debug, Clone)]
struct CameraRigRuntimeSpec {
    mode: String,
    target_offset: Option<[f32; 3]>,
    arm_length: Option<f32>,
    default_path: Option<String>,
    move_speed: Option<f32>,
}

#[derive(Debug, Clone)]
struct CameraViewPolicy {
    apply_to_host_camera: bool,
    fallback_focus: [f32; 3],
    fallback_arm_length: f32,
    spring_arm_height_ratio: f32,
    rail_height_offset: f32,
    rail_distance_scale: f32,
    freefly_height_offset: f32,
    freefly_distance_scale: f32,
    dispatch_intensity_radius_scale: f32,
    dispatch_intensity_height_scale: f32,
}

impl Default for CameraViewPolicy {
    fn default() -> Self {
        Self {
            apply_to_host_camera: false,
            fallback_focus: [0.0, 1.5, 0.0],
            fallback_arm_length: 6.0,
            spring_arm_height_ratio: 0.28,
            rail_height_offset: 1.25,
            rail_distance_scale: 0.7,
            freefly_height_offset: 1.0,
            freefly_distance_scale: 0.2,
            dispatch_intensity_radius_scale: 0.15,
            dispatch_intensity_height_scale: 0.35,
        }
    }
}

pub fn derive_runtime_camera_view_state(
    registry_state: Option<&GameDataRegistryState>,
    camera_state: Option<&GameCameraRuntimeState>,
    camera_dispatch_state: Option<&GameCameraDispatchState>,
) -> GameCameraViewRuntimeState {
    let mut state = GameCameraViewRuntimeState::default();
    let Some(registry_state) = registry_state else {
        return state;
    };
    state.issues = registry_state.errors.clone();

    let Some(camera_state) = camera_state else {
        state.status = "pending".to_string();
        state.detail = "awaiting camera runtime state".to_string();
        return state;
    };
    state.active_rig = camera_state.active_rig.clone();
    state.active_mode = camera_state
        .active_rig
        .as_deref()
        .and_then(|rig| camera_state.rig_modes.get(rig).cloned());
    state.blend_seconds = camera_state.transition_seconds;

    let Some(snapshot) = registry_state.loaded.get(DEFAULT_CAMERA_REGISTRY_KIND) else {
        state.status = "degraded".to_string();
        state.detail = format!(
            "missing required '{}' registry in runtime cache",
            DEFAULT_CAMERA_REGISTRY_KIND
        );
        state.issues.push(state.detail.clone());
        return state;
    };

    let document = match load_registry_document(&snapshot.asset_path) {
        Ok(document) => document,
        Err(error) => {
            state.status = "degraded".to_string();
            state.detail = "failed to parse camera registry".to_string();
            state.issues.push(error);
            return state;
        }
    };

    let policy = parse_runtime_view_policy(&document, &mut state.issues);
    state.apply_to_host_camera = policy.apply_to_host_camera;

    let Some(active_rig) = camera_state.active_rig.as_deref() else {
        state.status = "degraded".to_string();
        state.detail = "camera runtime did not provide an active rig".to_string();
        state.issues.push(state.detail.clone());
        return state;
    };

    let Some(spec) = parse_rig_runtime_spec(&document, active_rig, &mut state.issues) else {
        state.status = "degraded".to_string();
        state.detail = format!("active rig '{active_rig}' missing from camera registry rigs table");
        state.issues.push(state.detail.clone());
        return state;
    };

    let mut orbit_focus = spec.target_offset.unwrap_or(policy.fallback_focus);
    let mut orbit_radius = spec
        .arm_length
        .filter(|value| *value > 0.0)
        .unwrap_or(policy.fallback_arm_length);

    let mut dispatch_intensity = 0.0f32;
    if let Some(dispatch) = camera_dispatch_state {
        if dispatch.ready
            && dispatch
                .active_rig
                .as_deref()
                .is_some_and(|value| value == active_rig)
        {
            state.view_source = "camera_dispatch".to_string();
            dispatch_intensity = dispatch.selected_intensity.max(0.0);
            if let Some(blend) = dispatch.blend_seconds {
                state.blend_seconds = blend.max(0.0);
            }
        }
    }
    if state.view_source == "none" {
        state.view_source = "camera_runtime".to_string();
    }

    orbit_radius *= 1.0 + (dispatch_intensity * policy.dispatch_intensity_radius_scale);
    state.orbit_radius = orbit_radius.max(0.1);
    state.orbit_focus = orbit_focus;

    let translation = match spec.mode.as_str() {
        "rail" => {
            let path_seed = spec.default_path.as_deref().unwrap_or(active_rig);
            let yaw = stable_seed_angle_radians(path_seed);
            let planar = state.orbit_radius * policy.rail_distance_scale.max(0.1);
            orbit_focus[1] += policy.rail_height_offset
                + (dispatch_intensity * policy.dispatch_intensity_height_scale);
            [
                orbit_focus[0] + (planar * yaw.cos()),
                orbit_focus[1],
                orbit_focus[2] + (planar * yaw.sin()),
            ]
        }
        "freefly" => {
            let speed = spec.move_speed.unwrap_or(6.0).max(0.1);
            let planar = state.orbit_radius * policy.freefly_distance_scale.max(0.05) * speed / 6.0;
            [
                orbit_focus[0] + planar,
                orbit_focus[1] + policy.freefly_height_offset,
                orbit_focus[2] + planar,
            ]
        }
        _ => [
            orbit_focus[0],
            orbit_focus[1] + (state.orbit_radius * policy.spring_arm_height_ratio),
            orbit_focus[2] + state.orbit_radius,
        ],
    };

    state.orbit_focus = orbit_focus;
    state.camera_translation = translation;

    state.ready = camera_state.ready && state.issues.is_empty();
    state.status = if state.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    state.detail = if state.ready {
        format!(
            "camera view resolved for rig '{}' mode '{}'",
            active_rig, spec.mode
        )
    } else {
        "camera view has unresolved rig/policy issues".to_string()
    };
    state
}

pub fn derive_runtime_camera_state(
    registry_state: Option<&GameDataRegistryState>,
    runtime_bindings: Option<&GameRuntimeRegistryBindings>,
    action_bindings: Option<&GameRuntimeActionBindings>,
    dispatch_state: Option<&GameCameraDispatchState>,
    previous: Option<&GameCameraRuntimeState>,
) -> GameCameraRuntimeState {
    let mut state = GameCameraRuntimeState::default();

    let Some(registry_state) = registry_state else {
        return state;
    };

    let Some(snapshot) = registry_state.loaded.get(DEFAULT_CAMERA_REGISTRY_KIND) else {
        state.status = "degraded".to_string();
        state.detail = format!(
            "missing required '{}' registry in runtime cache",
            DEFAULT_CAMERA_REGISTRY_KIND
        );
        state.issues = registry_state.errors.clone();
        state.issues.push(state.detail.clone());
        return state;
    };

    state.registry_version = Some(snapshot.version.clone());
    state.issues = registry_state.errors.clone();

    let document = match load_registry_document(&snapshot.asset_path) {
        Ok(document) => document,
        Err(error) => {
            state.status = "degraded".to_string();
            state.detail = "failed to parse camera registry".to_string();
            state.issues.push(error);
            return state;
        }
    };

    let (rigs, rig_blends) = parse_rigs(&document, &mut state.issues);
    state.available_rigs = rigs.keys().cloned().collect();
    state.rig_modes = rigs;

    let routes = parse_action_routes(&document, &mut state.issues);
    state.action_routes_loaded = routes.len();

    let selected = select_camera_rig(
        &routes,
        action_bindings,
        runtime_bindings,
        dispatch_state,
        previous,
        &state.available_rigs,
    );

    if let Some(route_key) = selected.route_key {
        state.selected_route = Some(route_key);
    }

    if let Some(candidate_rig) = selected.rig {
        if state
            .available_rigs
            .iter()
            .any(|rig_id| rig_id == &candidate_rig)
        {
            state.active_rig = Some(candidate_rig.clone());
            if let Some(previous_state) = previous {
                state.previous_rig = previous_state.active_rig.clone();
            }

            let did_change = previous
                .and_then(|item| item.active_rig.as_ref())
                .is_some_and(|existing| existing != &candidate_rig);
            if did_change {
                state.transition_seconds = selected
                    .blend_seconds
                    .or_else(|| rig_blends.get(&candidate_rig).copied())
                    .unwrap_or(DEFAULT_TRANSITION_SECONDS);
            } else {
                state.transition_seconds = selected
                    .blend_seconds
                    .or_else(|| rig_blends.get(&candidate_rig).copied())
                    .unwrap_or_else(|| {
                        previous
                            .map(|item| item.transition_seconds)
                            .unwrap_or(DEFAULT_TRANSITION_SECONDS)
                    });
            }
        } else {
            state.issues.push(format!(
                "selected camera rig '{}' is not declared in camera registry",
                candidate_rig
            ));
        }
    } else {
        state
            .issues
            .push("no camera rig selected from runtime inputs".to_string());
    }

    state.ready = state.issues.is_empty() && state.active_rig.is_some();
    state.status = if state.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    state.detail = if state.ready {
        format!(
            "camera runtime ready with active rig '{}'",
            state.active_rig.clone().unwrap_or_default()
        )
    } else {
        "camera runtime has unresolved routing or registry issues".to_string()
    };
    state
}

#[derive(Debug, Clone)]
struct CameraRigActionRoute {
    agent: Option<String>,
    phase: Option<String>,
    gameplay_action_prefix: String,
    target_rig: String,
    blend_seconds: Option<f32>,
    priority: u32,
}

impl CameraRigActionRoute {
    fn matches(&self, agent: &str, phase: &str, action: &str) -> bool {
        self.agent.as_deref().is_none_or(|value| value == agent)
            && self.phase.as_deref().is_none_or(|value| value == phase)
            && action.starts_with(&self.gameplay_action_prefix)
    }
}

#[derive(Debug, Clone)]
struct SequencerCameraProjectionRoute {
    binding_target_prefix: String,
    target_rig: String,
    blend_seconds: Option<f32>,
    min_intensity: f32,
    priority: u32,
}

#[derive(Debug, Clone, Default)]
struct SelectedCameraRig {
    rig: Option<String>,
    route_key: Option<String>,
    blend_seconds: Option<f32>,
}

#[derive(Debug, Clone, Default)]
struct SelectedCameraDispatchRig {
    rig: Option<String>,
    route_key: Option<String>,
    track_id: Option<String>,
    binding_target: Option<String>,
    intensity: f32,
    blend_seconds: Option<f32>,
}

fn select_sequencer_projection(
    routes: &[SequencerCameraProjectionRoute],
    inputs: &[GameSequencerCameraDispatchInput],
    previous: Option<&GameCameraDispatchState>,
    available_rigs: &[String],
) -> SelectedCameraDispatchRig {
    let mut selected = SelectedCameraDispatchRig::default();
    let mut best: Option<(
        usize,
        &SequencerCameraProjectionRoute,
        &GameSequencerCameraDispatchInput,
    )> = None;

    for input in inputs {
        for (index, route) in routes.iter().enumerate() {
            if !input
                .binding_target
                .starts_with(&route.binding_target_prefix)
            {
                continue;
            }
            if input.intensity < route.min_intensity {
                continue;
            }

            let should_replace = match best {
                Some((_, existing_route, existing_input)) => {
                    (
                        route.priority,
                        route.binding_target_prefix.len(),
                        input.intensity.to_bits(),
                    ) > (
                        existing_route.priority,
                        existing_route.binding_target_prefix.len(),
                        existing_input.intensity.to_bits(),
                    )
                }
                None => true,
            };
            if should_replace {
                best = Some((index, route, input));
            }
        }
    }

    if let Some((index, route, input)) = best {
        selected.rig = Some(route.target_rig.clone());
        selected.route_key = Some(format!(
            "sequencer_projection.routes[{index}]::{}",
            route.binding_target_prefix
        ));
        selected.track_id = Some(input.track_id.clone());
        selected.binding_target = Some(input.binding_target.clone());
        selected.intensity = input.intensity;
        selected.blend_seconds = route.blend_seconds;
        return selected;
    }

    if let Some(previous) = previous {
        if let Some(previous_rig) = &previous.active_rig {
            if available_rigs.iter().any(|rig| rig == previous_rig) {
                selected.rig = Some(previous_rig.clone());
                selected.route_key = Some("camera_dispatch.previous.active_rig".to_string());
                selected.track_id = previous.selected_track_id.clone();
                selected.binding_target = previous.selected_binding_target.clone();
                selected.intensity = previous.selected_intensity;
                selected.blend_seconds = previous.blend_seconds;
                return selected;
            }
        }
    }

    selected
}

fn select_camera_rig(
    routes: &[CameraRigActionRoute],
    action_bindings: Option<&GameRuntimeActionBindings>,
    runtime_bindings: Option<&GameRuntimeRegistryBindings>,
    dispatch_state: Option<&GameCameraDispatchState>,
    previous: Option<&GameCameraRuntimeState>,
    available_rigs: &[String],
) -> SelectedCameraRig {
    let mut selected = SelectedCameraRig::default();

    if let Some(dispatch_state) = dispatch_state {
        if dispatch_state.ready {
            if let Some(active_rig) = &dispatch_state.active_rig {
                selected.rig = Some(active_rig.clone());
                selected.route_key = dispatch_state
                    .selected_route
                    .clone()
                    .or_else(|| Some("camera_dispatch.active_rig".to_string()));
                selected.blend_seconds = dispatch_state.blend_seconds;
                return selected;
            }
        }
    }

    if let Some(action_bindings) = action_bindings {
        let active_phase = action_bindings.active_phase.as_str();
        let mut best: Option<(usize, &CameraRigActionRoute)> = None;

        for (agent, action) in &action_bindings.agent_actions {
            for (index, route) in routes.iter().enumerate() {
                if !route.matches(agent, active_phase, action) {
                    continue;
                }
                let should_replace = match best {
                    Some((_, current)) => {
                        (route.priority, route.gameplay_action_prefix.len())
                            > (current.priority, current.gameplay_action_prefix.len())
                    }
                    None => true,
                };
                if should_replace {
                    best = Some((index, route));
                }
            }
        }

        if let Some((index, route)) = best {
            selected.rig = Some(route.target_rig.clone());
            selected.route_key = Some(format!(
                "action_projection.routes[{index}]::{}",
                route.gameplay_action_prefix
            ));
            selected.blend_seconds = route.blend_seconds;
            return selected;
        }

        // Fallback to gameplay action lane camera hint if route table has no match.
        if let Some((agent, rig_id)) = action_bindings.agent_camera_rigs.iter().next() {
            selected.rig = Some(rig_id.clone());
            selected.route_key = Some(format!("game_play.agent_camera_rigs[{agent}]"));
            return selected;
        }
    }

    if let Some(default_rig) =
        runtime_bindings.and_then(|bindings| bindings.default_player_camera_rig.clone())
    {
        selected.rig = Some(default_rig);
        selected.route_key = Some("runtime_bindings.default_player_camera_rig".to_string());
        return selected;
    }

    if let Some(previous_rig) = previous.and_then(|state| state.active_rig.clone()) {
        if available_rigs.iter().any(|rig_id| rig_id == &previous_rig) {
            selected.rig = Some(previous_rig);
            selected.route_key = Some("previous.active_rig".to_string());
            return selected;
        }
    }

    if let Some(first_rig) = available_rigs.first() {
        selected.rig = Some(first_rig.clone());
        selected.route_key = Some("camera_registry.first_declared_rig".to_string());
    }

    selected
}

fn load_registry_document(path: &str) -> Result<toml::value::Table, String> {
    let raw = std::fs::read_to_string(path)
        .map_err(|error| format!("failed to read registry '{}': {error}", path))?;
    let parsed = raw
        .parse::<toml::Value>()
        .map_err(|error| format!("failed to parse registry TOML '{}': {error}", path))?;
    parsed
        .as_table()
        .cloned()
        .ok_or_else(|| format!("registry '{}' did not parse as TOML table", path))
}

fn parse_rigs(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> (BTreeMap<String, String>, BTreeMap<String, f32>) {
    let Some(entries) = document.get("rigs").and_then(toml::Value::as_array) else {
        issues.push("camera registry missing required array 'rigs'".to_string());
        return (BTreeMap::new(), BTreeMap::new());
    };

    let mut rig_modes = BTreeMap::new();
    let mut rig_blends = BTreeMap::new();

    for (index, entry) in entries.iter().enumerate() {
        let Some(table) = entry.as_table() else {
            issues.push(format!("rigs[{index}] is not a table"));
            continue;
        };
        let Some(id) = table.get("id").and_then(toml::Value::as_str) else {
            issues.push(format!("rigs[{index}] missing 'id'"));
            continue;
        };
        let Some(mode) = table.get("mode").and_then(toml::Value::as_str) else {
            issues.push(format!("rigs[{index}] missing 'mode'"));
            continue;
        };
        let id = id.trim();
        let mode = mode.trim();
        if id.is_empty() {
            issues.push(format!("rigs[{index}] has empty 'id'"));
            continue;
        }
        if mode.is_empty() {
            issues.push(format!("rigs[{index}] has empty 'mode'"));
            continue;
        }
        if rig_modes.insert(id.to_string(), mode.to_string()).is_some() {
            issues.push(format!("duplicate camera rig id '{id}'"));
            continue;
        }

        if let Some(blend_seconds) = table.get("blend_seconds").and_then(toml::Value::as_float) {
            if blend_seconds < 0.0 {
                issues.push(format!("rig '{id}' has negative blend_seconds"));
            } else {
                rig_blends.insert(id.to_string(), blend_seconds as f32);
            }
        }
    }

    (rig_modes, rig_blends)
}

fn parse_action_routes(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> Vec<CameraRigActionRoute> {
    let mut routes = Vec::new();

    let Some(action_projection) = document
        .get("action_projection")
        .and_then(toml::Value::as_table)
    else {
        return routes;
    };

    let Some(entries) = action_projection
        .get("routes")
        .and_then(toml::Value::as_array)
    else {
        issues.push(
            "camera registry table 'action_projection' missing required array 'routes'".to_string(),
        );
        return routes;
    };

    for (index, entry) in entries.iter().enumerate() {
        let Some(table) = entry.as_table() else {
            issues.push(format!("action_projection.routes[{index}] is not a table"));
            continue;
        };

        let Some(prefix) = table
            .get("gameplay_action_prefix")
            .and_then(toml::Value::as_str)
        else {
            issues.push(format!(
                "action_projection.routes[{index}] missing 'gameplay_action_prefix'"
            ));
            continue;
        };
        let Some(target_rig) = table.get("target_rig").and_then(toml::Value::as_str) else {
            issues.push(format!(
                "action_projection.routes[{index}] missing 'target_rig'"
            ));
            continue;
        };

        let prefix = prefix.trim();
        let target_rig = target_rig.trim();
        if prefix.is_empty() {
            issues.push(format!(
                "action_projection.routes[{index}] has empty 'gameplay_action_prefix'"
            ));
            continue;
        }
        if target_rig.is_empty() {
            issues.push(format!(
                "action_projection.routes[{index}] has empty 'target_rig'"
            ));
            continue;
        }

        let blend_seconds = table
            .get("blend_seconds")
            .and_then(toml::Value::as_float)
            .map(|value| value as f32)
            .filter(|value| *value >= 0.0);
        if table.get("blend_seconds").is_some() && blend_seconds.is_none() {
            issues.push(format!(
                "action_projection.routes[{index}] has invalid 'blend_seconds' (must be >= 0)"
            ));
        }

        let priority = table
            .get("priority")
            .and_then(toml::Value::as_integer)
            .and_then(|value| u32::try_from(value).ok())
            .unwrap_or(100);

        let agent = table
            .get("agent")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);

        let phase = table
            .get("phase")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);

        routes.push(CameraRigActionRoute {
            agent,
            phase,
            gameplay_action_prefix: prefix.to_string(),
            target_rig: target_rig.to_string(),
            blend_seconds,
            priority,
        });
    }

    routes
}

fn parse_sequencer_projection_routes(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> Vec<SequencerCameraProjectionRoute> {
    let mut routes = Vec::new();

    let Some(sequencer_projection) = document
        .get("sequencer_projection")
        .and_then(toml::Value::as_table)
    else {
        return routes;
    };

    let Some(entries) = sequencer_projection
        .get("routes")
        .and_then(toml::Value::as_array)
    else {
        issues.push(
            "camera registry table 'sequencer_projection' missing required array 'routes'"
                .to_string(),
        );
        return routes;
    };

    for (index, entry) in entries.iter().enumerate() {
        let Some(table) = entry.as_table() else {
            issues.push(format!(
                "sequencer_projection.routes[{index}] is not a table"
            ));
            continue;
        };

        let Some(binding_target_prefix) = table
            .get("binding_target_prefix")
            .and_then(toml::Value::as_str)
        else {
            issues.push(format!(
                "sequencer_projection.routes[{index}] missing 'binding_target_prefix'"
            ));
            continue;
        };
        let Some(target_rig) = table.get("target_rig").and_then(toml::Value::as_str) else {
            issues.push(format!(
                "sequencer_projection.routes[{index}] missing 'target_rig'"
            ));
            continue;
        };

        let binding_target_prefix = binding_target_prefix.trim();
        let target_rig = target_rig.trim();
        if binding_target_prefix.is_empty() {
            issues.push(format!(
                "sequencer_projection.routes[{index}] has empty 'binding_target_prefix'"
            ));
            continue;
        }
        if target_rig.is_empty() {
            issues.push(format!(
                "sequencer_projection.routes[{index}] has empty 'target_rig'"
            ));
            continue;
        }

        let min_intensity = table
            .get("min_intensity")
            .and_then(toml::Value::as_float)
            .map(|value| value as f32)
            .unwrap_or(0.0)
            .max(0.0);

        let blend_seconds = table
            .get("blend_seconds")
            .and_then(toml::Value::as_float)
            .map(|value| value as f32)
            .filter(|value| *value >= 0.0);
        if table.get("blend_seconds").is_some() && blend_seconds.is_none() {
            issues.push(format!(
                "sequencer_projection.routes[{index}] has invalid 'blend_seconds' (must be >= 0)"
            ));
        }

        let priority = table
            .get("priority")
            .and_then(toml::Value::as_integer)
            .and_then(|value| u32::try_from(value).ok())
            .unwrap_or(100);

        routes.push(SequencerCameraProjectionRoute {
            binding_target_prefix: binding_target_prefix.to_string(),
            target_rig: target_rig.to_string(),
            blend_seconds,
            min_intensity,
            priority,
        });
    }

    routes
}

fn parse_rig_runtime_spec(
    document: &toml::value::Table,
    active_rig: &str,
    issues: &mut Vec<String>,
) -> Option<CameraRigRuntimeSpec> {
    let Some(rigs) = document.get("rigs").and_then(toml::Value::as_array) else {
        issues.push("camera registry missing required array 'rigs'".to_string());
        return None;
    };

    for entry in rigs {
        let Some(table) = entry.as_table() else {
            continue;
        };
        let id = table.get("id").and_then(toml::Value::as_str).map(str::trim);
        if id != Some(active_rig) {
            continue;
        }

        let mode = table
            .get("mode")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("spring_arm")
            .to_string();
        let target_offset = parse_vec3(table.get("target_offset"));
        let arm_length = parse_optional_f32(table.get("arm_length")).filter(|value| *value > 0.0);
        let default_path = table
            .get("default_path")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let move_speed = parse_optional_f32(table.get("move_speed")).filter(|value| *value > 0.0);

        return Some(CameraRigRuntimeSpec {
            mode,
            target_offset,
            arm_length,
            default_path,
            move_speed,
        });
    }

    None
}

fn parse_runtime_view_policy(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> CameraViewPolicy {
    let mut policy = CameraViewPolicy::default();
    let Some(runtime_view) = document.get("runtime_view").and_then(toml::Value::as_table) else {
        return policy;
    };

    if let Some(value) = parse_optional_bool(runtime_view.get("apply_to_host_camera")) {
        policy.apply_to_host_camera = value;
    }

    if let Some(value) = parse_vec3(runtime_view.get("fallback_focus")) {
        policy.fallback_focus = value;
    } else if runtime_view.get("fallback_focus").is_some() {
        issues.push("runtime_view.fallback_focus must be a numeric vec3".to_string());
    }

    if let Some(value) = parse_optional_f32(runtime_view.get("fallback_arm_length")) {
        if value > 0.0 {
            policy.fallback_arm_length = value;
        }
    }

    assign_non_negative_f32(
        runtime_view,
        "spring_arm_height_ratio",
        &mut policy.spring_arm_height_ratio,
    );
    assign_non_negative_f32(
        runtime_view,
        "rail_height_offset",
        &mut policy.rail_height_offset,
    );
    assign_non_negative_f32(
        runtime_view,
        "rail_distance_scale",
        &mut policy.rail_distance_scale,
    );
    assign_non_negative_f32(
        runtime_view,
        "freefly_height_offset",
        &mut policy.freefly_height_offset,
    );
    assign_non_negative_f32(
        runtime_view,
        "freefly_distance_scale",
        &mut policy.freefly_distance_scale,
    );
    assign_non_negative_f32(
        runtime_view,
        "dispatch_intensity_radius_scale",
        &mut policy.dispatch_intensity_radius_scale,
    );
    assign_non_negative_f32(
        runtime_view,
        "dispatch_intensity_height_scale",
        &mut policy.dispatch_intensity_height_scale,
    );

    policy
}

fn assign_non_negative_f32(table: &toml::value::Table, key: &str, target: &mut f32) {
    if let Some(value) = parse_optional_f32(table.get(key)) {
        if value >= 0.0 {
            *target = value;
        }
    }
}

fn parse_vec3(value: Option<&toml::Value>) -> Option<[f32; 3]> {
    let list = value?.as_array()?;
    if list.len() != 3 {
        return None;
    }
    let x = list.first()?.as_float()? as f32;
    let y = list.get(1)?.as_float()? as f32;
    let z = list.get(2)?.as_float()? as f32;
    Some([x, y, z])
}

fn parse_optional_f32(value: Option<&toml::Value>) -> Option<f32> {
    value
        .and_then(toml::Value::as_float)
        .map(|item| item as f32)
}

fn parse_optional_bool(value: Option<&toml::Value>) -> Option<bool> {
    value.and_then(toml::Value::as_bool)
}

fn stable_seed_angle_radians(seed: &str) -> f32 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in seed.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    let degrees = (hash % 360) as f32;
    degrees.to_radians()
}

#[cfg(test)]
mod tests {
    use super::*;
    use k_os_game_framework::{GameDataRegistryState, RegistrySnapshot};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn write_temp_registry(name: &str, content: &str) -> String {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("k_os_game_camera_{name}_{nonce}.toml"));
        std::fs::write(&path, content).expect("write temp registry");
        path.to_string_lossy().into_owned()
    }

    fn camera_registry_state(camera_path: String) -> GameDataRegistryState {
        let mut state = GameDataRegistryState::default();
        state.loaded.insert(
            "camera_rigs".to_string(),
            RegistrySnapshot {
                stage_id: "camera_rigs_registry".to_string(),
                profile: "editor_preview".to_string(),
                merge_strategy: "replace".to_string(),
                asset_path: camera_path,
                version: "1".to_string(),
                required_table_counts: BTreeMap::new(),
            },
        );
        state
    }

    #[test]
    fn projects_camera_rig_from_action_route() {
        let camera_path = write_temp_registry(
            "routes",
            r#"
version = "1"
registry_kind = "camera_rigs"

[[rigs]]
id = "player.follow.third_person"
mode = "spring_arm"

[[rigs]]
id = "cinematic.spline.preview"
mode = "rail"
blend_seconds = 0.6

[action_projection]

[[action_projection.routes]]
agent = "hero.default"
phase = "act"
gameplay_action_prefix = "combat.attack."
target_rig = "cinematic.spline.preview"
blend_seconds = 0.9
priority = 500
"#,
        );

        let mut action_bindings = GameRuntimeActionBindings {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 8,
            active_phase: "act".to_string(),
            ..Default::default()
        };
        action_bindings.agent_actions.insert(
            "hero.default".to_string(),
            "combat.attack.primary_target".to_string(),
        );

        let previous = GameCameraRuntimeState {
            active_rig: Some("player.follow.third_person".to_string()),
            ..Default::default()
        };

        let result = derive_runtime_camera_state(
            Some(&camera_registry_state(camera_path)),
            None,
            Some(&action_bindings),
            None,
            Some(&previous),
        );

        assert!(result.ready);
        assert_eq!(result.status, "ready");
        assert_eq!(
            result.active_rig.as_deref(),
            Some("cinematic.spline.preview")
        );
        assert_eq!(result.transition_seconds, 0.9);
    }

    #[test]
    fn falls_back_to_runtime_default_camera_rig() {
        let camera_path = write_temp_registry(
            "default",
            r#"
version = "1"
registry_kind = "camera_rigs"

[[rigs]]
id = "player.follow.third_person"
mode = "spring_arm"
"#,
        );

        let runtime_bindings = GameRuntimeRegistryBindings {
            default_player_camera_rig: Some("player.follow.third_person".to_string()),
            ..Default::default()
        };

        let result = derive_runtime_camera_state(
            Some(&camera_registry_state(camera_path)),
            Some(&runtime_bindings),
            None,
            None,
            None,
        );

        assert!(result.ready);
        assert_eq!(
            result.active_rig.as_deref(),
            Some("player.follow.third_person")
        );
        assert_eq!(
            result.selected_route.as_deref(),
            Some("runtime_bindings.default_player_camera_rig")
        );
    }

    #[test]
    fn degrades_when_selected_rig_not_in_registry() {
        let camera_path = write_temp_registry(
            "invalid_route",
            r#"
version = "1"
registry_kind = "camera_rigs"

[[rigs]]
id = "player.follow.third_person"
mode = "spring_arm"

[action_projection]

[[action_projection.routes]]
agent = "hero.default"
phase = "act"
gameplay_action_prefix = "combat.attack."
target_rig = "missing.rig"
priority = 300
"#,
        );

        let mut action_bindings = GameRuntimeActionBindings {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 8,
            active_phase: "act".to_string(),
            ..Default::default()
        };
        action_bindings.agent_actions.insert(
            "hero.default".to_string(),
            "combat.attack.primary_target".to_string(),
        );

        let result = derive_runtime_camera_state(
            Some(&camera_registry_state(camera_path)),
            None,
            Some(&action_bindings),
            None,
            None,
        );

        assert!(!result.ready);
        assert_eq!(result.status, "degraded");
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.contains("selected camera rig 'missing.rig'")));
    }

    #[test]
    fn stays_pending_without_registry_state() {
        let result = derive_runtime_camera_state(None, None, None, None, None);
        assert!(!result.ready);
        assert_eq!(result.status, "pending");
    }

    #[test]
    fn projects_camera_rig_from_sequencer_dispatch_route() {
        let camera_path = write_temp_registry(
            "sequencer_projection",
            r#"
version = "1"
registry_kind = "camera_rigs"

[[rigs]]
id = "player.follow.third_person"
mode = "spring_arm"

[[rigs]]
id = "cinematic.spline.preview"
mode = "rail"

[sequencer_projection]

[[sequencer_projection.routes]]
binding_target_prefix = "camera.rig.cinematic."
target_rig = "cinematic.spline.preview"
blend_seconds = 1.1
min_intensity = 0.4
priority = 500
"#,
        );

        let dispatch_inputs = vec![GameSequencerCameraDispatchInput {
            track_id: "camera.attack_close".to_string(),
            binding_target: "camera.rig.cinematic.attack_close".to_string(),
            route_key: "runtime_dispatch.routes[0]::camera.".to_string(),
            intensity: 0.7,
        }];

        let dispatch = derive_runtime_camera_dispatch_state(
            Some(&camera_registry_state(camera_path.clone())),
            &dispatch_inputs,
            None,
        );
        assert!(dispatch.ready);
        assert_eq!(
            dispatch.active_rig.as_deref(),
            Some("cinematic.spline.preview")
        );
        assert_eq!(
            dispatch.selected_track_id.as_deref(),
            Some("camera.attack_close")
        );

        let result = derive_runtime_camera_state(
            Some(&camera_registry_state(camera_path)),
            None,
            None,
            Some(&dispatch),
            None,
        );

        assert!(result.ready);
        assert_eq!(
            result.active_rig.as_deref(),
            Some("cinematic.spline.preview")
        );
        assert!(result
            .selected_route
            .as_deref()
            .is_some_and(|value| value.contains("sequencer_projection.routes")));
        assert_eq!(result.transition_seconds, 1.1);
    }

    #[test]
    fn camera_dispatch_falls_back_to_previous_rig_when_no_route_matches() {
        let camera_path = write_temp_registry(
            "sequencer_projection_fallback",
            r#"
version = "1"
registry_kind = "camera_rigs"

[[rigs]]
id = "player.follow.third_person"
mode = "spring_arm"

[sequencer_projection]

[[sequencer_projection.routes]]
binding_target_prefix = "camera.rig.cinematic."
target_rig = "player.follow.third_person"
priority = 100
"#,
        );

        let previous = GameCameraDispatchState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            registry_kind: "camera_rigs".to_string(),
            registry_version: Some("1".to_string()),
            routes_loaded: 1,
            selected_route: Some("camera_dispatch.previous.active_rig".to_string()),
            selected_track_id: Some("camera.idle".to_string()),
            selected_binding_target: Some("camera.rig.idle".to_string()),
            selected_intensity: 0.5,
            active_rig: Some("player.follow.third_person".to_string()),
            blend_seconds: Some(0.3),
            issues: Vec::new(),
        };

        let dispatch = derive_runtime_camera_dispatch_state(
            Some(&camera_registry_state(camera_path)),
            &[GameSequencerCameraDispatchInput {
                track_id: "camera.attack_close".to_string(),
                binding_target: "camera.rig.unmapped".to_string(),
                route_key: "runtime_dispatch.fallback".to_string(),
                intensity: 1.0,
            }],
            Some(&previous),
        );

        assert!(dispatch.ready);
        assert_eq!(
            dispatch.active_rig.as_deref(),
            Some("player.follow.third_person")
        );
        assert_eq!(
            dispatch.selected_route.as_deref(),
            Some("camera_dispatch.previous.active_rig")
        );
    }

    #[test]
    fn derives_spring_arm_view_from_runtime_policy_and_active_rig() {
        let camera_path = write_temp_registry(
            "camera_view_spring",
            r#"
version = "1"
registry_kind = "camera_rigs"

[[rigs]]
id = "player.follow.third_person"
mode = "spring_arm"
target_offset = [1.0, 1.8, -0.5]
arm_length = 5.0

[runtime_view]
apply_to_host_camera = true
spring_arm_height_ratio = 0.2
"#,
        );
        let registry_state = camera_registry_state(camera_path);
        let camera_state = GameCameraRuntimeState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            active_rig: Some("player.follow.third_person".to_string()),
            transition_seconds: 0.4,
            ..Default::default()
        };

        let view =
            derive_runtime_camera_view_state(Some(&registry_state), Some(&camera_state), None);
        assert!(view.ready);
        assert!(view.apply_to_host_camera);
        assert_eq!(
            view.active_rig.as_deref(),
            Some("player.follow.third_person")
        );
        assert_eq!(view.orbit_focus, [1.0, 1.8, -0.5]);
        assert_eq!(view.orbit_radius, 5.0);
        assert_eq!(view.camera_translation, [1.0, 2.8, 4.5]);
    }

    #[test]
    fn derives_rail_view_with_dispatch_intensity_scaling() {
        let camera_path = write_temp_registry(
            "camera_view_rail",
            r#"
version = "1"
registry_kind = "camera_rigs"

[[rigs]]
id = "cinematic.spline.preview"
mode = "rail"
default_path = "paths/intro_cam_a"
arm_length = 4.0

[runtime_view]
apply_to_host_camera = true
rail_distance_scale = 0.5
dispatch_intensity_radius_scale = 0.25
dispatch_intensity_height_scale = 0.5
"#,
        );
        let registry_state = camera_registry_state(camera_path);
        let camera_state = GameCameraRuntimeState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            active_rig: Some("cinematic.spline.preview".to_string()),
            ..Default::default()
        };
        let dispatch_state = GameCameraDispatchState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            active_rig: Some("cinematic.spline.preview".to_string()),
            selected_intensity: 0.8,
            ..Default::default()
        };

        let view = derive_runtime_camera_view_state(
            Some(&registry_state),
            Some(&camera_state),
            Some(&dispatch_state),
        );
        assert!(view.ready);
        assert_eq!(view.view_source, "camera_dispatch");
        assert!(view.orbit_radius > 4.0);
        assert_eq!(view.camera_translation[1], view.orbit_focus[1]);
    }
}

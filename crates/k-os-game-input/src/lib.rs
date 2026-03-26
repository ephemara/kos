use bevy_ecs::prelude::Resource;
use k_os_game_camera::GameCameraRuntimeState;
use k_os_game_framework::{
    GameDataRegistryState, GameRuntimeActionBindings, GameRuntimeRegistryBindings,
};
use std::collections::{BTreeMap, BTreeSet};

const DEFAULT_INPUT_REGISTRY_KIND: &str = "input_bindings";
const DEFAULT_AXIS_DEADZONE: f32 = 0.15;
const DEFAULT_ACTIVATION_THRESHOLD: f32 = 0.2;
const DEFAULT_MAX_MOUSE_DELTA: f32 = 500.0;

#[derive(Debug, Clone, PartialEq, Resource)]
pub struct GameInputRuntimeState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub registry_kind: String,
    pub registry_version: Option<String>,
    pub tick_index: u64,
    pub active_phase: String,
    pub active_context: Option<String>,
    pub active_camera_rig: Option<String>,
    pub active_camera_mode: Option<String>,
    pub available_contexts: Vec<String>,
    pub action_kinds: BTreeMap<String, String>,
    pub action_defaults: BTreeMap<String, Vec<String>>,
    pub routes_loaded: usize,
    pub camera_policy_rules_loaded: usize,
    pub agent_input_actions: BTreeMap<String, String>,
    pub agent_route_keys: BTreeMap<String, String>,
    pub agent_camera_modes: BTreeMap<String, String>,
    pub agent_action_scales: BTreeMap<String, f32>,
    pub agent_gates: BTreeMap<String, String>,
    pub host_axis_deadzone: f32,
    pub host_activation_threshold: f32,
    pub host_max_mouse_delta: f32,
    pub host_digital_axes: BTreeMap<String, [f32; 2]>,
    pub issues: Vec<String>,
}

impl Default for GameInputRuntimeState {
    fn default() -> Self {
        Self {
            ready: false,
            status: "pending".to_string(),
            detail: "awaiting input registry state".to_string(),
            registry_kind: DEFAULT_INPUT_REGISTRY_KIND.to_string(),
            registry_version: None,
            tick_index: 0,
            active_phase: String::new(),
            active_context: None,
            active_camera_rig: None,
            active_camera_mode: None,
            available_contexts: Vec::new(),
            action_kinds: BTreeMap::new(),
            action_defaults: BTreeMap::new(),
            routes_loaded: 0,
            camera_policy_rules_loaded: 0,
            agent_input_actions: BTreeMap::new(),
            agent_route_keys: BTreeMap::new(),
            agent_camera_modes: BTreeMap::new(),
            agent_action_scales: BTreeMap::new(),
            agent_gates: BTreeMap::new(),
            host_axis_deadzone: DEFAULT_AXIS_DEADZONE,
            host_activation_threshold: DEFAULT_ACTIVATION_THRESHOLD,
            host_max_mouse_delta: DEFAULT_MAX_MOUSE_DELTA,
            host_digital_axes: BTreeMap::new(),
            issues: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Resource)]
pub struct GameHostInputFrame {
    pub frame_index: u64,
    pub digital_pressed: BTreeSet<String>,
    pub axis_2d: BTreeMap<String, [f32; 2]>,
}

impl Default for GameHostInputFrame {
    fn default() -> Self {
        Self {
            frame_index: 0,
            digital_pressed: BTreeSet::new(),
            axis_2d: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Resource)]
pub struct GameInputIntentState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub tick_index: u64,
    pub active_phase: String,
    pub frame_index: u64,
    pub agent_intents: BTreeMap<String, GameAgentInputIntent>,
    pub issues: Vec<String>,
}

impl Default for GameInputIntentState {
    fn default() -> Self {
        Self {
            ready: false,
            status: "pending".to_string(),
            detail: "awaiting host input frame".to_string(),
            tick_index: 0,
            active_phase: String::new(),
            frame_index: 0,
            agent_intents: BTreeMap::new(),
            issues: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct GameAgentInputIntent {
    pub input_action: String,
    pub input_kind: String,
    pub active: bool,
    pub strength: f32,
    pub vector_2d: [f32; 2],
    pub scale: f32,
    pub route_key: String,
}

pub fn derive_runtime_input_state(
    registry_state: Option<&GameDataRegistryState>,
    runtime_bindings: Option<&GameRuntimeRegistryBindings>,
    action_bindings: Option<&GameRuntimeActionBindings>,
    camera_state: Option<&GameCameraRuntimeState>,
) -> GameInputRuntimeState {
    let mut state = GameInputRuntimeState::default();

    let Some(registry_state) = registry_state else {
        return state;
    };

    let Some(snapshot) = registry_state.loaded.get(DEFAULT_INPUT_REGISTRY_KIND) else {
        state.status = "degraded".to_string();
        state.detail = format!(
            "missing required '{}' registry in runtime cache",
            DEFAULT_INPUT_REGISTRY_KIND
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
            state.detail = "failed to parse input registry".to_string();
            state.issues.push(error);
            return state;
        }
    };

    let contexts = parse_input_contexts(&document, &mut state.issues);
    let routes = parse_action_projection_routes(&document, &mut state.issues);
    let policy = parse_input_policy(&document, &mut state.issues);
    let host_policy = parse_input_host_policy(&document, &mut state.issues);
    state.routes_loaded = routes.len();
    state.camera_policy_rules_loaded = policy.rules.len();
    state.host_axis_deadzone = host_policy.axis_deadzone;
    state.host_activation_threshold = host_policy.activation_threshold;
    state.host_max_mouse_delta = host_policy.max_mouse_delta;
    state.host_digital_axes = host_policy.digital_axes.clone();
    state.active_camera_rig = camera_state.and_then(|item| item.active_rig.clone());
    state.active_camera_mode = resolve_camera_mode(
        camera_state.and_then(|item| item.active_rig.as_deref()),
        &policy.camera_mode_aliases,
    )
    .or_else(|| policy.default_camera_mode.clone());

    if contexts.is_empty() {
        state.status = "degraded".to_string();
        state.detail = "input registry has no valid contexts".to_string();
        return state;
    }

    for context in &contexts {
        state.available_contexts.push(context.id.clone());
        for (action_id, action) in &context.actions {
            state
                .action_kinds
                .entry(action_id.clone())
                .or_insert_with(|| action.kind.clone());
            state
                .action_defaults
                .entry(action_id.clone())
                .or_insert_with(|| action.defaults.clone());
        }
    }

    let active_context = resolve_active_context(runtime_bindings, &contexts, &mut state.issues);
    state.active_context = Some(active_context.id.clone());

    let Some(action_bindings) = action_bindings else {
        state.status = "pending".to_string();
        state.detail = "awaiting gameplay action runtime state".to_string();
        return state;
    };

    state.tick_index = action_bindings.tick_index;
    state.active_phase = action_bindings.active_phase.clone();

    if action_bindings.status == "pending" {
        state.status = "pending".to_string();
        state.detail = action_bindings.detail.clone();
        state.issues.extend(action_bindings.issues.iter().cloned());
        return state;
    }
    if !action_bindings.ready {
        state.status = "degraded".to_string();
        state.detail =
            "cannot derive input runtime while gameplay action bindings are degraded".to_string();
        state.issues.extend(action_bindings.issues.iter().cloned());
        return state;
    }

    for (agent, gameplay_action) in &action_bindings.agent_actions {
        let mut resolved_input_action = action_bindings.agent_input_actions.get(agent).cloned();
        let mut route_key = action_bindings
            .agent_input_actions
            .contains_key(agent)
            .then(|| format!("game_play.agent_input_actions[{agent}]"));
        let mut selected_context_id = active_context.id.clone();

        if resolved_input_action.is_none() {
            if let Some((route_index, route)) = select_projection_route(
                &routes,
                agent,
                &action_bindings.active_phase,
                gameplay_action,
                &active_context.id,
            ) {
                resolved_input_action = Some(route.input_action.clone());
                selected_context_id = route
                    .context
                    .clone()
                    .unwrap_or_else(|| active_context.id.clone());
                route_key = Some(format!(
                    "action_projection.routes[{route_index}]::{}",
                    route.gameplay_action_prefix
                ));
            }
        }

        let Some(input_action) = resolved_input_action else {
            state.issues.push(format!(
                "no input mapping for agent '{}' gameplay action '{}'",
                agent, gameplay_action
            ));
            continue;
        };

        let Some(selected_context) = contexts
            .iter()
            .find(|context| context.id == selected_context_id)
        else {
            state.issues.push(format!(
                "resolved context '{}' for agent '{}' is not declared",
                selected_context_id, agent
            ));
            continue;
        };

        let Some(action_definition) = selected_context.actions.get(&input_action) else {
            state.issues.push(format!(
                "context '{}' missing mapped input action '{}' for agent '{}'",
                selected_context.id, input_action, agent
            ));
            continue;
        };

        let camera_mode = state
            .active_camera_mode
            .clone()
            .unwrap_or_else(|| "default".to_string());
        if let Some((rule_index, rule)) = select_policy_rule(
            &policy.rules,
            agent,
            &action_bindings.active_phase,
            gameplay_action,
            &input_action,
            &camera_mode,
        ) {
            state.agent_camera_modes.insert(agent.clone(), camera_mode);
            if !rule.allow {
                let reason = rule
                    .reason
                    .clone()
                    .unwrap_or_else(|| "policy gate".to_string());
                state.agent_gates.insert(agent.clone(), reason.clone());
                state.agent_route_keys.insert(
                    agent.clone(),
                    format!("input_policy.rules[{rule_index}]::gate"),
                );
                state.detail = format!("input gated by camera-policy rule {rule_index}");
                continue;
            }
            if (rule.scale - 1.0).abs() > f32::EPSILON {
                state.agent_action_scales.insert(agent.clone(), rule.scale);
            }
            route_key = Some(format!("input_policy.rules[{rule_index}]::allow"));
        }

        state
            .action_kinds
            .insert(input_action.clone(), action_definition.kind.clone());
        state
            .action_defaults
            .insert(input_action.clone(), action_definition.defaults.clone());
        state
            .agent_input_actions
            .insert(agent.clone(), input_action.clone());
        state.agent_route_keys.insert(
            agent.clone(),
            route_key.unwrap_or_else(|| "runtime.fallback".to_string()),
        );
    }

    let evaluated_agents = action_bindings.agent_actions.len();
    state.ready = state.issues.is_empty() && evaluated_agents > 0;
    state.status = if state.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    state.detail = if state.ready {
        format!(
            "resolved {} agent mapping(s) with {} gated in context '{}'",
            state.agent_input_actions.len(),
            state.agent_gates.len(),
            state.active_context.clone().unwrap_or_default()
        )
    } else if evaluated_agents == 0 {
        "no gameplay actions available for input projection".to_string()
    } else {
        "input runtime resolved with contract issues".to_string()
    };

    state
}

pub fn apply_host_input_frame(
    input_state: Option<&GameInputRuntimeState>,
    host_input: Option<&GameHostInputFrame>,
    previous: Option<&GameInputIntentState>,
) -> GameInputIntentState {
    let mut next = GameInputIntentState::default();
    if let Some(previous) = previous {
        next.frame_index = previous.frame_index;
    }

    let Some(input_state) = input_state else {
        return next;
    };
    next.tick_index = input_state.tick_index;
    next.active_phase = input_state.active_phase.clone();
    next.issues.extend(input_state.issues.iter().cloned());

    if input_state.status == "pending" {
        next.status = "pending".to_string();
        next.detail = input_state.detail.clone();
        return next;
    }
    if !input_state.ready {
        next.status = "degraded".to_string();
        next.detail = format!(
            "cannot apply host input while input runtime is {}",
            input_state.status
        );
        return next;
    }

    let Some(host_input) = host_input else {
        next.status = "pending".to_string();
        next.detail = "awaiting host input frame".to_string();
        return next;
    };
    next.frame_index = host_input.frame_index;

    for (agent, input_action) in &input_state.agent_input_actions {
        if let Some(reason) = input_state.agent_gates.get(agent) {
            next.issues
                .push(format!("agent '{agent}' gated by policy: {reason}"));
            continue;
        }

        let input_kind = input_state
            .action_kinds
            .get(input_action)
            .cloned()
            .unwrap_or_else(|| "digital".to_string());
        let defaults = input_state
            .action_defaults
            .get(input_action)
            .cloned()
            .unwrap_or_default();
        let scale = input_state
            .agent_action_scales
            .get(agent)
            .copied()
            .unwrap_or(1.0);
        let route_key = input_state
            .agent_route_keys
            .get(agent)
            .cloned()
            .unwrap_or_else(|| "runtime.fallback".to_string());

        let mut vector_2d = [0.0, 0.0];
        let mut digital_active = false;
        for token in &defaults {
            if host_input.digital_pressed.contains(token) {
                digital_active = true;
                if let Some(axis) = input_state.host_digital_axes.get(token) {
                    vector_2d[0] += axis[0];
                    vector_2d[1] += axis[1];
                }
            }
            if let Some(axis) = host_input.axis_2d.get(token) {
                vector_2d[0] += axis[0];
                vector_2d[1] += axis[1];
            }
        }

        let magnitude = (vector_2d[0] * vector_2d[0] + vector_2d[1] * vector_2d[1]).sqrt();
        if magnitude > 1.0 {
            vector_2d[0] /= magnitude;
            vector_2d[1] /= magnitude;
        }

        let (active, strength) = if input_kind == "axis_2d" {
            let axis_mag = (vector_2d[0] * vector_2d[0] + vector_2d[1] * vector_2d[1]).sqrt();
            let active = axis_mag >= input_state.host_axis_deadzone;
            let normalized_strength = if active {
                (axis_mag - input_state.host_axis_deadzone)
                    / (1.0 - input_state.host_axis_deadzone).max(f32::EPSILON)
            } else {
                0.0
            };
            (active, normalized_strength * scale)
        } else {
            let active = digital_active || magnitude >= input_state.host_activation_threshold;
            let strength = if active { scale } else { 0.0 };
            (active, strength)
        };

        next.agent_intents.insert(
            agent.clone(),
            GameAgentInputIntent {
                input_action: input_action.clone(),
                input_kind,
                active,
                strength,
                vector_2d,
                scale,
                route_key,
            },
        );
    }

    if next.agent_intents.is_empty() {
        next.status = "degraded".to_string();
        next.detail = "no host input intents were produced".to_string();
        return next;
    }

    next.ready = true;
    next.status = "ready".to_string();
    next.detail = format!(
        "applied host input frame {} to {} agent intent(s)",
        next.frame_index,
        next.agent_intents.len()
    );
    next
}

#[derive(Debug, Clone)]
struct InputContext {
    id: String,
    priority: u32,
    actions: BTreeMap<String, InputAction>,
}

#[derive(Debug, Clone)]
struct InputAction {
    kind: String,
    defaults: Vec<String>,
}

#[derive(Debug, Clone)]
struct InputActionProjectionRoute {
    agent: Option<String>,
    phase: Option<String>,
    context: Option<String>,
    gameplay_action_prefix: String,
    input_action: String,
    priority: u32,
}

#[derive(Debug, Clone, Default)]
struct InputPolicyConfig {
    default_camera_mode: Option<String>,
    camera_mode_aliases: Vec<CameraModeAlias>,
    rules: Vec<InputPolicyRule>,
}

#[derive(Debug, Clone)]
struct InputHostPolicy {
    axis_deadzone: f32,
    activation_threshold: f32,
    max_mouse_delta: f32,
    digital_axes: BTreeMap<String, [f32; 2]>,
}

impl Default for InputHostPolicy {
    fn default() -> Self {
        Self {
            axis_deadzone: DEFAULT_AXIS_DEADZONE,
            activation_threshold: DEFAULT_ACTIVATION_THRESHOLD,
            max_mouse_delta: DEFAULT_MAX_MOUSE_DELTA,
            digital_axes: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone)]
struct CameraModeAlias {
    rig_prefix: String,
    mode: String,
}

#[derive(Debug, Clone)]
struct InputPolicyRule {
    agent: Option<String>,
    phase: Option<String>,
    camera_mode: Option<String>,
    gameplay_action_prefix: Option<String>,
    input_action: Option<String>,
    allow: bool,
    scale: f32,
    reason: Option<String>,
    priority: u32,
}

impl InputActionProjectionRoute {
    fn matches(
        &self,
        agent: &str,
        phase: &str,
        gameplay_action: &str,
        active_context: &str,
    ) -> bool {
        self.agent.as_deref().is_none_or(|value| value == agent)
            && self.phase.as_deref().is_none_or(|value| value == phase)
            && self
                .context
                .as_deref()
                .is_none_or(|value| value == active_context)
            && gameplay_action.starts_with(&self.gameplay_action_prefix)
    }
}

impl InputPolicyRule {
    fn matches(
        &self,
        agent: &str,
        phase: &str,
        gameplay_action: &str,
        input_action: &str,
        camera_mode: &str,
    ) -> bool {
        self.agent.as_deref().is_none_or(|value| value == agent)
            && self.phase.as_deref().is_none_or(|value| value == phase)
            && self
                .camera_mode
                .as_deref()
                .is_none_or(|value| value == camera_mode)
            && self
                .gameplay_action_prefix
                .as_deref()
                .is_none_or(|value| gameplay_action.starts_with(value))
            && self
                .input_action
                .as_deref()
                .is_none_or(|value| value == input_action)
    }
}

fn resolve_active_context<'a>(
    runtime_bindings: Option<&GameRuntimeRegistryBindings>,
    contexts: &'a [InputContext],
    issues: &mut Vec<String>,
) -> &'a InputContext {
    if let Some(default_context_id) =
        runtime_bindings.and_then(|bindings| bindings.default_player_input_context.as_deref())
    {
        if let Some(context) = contexts.iter().find(|item| item.id == default_context_id) {
            return context;
        }
        issues.push(format!(
            "default player input context '{}' not found; falling back to highest-priority context",
            default_context_id
        ));
    }

    contexts
        .iter()
        .max_by_key(|context| (context.priority, std::cmp::Reverse(context.id.as_str())))
        .unwrap_or(&contexts[0])
}

fn select_projection_route<'a>(
    routes: &'a [InputActionProjectionRoute],
    agent: &str,
    phase: &str,
    gameplay_action: &str,
    active_context: &str,
) -> Option<(usize, &'a InputActionProjectionRoute)> {
    let mut selected: Option<(usize, &InputActionProjectionRoute)> = None;

    for (index, route) in routes.iter().enumerate() {
        if !route.matches(agent, phase, gameplay_action, active_context) {
            continue;
        }

        let should_replace = match selected {
            Some((_, current)) => {
                (route.priority, route.gameplay_action_prefix.len())
                    > (current.priority, current.gameplay_action_prefix.len())
            }
            None => true,
        };
        if should_replace {
            selected = Some((index, route));
        }
    }

    selected
}

fn select_policy_rule<'a>(
    rules: &'a [InputPolicyRule],
    agent: &str,
    phase: &str,
    gameplay_action: &str,
    input_action: &str,
    camera_mode: &str,
) -> Option<(usize, &'a InputPolicyRule)> {
    let mut selected: Option<(usize, &InputPolicyRule)> = None;
    for (index, rule) in rules.iter().enumerate() {
        if !rule.matches(agent, phase, gameplay_action, input_action, camera_mode) {
            continue;
        }
        let current_rank = (
            rule.priority,
            rule.gameplay_action_prefix
                .as_deref()
                .map(str::len)
                .unwrap_or(0),
            rule.input_action.is_some(),
        );
        let should_replace = match selected {
            Some((_, current)) => {
                current_rank
                    > (
                        current.priority,
                        current
                            .gameplay_action_prefix
                            .as_deref()
                            .map(str::len)
                            .unwrap_or(0),
                        current.input_action.is_some(),
                    )
            }
            None => true,
        };
        if should_replace {
            selected = Some((index, rule));
        }
    }
    selected
}

fn resolve_camera_mode(active_rig: Option<&str>, aliases: &[CameraModeAlias]) -> Option<String> {
    let active_rig = active_rig?;
    aliases
        .iter()
        .filter(|alias| active_rig.starts_with(&alias.rig_prefix))
        .max_by_key(|alias| alias.rig_prefix.len())
        .map(|alias| alias.mode.clone())
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

fn parse_input_contexts(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> Vec<InputContext> {
    let Some(entries) = document.get("contexts").and_then(toml::Value::as_array) else {
        issues.push("input registry missing required array 'contexts'".to_string());
        return Vec::new();
    };

    let mut contexts = Vec::new();
    for (index, entry) in entries.iter().enumerate() {
        let Some(table) = entry.as_table() else {
            issues.push(format!("contexts[{index}] is not a table"));
            continue;
        };

        let Some(id) = table.get("id").and_then(toml::Value::as_str) else {
            issues.push(format!("contexts[{index}] missing 'id'"));
            continue;
        };
        let id = id.trim();
        if id.is_empty() {
            issues.push(format!("contexts[{index}] has empty 'id'"));
            continue;
        }

        let priority = table
            .get("priority")
            .and_then(toml::Value::as_integer)
            .and_then(|value| u32::try_from(value).ok())
            .unwrap_or(0);

        let mut actions = BTreeMap::new();
        let Some(action_entries) = table.get("actions").and_then(toml::Value::as_array) else {
            issues.push(format!(
                "contexts[{index}] missing required array 'actions'"
            ));
            contexts.push(InputContext {
                id: id.to_string(),
                priority,
                actions,
            });
            continue;
        };

        for (action_index, action_entry) in action_entries.iter().enumerate() {
            let Some(action_table) = action_entry.as_table() else {
                issues.push(format!(
                    "contexts[{index}].actions[{action_index}] is not a table"
                ));
                continue;
            };

            let Some(action_id) = action_table.get("id").and_then(toml::Value::as_str) else {
                issues.push(format!(
                    "contexts[{index}].actions[{action_index}] missing 'id'"
                ));
                continue;
            };
            let action_id = action_id.trim();
            if action_id.is_empty() {
                issues.push(format!(
                    "contexts[{index}].actions[{action_index}] has empty 'id'"
                ));
                continue;
            }

            let kind = action_table
                .get("kind")
                .and_then(toml::Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("digital")
                .to_string();

            let defaults = action_table
                .get("default")
                .and_then(toml::Value::as_array)
                .map(|entries| {
                    entries
                        .iter()
                        .filter_map(toml::Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .map(ToOwned::to_owned)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            if actions
                .insert(action_id.to_string(), InputAction { kind, defaults })
                .is_some()
            {
                issues.push(format!(
                    "contexts[{index}] has duplicate action id '{}'",
                    action_id
                ));
            }
        }

        contexts.push(InputContext {
            id: id.to_string(),
            priority,
            actions,
        });
    }

    contexts
}

fn parse_action_projection_routes(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> Vec<InputActionProjectionRoute> {
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
            "input registry table 'action_projection' missing required array 'routes'".to_string(),
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
        let Some(input_action) = table.get("input_action").and_then(toml::Value::as_str) else {
            issues.push(format!(
                "action_projection.routes[{index}] missing 'input_action'"
            ));
            continue;
        };

        let prefix = prefix.trim();
        let input_action = input_action.trim();
        if prefix.is_empty() {
            issues.push(format!(
                "action_projection.routes[{index}] has empty 'gameplay_action_prefix'"
            ));
            continue;
        }
        if input_action.is_empty() {
            issues.push(format!(
                "action_projection.routes[{index}] has empty 'input_action'"
            ));
            continue;
        }

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
        let context = table
            .get("context")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let priority = table
            .get("priority")
            .and_then(toml::Value::as_integer)
            .and_then(|value| u32::try_from(value).ok())
            .unwrap_or(100);

        routes.push(InputActionProjectionRoute {
            agent,
            phase,
            context,
            gameplay_action_prefix: prefix.to_string(),
            input_action: input_action.to_string(),
            priority,
        });
    }

    routes
}

fn parse_input_policy(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> InputPolicyConfig {
    let Some(policy_table) = document.get("input_policy").and_then(toml::Value::as_table) else {
        return InputPolicyConfig::default();
    };

    let default_camera_mode = policy_table
        .get("default_camera_mode")
        .and_then(toml::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    let camera_mode_aliases = parse_camera_mode_aliases(policy_table, issues);
    let rules = parse_input_policy_rules(policy_table, issues);

    InputPolicyConfig {
        default_camera_mode,
        camera_mode_aliases,
        rules,
    }
}

fn parse_input_host_policy(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> InputHostPolicy {
    let Some(host_table) = document.get("input_host").and_then(toml::Value::as_table) else {
        return InputHostPolicy::default();
    };

    let mut policy = InputHostPolicy::default();

    if let Some(value) = host_table
        .get("axis_deadzone")
        .and_then(toml::Value::as_float)
    {
        let candidate = value as f32;
        if (0.0..1.0).contains(&candidate) {
            policy.axis_deadzone = candidate;
        } else {
            issues.push("input_host.axis_deadzone must be in range [0.0, 1.0)".to_string());
        }
    }
    if let Some(value) = host_table
        .get("activation_threshold")
        .and_then(toml::Value::as_float)
    {
        let candidate = value as f32;
        if (0.0..=1.0).contains(&candidate) {
            policy.activation_threshold = candidate;
        } else {
            issues.push("input_host.activation_threshold must be in range [0.0, 1.0]".to_string());
        }
    }
    if let Some(value) = host_table
        .get("max_mouse_delta")
        .and_then(toml::Value::as_float)
    {
        let candidate = value as f32;
        if candidate > 0.0 {
            policy.max_mouse_delta = candidate;
        } else {
            issues.push("input_host.max_mouse_delta must be positive".to_string());
        }
    }

    if let Some(entries) = host_table
        .get("digital_axes")
        .and_then(toml::Value::as_array)
    {
        for (index, entry) in entries.iter().enumerate() {
            let Some(table) = entry.as_table() else {
                issues.push(format!("input_host.digital_axes[{index}] is not a table"));
                continue;
            };
            let Some(token) = table.get("token").and_then(toml::Value::as_str) else {
                issues.push(format!("input_host.digital_axes[{index}] missing 'token'"));
                continue;
            };
            let token = token.trim();
            if token.is_empty() {
                issues.push(format!(
                    "input_host.digital_axes[{index}] has empty 'token'"
                ));
                continue;
            }
            let Some(axis) = table.get("axis").and_then(toml::Value::as_array) else {
                issues.push(format!("input_host.digital_axes[{index}] missing 'axis'"));
                continue;
            };
            if axis.len() != 2 {
                issues.push(format!(
                    "input_host.digital_axes[{index}].axis must have exactly 2 components"
                ));
                continue;
            }
            let x = axis
                .first()
                .and_then(toml::Value::as_float)
                .map(|value| value as f32);
            let y = axis
                .get(1)
                .and_then(toml::Value::as_float)
                .map(|value| value as f32);
            let Some(x) = x else {
                issues.push(format!(
                    "input_host.digital_axes[{index}].axis[0] must be a number"
                ));
                continue;
            };
            let Some(y) = y else {
                issues.push(format!(
                    "input_host.digital_axes[{index}].axis[1] must be a number"
                ));
                continue;
            };
            policy.digital_axes.insert(token.to_string(), [x, y]);
        }
    }

    policy
}

fn parse_camera_mode_aliases(
    policy_table: &toml::value::Table,
    issues: &mut Vec<String>,
) -> Vec<CameraModeAlias> {
    let Some(entries) = policy_table
        .get("camera_mode_aliases")
        .and_then(toml::Value::as_array)
    else {
        return Vec::new();
    };
    let mut aliases = Vec::new();
    for (index, entry) in entries.iter().enumerate() {
        let Some(table) = entry.as_table() else {
            issues.push(format!(
                "input_policy.camera_mode_aliases[{index}] is not a table"
            ));
            continue;
        };
        let Some(rig_prefix) = table.get("rig_prefix").and_then(toml::Value::as_str) else {
            issues.push(format!(
                "input_policy.camera_mode_aliases[{index}] missing 'rig_prefix'"
            ));
            continue;
        };
        let Some(mode) = table.get("mode").and_then(toml::Value::as_str) else {
            issues.push(format!(
                "input_policy.camera_mode_aliases[{index}] missing 'mode'"
            ));
            continue;
        };
        let rig_prefix = rig_prefix.trim();
        let mode = mode.trim();
        if rig_prefix.is_empty() || mode.is_empty() {
            issues.push(format!(
                "input_policy.camera_mode_aliases[{index}] has empty 'rig_prefix' or 'mode'"
            ));
            continue;
        }
        aliases.push(CameraModeAlias {
            rig_prefix: rig_prefix.to_string(),
            mode: mode.to_string(),
        });
    }
    aliases
}

fn parse_input_policy_rules(
    policy_table: &toml::value::Table,
    issues: &mut Vec<String>,
) -> Vec<InputPolicyRule> {
    let Some(entries) = policy_table.get("rules").and_then(toml::Value::as_array) else {
        return Vec::new();
    };
    let mut rules = Vec::new();
    for (index, entry) in entries.iter().enumerate() {
        let Some(table) = entry.as_table() else {
            issues.push(format!("input_policy.rules[{index}] is not a table"));
            continue;
        };
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
        let camera_mode = table
            .get("camera_mode")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let gameplay_action_prefix = table
            .get("gameplay_action_prefix")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let input_action = table
            .get("input_action")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let allow = table
            .get("allow")
            .and_then(toml::Value::as_bool)
            .unwrap_or(true);
        let scale = table
            .get("scale")
            .and_then(toml::Value::as_float)
            .map(|value| value as f32)
            .unwrap_or(1.0);
        if scale <= 0.0 {
            issues.push(format!(
                "input_policy.rules[{index}] has non-positive 'scale'"
            ));
            continue;
        }
        let reason = table
            .get("reason")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let priority = table
            .get("priority")
            .and_then(toml::Value::as_integer)
            .and_then(|value| u32::try_from(value).ok())
            .unwrap_or(100);

        if !allow && reason.is_none() {
            issues.push(format!(
                "input_policy.rules[{index}] should declare 'reason' when allow = false"
            ));
        }
        rules.push(InputPolicyRule {
            agent,
            phase,
            camera_mode,
            gameplay_action_prefix,
            input_action,
            allow,
            scale,
            reason,
            priority,
        });
    }
    rules
}

#[cfg(test)]
mod tests {
    use super::*;
    use k_os_game_camera::GameCameraRuntimeState;
    use k_os_game_framework::{GameDataRegistryState, RegistrySnapshot};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn write_temp_registry(name: &str, content: &str) -> String {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("k_os_game_input_{name}_{nonce}.toml"));
        std::fs::write(&path, content).expect("write temp registry");
        path.to_string_lossy().into_owned()
    }

    fn input_registry_state(input_path: String) -> GameDataRegistryState {
        let mut state = GameDataRegistryState::default();
        state.loaded.insert(
            "input_bindings".to_string(),
            RegistrySnapshot {
                stage_id: "input_bindings_registry".to_string(),
                profile: "editor_preview".to_string(),
                merge_strategy: "replace".to_string(),
                asset_path: input_path,
                version: "1".to_string(),
                required_table_counts: BTreeMap::new(),
            },
        );
        state
    }

    #[test]
    fn resolves_agent_input_actions_from_runtime_and_projection_routes() {
        let input_path = write_temp_registry(
            "projection",
            r#"
version = "1"
registry_kind = "input_bindings"

[[contexts]]
id = "player.default"
priority = 100

[[contexts.actions]]
id = "player.move"
kind = "axis_2d"
default = ["w", "a", "s", "d"]

[[contexts.actions]]
id = "player.interact"
kind = "digital"
default = ["e"]

[action_projection]

[[action_projection.routes]]
agent = "npc.vendor"
phase = "act"
gameplay_action_prefix = "interaction.vendor."
input_action = "player.interact"
priority = 300
"#,
        );

        let runtime_bindings = GameRuntimeRegistryBindings {
            default_player_input_context: Some("player.default".to_string()),
            ..Default::default()
        };

        let mut action_bindings = GameRuntimeActionBindings {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 9,
            active_phase: "act".to_string(),
            ..Default::default()
        };
        action_bindings.agent_actions.insert(
            "hero.default".to_string(),
            "combat.attack.primary_target".to_string(),
        );
        action_bindings.agent_actions.insert(
            "npc.vendor".to_string(),
            "interaction.vendor.serve_customer".to_string(),
        );
        action_bindings
            .agent_input_actions
            .insert("hero.default".to_string(), "player.move".to_string());

        let result = derive_runtime_input_state(
            Some(&input_registry_state(input_path)),
            Some(&runtime_bindings),
            Some(&action_bindings),
            None,
        );

        assert!(result.ready);
        assert_eq!(result.status, "ready");
        assert_eq!(
            result
                .agent_input_actions
                .get("hero.default")
                .map(String::as_str),
            Some("player.move")
        );
        assert_eq!(
            result
                .agent_input_actions
                .get("npc.vendor")
                .map(String::as_str),
            Some("player.interact")
        );
    }

    #[test]
    fn degrades_when_route_maps_to_missing_input_action() {
        let input_path = write_temp_registry(
            "invalid_route",
            r#"
version = "1"
registry_kind = "input_bindings"

[[contexts]]
id = "player.default"
priority = 100

[[contexts.actions]]
id = "player.move"
kind = "axis_2d"
default = ["w", "a", "s", "d"]

[action_projection]

[[action_projection.routes]]
agent = "npc.vendor"
phase = "act"
gameplay_action_prefix = "interaction.vendor."
input_action = "player.interact"
priority = 300
"#,
        );

        let mut action_bindings = GameRuntimeActionBindings {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 9,
            active_phase: "act".to_string(),
            ..Default::default()
        };
        action_bindings.agent_actions.insert(
            "npc.vendor".to_string(),
            "interaction.vendor.serve_customer".to_string(),
        );

        let result = derive_runtime_input_state(
            Some(&input_registry_state(input_path)),
            None,
            Some(&action_bindings),
            None,
        );

        assert!(!result.ready);
        assert_eq!(result.status, "degraded");
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.contains("missing mapped input action")));
    }

    #[test]
    fn applies_camera_policy_gate_and_scale_rules() {
        let input_path = write_temp_registry(
            "camera_policy",
            r#"
version = "1"
registry_kind = "input_bindings"

[[contexts]]
id = "player.default"
priority = 100

[[contexts.actions]]
id = "player.move"
kind = "axis_2d"
default = ["w", "a", "s", "d"]

[[contexts.actions]]
id = "player.look"
kind = "axis_2d"
default = ["mouse_delta"]

[action_projection]

[[action_projection.routes]]
agent = "hero.default"
phase = "act"
gameplay_action_prefix = "combat.attack."
input_action = "player.look"
priority = 400

[input_policy]
default_camera_mode = "third_person"

[[input_policy.camera_mode_aliases]]
rig_prefix = "cinematic."
mode = "cinematic"

[[input_policy.rules]]
camera_mode = "cinematic"
phase = "act"
gameplay_action_prefix = "combat.attack."
allow = false
reason = "cinematic_combat_lock"
priority = 600

[[input_policy.rules]]
camera_mode = "third_person"
input_action = "player.look"
scale = 0.65
priority = 250
"#,
        );

        let mut action_bindings = GameRuntimeActionBindings {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 9,
            active_phase: "act".to_string(),
            ..Default::default()
        };
        action_bindings.agent_actions.insert(
            "hero.default".to_string(),
            "combat.attack.primary_target".to_string(),
        );

        let cinematic_camera = GameCameraRuntimeState {
            active_rig: Some("cinematic.spline.preview".to_string()),
            ..Default::default()
        };
        let gated = derive_runtime_input_state(
            Some(&input_registry_state(input_path.clone())),
            None,
            Some(&action_bindings),
            Some(&cinematic_camera),
        );
        assert!(gated.ready);
        assert!(gated.agent_input_actions.is_empty());
        assert_eq!(
            gated.agent_gates.get("hero.default").map(String::as_str),
            Some("cinematic_combat_lock")
        );

        let default_camera = GameCameraRuntimeState {
            active_rig: Some("player.follow.third_person".to_string()),
            ..Default::default()
        };
        let scaled = derive_runtime_input_state(
            Some(&input_registry_state(input_path)),
            None,
            Some(&action_bindings),
            Some(&default_camera),
        );
        assert!(scaled.ready);
        assert_eq!(
            scaled
                .agent_input_actions
                .get("hero.default")
                .map(String::as_str),
            Some("player.look")
        );
        assert_eq!(
            scaled.agent_action_scales.get("hero.default").copied(),
            Some(0.65)
        );
    }

    #[test]
    fn applies_host_frame_to_axis_intent_using_registry_digital_axis_map() {
        let input_path = write_temp_registry(
            "host_axis",
            r#"
version = "1"
registry_kind = "input_bindings"

[[contexts]]
id = "player.default"
priority = 100

[[contexts.actions]]
id = "player.move"
kind = "axis_2d"
default = ["w", "a", "s", "d"]

[input_host]
axis_deadzone = 0.1
activation_threshold = 0.2
max_mouse_delta = 250.0

[[input_host.digital_axes]]
token = "w"
axis = [0.0, 1.0]

[[input_host.digital_axes]]
token = "d"
axis = [1.0, 0.0]
"#,
        );
        let mut action_bindings = GameRuntimeActionBindings {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 12,
            active_phase: "act".to_string(),
            ..Default::default()
        };
        action_bindings
            .agent_actions
            .insert("hero.default".to_string(), "locomotion.walk".to_string());
        action_bindings
            .agent_input_actions
            .insert("hero.default".to_string(), "player.move".to_string());

        let runtime_state = derive_runtime_input_state(
            Some(&input_registry_state(input_path)),
            None,
            Some(&action_bindings),
            None,
        );
        assert!(runtime_state.ready);

        let mut host_frame = GameHostInputFrame {
            frame_index: 44,
            ..Default::default()
        };
        host_frame.digital_pressed.insert("w".to_string());
        host_frame.digital_pressed.insert("d".to_string());

        let intents = apply_host_input_frame(Some(&runtime_state), Some(&host_frame), None);
        assert!(intents.ready);
        assert_eq!(intents.status, "ready");
        let hero = intents
            .agent_intents
            .get("hero.default")
            .expect("hero intent");
        assert!(hero.active);
        assert_eq!(hero.input_action, "player.move");
        assert!(hero.vector_2d[0] > 0.0);
        assert!(hero.vector_2d[1] > 0.0);
    }

    #[test]
    fn host_input_lane_respects_gates_and_produces_no_intent() {
        let input_path = write_temp_registry(
            "host_gated",
            r#"
version = "1"
registry_kind = "input_bindings"

[[contexts]]
id = "player.default"
priority = 100

[[contexts.actions]]
id = "player.look"
kind = "axis_2d"
default = ["mouse_delta"]

[input_policy]
default_camera_mode = "cinematic"

[[input_policy.rules]]
camera_mode = "cinematic"
allow = false
reason = "cinematic_lock"
priority = 900
"#,
        );
        let mut action_bindings = GameRuntimeActionBindings {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 3,
            active_phase: "act".to_string(),
            ..Default::default()
        };
        action_bindings.agent_actions.insert(
            "hero.default".to_string(),
            "combat.attack.primary_target".to_string(),
        );
        action_bindings
            .agent_input_actions
            .insert("hero.default".to_string(), "player.look".to_string());

        let runtime_state = derive_runtime_input_state(
            Some(&input_registry_state(input_path)),
            None,
            Some(&action_bindings),
            None,
        );
        assert!(runtime_state.ready);
        assert!(runtime_state.agent_input_actions.is_empty());
        assert_eq!(
            runtime_state
                .agent_gates
                .get("hero.default")
                .map(String::as_str),
            Some("cinematic_lock")
        );

        let host_frame = GameHostInputFrame {
            frame_index: 1,
            ..Default::default()
        };
        let intents = apply_host_input_frame(Some(&runtime_state), Some(&host_frame), None);
        assert!(!intents.ready);
        assert_eq!(intents.status, "degraded");
        assert!(intents.agent_intents.is_empty());
    }

    #[test]
    fn stays_pending_without_action_runtime_state() {
        let input_path = write_temp_registry(
            "pending",
            r#"
version = "1"
registry_kind = "input_bindings"

[[contexts]]
id = "player.default"
priority = 100

[[contexts.actions]]
id = "player.move"
kind = "axis_2d"
default = ["w", "a", "s", "d"]
"#,
        );

        let result =
            derive_runtime_input_state(Some(&input_registry_state(input_path)), None, None, None);

        assert!(!result.ready);
        assert_eq!(result.status, "pending");
        assert_eq!(result.detail, "awaiting gameplay action runtime state");
    }
}

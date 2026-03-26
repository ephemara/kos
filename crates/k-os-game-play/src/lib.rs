use bevy_ecs::prelude::Resource;
use k_os_game_ai::GameAiDecisionRuntimeState;
use k_os_game_framework::{
    GameDataRegistryState, GamePipelineBootstrapState, GameProductLaunchPreset,
    GameRuntimeActionBindings, GameRuntimeRegistryBindings,
};
use k_os_game_input::{GameAgentInputIntent, GameInputIntentState};
use k_os_game_runtime::PipelineManifest;
use std::collections::{BTreeMap, BTreeSet};

const DEFAULT_ACTOR_REGISTRY_KIND: &str = "actor_archetypes";
const DEFAULT_INPUT_REGISTRY_KIND: &str = "input_bindings";
const DEFAULT_EXECUTION_FIXED_STEP_SECONDS: f32 = 1.0 / 60.0;
const DEFAULT_EXECUTION_MAX_LINEAR_SPEED: f32 = 25.0;
const DEFAULT_EXECUTION_MAX_ANGULAR_SPEED: f32 = 8.0;
const DEFAULT_EXECUTION_MAX_FRAME_STEPS: u32 = 4;
const DEFAULT_EXECUTION_INACTIVE_DECAY: f32 = 0.8;
const DEFAULT_EXECUTION_EFFECT_MAX_EVENTS: u32 = 64;
const DEFAULT_EXECUTION_EFFECT_REPLICATION_CHANNEL: &str = "reliable";
const DEFAULT_EXECUTION_TRANSPORT_MAX_JOURNAL_EVENTS: u32 = 512;
const DEFAULT_EXECUTION_TRANSPORT_ROLLBACK_WINDOW_FRAMES: u32 = 120;
const DEFAULT_EXECUTION_TRANSPORT_DEFAULT_LANE: &str = "gameplay_events";
const DEFAULT_EXECUTION_TRANSPORT_DEFAULT_RELIABILITY: &str = "reliable";
const DEFAULT_EXECUTION_TRANSPORT_DEFAULT_ROLLBACK: bool = true;
const DEFAULT_EXECUTION_TRANSPORT_BACKEND_MAX_PAYLOADS_PER_FRAME: u32 = 32;
const DEFAULT_EXECUTION_TRANSPORT_BACKEND_DEFAULT_KIND: &str = "event_log";
const DEFAULT_EXECUTION_TRANSPORT_BACKEND_DEFAULT_PAYLOAD_KIND: &str = "journal_slice";
const DEFAULT_EXECUTION_TRANSPORT_BACKEND_DEFAULT_MAX_EVENTS_PER_PAYLOAD: u32 = 16;

#[derive(Debug, Clone, Resource)]
pub struct GamePipelineRuntimePolicy {
    pub required_registry_kinds: Vec<String>,
    pub strict_readiness: bool,
}

impl GamePipelineRuntimePolicy {
    pub fn from_manifest(manifest: &PipelineManifest) -> Self {
        Self {
            required_registry_kinds: normalize_registry_kinds(
                manifest
                    .runtime_policy
                    .required_registry_kinds
                    .iter()
                    .cloned(),
            ),
            strict_readiness: manifest.runtime_policy.strict_readiness,
        }
    }

    pub fn from_manifest_with_env_overrides(manifest: &PipelineManifest) -> Self {
        let base = Self::from_manifest(manifest);
        Self::apply_env_overrides(base)
    }

    pub fn from_launch_preset_with_env_overrides(preset: &GameProductLaunchPreset) -> Self {
        let base = Self {
            required_registry_kinds: normalize_registry_kinds(
                preset.runtime_required_registry_kinds.clone(),
            ),
            strict_readiness: preset.runtime_strict_readiness,
        };
        Self::apply_env_overrides(base)
    }

    fn apply_env_overrides(base: Self) -> Self {
        Self {
            required_registry_kinds: parse_env_csv("KOS_GAME_RUNTIME_REQUIRED_REGISTRIES")
                .map(normalize_registry_kinds)
                .unwrap_or(base.required_registry_kinds),
            strict_readiness: parse_env_bool("KOS_GAME_RUNTIME_STRICT_READINESS")
                .unwrap_or(base.strict_readiness),
        }
    }

    pub fn from_env() -> Self {
        Self {
            required_registry_kinds: parse_env_csv("KOS_GAME_RUNTIME_REQUIRED_REGISTRIES")
                .map(normalize_registry_kinds)
                .unwrap_or_else(default_required_registry_kinds),
            strict_readiness: parse_env_bool("KOS_GAME_RUNTIME_STRICT_READINESS").unwrap_or(true),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum RuntimeReadinessStatus {
    Pending,
    Ready,
    Degraded,
}

#[derive(Debug, Clone, Default, Resource)]
pub struct RuntimeReadinessState {
    pub status: String,
    pub detail: String,
}

#[derive(Debug, Clone, PartialEq, Resource)]
pub struct GameExecutionCommandState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub tick_index: u64,
    pub active_phase: String,
    pub frame_index: u64,
    pub routes_loaded: usize,
    pub agent_commands: BTreeMap<String, GameAgentExecutionCommand>,
    pub issues: Vec<String>,
}

impl Default for GameExecutionCommandState {
    fn default() -> Self {
        Self {
            ready: false,
            status: "pending".to_string(),
            detail: "awaiting input-intent state".to_string(),
            tick_index: 0,
            active_phase: String::new(),
            frame_index: 0,
            routes_loaded: 0,
            agent_commands: BTreeMap::new(),
            issues: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct GameAgentExecutionCommand {
    pub input_action: String,
    pub command_kind: String,
    pub active: bool,
    pub intensity: f32,
    pub linear: [f32; 3],
    pub angular: [f32; 3],
    pub route_key: String,
}

#[derive(Debug, Clone, PartialEq, Resource)]
pub struct GameExecutionApplicationState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub tick_index: u64,
    pub active_phase: String,
    pub frame_index: u64,
    pub fixed_step_seconds: f32,
    pub applied_steps: u32,
    pub agent_applications: BTreeMap<String, GameAgentExecutionApplication>,
    pub issues: Vec<String>,
}

impl Default for GameExecutionApplicationState {
    fn default() -> Self {
        Self {
            ready: false,
            status: "pending".to_string(),
            detail: "awaiting execution-command state".to_string(),
            tick_index: 0,
            active_phase: String::new(),
            frame_index: 0,
            fixed_step_seconds: DEFAULT_EXECUTION_FIXED_STEP_SECONDS,
            applied_steps: 0,
            agent_applications: BTreeMap::new(),
            issues: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct GameAgentExecutionApplication {
    pub command_kind: String,
    pub input_action: String,
    pub route_key: String,
    pub steps_applied: u32,
    pub linear_velocity: [f32; 3],
    pub angular_velocity: [f32; 3],
    pub translation_delta: [f32; 3],
    pub rotation_delta: [f32; 3],
}

#[derive(Debug, Clone, PartialEq, Resource)]
pub struct GameExecutionEffectsState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub tick_index: u64,
    pub active_phase: String,
    pub frame_index: u64,
    pub routes_loaded: usize,
    pub events_emitted: usize,
    pub next_sequence: u64,
    pub events: Vec<GameExecutionEffectEvent>,
    pub issues: Vec<String>,
}

impl Default for GameExecutionEffectsState {
    fn default() -> Self {
        Self {
            ready: false,
            status: "pending".to_string(),
            detail: "awaiting execution-application state".to_string(),
            tick_index: 0,
            active_phase: String::new(),
            frame_index: 0,
            routes_loaded: 0,
            events_emitted: 0,
            next_sequence: 1,
            events: Vec::new(),
            issues: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct GameExecutionEffectEvent {
    pub sequence: u64,
    pub agent: String,
    pub command_kind: String,
    pub input_action: String,
    pub effect_kind: String,
    pub replication_channel: String,
    pub active: bool,
    pub intensity: f32,
    pub linear_velocity: [f32; 3],
    pub angular_velocity: [f32; 3],
    pub translation_delta: [f32; 3],
    pub rotation_delta: [f32; 3],
    pub route_key: String,
}

#[derive(Debug, Clone, PartialEq, Resource)]
pub struct GameExecutionTransportState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub tick_index: u64,
    pub active_phase: String,
    pub frame_index: u64,
    pub channel_routes_loaded: usize,
    pub events_ingested: usize,
    pub journal_retained: usize,
    pub rollback_floor_sequence: u64,
    pub replay_fingerprint: String,
    pub journal: Vec<GameExecutionTransportEnvelope>,
    pub issues: Vec<String>,
}

impl Default for GameExecutionTransportState {
    fn default() -> Self {
        Self {
            ready: false,
            status: "pending".to_string(),
            detail: "awaiting execution-effects state".to_string(),
            tick_index: 0,
            active_phase: String::new(),
            frame_index: 0,
            channel_routes_loaded: 0,
            events_ingested: 0,
            journal_retained: 0,
            rollback_floor_sequence: 0,
            replay_fingerprint: String::new(),
            journal: Vec::new(),
            issues: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct GameExecutionTransportEnvelope {
    pub sequence: u64,
    pub frame_index: u64,
    pub tick_index: u64,
    pub agent: String,
    pub command_kind: String,
    pub input_action: String,
    pub effect_kind: String,
    pub replication_channel: String,
    pub transport_lane: String,
    pub transport_reliability: String,
    pub rollback_enabled: bool,
    pub active: bool,
    pub intensity: f32,
    pub translation_delta: [f32; 3],
    pub rotation_delta: [f32; 3],
    pub effect_route_key: String,
    pub transport_route_key: String,
}

#[derive(Debug, Clone, PartialEq, Resource)]
pub struct GameExecutionTransportBackendState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub tick_index: u64,
    pub active_phase: String,
    pub frame_index: u64,
    pub routes_loaded: usize,
    pub payloads_emitted: usize,
    pub lanes_emitted: usize,
    pub exported_through_sequence: u64,
    pub rollback_floor_sequence: u64,
    pub backend_fingerprint: String,
    pub payloads: Vec<GameExecutionTransportBackendPayload>,
    pub issues: Vec<String>,
}

impl Default for GameExecutionTransportBackendState {
    fn default() -> Self {
        Self {
            ready: false,
            status: "pending".to_string(),
            detail: "awaiting execution-transport state".to_string(),
            tick_index: 0,
            active_phase: String::new(),
            frame_index: 0,
            routes_loaded: 0,
            payloads_emitted: 0,
            lanes_emitted: 0,
            exported_through_sequence: 0,
            rollback_floor_sequence: 0,
            backend_fingerprint: String::new(),
            payloads: Vec::new(),
            issues: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct GameExecutionTransportBackendPayload {
    pub sequence_start: u64,
    pub sequence_end: u64,
    pub event_count: usize,
    pub transport_lane: String,
    pub transport_reliability: String,
    pub rollback_enabled: bool,
    pub backend_kind: String,
    pub payload_kind: String,
    pub agents: Vec<String>,
    pub command_kinds: Vec<String>,
    pub route_key: String,
}

pub fn runtime_readiness_key(status: RuntimeReadinessStatus) -> &'static str {
    match status {
        RuntimeReadinessStatus::Pending => "pending",
        RuntimeReadinessStatus::Ready => "ready",
        RuntimeReadinessStatus::Degraded => "degraded",
    }
}

pub fn derive_runtime_registry_bindings(
    bootstrap_state: &GamePipelineBootstrapState,
    registry_state: &GameDataRegistryState,
    policy: &GamePipelineRuntimePolicy,
) -> GameRuntimeRegistryBindings {
    let mut bindings = GameRuntimeRegistryBindings {
        required_registry_kinds: policy.required_registry_kinds.clone(),
        ..Default::default()
    };
    bindings.issues = registry_state.errors.clone();

    for required_kind in &policy.required_registry_kinds {
        let Some(snapshot) = registry_state.loaded.get(required_kind) else {
            bindings.issues.push(format!(
                "missing required registry kind '{}' in loaded runtime cache",
                required_kind
            ));
            continue;
        };
        bindings
            .loaded_registry_versions
            .insert(required_kind.clone(), snapshot.version.clone());

        let document = match load_registry_document(&snapshot.asset_path) {
            Ok(document) => document,
            Err(error) => {
                bindings.issues.push(error);
                continue;
            }
        };

        match required_kind.as_str() {
            "input_bindings" => match parse_input_context_action_counts(&document) {
                Ok(counts) => bindings.input_context_action_counts = counts,
                Err(error) => bindings
                    .issues
                    .push(format!("registry '{}' parse error: {error}", required_kind)),
            },
            "gameplay_tags" => match parse_tag_domain_counts(&document) {
                Ok(counts) => bindings.tag_domain_counts = counts,
                Err(error) => bindings
                    .issues
                    .push(format!("registry '{}' parse error: {error}", required_kind)),
            },
            "actor_archetypes" => {
                match parse_string_ids_from_array(&document, "archetypes") {
                    Ok(ids) => bindings.actor_archetypes = ids,
                    Err(error) => bindings
                        .issues
                        .push(format!("registry '{}' parse error: {error}", required_kind)),
                }
                let (_, input_context, camera_rig) = parse_default_player_links(&document);
                bindings.default_player_input_context = input_context;
                bindings.default_player_camera_rig = camera_rig;
            }
            "camera_rigs" => match parse_string_ids_from_array(&document, "rigs") {
                Ok(ids) => bindings.camera_rigs = ids,
                Err(error) => bindings
                    .issues
                    .push(format!("registry '{}' parse error: {error}", required_kind)),
            },
            "visual_scripting" => match parse_string_ids_from_array(&document, "graphs") {
                Ok(ids) => bindings.visual_graphs = ids,
                Err(error) => bindings
                    .issues
                    .push(format!("registry '{}' parse error: {error}", required_kind)),
            },
            _ => {}
        }
    }

    if let Some(default_context) = &bindings.default_player_input_context {
        if !bindings
            .input_context_action_counts
            .contains_key(default_context)
        {
            bindings.issues.push(format!(
                "hero.default references missing input context '{}'",
                default_context
            ));
        }
    }
    if let Some(default_rig) = &bindings.default_player_camera_rig {
        if !bindings.camera_rigs.iter().any(|rig| rig == default_rig) {
            bindings.issues.push(format!(
                "hero.default references missing camera rig '{}'",
                default_rig
            ));
        }
    }

    let has_missing_required = policy
        .required_registry_kinds
        .iter()
        .any(|kind| !bindings.loaded_registry_versions.contains_key(kind));
    let has_issues = !bindings.issues.is_empty();

    let readiness_status = if !bootstrap_state.enabled {
        RuntimeReadinessStatus::Pending
    } else if bootstrap_state.error.is_some()
        || (policy.strict_readiness && (has_issues || has_missing_required))
    {
        RuntimeReadinessStatus::Degraded
    } else {
        RuntimeReadinessStatus::Ready
    };

    bindings.ready = readiness_status == RuntimeReadinessStatus::Ready;
    bindings.ready_reason = match readiness_status {
        RuntimeReadinessStatus::Pending => "pipeline disabled".to_string(),
        RuntimeReadinessStatus::Ready => {
            "runtime registry bindings resolved from pipeline cache".to_string()
        }
        RuntimeReadinessStatus::Degraded => {
            "runtime registry bindings incomplete or invalid".to_string()
        }
    };

    bindings
}

pub fn derive_runtime_readiness_state(
    bootstrap_state: Option<&GamePipelineBootstrapState>,
    registry_state: Option<&GameDataRegistryState>,
    policy: Option<&GamePipelineRuntimePolicy>,
    bindings_state: &GameRuntimeRegistryBindings,
) -> RuntimeReadinessState {
    let Some(bootstrap_state) = bootstrap_state else {
        return RuntimeReadinessState {
            status: runtime_readiness_key(RuntimeReadinessStatus::Pending).to_string(),
            detail: "awaiting bootstrap state".to_string(),
        };
    };
    if registry_state.is_none() {
        return RuntimeReadinessState {
            status: runtime_readiness_key(RuntimeReadinessStatus::Pending).to_string(),
            detail: "awaiting registry cache".to_string(),
        };
    }
    if policy.is_none() {
        return RuntimeReadinessState {
            status: runtime_readiness_key(RuntimeReadinessStatus::Pending).to_string(),
            detail: "awaiting runtime policy".to_string(),
        };
    }

    let status = if bindings_state.ready {
        RuntimeReadinessStatus::Ready
    } else if !bootstrap_state.enabled {
        RuntimeReadinessStatus::Pending
    } else {
        RuntimeReadinessStatus::Degraded
    };

    RuntimeReadinessState {
        status: runtime_readiness_key(status).to_string(),
        detail: bindings_state.ready_reason.clone(),
    }
}

pub fn derive_runtime_action_bindings(
    registry_state: Option<&GameDataRegistryState>,
    runtime_bindings: Option<&GameRuntimeRegistryBindings>,
    ai_decision_state: Option<&GameAiDecisionRuntimeState>,
) -> GameRuntimeActionBindings {
    let mut state = GameRuntimeActionBindings::default();

    let Some(ai_decision_state) = ai_decision_state else {
        state.status = "pending".to_string();
        state.detail = "awaiting ai decision runtime state".to_string();
        return state;
    };
    if ai_decision_state.status == "pending" {
        state.status = "pending".to_string();
        state.detail = ai_decision_state.detail.clone();
        state.issues = ai_decision_state.issues.clone();
        return state;
    }
    if !ai_decision_state.ready {
        state.status = "degraded".to_string();
        state.detail =
            "cannot project gameplay actions while ai decisions are degraded".to_string();
        state.issues = ai_decision_state.issues.clone();
        return state;
    }

    let Some(registry_state) = registry_state else {
        state.status = "pending".to_string();
        state.detail = "awaiting registry cache".to_string();
        return state;
    };
    let Some(actor_snapshot) = registry_state.loaded.get(DEFAULT_ACTOR_REGISTRY_KIND) else {
        state.status = "degraded".to_string();
        state.detail = format!(
            "missing '{}' registry in runtime cache",
            DEFAULT_ACTOR_REGISTRY_KIND
        );
        state.issues = registry_state.errors.clone();
        state.issues.push(state.detail.clone());
        return state;
    };

    let actor_document = match load_registry_document(&actor_snapshot.asset_path) {
        Ok(document) => document,
        Err(error) => {
            state.status = "degraded".to_string();
            state.detail = "failed to parse actor registry".to_string();
            state.issues = vec![error];
            return state;
        }
    };
    let mut issues = registry_state.errors.clone();
    let routes = parse_ai_action_routes(&actor_document, &mut issues);
    state.routes_loaded = routes.len();

    let input_action_ids = parse_input_action_ids(registry_state, &mut issues);
    let available_camera_rigs: BTreeSet<String> = runtime_bindings
        .map(|bindings| bindings.camera_rigs.iter().cloned().collect())
        .unwrap_or_default();

    state.tick_index = ai_decision_state.tick_index;
    state.active_phase = ai_decision_state.active_phase.clone();
    for (agent, decision) in &ai_decision_state.agent_decisions {
        let selected = routes
            .iter()
            .filter(|route| route.matches(agent, &ai_decision_state.active_phase, decision))
            .max_by(|left, right| {
                left.priority
                    .cmp(&right.priority)
                    .then_with(|| left.decision_prefix.len().cmp(&right.decision_prefix.len()))
            });

        let Some(route) = selected else {
            issues.push(format!(
                "no ai_action_projection route for agent '{}' decision '{}' phase '{}'",
                agent, decision, ai_decision_state.active_phase
            ));
            continue;
        };

        state
            .agent_actions
            .insert(agent.clone(), route.gameplay_action.clone());
        if let Some(input_action) = &route.input_action {
            if !input_action_ids.is_empty() && !input_action_ids.contains(input_action) {
                issues.push(format!(
                    "route input_action '{}' for agent '{}' not found in input registry",
                    input_action, agent
                ));
            }
            state
                .agent_input_actions
                .insert(agent.clone(), input_action.clone());
        }
        if let Some(camera_rig) = &route.camera_rig {
            if !available_camera_rigs.is_empty() && !available_camera_rigs.contains(camera_rig) {
                issues.push(format!(
                    "route camera_rig '{}' for agent '{}' not loaded in runtime camera rigs",
                    camera_rig, agent
                ));
            }
            state
                .agent_camera_rigs
                .insert(agent.clone(), camera_rig.clone());
        }
    }

    state.issues = issues;
    state.ready = state.issues.is_empty() && !state.agent_actions.is_empty();
    state.status = if state.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    state.detail = if state.ready {
        format!(
            "projected {} gameplay action(s) from ai decision tick {}",
            state.agent_actions.len(),
            state.tick_index
        )
    } else if state.agent_actions.is_empty() {
        "no gameplay actions projected from current ai decision tick".to_string()
    } else {
        "gameplay action projection completed with issues".to_string()
    };
    state
}

pub fn derive_execution_command_state(
    registry_state: Option<&GameDataRegistryState>,
    intent_state: Option<&GameInputIntentState>,
    previous: Option<&GameExecutionCommandState>,
) -> GameExecutionCommandState {
    let mut next = GameExecutionCommandState::default();
    if let Some(previous) = previous {
        next.frame_index = previous.frame_index;
    }

    let Some(registry_state) = registry_state else {
        return next;
    };

    let Some(snapshot) = registry_state.loaded.get(DEFAULT_INPUT_REGISTRY_KIND) else {
        next.status = "degraded".to_string();
        next.detail = format!(
            "missing required '{}' registry in runtime cache",
            DEFAULT_INPUT_REGISTRY_KIND
        );
        next.issues = registry_state.errors.clone();
        next.issues.push(next.detail.clone());
        return next;
    };

    next.issues = registry_state.errors.clone();
    let document = match load_registry_document(&snapshot.asset_path) {
        Ok(document) => document,
        Err(error) => {
            next.status = "degraded".to_string();
            next.detail = "failed to parse input registry".to_string();
            next.issues.push(error);
            return next;
        }
    };

    let routes = parse_runtime_execution_routes(&document, &mut next.issues);
    next.routes_loaded = routes.len();

    let Some(intent_state) = intent_state else {
        next.status = "pending".to_string();
        next.detail = "awaiting input-intent state".to_string();
        return next;
    };

    next.tick_index = intent_state.tick_index;
    next.active_phase = intent_state.active_phase.clone();
    next.frame_index = intent_state.frame_index;
    next.issues.extend(intent_state.issues.iter().cloned());

    if intent_state.status == "pending" {
        next.status = "pending".to_string();
        next.detail = intent_state.detail.clone();
        return next;
    }
    if !intent_state.ready {
        next.status = "degraded".to_string();
        next.detail = format!(
            "cannot derive execution commands while intent state is {}",
            intent_state.status
        );
        return next;
    }

    for (agent, intent) in &intent_state.agent_intents {
        let Some((route_index, route)) = select_runtime_execution_route(
            &routes,
            agent,
            &intent_state.active_phase,
            &intent.input_action,
            &intent.input_kind,
        ) else {
            next.issues.push(format!(
                "no runtime_execution route for agent '{}' input action '{}' kind '{}'",
                agent, intent.input_action, intent.input_kind
            ));
            continue;
        };

        let command = project_runtime_execution_command(intent, route);
        next.agent_commands.insert(
            agent.clone(),
            GameAgentExecutionCommand {
                route_key: format!(
                    "runtime_execution.routes[{route_index}]::{}",
                    route.command_kind
                ),
                ..command
            },
        );
    }

    let intent_count = intent_state.agent_intents.len();
    next.ready = next.issues.is_empty() && !next.agent_commands.is_empty();
    next.status = if next.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    next.detail = if next.ready {
        format!(
            "derived {} execution command(s) from {} intent(s)",
            next.agent_commands.len(),
            intent_count
        )
    } else if intent_count == 0 {
        "no agent intents available for runtime execution command projection".to_string()
    } else {
        "runtime execution command projection completed with contract issues".to_string()
    };
    next
}

pub fn derive_execution_application_state(
    registry_state: Option<&GameDataRegistryState>,
    command_state: Option<&GameExecutionCommandState>,
    previous: Option<&GameExecutionApplicationState>,
) -> GameExecutionApplicationState {
    let mut next = GameExecutionApplicationState::default();
    if let Some(previous) = previous {
        next.frame_index = previous.frame_index;
    }

    let Some(registry_state) = registry_state else {
        return next;
    };
    let Some(snapshot) = registry_state.loaded.get(DEFAULT_INPUT_REGISTRY_KIND) else {
        next.status = "degraded".to_string();
        next.detail = format!(
            "missing required '{}' registry in runtime cache",
            DEFAULT_INPUT_REGISTRY_KIND
        );
        next.issues = registry_state.errors.clone();
        next.issues.push(next.detail.clone());
        return next;
    };

    next.issues = registry_state.errors.clone();
    let document = match load_registry_document(&snapshot.asset_path) {
        Ok(document) => document,
        Err(error) => {
            next.status = "degraded".to_string();
            next.detail = "failed to parse input registry".to_string();
            next.issues.push(error);
            return next;
        }
    };
    let policy = parse_runtime_execution_apply_policy(&document, &mut next.issues);
    next.fixed_step_seconds = policy.fixed_step_seconds;

    let Some(command_state) = command_state else {
        next.status = "pending".to_string();
        next.detail = "awaiting execution-command state".to_string();
        return next;
    };

    next.tick_index = command_state.tick_index;
    next.active_phase = command_state.active_phase.clone();
    next.frame_index = command_state.frame_index;
    next.issues.extend(command_state.issues.iter().cloned());

    if command_state.status == "pending" {
        next.status = "pending".to_string();
        next.detail = command_state.detail.clone();
        return next;
    }
    if !command_state.ready {
        next.status = "degraded".to_string();
        next.detail = format!(
            "cannot apply execution commands while command state is {}",
            command_state.status
        );
        return next;
    }

    let previous_frame = previous.map(|state| state.frame_index).unwrap_or_else(|| {
        command_state
            .frame_index
            .saturating_sub(u64::from(policy.max_frame_steps))
    });
    let raw_steps = command_state
        .frame_index
        .saturating_sub(previous_frame)
        .max(1);
    let bounded_steps_u64 = raw_steps.min(u64::from(policy.max_frame_steps));
    let bounded_steps = bounded_steps_u64 as u32;
    if raw_steps > bounded_steps_u64 {
        next.issues.push(format!(
            "runtime_execution_apply frame delta {} exceeded max_frame_steps {}; clamped",
            raw_steps, policy.max_frame_steps
        ));
    }
    next.applied_steps = bounded_steps;

    for (agent, command) in &command_state.agent_commands {
        let previous_application = previous.and_then(|state| state.agent_applications.get(agent));
        let previous_linear = previous_application
            .map(|item| item.linear_velocity)
            .unwrap_or([0.0, 0.0, 0.0]);
        let previous_angular = previous_application
            .map(|item| item.angular_velocity)
            .unwrap_or([0.0, 0.0, 0.0]);

        let mut linear_velocity = clamp_vector_magnitude(command.linear, policy.max_linear_speed);
        let mut angular_velocity =
            clamp_vector_magnitude(command.angular, policy.max_angular_speed);

        if !command.active {
            linear_velocity = scale_vector(previous_linear, policy.inactive_decay);
            angular_velocity = scale_vector(previous_angular, policy.inactive_decay);
        }

        let frame_scale = policy.fixed_step_seconds * bounded_steps as f32;
        let translation_delta = scale_vector(linear_velocity, frame_scale);
        let rotation_delta = scale_vector(angular_velocity, frame_scale);

        next.agent_applications.insert(
            agent.clone(),
            GameAgentExecutionApplication {
                command_kind: command.command_kind.clone(),
                input_action: command.input_action.clone(),
                route_key: command.route_key.clone(),
                steps_applied: bounded_steps,
                linear_velocity,
                angular_velocity,
                translation_delta,
                rotation_delta,
            },
        );
    }

    let application_count = next.agent_applications.len();
    next.ready = next.issues.is_empty() && application_count > 0;
    next.status = if next.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    next.detail = if next.ready {
        format!(
            "applied {} execution command(s) over {} fixed-step simulation step(s)",
            application_count, next.applied_steps
        )
    } else if application_count == 0 {
        "no execution commands available for gameplay application".to_string()
    } else {
        "execution command application completed with contract issues".to_string()
    };

    next
}

pub fn derive_execution_effects_state(
    registry_state: Option<&GameDataRegistryState>,
    command_state: Option<&GameExecutionCommandState>,
    application_state: Option<&GameExecutionApplicationState>,
    previous: Option<&GameExecutionEffectsState>,
) -> GameExecutionEffectsState {
    let mut next = GameExecutionEffectsState::default();
    if let Some(previous) = previous {
        next.frame_index = previous.frame_index;
        next.next_sequence = previous.next_sequence.max(1);
    }

    let Some(registry_state) = registry_state else {
        return next;
    };
    let Some(snapshot) = registry_state.loaded.get(DEFAULT_INPUT_REGISTRY_KIND) else {
        next.status = "degraded".to_string();
        next.detail = format!(
            "missing required '{}' registry in runtime cache",
            DEFAULT_INPUT_REGISTRY_KIND
        );
        next.issues = registry_state.errors.clone();
        next.issues.push(next.detail.clone());
        return next;
    };

    next.issues = registry_state.errors.clone();
    let document = match load_registry_document(&snapshot.asset_path) {
        Ok(document) => document,
        Err(error) => {
            next.status = "degraded".to_string();
            next.detail = "failed to parse input registry".to_string();
            next.issues.push(error);
            return next;
        }
    };
    let effects_policy = parse_runtime_execution_effects_policy(&document, &mut next.issues);
    next.routes_loaded = effects_policy.routes.len();

    let Some(command_state) = command_state else {
        next.status = "pending".to_string();
        next.detail = "awaiting execution-command state".to_string();
        return next;
    };
    let Some(application_state) = application_state else {
        next.status = "pending".to_string();
        next.detail = "awaiting execution-application state".to_string();
        return next;
    };

    next.tick_index = command_state.tick_index;
    next.active_phase = command_state.active_phase.clone();
    next.frame_index = command_state.frame_index;
    next.issues.extend(command_state.issues.iter().cloned());
    next.issues.extend(application_state.issues.iter().cloned());

    if command_state.status == "pending" || application_state.status == "pending" {
        next.status = "pending".to_string();
        next.detail = if command_state.status == "pending" {
            command_state.detail.clone()
        } else {
            application_state.detail.clone()
        };
        return next;
    }
    if !command_state.ready || !application_state.ready {
        next.status = "degraded".to_string();
        next.detail = format!(
            "cannot derive execution effects while command={} application={}",
            command_state.status, application_state.status
        );
        return next;
    }

    for (agent, command) in &command_state.agent_commands {
        let Some((route_index, route)) = select_runtime_execution_effect_route(
            &effects_policy.routes,
            agent,
            &command_state.active_phase,
            &command.command_kind,
        ) else {
            next.issues.push(format!(
                "no runtime_execution_effects route for agent '{}' command '{}'",
                agent, command.command_kind
            ));
            continue;
        };
        if !command.active && !route.emit_inactive {
            continue;
        }
        if next.events.len() >= effects_policy.max_events_per_frame as usize {
            next.issues.push(format!(
                "runtime_execution_effects exceeded max_events_per_frame {}; clamped",
                effects_policy.max_events_per_frame
            ));
            break;
        }
        let application = application_state.agent_applications.get(agent);
        let sequence = next.next_sequence;
        next.next_sequence = next.next_sequence.saturating_add(1);
        next.events.push(GameExecutionEffectEvent {
            sequence,
            agent: agent.clone(),
            command_kind: command.command_kind.clone(),
            input_action: command.input_action.clone(),
            effect_kind: route.effect_kind.clone(),
            replication_channel: route.replication_channel.clone(),
            active: command.active,
            intensity: command.intensity,
            linear_velocity: application
                .map(|item| item.linear_velocity)
                .unwrap_or([0.0, 0.0, 0.0]),
            angular_velocity: application
                .map(|item| item.angular_velocity)
                .unwrap_or([0.0, 0.0, 0.0]),
            translation_delta: application
                .map(|item| item.translation_delta)
                .unwrap_or([0.0, 0.0, 0.0]),
            rotation_delta: application
                .map(|item| item.rotation_delta)
                .unwrap_or([0.0, 0.0, 0.0]),
            route_key: format!("runtime_execution_effects.routes[{route_index}]"),
        });
    }

    next.events_emitted = next.events.len();
    next.ready = next.issues.is_empty() && !next.events.is_empty();
    next.status = if next.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    next.detail = if next.ready {
        format!(
            "derived {} execution effect event(s) from {} command(s)",
            next.events_emitted,
            command_state.agent_commands.len()
        )
    } else if next.events.is_empty() {
        "no execution effect events emitted from current commands".to_string()
    } else {
        "execution effects projection completed with contract issues".to_string()
    };
    next
}

pub fn derive_execution_transport_state(
    registry_state: Option<&GameDataRegistryState>,
    effects_state: Option<&GameExecutionEffectsState>,
    previous: Option<&GameExecutionTransportState>,
) -> GameExecutionTransportState {
    let mut next = GameExecutionTransportState::default();
    if let Some(previous) = previous {
        next.journal = previous.journal.clone();
        next.frame_index = previous.frame_index;
    }

    let Some(registry_state) = registry_state else {
        return next;
    };
    let Some(snapshot) = registry_state.loaded.get(DEFAULT_INPUT_REGISTRY_KIND) else {
        next.status = "degraded".to_string();
        next.detail = format!(
            "missing required '{}' registry in runtime cache",
            DEFAULT_INPUT_REGISTRY_KIND
        );
        next.issues = registry_state.errors.clone();
        next.issues.push(next.detail.clone());
        return next;
    };
    next.issues = registry_state.errors.clone();
    let document = match load_registry_document(&snapshot.asset_path) {
        Ok(document) => document,
        Err(error) => {
            next.status = "degraded".to_string();
            next.detail = "failed to parse input registry".to_string();
            next.issues.push(error);
            return next;
        }
    };
    let policy = parse_runtime_execution_transport_policy(&document, &mut next.issues);
    next.channel_routes_loaded = policy.channel_routes.len();

    let Some(effects_state) = effects_state else {
        next.status = "pending".to_string();
        next.detail = "awaiting execution-effects state".to_string();
        next.journal_retained = next.journal.len();
        next.replay_fingerprint = compute_transport_journal_fingerprint(&next.journal);
        return next;
    };

    next.tick_index = effects_state.tick_index;
    next.active_phase = effects_state.active_phase.clone();
    next.frame_index = effects_state.frame_index;
    next.issues.extend(effects_state.issues.iter().cloned());

    if effects_state.status == "pending" {
        next.status = "pending".to_string();
        next.detail = effects_state.detail.clone();
        next.journal_retained = next.journal.len();
        next.replay_fingerprint = compute_transport_journal_fingerprint(&next.journal);
        return next;
    }
    if !effects_state.ready {
        next.status = "degraded".to_string();
        next.detail = format!(
            "cannot derive transport journal while execution effects are {}",
            effects_state.status
        );
        next.journal_retained = next.journal.len();
        next.replay_fingerprint = compute_transport_journal_fingerprint(&next.journal);
        return next;
    }

    for effect in &effects_state.events {
        if next
            .journal
            .last()
            .is_some_and(|entry| effect.sequence <= entry.sequence)
        {
            continue;
        }
        let (transport_route_index, transport_route) =
            select_runtime_execution_transport_channel_route(
                &policy.channel_routes,
                &effect.replication_channel,
            )
            .map(|(index, route)| (Some(index), Some(route)))
            .unwrap_or((None, None));

        next.journal.push(GameExecutionTransportEnvelope {
            sequence: effect.sequence,
            frame_index: effects_state.frame_index,
            tick_index: effects_state.tick_index,
            agent: effect.agent.clone(),
            command_kind: effect.command_kind.clone(),
            input_action: effect.input_action.clone(),
            effect_kind: effect.effect_kind.clone(),
            replication_channel: effect.replication_channel.clone(),
            transport_lane: transport_route
                .map(|item| item.lane.clone())
                .unwrap_or_else(|| policy.default_lane.clone()),
            transport_reliability: transport_route
                .map(|item| item.reliability.clone())
                .unwrap_or_else(|| policy.default_reliability.clone()),
            rollback_enabled: transport_route
                .map(|item| item.rollback)
                .unwrap_or(policy.default_rollback),
            active: effect.active,
            intensity: effect.intensity,
            translation_delta: effect.translation_delta,
            rotation_delta: effect.rotation_delta,
            effect_route_key: effect.route_key.clone(),
            transport_route_key: transport_route_index
                .map(|index| format!("runtime_execution_transport.channel_routes[{index}]"))
                .unwrap_or_else(|| "runtime_execution_transport.default".to_string()),
        });
        next.events_ingested += 1;
    }

    if next.journal.len() > policy.max_journal_events as usize {
        let drop_count = next.journal.len() - policy.max_journal_events as usize;
        next.journal.drain(0..drop_count);
        next.issues.push(format!(
            "runtime_execution_transport exceeded max_journal_events {}; dropped oldest {} event(s)",
            policy.max_journal_events, drop_count
        ));
    }

    let rollback_min_frame = next
        .frame_index
        .saturating_sub(policy.rollback_window_frames as u64);
    next.rollback_floor_sequence = next
        .journal
        .iter()
        .find(|entry| entry.rollback_enabled && entry.frame_index >= rollback_min_frame)
        .map(|entry| entry.sequence)
        .unwrap_or(0);
    next.journal_retained = next.journal.len();
    next.replay_fingerprint = compute_transport_journal_fingerprint(&next.journal);
    next.ready = next.issues.is_empty() && next.events_ingested > 0;
    next.status = if next.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    next.detail = if next.ready {
        format!(
            "ingested {} transport event(s); retained {} journal event(s)",
            next.events_ingested, next.journal_retained
        )
    } else if next.events_ingested == 0 {
        "no new execution effects were ingested for transport journal".to_string()
    } else {
        "execution transport journal projection completed with contract issues".to_string()
    };
    next
}

pub fn derive_execution_transport_backend_state(
    registry_state: Option<&GameDataRegistryState>,
    transport_state: Option<&GameExecutionTransportState>,
    previous: Option<&GameExecutionTransportBackendState>,
) -> GameExecutionTransportBackendState {
    let mut next = GameExecutionTransportBackendState::default();
    if let Some(previous) = previous {
        next.exported_through_sequence = previous.exported_through_sequence;
    }

    let Some(registry_state) = registry_state else {
        return next;
    };
    let Some(snapshot) = registry_state.loaded.get(DEFAULT_INPUT_REGISTRY_KIND) else {
        next.status = "degraded".to_string();
        next.detail = format!(
            "missing required '{}' registry in runtime cache",
            DEFAULT_INPUT_REGISTRY_KIND
        );
        next.issues = registry_state.errors.clone();
        next.issues.push(next.detail.clone());
        return next;
    };
    next.issues = registry_state.errors.clone();
    let document = match load_registry_document(&snapshot.asset_path) {
        Ok(document) => document,
        Err(error) => {
            next.status = "degraded".to_string();
            next.detail = "failed to parse input registry".to_string();
            next.issues.push(error);
            return next;
        }
    };
    let policy = parse_runtime_execution_transport_backends_policy(&document, &mut next.issues);
    next.routes_loaded = policy.lane_backends.len();

    let Some(transport_state) = transport_state else {
        return next;
    };
    next.tick_index = transport_state.tick_index;
    next.active_phase = transport_state.active_phase.clone();
    next.frame_index = transport_state.frame_index;
    next.rollback_floor_sequence = transport_state.rollback_floor_sequence;
    next.issues.extend(transport_state.issues.iter().cloned());

    if transport_state.status == "pending" {
        next.status = "pending".to_string();
        next.detail = transport_state.detail.clone();
        next.backend_fingerprint = compute_transport_backend_payload_fingerprint(&next.payloads);
        return next;
    }
    if transport_state.journal.is_empty() {
        next.status = "degraded".to_string();
        next.detail = "execution transport journal is empty".to_string();
        next.backend_fingerprint = compute_transport_backend_payload_fingerprint(&next.payloads);
        return next;
    }

    let mut lane_groups: BTreeMap<
        (String, String, bool, String, String, String, usize, u32),
        Vec<GameExecutionTransportEnvelope>,
    > = BTreeMap::new();
    for entry in transport_state
        .journal
        .iter()
        .filter(|entry| entry.sequence > next.exported_through_sequence)
    {
        let (route_index, route) = select_runtime_execution_transport_lane_backend_route(
            &policy.lane_backends,
            &entry.transport_lane,
        )
        .map(|(index, route)| (Some(index), Some(route)))
        .unwrap_or((None, None));
        let backend_kind = route
            .map(|item| item.backend.clone())
            .unwrap_or_else(|| policy.default_backend.clone());
        let payload_kind = route
            .map(|item| item.payload_kind.clone())
            .unwrap_or_else(|| policy.default_payload_kind.clone());
        let max_events_per_payload = route
            .map(|item| item.max_events_per_payload)
            .unwrap_or(policy.default_max_events_per_payload);
        let route_key = route_index
            .map(|index| format!("runtime_execution_transport_backends.lane_backends[{index}]"))
            .unwrap_or_else(|| "runtime_execution_transport_backends.default".to_string());
        lane_groups
            .entry((
                entry.transport_lane.clone(),
                entry.transport_reliability.clone(),
                entry.rollback_enabled,
                backend_kind,
                payload_kind,
                route_key,
                route_index.unwrap_or(usize::MAX),
                max_events_per_payload,
            ))
            .or_default()
            .push(entry.clone());
    }

    for (
        (
            lane,
            reliability,
            rollback_enabled,
            backend_kind,
            payload_kind,
            route_key,
            _route_index,
            max_events_per_payload,
        ),
        entries,
    ) in lane_groups
    {
        for chunk in entries.chunks(max_events_per_payload.max(1) as usize) {
            let sequence_start = chunk.first().map(|entry| entry.sequence).unwrap_or(0);
            let sequence_end = chunk.last().map(|entry| entry.sequence).unwrap_or(0);
            let agents: Vec<String> = chunk
                .iter()
                .map(|entry| entry.agent.clone())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect();
            let command_kinds: Vec<String> = chunk
                .iter()
                .map(|entry| entry.command_kind.clone())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect();
            next.payloads.push(GameExecutionTransportBackendPayload {
                sequence_start,
                sequence_end,
                event_count: chunk.len(),
                transport_lane: lane.clone(),
                transport_reliability: reliability.clone(),
                rollback_enabled,
                backend_kind: backend_kind.clone(),
                payload_kind: payload_kind.clone(),
                agents,
                command_kinds,
                route_key: route_key.clone(),
            });
        }
    }

    next.payloads.sort_by(|left, right| {
        (
            left.sequence_start,
            left.sequence_end,
            &left.transport_lane,
            &left.backend_kind,
            &left.payload_kind,
        )
            .cmp(&(
                right.sequence_start,
                right.sequence_end,
                &right.transport_lane,
                &right.backend_kind,
                &right.payload_kind,
            ))
    });
    if next.payloads.len() > policy.max_payloads_per_frame as usize {
        let drop_count = next.payloads.len() - policy.max_payloads_per_frame as usize;
        next.payloads
            .truncate(policy.max_payloads_per_frame as usize);
        next.issues.push(format!(
            "runtime_execution_transport_backends exceeded max_payloads_per_frame {}; dropped {} payload(s)",
            policy.max_payloads_per_frame, drop_count
        ));
    }
    next.payloads_emitted = next.payloads.len();
    next.lanes_emitted = next
        .payloads
        .iter()
        .map(|payload| payload.transport_lane.clone())
        .collect::<BTreeSet<_>>()
        .len();
    if let Some(max_sequence) = next
        .payloads
        .iter()
        .map(|payload| payload.sequence_end)
        .max()
    {
        next.exported_through_sequence = max_sequence;
    }
    next.backend_fingerprint = compute_transport_backend_payload_fingerprint(&next.payloads);
    next.ready = next.issues.is_empty();
    next.status = if next.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    next.detail = if next.payloads_emitted > 0 {
        format!(
            "emitted {} backend payload(s) across {} lane(s)",
            next.payloads_emitted, next.lanes_emitted
        )
    } else {
        "no new transport journal events for backend emission".to_string()
    };
    next
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct AiActionRoute {
    agent: Option<String>,
    phase: Option<String>,
    decision_prefix: String,
    gameplay_action: String,
    input_action: Option<String>,
    camera_rig: Option<String>,
    priority: u32,
}

#[derive(Debug, Clone)]
struct RuntimeExecutionRoute {
    agent: Option<String>,
    phase: Option<String>,
    input_action: String,
    input_kind: Option<String>,
    command_kind: String,
    vector_space: String,
    linear_scale: f32,
    angular_scale: f32,
    active_only: bool,
    priority: u32,
}

#[derive(Debug, Clone)]
struct RuntimeExecutionApplyPolicy {
    fixed_step_seconds: f32,
    max_linear_speed: f32,
    max_angular_speed: f32,
    max_frame_steps: u32,
    inactive_decay: f32,
}

#[derive(Debug, Clone)]
struct RuntimeExecutionEffectsPolicy {
    max_events_per_frame: u32,
    default_replication_channel: String,
    routes: Vec<RuntimeExecutionEffectRoute>,
}

#[derive(Debug, Clone)]
struct RuntimeExecutionEffectRoute {
    agent: Option<String>,
    phase: Option<String>,
    command_prefix: String,
    effect_kind: String,
    replication_channel: String,
    emit_inactive: bool,
    priority: u32,
}

#[derive(Debug, Clone)]
struct RuntimeExecutionTransportPolicy {
    max_journal_events: u32,
    rollback_window_frames: u32,
    default_lane: String,
    default_reliability: String,
    default_rollback: bool,
    channel_routes: Vec<RuntimeExecutionTransportChannelRoute>,
}

#[derive(Debug, Clone)]
struct RuntimeExecutionTransportChannelRoute {
    channel_prefix: String,
    lane: String,
    reliability: String,
    rollback: bool,
    priority: u32,
}

#[derive(Debug, Clone)]
struct RuntimeExecutionTransportBackendsPolicy {
    max_payloads_per_frame: u32,
    default_backend: String,
    default_payload_kind: String,
    default_max_events_per_payload: u32,
    lane_backends: Vec<RuntimeExecutionTransportLaneBackendRoute>,
}

#[derive(Debug, Clone)]
struct RuntimeExecutionTransportLaneBackendRoute {
    lane_prefix: String,
    backend: String,
    payload_kind: String,
    max_events_per_payload: u32,
    priority: u32,
}

impl AiActionRoute {
    fn matches(&self, agent: &str, phase: &str, decision: &str) -> bool {
        self.agent.as_deref().is_none_or(|value| value == agent)
            && self.phase.as_deref().is_none_or(|value| value == phase)
            && decision.starts_with(&self.decision_prefix)
    }
}

impl RuntimeExecutionRoute {
    fn matches(&self, agent: &str, phase: &str, input_action: &str, input_kind: &str) -> bool {
        self.agent.as_deref().is_none_or(|value| value == agent)
            && self.phase.as_deref().is_none_or(|value| value == phase)
            && self.input_action == input_action
            && self
                .input_kind
                .as_deref()
                .is_none_or(|value| value == input_kind)
    }
}

impl RuntimeExecutionEffectRoute {
    fn matches(&self, agent: &str, phase: &str, command_kind: &str) -> bool {
        self.agent.as_deref().is_none_or(|value| value == agent)
            && self.phase.as_deref().is_none_or(|value| value == phase)
            && command_kind.starts_with(&self.command_prefix)
    }
}

impl RuntimeExecutionTransportChannelRoute {
    fn matches(&self, channel: &str) -> bool {
        channel.starts_with(&self.channel_prefix)
    }
}

impl RuntimeExecutionTransportLaneBackendRoute {
    fn matches(&self, lane: &str) -> bool {
        lane.starts_with(&self.lane_prefix)
    }
}

impl Default for RuntimeExecutionApplyPolicy {
    fn default() -> Self {
        Self {
            fixed_step_seconds: DEFAULT_EXECUTION_FIXED_STEP_SECONDS,
            max_linear_speed: DEFAULT_EXECUTION_MAX_LINEAR_SPEED,
            max_angular_speed: DEFAULT_EXECUTION_MAX_ANGULAR_SPEED,
            max_frame_steps: DEFAULT_EXECUTION_MAX_FRAME_STEPS,
            inactive_decay: DEFAULT_EXECUTION_INACTIVE_DECAY,
        }
    }
}

impl Default for RuntimeExecutionEffectsPolicy {
    fn default() -> Self {
        Self {
            max_events_per_frame: DEFAULT_EXECUTION_EFFECT_MAX_EVENTS,
            default_replication_channel: DEFAULT_EXECUTION_EFFECT_REPLICATION_CHANNEL.to_string(),
            routes: Vec::new(),
        }
    }
}

impl Default for RuntimeExecutionTransportPolicy {
    fn default() -> Self {
        Self {
            max_journal_events: DEFAULT_EXECUTION_TRANSPORT_MAX_JOURNAL_EVENTS,
            rollback_window_frames: DEFAULT_EXECUTION_TRANSPORT_ROLLBACK_WINDOW_FRAMES,
            default_lane: DEFAULT_EXECUTION_TRANSPORT_DEFAULT_LANE.to_string(),
            default_reliability: DEFAULT_EXECUTION_TRANSPORT_DEFAULT_RELIABILITY.to_string(),
            default_rollback: DEFAULT_EXECUTION_TRANSPORT_DEFAULT_ROLLBACK,
            channel_routes: Vec::new(),
        }
    }
}

impl Default for RuntimeExecutionTransportBackendsPolicy {
    fn default() -> Self {
        Self {
            max_payloads_per_frame: DEFAULT_EXECUTION_TRANSPORT_BACKEND_MAX_PAYLOADS_PER_FRAME,
            default_backend: DEFAULT_EXECUTION_TRANSPORT_BACKEND_DEFAULT_KIND.to_string(),
            default_payload_kind: DEFAULT_EXECUTION_TRANSPORT_BACKEND_DEFAULT_PAYLOAD_KIND
                .to_string(),
            default_max_events_per_payload:
                DEFAULT_EXECUTION_TRANSPORT_BACKEND_DEFAULT_MAX_EVENTS_PER_PAYLOAD,
            lane_backends: Vec::new(),
        }
    }
}

fn parse_env_bool(key: &str) -> Option<bool> {
    match std::env::var(key) {
        Ok(raw) => match raw.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Some(true),
            "0" | "false" | "no" | "off" => Some(false),
            _ => None,
        },
        Err(_) => None,
    }
}

fn parse_env_csv(key: &str) -> Option<Vec<String>> {
    match std::env::var(key) {
        Ok(raw) => {
            let values: Vec<String> = raw
                .split(',')
                .map(|value| value.trim())
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
                .collect();
            (!values.is_empty()).then_some(values)
        }
        Err(_) => None,
    }
}

fn default_required_registry_kinds() -> Vec<String> {
    [
        "input_bindings",
        "gameplay_tags",
        "actor_archetypes",
        "ai_agents",
        "camera_rigs",
        "visual_scripting",
    ]
    .into_iter()
    .map(ToOwned::to_owned)
    .collect()
}

fn normalize_registry_kinds(kinds: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut normalized = Vec::new();
    for kind in kinds {
        let trimmed = kind.trim();
        if trimmed.is_empty() || normalized.iter().any(|existing| existing == trimmed) {
            continue;
        }
        normalized.push(trimmed.to_string());
    }
    if normalized.is_empty() {
        default_required_registry_kinds()
    } else {
        normalized
    }
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

fn parse_ai_action_routes(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> Vec<AiActionRoute> {
    let mut routes = Vec::new();
    let Some(projection_table) = document
        .get("ai_action_projection")
        .and_then(toml::Value::as_table)
    else {
        issues.push("actor registry missing required table 'ai_action_projection'".to_string());
        return routes;
    };
    let Some(entries) = projection_table
        .get("routes")
        .and_then(toml::Value::as_array)
    else {
        issues.push(
            "actor registry missing required array 'ai_action_projection.routes'".to_string(),
        );
        return routes;
    };

    for (index, entry) in entries.iter().enumerate() {
        let Some(table) = entry.as_table() else {
            issues.push(format!(
                "ai_action_projection.routes[{index}] is not a table"
            ));
            continue;
        };
        let Some(decision_prefix) = table.get("decision_prefix").and_then(toml::Value::as_str)
        else {
            issues.push(format!(
                "ai_action_projection.routes[{index}] missing 'decision_prefix'"
            ));
            continue;
        };
        let Some(gameplay_action) = table.get("gameplay_action").and_then(toml::Value::as_str)
        else {
            issues.push(format!(
                "ai_action_projection.routes[{index}] missing 'gameplay_action'"
            ));
            continue;
        };

        let decision_prefix = decision_prefix.trim();
        let gameplay_action = gameplay_action.trim();
        if decision_prefix.is_empty() {
            issues.push(format!(
                "ai_action_projection.routes[{index}] has empty 'decision_prefix'"
            ));
            continue;
        }
        if gameplay_action.is_empty() {
            issues.push(format!(
                "ai_action_projection.routes[{index}] has empty 'gameplay_action'"
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
        let input_action = table
            .get("input_action")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let camera_rig = table
            .get("camera_rig")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let priority = table
            .get("priority")
            .and_then(toml::Value::as_integer)
            .and_then(|value| u32::try_from(value).ok())
            .unwrap_or(100);

        routes.push(AiActionRoute {
            agent,
            phase,
            decision_prefix: decision_prefix.to_string(),
            gameplay_action: gameplay_action.to_string(),
            input_action,
            camera_rig,
            priority,
        });
    }

    routes
}

fn parse_runtime_execution_routes(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> Vec<RuntimeExecutionRoute> {
    let mut routes = Vec::new();
    let Some(execution_table) = document
        .get("runtime_execution")
        .and_then(toml::Value::as_table)
    else {
        return routes;
    };

    let Some(entries) = execution_table
        .get("routes")
        .and_then(toml::Value::as_array)
    else {
        issues.push(
            "input registry table 'runtime_execution' missing required array 'routes'".to_string(),
        );
        return routes;
    };

    for (index, entry) in entries.iter().enumerate() {
        let Some(table) = entry.as_table() else {
            issues.push(format!("runtime_execution.routes[{index}] is not a table"));
            continue;
        };

        let Some(input_action) = table.get("input_action").and_then(toml::Value::as_str) else {
            issues.push(format!(
                "runtime_execution.routes[{index}] missing 'input_action'"
            ));
            continue;
        };
        let Some(command_kind) = table.get("command_kind").and_then(toml::Value::as_str) else {
            issues.push(format!(
                "runtime_execution.routes[{index}] missing 'command_kind'"
            ));
            continue;
        };

        let input_action = input_action.trim();
        let command_kind = command_kind.trim();
        if input_action.is_empty() {
            issues.push(format!(
                "runtime_execution.routes[{index}] has empty 'input_action'"
            ));
            continue;
        }
        if command_kind.is_empty() {
            issues.push(format!(
                "runtime_execution.routes[{index}] has empty 'command_kind'"
            ));
            continue;
        }

        let vector_space = table
            .get("vector_space")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| default_vector_space(command_kind));
        if !matches!(
            vector_space.as_str(),
            "none" | "move_xz" | "move_xy" | "look_yaw_pitch"
        ) {
            issues.push(format!(
                "runtime_execution.routes[{index}] has invalid 'vector_space' '{}'",
                vector_space
            ));
            continue;
        }

        let linear_scale = table
            .get("linear_scale")
            .and_then(parse_toml_f32)
            .unwrap_or(1.0);
        let angular_scale = table
            .get("angular_scale")
            .and_then(parse_toml_f32)
            .unwrap_or(1.0);
        let active_only = table
            .get("active_only")
            .and_then(toml::Value::as_bool)
            .unwrap_or(true);
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
        let input_kind = table
            .get("input_kind")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);

        routes.push(RuntimeExecutionRoute {
            agent,
            phase,
            input_action: input_action.to_string(),
            input_kind,
            command_kind: command_kind.to_string(),
            vector_space,
            linear_scale,
            angular_scale,
            active_only,
            priority,
        });
    }

    routes
}

fn parse_runtime_execution_apply_policy(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> RuntimeExecutionApplyPolicy {
    let mut policy = RuntimeExecutionApplyPolicy::default();
    let Some(table) = document
        .get("runtime_execution_apply")
        .and_then(toml::Value::as_table)
    else {
        return policy;
    };

    if let Some(value) = table.get("fixed_step_seconds").and_then(parse_toml_f32) {
        if value > 0.0 {
            policy.fixed_step_seconds = value;
        } else {
            issues.push(
                "runtime_execution_apply.fixed_step_seconds must be > 0; using default".to_string(),
            );
        }
    }
    if let Some(value) = table.get("max_linear_speed").and_then(parse_toml_f32) {
        if value > 0.0 {
            policy.max_linear_speed = value;
        } else {
            issues.push(
                "runtime_execution_apply.max_linear_speed must be > 0; using default".to_string(),
            );
        }
    }
    if let Some(value) = table.get("max_angular_speed").and_then(parse_toml_f32) {
        if value > 0.0 {
            policy.max_angular_speed = value;
        } else {
            issues.push(
                "runtime_execution_apply.max_angular_speed must be > 0; using default".to_string(),
            );
        }
    }
    if let Some(value) = table
        .get("max_frame_steps")
        .and_then(toml::Value::as_integer)
    {
        if let Ok(parsed) = u32::try_from(value) {
            if parsed > 0 {
                policy.max_frame_steps = parsed;
            } else {
                issues.push(
                    "runtime_execution_apply.max_frame_steps must be > 0; using default"
                        .to_string(),
                );
            }
        } else {
            issues.push(
                "runtime_execution_apply.max_frame_steps must be an unsigned integer; using default"
                    .to_string(),
            );
        }
    }
    if let Some(value) = table.get("inactive_decay").and_then(parse_toml_f32) {
        if (0.0..=1.0).contains(&value) {
            policy.inactive_decay = value;
        } else {
            issues.push(
                "runtime_execution_apply.inactive_decay must be in [0, 1]; using default"
                    .to_string(),
            );
        }
    }

    policy
}

fn parse_runtime_execution_effects_policy(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> RuntimeExecutionEffectsPolicy {
    let mut policy = RuntimeExecutionEffectsPolicy::default();
    let Some(table) = document
        .get("runtime_execution_effects")
        .and_then(toml::Value::as_table)
    else {
        return policy;
    };

    if let Some(value) = table
        .get("max_events_per_frame")
        .and_then(toml::Value::as_integer)
    {
        if let Ok(parsed) = u32::try_from(value) {
            if parsed > 0 {
                policy.max_events_per_frame = parsed;
            } else {
                issues.push(
                    "runtime_execution_effects.max_events_per_frame must be > 0; using default"
                        .to_string(),
                );
            }
        } else {
            issues.push(
                "runtime_execution_effects.max_events_per_frame must be an unsigned integer; using default"
                    .to_string(),
            );
        }
    }

    if let Some(value) = table
        .get("default_replication_channel")
        .and_then(toml::Value::as_str)
    {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            issues.push(
                "runtime_execution_effects.default_replication_channel must be non-empty; using default"
                    .to_string(),
            );
        } else {
            policy.default_replication_channel = trimmed.to_string();
        }
    }

    let Some(entries) = table.get("routes").and_then(toml::Value::as_array) else {
        issues.push(
            "input registry table 'runtime_execution_effects' missing required array 'routes'"
                .to_string(),
        );
        return policy;
    };

    for (index, entry) in entries.iter().enumerate() {
        let Some(route_table) = entry.as_table() else {
            issues.push(format!(
                "runtime_execution_effects.routes[{index}] is not a table"
            ));
            continue;
        };
        let Some(command_prefix) = route_table
            .get("command_prefix")
            .and_then(toml::Value::as_str)
        else {
            issues.push(format!(
                "runtime_execution_effects.routes[{index}] missing 'command_prefix'"
            ));
            continue;
        };
        let command_prefix = command_prefix.trim();
        if command_prefix.is_empty() {
            issues.push(format!(
                "runtime_execution_effects.routes[{index}] has empty 'command_prefix'"
            ));
            continue;
        }

        let effect_kind = route_table
            .get("effect_kind")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| default_effect_kind(command_prefix));
        if !matches!(
            effect_kind.as_str(),
            "movement" | "impulse" | "ability_cast" | "interaction"
        ) {
            issues.push(format!(
                "runtime_execution_effects.routes[{index}] has invalid 'effect_kind' '{}'",
                effect_kind
            ));
            continue;
        }

        let replication_channel = route_table
            .get("replication_channel")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| policy.default_replication_channel.clone());
        let emit_inactive = route_table
            .get("emit_inactive")
            .and_then(toml::Value::as_bool)
            .unwrap_or(false);
        let priority = route_table
            .get("priority")
            .and_then(toml::Value::as_integer)
            .and_then(|value| u32::try_from(value).ok())
            .unwrap_or(100);
        let agent = route_table
            .get("agent")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let phase = route_table
            .get("phase")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);

        policy.routes.push(RuntimeExecutionEffectRoute {
            agent,
            phase,
            command_prefix: command_prefix.to_string(),
            effect_kind,
            replication_channel,
            emit_inactive,
            priority,
        });
    }

    policy
}

fn parse_runtime_execution_transport_policy(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> RuntimeExecutionTransportPolicy {
    let mut policy = RuntimeExecutionTransportPolicy::default();
    let Some(table) = document
        .get("runtime_execution_transport")
        .and_then(toml::Value::as_table)
    else {
        return policy;
    };

    if let Some(value) = table
        .get("max_journal_events")
        .and_then(toml::Value::as_integer)
    {
        if let Ok(parsed) = u32::try_from(value) {
            if parsed > 0 {
                policy.max_journal_events = parsed;
            } else {
                issues.push(
                    "runtime_execution_transport.max_journal_events must be > 0; using default"
                        .to_string(),
                );
            }
        } else {
            issues.push(
                "runtime_execution_transport.max_journal_events must be an unsigned integer; using default"
                    .to_string(),
            );
        }
    }

    if let Some(value) = table
        .get("rollback_window_frames")
        .and_then(toml::Value::as_integer)
    {
        if let Ok(parsed) = u32::try_from(value) {
            policy.rollback_window_frames = parsed;
        } else {
            issues.push(
                "runtime_execution_transport.rollback_window_frames must be an unsigned integer; using default"
                    .to_string(),
            );
        }
    }

    if let Some(value) = table.get("default_lane").and_then(toml::Value::as_str) {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            issues.push(
                "runtime_execution_transport.default_lane must be non-empty; using default"
                    .to_string(),
            );
        } else {
            policy.default_lane = trimmed.to_string();
        }
    }

    if let Some(value) = table
        .get("default_reliability")
        .and_then(toml::Value::as_str)
    {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            issues.push(
                "runtime_execution_transport.default_reliability must be non-empty; using default"
                    .to_string(),
            );
        } else {
            policy.default_reliability = trimmed.to_string();
        }
    }

    if let Some(value) = table.get("default_rollback").and_then(toml::Value::as_bool) {
        policy.default_rollback = value;
    }

    if let Some(entries) = table.get("channel_routes").and_then(toml::Value::as_array) {
        for (index, entry) in entries.iter().enumerate() {
            let Some(route_table) = entry.as_table() else {
                issues.push(format!(
                    "runtime_execution_transport.channel_routes[{index}] is not a table"
                ));
                continue;
            };
            let Some(channel_prefix) = route_table
                .get("channel_prefix")
                .and_then(toml::Value::as_str)
            else {
                issues.push(format!(
                    "runtime_execution_transport.channel_routes[{index}] missing 'channel_prefix'"
                ));
                continue;
            };
            let channel_prefix = channel_prefix.trim();
            if channel_prefix.is_empty() {
                issues.push(format!(
                    "runtime_execution_transport.channel_routes[{index}] has empty 'channel_prefix'"
                ));
                continue;
            }

            let lane = route_table
                .get("lane")
                .and_then(toml::Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| policy.default_lane.clone());
            let reliability = route_table
                .get("reliability")
                .and_then(toml::Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| policy.default_reliability.clone());
            let rollback = route_table
                .get("rollback")
                .and_then(toml::Value::as_bool)
                .unwrap_or(policy.default_rollback);
            let priority = route_table
                .get("priority")
                .and_then(toml::Value::as_integer)
                .and_then(|value| u32::try_from(value).ok())
                .unwrap_or(100);

            policy
                .channel_routes
                .push(RuntimeExecutionTransportChannelRoute {
                    channel_prefix: channel_prefix.to_string(),
                    lane,
                    reliability,
                    rollback,
                    priority,
                });
        }
    }

    policy
}

fn parse_runtime_execution_transport_backends_policy(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> RuntimeExecutionTransportBackendsPolicy {
    let mut policy = RuntimeExecutionTransportBackendsPolicy::default();
    let Some(table) = document
        .get("runtime_execution_transport_backends")
        .and_then(toml::Value::as_table)
    else {
        return policy;
    };

    if let Some(value) = table
        .get("max_payloads_per_frame")
        .and_then(toml::Value::as_integer)
    {
        if let Ok(parsed) = u32::try_from(value) {
            if parsed > 0 {
                policy.max_payloads_per_frame = parsed;
            } else {
                issues.push(
                    "runtime_execution_transport_backends.max_payloads_per_frame must be > 0; using default"
                        .to_string(),
                );
            }
        } else {
            issues.push(
                "runtime_execution_transport_backends.max_payloads_per_frame must be an unsigned integer; using default"
                    .to_string(),
            );
        }
    }

    if let Some(value) = table.get("default_backend").and_then(toml::Value::as_str) {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            issues.push(
                "runtime_execution_transport_backends.default_backend must be non-empty; using default"
                    .to_string(),
            );
        } else {
            policy.default_backend = trimmed.to_string();
        }
    }

    if let Some(value) = table
        .get("default_payload_kind")
        .and_then(toml::Value::as_str)
    {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            issues.push(
                "runtime_execution_transport_backends.default_payload_kind must be non-empty; using default"
                    .to_string(),
            );
        } else {
            policy.default_payload_kind = trimmed.to_string();
        }
    }

    if let Some(value) = table
        .get("default_max_events_per_payload")
        .and_then(toml::Value::as_integer)
    {
        if let Ok(parsed) = u32::try_from(value) {
            if parsed > 0 {
                policy.default_max_events_per_payload = parsed;
            } else {
                issues.push(
                    "runtime_execution_transport_backends.default_max_events_per_payload must be > 0; using default"
                        .to_string(),
                );
            }
        } else {
            issues.push(
                "runtime_execution_transport_backends.default_max_events_per_payload must be an unsigned integer; using default"
                    .to_string(),
            );
        }
    }

    if let Some(entries) = table.get("lane_backends").and_then(toml::Value::as_array) {
        for (index, entry) in entries.iter().enumerate() {
            let Some(route_table) = entry.as_table() else {
                issues.push(format!(
                    "runtime_execution_transport_backends.lane_backends[{index}] is not a table"
                ));
                continue;
            };

            let Some(lane_prefix) = route_table.get("lane_prefix").and_then(toml::Value::as_str)
            else {
                issues.push(format!(
                    "runtime_execution_transport_backends.lane_backends[{index}] missing 'lane_prefix'"
                ));
                continue;
            };
            let lane_prefix = lane_prefix.trim();
            if lane_prefix.is_empty() {
                issues.push(format!(
                    "runtime_execution_transport_backends.lane_backends[{index}] has empty 'lane_prefix'"
                ));
                continue;
            }

            let backend = route_table
                .get("backend")
                .and_then(toml::Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| policy.default_backend.clone());
            let payload_kind = route_table
                .get("payload_kind")
                .and_then(toml::Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| policy.default_payload_kind.clone());
            let max_events_per_payload = route_table
                .get("max_events_per_payload")
                .and_then(toml::Value::as_integer)
                .and_then(|value| u32::try_from(value).ok())
                .filter(|value| *value > 0)
                .unwrap_or(policy.default_max_events_per_payload);
            let priority = route_table
                .get("priority")
                .and_then(toml::Value::as_integer)
                .and_then(|value| u32::try_from(value).ok())
                .unwrap_or(100);

            policy
                .lane_backends
                .push(RuntimeExecutionTransportLaneBackendRoute {
                    lane_prefix: lane_prefix.to_string(),
                    backend,
                    payload_kind,
                    max_events_per_payload,
                    priority,
                });
        }
    }

    policy
}

fn select_runtime_execution_route<'a>(
    routes: &'a [RuntimeExecutionRoute],
    agent: &str,
    phase: &str,
    input_action: &str,
    input_kind: &str,
) -> Option<(usize, &'a RuntimeExecutionRoute)> {
    let mut selected: Option<(usize, &RuntimeExecutionRoute)> = None;
    for (index, route) in routes.iter().enumerate() {
        if !route.matches(agent, phase, input_action, input_kind) {
            continue;
        }
        let route_rank = (
            route.priority,
            route.input_kind.is_some(),
            route.phase.is_some(),
            route.agent.is_some(),
        );
        let should_replace = match selected {
            Some((_, current)) => {
                route_rank
                    > (
                        current.priority,
                        current.input_kind.is_some(),
                        current.phase.is_some(),
                        current.agent.is_some(),
                    )
            }
            None => true,
        };
        if should_replace {
            selected = Some((index, route));
        }
    }
    selected
}

fn select_runtime_execution_effect_route<'a>(
    routes: &'a [RuntimeExecutionEffectRoute],
    agent: &str,
    phase: &str,
    command_kind: &str,
) -> Option<(usize, &'a RuntimeExecutionEffectRoute)> {
    let mut selected: Option<(usize, &RuntimeExecutionEffectRoute)> = None;
    for (index, route) in routes.iter().enumerate() {
        if !route.matches(agent, phase, command_kind) {
            continue;
        }
        let route_rank = (
            route.priority,
            route.command_prefix.len(),
            route.phase.is_some(),
            route.agent.is_some(),
        );
        let should_replace = match selected {
            Some((_, current)) => {
                route_rank
                    > (
                        current.priority,
                        current.command_prefix.len(),
                        current.phase.is_some(),
                        current.agent.is_some(),
                    )
            }
            None => true,
        };
        if should_replace {
            selected = Some((index, route));
        }
    }
    selected
}

fn select_runtime_execution_transport_channel_route<'a>(
    routes: &'a [RuntimeExecutionTransportChannelRoute],
    channel: &str,
) -> Option<(usize, &'a RuntimeExecutionTransportChannelRoute)> {
    let mut selected: Option<(usize, &RuntimeExecutionTransportChannelRoute)> = None;
    for (index, route) in routes.iter().enumerate() {
        if !route.matches(channel) {
            continue;
        }
        let route_rank = (route.priority, route.channel_prefix.len());
        let should_replace = match selected {
            Some((_, current)) => route_rank > (current.priority, current.channel_prefix.len()),
            None => true,
        };
        if should_replace {
            selected = Some((index, route));
        }
    }
    selected
}

fn select_runtime_execution_transport_lane_backend_route<'a>(
    routes: &'a [RuntimeExecutionTransportLaneBackendRoute],
    lane: &str,
) -> Option<(usize, &'a RuntimeExecutionTransportLaneBackendRoute)> {
    let mut selected: Option<(usize, &RuntimeExecutionTransportLaneBackendRoute)> = None;
    for (index, route) in routes.iter().enumerate() {
        if !route.matches(lane) {
            continue;
        }
        let route_rank = (route.priority, route.lane_prefix.len());
        let should_replace = match selected {
            Some((_, current)) => route_rank > (current.priority, current.lane_prefix.len()),
            None => true,
        };
        if should_replace {
            selected = Some((index, route));
        }
    }
    selected
}

fn project_runtime_execution_command(
    intent: &GameAgentInputIntent,
    route: &RuntimeExecutionRoute,
) -> GameAgentExecutionCommand {
    let raw_linear = match route.vector_space.as_str() {
        "move_xz" => [intent.vector_2d[0], 0.0, intent.vector_2d[1]],
        "move_xy" => [intent.vector_2d[0], intent.vector_2d[1], 0.0],
        _ => [0.0, 0.0, 0.0],
    };
    let raw_angular = match route.vector_space.as_str() {
        "look_yaw_pitch" => [intent.vector_2d[1], intent.vector_2d[0], 0.0],
        _ => [0.0, 0.0, 0.0],
    };

    let active = if route.active_only {
        intent.active
    } else {
        true
    };
    let intensity = if active {
        intent.strength.max(0.0)
    } else {
        0.0
    };
    let linear_scale = route.linear_scale * intensity;
    let angular_scale = route.angular_scale * intensity;

    GameAgentExecutionCommand {
        input_action: intent.input_action.clone(),
        command_kind: route.command_kind.clone(),
        active,
        intensity,
        linear: [
            raw_linear[0] * linear_scale,
            raw_linear[1] * linear_scale,
            raw_linear[2] * linear_scale,
        ],
        angular: [
            raw_angular[0] * angular_scale,
            raw_angular[1] * angular_scale,
            raw_angular[2] * angular_scale,
        ],
        route_key: String::new(),
    }
}

fn parse_toml_f32(value: &toml::Value) -> Option<f32> {
    value
        .as_float()
        .map(|raw| raw as f32)
        .or_else(|| value.as_integer().map(|raw| raw as f32))
}

fn default_vector_space(command_kind: &str) -> String {
    if command_kind.starts_with("locomotion.") {
        "move_xz".to_string()
    } else if command_kind.starts_with("camera.look") {
        "look_yaw_pitch".to_string()
    } else {
        "none".to_string()
    }
}

fn default_effect_kind(command_prefix: &str) -> String {
    if command_prefix.starts_with("locomotion.") {
        "movement".to_string()
    } else if command_prefix.starts_with("ability.") {
        "ability_cast".to_string()
    } else if command_prefix.starts_with("interaction.")
        || command_prefix.starts_with("gameplay.interact")
    {
        "interaction".to_string()
    } else {
        "impulse".to_string()
    }
}

fn scale_vector(vector: [f32; 3], scale: f32) -> [f32; 3] {
    [vector[0] * scale, vector[1] * scale, vector[2] * scale]
}

fn clamp_vector_magnitude(vector: [f32; 3], max_magnitude: f32) -> [f32; 3] {
    let magnitude = (vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]).sqrt();
    if magnitude <= max_magnitude || magnitude <= f32::EPSILON {
        vector
    } else {
        let scale = max_magnitude / magnitude;
        scale_vector(vector, scale)
    }
}

fn compute_transport_journal_fingerprint(journal: &[GameExecutionTransportEnvelope]) -> String {
    let mut hash = 1469598103934665603u64;
    for envelope in journal.iter().rev().take(64) {
        hash = fnv1a_u64(hash, envelope.sequence);
        hash = fnv1a_u64(hash, envelope.frame_index);
        hash = fnv1a_u64(hash, envelope.tick_index);
        hash = fnv1a_str(hash, &envelope.agent);
        hash = fnv1a_str(hash, &envelope.command_kind);
        hash = fnv1a_str(hash, &envelope.replication_channel);
        hash = fnv1a_str(hash, &envelope.transport_lane);
        hash = fnv1a_str(hash, &envelope.transport_reliability);
        hash = fnv1a_u64(hash, if envelope.rollback_enabled { 1 } else { 0 });
    }
    format!("{hash:016x}")
}

fn compute_transport_backend_payload_fingerprint(
    payloads: &[GameExecutionTransportBackendPayload],
) -> String {
    let mut hash = 1469598103934665603u64;
    for payload in payloads.iter().rev().take(64) {
        hash = fnv1a_u64(hash, payload.sequence_start);
        hash = fnv1a_u64(hash, payload.sequence_end);
        hash = fnv1a_u64(hash, payload.event_count as u64);
        hash = fnv1a_str(hash, &payload.transport_lane);
        hash = fnv1a_str(hash, &payload.transport_reliability);
        hash = fnv1a_u64(hash, if payload.rollback_enabled { 1 } else { 0 });
        hash = fnv1a_str(hash, &payload.backend_kind);
        hash = fnv1a_str(hash, &payload.payload_kind);
    }
    format!("{hash:016x}")
}

fn fnv1a_u64(mut hash: u64, value: u64) -> u64 {
    for byte in value.to_le_bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(1099511628211);
    }
    hash
}

fn fnv1a_str(mut hash: u64, value: &str) -> u64 {
    for byte in value.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(1099511628211);
    }
    hash
}

fn parse_input_action_ids(
    registry_state: &GameDataRegistryState,
    issues: &mut Vec<String>,
) -> BTreeSet<String> {
    let Some(snapshot) = registry_state.loaded.get(DEFAULT_INPUT_REGISTRY_KIND) else {
        return BTreeSet::new();
    };
    let document = match load_registry_document(&snapshot.asset_path) {
        Ok(document) => document,
        Err(error) => {
            issues.push(error);
            return BTreeSet::new();
        }
    };
    let Some(contexts) = document.get("contexts").and_then(toml::Value::as_array) else {
        issues.push("input registry missing required array 'contexts'".to_string());
        return BTreeSet::new();
    };
    let mut actions = BTreeSet::new();
    for (context_index, context) in contexts.iter().enumerate() {
        let Some(context_table) = context.as_table() else {
            issues.push(format!("contexts[{context_index}] is not a table"));
            continue;
        };
        let Some(action_entries) = context_table.get("actions").and_then(toml::Value::as_array)
        else {
            continue;
        };
        for (action_index, action) in action_entries.iter().enumerate() {
            let Some(action_table) = action.as_table() else {
                issues.push(format!(
                    "contexts[{context_index}].actions[{action_index}] is not a table"
                ));
                continue;
            };
            let Some(action_id) = action_table.get("id").and_then(toml::Value::as_str) else {
                issues.push(format!(
                    "contexts[{context_index}].actions[{action_index}] missing 'id'"
                ));
                continue;
            };
            let action_id = action_id.trim();
            if action_id.is_empty() {
                issues.push(format!(
                    "contexts[{context_index}].actions[{action_index}] has empty 'id'"
                ));
                continue;
            }
            actions.insert(action_id.to_string());
        }
    }
    actions
}

fn parse_input_context_action_counts(
    document: &toml::value::Table,
) -> Result<BTreeMap<String, usize>, String> {
    let contexts = document
        .get("contexts")
        .and_then(toml::Value::as_array)
        .ok_or_else(|| "missing required array 'contexts'".to_string())?;
    let mut counts = BTreeMap::new();
    for context in contexts {
        let table = context
            .as_table()
            .ok_or_else(|| "input context entry is not a table".to_string())?;
        let id = table
            .get("id")
            .and_then(toml::Value::as_str)
            .ok_or_else(|| "input context missing 'id'".to_string())?
            .to_string();
        let action_count = table
            .get("actions")
            .and_then(toml::Value::as_array)
            .map(|actions| actions.len())
            .unwrap_or(0);
        counts.insert(id, action_count);
    }
    Ok(counts)
}

fn parse_tag_domain_counts(
    document: &toml::value::Table,
) -> Result<BTreeMap<String, usize>, String> {
    let domains = document
        .get("domains")
        .and_then(toml::Value::as_table)
        .ok_or_else(|| "missing required table 'domains'".to_string())?;
    let mut counts = BTreeMap::new();
    for (domain_name, domain_value) in domains {
        let domain_table = domain_value
            .as_table()
            .ok_or_else(|| format!("domain '{}' is not a table", domain_name))?;
        let value_count = domain_table
            .get("values")
            .and_then(toml::Value::as_array)
            .map(|values| values.len())
            .unwrap_or(0);
        counts.insert(domain_name.clone(), value_count);
    }
    Ok(counts)
}

fn parse_string_ids_from_array(
    document: &toml::value::Table,
    array_key: &str,
) -> Result<Vec<String>, String> {
    let entries = document
        .get(array_key)
        .and_then(toml::Value::as_array)
        .ok_or_else(|| format!("missing required array '{}'", array_key))?;
    let mut ids = Vec::new();
    for entry in entries {
        let table = entry
            .as_table()
            .ok_or_else(|| format!("'{}' entry is not a table", array_key))?;
        let id = table
            .get("id")
            .and_then(toml::Value::as_str)
            .ok_or_else(|| format!("'{}' entry missing 'id'", array_key))?;
        ids.push(id.to_string());
    }
    Ok(ids)
}

fn parse_default_player_links(
    document: &toml::value::Table,
) -> (Option<String>, Option<String>, Option<String>) {
    let Some(archetypes) = document.get("archetypes").and_then(toml::Value::as_array) else {
        return (None, None, None);
    };

    let Some(hero) = archetypes.iter().find(|entry| {
        entry
            .as_table()
            .and_then(|table| table.get("id"))
            .and_then(toml::Value::as_str)
            == Some("hero.default")
    }) else {
        return (None, None, None);
    };

    let Some(hero_table) = hero.as_table() else {
        return (None, None, None);
    };
    let hero_id = hero_table
        .get("id")
        .and_then(toml::Value::as_str)
        .map(ToOwned::to_owned);
    let input_context = hero_table
        .get("input_context")
        .and_then(toml::Value::as_str)
        .map(ToOwned::to_owned);
    let camera_rig = hero_table
        .get("default_camera_rig")
        .and_then(toml::Value::as_str)
        .map(ToOwned::to_owned);
    (hero_id, input_context, camera_rig)
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
        let path = std::env::temp_dir().join(format!("k_os_game_play_{name}_{nonce}.toml"));
        std::fs::write(&path, content).expect("write temp registry");
        path.to_string_lossy().into_owned()
    }

    fn registry_state(actor_path: String, input_path: String) -> GameDataRegistryState {
        let mut state = GameDataRegistryState::default();
        state.loaded.insert(
            "actor_archetypes".to_string(),
            RegistrySnapshot {
                stage_id: "actor_archetypes_registry".to_string(),
                profile: "editor_preview".to_string(),
                merge_strategy: "replace".to_string(),
                asset_path: actor_path,
                version: "1".to_string(),
                required_table_counts: BTreeMap::new(),
            },
        );
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

    fn ai_state(agent: &str, phase: &str, decision: &str) -> GameAiDecisionRuntimeState {
        let mut state = GameAiDecisionRuntimeState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 5,
            active_phase: phase.to_string(),
            ..Default::default()
        };
        state
            .agent_decisions
            .insert(agent.to_string(), decision.to_string());
        state
    }

    #[test]
    fn projects_gameplay_actions_from_ai_decisions() {
        let actor_path = write_temp_registry(
            "actors_routes",
            r#"
version = "1"
registry_kind = "actor_archetypes"

[[archetypes]]
id = "hero.default"

[ai_action_projection]

[[ai_action_projection.routes]]
agent = "hero.default"
phase = "act"
decision_prefix = "hero.attack."
gameplay_action = "combat.attack.primary"
input_action = "player.interact"
camera_rig = "player.follow.third_person"
priority = 300
"#,
        );
        let input_path = write_temp_registry(
            "input_actions",
            r#"
version = "1"
registry_kind = "input_bindings"

[[contexts]]
id = "player.default"

[[contexts.actions]]
id = "player.interact"
"#,
        );

        let mut runtime_bindings = GameRuntimeRegistryBindings::default();
        runtime_bindings
            .camera_rigs
            .push("player.follow.third_person".to_string());

        let result = derive_runtime_action_bindings(
            Some(&registry_state(actor_path, input_path)),
            Some(&runtime_bindings),
            Some(&ai_state(
                "hero.default",
                "act",
                "hero.attack.primary_target",
            )),
        );

        assert!(result.ready);
        assert_eq!(result.status, "ready");
        assert_eq!(
            result.agent_actions.get("hero.default").map(String::as_str),
            Some("combat.attack.primary")
        );
        assert_eq!(
            result
                .agent_input_actions
                .get("hero.default")
                .map(String::as_str),
            Some("player.interact")
        );
    }

    #[test]
    fn degrades_when_no_route_matches_decision() {
        let actor_path = write_temp_registry(
            "actors_no_match",
            r#"
version = "1"
registry_kind = "actor_archetypes"

[[archetypes]]
id = "hero.default"

[ai_action_projection]

[[ai_action_projection.routes]]
decision_prefix = "hero.move."
gameplay_action = "locomotion.move"
"#,
        );
        let input_path = write_temp_registry(
            "input_no_match",
            r#"
version = "1"
registry_kind = "input_bindings"
"#,
        );

        let result = derive_runtime_action_bindings(
            Some(&registry_state(actor_path, input_path)),
            None,
            Some(&ai_state(
                "hero.default",
                "act",
                "hero.attack.primary_target",
            )),
        );

        assert!(!result.ready);
        assert_eq!(result.status, "degraded");
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.contains("no ai_action_projection route")));
    }

    #[test]
    fn stays_pending_when_ai_decision_state_missing() {
        let result = derive_runtime_action_bindings(None, None, None);
        assert!(!result.ready);
        assert_eq!(result.status, "pending");
        assert_eq!(result.detail, "awaiting ai decision runtime state");
    }

    #[test]
    fn derives_runtime_execution_commands_from_input_intents() {
        let input_path = write_temp_registry(
            "runtime_execution",
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

[runtime_execution]

[[runtime_execution.routes]]
agent = "hero.default"
phase = "act"
input_action = "player.move"
input_kind = "axis_2d"
command_kind = "locomotion.move"
vector_space = "move_xz"
linear_scale = 7.5
priority = 500

[[runtime_execution.routes]]
agent = "hero.default"
phase = "act"
input_action = "player.look"
input_kind = "axis_2d"
command_kind = "camera.look"
vector_space = "look_yaw_pitch"
angular_scale = 2.0
priority = 420
"#,
        );

        let mut intents = GameInputIntentState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 15,
            active_phase: "act".to_string(),
            frame_index: 80,
            ..Default::default()
        };
        intents.agent_intents.insert(
            "hero.default".to_string(),
            GameAgentInputIntent {
                input_action: "player.move".to_string(),
                input_kind: "axis_2d".to_string(),
                active: true,
                strength: 0.8,
                vector_2d: [0.25, 1.0],
                scale: 1.0,
                route_key: "test".to_string(),
            },
        );

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

        let result = derive_execution_command_state(Some(&state), Some(&intents), None);

        assert!(result.ready);
        assert_eq!(result.status, "ready");
        let command = result
            .agent_commands
            .get("hero.default")
            .expect("hero execution command");
        assert_eq!(command.command_kind, "locomotion.move");
        assert!(command.active);
        assert!(command.linear[2] > 0.0);
        assert!(command.route_key.contains("runtime_execution.routes"));
    }

    #[test]
    fn execution_projection_degrades_without_matching_route() {
        let input_path = write_temp_registry(
            "runtime_execution_missing",
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

[runtime_execution]

[[runtime_execution.routes]]
input_action = "player.look"
command_kind = "camera.look"
"#,
        );

        let mut intents = GameInputIntentState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 3,
            active_phase: "act".to_string(),
            frame_index: 9,
            ..Default::default()
        };
        intents.agent_intents.insert(
            "hero.default".to_string(),
            GameAgentInputIntent {
                input_action: "player.move".to_string(),
                input_kind: "axis_2d".to_string(),
                active: true,
                strength: 1.0,
                vector_2d: [1.0, 0.0],
                scale: 1.0,
                route_key: "test".to_string(),
            },
        );

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

        let result = derive_execution_command_state(Some(&state), Some(&intents), None);
        assert!(!result.ready);
        assert_eq!(result.status, "degraded");
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.contains("no runtime_execution route")));
    }

    #[test]
    fn applies_execution_commands_with_fixed_step_policy() {
        let input_path = write_temp_registry(
            "runtime_execution_apply",
            r#"
version = "1"
registry_kind = "input_bindings"

[runtime_execution_apply]
fixed_step_seconds = 0.02
max_linear_speed = 5.0
max_angular_speed = 3.0
max_frame_steps = 3
inactive_decay = 0.5
"#,
        );

        let mut registry = GameDataRegistryState::default();
        registry.loaded.insert(
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

        let mut commands = GameExecutionCommandState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 22,
            active_phase: "act".to_string(),
            frame_index: 12,
            routes_loaded: 1,
            ..Default::default()
        };
        commands.agent_commands.insert(
            "hero.default".to_string(),
            GameAgentExecutionCommand {
                input_action: "player.move".to_string(),
                command_kind: "locomotion.move".to_string(),
                active: true,
                intensity: 1.0,
                linear: [9.0, 0.0, 0.0],
                angular: [0.0, 9.0, 0.0],
                route_key: "runtime_execution.routes[0]::locomotion.move".to_string(),
            },
        );

        let result = derive_execution_application_state(Some(&registry), Some(&commands), None);
        assert!(result.ready);
        assert_eq!(result.status, "ready");
        assert_eq!(result.applied_steps, 3);
        let hero = result
            .agent_applications
            .get("hero.default")
            .expect("hero application");
        assert!(hero.linear_velocity[0] <= 5.0);
        assert!(hero.angular_velocity[1] <= 3.0);
        assert!(hero.translation_delta[0] > 0.0);
    }

    #[test]
    fn execution_application_decays_inactive_velocity() {
        let input_path = write_temp_registry(
            "runtime_execution_apply_decay",
            r#"
version = "1"
registry_kind = "input_bindings"

[runtime_execution_apply]
inactive_decay = 0.5
max_frame_steps = 2
"#,
        );

        let mut registry = GameDataRegistryState::default();
        registry.loaded.insert(
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

        let mut commands = GameExecutionCommandState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 40,
            active_phase: "act".to_string(),
            frame_index: 42,
            routes_loaded: 1,
            ..Default::default()
        };
        commands.agent_commands.insert(
            "hero.default".to_string(),
            GameAgentExecutionCommand {
                input_action: "player.move".to_string(),
                command_kind: "locomotion.move".to_string(),
                active: false,
                intensity: 0.0,
                linear: [0.0, 0.0, 0.0],
                angular: [0.0, 0.0, 0.0],
                route_key: "runtime_execution.routes[0]::locomotion.move".to_string(),
            },
        );

        let mut previous = GameExecutionApplicationState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 39,
            active_phase: "act".to_string(),
            frame_index: 41,
            fixed_step_seconds: DEFAULT_EXECUTION_FIXED_STEP_SECONDS,
            applied_steps: 1,
            agent_applications: BTreeMap::new(),
            issues: Vec::new(),
        };
        previous.agent_applications.insert(
            "hero.default".to_string(),
            GameAgentExecutionApplication {
                command_kind: "locomotion.move".to_string(),
                input_action: "player.move".to_string(),
                route_key: "prev".to_string(),
                steps_applied: 1,
                linear_velocity: [4.0, 0.0, 0.0],
                angular_velocity: [0.0, 2.0, 0.0],
                translation_delta: [0.0, 0.0, 0.0],
                rotation_delta: [0.0, 0.0, 0.0],
            },
        );

        let result =
            derive_execution_application_state(Some(&registry), Some(&commands), Some(&previous));
        assert!(result.ready);
        let hero = result
            .agent_applications
            .get("hero.default")
            .expect("hero application");
        assert_eq!(hero.linear_velocity[0], 2.0);
        assert_eq!(hero.angular_velocity[1], 1.0);
    }

    #[test]
    fn derives_execution_effect_events_with_deterministic_sequence() {
        let input_path = write_temp_registry(
            "runtime_execution_effects",
            r#"
version = "1"
registry_kind = "input_bindings"

[runtime_execution_effects]
max_events_per_frame = 8
default_replication_channel = "reliable"

[[runtime_execution_effects.routes]]
command_prefix = "locomotion."
effect_kind = "movement"
replication_channel = "unreliable"
priority = 300

[[runtime_execution_effects.routes]]
command_prefix = "ability."
effect_kind = "ability_cast"
replication_channel = "reliable_ordered"
priority = 400
"#,
        );

        let mut registry = GameDataRegistryState::default();
        registry.loaded.insert(
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

        let mut commands = GameExecutionCommandState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 73,
            active_phase: "act".to_string(),
            frame_index: 91,
            routes_loaded: 2,
            ..Default::default()
        };
        commands.agent_commands.insert(
            "hero.default".to_string(),
            GameAgentExecutionCommand {
                input_action: "player.move".to_string(),
                command_kind: "locomotion.move".to_string(),
                active: true,
                intensity: 0.9,
                linear: [5.0, 0.0, 0.0],
                angular: [0.0, 0.0, 0.0],
                route_key: "runtime_execution.routes[0]::locomotion.move".to_string(),
            },
        );
        commands.agent_commands.insert(
            "npc.vendor".to_string(),
            GameAgentExecutionCommand {
                input_action: "player.interact".to_string(),
                command_kind: "ability.vendor.serve".to_string(),
                active: true,
                intensity: 1.0,
                linear: [0.0, 0.0, 0.0],
                angular: [0.0, 0.0, 0.0],
                route_key: "runtime_execution.routes[1]::ability.vendor.serve".to_string(),
            },
        );

        let mut applications = GameExecutionApplicationState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 73,
            active_phase: "act".to_string(),
            frame_index: 91,
            fixed_step_seconds: DEFAULT_EXECUTION_FIXED_STEP_SECONDS,
            applied_steps: 1,
            agent_applications: BTreeMap::new(),
            issues: Vec::new(),
        };
        applications.agent_applications.insert(
            "hero.default".to_string(),
            GameAgentExecutionApplication {
                command_kind: "locomotion.move".to_string(),
                input_action: "player.move".to_string(),
                route_key: "runtime_execution.routes[0]::locomotion.move".to_string(),
                steps_applied: 1,
                linear_velocity: [3.0, 0.0, 0.0],
                angular_velocity: [0.0, 0.0, 0.0],
                translation_delta: [0.05, 0.0, 0.0],
                rotation_delta: [0.0, 0.0, 0.0],
            },
        );
        applications.agent_applications.insert(
            "npc.vendor".to_string(),
            GameAgentExecutionApplication {
                command_kind: "ability.vendor.serve".to_string(),
                input_action: "player.interact".to_string(),
                route_key: "runtime_execution.routes[1]::ability.vendor.serve".to_string(),
                steps_applied: 1,
                linear_velocity: [0.0, 0.0, 0.0],
                angular_velocity: [0.0, 0.0, 0.0],
                translation_delta: [0.0, 0.0, 0.0],
                rotation_delta: [0.0, 0.0, 0.0],
            },
        );

        let previous = GameExecutionEffectsState {
            next_sequence: 41,
            ..Default::default()
        };
        let result = derive_execution_effects_state(
            Some(&registry),
            Some(&commands),
            Some(&applications),
            Some(&previous),
        );
        assert!(result.ready);
        assert_eq!(result.events_emitted, 2);
        assert_eq!(result.events[0].sequence, 41);
        assert_eq!(result.events[1].sequence, 42);
        assert_eq!(result.events[0].effect_kind, "movement");
        assert_eq!(result.events[0].replication_channel, "unreliable");
        assert_eq!(result.events[1].effect_kind, "ability_cast");
        assert_eq!(result.events[1].replication_channel, "reliable_ordered");
    }

    #[test]
    fn execution_effects_respect_event_clamp_and_emit_inactive_route() {
        let input_path = write_temp_registry(
            "runtime_execution_effects_clamp",
            r#"
version = "1"
registry_kind = "input_bindings"

[runtime_execution_effects]
max_events_per_frame = 1
default_replication_channel = "reliable"

[[runtime_execution_effects.routes]]
command_prefix = "locomotion."
effect_kind = "movement"
emit_inactive = true
priority = 100
"#,
        );

        let mut registry = GameDataRegistryState::default();
        registry.loaded.insert(
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

        let mut commands = GameExecutionCommandState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 5,
            active_phase: "act".to_string(),
            frame_index: 7,
            routes_loaded: 1,
            ..Default::default()
        };
        commands.agent_commands.insert(
            "hero.default".to_string(),
            GameAgentExecutionCommand {
                input_action: "player.move".to_string(),
                command_kind: "locomotion.move".to_string(),
                active: false,
                intensity: 0.0,
                linear: [0.0, 0.0, 0.0],
                angular: [0.0, 0.0, 0.0],
                route_key: "a".to_string(),
            },
        );
        commands.agent_commands.insert(
            "npc.vendor".to_string(),
            GameAgentExecutionCommand {
                input_action: "player.move".to_string(),
                command_kind: "locomotion.move".to_string(),
                active: true,
                intensity: 1.0,
                linear: [1.0, 0.0, 0.0],
                angular: [0.0, 0.0, 0.0],
                route_key: "b".to_string(),
            },
        );

        let applications = GameExecutionApplicationState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 5,
            active_phase: "act".to_string(),
            frame_index: 7,
            fixed_step_seconds: DEFAULT_EXECUTION_FIXED_STEP_SECONDS,
            applied_steps: 1,
            agent_applications: BTreeMap::new(),
            issues: Vec::new(),
        };
        let result = derive_execution_effects_state(
            Some(&registry),
            Some(&commands),
            Some(&applications),
            None,
        );
        assert!(!result.ready);
        assert_eq!(result.events_emitted, 1);
        assert_eq!(result.events[0].agent, "hero.default");
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.contains("max_events_per_frame")));
    }

    #[test]
    fn derives_transport_journal_with_channel_mapping_and_rollback_window() {
        let input_path = write_temp_registry(
            "runtime_execution_transport",
            r#"
version = "1"
registry_kind = "input_bindings"

[runtime_execution_transport]
max_journal_events = 8
rollback_window_frames = 2
default_lane = "events_default"
default_reliability = "reliable"
default_rollback = true

[[runtime_execution_transport.channel_routes]]
channel_prefix = "unreliable"
lane = "state_delta"
reliability = "unreliable_unordered"
rollback = false
priority = 200

[[runtime_execution_transport.channel_routes]]
channel_prefix = "reliable_ordered"
lane = "gameplay_rpc"
reliability = "reliable_ordered"
rollback = true
priority = 300
"#,
        );

        let mut registry = GameDataRegistryState::default();
        registry.loaded.insert(
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

        let previous = GameExecutionTransportState {
            frame_index: 10,
            journal: vec![GameExecutionTransportEnvelope {
                sequence: 39,
                frame_index: 10,
                tick_index: 120,
                agent: "hero.default".to_string(),
                command_kind: "locomotion.move".to_string(),
                input_action: "player.move".to_string(),
                effect_kind: "movement".to_string(),
                replication_channel: "unreliable".to_string(),
                transport_lane: "state_delta".to_string(),
                transport_reliability: "unreliable_unordered".to_string(),
                rollback_enabled: false,
                active: true,
                intensity: 0.5,
                translation_delta: [0.01, 0.0, 0.0],
                rotation_delta: [0.0, 0.0, 0.0],
                effect_route_key: "runtime_execution_effects.routes[0]".to_string(),
                transport_route_key: "runtime_execution_transport.channel_routes[0]".to_string(),
            }],
            ..Default::default()
        };

        let effects = GameExecutionEffectsState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 121,
            active_phase: "act".to_string(),
            frame_index: 12,
            events_emitted: 2,
            events: vec![
                GameExecutionEffectEvent {
                    sequence: 40,
                    agent: "hero.default".to_string(),
                    command_kind: "locomotion.move".to_string(),
                    input_action: "player.move".to_string(),
                    effect_kind: "movement".to_string(),
                    replication_channel: "unreliable".to_string(),
                    active: true,
                    intensity: 0.8,
                    linear_velocity: [2.0, 0.0, 0.0],
                    angular_velocity: [0.0, 0.0, 0.0],
                    translation_delta: [0.03, 0.0, 0.0],
                    rotation_delta: [0.0, 0.0, 0.0],
                    route_key: "runtime_execution_effects.routes[0]".to_string(),
                },
                GameExecutionEffectEvent {
                    sequence: 41,
                    agent: "npc.vendor".to_string(),
                    command_kind: "gameplay.interact".to_string(),
                    input_action: "player.interact".to_string(),
                    effect_kind: "interaction".to_string(),
                    replication_channel: "reliable_ordered".to_string(),
                    active: true,
                    intensity: 1.0,
                    linear_velocity: [0.0, 0.0, 0.0],
                    angular_velocity: [0.0, 0.0, 0.0],
                    translation_delta: [0.0, 0.0, 0.0],
                    rotation_delta: [0.0, 0.0, 0.0],
                    route_key: "runtime_execution_effects.routes[1]".to_string(),
                },
            ],
            ..Default::default()
        };

        let result =
            derive_execution_transport_state(Some(&registry), Some(&effects), Some(&previous));
        assert!(result.ready);
        assert_eq!(result.events_ingested, 2);
        assert_eq!(result.journal_retained, 3);
        assert_eq!(result.rollback_floor_sequence, 41);
        assert!(!result.replay_fingerprint.is_empty());
        assert_eq!(result.journal[1].transport_lane, "state_delta");
        assert_eq!(
            result.journal[1].transport_reliability,
            "unreliable_unordered"
        );
        assert!(!result.journal[1].rollback_enabled);
        assert_eq!(result.journal[2].transport_lane, "gameplay_rpc");
        assert_eq!(result.journal[2].transport_reliability, "reliable_ordered");
        assert!(result.journal[2].rollback_enabled);
    }

    #[test]
    fn transport_journal_dedupes_sequence_and_clamps_capacity() {
        let input_path = write_temp_registry(
            "runtime_execution_transport_clamp",
            r#"
version = "1"
registry_kind = "input_bindings"

[runtime_execution_transport]
max_journal_events = 2
rollback_window_frames = 8
default_lane = "events_default"
default_reliability = "reliable"
"#,
        );

        let mut registry = GameDataRegistryState::default();
        registry.loaded.insert(
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

        let previous = GameExecutionTransportState {
            journal: vec![
                GameExecutionTransportEnvelope {
                    sequence: 10,
                    frame_index: 7,
                    tick_index: 7,
                    agent: "a".to_string(),
                    command_kind: "x".to_string(),
                    input_action: "x".to_string(),
                    effect_kind: "movement".to_string(),
                    replication_channel: "reliable".to_string(),
                    transport_lane: "events_default".to_string(),
                    transport_reliability: "reliable".to_string(),
                    rollback_enabled: true,
                    active: true,
                    intensity: 1.0,
                    translation_delta: [0.0, 0.0, 0.0],
                    rotation_delta: [0.0, 0.0, 0.0],
                    effect_route_key: "x".to_string(),
                    transport_route_key: "runtime_execution_transport.default".to_string(),
                },
                GameExecutionTransportEnvelope {
                    sequence: 11,
                    frame_index: 8,
                    tick_index: 8,
                    agent: "b".to_string(),
                    command_kind: "y".to_string(),
                    input_action: "y".to_string(),
                    effect_kind: "interaction".to_string(),
                    replication_channel: "reliable".to_string(),
                    transport_lane: "events_default".to_string(),
                    transport_reliability: "reliable".to_string(),
                    rollback_enabled: true,
                    active: true,
                    intensity: 1.0,
                    translation_delta: [0.0, 0.0, 0.0],
                    rotation_delta: [0.0, 0.0, 0.0],
                    effect_route_key: "y".to_string(),
                    transport_route_key: "runtime_execution_transport.default".to_string(),
                },
            ],
            ..Default::default()
        };

        let effects = GameExecutionEffectsState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 9,
            active_phase: "act".to_string(),
            frame_index: 9,
            events_emitted: 2,
            events: vec![
                GameExecutionEffectEvent {
                    sequence: 11,
                    agent: "dup".to_string(),
                    command_kind: "dup".to_string(),
                    input_action: "dup".to_string(),
                    effect_kind: "movement".to_string(),
                    replication_channel: "reliable".to_string(),
                    active: true,
                    intensity: 1.0,
                    linear_velocity: [0.0, 0.0, 0.0],
                    angular_velocity: [0.0, 0.0, 0.0],
                    translation_delta: [0.0, 0.0, 0.0],
                    rotation_delta: [0.0, 0.0, 0.0],
                    route_key: "dup".to_string(),
                },
                GameExecutionEffectEvent {
                    sequence: 12,
                    agent: "new".to_string(),
                    command_kind: "new".to_string(),
                    input_action: "new".to_string(),
                    effect_kind: "movement".to_string(),
                    replication_channel: "reliable".to_string(),
                    active: true,
                    intensity: 1.0,
                    linear_velocity: [0.0, 0.0, 0.0],
                    angular_velocity: [0.0, 0.0, 0.0],
                    translation_delta: [0.0, 0.0, 0.0],
                    rotation_delta: [0.0, 0.0, 0.0],
                    route_key: "new".to_string(),
                },
            ],
            ..Default::default()
        };

        let result =
            derive_execution_transport_state(Some(&registry), Some(&effects), Some(&previous));
        assert_eq!(result.events_ingested, 1);
        assert_eq!(result.journal_retained, 2);
        assert_eq!(result.journal[0].sequence, 11);
        assert_eq!(result.journal[1].sequence, 12);
    }

    #[test]
    fn derives_transport_backend_payloads_with_lane_routes() {
        let input_path = write_temp_registry(
            "runtime_execution_transport_backends",
            r#"
version = "1"
registry_kind = "input_bindings"

[runtime_execution_transport_backends]
max_payloads_per_frame = 8
default_backend = "event_log"
default_payload_kind = "journal_slice"
default_max_events_per_payload = 2

[[runtime_execution_transport_backends.lane_backends]]
lane_prefix = "state_delta"
backend = "state_stream"
payload_kind = "delta_patch"
max_events_per_payload = 2
priority = 260

[[runtime_execution_transport_backends.lane_backends]]
lane_prefix = "gameplay_rpc"
backend = "rpc_bus"
payload_kind = "rpc_event"
max_events_per_payload = 1
priority = 320
"#,
        );

        let mut registry = GameDataRegistryState::default();
        registry.loaded.insert(
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

        let transport = GameExecutionTransportState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 220,
            active_phase: "act".to_string(),
            frame_index: 42,
            rollback_floor_sequence: 101,
            journal: vec![
                GameExecutionTransportEnvelope {
                    sequence: 100,
                    frame_index: 40,
                    tick_index: 218,
                    agent: "hero.default".to_string(),
                    command_kind: "locomotion.move".to_string(),
                    input_action: "player.move".to_string(),
                    effect_kind: "movement".to_string(),
                    replication_channel: "unreliable".to_string(),
                    transport_lane: "state_delta".to_string(),
                    transport_reliability: "unreliable_unordered".to_string(),
                    rollback_enabled: false,
                    active: true,
                    intensity: 1.0,
                    translation_delta: [0.1, 0.0, 0.0],
                    rotation_delta: [0.0, 0.0, 0.0],
                    effect_route_key: "fx0".to_string(),
                    transport_route_key: "tx0".to_string(),
                },
                GameExecutionTransportEnvelope {
                    sequence: 101,
                    frame_index: 41,
                    tick_index: 219,
                    agent: "hero.default".to_string(),
                    command_kind: "locomotion.move".to_string(),
                    input_action: "player.move".to_string(),
                    effect_kind: "movement".to_string(),
                    replication_channel: "unreliable".to_string(),
                    transport_lane: "state_delta".to_string(),
                    transport_reliability: "unreliable_unordered".to_string(),
                    rollback_enabled: false,
                    active: true,
                    intensity: 0.7,
                    translation_delta: [0.08, 0.0, 0.0],
                    rotation_delta: [0.0, 0.0, 0.0],
                    effect_route_key: "fx1".to_string(),
                    transport_route_key: "tx0".to_string(),
                },
                GameExecutionTransportEnvelope {
                    sequence: 102,
                    frame_index: 42,
                    tick_index: 220,
                    agent: "npc.vendor".to_string(),
                    command_kind: "gameplay.interact".to_string(),
                    input_action: "player.interact".to_string(),
                    effect_kind: "interaction".to_string(),
                    replication_channel: "reliable_ordered".to_string(),
                    transport_lane: "gameplay_rpc".to_string(),
                    transport_reliability: "reliable_ordered".to_string(),
                    rollback_enabled: true,
                    active: true,
                    intensity: 1.0,
                    translation_delta: [0.0, 0.0, 0.0],
                    rotation_delta: [0.0, 0.0, 0.0],
                    effect_route_key: "fx2".to_string(),
                    transport_route_key: "tx1".to_string(),
                },
            ],
            ..Default::default()
        };

        let result =
            derive_execution_transport_backend_state(Some(&registry), Some(&transport), None);
        assert!(result.ready);
        assert_eq!(result.routes_loaded, 2);
        assert_eq!(result.payloads_emitted, 2);
        assert_eq!(result.lanes_emitted, 2);
        assert_eq!(result.exported_through_sequence, 102);
        assert_eq!(result.payloads[0].backend_kind, "state_stream");
        assert_eq!(result.payloads[0].payload_kind, "delta_patch");
        assert_eq!(result.payloads[0].event_count, 2);
        assert_eq!(result.payloads[1].backend_kind, "rpc_bus");
        assert_eq!(result.payloads[1].payload_kind, "rpc_event");
        assert_eq!(result.payloads[1].event_count, 1);
    }

    #[test]
    fn transport_backend_payloads_resume_from_export_cursor_and_clamp() {
        let input_path = write_temp_registry(
            "runtime_execution_transport_backends_clamp",
            r#"
version = "1"
registry_kind = "input_bindings"

[runtime_execution_transport_backends]
max_payloads_per_frame = 1
default_backend = "event_log"
default_payload_kind = "journal_slice"
default_max_events_per_payload = 1
"#,
        );

        let mut registry = GameDataRegistryState::default();
        registry.loaded.insert(
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

        let previous = GameExecutionTransportBackendState {
            exported_through_sequence: 200,
            ..Default::default()
        };
        let transport = GameExecutionTransportState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 300,
            active_phase: "act".to_string(),
            frame_index: 77,
            rollback_floor_sequence: 201,
            journal: vec![
                GameExecutionTransportEnvelope {
                    sequence: 200,
                    frame_index: 75,
                    tick_index: 298,
                    agent: "a".to_string(),
                    command_kind: "x".to_string(),
                    input_action: "x".to_string(),
                    effect_kind: "movement".to_string(),
                    replication_channel: "reliable".to_string(),
                    transport_lane: "gameplay_events".to_string(),
                    transport_reliability: "reliable".to_string(),
                    rollback_enabled: true,
                    active: true,
                    intensity: 1.0,
                    translation_delta: [0.0, 0.0, 0.0],
                    rotation_delta: [0.0, 0.0, 0.0],
                    effect_route_key: "fx0".to_string(),
                    transport_route_key: "tx0".to_string(),
                },
                GameExecutionTransportEnvelope {
                    sequence: 201,
                    frame_index: 76,
                    tick_index: 299,
                    agent: "b".to_string(),
                    command_kind: "y".to_string(),
                    input_action: "y".to_string(),
                    effect_kind: "movement".to_string(),
                    replication_channel: "reliable".to_string(),
                    transport_lane: "state_delta".to_string(),
                    transport_reliability: "reliable".to_string(),
                    rollback_enabled: true,
                    active: true,
                    intensity: 1.0,
                    translation_delta: [0.0, 0.0, 0.0],
                    rotation_delta: [0.0, 0.0, 0.0],
                    effect_route_key: "fx1".to_string(),
                    transport_route_key: "tx1".to_string(),
                },
                GameExecutionTransportEnvelope {
                    sequence: 202,
                    frame_index: 77,
                    tick_index: 300,
                    agent: "c".to_string(),
                    command_kind: "z".to_string(),
                    input_action: "z".to_string(),
                    effect_kind: "interaction".to_string(),
                    replication_channel: "reliable".to_string(),
                    transport_lane: "gameplay_rpc".to_string(),
                    transport_reliability: "reliable".to_string(),
                    rollback_enabled: true,
                    active: true,
                    intensity: 1.0,
                    translation_delta: [0.0, 0.0, 0.0],
                    rotation_delta: [0.0, 0.0, 0.0],
                    effect_route_key: "fx2".to_string(),
                    transport_route_key: "tx2".to_string(),
                },
            ],
            ..Default::default()
        };

        let result = derive_execution_transport_backend_state(
            Some(&registry),
            Some(&transport),
            Some(&previous),
        );
        assert!(!result.ready);
        assert_eq!(result.payloads_emitted, 1);
        assert_eq!(result.exported_through_sequence, 201);
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.contains("max_payloads_per_frame")));
    }
}

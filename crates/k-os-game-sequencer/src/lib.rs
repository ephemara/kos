use bevy_ecs::prelude::Resource;
use k_os_game_camera::GameCameraRuntimeState;
use k_os_game_framework::{GameDataRegistryState, GameRuntimeActionBindings};
use std::collections::BTreeMap;

const DEFAULT_SEQUENCER_REGISTRY_KIND: &str = "sequencer_timelines";
const DEFAULT_PLAYBACK_RATE: f32 = 1.0;
const DEFAULT_TRACK_INTENSITY: f32 = 1.0;
const DEFAULT_MAX_TRACKS_PER_FRAME: usize = 8;
const DEFAULT_MAX_EVENTS_PER_FRAME: usize = 8;

#[derive(Debug, Clone, PartialEq, Resource)]
pub struct GameSequencerRuntimeState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub registry_kind: String,
    pub registry_version: Option<String>,
    pub tick_index: u64,
    pub active_phase: String,
    pub active_camera_rig: Option<String>,
    pub active_camera_mode: Option<String>,
    pub active_timeline: Option<String>,
    pub active_agent: Option<String>,
    pub active_action: Option<String>,
    pub selected_route: Option<String>,
    pub timelines_loaded: usize,
    pub routes_loaded: usize,
    pub playback_rate: f32,
    pub looping: bool,
    pub timeline_track_counts: BTreeMap<String, usize>,
    pub active_track_ids: Vec<String>,
    pub pending_events: Vec<String>,
    pub issues: Vec<String>,
}

impl Default for GameSequencerRuntimeState {
    fn default() -> Self {
        Self {
            ready: false,
            status: "pending".to_string(),
            detail: "awaiting sequencer registry state".to_string(),
            registry_kind: DEFAULT_SEQUENCER_REGISTRY_KIND.to_string(),
            registry_version: None,
            tick_index: 0,
            active_phase: String::new(),
            active_camera_rig: None,
            active_camera_mode: None,
            active_timeline: None,
            active_agent: None,
            active_action: None,
            selected_route: None,
            timelines_loaded: 0,
            routes_loaded: 0,
            playback_rate: DEFAULT_PLAYBACK_RATE,
            looping: false,
            timeline_track_counts: BTreeMap::new(),
            active_track_ids: Vec::new(),
            pending_events: Vec::new(),
            issues: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Resource)]
pub struct GameSequencerTrackDispatchState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub tick_index: u64,
    pub frame_index: u64,
    pub active_phase: String,
    pub active_timeline: Option<String>,
    pub active_agent: Option<String>,
    pub active_camera_mode: Option<String>,
    pub tracks_loaded: usize,
    pub routes_loaded: usize,
    pub events_emitted: usize,
    pub active_tracks: Vec<GameSequencerTrackDispatch>,
    pub events: Vec<GameSequencerDispatchEvent>,
    pub issues: Vec<String>,
}

impl Default for GameSequencerTrackDispatchState {
    fn default() -> Self {
        Self {
            ready: false,
            status: "pending".to_string(),
            detail: "awaiting sequencer runtime state".to_string(),
            tick_index: 0,
            frame_index: 0,
            active_phase: String::new(),
            active_timeline: None,
            active_agent: None,
            active_camera_mode: None,
            tracks_loaded: 0,
            routes_loaded: 0,
            events_emitted: 0,
            active_tracks: Vec::new(),
            events: Vec::new(),
            issues: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct GameSequencerTrackDispatch {
    pub track_id: String,
    pub track_kind: String,
    pub binding_target: String,
    pub intensity: f32,
    pub route_key: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GameSequencerDispatchEvent {
    pub event_id: String,
    pub effect_kind: String,
    pub track_id: String,
    pub route_key: String,
}

#[derive(Debug, Clone)]
struct SequencerTimeline {
    track_count: usize,
    track_ids: Vec<String>,
    default_rate: Option<f32>,
    looping: Option<bool>,
}

#[derive(Debug, Clone)]
struct SequencerActionRoute {
    agent: Option<String>,
    phase: Option<String>,
    gameplay_action_prefix: String,
    camera_rig: Option<String>,
    camera_mode: Option<String>,
    target_timeline: String,
    playback_rate: Option<f32>,
    looping: Option<bool>,
    priority: u32,
    event: Option<String>,
}

impl SequencerActionRoute {
    fn matches(
        &self,
        agent: &str,
        phase: &str,
        action: &str,
        active_camera_rig: Option<&str>,
        active_camera_mode: Option<&str>,
    ) -> bool {
        self.agent.as_deref().is_none_or(|value| value == agent)
            && self.phase.as_deref().is_none_or(|value| value == phase)
            && self
                .camera_rig
                .as_deref()
                .is_none_or(|value| Some(value) == active_camera_rig)
            && self
                .camera_mode
                .as_deref()
                .is_none_or(|value| Some(value) == active_camera_mode)
            && action.starts_with(&self.gameplay_action_prefix)
    }
}

#[derive(Debug, Clone)]
struct PlaybackPolicy {
    default_timeline: Option<String>,
    default_rate: f32,
    allow_looping_default: bool,
}

#[derive(Debug, Clone)]
struct TrackDispatchPolicy {
    default_track_intensity: f32,
    max_tracks_per_frame: usize,
    max_events_per_frame: usize,
    routes: Vec<TrackDispatchRoute>,
}

impl Default for TrackDispatchPolicy {
    fn default() -> Self {
        Self {
            default_track_intensity: DEFAULT_TRACK_INTENSITY,
            max_tracks_per_frame: DEFAULT_MAX_TRACKS_PER_FRAME,
            max_events_per_frame: DEFAULT_MAX_EVENTS_PER_FRAME,
            routes: Vec::new(),
        }
    }
}

#[derive(Debug, Clone)]
struct TrackDispatchRoute {
    agent: Option<String>,
    phase: Option<String>,
    camera_mode: Option<String>,
    track_prefix: String,
    binding_target: Option<String>,
    effect_kind: String,
    event_id: Option<String>,
    intensity: Option<f32>,
    priority: u32,
}

impl Default for PlaybackPolicy {
    fn default() -> Self {
        Self {
            default_timeline: None,
            default_rate: DEFAULT_PLAYBACK_RATE,
            allow_looping_default: false,
        }
    }
}

pub fn derive_runtime_sequencer_state(
    registry_state: Option<&GameDataRegistryState>,
    action_bindings: Option<&GameRuntimeActionBindings>,
    camera_state: Option<&GameCameraRuntimeState>,
    previous: Option<&GameSequencerRuntimeState>,
) -> GameSequencerRuntimeState {
    let mut state = GameSequencerRuntimeState::default();
    state.active_camera_rig = camera_state.and_then(|item| item.active_rig.clone());
    state.active_camera_mode = camera_state.and_then(|item| {
        item.active_rig
            .as_deref()
            .and_then(|rig| item.rig_modes.get(rig).cloned())
    });

    let Some(registry_state) = registry_state else {
        return state;
    };

    let Some(snapshot) = registry_state.loaded.get(DEFAULT_SEQUENCER_REGISTRY_KIND) else {
        state.status = "degraded".to_string();
        state.detail = format!(
            "missing required '{}' registry in runtime cache",
            DEFAULT_SEQUENCER_REGISTRY_KIND
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
            state.detail = "failed to parse sequencer registry".to_string();
            state.issues.push(error);
            return state;
        }
    };

    let timelines = parse_timelines(&document, &mut state.issues);
    state.timelines_loaded = timelines.len();
    state.timeline_track_counts = timelines
        .iter()
        .map(|(id, timeline)| (id.clone(), timeline.track_count))
        .collect();

    let routes = parse_action_projection_routes(&document, &mut state.issues);
    state.routes_loaded = routes.len();

    let playback_policy = parse_playback_policy(&document, &mut state.issues);
    if let Some(action_bindings) = action_bindings {
        state.tick_index = action_bindings.tick_index;
        state.active_phase = action_bindings.active_phase.clone();
    }

    if timelines.is_empty() {
        state.status = "degraded".to_string();
        state.detail = "sequencer registry has no valid timelines".to_string();
        return state;
    }

    let selected_route = select_route(
        &routes,
        action_bindings,
        state.active_camera_rig.as_deref(),
        state.active_camera_mode.as_deref(),
    );

    if let Some((selected_agent, selected_action, route_index, route)) = selected_route {
        state.active_agent = Some(selected_agent.clone());
        state.active_action = Some(selected_action.clone());
        if timelines.contains_key(&route.target_timeline) {
            state.active_timeline = Some(route.target_timeline.clone());
            state.selected_route = Some(format!(
                "action_projection.routes[{route_index}]::{}",
                route.gameplay_action_prefix
            ));
            state.playback_rate = route.playback_rate.unwrap_or_else(|| {
                timelines
                    .get(&route.target_timeline)
                    .and_then(|timeline| timeline.default_rate)
                    .unwrap_or(playback_policy.default_rate)
            });
            state.looping = route.looping.unwrap_or_else(|| {
                timelines
                    .get(&route.target_timeline)
                    .and_then(|timeline| timeline.looping)
                    .unwrap_or(playback_policy.allow_looping_default)
            });
            if let Some(event) = &route.event {
                state.pending_events.push(event.clone());
            }
        } else {
            state.issues.push(format!(
                "sequencer route targets missing timeline '{}'",
                route.target_timeline
            ));
        }
    }

    if state.active_timeline.is_none() {
        if let Some(default_timeline) = &playback_policy.default_timeline {
            if timelines.contains_key(default_timeline) {
                state.active_timeline = Some(default_timeline.clone());
                state.selected_route = Some("playback_policy.default_timeline".to_string());
                state.playback_rate = timelines
                    .get(default_timeline)
                    .and_then(|timeline| timeline.default_rate)
                    .unwrap_or(playback_policy.default_rate);
                state.looping = timelines
                    .get(default_timeline)
                    .and_then(|timeline| timeline.looping)
                    .unwrap_or(playback_policy.allow_looping_default);
            } else {
                state.issues.push(format!(
                    "playback_policy.default_timeline '{}' is missing",
                    default_timeline
                ));
            }
        }
    }

    if state.active_timeline.is_none() {
        if let Some(previous_timeline) = previous.and_then(|item| item.active_timeline.clone()) {
            if timelines.contains_key(&previous_timeline) {
                state.active_timeline = Some(previous_timeline);
                state.selected_route = Some("previous.active_timeline".to_string());
            }
        }
    }

    if state.active_timeline.is_none() {
        if let Some(first_timeline) = timelines.keys().next() {
            state.active_timeline = Some(first_timeline.clone());
            state.selected_route = Some("sequencer_timelines.first_declared".to_string());
            state.playback_rate = timelines
                .get(first_timeline)
                .and_then(|timeline| timeline.default_rate)
                .unwrap_or(playback_policy.default_rate);
            state.looping = timelines
                .get(first_timeline)
                .and_then(|timeline| timeline.looping)
                .unwrap_or(playback_policy.allow_looping_default);
        }
    }

    if let Some(active_timeline) = &state.active_timeline {
        if let Some(timeline) = timelines.get(active_timeline) {
            state.active_track_ids = timeline.track_ids.clone();
        }
    }

    state.ready = state.issues.is_empty() && state.active_timeline.is_some();
    state.status = if state.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    state.detail = if state.ready {
        format!(
            "sequencer runtime ready with active timeline '{}'",
            state.active_timeline.clone().unwrap_or_default()
        )
    } else {
        "sequencer runtime has unresolved routing or registry issues".to_string()
    };
    state
}

fn select_route<'a>(
    routes: &'a [SequencerActionRoute],
    action_bindings: Option<&GameRuntimeActionBindings>,
    active_camera_rig: Option<&str>,
    active_camera_mode: Option<&str>,
) -> Option<(String, String, usize, &'a SequencerActionRoute)> {
    let action_bindings = action_bindings?;
    if !action_bindings.ready {
        return None;
    }

    let mut best: Option<(String, String, usize, &SequencerActionRoute)> = None;
    for (agent, action) in &action_bindings.agent_actions {
        for (index, route) in routes.iter().enumerate() {
            if !route.matches(
                agent,
                &action_bindings.active_phase,
                action,
                active_camera_rig,
                active_camera_mode,
            ) {
                continue;
            }

            let should_replace = match best {
                Some((_, _, _, existing)) => {
                    (route.priority, route.gameplay_action_prefix.len())
                        > (existing.priority, existing.gameplay_action_prefix.len())
                }
                None => true,
            };
            if should_replace {
                best = Some((agent.clone(), action.clone(), index, route));
            }
        }
    }

    best
}

fn load_registry_document(path: &str) -> Result<toml::value::Table, String> {
    let raw = std::fs::read_to_string(path)
        .map_err(|error| format!("failed to read registry '{}': {error}", path))?;
    let parsed = raw
        .parse::<toml::Value>()
        .map_err(|error| format!("failed to parse registry '{}': {error}", path))?;
    let table = parsed
        .as_table()
        .ok_or_else(|| format!("registry '{}' root must be a TOML table", path))?;
    Ok(table.clone())
}

fn parse_timelines(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> BTreeMap<String, SequencerTimeline> {
    let mut timelines = BTreeMap::new();
    let Some(items) = document.get("timelines").and_then(toml::Value::as_array) else {
        issues.push("sequencer registry is missing [[timelines]]".to_string());
        return timelines;
    };

    for (index, value) in items.iter().enumerate() {
        let Some(table) = value.as_table() else {
            issues.push(format!("timelines[{index}] must be a TOML table"));
            continue;
        };

        let id = table
            .get("id")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let Some(id) = id else {
            issues.push(format!("timelines[{index}] is missing non-empty 'id'"));
            continue;
        };

        let track_count = table
            .get("tracks")
            .and_then(toml::Value::as_array)
            .map(|tracks| tracks.len())
            .unwrap_or(0);
        let track_ids = table
            .get("tracks")
            .and_then(toml::Value::as_array)
            .map(|tracks| {
                tracks
                    .iter()
                    .filter_map(toml::Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(ToOwned::to_owned)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let default_rate = parse_optional_f32(table.get("default_rate"));
        let looping = table.get("loop").and_then(toml::Value::as_bool);

        if timelines
            .insert(
                id.clone(),
                SequencerTimeline {
                    track_count,
                    track_ids,
                    default_rate,
                    looping,
                },
            )
            .is_some()
        {
            issues.push(format!("duplicate timeline id '{}'", id));
        }
    }

    timelines
}

fn parse_action_projection_routes(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> Vec<SequencerActionRoute> {
    let mut routes = Vec::new();
    let Some(action_projection) = document
        .get("action_projection")
        .and_then(toml::Value::as_table)
    else {
        return routes;
    };
    let Some(items) = action_projection
        .get("routes")
        .and_then(toml::Value::as_array)
    else {
        return routes;
    };

    for (index, value) in items.iter().enumerate() {
        let Some(table) = value.as_table() else {
            issues.push(format!(
                "action_projection.routes[{index}] must be a TOML table"
            ));
            continue;
        };

        let prefix = table
            .get("gameplay_action_prefix")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let Some(gameplay_action_prefix) = prefix else {
            issues.push(format!(
                "action_projection.routes[{index}] is missing non-empty 'gameplay_action_prefix'"
            ));
            continue;
        };

        let target_timeline = table
            .get("target_timeline")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let Some(target_timeline) = target_timeline else {
            issues.push(format!(
                "action_projection.routes[{index}] is missing non-empty 'target_timeline'"
            ));
            continue;
        };

        routes.push(SequencerActionRoute {
            agent: table
                .get("agent")
                .and_then(toml::Value::as_str)
                .map(ToOwned::to_owned),
            phase: table
                .get("phase")
                .and_then(toml::Value::as_str)
                .map(ToOwned::to_owned),
            gameplay_action_prefix,
            camera_rig: table
                .get("camera_rig")
                .and_then(toml::Value::as_str)
                .map(ToOwned::to_owned),
            camera_mode: table
                .get("camera_mode")
                .and_then(toml::Value::as_str)
                .map(ToOwned::to_owned),
            target_timeline,
            playback_rate: parse_optional_f32(table.get("playback_rate")),
            looping: table.get("loop").and_then(toml::Value::as_bool),
            priority: table
                .get("priority")
                .and_then(toml::Value::as_integer)
                .map(|value| value.max(0) as u32)
                .unwrap_or(0),
            event: table
                .get("event")
                .and_then(toml::Value::as_str)
                .map(ToOwned::to_owned),
        });
    }

    routes
}

fn parse_playback_policy(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> PlaybackPolicy {
    let mut policy = PlaybackPolicy::default();
    let Some(table) = document
        .get("playback_policy")
        .and_then(toml::Value::as_table)
    else {
        return policy;
    };

    policy.default_timeline = table
        .get("default_timeline")
        .and_then(toml::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    if let Some(raw_rate) = table.get("default_rate") {
        if let Some(value) = parse_optional_f32(Some(raw_rate)) {
            policy.default_rate = value;
        } else {
            issues.push("playback_policy.default_rate must be numeric".to_string());
        }
    }
    policy.allow_looping_default = table
        .get("allow_looping_default")
        .and_then(toml::Value::as_bool)
        .unwrap_or(false);

    policy
}

fn parse_track_dispatch_policy(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> TrackDispatchPolicy {
    let mut policy = TrackDispatchPolicy::default();
    let Some(table) = document
        .get("runtime_dispatch")
        .and_then(toml::Value::as_table)
    else {
        return policy;
    };

    if let Some(raw) = table.get("default_track_intensity") {
        if let Some(value) = parse_optional_f32(Some(raw)) {
            policy.default_track_intensity = value.max(0.0);
        } else {
            issues.push("runtime_dispatch.default_track_intensity must be numeric".to_string());
        }
    }
    if let Some(raw) = table
        .get("max_tracks_per_frame")
        .and_then(toml::Value::as_integer)
    {
        policy.max_tracks_per_frame = raw.max(1) as usize;
    }
    if let Some(raw) = table
        .get("max_events_per_frame")
        .and_then(toml::Value::as_integer)
    {
        policy.max_events_per_frame = raw.max(1) as usize;
    }

    let Some(items) = table.get("routes").and_then(toml::Value::as_array) else {
        return policy;
    };
    for (index, value) in items.iter().enumerate() {
        let Some(route) = value.as_table() else {
            issues.push(format!(
                "runtime_dispatch.routes[{index}] must be a TOML table"
            ));
            continue;
        };

        let track_prefix = route
            .get("track_prefix")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let Some(track_prefix) = track_prefix else {
            issues.push(format!(
                "runtime_dispatch.routes[{index}] is missing non-empty 'track_prefix'"
            ));
            continue;
        };

        let effect_kind = route
            .get("effect_kind")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| "timeline_track".to_string());

        policy.routes.push(TrackDispatchRoute {
            agent: route
                .get("agent")
                .and_then(toml::Value::as_str)
                .map(ToOwned::to_owned),
            phase: route
                .get("phase")
                .and_then(toml::Value::as_str)
                .map(ToOwned::to_owned),
            camera_mode: route
                .get("camera_mode")
                .and_then(toml::Value::as_str)
                .map(ToOwned::to_owned),
            track_prefix,
            binding_target: route
                .get("binding_target")
                .and_then(toml::Value::as_str)
                .map(ToOwned::to_owned),
            effect_kind,
            event_id: route
                .get("event_id")
                .and_then(toml::Value::as_str)
                .map(ToOwned::to_owned),
            intensity: parse_optional_f32(route.get("intensity")),
            priority: route
                .get("priority")
                .and_then(toml::Value::as_integer)
                .map(|value| value.max(0) as u32)
                .unwrap_or(0),
        });
    }

    policy
}

fn select_track_dispatch_route<'a>(
    routes: &'a [TrackDispatchRoute],
    track_id: &str,
    agent: Option<&str>,
    phase: &str,
    camera_mode: Option<&str>,
) -> Option<(usize, &'a TrackDispatchRoute)> {
    let mut best: Option<(usize, &TrackDispatchRoute)> = None;
    for (index, route) in routes.iter().enumerate() {
        if !track_id.starts_with(&route.track_prefix) {
            continue;
        }
        if route
            .agent
            .as_deref()
            .is_some_and(|value| Some(value) != agent)
        {
            continue;
        }
        if route.phase.as_deref().is_some_and(|value| value != phase) {
            continue;
        }
        if route
            .camera_mode
            .as_deref()
            .is_some_and(|value| Some(value) != camera_mode)
        {
            continue;
        }

        let should_replace = match best {
            Some((_, existing)) => {
                (route.priority, route.track_prefix.len())
                    > (existing.priority, existing.track_prefix.len())
            }
            None => true,
        };
        if should_replace {
            best = Some((index, route));
        }
    }
    best
}

pub fn derive_runtime_track_dispatch_state(
    registry_state: Option<&GameDataRegistryState>,
    sequencer_state: Option<&GameSequencerRuntimeState>,
    action_bindings: Option<&GameRuntimeActionBindings>,
    camera_state: Option<&GameCameraRuntimeState>,
    previous: Option<&GameSequencerTrackDispatchState>,
) -> GameSequencerTrackDispatchState {
    let mut state = GameSequencerTrackDispatchState::default();

    let Some(sequencer_state) = sequencer_state else {
        return state;
    };
    state.tick_index = sequencer_state.tick_index;
    state.active_phase = sequencer_state.active_phase.clone();
    state.active_timeline = sequencer_state.active_timeline.clone();
    state.active_agent = sequencer_state.active_agent.clone();
    state.active_camera_mode = sequencer_state.active_camera_mode.clone();
    state.issues.extend(sequencer_state.issues.iter().cloned());
    state.frame_index = previous.map(|item| item.frame_index + 1).unwrap_or(1);

    if !sequencer_state.ready {
        state.status = "pending".to_string();
        state.detail = sequencer_state.detail.clone();
        return state;
    }

    let Some(registry_state) = registry_state else {
        state.status = "degraded".to_string();
        state.detail = "missing registry state for sequencer dispatch".to_string();
        return state;
    };
    let Some(snapshot) = registry_state.loaded.get(DEFAULT_SEQUENCER_REGISTRY_KIND) else {
        state.status = "degraded".to_string();
        state.detail = format!(
            "missing required '{}' registry in runtime cache",
            DEFAULT_SEQUENCER_REGISTRY_KIND
        );
        state.issues.extend(registry_state.errors.iter().cloned());
        state.issues.push(state.detail.clone());
        return state;
    };

    let document = match load_registry_document(&snapshot.asset_path) {
        Ok(document) => document,
        Err(error) => {
            state.status = "degraded".to_string();
            state.detail = "failed to parse sequencer registry".to_string();
            state.issues.push(error);
            return state;
        }
    };
    let timelines = parse_timelines(&document, &mut state.issues);
    let dispatch_policy = parse_track_dispatch_policy(&document, &mut state.issues);
    state.routes_loaded = dispatch_policy.routes.len();

    let Some(active_timeline) = &state.active_timeline else {
        state.status = "pending".to_string();
        state.detail = "awaiting active sequencer timeline".to_string();
        return state;
    };
    let Some(timeline) = timelines.get(active_timeline) else {
        state.status = "degraded".to_string();
        state.detail = format!(
            "active timeline '{}' missing from registry",
            active_timeline
        );
        state.issues.push(state.detail.clone());
        return state;
    };

    let phase = action_bindings
        .map(|item| item.active_phase.as_str())
        .unwrap_or(sequencer_state.active_phase.as_str());
    let camera_mode = camera_state
        .and_then(|item| {
            item.active_rig
                .as_deref()
                .and_then(|rig| item.rig_modes.get(rig))
        })
        .map(String::as_str)
        .or(state.active_camera_mode.as_deref());
    let active_agent = sequencer_state.active_agent.as_deref();

    let mut tracks = Vec::new();
    let mut events = Vec::new();
    for track_id in timeline
        .track_ids
        .iter()
        .take(dispatch_policy.max_tracks_per_frame)
    {
        let (track_kind, default_binding_target) = track_identity(track_id);
        let selected = select_track_dispatch_route(
            &dispatch_policy.routes,
            track_id,
            active_agent,
            phase,
            camera_mode,
        );
        let (route_key, binding_target, intensity, effect_kind, event_id) =
            if let Some((route_index, route)) = selected {
                (
                    format!(
                        "runtime_dispatch.routes[{route_index}]::{}",
                        route.track_prefix
                    ),
                    route
                        .binding_target
                        .clone()
                        .unwrap_or_else(|| default_binding_target.clone()),
                    route
                        .intensity
                        .unwrap_or(dispatch_policy.default_track_intensity),
                    route.effect_kind.clone(),
                    route.event_id.clone(),
                )
            } else {
                (
                    "runtime_dispatch.fallback".to_string(),
                    default_binding_target.clone(),
                    dispatch_policy.default_track_intensity,
                    format!("timeline.track.{track_kind}"),
                    None,
                )
            };

        tracks.push(GameSequencerTrackDispatch {
            track_id: track_id.clone(),
            track_kind: track_kind.clone(),
            binding_target,
            intensity,
            route_key: route_key.clone(),
        });
        if track_kind == "event" {
            let event_id = event_id.unwrap_or_else(|| format!("timeline.event.{track_id}"));
            events.push(GameSequencerDispatchEvent {
                event_id,
                effect_kind,
                track_id: track_id.clone(),
                route_key,
            });
            if events.len() >= dispatch_policy.max_events_per_frame {
                break;
            }
        }
    }

    state.tracks_loaded = tracks.len();
    state.events_emitted = events.len();
    state.active_tracks = tracks;
    state.events = events;
    state.ready = state.issues.is_empty();
    state.status = if state.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    state.detail = if state.ready {
        format!(
            "sequencer dispatch ready for '{}' with {} tracks",
            active_timeline, state.tracks_loaded
        )
    } else {
        "sequencer dispatch has unresolved registry or routing issues".to_string()
    };

    state
}

fn track_identity(track_id: &str) -> (String, String) {
    let mut segments = track_id.splitn(3, '.');
    let kind = segments.next().unwrap_or("generic").trim();
    let scope = segments.next().unwrap_or(kind).trim();
    let kind = if kind.is_empty() { "generic" } else { kind };
    let scope = if scope.is_empty() { kind } else { scope };
    (
        kind.to_string(),
        format!("timeline.binding.{}.{}", kind, scope),
    )
}

fn parse_optional_f32(value: Option<&toml::Value>) -> Option<f32> {
    value.and_then(|value| {
        value
            .as_float()
            .map(|raw| raw as f32)
            .or_else(|| value.as_integer().map(|raw| raw as f32))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use k_os_game_framework::RegistrySnapshot;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn write_temp_registry(contents: &str) -> String {
        let id = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "k_os_game_sequencer_test_{}_{}.toml",
            std::process::id(),
            id
        ));
        std::fs::write(&path, contents).expect("writes temp registry");
        path.display().to_string()
    }

    fn registry_state_for(path: String) -> GameDataRegistryState {
        let mut state = GameDataRegistryState::default();
        state.loaded.insert(
            DEFAULT_SEQUENCER_REGISTRY_KIND.to_string(),
            RegistrySnapshot {
                stage_id: "sequencer_timelines_registry".to_string(),
                profile: "editor_preview".to_string(),
                merge_strategy: "replace".to_string(),
                asset_path: path,
                version: "1".to_string(),
                required_table_counts: BTreeMap::new(),
            },
        );
        state
    }

    fn action_state(agent: &str, action: &str, phase: &str) -> GameRuntimeActionBindings {
        let mut state = GameRuntimeActionBindings {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            tick_index: 7,
            active_phase: phase.to_string(),
            routes_loaded: 1,
            agent_actions: BTreeMap::new(),
            agent_input_actions: BTreeMap::new(),
            agent_camera_rigs: BTreeMap::new(),
            issues: Vec::new(),
        };
        state
            .agent_actions
            .insert(agent.to_string(), action.to_string());
        state
    }

    fn camera_state(rig: &str, mode: &str) -> GameCameraRuntimeState {
        let mut state = GameCameraRuntimeState {
            ready: true,
            status: "ready".to_string(),
            detail: "ok".to_string(),
            registry_kind: "camera_rigs".to_string(),
            registry_version: Some("1".to_string()),
            active_rig: Some(rig.to_string()),
            previous_rig: None,
            transition_seconds: 0.2,
            available_rigs: vec![rig.to_string()],
            rig_modes: BTreeMap::new(),
            action_routes_loaded: 0,
            selected_route: None,
            issues: Vec::new(),
        };
        state.rig_modes.insert(rig.to_string(), mode.to_string());
        state
    }

    #[test]
    fn derives_sequencer_state_from_matching_route() {
        let path = write_temp_registry(
            r#"
version = "1"
registry_kind = "sequencer_timelines"

[[timelines]]
id = "runtime.idle.observe"
tracks = ["a", "b"]

[[timelines]]
id = "combat.hero.attack_intro"
tracks = ["c"]

[action_projection]

[[action_projection.routes]]
agent = "hero.default"
phase = "act"
gameplay_action_prefix = "combat.attack."
camera_mode = "cinematic"
target_timeline = "combat.hero.attack_intro"
playback_rate = 1.25
loop = false
priority = 300
event = "timeline.combat.attack_intro"

[playback_policy]
default_timeline = "runtime.idle.observe"
default_rate = 1.0
allow_looping_default = true
"#,
        );

        let registry_state = registry_state_for(path);
        let actions = action_state("hero.default", "combat.attack.primary_target", "act");
        let camera = camera_state("cinematic.spline.preview", "cinematic");

        let next = derive_runtime_sequencer_state(
            Some(&registry_state),
            Some(&actions),
            Some(&camera),
            None,
        );

        assert!(next.ready);
        assert_eq!(
            next.active_timeline.as_deref(),
            Some("combat.hero.attack_intro")
        );
        assert_eq!(next.playback_rate, 1.25);
        assert!(!next.looping);
        assert_eq!(
            next.pending_events,
            vec!["timeline.combat.attack_intro".to_string()]
        );
    }

    #[test]
    fn falls_back_to_playback_policy_default_timeline() {
        let path = write_temp_registry(
            r#"
version = "1"
registry_kind = "sequencer_timelines"

[[timelines]]
id = "runtime.idle.observe"
tracks = ["camera"]
loop = true

[playback_policy]
default_timeline = "runtime.idle.observe"
default_rate = 0.8
allow_looping_default = true
"#,
        );

        let registry_state = registry_state_for(path);
        let next = derive_runtime_sequencer_state(Some(&registry_state), None, None, None);

        assert!(next.ready);
        assert_eq!(
            next.active_timeline.as_deref(),
            Some("runtime.idle.observe")
        );
        assert_eq!(
            next.selected_route.as_deref(),
            Some("playback_policy.default_timeline")
        );
        assert_eq!(next.playback_rate, 0.8);
        assert!(next.looping);
    }

    #[test]
    fn reports_missing_route_timeline_as_issue() {
        let path = write_temp_registry(
            r#"
version = "1"
registry_kind = "sequencer_timelines"

[[timelines]]
id = "runtime.idle.observe"
tracks = ["camera"]

[action_projection]

[[action_projection.routes]]
agent = "hero.default"
phase = "act"
gameplay_action_prefix = "combat.attack."
target_timeline = "combat.hero.attack_intro"
priority = 90
"#,
        );

        let registry_state = registry_state_for(path);
        let actions = action_state("hero.default", "combat.attack.primary_target", "act");

        let next =
            derive_runtime_sequencer_state(Some(&registry_state), Some(&actions), None, None);

        assert!(!next.ready);
        assert_eq!(next.status, "degraded");
        assert!(next
            .issues
            .iter()
            .any(|issue| issue.contains("targets missing timeline")));
    }

    #[test]
    fn keeps_previous_timeline_when_still_declared() {
        let path = write_temp_registry(
            r#"
version = "1"
registry_kind = "sequencer_timelines"

[[timelines]]
id = "runtime.idle.observe"
tracks = ["camera"]

[[timelines]]
id = "interaction.vendor.serve"
tracks = ["camera", "event"]
"#,
        );
        let registry_state = registry_state_for(path);

        let previous = GameSequencerRuntimeState {
            active_timeline: Some("interaction.vendor.serve".to_string()),
            ..GameSequencerRuntimeState::default()
        };

        let next =
            derive_runtime_sequencer_state(Some(&registry_state), None, None, Some(&previous));

        assert!(next.ready);
        assert_eq!(next.active_timeline, previous.active_timeline);
        assert_eq!(
            next.selected_route.as_deref(),
            Some("previous.active_timeline")
        );
    }

    #[test]
    fn derives_track_dispatch_state_from_runtime_dispatch_routes() {
        let path = write_temp_registry(
            r#"
version = "1"
registry_kind = "sequencer_timelines"

[[timelines]]
id = "combat.hero.attack_intro"
tracks = ["camera.attack_close", "event.combat_strike", "fx.sword_trail"]

[runtime_dispatch]
default_track_intensity = 1.0
max_tracks_per_frame = 8
max_events_per_frame = 4

[[runtime_dispatch.routes]]
agent = "hero.default"
phase = "act"
track_prefix = "event."
effect_kind = "gameplay_event"
event_id = "combat.attack.intro"
binding_target = "gameplay.event_bus"
intensity = 1.2
priority = 400
"#,
        );
        let registry_state = registry_state_for(path);
        let actions = action_state("hero.default", "combat.attack.primary_target", "act");
        let previous_runtime = GameSequencerRuntimeState {
            active_timeline: Some("combat.hero.attack_intro".to_string()),
            active_agent: Some("hero.default".to_string()),
            active_phase: "act".to_string(),
            ready: true,
            ..GameSequencerRuntimeState::default()
        };

        let dispatch = derive_runtime_track_dispatch_state(
            Some(&registry_state),
            Some(&previous_runtime),
            Some(&actions),
            None,
            None,
        );

        assert!(dispatch.ready);
        assert_eq!(dispatch.events_emitted, 1);
        assert_eq!(
            dispatch.events[0].event_id,
            "combat.attack.intro".to_string()
        );
        assert_eq!(dispatch.active_tracks.len(), 3);
        assert!(dispatch
            .active_tracks
            .iter()
            .any(|item| item.track_id == "event.combat_strike"
                && item.route_key.contains("runtime_dispatch.routes")));
    }

    #[test]
    fn dispatch_uses_fallback_when_runtime_dispatch_is_missing() {
        let path = write_temp_registry(
            r#"
version = "1"
registry_kind = "sequencer_timelines"

[[timelines]]
id = "runtime.idle.observe"
tracks = ["event.idle", "camera.idle"]
"#,
        );
        let registry_state = registry_state_for(path);
        let runtime = GameSequencerRuntimeState {
            active_timeline: Some("runtime.idle.observe".to_string()),
            ready: true,
            ..GameSequencerRuntimeState::default()
        };
        let dispatch = derive_runtime_track_dispatch_state(
            Some(&registry_state),
            Some(&runtime),
            None,
            None,
            None,
        );

        assert!(dispatch.ready);
        assert_eq!(dispatch.events_emitted, 1);
        assert_eq!(dispatch.events[0].event_id, "timeline.event.event.idle");
        assert!(dispatch
            .active_tracks
            .iter()
            .all(|item| item.route_key == "runtime_dispatch.fallback"));
    }
}

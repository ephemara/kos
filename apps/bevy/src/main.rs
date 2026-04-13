//! K_OS Bevy Viewport - The Leash Architecture
//!
//! Borderless Bevy window that follows the Tauri master window.
//!
//! THE LEASH:
//! - Tauri (React) = Master window with title bar
//! - Bevy = Dog window (borderless, follows Tauri via UDP IPC)
//!
//! Run with: cargo run --bin k-os-bevy

// ===========================================================================
// FUTURE-USE CODE ALLOWANCES
// Many modules contain pre-implemented systems for upcoming features.
// ===========================================================================
#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(unused_variables)]
#![allow(unused_mut)]
#![allow(unused_parens)]

use bevy::diagnostic::{DiagnosticsStore, FrameTimeDiagnosticsPlugin};
use bevy::ecs::system::SystemParam;
use bevy::input::mouse::MouseMotion;
use bevy::prelude::*;
use bevy::window::{PrimaryWindow, Window, WindowLevel, WindowPlugin, WindowResolution};
use bevy_egui::{egui, EguiContexts, EguiPlugin, EguiPrimaryContextPass};
use bevy_panorbit_camera::{PanOrbitCamera, PanOrbitCameraPlugin};
use k_os_game_ai::{
    derive_ai_decision_runtime_state, derive_ai_runtime_state, GameAiDecisionRuntimeState,
    GameAiRuntimeState,
};
use k_os_game_camera::{
    derive_runtime_camera_dispatch_state, derive_runtime_camera_state,
    derive_runtime_camera_view_state, GameCameraDispatchState, GameCameraRuntimeState,
    GameCameraViewRuntimeState, GameSequencerCameraDispatchInput,
};
use k_os_game_framework::{
    ingest_data_registry_stage_results, resolve_game_product_launch_preset, GameDataRegistryState,
    GamePipelineBootstrapState, GameProductLaunchPreset, GameRuntimeActionBindings,
    GameRuntimeRegistryBindings,
};
use k_os_game_input::{
    apply_host_input_frame, derive_runtime_input_state, GameHostInputFrame, GameInputIntentState,
    GameInputRuntimeState,
};
use k_os_game_play::{
    derive_execution_application_state, derive_execution_command_state,
    derive_execution_effects_state, derive_execution_transport_backend_state,
    derive_execution_transport_state, derive_runtime_action_bindings,
    derive_runtime_readiness_state, derive_runtime_registry_bindings,
    GameExecutionApplicationState, GameExecutionCommandState, GameExecutionEffectsState,
    GameExecutionTransportBackendState, GameExecutionTransportState, GamePipelineRuntimePolicy,
    RuntimeReadinessState,
};
use k_os_game_runtime::{
    build_execution_plan, execute_plan_with_builtin_adapters, load_manifest_from_file,
    run_preflight_checks, ExecutionPlan, ExecutionRunReport, PipelineManifest,
    RuntimeExecutionOptions, StageExecutionRecord, StageExecutionStatus, StageKind, StagePayload,
};
use k_os_game_sequencer::{
    derive_runtime_sequencer_state, derive_runtime_track_dispatch_state, GameSequencerRuntimeState,
    GameSequencerTrackDispatchState,
};
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

// Leash IPC - local copy for k-os-bevy
mod leash;
use leash::{LeashDog, LeashMessage, LeashResponse, LeashResponseSender};

#[derive(Resource)]
struct LeashSender(LeashResponseSender);

fn handle_shortcuts(input: Res<ButtonInput<KeyCode>>, sender: Option<Res<LeashSender>>) {
    // Ctrl+Space to toggle Asset Browser (sent to React)
    if (input.pressed(KeyCode::ControlLeft) || input.pressed(KeyCode::ControlRight))
        && input.just_pressed(KeyCode::Space)
    {
        info!("🔀 Ctrl+Space detected in Bevy");
        if let Some(s) = sender {
            info!("📤 Sending ToggleAssetBrowser to React via Leash");
            s.0.send(LeashResponse::ToggleAssetBrowser);
        } else {
            warn!("⚠️ No LeashSender available - cannot forward to React");
        }
    }
}

// ============================================================================
// ORGANIZED MODULE STRUCTURE
// ============================================================================

// Viewport systems (layers, selection, materials, import, gizmo)
mod viewport;
pub use viewport::ImportGltfEvent;
use viewport::{
    sculpt_enabled, ActiveTool, LayerObjectBundle, SelectObjectEvent, SelectionState,
    ToggleLockEvent, ToggleVisibilityEvent, UniversalViewportPlugin,
};

// UI systems (egui panels)
mod ui;

// Tool modes (sculpt, paint, etc.)
mod tools;
use tools::{
    BrushSettings, BrushStrokeEvent, CursorMovedEvent, EguiCaptureState, InputSource,
    InputTelemetry, MainCamera, RedoEvent, SculptCursorState, SculptData, SculptModel,
    SculptPlugin, SculptUiPlugin, SnapshotEvent, SubdivideEvent, UndoEvent,
};

use ui::UiSurfacesPlugin;

// Asset browser (standalone for now)
mod asset_browser;
use asset_browser::AssetBrowserPlugin;
use asset_browser::{KernelSyncEvent, ToggleBrowserEvent};
use gpu_device_bridge::GpuDeviceBridgePlugin;

// Experimental features
#[allow(dead_code)]
mod camera_experimental;

// GPU Device Bridge for Bevy integration
mod gpu_device_bridge;

use k_os_brushes as brushes;
use k_os_mesh::primitive_gen::{self, PrimitiveResult};
pub mod gpu {
    pub use k_os_gpu_pipeline::gpu::*;
    pub use k_os_gpu_pipeline::{GpuBvhRaycast, GpuRaycastMesh, RayHit};
}
pub mod modules {
    pub use k_os_sculpt::sculpt;
}
#[derive(Resource)]
struct LeashReceiver {
    dog: LeashDog,
}

#[derive(Component, Debug, Clone)]
struct GameRuntimeAgentAnchor {
    agent_id: String,
}

#[derive(Component, Debug, Default)]
struct GameRuntimeAgentMotion {
    last_linear: Vec3,
    last_angular: Vec3,
    last_frame: u64,
}

fn workspace_assets_dir() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .ancestors()
        .find_map(|dir| {
            let candidate = Path::new(dir).join("assets");
            candidate.is_dir().then_some(candidate)
        })
        .unwrap_or_else(|| PathBuf::from("assets"))
}

#[derive(Debug, Clone, Resource)]
struct GamePipelineBootstrapConfig {
    enabled: bool,
    manifest_path: PathBuf,
    workspace_root: PathBuf,
    launch_preset: Option<String>,
    launch_profile: Option<String>,
    fail_fast: bool,
    emit_artifacts: bool,
}

impl GamePipelineBootstrapConfig {
    fn from_env() -> Self {
        let workspace_root = std::env::var("KOS_GAME_PIPELINE_WORKSPACE_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|_| workspace_root_dir());

        let manifest_path = std::env::var("KOS_GAME_PIPELINE_MANIFEST")
            .map(PathBuf::from)
            .unwrap_or_else(|_| workspace_root.join("sources/game/config/pipeline.toml"));

        Self {
            enabled: parse_env_bool("KOS_GAME_PIPELINE_ENABLED", true),
            manifest_path,
            workspace_root,
            launch_preset: std::env::var("KOS_GAME_PIPELINE_PRESET")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty()),
            launch_profile: std::env::var("KOS_GAME_PIPELINE_PROFILE")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty()),
            fail_fast: parse_env_bool("KOS_GAME_PIPELINE_FAIL_FAST", false),
            emit_artifacts: parse_env_bool("KOS_GAME_PIPELINE_EMIT_ARTIFACTS", true),
        }
    }
}

#[derive(Event, Debug, Clone)]
struct GamePipelineStartupEvent {
    stage_id: String,
    kind: String,
    profile: String,
    adapter_id: String,
    status: String,
    detail: String,
}
impl bevy::prelude::Message for GamePipelineStartupEvent {}

impl GamePipelineStartupEvent {
    fn from_record(record: &StageExecutionRecord) -> Self {
        Self {
            stage_id: record.stage_id.clone(),
            kind: stage_kind_key(&record.kind).to_string(),
            profile: record.profile.clone(),
            adapter_id: record.adapter_id.clone(),
            status: stage_status_key(&record.status).to_string(),
            detail: record.detail.clone(),
        }
    }

    fn bootstrap_error(detail: String) -> Self {
        Self {
            stage_id: "__bootstrap__".to_string(),
            kind: "bootstrap".to_string(),
            profile: "n/a".to_string(),
            adapter_id: "n/a".to_string(),
            status: "failed".to_string(),
            detail,
        }
    }
}

fn parse_env_bool(key: &str, default_value: bool) -> bool {
    match std::env::var(key) {
        Ok(raw) => match raw.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => true,
            "0" | "false" | "no" | "off" => false,
            _ => default_value,
        },
        Err(_) => default_value,
    }
}

fn workspace_root_dir() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .ancestors()
        .find_map(|dir| {
            let pipeline = Path::new(dir).join("sources/game/config/pipeline.toml");
            pipeline.is_file().then_some(PathBuf::from(dir))
        })
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

fn reconcile_game_pipeline_runtime_state(
    bootstrap_state: Option<Res<GamePipelineBootstrapState>>,
    registry_state: Option<Res<GameDataRegistryState>>,
    policy: Option<Res<GamePipelineRuntimePolicy>>,
    mut bindings_state: ResMut<GameRuntimeRegistryBindings>,
    mut readiness_state: ResMut<RuntimeReadinessState>,
) {
    let next_bindings = match (
        bootstrap_state.as_deref(),
        registry_state.as_deref(),
        policy.as_deref(),
    ) {
        (Some(bootstrap_state), Some(registry_state), Some(policy)) => {
            derive_runtime_registry_bindings(bootstrap_state, registry_state, policy)
        }
        _ => GameRuntimeRegistryBindings::default(),
    };
    let next_readiness = derive_runtime_readiness_state(
        bootstrap_state.as_deref(),
        registry_state.as_deref(),
        policy.as_deref(),
        &next_bindings,
    );

    if bindings_state.ready != next_bindings.ready
        || bindings_state.issues != next_bindings.issues
        || bindings_state.loaded_registry_versions != next_bindings.loaded_registry_versions
    {
        if next_bindings.ready {
            info!(
                "[game-runtime] readiness={} contexts={} tags={} archetypes={} camera_rigs={} visual_graphs={}",
                next_readiness.status,
                next_bindings.input_context_action_counts.len(),
                next_bindings.tag_domain_counts.len(),
                next_bindings.actor_archetypes.len(),
                next_bindings.camera_rigs.len(),
                next_bindings.visual_graphs.len()
            );
        } else {
            warn!(
                "[game-runtime] readiness={} issue_count={} detail={}",
                next_readiness.status,
                next_bindings.issues.len(),
                next_bindings.ready_reason
            );
        }
    }

    *bindings_state = next_bindings;
    *readiness_state = next_readiness;
}

fn reconcile_game_pipeline_ai_state(
    bootstrap_state: Option<Res<GamePipelineBootstrapState>>,
    registry_state: Option<Res<GameDataRegistryState>>,
    mut ai_state: ResMut<GameAiRuntimeState>,
) {
    let next = derive_ai_runtime_state(bootstrap_state.as_deref(), registry_state.as_deref());

    if ai_state.status != next.status
        || ai_state.issues != next.issues
        || ai_state.agent_ids != next.agent_ids
    {
        if next.ready {
            info!(
                "[game-ai] readiness={} state_trees={} blackboards={} agents={}",
                next.status,
                next.state_tree_ids.len(),
                next.blackboard_ids.len(),
                next.agent_ids.len()
            );
        } else {
            warn!(
                "[game-ai] readiness={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *ai_state = next;
}

fn reconcile_game_pipeline_ai_decision_state(
    ai_state: Res<GameAiRuntimeState>,
    mut decision_state: ResMut<GameAiDecisionRuntimeState>,
) {
    let next = derive_ai_decision_runtime_state(&ai_state, Some(&decision_state));

    if decision_state.status != next.status || decision_state.issues != next.issues {
        if next.ready {
            info!(
                "[game-ai] decision_tick={} phase={} agents={}",
                next.tick_index,
                next.active_phase,
                next.agent_decisions.len()
            );
        } else {
            warn!(
                "[game-ai] decision-runtime status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *decision_state = next;
}

fn reconcile_game_pipeline_action_state(
    registry_state: Option<Res<GameDataRegistryState>>,
    runtime_bindings: Option<Res<GameRuntimeRegistryBindings>>,
    ai_decision_state: Option<Res<GameAiDecisionRuntimeState>>,
    mut action_bindings: ResMut<GameRuntimeActionBindings>,
) {
    let next = derive_runtime_action_bindings(
        registry_state.as_deref(),
        runtime_bindings.as_deref(),
        ai_decision_state.as_deref(),
    );

    if action_bindings.status != next.status
        || action_bindings.issues != next.issues
        || action_bindings.agent_actions != next.agent_actions
    {
        if next.ready {
            info!(
                "[game-play] action_tick={} phase={} actions={} routes={}",
                next.tick_index,
                next.active_phase,
                next.agent_actions.len(),
                next.routes_loaded
            );
        } else {
            warn!(
                "[game-play] action-runtime status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *action_bindings = next;
}

fn reconcile_game_pipeline_input_state(
    registry_state: Option<Res<GameDataRegistryState>>,
    runtime_bindings: Option<Res<GameRuntimeRegistryBindings>>,
    action_bindings: Option<Res<GameRuntimeActionBindings>>,
    camera_state: Option<Res<GameCameraRuntimeState>>,
    mut input_state: ResMut<GameInputRuntimeState>,
) {
    let next = derive_runtime_input_state(
        registry_state.as_deref(),
        runtime_bindings.as_deref(),
        action_bindings.as_deref(),
        camera_state.as_deref(),
    );

    if input_state.status != next.status
        || input_state.issues != next.issues
        || input_state.agent_input_actions != next.agent_input_actions
        || input_state.agent_gates != next.agent_gates
    {
        if next.ready {
            info!(
                "[game-input] action_tick={} phase={} mappings={} gated={} camera_mode={} context={}",
                next.tick_index,
                next.active_phase,
                next.agent_input_actions.len(),
                next.agent_gates.len(),
                next.active_camera_mode.as_deref().unwrap_or("default"),
                next.active_context.as_deref().unwrap_or("")
            );
        } else {
            warn!(
                "[game-input] status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *input_state = next;
}

fn capture_game_host_input_frame(
    keyboard: Res<ButtonInput<KeyCode>>,
    mouse_buttons: Res<ButtonInput<MouseButton>>,
    mut mouse_motion: MessageReader<MouseMotion>,
    mut host_input: ResMut<GameHostInputFrame>,
    input_state: Option<Res<GameInputRuntimeState>>,
) {
    host_input.frame_index = host_input.frame_index.saturating_add(1);
    host_input.digital_pressed.clear();
    host_input.axis_2d.clear();

    for (key, token) in [
        (KeyCode::KeyW, "w"),
        (KeyCode::KeyA, "a"),
        (KeyCode::KeyS, "s"),
        (KeyCode::KeyD, "d"),
        (KeyCode::Space, "space"),
        (KeyCode::KeyE, "e"),
        (KeyCode::ArrowUp, "up"),
        (KeyCode::ArrowDown, "down"),
        (KeyCode::ArrowLeft, "left"),
        (KeyCode::ArrowRight, "right"),
    ] {
        if keyboard.pressed(key) {
            host_input.digital_pressed.insert(token.to_string());
        }
    }
    for (button, token) in [
        (MouseButton::Left, "mouse_left"),
        (MouseButton::Right, "mouse_right"),
    ] {
        if mouse_buttons.pressed(button) {
            host_input.digital_pressed.insert(token.to_string());
        }
    }

    let mut delta = Vec2::ZERO;
    for event in mouse_motion.read() {
        delta += event.delta;
    }
    let max_mouse_delta = input_state
        .as_deref()
        .map(|state| state.host_max_mouse_delta)
        .unwrap_or(500.0);
    let clamped_x = delta.x.clamp(-max_mouse_delta, max_mouse_delta) / max_mouse_delta;
    let clamped_y = delta.y.clamp(-max_mouse_delta, max_mouse_delta) / max_mouse_delta;
    host_input
        .axis_2d
        .insert("mouse_delta".to_string(), [clamped_x, clamped_y]);
}

fn reconcile_game_pipeline_input_intents(
    input_state: Option<Res<GameInputRuntimeState>>,
    host_input: Option<Res<GameHostInputFrame>>,
    mut intent_state: ResMut<GameInputIntentState>,
) {
    let next = apply_host_input_frame(
        input_state.as_deref(),
        host_input.as_deref(),
        Some(&intent_state),
    );

    if intent_state.status != next.status
        || intent_state.issues != next.issues
        || intent_state.agent_intents != next.agent_intents
    {
        if next.ready {
            info!(
                "[game-input] host_frame={} intents={} phase={} tick={}",
                next.frame_index,
                next.agent_intents.len(),
                next.active_phase,
                next.tick_index
            );
        } else {
            warn!(
                "[game-input] intent-status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }
    *intent_state = next;
}

fn reconcile_game_pipeline_execution_commands(
    registry_state: Option<Res<GameDataRegistryState>>,
    intent_state: Option<Res<GameInputIntentState>>,
    mut command_state: ResMut<GameExecutionCommandState>,
) {
    let next = derive_execution_command_state(
        registry_state.as_deref(),
        intent_state.as_deref(),
        Some(&command_state),
    );

    if command_state.status != next.status
        || command_state.issues != next.issues
        || command_state.agent_commands != next.agent_commands
    {
        if next.ready {
            info!(
                "[game-exec] frame={} tick={} phase={} commands={} routes={}",
                next.frame_index,
                next.tick_index,
                next.active_phase,
                next.agent_commands.len(),
                next.routes_loaded
            );
        } else {
            warn!(
                "[game-exec] status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *command_state = next;
}

fn reconcile_game_pipeline_execution_application(
    registry_state: Option<Res<GameDataRegistryState>>,
    command_state: Option<Res<GameExecutionCommandState>>,
    mut application_state: ResMut<GameExecutionApplicationState>,
) {
    let next = derive_execution_application_state(
        registry_state.as_deref(),
        command_state.as_deref(),
        Some(&application_state),
    );

    if application_state.status != next.status
        || application_state.issues != next.issues
        || application_state.agent_applications != next.agent_applications
    {
        if next.ready {
            info!(
                "[game-exec-apply] frame={} tick={} phase={} applications={} steps={}",
                next.frame_index,
                next.tick_index,
                next.active_phase,
                next.agent_applications.len(),
                next.applied_steps
            );
        } else {
            warn!(
                "[game-exec-apply] status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *application_state = next;
}

fn reconcile_game_pipeline_execution_effects(
    registry_state: Option<Res<GameDataRegistryState>>,
    command_state: Option<Res<GameExecutionCommandState>>,
    application_state: Option<Res<GameExecutionApplicationState>>,
    mut effects_state: ResMut<GameExecutionEffectsState>,
) {
    let next = derive_execution_effects_state(
        registry_state.as_deref(),
        command_state.as_deref(),
        application_state.as_deref(),
        Some(&effects_state),
    );

    if effects_state.status != next.status
        || effects_state.issues != next.issues
        || effects_state.events != next.events
    {
        if next.ready {
            info!(
                "[game-exec-fx] frame={} tick={} events={} routes={} next_seq={}",
                next.frame_index,
                next.tick_index,
                next.events_emitted,
                next.routes_loaded,
                next.next_sequence
            );
        } else {
            warn!(
                "[game-exec-fx] status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *effects_state = next;
}

fn reconcile_game_pipeline_execution_transport(
    registry_state: Option<Res<GameDataRegistryState>>,
    effects_state: Option<Res<GameExecutionEffectsState>>,
    mut transport_state: ResMut<GameExecutionTransportState>,
) {
    let next = derive_execution_transport_state(
        registry_state.as_deref(),
        effects_state.as_deref(),
        Some(&transport_state),
    );

    if transport_state.status != next.status
        || transport_state.issues != next.issues
        || transport_state.journal != next.journal
    {
        if next.ready {
            info!(
                "[game-exec-transport] frame={} tick={} ingested={} retained={} routes={} rollback_floor={} fp={}",
                next.frame_index,
                next.tick_index,
                next.events_ingested,
                next.journal_retained,
                next.channel_routes_loaded,
                next.rollback_floor_sequence,
                next.replay_fingerprint
            );
        } else {
            warn!(
                "[game-exec-transport] status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *transport_state = next;
}

fn reconcile_game_pipeline_execution_transport_backends(
    registry_state: Option<Res<GameDataRegistryState>>,
    transport_state: Option<Res<GameExecutionTransportState>>,
    mut transport_backend_state: ResMut<GameExecutionTransportBackendState>,
) {
    let next = derive_execution_transport_backend_state(
        registry_state.as_deref(),
        transport_state.as_deref(),
        Some(&transport_backend_state),
    );

    if transport_backend_state.status != next.status
        || transport_backend_state.issues != next.issues
        || transport_backend_state.payloads != next.payloads
    {
        if next.ready {
            info!(
                "[game-exec-transport-backend] frame={} tick={} payloads={} lanes={} routes={} exported={} rollback_floor={} fp={}",
                next.frame_index,
                next.tick_index,
                next.payloads_emitted,
                next.lanes_emitted,
                next.routes_loaded,
                next.exported_through_sequence,
                next.rollback_floor_sequence,
                next.backend_fingerprint
            );
        } else {
            warn!(
                "[game-exec-transport-backend] status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *transport_backend_state = next;
}

fn apply_game_pipeline_execution_commands(
    application_state: Option<Res<GameExecutionApplicationState>>,
    mut agents: Query<(
        &GameRuntimeAgentAnchor,
        &mut Transform,
        Option<&mut GameRuntimeAgentMotion>,
    )>,
) {
    let Some(application_state) = application_state else {
        return;
    };
    if !application_state.ready {
        return;
    }

    for (anchor, mut transform, motion) in agents.iter_mut() {
        let Some(application) = application_state.agent_applications.get(&anchor.agent_id) else {
            continue;
        };
        let linear = Vec3::new(
            application.linear_velocity[0],
            application.linear_velocity[1],
            application.linear_velocity[2],
        );
        let angular = Vec3::new(
            application.angular_velocity[0],
            application.angular_velocity[1],
            application.angular_velocity[2],
        );
        let translation_delta = Vec3::new(
            application.translation_delta[0],
            application.translation_delta[1],
            application.translation_delta[2],
        );
        let rotation_delta = Vec3::new(
            application.rotation_delta[0],
            application.rotation_delta[1],
            application.rotation_delta[2],
        );

        transform.translation += translation_delta;
        if rotation_delta.y.abs() > f32::EPSILON {
            transform.rotate_y(rotation_delta.y);
        }
        if rotation_delta.x.abs() > f32::EPSILON {
            transform.rotate_local_x(rotation_delta.x);
        }
        if rotation_delta.z.abs() > f32::EPSILON {
            transform.rotate_local_z(rotation_delta.z);
        }

        if let Some(mut motion) = motion {
            motion.last_linear = linear;
            motion.last_angular = angular;
            motion.last_frame = application_state.frame_index;
        }
    }
}

fn reconcile_game_pipeline_camera_state(
    registry_state: Option<Res<GameDataRegistryState>>,
    runtime_bindings: Option<Res<GameRuntimeRegistryBindings>>,
    action_bindings: Option<Res<GameRuntimeActionBindings>>,
    camera_dispatch_state: Option<Res<GameCameraDispatchState>>,
    mut camera_state: ResMut<GameCameraRuntimeState>,
) {
    let next = derive_runtime_camera_state(
        registry_state.as_deref(),
        runtime_bindings.as_deref(),
        action_bindings.as_deref(),
        camera_dispatch_state.as_deref(),
        Some(&camera_state),
    );

    if camera_state.status != next.status
        || camera_state.issues != next.issues
        || camera_state.active_rig != next.active_rig
    {
        if next.ready {
            info!(
                "[game-camera] active_rig={} transition={}s routes={}",
                next.active_rig.as_deref().unwrap_or(""),
                next.transition_seconds,
                next.action_routes_loaded
            );
        } else {
            warn!(
                "[game-camera] status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *camera_state = next;
}

fn reconcile_game_pipeline_camera_view_state(
    registry_state: Option<Res<GameDataRegistryState>>,
    camera_state: Option<Res<GameCameraRuntimeState>>,
    camera_dispatch_state: Option<Res<GameCameraDispatchState>>,
    mut camera_view_state: ResMut<GameCameraViewRuntimeState>,
) {
    let next = derive_runtime_camera_view_state(
        registry_state.as_deref(),
        camera_state.as_deref(),
        camera_dispatch_state.as_deref(),
    );

    if camera_view_state.status != next.status
        || camera_view_state.active_rig != next.active_rig
        || camera_view_state.camera_translation != next.camera_translation
        || camera_view_state.orbit_focus != next.orbit_focus
    {
        if next.ready {
            info!(
                "[game-camera-view] rig={} source={} host_apply={} orbit_radius={}",
                next.active_rig.as_deref().unwrap_or(""),
                next.view_source,
                next.apply_to_host_camera,
                next.orbit_radius
            );
        } else {
            warn!(
                "[game-camera-view] status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *camera_view_state = next;
}

fn apply_game_pipeline_camera_view_state(
    camera_view_state: Option<Res<GameCameraViewRuntimeState>>,
    mut camera_query: Query<(&mut Transform, &mut PanOrbitCamera), With<MainCamera>>,
) {
    let Some(camera_view_state) = camera_view_state else {
        return;
    };
    if !camera_view_state.ready || !camera_view_state.apply_to_host_camera {
        return;
    }

    let focus = Vec3::new(
        camera_view_state.orbit_focus[0],
        camera_view_state.orbit_focus[1],
        camera_view_state.orbit_focus[2],
    );
    let translation = Vec3::new(
        camera_view_state.camera_translation[0],
        camera_view_state.camera_translation[1],
        camera_view_state.camera_translation[2],
    );

    for (mut transform, mut pan_orbit) in camera_query.iter_mut() {
        transform.translation = translation;
        transform.look_at(focus, Vec3::Y);
        pan_orbit.focus = focus;
        pan_orbit.radius = Some(camera_view_state.orbit_radius.max(0.1));
    }
}

fn reconcile_game_pipeline_camera_dispatch_state(
    registry_state: Option<Res<GameDataRegistryState>>,
    sequencer_dispatch_state: Option<Res<GameSequencerTrackDispatchState>>,
    mut camera_dispatch_state: ResMut<GameCameraDispatchState>,
) {
    let dispatch_inputs = sequencer_dispatch_state
        .as_deref()
        .map(|state| {
            state
                .active_tracks
                .iter()
                .map(|track| GameSequencerCameraDispatchInput {
                    track_id: track.track_id.clone(),
                    binding_target: track.binding_target.clone(),
                    route_key: track.route_key.clone(),
                    intensity: track.intensity,
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let next = derive_runtime_camera_dispatch_state(
        registry_state.as_deref(),
        &dispatch_inputs,
        Some(&camera_dispatch_state),
    );

    if camera_dispatch_state.status != next.status
        || camera_dispatch_state.issues != next.issues
        || camera_dispatch_state.active_rig != next.active_rig
    {
        if next.ready {
            info!(
                "[game-camera-dispatch] rig={} routes={} track={}",
                next.active_rig.as_deref().unwrap_or(""),
                next.routes_loaded,
                next.selected_track_id.as_deref().unwrap_or("")
            );
        } else {
            warn!(
                "[game-camera-dispatch] status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *camera_dispatch_state = next;
}

fn reconcile_game_pipeline_sequencer_state(
    registry_state: Option<Res<GameDataRegistryState>>,
    action_bindings: Option<Res<GameRuntimeActionBindings>>,
    camera_state: Option<Res<GameCameraRuntimeState>>,
    mut sequencer_state: ResMut<GameSequencerRuntimeState>,
) {
    let next = derive_runtime_sequencer_state(
        registry_state.as_deref(),
        action_bindings.as_deref(),
        camera_state.as_deref(),
        Some(&sequencer_state),
    );

    if sequencer_state.status != next.status
        || sequencer_state.issues != next.issues
        || sequencer_state.active_timeline != next.active_timeline
    {
        if next.ready {
            info!(
                "[game-sequencer] timeline={} phase={} routes={} events={}",
                next.active_timeline.as_deref().unwrap_or(""),
                next.active_phase,
                next.routes_loaded,
                next.pending_events.len()
            );
        } else {
            warn!(
                "[game-sequencer] status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *sequencer_state = next;
}

fn reconcile_game_pipeline_sequencer_dispatch_state(
    registry_state: Option<Res<GameDataRegistryState>>,
    action_bindings: Option<Res<GameRuntimeActionBindings>>,
    camera_state: Option<Res<GameCameraRuntimeState>>,
    sequencer_state: Option<Res<GameSequencerRuntimeState>>,
    mut dispatch_state: ResMut<GameSequencerTrackDispatchState>,
) {
    let next = derive_runtime_track_dispatch_state(
        registry_state.as_deref(),
        sequencer_state.as_deref(),
        action_bindings.as_deref(),
        camera_state.as_deref(),
        Some(&dispatch_state),
    );

    if dispatch_state.status != next.status
        || dispatch_state.issues != next.issues
        || dispatch_state.active_timeline != next.active_timeline
        || dispatch_state.events_emitted != next.events_emitted
    {
        if next.ready {
            info!(
                "[game-sequencer-dispatch] timeline={} tracks={} events={} routes={}",
                next.active_timeline.as_deref().unwrap_or(""),
                next.tracks_loaded,
                next.events_emitted,
                next.routes_loaded
            );
        } else {
            warn!(
                "[game-sequencer-dispatch] status={} issue_count={} detail={}",
                next.status,
                next.issues.len(),
                next.detail
            );
        }
    }

    *dispatch_state = next;
}

fn stage_kind_key(kind: &StageKind) -> &'static str {
    match kind {
        StageKind::Scene => "scene",
        StageKind::KainHotReload => "kain_hot_reload",
        StageKind::NarrativeGraph => "narrative_graph",
        StageKind::DataRegistry => "data_registry",
        StageKind::Cook => "cook",
        StageKind::Build => "build",
        StageKind::Export => "export",
    }
}

fn stage_status_key(status: &StageExecutionStatus) -> &'static str {
    match status {
        StageExecutionStatus::Planned => "planned",
        StageExecutionStatus::Succeeded => "succeeded",
        StageExecutionStatus::Failed => "failed",
    }
}

fn bootstrap_game_pipeline(
    mut commands: Commands,
    mut startup_events: MessageWriter<GamePipelineStartupEvent>,
) {
    let config = GamePipelineBootstrapConfig::from_env();
    let mut state = GamePipelineBootstrapState::new(
        config.enabled,
        config.manifest_path.display().to_string(),
        config.workspace_root.display().to_string(),
    );
    let mut registry_state = GameDataRegistryState::default();
    commands.insert_resource(config.clone());

    if !config.enabled {
        commands.insert_resource(GamePipelineRuntimePolicy::from_env());
        info!("game pipeline bootstrap disabled via KOS_GAME_PIPELINE_ENABLED=0");
        state.completed = true;
        commands.insert_resource(state);
        commands.insert_resource(registry_state);
        return;
    }

    let manifest = match load_manifest_from_file(&config.manifest_path) {
        Ok(manifest) => manifest,
        Err(error) => {
            commands.insert_resource(GamePipelineRuntimePolicy::from_env());
            let detail = format!(
                "failed to load pipeline manifest '{}': {error}",
                config.manifest_path.display()
            );
            startup_events.write(GamePipelineStartupEvent::bootstrap_error(detail.clone()));
            error!("{detail}");
            state.error = Some(detail);
            state.completed = true;
            commands.insert_resource(state);
            commands.insert_resource(registry_state);
            return;
        }
    };
    let launch_preset = match resolve_game_product_launch_preset(
        &manifest,
        config.launch_preset.as_deref(),
        config.launch_profile.as_deref(),
    ) {
        Ok(preset) => preset,
        Err(error) => {
            let detail = format!("failed to resolve game launch preset: {error}");
            startup_events.write(GamePipelineStartupEvent::bootstrap_error(detail.clone()));
            error!("{detail}");
            state.error = Some(detail);
            state.completed = true;
            commands.insert_resource(state);
            commands.insert_resource(registry_state);
            return;
        }
    };
    info!(
        "game launch preset resolved: product='{}' profile='{}' host='{}' renderer='{}' ui='{}'",
        launch_preset.product_name,
        launch_preset.profile_id,
        launch_preset.runtime_host,
        launch_preset.renderer_contract,
        launch_preset.ui_shell
    );
    let runtime_policy =
        GamePipelineRuntimePolicy::from_launch_preset_with_env_overrides(&launch_preset);
    commands.insert_resource(launch_preset);
    commands.insert_resource(runtime_policy);

    let plan = match build_execution_plan(&manifest) {
        Ok(plan) => plan,
        Err(error) => {
            let detail = format!("failed to build game execution plan: {error}");
            startup_events.write(GamePipelineStartupEvent::bootstrap_error(detail.clone()));
            error!("{detail}");
            state.error = Some(detail);
            state.completed = true;
            commands.insert_resource(state);
            commands.insert_resource(registry_state);
            return;
        }
    };

    match run_preflight_checks(&manifest, &config.workspace_root) {
        Ok(report) => {
            if !report.missing_paths.is_empty() {
                warn!(
                    "game pipeline preflight missing {} path(s): {}",
                    report.missing_paths.len(),
                    report.missing_paths.join(", ")
                );
            }
            state.preflight_missing_paths = report.missing_paths;
        }
        Err(error) => {
            let detail = format!("game pipeline preflight failed: {error}");
            startup_events.write(GamePipelineStartupEvent::bootstrap_error(detail.clone()));
            error!("{detail}");
            state.error = Some(detail);
            state.completed = true;
            commands.insert_resource(state);
            commands.insert_resource(registry_state);
            return;
        }
    }

    let execution_options = RuntimeExecutionOptions {
        fail_fast: config.fail_fast,
        emit_artifacts: config.emit_artifacts,
    };
    match execute_plan_with_builtin_adapters(
        &manifest,
        &plan,
        &config.workspace_root,
        &execution_options,
    ) {
        Ok(report) => {
            state.stage_total = report.records.len();
            state.stage_failed = report
                .records
                .iter()
                .filter(|record| record.status == StageExecutionStatus::Failed)
                .count();
            registry_state = ingest_data_registry_stage_results(
                &manifest,
                &plan,
                &report,
                &config.workspace_root,
            );
            state.registry_loaded = registry_state.loaded.len();
            state.registry_errors = registry_state.errors.len();

            for record in &report.records {
                startup_events.write(GamePipelineStartupEvent::from_record(record));
            }
        }
        Err(error) => {
            let detail = format!("game pipeline execution failed: {error}");
            startup_events.write(GamePipelineStartupEvent::bootstrap_error(detail.clone()));
            error!("{detail}");
            state.error = Some(detail);
        }
    }

    state.completed = true;
    commands.insert_resource(state);
    commands.insert_resource(registry_state);
}

fn log_game_pipeline_startup_events(mut startup_events: MessageReader<GamePipelineStartupEvent>) {
    for event in startup_events.read() {
        match event.status.as_str() {
            "succeeded" => info!(
                "[game-pipeline] stage={} kind={} profile={} adapter={} status={} detail={}",
                event.stage_id,
                event.kind,
                event.profile,
                event.adapter_id,
                event.status,
                event.detail
            ),
            _ => warn!(
                "[game-pipeline] stage={} kind={} profile={} adapter={} status={} detail={}",
                event.stage_id,
                event.kind,
                event.profile,
                event.adapter_id,
                event.status,
                event.detail
            ),
        }
    }
}

fn handle_spawn_primitive(
    mut events: MessageReader<SpawnPrimitiveEvent>,
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut selection_state: ResMut<SelectionState>,
) {
    for event in events.read() {
        info!("🔷 Loading primitive type: {}", event.primitive_type);
        let mesh_data = match event.primitive_type {
            0 => primitive_gen::generate_quad_sphere(4),
            1 => primitive_gen::generate_quad_cube(4),
            2 => primitive_gen::generate_quad_cylinder(16, 8),
            3 => primitive_gen::generate_quad_sphere(3),
            4 => primitive_gen::generate_plane(4),
            _ => primitive_gen::generate_quad_sphere(4),
        };

        let mesh = meshes.add(mesh_from_primitive(mesh_data));

        let entity = commands
            .spawn((
                Mesh3d(mesh),
                MeshMaterial3d(materials.add(StandardMaterial {
                    base_color: Color::srgb(0.7, 0.6, 0.5),
                    ..default()
                })),
                LayerObjectBundle::new("Primitive"),
                Transform::from_xyz(0.0, 0.0, 0.0),
            ))
            .id();

        selection_state.primary = Some(entity);
        selection_state.selection = vec![entity];
    }
}

#[derive(Resource)]
struct DebugUiState {
    enabled: bool,
    /// Frame counter - egui panics if used before Context::run()
    frames_elapsed: u32,
}

impl Default for DebugUiState {
    fn default() -> Self {
        Self {
            enabled: true, // Enable by default so sculpting works immediately
            frames_elapsed: 0,
        }
    }
}

/// Event for loading primitives from egui
#[derive(Event, Clone, Copy, Debug)]
pub struct SpawnPrimitiveEvent {
    pub primitive_type: u8,
}
impl bevy::prelude::Message for SpawnPrimitiveEvent {}

#[derive(Debug, Clone, Deserialize)]
struct NativeViewportPayload {
    mesh_handle: u64,
    positions: Vec<f32>,
    normals: Vec<f32>,
    indices: Vec<u32>,
}

#[derive(Resource)]
struct DebugUiPanels {
    sandbox_open: bool,
    sculpt_open: bool,
    sandbox_slider: f32,
    sandbox_text: String,
    brush_tool: u8,
    brush_radius: f32,
    brush_intensity: f32,
    cursor_ndc: Vec2,
    use_delta: bool,
    delta_ndc: Vec2,
    auto_stroke: bool,
    strokes_per_sec: f32,
    auto_timer: Timer,
    strokes_sent: u64,
    // New sculpt features
    brush_mode_add: bool, // true = add, false = subtract
    symmetry_x: bool,
    subdivision_level: u32,
    /// Pending primitive to spawn (set by egui, consumed by follow_master)
    pending_primitive: Option<u8>,
}

impl Default for DebugUiPanels {
    fn default() -> Self {
        let strokes_per_sec = 8.0;
        Self {
            sandbox_open: false,
            sculpt_open: false,
            sandbox_slider: 0.5,
            sandbox_text: "hello egui".to_string(),
            brush_tool: 0,
            brush_radius: 0.35,
            brush_intensity: 0.6,
            cursor_ndc: Vec2::ZERO,
            use_delta: false,
            delta_ndc: Vec2::new(0.05, 0.0),
            auto_stroke: false,
            strokes_per_sec,
            auto_timer: Timer::from_seconds(1.0 / strokes_per_sec, TimerMode::Repeating),
            strokes_sent: 0,
            // New sculpt features
            brush_mode_add: true,
            symmetry_x: false,
            subdivision_level: 0,
            pending_primitive: None,
        }
    }
}

/// Write a signal file to request Simple mode switch
/// Tauri will poll for this file and switch modes when it exists
fn request_simple_mode() {
    use std::fs;
    let signal_path = std::env::temp_dir().join("kos_simple_mode.signal");
    let _ = fs::write(&signal_path, "1");
    info!("📤 Requested Simple mode (signal file: {:?})", signal_path);
}

// =============================================================================
// BEVY-FIRST ARCHITECTURE: Tauri Overlay Launch
// =============================================================================

/// Launch Tauri as a transparent overlay on top of Bevy
/// Called during Bevy startup after window is created
fn launch_tauri_overlay() {
    use std::path::PathBuf;
    use std::process::Command;

    std::thread::spawn(|| {
        info!("🚀 Launching Tauri overlay...");

        // Find project root by looking for package.json
        let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

        // Try current dir, then parent, then grandparent
        let project_root = if cwd.join("package.json").exists() {
            cwd
        } else if cwd
            .parent()
            .map(|p| p.join("package.json").exists())
            .unwrap_or(false)
        {
            cwd.parent().unwrap().to_path_buf()
        } else if cwd.join("..").join("..").join("package.json").exists() {
            cwd.join("..").join("..")
        } else {
            // Fallback: assume we're in K_OSNew
            PathBuf::from("C:\\Users\\Admin\\Desktop\\K_OSNew")
        };

        // On Windows, npm is actually npm.cmd
        #[cfg(windows)]
        let npm = "npm.cmd";
        #[cfg(not(windows))]
        let npm = "npm";

        let mut cmd = Command::new(npm);
        cmd.args(["run", "tauri", "dev"]);
        cmd.current_dir(&project_root);

        info!("📁 Running from: {:?}", project_root);

        match cmd.spawn() {
            Ok(_) => info!("✅ Tauri overlay launched successfully"),
            Err(e) => error!(
                "❌ Failed to launch Tauri overlay: {} (tried {:?})",
                e, project_root
            ),
        }
    });
}

/// Resource to track last reported window position (for deduplication)
#[derive(Resource, Default)]
struct LastWindowPosition {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

/// System that reports Bevy window position to Tauri overlay
/// Bevy is now the source of truth - Tauri follows
fn report_window_position(
    windows: Query<&Window, With<PrimaryWindow>>,
    sender: Option<Res<LeashSender>>,
    mut last_pos: ResMut<LastWindowPosition>,
) {
    let Some(window) = windows.iter().next() else {
        return;
    };
    let Some(sender) = sender else { return };

    // Get window position and size
    let (x, y) = match window.position {
        bevy::window::WindowPosition::At(p) => (p.x, p.y),
        _ => {
            // If the window position is Centered or Automatic, Bevy might not have
            // updated it to 'At' yet. We can't easily get the physical position
            // without winit access here, so we'll just skip reporting until it becomes 'At'.
            // Alternatively, we could force it to 'At' if we want to drive it.
            return;
        }
    };
    let width = window.resolution.physical_width();
    let height = window.resolution.physical_height();

    // Only send if changed (reduce IPC noise)
    if x != last_pos.x || y != last_pos.y || width != last_pos.width || height != last_pos.height {
        sender.0.send_window_moved(x, y, width, height);
        last_pos.x = x;
        last_pos.y = y;
        last_pos.width = width;
        last_pos.height = height;
    }
}

/// K_OS Top Bar - DISABLED (using React overlay instead)
/// This is a no-op stub - React handles all UI now
fn kos_topbar_system(
    _contexts: EguiContexts,
    _active_tool: ResMut<ActiveTool>,
    _debug_ui: Res<DebugUiState>,
) -> Result {
    // egui UI disabled - React handles all UI now
    Ok(())
}

fn game_runtime_diagnostics_ui_system(
    mut contexts: EguiContexts,
    debug_ui: Res<DebugUiState>,
    runtime_debug: GameRuntimeDebugCtx,
) -> Result {
    if !debug_ui.enabled {
        return Ok(());
    }

    let ctx = contexts.ctx_mut()?;
    egui::Window::new("Game Runtime")
        .default_open(true)
        .resizable(true)
        .show(ctx, |ui| {
            if let Some(bootstrap_state) = runtime_debug.bootstrap_state.as_deref() {
                ui.label(format!(
                    "Bootstrap: enabled={} completed={} stages={}/{} registry_loaded={} registry_errors={}",
                    bootstrap_state.enabled,
                    bootstrap_state.completed,
                    bootstrap_state.stage_total.saturating_sub(bootstrap_state.stage_failed),
                    bootstrap_state.stage_total,
                    bootstrap_state.registry_loaded,
                    bootstrap_state.registry_errors
                ));
                if let Some(error) = &bootstrap_state.error {
                    ui.colored_label(egui::Color32::RED, format!("Bootstrap error: {error}"));
                }
            } else {
                ui.label("Bootstrap: pending");
            }

            if let Some(readiness_state) = runtime_debug.readiness_state.as_deref() {
                ui.label(format!(
                    "Readiness: {} | {}",
                    readiness_state.status, readiness_state.detail
                ));
            }
            if let Some(ai_state) = runtime_debug.ai_state.as_deref() {
                ui.label(format!(
                    "AI: {} agents={} issues={}",
                    ai_state.status,
                    ai_state.agent_ids.len(),
                    ai_state.issues.len()
                ));
            }
            if let Some(ai_decision_state) = runtime_debug.ai_decision_state.as_deref() {
                ui.label(format!(
                    "AI Tick: phase={} tick={} decisions={}",
                    ai_decision_state.active_phase,
                    ai_decision_state.tick_index,
                    ai_decision_state.agent_decisions.len()
                ));
            }
            if let Some(action_bindings) = runtime_debug.action_bindings.as_deref() {
                ui.label(format!(
                    "Actions: {} projected={} routes={}",
                    action_bindings.status,
                    action_bindings.agent_actions.len(),
                    action_bindings.routes_loaded
                ));
            }
            if let Some(camera_dispatch_state) = runtime_debug.camera_dispatch_state.as_deref() {
                ui.label(format!(
                    "Camera Dispatch: {} rig={} routes={} track={}",
                    camera_dispatch_state.status,
                    camera_dispatch_state.active_rig.as_deref().unwrap_or("none"),
                    camera_dispatch_state.routes_loaded,
                    camera_dispatch_state.selected_track_id.as_deref().unwrap_or("none")
                ));
            }
            if let Some(camera_state) = runtime_debug.camera_state.as_deref() {
                ui.label(format!(
                    "Camera: {} rig={} detail={}",
                    camera_state.status,
                    camera_state.active_rig.as_deref().unwrap_or("none"),
                    camera_state.detail
                ));
            }
            if let Some(sequencer_state) = runtime_debug.sequencer_state.as_deref() {
                ui.label(format!(
                    "Sequencer: {} timeline={} routes={} events={}",
                    sequencer_state.status,
                    sequencer_state.active_timeline.as_deref().unwrap_or("none"),
                    sequencer_state.routes_loaded,
                    sequencer_state.pending_events.len()
                ));
            }
            if let Some(dispatch_state) = runtime_debug.sequencer_dispatch_state.as_deref() {
                ui.label(format!(
                    "Sequencer Dispatch: {} tracks={} events={} routes={}",
                    dispatch_state.status,
                    dispatch_state.tracks_loaded,
                    dispatch_state.events_emitted,
                    dispatch_state.routes_loaded
                ));
            }
            if let Some(input_state) = runtime_debug.input_state.as_deref() {
                ui.label(format!(
                    "Input: {} mappings={} gated={} camera_mode={}",
                    input_state.status,
                    input_state.agent_input_actions.len(),
                    input_state.agent_gates.len(),
                    input_state.active_camera_mode.as_deref().unwrap_or("default")
                ));
            }
            if let Some(intent_state) = runtime_debug.intent_state.as_deref() {
                ui.label(format!(
                    "Intents: {} frame={} agents={}",
                    intent_state.status,
                    intent_state.frame_index,
                    intent_state.agent_intents.len()
                ));
            }
            if let Some(command_state) = runtime_debug.command_state.as_deref() {
                ui.label(format!(
                    "Execution: {} frame={} commands={} routes={}",
                    command_state.status,
                    command_state.frame_index,
                    command_state.agent_commands.len(),
                    command_state.routes_loaded
                ));
            }
            if let Some(application_state) = runtime_debug.execution_application_state.as_deref() {
                ui.label(format!(
                    "Execution Apply: {} frame={} applied={} steps={}",
                    application_state.status,
                    application_state.frame_index,
                    application_state.agent_applications.len(),
                    application_state.applied_steps
                ));
            }

            ui.separator();
            for (anchor, transform, motion) in runtime_debug.agent_q.iter() {
                let (last_linear, last_angular, last_frame) = motion
                    .map(|motion| (motion.last_linear, motion.last_angular, motion.last_frame))
                    .unwrap_or((Vec3::ZERO, Vec3::ZERO, 0));
                ui.label(format!(
                    "{} pos=({:.2}, {:.2}, {:.2}) linear=({:.2}, {:.2}, {:.2}) angular=({:.2}, {:.2}, {:.2}) frame={}",
                    anchor.agent_id,
                    transform.translation.x,
                    transform.translation.y,
                    transform.translation.z,
                    last_linear.x,
                    last_linear.y,
                    last_linear.z,
                    last_angular.x,
                    last_angular.y,
                    last_angular.z,
                    last_frame
                ));
            }
        });

    Ok(())
}

fn main() {
    // Check for --standalone flag
    let args: Vec<String> = std::env::args().collect();
    let standalone_mode = args.iter().any(|arg| arg == "--standalone" || arg == "-s");

    if standalone_mode {
        info!("🚀 Starting in STANDALONE mode (--standalone flag detected)");
        run_standalone();
        return;
    }

    // Start The Leash listener
    // LeashDog::new() returns Result<LeashDog, std::io::Error>
    let dog = match LeashDog::new() {
        Ok(d) => d,
        Err(e) => {
            eprintln!("⚠️ Failed to start Leash listener: {}", e);
            eprintln!("   Bevy will run standalone (no Tauri sync)");
            // Run without leash if binding fails
            run_standalone();
            return;
        }
    };

    // Reverse channel sender
    let sender = match LeashResponseSender::new() {
        Ok(s) => {
            info!("✅ Reverse Leash sender ready (Bevy -> Tauri)");
            Some(s)
        }
        Err(e) => {
            warn!(
                "⚠️ Failed to create Reverse Leash sender: {} - Ctrl+Space won't forward to React",
                e
            );
            None
        }
    };

    let mut app = App::new();
    // Leash host mode:
    // Tauri owns the shell and React overlay, while this window stays hidden
    // until the frontend syncs it to a transparent viewport hole.
    let asset_path = workspace_assets_dir();

    app.add_plugins(
        DefaultPlugins
            .set(WindowPlugin {
                primary_window: Some(Window {
                    title: "K_OS".into(),
                    resolution: WindowResolution::new(1, 1),
                    decorations: false, // Treat the host like a shell-owned viewport surface
                    window_level: WindowLevel::Normal,
                    present_mode: bevy::window::PresentMode::AutoNoVsync,
                    transparent: false, // Tauri provides the transparent hole; Bevy stays fully opaque
                    visible: false,      // Wait until Tauri syncs bounds before mapping
                    skip_taskbar: true, // Treat the leash window like a viewport surface, not a second app
                    resizable: true,
                    ..default()
                }),
                ..default()
            })
            .set(AssetPlugin {
                file_path: asset_path.to_string_lossy().into_owned(),
                ..default()
            }),
    )
    .add_plugins(FrameTimeDiagnosticsPlugin::default())
    .add_plugins(EguiPlugin::default())
    .add_plugins(PanOrbitCameraPlugin)
    .add_plugins(UniversalViewportPlugin)
    // .add_plugins(UiSurfacesPlugin)  // Disabled - React handles all UI
    .insert_resource(LeashReceiver { dog });

    if let Some(s) = sender {
        app.insert_resource(LeashSender(s));
    }

    app.insert_resource(DebugUiState::default())
        .insert_resource(DebugUiPanels::default())
        .insert_resource(GameRuntimeRegistryBindings::default())
        .insert_resource(GameRuntimeActionBindings::default())
        .insert_resource(GameInputRuntimeState::default())
        .insert_resource(GameHostInputFrame::default())
        .insert_resource(GameInputIntentState::default())
        .insert_resource(GameExecutionCommandState::default())
        .insert_resource(GameExecutionApplicationState::default())
        .insert_resource(GameExecutionEffectsState::default())
        .insert_resource(GameExecutionTransportState::default())
        .insert_resource(GameExecutionTransportBackendState::default())
        .insert_resource(GameCameraDispatchState::default())
        .insert_resource(GameCameraRuntimeState::default())
        .insert_resource(GameCameraViewRuntimeState::default())
        .insert_resource(GameSequencerRuntimeState::default())
        .insert_resource(GameSequencerTrackDispatchState::default())
        .insert_resource(RuntimeReadinessState::default())
        .insert_resource(GameAiRuntimeState::default())
        .insert_resource(GameAiDecisionRuntimeState::default())
        .insert_resource(LastWindowPosition::default()) // Track window position for deduplication
        .add_message::<GamePipelineStartupEvent>()
        // .add_message::<SpawnModelEvent>()
        .add_message::<SpawnPrimitiveEvent>()
        .add_systems(Startup, (bootstrap_game_pipeline, setup_scene).chain())
        .add_systems(Update, follow_master)
        .add_systems(Update, handle_spawn_primitive)
        .add_systems(Update, log_game_pipeline_startup_events)
        .add_systems(Update, reconcile_game_pipeline_runtime_state)
        .add_systems(Update, reconcile_game_pipeline_ai_state)
        .add_systems(Update, reconcile_game_pipeline_ai_decision_state)
        .add_systems(
            Update,
            reconcile_game_pipeline_action_state.after(reconcile_game_pipeline_ai_decision_state),
        )
        .add_systems(
            Update,
            reconcile_game_pipeline_sequencer_state.after(reconcile_game_pipeline_action_state),
        )
        .add_systems(
            Update,
            reconcile_game_pipeline_sequencer_dispatch_state
                .after(reconcile_game_pipeline_sequencer_state),
        )
        .add_systems(
            Update,
            reconcile_game_pipeline_camera_dispatch_state
                .after(reconcile_game_pipeline_sequencer_dispatch_state),
        )
        .add_systems(
            Update,
            reconcile_game_pipeline_camera_state
                .after(reconcile_game_pipeline_camera_dispatch_state),
        )
        .add_systems(
            Update,
            reconcile_game_pipeline_camera_view_state.after(reconcile_game_pipeline_camera_state),
        )
        .add_systems(
            Update,
            apply_game_pipeline_camera_view_state.after(reconcile_game_pipeline_camera_view_state),
        )
        .add_systems(
            Update,
            reconcile_game_pipeline_input_state.after(apply_game_pipeline_camera_view_state),
        )
        .add_systems(
            Update,
            capture_game_host_input_frame.after(reconcile_game_pipeline_input_state),
        )
        .add_systems(
            Update,
            reconcile_game_pipeline_input_intents.after(capture_game_host_input_frame),
        )
        .add_systems(
            Update,
            reconcile_game_pipeline_execution_commands.after(reconcile_game_pipeline_input_intents),
        )
        .add_systems(
            Update,
            reconcile_game_pipeline_execution_application
                .after(reconcile_game_pipeline_execution_commands),
        )
        .add_systems(
            Update,
            reconcile_game_pipeline_execution_effects
                .after(reconcile_game_pipeline_execution_application),
        )
        .add_systems(
            Update,
            reconcile_game_pipeline_execution_transport
                .after(reconcile_game_pipeline_execution_effects),
        )
        .add_systems(
            Update,
            reconcile_game_pipeline_execution_transport_backends
                .after(reconcile_game_pipeline_execution_transport),
        )
        .add_systems(
            Update,
            apply_game_pipeline_execution_commands
                .after(reconcile_game_pipeline_execution_transport_backends),
        )
        .add_systems(Update, debug_sculpt_auto_stroke_system)
        .add_systems(Update, spawn_egui_primitives)
        .add_systems(Update, handle_shortcuts)
        .add_systems(Update, heartbeat_system)
        .add_systems(Update, report_window_position)
        .add_systems(EguiPrimaryContextPass, kos_topbar_system)
        .add_systems(EguiPrimaryContextPass, game_runtime_diagnostics_ui_system)
        .add_plugins(SculptPlugin)
        // .add_plugins(SculptUiPlugin)  // Disabled - React handles sculpt UI
        // .add_plugins(AssetBrowserPlugin)
        .add_plugins(GpuDeviceBridgePlugin)
        .run();
}

/// Standalone mode - Full K_OS experience with MOVABLE window + Leash IPC
/// Use: cargo run --bin k-os-bevy -- --standalone
///
/// Features:
/// - Window has decorations (movable/resizable)
/// - Window starts visible
/// - Leash IPC still active - Tauri can connect later!
fn run_standalone() {
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║  K_OS BEVY - STANDALONE MODE                                 ║");
    println!("║  Window is movable + Leash IPC still active!                 ║");
    println!("║  You can launch Tauri later and it will connect.             ║");
    println!("╚══════════════════════════════════════════════════════════════╝");

    // Start Leash listener (same as normal mode)
    let dog = match LeashDog::new() {
        Ok(d) => {
            println!("✓ Leash IPC ready - Tauri can connect");
            Some(d)
        }
        Err(e) => {
            println!("⚠ Leash unavailable: {} (running pure standalone)", e);
            None
        }
    };

    let asset_path = workspace_assets_dir();
    let mut app = App::new();

    app.add_plugins(
        DefaultPlugins
            .set(WindowPlugin {
                primary_window: Some(Window {
                    title: "K_OS Viewport (Standalone)".into(),
                    resolution: WindowResolution::new(1600, 900),
                    decorations: true, // Show window decorations (movable/resizable!)
                    visible: true,     // Start visible immediately
                    ..default()
                }),
                ..default()
            })
            .set(AssetPlugin {
                file_path: asset_path.to_string_lossy().into_owned(),
                ..default()
            }),
    )
    .add_plugins(FrameTimeDiagnosticsPlugin::default())
    .add_plugins(EguiPlugin::default())
    .add_plugins(PanOrbitCameraPlugin)
    .add_plugins(UniversalViewportPlugin)
    .insert_resource(DebugUiState::default())
    .insert_resource(DebugUiPanels::default())
    .insert_resource(GameRuntimeRegistryBindings::default())
    .insert_resource(GameRuntimeActionBindings::default())
    .insert_resource(GameInputRuntimeState::default())
    .insert_resource(GameHostInputFrame::default())
    .insert_resource(GameInputIntentState::default())
    .insert_resource(GameExecutionCommandState::default())
    .insert_resource(GameExecutionApplicationState::default())
    .insert_resource(GameExecutionEffectsState::default())
    .insert_resource(GameExecutionTransportState::default())
    .insert_resource(GameExecutionTransportBackendState::default())
    .insert_resource(GameCameraDispatchState::default())
    .insert_resource(GameCameraRuntimeState::default())
    .insert_resource(GameCameraViewRuntimeState::default())
    .insert_resource(GameSequencerRuntimeState::default())
    .insert_resource(GameSequencerTrackDispatchState::default())
    .insert_resource(RuntimeReadinessState::default())
    .insert_resource(GameAiRuntimeState::default())
    .insert_resource(GameAiDecisionRuntimeState::default())
    .add_message::<GamePipelineStartupEvent>()
    // .add_message::<SpawnModelEvent>()
    .add_message::<SpawnPrimitiveEvent>()
    .add_systems(Startup, (bootstrap_game_pipeline, setup_scene).chain())
    .add_systems(Update, log_game_pipeline_startup_events)
    .add_systems(Update, reconcile_game_pipeline_runtime_state)
    .add_systems(Update, reconcile_game_pipeline_ai_state)
    .add_systems(Update, reconcile_game_pipeline_ai_decision_state)
    .add_systems(
        Update,
        reconcile_game_pipeline_action_state.after(reconcile_game_pipeline_ai_decision_state),
    )
    .add_systems(
        Update,
        reconcile_game_pipeline_sequencer_state.after(reconcile_game_pipeline_action_state),
    )
    .add_systems(
        Update,
        reconcile_game_pipeline_sequencer_dispatch_state
            .after(reconcile_game_pipeline_sequencer_state),
    )
    .add_systems(
        Update,
        reconcile_game_pipeline_camera_dispatch_state
            .after(reconcile_game_pipeline_sequencer_dispatch_state),
    )
    .add_systems(
        Update,
        reconcile_game_pipeline_camera_state.after(reconcile_game_pipeline_camera_dispatch_state),
    )
    .add_systems(
        Update,
        reconcile_game_pipeline_camera_view_state.after(reconcile_game_pipeline_camera_state),
    )
    .add_systems(
        Update,
        apply_game_pipeline_camera_view_state.after(reconcile_game_pipeline_camera_view_state),
    )
    .add_systems(
        Update,
        reconcile_game_pipeline_input_state.after(apply_game_pipeline_camera_view_state),
    )
    .add_systems(
        Update,
        capture_game_host_input_frame.after(reconcile_game_pipeline_input_state),
    )
    .add_systems(
        Update,
        reconcile_game_pipeline_input_intents.after(capture_game_host_input_frame),
    )
    .add_systems(
        Update,
        reconcile_game_pipeline_execution_commands.after(reconcile_game_pipeline_input_intents),
    )
    .add_systems(
        Update,
        reconcile_game_pipeline_execution_application
            .after(reconcile_game_pipeline_execution_commands),
    )
    .add_systems(
        Update,
        reconcile_game_pipeline_execution_effects
            .after(reconcile_game_pipeline_execution_application),
    )
    .add_systems(
        Update,
        reconcile_game_pipeline_execution_transport
            .after(reconcile_game_pipeline_execution_effects),
    )
    .add_systems(
        Update,
        reconcile_game_pipeline_execution_transport_backends
            .after(reconcile_game_pipeline_execution_transport),
    )
    .add_systems(
        Update,
        apply_game_pipeline_execution_commands
            .after(reconcile_game_pipeline_execution_transport_backends),
    )
    .add_systems(EguiPrimaryContextPass, kos_topbar_system)
    .add_systems(EguiPrimaryContextPass, game_runtime_diagnostics_ui_system)
    .add_plugins(SculptPlugin)
    // .add_plugins(SculptUiPlugin)  // Disabled - React handles sculpt UI
    // .add_plugins(AssetBrowserPlugin)
    .add_plugins(GpuDeviceBridgePlugin);

    // Add Leash systems if available
    if let Some(d) = dog {
        app.insert_resource(LeashReceiver { dog: d })
            .add_systems(Update, follow_master)
            .add_systems(Update, handle_spawn_primitive)
            .add_systems(Update, debug_sculpt_auto_stroke_system)
            .add_systems(Update, spawn_egui_primitives);
    } else {
        // Pure standalone - no Leash systems
        app.add_systems(Update, handle_spawn_primitive)
            .add_systems(Update, debug_sculpt_auto_stroke_system)
            .add_systems(Update, spawn_egui_primitives);
    }

    app.run();
}

/// Periodic heartbeat to let Tauri know Bevy is alive and ready
fn heartbeat_system(
    sender: Option<Res<LeashSender>>,
    time: Res<Time>,
    mut timer: Local<Timer>,
    diagnostics: Res<DiagnosticsStore>,
    sculpt_q: Query<&SculptData, With<SculptModel>>,
) {
    // Initialize timer on first run
    if timer.duration().as_secs_f32() == 0.0 {
        *timer = Timer::from_seconds(1.0, TimerMode::Repeating);
    }

    if timer.tick(time.delta()).just_finished() {
        if let Some(s) = sender {
            let fps = diagnostics
                .get(&FrameTimeDiagnosticsPlugin::FPS)
                .and_then(|d| d.smoothed())
                .unwrap_or(0.0) as f32;

            let mut total_verts = 0;
            let mut total_faces = 0;

            for data in sculpt_q.iter() {
                // Approximate from SculptData handles if possible,
                // but 0 is fine for heartbeat
                total_verts += 0;
                total_faces += 0;
            }

            s.0.send(LeashResponse::Status {
                vertex_count: total_verts as u32,
                face_count: total_faces as u32,
                fps,
            });
        }
    }
}

/// System that makes Bevy window follow Tauri master

#[derive(SystemParam)]
struct FollowMasterCtx<'w, 's> {
    commands: Commands<'w, 's>,
    debug_ui: ResMut<'w, DebugUiState>,
    time: Res<'w, Time>,
    telemetry: ResMut<'w, InputTelemetry>,
    cursor_events: MessageWriter<'w, CursorMovedEvent>,
    camera_q: Query<'w, 's, (&'static mut Transform, &'static PanOrbitCamera), With<Camera>>,
    brush_events: MessageWriter<'w, BrushStrokeEvent>,
    undo_events: MessageWriter<'w, UndoEvent>,
    redo_events: MessageWriter<'w, RedoEvent>,
    snapshot_events: MessageWriter<'w, SnapshotEvent>,
    spawn_primitive_events: MessageWriter<'w, SpawnPrimitiveEvent>,
    import_events: MessageWriter<'w, ImportGltfEvent>,
    meshes: ResMut<'w, Assets<Mesh>>,
    materials: ResMut<'w, Assets<StandardMaterial>>,
    existing_sculpt: Query<'w, 's, Entity, With<SculptModel>>,
}

#[derive(SystemParam)]
struct GameRuntimeDebugCtx<'w, 's> {
    bootstrap_state: Option<Res<'w, GamePipelineBootstrapState>>,
    readiness_state: Option<Res<'w, RuntimeReadinessState>>,
    ai_state: Option<Res<'w, GameAiRuntimeState>>,
    ai_decision_state: Option<Res<'w, GameAiDecisionRuntimeState>>,
    action_bindings: Option<Res<'w, GameRuntimeActionBindings>>,
    camera_dispatch_state: Option<Res<'w, GameCameraDispatchState>>,
    camera_state: Option<Res<'w, GameCameraRuntimeState>>,
    sequencer_state: Option<Res<'w, GameSequencerRuntimeState>>,
    sequencer_dispatch_state: Option<Res<'w, GameSequencerTrackDispatchState>>,
    input_state: Option<Res<'w, GameInputRuntimeState>>,
    intent_state: Option<Res<'w, GameInputIntentState>>,
    command_state: Option<Res<'w, GameExecutionCommandState>>,
    execution_application_state: Option<Res<'w, GameExecutionApplicationState>>,
    execution_effects_state: Option<Res<'w, GameExecutionEffectsState>>,
    execution_transport_state: Option<Res<'w, GameExecutionTransportState>>,
    execution_transport_backend_state: Option<Res<'w, GameExecutionTransportBackendState>>,
    agent_q: Query<
        'w,
        's,
        (
            &'static GameRuntimeAgentAnchor,
            &'static Transform,
            Option<&'static GameRuntimeAgentMotion>,
        ),
    >,
}

fn follow_master(
    leash: Res<LeashReceiver>,
    mut windows: Query<&mut Window, With<PrimaryWindow>>,
    mut exit: MessageWriter<AppExit>,
    mut ctx: FollowMasterCtx,
) {
    // Process all pending messages

    for msg in leash.dog.drain_messages() {
        ctx.telemetry.last_source = Some(InputSource::ReactLeash);
        ctx.telemetry.last_leash_input_s = ctx.time.elapsed_secs_f64();

        match msg {
            LeashMessage::WindowMove {
                x,
                y,
                width,
                height,
            } => {
                for mut window in windows.iter_mut() {
                    window.position = bevy::window::WindowPosition::At(IVec2::new(x, y));
                    window.resolution.set(width as f32, height as f32);
                }
            }
            LeashMessage::SetVisible(visible) => {
                info!("🔭 Bevy received SetVisible: {}", visible);
                for mut window in windows.iter_mut() {
                    window.visible = visible;
                    info!("🔭 Window visibility set to: {}", visible);
                }
            }
            LeashMessage::CursorMoved { x, y } => {
                // info!("Msg: Cursor {:.2} {:.2}", x, y);
                ctx.cursor_events.write(CursorMovedEvent(Vec2::new(x, y)));
            }
            LeashMessage::CameraRotate { dx, dy } => {
                // Manual Orbit Implementation
                // Bypass PanOrbitCamera input injection which fails when unfocused
                for (mut transform, _pan) in ctx.camera_q.iter_mut() {
                    let sensitivity = 0.005;
                    let delta_x = -dx * sensitivity;
                    let delta_y = -dy * sensitivity;

                    // Orbit around 0,0,0 (Sphere Center)
                    let _radius = transform.translation.length();

                    // Simple orbit around Y axis first
                    // We need to maintain "up" vector to avoid roll?
                    // Let's use a simplified LookAt approach.
                    // 1. Get current position relative to target logic?
                    // Let's just rotate the translation vector.

                    let mut pos = transform.translation;

                    // Rotate around Y (Yaw)
                    let rot_y = Quat::from_rotation_y(delta_x);
                    pos = rot_y * pos;

                    // Rotate around Local X (Pitch) - Tricky without gimbal lock?
                    // Get 'right' vector from look_at
                    let forward = -pos.normalize();
                    let right = forward.cross(Vec3::Y).normalize();
                    let rot_x = Quat::from_axis_angle(right, delta_y);
                    pos = rot_x * pos;

                    transform.translation = pos;
                    transform.look_at(Vec3::ZERO, Vec3::Y);
                }
            }
            LeashMessage::BrushStroke {
                tool,
                radius,
                intensity,
                x,
                y,
                dx,
                dy,
            } => {
                ctx.brush_events.write(BrushStrokeEvent {
                    tool,
                    kernel: None, // Legacy Leash input doesn't send kernel name yet
                    radius,
                    intensity,
                    cursor_ndc: Vec2::new(x, y),
                    delta_ndc: Some(Vec2::new(dx, dy)),
                });
            }
            LeashMessage::Undo => {
                ctx.undo_events.write(UndoEvent);
            }
            LeashMessage::Redo => {
                ctx.redo_events.write(RedoEvent);
            }
            LeashMessage::Snapshot => {
                ctx.snapshot_events.write(SnapshotEvent);
            }
            LeashMessage::CameraZoom { delta } => {
                // Manual Zoom: Adjust distance from origin
                for (mut transform, _pan) in ctx.camera_q.iter_mut() {
                    let direction = transform.translation.normalize();
                    let current_distance = transform.translation.length();
                    // Zoom sensitivity (higher = more zoom per wheel tick)
                    let zoom_speed = 0.1;
                    let new_distance = (current_distance - delta * zoom_speed).clamp(2.5, 50.0);
                    transform.translation = direction * new_distance;
                }
            }
            LeashMessage::LoadModel { path } => {
                // Use the more robust ImportGltfEvent instead of the basic SpawnModelEvent
                ctx.import_events.write(ImportGltfEvent {
                    path,
                    position: Vec3::ZERO,
                });
            }
            LeashMessage::LoadViewportPayload { path } => {
                match std::fs::read(&path)
                    .ok()
                    .and_then(|bytes| serde_json::from_slice::<NativeViewportPayload>(&bytes).ok())
                {
                    Some(payload) => {
                        for entity in ctx.existing_sculpt.iter() {
                            ctx.commands.entity(entity).despawn();
                        }

                        let mut mesh = Mesh::new(
                            bevy::mesh::PrimitiveTopology::TriangleList,
                            bevy::asset::RenderAssetUsages::default(),
                        );
                        let positions: Vec<[f32; 3]> = payload
                            .positions
                            .chunks_exact(3)
                            .map(|chunk| [chunk[0], chunk[1], chunk[2]])
                            .collect();
                        let normals: Vec<[f32; 3]> = payload
                            .normals
                            .chunks_exact(3)
                            .map(|chunk| [chunk[0], chunk[1], chunk[2]])
                            .collect();
                        mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions);
                        if !normals.is_empty() {
                            mesh.insert_attribute(Mesh::ATTRIBUTE_NORMAL, normals);
                        }
                        mesh.insert_indices(bevy::mesh::Indices::U32(payload.indices));

                        let mesh_handle = ctx.meshes.add(mesh);
                        let material = ctx.materials.add(StandardMaterial {
                            base_color: Color::srgb(0.72, 0.73, 0.78),
                            perceptual_roughness: 0.72,
                            ..default()
                        });

                        ctx.commands.spawn((
                            Mesh3d(mesh_handle),
                            MeshMaterial3d(material),
                            LayerObjectBundle::new("NativeViewportMesh"),
                            crate::viewport::Selectable::default(),
                            SculptModel,
                            Transform::from_xyz(0.0, 0.0, 0.0),
                        ));
                    }
                    None => {
                        warn!("Failed to decode native viewport payload from {}", path);
                    }
                }
            }
            LeashMessage::SetSymmetry { axis } => {
                info!(
                    "🔄 Symmetry mode: {}",
                    match axis {
                        0 => "None",
                        1 => "X",
                        2 => "Y",
                        3 => "Z",
                        _ => "Unknown",
                    }
                );
                // TODO: Store symmetry state in a Resource and use in brush system
            }
            LeashMessage::SetWireframe { enabled } => {
                info!("📐 Wireframe: {}", enabled);
                // TODO: Toggle wireframe material on all SculptModel entities
            }
            LeashMessage::LoadPrimitive { primitive_type } => {
                ctx.spawn_primitive_events
                    .write(SpawnPrimitiveEvent { primitive_type });
            }
            LeashMessage::SpawnAsset {
                asset_type,
                id,
                position,
            } => {
                let pos = Vec3::from_array(position);
                if asset_type == "mesh" {
                    ctx.import_events.write(ImportGltfEvent {
                        path: id,
                        position: pos,
                    });
                } else if asset_type == "primitive" {
                    let p_type = match id.to_lowercase().as_str() {
                        "sphere" => 0,
                        "cube" => 1,
                        "cylinder" => 2,
                        "torus" => 3,
                        "plane" => 4,
                        "icosa" | "icosphere" => 5,
                        _ => 0,
                    };
                    ctx.spawn_primitive_events.write(SpawnPrimitiveEvent {
                        primitive_type: p_type,
                    });
                }
            }
            LeashMessage::SetDebugUi { enabled } => {
                ctx.debug_ui.enabled = enabled;
            }
            LeashMessage::SetEguiOnly { enabled } => {
                // When egui-only mode is active, bring Bevy window to front so it receives
                // click-through input from Tauri. When disabled, go back to Normal.
                for mut window in windows.iter_mut() {
                    window.window_level = if enabled {
                        bevy::window::WindowLevel::AlwaysOnTop
                    } else {
                        bevy::window::WindowLevel::Normal
                    };
                }
                // Also enable debug UI when entering egui-only mode
                if enabled {
                    ctx.debug_ui.enabled = true;
                }
            }
            LeashMessage::Shutdown => {
                info!("🛑 Received shutdown from Tauri master");
                exit.write(AppExit::Success);
            }
            LeashMessage::SyncKernelStorage { .. } | LeashMessage::ToggleAssetBrowser => {}

            // Layer operations (handled via layer panel commands)
            LeashMessage::SelectEntity {
                entity,
                add_to_selection,
            } => {
                info!("🎯 Select entity {} (add: {})", entity, add_to_selection);
                // TODO: Trigger SelectObjectEvent with the entity
            }
            LeashMessage::ToggleEntityVisibility { entity } => {
                info!("👁️ Toggle visibility for entity {}", entity);
                // TODO: Trigger ToggleVisibilityEvent with the entity
            }
            LeashMessage::ToggleEntityLock { entity } => {
                info!("🔒 Toggle lock for entity {}", entity);
                // TODO: Trigger ToggleLockEvent with the entity
            }
            LeashMessage::DeleteEntity { entity } => {
                if entity == 0xFFFFFFFF {
                    info!("🗑️ Delete selected objects");
                    // TODO: Delete all selected objects
                } else {
                    info!("🗑️ Delete entity {}", entity);
                    // TODO: Trigger DeleteLayerEvent with the entity
                }
            }
            LeashMessage::RenameEntity { entity, name } => {
                info!("✏️ Rename entity {} to '{}'", entity, name);
                // TODO: Update LayerInfo.name for the entity
            }
        }
    }
}

/// System to spawn primitives requested from egui buttons
fn spawn_egui_primitives(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut panels: ResMut<DebugUiPanels>,
    mut selection_state: ResMut<SelectionState>,
) {
    // Handle pending primitive from egui buttons
    if let Some(primitive_type) = panels.pending_primitive.take() {
        info!("🔷 Loading primitive type {} from egui", primitive_type);

        let mesh_data = match primitive_type {
            0 => primitive_gen::generate_quad_sphere(4),
            1 => primitive_gen::generate_quad_cube(4),
            2 => primitive_gen::generate_quad_cylinder(16, 8),
            3 => primitive_gen::generate_quad_sphere(3),
            4 => primitive_gen::generate_plane(4),
            _ => primitive_gen::generate_quad_sphere(4),
        };

        // Debug: log mesh data counts
        let vert_count = mesh_data.positions.len() / 3;
        let norm_count = mesh_data.normals.len() / 3;
        let uv_count = mesh_data.uvs.len() / 2;
        let idx_count = mesh_data.indices.len();
        info!(
            "🔷 Primitive mesh: {} verts, {} normals, {} uvs, {} indices",
            vert_count, norm_count, uv_count, idx_count
        );
        if vert_count != norm_count || vert_count != uv_count {
            warn!(
                "⚠️ MISMATCH: verts={} normals={} uvs={}",
                vert_count, norm_count, uv_count
            );
        }

        let mesh = meshes.add(mesh_from_primitive(mesh_data));

        let entity = commands
            .spawn((
                Mesh3d(mesh),
                MeshMaterial3d(materials.add(StandardMaterial {
                    base_color: Color::srgb(0.7, 0.6, 0.5),
                    perceptual_roughness: 0.5,
                    metallic: 0.0,
                    ..default()
                })),
                LayerObjectBundle::new("Primitive"),
                Transform::from_xyz(0.0, 0.0, 0.0),
            ))
            .id();

        selection_state.primary = Some(entity);
        selection_state.selection = vec![entity];
    }
}

fn debug_hud_system(
    mut contexts: EguiContexts,
    mut egui_capture: ResMut<EguiCaptureState>,
    mut panels: ResMut<DebugUiPanels>,
    mut brush_settings: ResMut<BrushSettings>,
    mut debug_ui: ResMut<DebugUiState>,
    mut active_tool: ResMut<ActiveTool>,
    diagnostics: Res<DiagnosticsStore>,
    sculpt_q: Query<(Entity, &Mesh3d, &SculptData), With<SculptModel>>,
    meshes: Res<Assets<Mesh>>,
    mut undo_events: MessageWriter<UndoEvent>,
    mut redo_events: MessageWriter<RedoEvent>,
    mut snapshot_events: MessageWriter<SnapshotEvent>,
    mut subdivide_events: MessageWriter<SubdivideEvent>,
    cursor_state: Res<SculptCursorState>,
    time: Res<Time>,
    telemetry: Res<InputTelemetry>,
    runtime_debug: GameRuntimeDebugCtx,
) -> Result {
    // Skip first 2 frames - egui panics if used before Context::run() completes
    debug_ui.frames_elapsed += 1;
    if debug_ui.frames_elapsed < 3 {
        egui_capture.wants_pointer = false;
        return Ok(());
    }

    if !debug_ui.enabled {
        egui_capture.wants_pointer = false;
        return Ok(());
    }

    // Get context - returns Result
    let ctx = contexts.ctx_mut()?;

    // Check if egui wants pointer input
    egui_capture.wants_pointer = ctx.wants_pointer_input();
    brush_settings.tool = panels.brush_tool;
    brush_settings.radius = panels.brush_radius;
    brush_settings.intensity = panels.brush_intensity;

    let fps = diagnostics
        .get(&FrameTimeDiagnosticsPlugin::FPS)
        .and_then(|d| d.smoothed())
        .unwrap_or(0.0);

    let mut total_verts: usize = 0;
    let mut total_tris: usize = 0;
    let mut rows: Vec<(Entity, usize, usize, usize)> = Vec::new();

    for (entity, mesh_handle, sculpt_data) in sculpt_q.iter() {
        let Some(mesh) = meshes.get(mesh_handle) else {
            continue;
        };

        let verts = mesh
            .attribute(Mesh::ATTRIBUTE_POSITION)
            .and_then(|attr| match attr {
                bevy::mesh::VertexAttributeValues::Float32x3(v) => Some(v.len()),
                _ => None,
            })
            .unwrap_or(0);

        let tris = mesh
            .indices()
            .map(|idx| match idx {
                bevy::mesh::Indices::U16(v) => v.len() / 3,
                bevy::mesh::Indices::U32(v) => v.len() / 3,
            })
            .unwrap_or(0);

        let undo = sculpt_data.undo_stack.len();
        total_verts += verts;
        total_tris += tris;
        rows.push((entity, verts, tris, undo));
    }

    egui::Window::new("K_OS Debug")
        .default_open(true)
        .collapsible(true)
        .resizable(true)
        .show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.label("Tool:");
                if ui
                    .selectable_label(*active_tool == ActiveTool::Viewport, "Viewport")
                    .clicked()
                {
                    *active_tool = ActiveTool::Viewport;
                }
                if ui
                    .selectable_label(*active_tool == ActiveTool::Sculpt, "Sculpt")
                    .clicked()
                {
                    *active_tool = ActiveTool::Sculpt;
                }
            });

            let now = time.elapsed_secs_f64();
            let leash_age_ms = ((now - telemetry.last_leash_input_s) * 1000.0).max(0.0);
            let bevy_age_ms = ((now - telemetry.last_bevy_local_input_s) * 1000.0).max(0.0);
            let last_src = match telemetry.last_source {
                Some(InputSource::ReactLeash) => "React/Leash",
                Some(InputSource::BevyLocal) => "BevyLocal",
                None => "None",
            };

            let cursor_age_ms = ((now - telemetry.last_bevy_cursor_s) * 1000.0).max(0.0);
            ui.label(format!(
                "Input: last={} | egui_capture={}",
                last_src, egui_capture.wants_pointer
            ));
            ui.label(format!(
                "Leash: {:.0}ms | Bevy click: {:.0}ms | Bevy cursor: {} ({:.0}ms)",
                leash_age_ms, bevy_age_ms, telemetry.bevy_has_cursor, cursor_age_ms
            ));
            ui.separator();

            ui.label(format!("FPS: {:.1}", fps));
            ui.label(format!("Sculpt meshes: {}", rows.len()));
            ui.label(format!("Total verts: {}", total_verts));
            ui.label(format!("Total tris: {}", total_tris));

            ui.separator();

            // Cursor/Raycast Debug
            ui.label(format!(
                "Cursor NDC: ({:.2}, {:.2})",
                cursor_state.position_ndc.x, cursor_state.position_ndc.y
            ));
            if let Some(hit) = cursor_state.hit_point_world {
                ui.colored_label(
                    egui::Color32::GREEN,
                    format!("Hit: ({:.2}, {:.2}, {:.2})", hit.x, hit.y, hit.z),
                );
            } else {
                ui.colored_label(egui::Color32::RED, "Hit: NONE (raycast miss)");
            }

            ui.separator();

            ui.separator();

            ui.horizontal(|ui| {
                ui.checkbox(&mut panels.sandbox_open, "Egui Sandbox");
                if *active_tool == ActiveTool::Sculpt {
                    ui.checkbox(&mut panels.sculpt_open, "Sculpt Debug");
                }
            });

            ui.collapsing("Load Primitives", |ui| {
                ui.horizontal_wrapped(|ui| {
                    if ui.button("Sphere").clicked() {
                        panels.pending_primitive = Some(0);
                    }
                    if ui.button("Cube").clicked() {
                        panels.pending_primitive = Some(1);
                    }
                    if ui.button("Cylinder").clicked() {
                        panels.pending_primitive = Some(2);
                    }
                    if ui.button("Plane").clicked() {
                        panels.pending_primitive = Some(4);
                    }
                });
            });

            ui.label(format!("Strokes sent: {}", panels.strokes_sent));

            ui.separator();

            ui.collapsing("Game Runtime", |ui| {
                if let Some(bootstrap_state) = runtime_debug.bootstrap_state.as_deref() {
                    ui.label(format!(
                        "Bootstrap: enabled={} completed={} stages={}/{} registry_loaded={} registry_errors={}",
                        bootstrap_state.enabled,
                        bootstrap_state.completed,
                        bootstrap_state.stage_total.saturating_sub(bootstrap_state.stage_failed),
                        bootstrap_state.stage_total,
                        bootstrap_state.registry_loaded,
                        bootstrap_state.registry_errors
                    ));
                    if let Some(error) = &bootstrap_state.error {
                        ui.colored_label(egui::Color32::RED, format!("Bootstrap error: {error}"));
                    }
                } else {
                    ui.label("Bootstrap: pending");
                }

                if let Some(readiness_state) = runtime_debug.readiness_state.as_deref() {
                    ui.label(format!(
                        "Readiness: {} | {}",
                        readiness_state.status, readiness_state.detail
                    ));
                }
                if let Some(ai_state) = runtime_debug.ai_state.as_deref() {
                    ui.label(format!(
                        "AI: {} agents={} issues={}",
                        ai_state.status,
                        ai_state.agent_ids.len(),
                        ai_state.issues.len()
                    ));
                }
                if let Some(ai_decision_state) = runtime_debug.ai_decision_state.as_deref() {
                    ui.label(format!(
                        "AI Tick: phase={} tick={} decisions={}",
                        ai_decision_state.active_phase,
                        ai_decision_state.tick_index,
                        ai_decision_state.agent_decisions.len()
                    ));
                }
                if let Some(action_bindings) = runtime_debug.action_bindings.as_deref() {
                    ui.label(format!(
                        "Actions: {} projected={} routes={}",
                        action_bindings.status,
                        action_bindings.agent_actions.len(),
                        action_bindings.routes_loaded
                    ));
                }
                if let Some(camera_dispatch_state) = runtime_debug.camera_dispatch_state.as_deref()
                {
                    ui.label(format!(
                        "Camera Dispatch: {} rig={} routes={} track={}",
                        camera_dispatch_state.status,
                        camera_dispatch_state.active_rig.as_deref().unwrap_or("none"),
                        camera_dispatch_state.routes_loaded,
                        camera_dispatch_state.selected_track_id.as_deref().unwrap_or("none")
                    ));
                }
                if let Some(camera_state) = runtime_debug.camera_state.as_deref() {
                    ui.label(format!(
                        "Camera: {} rig={} mode-detail={}",
                        camera_state.status,
                        camera_state.active_rig.as_deref().unwrap_or("none"),
                        camera_state.detail
                    ));
                }
                if let Some(sequencer_state) = runtime_debug.sequencer_state.as_deref() {
                    ui.label(format!(
                        "Sequencer: {} timeline={} routes={} events={}",
                        sequencer_state.status,
                        sequencer_state.active_timeline.as_deref().unwrap_or("none"),
                        sequencer_state.routes_loaded,
                        sequencer_state.pending_events.len()
                    ));
                }
                if let Some(dispatch_state) = runtime_debug.sequencer_dispatch_state.as_deref() {
                    ui.label(format!(
                        "Sequencer Dispatch: {} tracks={} events={} routes={}",
                        dispatch_state.status,
                        dispatch_state.tracks_loaded,
                        dispatch_state.events_emitted,
                        dispatch_state.routes_loaded
                    ));
                }
                if let Some(input_state) = runtime_debug.input_state.as_deref() {
                    ui.label(format!(
                        "Input: {} mappings={} gated={} camera_mode={}",
                        input_state.status,
                        input_state.agent_input_actions.len(),
                        input_state.agent_gates.len(),
                        input_state.active_camera_mode.as_deref().unwrap_or("default")
                    ));
                }
                if let Some(intent_state) = runtime_debug.intent_state.as_deref() {
                    ui.label(format!(
                        "Intents: {} frame={} agents={}",
                        intent_state.status,
                        intent_state.frame_index,
                        intent_state.agent_intents.len()
                    ));
                }
                if let Some(command_state) = runtime_debug.command_state.as_deref() {
                    ui.label(format!(
                        "Execution: {} frame={} commands={} routes={}",
                        command_state.status,
                        command_state.frame_index,
                        command_state.agent_commands.len(),
                        command_state.routes_loaded
                    ));
                }
                if let Some(application_state) = runtime_debug.execution_application_state.as_deref() {
                    ui.label(format!(
                        "Execution Apply: {} frame={} applied={} steps={}",
                        application_state.status,
                        application_state.frame_index,
                        application_state.agent_applications.len(),
                        application_state.applied_steps
                    ));
                }
                if let Some(effects_state) = runtime_debug.execution_effects_state.as_deref() {
                    ui.label(format!(
                        "Execution Effects: {} events={} routes={} next_seq={}",
                        effects_state.status,
                        effects_state.events_emitted,
                        effects_state.routes_loaded,
                        effects_state.next_sequence
                    ));
                }
                if let Some(transport_state) = runtime_debug.execution_transport_state.as_deref() {
                    ui.label(format!(
                        "Execution Transport: {} ingested={} retained={} routes={} rollback_floor={} fp={}",
                        transport_state.status,
                        transport_state.events_ingested,
                        transport_state.journal_retained,
                        transport_state.channel_routes_loaded,
                        transport_state.rollback_floor_sequence,
                        transport_state.replay_fingerprint
                    ));
                }
                if let Some(transport_backend_state) =
                    runtime_debug.execution_transport_backend_state.as_deref()
                {
                    ui.label(format!(
                        "Execution Transport Backends: {} payloads={} lanes={} routes={} exported={} rollback_floor={} fp={}",
                        transport_backend_state.status,
                        transport_backend_state.payloads_emitted,
                        transport_backend_state.lanes_emitted,
                        transport_backend_state.routes_loaded,
                        transport_backend_state.exported_through_sequence,
                        transport_backend_state.rollback_floor_sequence,
                        transport_backend_state.backend_fingerprint
                    ));
                }

                ui.separator();
                for (anchor, transform, motion) in runtime_debug.agent_q.iter() {
                    let (last_linear, last_angular, last_frame) = motion
                        .map(|motion| (motion.last_linear, motion.last_angular, motion.last_frame))
                        .unwrap_or((Vec3::ZERO, Vec3::ZERO, 0));
                    ui.label(format!(
                        "{} pos=({:.2}, {:.2}, {:.2}) linear=({:.2}, {:.2}, {:.2}) angular=({:.2}, {:.2}, {:.2}) frame={}",
                        anchor.agent_id,
                        transform.translation.x,
                        transform.translation.y,
                        transform.translation.z,
                        last_linear.x,
                        last_linear.y,
                        last_linear.z,
                        last_angular.x,
                        last_angular.y,
                        last_angular.z,
                        last_frame
                    ));
                }
            });

            ui.separator();

            for (entity, verts, tris, undo) in rows.iter() {
                ui.label(format!(
                    "{:?} | v:{} t:{} undo:{}",
                    entity, verts, tris, undo
                ));
            }
        });

    if panels.sandbox_open {
        egui::Window::new("Egui Sandbox")
            .default_open(true)
            .collapsible(true)
            .resizable(true)
            .show(ctx, |ui| {
                ui.label("Widget smoke test");
                ui.add(egui::Slider::new(&mut panels.sandbox_slider, 0.0..=1.0).text("slider"));
                ui.text_edit_singleline(&mut panels.sandbox_text);
                ui.horizontal(|ui| {
                    if ui.button("log").clicked() {
                        info!(
                            "egui sandbox: slider={} text={}",
                            panels.sandbox_slider, panels.sandbox_text
                        );
                    }
                    if ui.button("close").clicked() {
                        panels.sandbox_open = false;
                    }
                });
            });
    }

    if panels.sculpt_open && *active_tool == ActiveTool::Sculpt {
        egui::Window::new("🎨 Sculpt Tool")
            .default_open(true)
            .collapsible(true)
            .resizable(true)
            .interactable(true)
            .show(ctx, |ui| {
                // Instructions
                ui.colored_label(
                    egui::Color32::from_rgb(100, 200, 100),
                    "✅ Click + drag on mesh to sculpt!",
                );
                ui.small("LMB = sculpt | MMB = orbit | RMB = pan | Scroll = zoom");
                ui.separator();

                // === BRUSH TOOLS GRID ===
                ui.label("🖌️ Brush Tools");
                let tools = [
                    ("CLAY", "Build up surface"),
                    ("SMOOTH", "Smooth surface"),
                    ("FLATTEN", "Flatten to plane"),
                    ("GRAB", "Grab and move"),
                    ("MOVE", "Push geometry"),
                    ("SNAKE", "Snake hook pull"),
                    ("PINCH", "Pinch together"),
                    ("CREASE", "Crease/carve"),
                    ("INFLATE", "Inflate outward"),
                    ("SCRAPE", "Scrape peaks"),
                    ("FILL", "Fill valleys"),
                ];

                ui.horizontal_wrapped(|ui| {
                    for (i, (name, _tip)) in tools.iter().enumerate() {
                        let selected = panels.brush_tool == i as u8;
                        if ui.selectable_label(selected, *name).clicked() {
                            panels.brush_tool = i as u8;
                        }
                    }
                });

                ui.separator();

                // === BRUSH SETTINGS ===
                ui.horizontal(|ui| {
                    ui.label("Mode:");
                    if ui
                        .selectable_label(panels.brush_mode_add, "➕ Add")
                        .clicked()
                    {
                        panels.brush_mode_add = true;
                    }
                    if ui
                        .selectable_label(!panels.brush_mode_add, "➖ Sub")
                        .clicked()
                    {
                        panels.brush_mode_add = false;
                    }
                });

                ui.add(egui::Slider::new(&mut panels.brush_radius, 0.01..=3.0).text("Radius"));
                ui.add(egui::Slider::new(&mut panels.brush_intensity, 0.0..=3.0).text("Intensity"));

                ui.separator();

                // === SYMMETRY ===
                ui.horizontal(|ui| {
                    ui.label("Symmetry:");
                    ui.checkbox(&mut panels.symmetry_x, "X");
                });

                ui.separator();

                // === MESH OPERATIONS ===
                ui.label("🔧 Mesh Operations");
                ui.horizontal(|ui| {
                    if ui.button("⬆ Subdivide").clicked() {
                        subdivide_events.write(SubdivideEvent);
                        panels.subdivision_level += 1;
                    }
                    ui.label(format!("Level: {}", panels.subdivision_level));
                });

                ui.horizontal(|ui| {
                    if ui.button("↩ Undo").clicked() {
                        undo_events.write(UndoEvent);
                    }
                    if ui.button("↪ Redo").clicked() {
                        redo_events.write(RedoEvent);
                    }
                    if ui.button("📸 Snapshot").clicked() {
                        snapshot_events.write(SnapshotEvent);
                    }
                });

                ui.separator();

                // === STATS ===
                ui.label(format!("Strokes: {}", panels.strokes_sent));
            });
    }

    Ok(())
}

fn debug_sculpt_auto_stroke_system(
    debug_ui: Res<DebugUiState>,
    mut panels: ResMut<DebugUiPanels>,
    active_tool: Res<ActiveTool>,
    time: Res<Time>,
    mut cursor_events: MessageWriter<CursorMovedEvent>,
    mut brush_events: MessageWriter<BrushStrokeEvent>,
) {
    if !debug_ui.enabled || !panels.auto_stroke || *active_tool != ActiveTool::Sculpt {
        return;
    }

    panels.auto_timer.tick(time.delta());
    if !panels.auto_timer.is_finished() {
        return;
    }

    cursor_events.write(CursorMovedEvent(panels.cursor_ndc));
    brush_events.write(BrushStrokeEvent {
        tool: panels.brush_tool,
        radius: panels.brush_radius,
        intensity: panels.brush_intensity,
        cursor_ndc: panels.cursor_ndc,
        delta_ndc: if panels.use_delta {
            Some(panels.delta_ndc)
        } else {
            None
        },
        kernel: None,
    });
    panels.strokes_sent += 1;
}

fn setup_scene(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut selection_state: ResMut<SelectionState>,
) {
    // Add WinitSettings for continuous update
    commands.insert_resource(bevy::winit::WinitSettings {
        focused_mode: bevy::winit::UpdateMode::Continuous,
        unfocused_mode: bevy::winit::UpdateMode::Continuous,
    });

    // === CLEAR COLOR (Dark studio background) ===
    commands.insert_resource(ClearColor(Color::srgb(0.08, 0.08, 0.10)));

    // === 3-POINT STUDIO LIGHTING ===

    // Key Light - Main directional (warm, from top-front-right)
    commands.spawn((
        DirectionalLight {
            illuminance: 15000.0,
            shadows_enabled: true,
            color: Color::srgb(1.0, 0.98, 0.95), // Slightly warm
            ..default()
        },
        Transform::from_rotation(Quat::from_euler(EulerRot::XYZ, -0.7, 0.5, 0.0)),
    ));

    // Fill Light - Secondary directional (cool, from left)
    commands.spawn((
        DirectionalLight {
            illuminance: 5000.0,
            shadows_enabled: false,
            color: Color::srgb(0.85, 0.9, 1.0), // Slightly cool
            ..default()
        },
        Transform::from_rotation(Quat::from_euler(EulerRot::XYZ, -0.3, -1.2, 0.0)),
    ));

    // Rim Light - Back light for edge definition
    commands.spawn((
        DirectionalLight {
            illuminance: 8000.0,
            shadows_enabled: false,
            color: Color::srgb(0.9, 0.95, 1.0),
            ..default()
        },
        Transform::from_rotation(Quat::from_euler(EulerRot::XYZ, 0.2, 3.14, 0.0)),
    ));

    // Ambient Light - Soft fill
    commands.spawn(AmbientLight {
        color: Color::srgb(0.5, 0.52, 0.58),
        brightness: 150.0,
        ..default()
    });

    // === CAMERA ===
    commands.spawn((
        Camera3d::default(),
        Transform::from_xyz(0.0, 2.0, 6.0).looking_at(Vec3::ZERO, Vec3::Y),
        MainCamera,
        PanOrbitCamera {
            focus: Vec3::ZERO,
            radius: Some(6.0),
            // Use Middle mouse for orbit so Left is free for sculpting
            button_orbit: bevy::input::mouse::MouseButton::Middle,
            ..default()
        },
    ));

    // Runtime agent anchors receive data-driven execution commands from pipeline state.
    commands.spawn((
        Name::new("agent.hero.default"),
        Transform::from_xyz(-1.5, -2.5, 0.0),
        GlobalTransform::default(),
        GameRuntimeAgentAnchor {
            agent_id: "hero.default".to_string(),
        },
        GameRuntimeAgentMotion::default(),
    ));
    commands.spawn((
        Name::new("agent.npc.vendor"),
        Transform::from_xyz(1.5, -2.5, 0.0),
        GlobalTransform::default(),
        GameRuntimeAgentAnchor {
            agent_id: "npc.vendor".to_string(),
        },
        GameRuntimeAgentMotion::default(),
    ));

    // === DEFAULT SCULPT MESH ===
    {
        let mesh_data = primitive_gen::generate_quad_sphere(4);
        let mesh = meshes.add(mesh_from_primitive(mesh_data));

        // Nice clay-like material
        let clay_material = materials.add(StandardMaterial {
            base_color: Color::srgb(0.75, 0.68, 0.62), // Warm clay
            perceptual_roughness: 0.85,
            metallic: 0.0,
            reflectance: 0.3,
            ..default()
        });

        let entity = commands
            .spawn((
                Mesh3d(mesh),
                MeshMaterial3d(clay_material),
                LayerObjectBundle::new("Default Mesh"),
                Transform::from_xyz(0.0, 0.0, 0.0).with_scale(Vec3::splat(2.0)),
            ))
            .id();

        selection_state.primary = Some(entity);
        selection_state.selection = vec![entity];
    }

    // === GROUND PLANE (Subtle grid-like) ===
    commands.spawn((
        Mesh3d(meshes.add(Plane3d::default().mesh().size(30.0, 30.0))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.12, 0.12, 0.14),
            perceptual_roughness: 0.95,
            metallic: 0.0,
            ..default()
        })),
        Transform::from_xyz(0.0, -2.5, 0.0),
    ));

    info!("🐕 K_OS Bevy Viewport ready - The Leash active");
    info!("   3-point studio lighting | Listening on port 19876");
}

// --- HELPER ---
fn mesh_from_primitive(prim: PrimitiveResult) -> Mesh {
    // Bevy 0.17: use bevy::mesh:: namespace for mesh types
    let mut mesh = Mesh::new(
        bevy::mesh::PrimitiveTopology::TriangleList,
        bevy::asset::RenderAssetUsages::default(),
    );

    // Position
    let positions: Vec<[f32; 3]> = prim
        .positions
        .chunks(3)
        .map(|c| [c[0], c[1], c[2]])
        .collect();
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions);

    // Normal
    let normals: Vec<[f32; 3]> = prim.normals.chunks(3).map(|c| [c[0], c[1], c[2]]).collect();
    mesh.insert_attribute(Mesh::ATTRIBUTE_NORMAL, normals);

    // UVs
    let uvs: Vec<[f32; 2]> = prim.uvs.chunks(2).map(|c| [c[0], c[1]]).collect();
    mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, uvs);

    // Indices
    mesh.insert_indices(bevy::mesh::Indices::U32(prim.indices));

    mesh
}

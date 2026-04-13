//! K_OS Experimental Camera System
//!
//! Multi-mode camera inspired by:
//! - bevy_rts_camera: RTS-style pan/zoom/rotate with ground following
//! - bevy_flycam: First-person fly camera with mouse look
//! - bevy_auto_scaling: Resolution-independent scaling
//!
//! MODES:
//! - Orbit: Standard 3D DCC orbit camera (default)
//! - RTS: Top-down strategy game camera
//! - Fly: First-person free camera
//! - Cinematic: Smooth animated camera paths
//!
//! Not meant to replace bevy_panorbit_camera, just experimental features.

use bevy::input::mouse::{MouseMotion, MouseWheel};
use bevy::prelude::*;
use bevy::window::PrimaryWindow;

// =============================================================================
// CAMERA MODES
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum CameraMode {
    #[default]
    Orbit,
    Rts,
    Fly,
    Cinematic,
}

// =============================================================================
// COMPONENTS
// =============================================================================

/// Main experimental camera controller
#[derive(Component, Debug)]
pub struct ExperimentalCamera {
    /// Current camera mode
    pub mode: CameraMode,
    /// Whether camera input is enabled
    pub enabled: bool,
    /// Smoothing factor (0 = instant, 1 = never reaches target)
    pub smoothing: f32,
}

impl Default for ExperimentalCamera {
    fn default() -> Self {
        Self {
            mode: CameraMode::Orbit,
            enabled: true,
            smoothing: 0.1,
        }
    }
}

// -----------------------------------------------------------------------------
// RTS CAMERA
// -----------------------------------------------------------------------------

/// RTS-style camera settings
#[derive(Component, Debug)]
pub struct RtsCamera {
    /// Pan speed (units/second)
    pub pan_speed: f32,
    /// Zoom speed
    pub zoom_speed: f32,
    /// Rotation speed (radians/pixel)
    pub rotate_speed: f32,
    /// Minimum zoom distance
    pub min_zoom: f32,
    /// Maximum zoom distance
    pub max_zoom: f32,
    /// Current zoom level (distance from ground)
    pub zoom: f32,
    /// Camera pitch angle (radians from vertical)
    pub pitch: f32,
    /// Camera yaw angle (rotation around Y)
    pub yaw: f32,
    /// Target position on ground
    pub target: Vec3,
    /// Enable edge panning
    pub edge_pan_enabled: bool,
    /// Edge pan zone (pixels from edge)
    pub edge_pan_zone: f32,
    /// Edge pan speed multiplier
    pub edge_pan_speed: f32,
}

impl Default for RtsCamera {
    fn default() -> Self {
        Self {
            pan_speed: 20.0,
            zoom_speed: 10.0,
            rotate_speed: 0.005,
            min_zoom: 5.0,
            max_zoom: 100.0,
            zoom: 30.0,
            pitch: 0.8, // ~45 degrees
            yaw: 0.0,
            target: Vec3::ZERO,
            edge_pan_enabled: true,
            edge_pan_zone: 20.0,
            edge_pan_speed: 1.5,
        }
    }
}

/// Ground marker for RTS camera to follow
#[derive(Component, Debug)]
pub struct RtsGround;

// -----------------------------------------------------------------------------
// FLY CAMERA
// -----------------------------------------------------------------------------

/// Fly camera settings
#[derive(Component, Debug)]
pub struct FlyCamera {
    /// Movement speed (units/second)
    pub speed: f32,
    /// Sprint multiplier
    pub sprint_multiplier: f32,
    /// Mouse sensitivity
    pub sensitivity: f32,
    /// Current yaw (radians)
    pub yaw: f32,
    /// Current pitch (radians)
    pub pitch: f32,
    /// Whether cursor is grabbed
    pub cursor_grabbed: bool,
}

impl Default for FlyCamera {
    fn default() -> Self {
        Self {
            speed: 12.0,
            sprint_multiplier: 2.5,
            sensitivity: 0.00012,
            yaw: 0.0,
            pitch: 0.0,
            cursor_grabbed: false,
        }
    }
}

/// Fly camera keybindings
#[derive(Resource)]
pub struct FlyKeybindings {
    pub forward: KeyCode,
    pub backward: KeyCode,
    pub left: KeyCode,
    pub right: KeyCode,
    pub ascend: KeyCode,
    pub descend: KeyCode,
    pub sprint: KeyCode,
    pub toggle_grab: KeyCode,
}

impl Default for FlyKeybindings {
    fn default() -> Self {
        Self {
            forward: KeyCode::KeyW,
            backward: KeyCode::KeyS,
            left: KeyCode::KeyA,
            right: KeyCode::KeyD,
            ascend: KeyCode::Space,
            descend: KeyCode::ShiftLeft,
            sprint: KeyCode::ControlLeft,
            toggle_grab: KeyCode::Escape,
        }
    }
}

// -----------------------------------------------------------------------------
// CINEMATIC CAMERA
// -----------------------------------------------------------------------------

/// Cinematic camera for animated paths
#[derive(Component, Debug)]
pub struct CinematicCamera {
    /// Waypoints (position, look_at, duration)
    pub waypoints: Vec<CameraWaypoint>,
    /// Current waypoint index
    pub current_index: usize,
    /// Progress through current segment (0-1)
    pub progress: f32,
    /// Is playing
    pub playing: bool,
    /// Loop animation
    pub loop_animation: bool,
    /// Easing type
    pub easing: CameraEasing,
}

#[derive(Debug, Clone)]
pub struct CameraWaypoint {
    pub position: Vec3,
    pub look_at: Vec3,
    pub duration: f32,
}

#[derive(Debug, Clone, Copy, Default)]
pub enum CameraEasing {
    #[default]
    Linear,
    EaseInOut,
    EaseIn,
    EaseOut,
}

impl Default for CinematicCamera {
    fn default() -> Self {
        Self {
            waypoints: vec![],
            current_index: 0,
            progress: 0.0,
            playing: false,
            loop_animation: false,
            easing: CameraEasing::EaseInOut,
        }
    }
}

// -----------------------------------------------------------------------------
// AUTO-SCALING
// -----------------------------------------------------------------------------

/// Auto-scaling for resolution independence
#[derive(Component, Debug)]
pub struct AutoScale {
    /// Reference resolution width
    pub reference_width: f32,
    /// Reference resolution height
    pub reference_height: f32,
    /// Maintain aspect ratio
    pub maintain_aspect: bool,
    /// Scale mode
    pub scale_mode: ScaleMode,
}

#[derive(Debug, Clone, Copy, Default)]
pub enum ScaleMode {
    #[default]
    /// Scale to fit width
    FitWidth,
    /// Scale to fit height
    FitHeight,
    /// Scale to fill (may crop)
    Fill,
    /// Scale to contain (may letterbox)
    Contain,
}

impl Default for AutoScale {
    fn default() -> Self {
        Self {
            reference_width: 1920.0,
            reference_height: 1080.0,
            maintain_aspect: true,
            scale_mode: ScaleMode::Contain,
        }
    }
}

// =============================================================================
// RESOURCES
// =============================================================================

/// Camera state resource
#[derive(Resource, Default)]
pub struct CameraState {
    /// Which mode is globally active
    pub active_mode: CameraMode,
    /// Previous mode (for toggling back)
    pub previous_mode: CameraMode,
}

// =============================================================================
// EVENTS
// =============================================================================

/// Switch camera mode
#[derive(Event, Clone, Debug)]
pub struct SetCameraModeEvent(pub CameraMode);
impl Message for SetCameraModeEvent {}

/// Focus on entity
#[derive(Event, Clone, Debug)]
pub struct FocusOnEntityEvent(pub Entity);
impl Message for FocusOnEntityEvent {}

/// Frame all entities
#[derive(Event, Clone, Debug)]
pub struct FrameAllEvent;
impl Message for FrameAllEvent {}

/// RTS camera pan to position
#[derive(Event, Clone, Debug)]
pub struct RtsPanToEvent(pub Vec3);
impl Message for RtsPanToEvent {}

/// Start cinematic playback
#[derive(Event, Clone, Debug)]
pub struct PlayCinematicEvent;
impl Message for PlayCinematicEvent {}

/// Stop cinematic playback
#[derive(Event, Clone, Debug)]
pub struct StopCinematicEvent;
impl Message for StopCinematicEvent {}

// =============================================================================
// PLUGIN
// =============================================================================

pub struct ExperimentalCameraPlugin;

impl Plugin for ExperimentalCameraPlugin {
    fn build(&self, app: &mut App) {
        app
            // Resources
            .init_resource::<CameraState>()
            .init_resource::<FlyKeybindings>()
            // Messages
            .add_message::<SetCameraModeEvent>()
            .add_message::<FocusOnEntityEvent>()
            .add_message::<FrameAllEvent>()
            .add_message::<RtsPanToEvent>()
            .add_message::<PlayCinematicEvent>()
            .add_message::<StopCinematicEvent>()
            // Systems
            .add_systems(
                Update,
                (
                    handle_mode_switch,
                    rts_camera_system,
                    fly_camera_system,
                    cinematic_camera_system,
                    auto_scale_system,
                ),
            );
    }
}

// =============================================================================
// SYSTEMS
// =============================================================================

fn handle_mode_switch(
    mut events: MessageReader<SetCameraModeEvent>,
    mut camera_state: ResMut<CameraState>,
    mut query: Query<&mut ExperimentalCamera>,
) {
    for event in events.read() {
        camera_state.previous_mode = camera_state.active_mode;
        camera_state.active_mode = event.0;

        for mut cam in query.iter_mut() {
            cam.mode = event.0;
        }

        info!("Camera mode switched to {:?}", event.0);
    }
}

fn rts_camera_system(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    mouse_buttons: Res<ButtonInput<MouseButton>>,
    mut mouse_wheel: MessageReader<MouseWheel>,
    mut mouse_motion: MessageReader<MouseMotion>,
    windows: Query<&Window, With<PrimaryWindow>>,
    mut query: Query<(&ExperimentalCamera, &mut RtsCamera, &mut Transform)>,
) {
    let Ok(window) = windows.single() else { return };
    let dt = time.delta_secs();

    for (exp_cam, mut rts, mut transform) in query.iter_mut() {
        if !exp_cam.enabled || exp_cam.mode != CameraMode::Rts {
            continue;
        }

        // --- PAN (Arrow keys or WASD) ---
        let mut pan = Vec2::ZERO;
        if keys.pressed(KeyCode::ArrowUp) || keys.pressed(KeyCode::KeyW) {
            pan.y += 1.0;
        }
        if keys.pressed(KeyCode::ArrowDown) || keys.pressed(KeyCode::KeyS) {
            pan.y -= 1.0;
        }
        if keys.pressed(KeyCode::ArrowLeft) || keys.pressed(KeyCode::KeyA) {
            pan.x -= 1.0;
        }
        if keys.pressed(KeyCode::ArrowRight) || keys.pressed(KeyCode::KeyD) {
            pan.x += 1.0;
        }

        // --- EDGE PANNING ---
        if rts.edge_pan_enabled {
            if let Some(cursor_pos) = window.cursor_position() {
                let w = window.width();
                let h = window.height();
                let zone = rts.edge_pan_zone;

                if cursor_pos.x < zone {
                    pan.x -= rts.edge_pan_speed;
                } else if cursor_pos.x > w - zone {
                    pan.x += rts.edge_pan_speed;
                }
                if cursor_pos.y < zone {
                    pan.y += rts.edge_pan_speed;
                } else if cursor_pos.y > h - zone {
                    pan.y -= rts.edge_pan_speed;
                }
            }
        }

        // Apply pan in camera-relative direction
        if pan != Vec2::ZERO {
            let forward = Vec3::new(rts.yaw.sin(), 0.0, rts.yaw.cos());
            let right = Vec3::new(rts.yaw.cos(), 0.0, -rts.yaw.sin());
            let pan_speed = rts.pan_speed;
            rts.target += (forward * pan.y + right * pan.x) * pan_speed * dt;
        }

        // --- ZOOM (Mouse wheel) ---
        for event in mouse_wheel.read() {
            rts.zoom -= event.y * rts.zoom_speed;
            rts.zoom = rts.zoom.clamp(rts.min_zoom, rts.max_zoom);
        }

        // --- ROTATE (Middle mouse drag) ---
        if mouse_buttons.pressed(MouseButton::Middle) {
            for event in mouse_motion.read() {
                rts.yaw -= event.delta.x * rts.rotate_speed;
                rts.pitch = (rts.pitch - event.delta.y * rts.rotate_speed).clamp(0.2, 1.4);
                // Keep reasonable angle
            }
        }

        // --- APPLY TRANSFORM ---
        let offset = Vec3::new(
            rts.yaw.sin() * rts.pitch.sin() * rts.zoom,
            rts.pitch.cos() * rts.zoom,
            rts.yaw.cos() * rts.pitch.sin() * rts.zoom,
        );

        let target_pos = rts.target + offset;
        let target_rot = Transform::from_translation(target_pos)
            .looking_at(rts.target, Vec3::Y)
            .rotation;

        // Smooth interpolation
        let t = 1.0 - exp_cam.smoothing.powf(dt * 60.0);
        transform.translation = transform.translation.lerp(target_pos, t);
        transform.rotation = transform.rotation.slerp(target_rot, t);
    }
}

fn fly_camera_system(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    keybindings: Res<FlyKeybindings>,
    mut mouse_motion: MessageReader<MouseMotion>,
    mut query: Query<(&ExperimentalCamera, &mut FlyCamera, &mut Transform)>,
) {
    let dt = time.delta_secs();

    for (exp_cam, mut fly, mut transform) in query.iter_mut() {
        if !exp_cam.enabled || exp_cam.mode != CameraMode::Fly {
            continue;
        }

        // --- TOGGLE CURSOR GRAB ---
        // Note: Cursor lock/grab API varies by Bevy version
        // For now, just track grab state internally - mouse look always active
        if keys.just_pressed(keybindings.toggle_grab) {
            fly.cursor_grabbed = !fly.cursor_grabbed;
            info!("Fly camera cursor grab: {}", fly.cursor_grabbed);
            // TODO: Add proper cursor locking when Bevy window cursor API is confirmed
            // In Bevy 0.17, cursor control moved - needs investigation
        }

        // --- MOUSE LOOK ---
        if fly.cursor_grabbed {
            for event in mouse_motion.read() {
                fly.yaw -= event.delta.x * fly.sensitivity;
                fly.pitch = (fly.pitch - event.delta.y * fly.sensitivity).clamp(-1.5, 1.5);
            }
        }

        // --- MOVEMENT ---
        let mut velocity = Vec3::ZERO;
        let forward = transform.forward();
        let right = transform.right();

        if keys.pressed(keybindings.forward) {
            velocity += *forward;
        }
        if keys.pressed(keybindings.backward) {
            velocity -= *forward;
        }
        if keys.pressed(keybindings.right) {
            velocity += *right;
        }
        if keys.pressed(keybindings.left) {
            velocity -= *right;
        }
        if keys.pressed(keybindings.ascend) {
            velocity += Vec3::Y;
        }
        if keys.pressed(keybindings.descend) {
            velocity -= Vec3::Y;
        }

        let speed = if keys.pressed(keybindings.sprint) {
            fly.speed * fly.sprint_multiplier
        } else {
            fly.speed
        };

        if velocity != Vec3::ZERO {
            velocity = velocity.normalize() * speed * dt;
            transform.translation += velocity;
        }

        // Apply rotation
        transform.rotation = Quat::from_euler(EulerRot::YXZ, fly.yaw, fly.pitch, 0.0);
    }
}

fn cinematic_camera_system(
    time: Res<Time>,
    mut query: Query<(&ExperimentalCamera, &mut CinematicCamera, &mut Transform)>,
) {
    let dt = time.delta_secs();

    for (exp_cam, mut cine, mut transform) in query.iter_mut() {
        if !exp_cam.enabled || exp_cam.mode != CameraMode::Cinematic {
            continue;
        }

        if !cine.playing || cine.waypoints.len() < 2 {
            continue;
        }

        // Clone waypoint data to avoid borrow issues
        let current_pos = cine.waypoints[cine.current_index].position;
        let current_look_at = cine.waypoints[cine.current_index].look_at;
        let current_duration = cine.waypoints[cine.current_index].duration;
        let next_idx = (cine.current_index + 1) % cine.waypoints.len();
        let next_pos = cine.waypoints[next_idx].position;
        let next_look_at = cine.waypoints[next_idx].look_at;
        let easing = cine.easing;
        let loop_animation = cine.loop_animation;

        // Advance progress
        cine.progress += dt / current_duration;

        if cine.progress >= 1.0 {
            cine.progress = 0.0;
            cine.current_index = next_idx;

            if cine.current_index == 0 && !loop_animation {
                cine.playing = false;
                continue;
            }
        }

        // Apply easing
        let progress = cine.progress;
        let t = match easing {
            CameraEasing::Linear => progress,
            CameraEasing::EaseIn => progress * progress,
            CameraEasing::EaseOut => 1.0 - (1.0 - progress).powi(2),
            CameraEasing::EaseInOut => {
                if progress < 0.5 {
                    2.0 * progress * progress
                } else {
                    1.0 - (-2.0 * progress + 2.0).powi(2) / 2.0
                }
            }
        };

        // Interpolate position and look-at
        let pos = current_pos.lerp(next_pos, t);
        let look_at = current_look_at.lerp(next_look_at, t);

        *transform = Transform::from_translation(pos).looking_at(look_at, Vec3::Y);
    }
}

/// Auto-scale system for 2D cameras with Projection component
/// Note: In Bevy 0.17, Projection is used as a component for both Ortho and Perspective
fn auto_scale_system(
    windows: Query<&Window, With<PrimaryWindow>>,
    mut query: Query<(&AutoScale, &mut Projection)>,
) {
    let Ok(window) = windows.single() else { return };

    for (scale, mut proj) in query.iter_mut() {
        // Only apply to orthographic projections
        if let Projection::Orthographic(ref mut ortho) = *proj {
            let window_aspect = window.width() / window.height();
            let reference_aspect = scale.reference_width / scale.reference_height;

            let scale_factor = match scale.scale_mode {
                ScaleMode::FitWidth => window.width() / scale.reference_width,
                ScaleMode::FitHeight => window.height() / scale.reference_height,
                ScaleMode::Fill => {
                    if window_aspect > reference_aspect {
                        window.width() / scale.reference_width
                    } else {
                        window.height() / scale.reference_height
                    }
                }
                ScaleMode::Contain => {
                    if window_aspect > reference_aspect {
                        window.height() / scale.reference_height
                    } else {
                        window.width() / scale.reference_width
                    }
                }
            };

            ortho.scale = 1.0 / scale_factor;
        }
    }
}

// =============================================================================
// SPAWN HELPERS
// =============================================================================

/// Spawn an experimental camera with RTS mode
pub fn spawn_rts_camera(commands: &mut Commands) -> Entity {
    commands
        .spawn((
            Camera3d::default(),
            Transform::from_xyz(0.0, 30.0, 30.0).looking_at(Vec3::ZERO, Vec3::Y),
            ExperimentalCamera {
                mode: CameraMode::Rts,
                ..default()
            },
            RtsCamera::default(),
        ))
        .id()
}

/// Spawn an experimental camera with Fly mode
pub fn spawn_fly_camera(commands: &mut Commands) -> Entity {
    commands
        .spawn((
            Camera3d::default(),
            Transform::from_xyz(0.0, 2.0, 5.0),
            ExperimentalCamera {
                mode: CameraMode::Fly,
                ..default()
            },
            FlyCamera::default(),
        ))
        .id()
}

/// Spawn an experimental camera with Cinematic mode
pub fn spawn_cinematic_camera(commands: &mut Commands, waypoints: Vec<CameraWaypoint>) -> Entity {
    commands
        .spawn((
            Camera3d::default(),
            Transform::from_translation(
                waypoints.first().map(|w| w.position).unwrap_or(Vec3::ZERO),
            ),
            ExperimentalCamera {
                mode: CameraMode::Cinematic,
                ..default()
            },
            CinematicCamera {
                waypoints,
                playing: true,
                loop_animation: true,
                ..default()
            },
        ))
        .id()
}

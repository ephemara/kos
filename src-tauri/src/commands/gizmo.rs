use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

use k_os_gizmo::math::{DMat4, Pos2, Transform};
use k_os_gizmo::prelude::{
    enum_set, Gizmo, GizmoConfig, GizmoInteraction, GizmoMode, GizmoOrientation, Rect,
};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};

static NEXT_GIZMO_SESSION: AtomicU64 = AtomicU64::new(1);
lazy_static::lazy_static! {
    static ref GIZMO_SESSIONS: Mutex<HashMap<u64, Gizmo>> = Mutex::new(HashMap::new());
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeGizmoTransformDto {
    pub translation: [f64; 3],
    pub rotation: [f64; 4],
    pub scale: [f64; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeGizmoInteractionDto {
    pub cursor_pos: [f32; 2],
    pub hovered: bool,
    pub drag_started: bool,
    pub dragging: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeGizmoViewportDto {
    pub min: [f32; 2],
    pub max: [f32; 2],
    pub pixels_per_point: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NativeGizmoModeDto {
    Translate,
    Rotate,
    Scale,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NativeGizmoOrientationDto {
    World,
    Local,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeGizmoUpdateRequest {
    pub mode: NativeGizmoModeDto,
    pub orientation: NativeGizmoOrientationDto,
    pub snapping: bool,
    pub snap_angle: Option<f32>,
    pub snap_distance: Option<f32>,
    pub snap_scale: Option<f32>,
    pub view_matrix: [f64; 16],
    pub projection_matrix: [f64; 16],
    pub viewport: NativeGizmoViewportDto,
    pub interaction: NativeGizmoInteractionDto,
    pub targets: Vec<NativeGizmoTransformDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeGizmoDrawDataDto {
    pub vertices: Vec<[f32; 2]>,
    pub colors: Vec<[f32; 4]>,
    pub indices: Vec<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeGizmoResultDto {
    pub kind: String,
    pub axis: Option<[f64; 3]>,
    pub delta_translation: Option<[f64; 3]>,
    pub total_translation: Option<[f64; 3]>,
    pub delta_rotation: Option<[f64; 4]>,
    pub total_rotation: Option<[f64; 4]>,
    pub total_scale: Option<[f64; 3]>,
    pub is_view_axis: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeGizmoUpdateResponse {
    pub draw_data: NativeGizmoDrawDataDto,
    pub result: Option<NativeGizmoResultDto>,
    pub targets: Vec<NativeGizmoTransformDto>,
    pub focused: bool,
}

fn dto_to_transform(dto: &NativeGizmoTransformDto) -> Transform {
    Transform::from_scale_rotation_translation(
        dto.scale,
        k_os_gizmo::mint::Quaternion {
            v: k_os_gizmo::mint::Vector3 {
                x: dto.rotation[0],
                y: dto.rotation[1],
                z: dto.rotation[2],
            },
            s: dto.rotation[3],
        },
        dto.translation,
    )
}

fn transform_to_dto(transform: &Transform) -> NativeGizmoTransformDto {
    NativeGizmoTransformDto {
        translation: [
            transform.translation.x,
            transform.translation.y,
            transform.translation.z,
        ],
        rotation: [
            transform.rotation.v.x,
            transform.rotation.v.y,
            transform.rotation.v.z,
            transform.rotation.s,
        ],
        scale: [transform.scale.x, transform.scale.y, transform.scale.z],
    }
}

fn result_to_dto(result: k_os_gizmo::gizmo::GizmoResult) -> NativeGizmoResultDto {
    match result {
        k_os_gizmo::gizmo::GizmoResult::Rotation {
            axis,
            delta,
            total,
            is_view_axis,
        } => NativeGizmoResultDto {
            kind: "rotation".to_string(),
            axis: Some([axis.x, axis.y, axis.z]),
            delta_translation: None,
            total_translation: None,
            delta_rotation: Some([axis.x * delta, axis.y * delta, axis.z * delta, delta]),
            total_rotation: Some([axis.x * total, axis.y * total, axis.z * total, total]),
            total_scale: None,
            is_view_axis: Some(is_view_axis),
        },
        k_os_gizmo::gizmo::GizmoResult::Translation { delta, total } => NativeGizmoResultDto {
            kind: "translation".to_string(),
            axis: None,
            delta_translation: Some([delta.x, delta.y, delta.z]),
            total_translation: Some([total.x, total.y, total.z]),
            delta_rotation: None,
            total_rotation: None,
            total_scale: None,
            is_view_axis: None,
        },
        k_os_gizmo::gizmo::GizmoResult::Scale { total } => NativeGizmoResultDto {
            kind: "scale".to_string(),
            axis: None,
            delta_translation: None,
            total_translation: None,
            delta_rotation: None,
            total_rotation: None,
            total_scale: Some([total.x, total.y, total.z]),
            is_view_axis: None,
        },
        k_os_gizmo::gizmo::GizmoResult::Arcball { delta, total } => NativeGizmoResultDto {
            kind: "arcball".to_string(),
            axis: None,
            delta_translation: None,
            total_translation: None,
            delta_rotation: Some([delta.v.x, delta.v.y, delta.v.z, delta.s]),
            total_rotation: Some([total.v.x, total.v.y, total.v.z, total.s]),
            total_scale: None,
            is_view_axis: None,
        },
    }
}

fn build_config(request: &NativeGizmoUpdateRequest) -> GizmoConfig {
    let modes = match request.mode {
        NativeGizmoModeDto::Translate => GizmoMode::all_translate(),
        NativeGizmoModeDto::Rotate => GizmoMode::all_rotate(),
        NativeGizmoModeDto::Scale => GizmoMode::all_scale(),
    };

    GizmoConfig {
        view_matrix: DMat4::from_cols_array(&request.view_matrix).into(),
        projection_matrix: DMat4::from_cols_array(&request.projection_matrix).into(),
        viewport: Rect::from_min_max(
            Pos2::new(request.viewport.min[0], request.viewport.min[1]),
            Pos2::new(request.viewport.max[0], request.viewport.max[1]),
        ),
        modes,
        mode_override: None,
        orientation: match request.orientation {
            NativeGizmoOrientationDto::World => GizmoOrientation::Global,
            NativeGizmoOrientationDto::Local => GizmoOrientation::Local,
        },
        pivot_point: Default::default(),
        snapping: request.snapping,
        snap_angle: request.snap_angle.unwrap_or(std::f32::consts::PI / 32.0),
        snap_distance: request.snap_distance.unwrap_or(0.1),
        snap_scale: request.snap_scale.unwrap_or(0.1),
        visuals: Default::default(),
        pixels_per_point: request.viewport.pixels_per_point,
    }
}

#[tauri::command]
pub fn gizmo_session_create() -> u64 {
    let handle = NEXT_GIZMO_SESSION.fetch_add(1, Ordering::Relaxed);
    GIZMO_SESSIONS.lock().insert(handle, Gizmo::default());
    handle
}

#[tauri::command]
pub fn gizmo_session_dispose(session: u64) -> Result<(), String> {
    GIZMO_SESSIONS.lock().remove(&session);
    Ok(())
}

#[tauri::command]
pub fn gizmo_session_update(
    session: u64,
    request: NativeGizmoUpdateRequest,
) -> Result<NativeGizmoUpdateResponse, String> {
    let mut sessions = GIZMO_SESSIONS.lock();
    let gizmo = sessions
        .get_mut(&session)
        .ok_or_else(|| format!("Unknown gizmo session {}", session))?;

    gizmo.update_config(build_config(&request));

    let targets: Vec<Transform> = request.targets.iter().map(dto_to_transform).collect();
    let interaction = GizmoInteraction {
        cursor_pos: (
            request.interaction.cursor_pos[0],
            request.interaction.cursor_pos[1],
        ),
        hovered: request.interaction.hovered,
        drag_started: request.interaction.drag_started,
        dragging: request.interaction.dragging,
    };

    let update = gizmo.update(interaction, &targets);
    let draw_data = gizmo.draw();
    let focused = gizmo.is_focused();

    let (result, next_targets) = match update {
        Some((result, updated_targets)) => (Some(result_to_dto(result)), updated_targets),
        None => (None, targets),
    };

    Ok(NativeGizmoUpdateResponse {
        draw_data: NativeGizmoDrawDataDto {
            vertices: draw_data.vertices,
            colors: draw_data.colors,
            indices: draw_data.indices,
        },
        result,
        targets: next_targets.iter().map(transform_to_dto).collect(),
        focused,
    })
}

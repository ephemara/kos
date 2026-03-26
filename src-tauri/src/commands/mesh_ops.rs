//! Thin Tauri adapters for primitive generation and mesh optimization commands.

use k_os_mesh::{OptimizeMeshResult, PrimitiveParams, PrimitiveResult, SimplifyResult};
use serde_json::Value;
use std::collections::HashMap;

type PrimitiveU32Setter = fn(&mut PrimitiveParams, u32);
type PrimitiveF32Setter = fn(&mut PrimitiveParams, f32);
type PrimitiveBoolSetter = fn(&mut PrimitiveParams, bool);

const U32_PARAM_FIELDS: &[(&str, PrimitiveU32Setter)] = &[
    ("subdivisions", set_subdivisions),
    ("radialSegments", set_radial_segments),
    ("heightSegments", set_height_segments),
    ("tubularSegments", set_tubular_segments),
    ("sides", set_sides),
    ("rings", set_rings),
    ("segments", set_segments),
];

const F32_PARAM_FIELDS: &[(&str, PrimitiveF32Setter)] = &[
    ("tubeRadius", set_tube_radius),
    ("innerRadius", set_inner_radius),
    ("outerRadius", set_outer_radius),
    ("height", set_height),
    ("width", set_width),
    ("depth", set_depth),
    ("radius", set_radius),
    ("thickness", set_thickness),
    ("angle", set_angle),
    ("taper", set_taper),
    ("flangeWidth", set_flange_width),
];

const BOOL_PARAM_FIELDS: &[(&str, PrimitiveBoolSetter)] = &[("caps", set_caps)];

#[inline]
fn set_subdivisions(params: &mut PrimitiveParams, value: u32) {
    params.subdivisions = Some(value);
}

#[inline]
fn set_radial_segments(params: &mut PrimitiveParams, value: u32) {
    params.radial_segments = Some(value);
}

#[inline]
fn set_height_segments(params: &mut PrimitiveParams, value: u32) {
    params.height_segments = Some(value);
}

#[inline]
fn set_tubular_segments(params: &mut PrimitiveParams, value: u32) {
    params.tubular_segments = Some(value);
}

#[inline]
fn set_sides(params: &mut PrimitiveParams, value: u32) {
    params.sides = Some(value);
}

#[inline]
fn set_rings(params: &mut PrimitiveParams, value: u32) {
    params.rings = Some(value);
}

#[inline]
fn set_segments(params: &mut PrimitiveParams, value: u32) {
    params.segments = Some(value);
}

#[inline]
fn set_tube_radius(params: &mut PrimitiveParams, value: f32) {
    params.tube_radius = Some(value);
}

#[inline]
fn set_inner_radius(params: &mut PrimitiveParams, value: f32) {
    params.inner_radius = Some(value);
}

#[inline]
fn set_outer_radius(params: &mut PrimitiveParams, value: f32) {
    params.outer_radius = Some(value);
}

#[inline]
fn set_height(params: &mut PrimitiveParams, value: f32) {
    params.height = Some(value);
}

#[inline]
fn set_width(params: &mut PrimitiveParams, value: f32) {
    params.width = Some(value);
}

#[inline]
fn set_depth(params: &mut PrimitiveParams, value: f32) {
    params.depth = Some(value);
}

#[inline]
fn set_radius(params: &mut PrimitiveParams, value: f32) {
    params.radius = Some(value);
}

#[inline]
fn set_thickness(params: &mut PrimitiveParams, value: f32) {
    params.thickness = Some(value);
}

#[inline]
fn set_angle(params: &mut PrimitiveParams, value: f32) {
    params.angle = Some(value);
}

#[inline]
fn set_taper(params: &mut PrimitiveParams, value: f32) {
    params.taper = Some(value);
}

#[inline]
fn set_flange_width(params: &mut PrimitiveParams, value: f32) {
    params.flange_width = Some(value);
}

#[inline]
fn set_caps(params: &mut PrimitiveParams, value: bool) {
    params.caps = Some(value);
}

fn build_primitive_params(raw_params: &HashMap<String, Value>) -> Result<PrimitiveParams, String> {
    let mut params = PrimitiveParams::default();

    for (key, setter) in U32_PARAM_FIELDS {
        if let Some(value) = raw_params.get(*key) {
            let parsed = value
                .as_u64()
                .ok_or_else(|| format!("primitive param '{}' must be an unsigned integer", key))?;
            setter(&mut params, parsed as u32);
        }
    }

    for (key, setter) in F32_PARAM_FIELDS {
        if let Some(value) = raw_params.get(*key) {
            let parsed = value
                .as_f64()
                .ok_or_else(|| format!("primitive param '{}' must be a number", key))?;
            setter(&mut params, parsed as f32);
        }
    }

    for (key, setter) in BOOL_PARAM_FIELDS {
        if let Some(value) = raw_params.get(*key) {
            let parsed = value
                .as_bool()
                .ok_or_else(|| format!("primitive param '{}' must be a boolean", key))?;
            setter(&mut params, parsed);
        }
    }

    Ok(params)
}

#[tauri::command]
pub fn spawn_primitive(
    primitive_id: String,
    params: HashMap<String, Value>,
) -> Result<PrimitiveResult, String> {
    let primitive_params = build_primitive_params(&params)?;
    k_os_mesh::spawn_primitive(&primitive_id, primitive_params)
}

#[tauri::command]
pub fn optimize_mesh(
    positions: Vec<f32>,
    normals: Vec<f32>,
    uvs: Option<Vec<f32>>,
    indices: Vec<u32>,
) -> Result<OptimizeMeshResult, String> {
    k_os_mesh::optimize_mesh(positions, normals, uvs, indices)
}

#[tauri::command]
pub fn simplify_mesh(
    positions: Vec<f32>,
    indices: Vec<u32>,
    target_ratio: f32,
    lock_border: bool,
) -> Result<SimplifyResult, String> {
    k_os_mesh::simplify_mesh(positions, indices, target_ratio, lock_border)
}

#[tauri::command]
pub fn generate_lod_chain(
    positions: Vec<f32>,
    indices: Vec<u32>,
    lod_count: usize,
) -> Result<Vec<SimplifyResult>, String> {
    k_os_mesh::generate_lod_chain(positions, indices, lod_count)
}

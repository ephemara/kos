// ============================================================================
// K_OS Sculpt Smooth Kernel V2 - Maximum Modularity Edition
// ============================================================================
// Supports: Smooth, Relax, Surface Smooth, Sharpen
// Uses BrushParamsV2 (384 bytes) + neighbor topology buffers
// ============================================================================

// === CONSTANTS ===
const FLAG_SUBTRACT: u32 = 1u;
const FLAG_FRONT_FACES_ONLY: u32 = 2u;
const ALPHA_DISABLED: u32 = 0u;

// === ALPHA SLOT (32 bytes) ===
struct AlphaSlot {
    pool_id: u32,
    mode: u32,
    scale: f32,
    rotation: f32,
    offset: vec2<f32>,
    blend_weight: f32,
    mirror: u32,
}

// === BRUSH PARAMS V2 (384 bytes) ===
struct BrushParams {
    center: vec4<f32>,
    normal: vec4<f32>,
    velocity: vec4<f32>,
    prev_center: vec3<f32>,
    stroke_distance: f32,
    radius: f32,
    strength: f32,
    hardness: f32,
    spacing: f32,
    kernel_id: u32,
    entry_point_id: u32,
    blend_mode: u32,
    flags: u32,
    vertex_count: u32,
    candidate_count: u32,
    dab_index: u32,
    stroke_index: u32,
    alpha0: AlphaSlot,
    alpha1: AlphaSlot,
    alpha2: AlphaSlot,
    jitter_position: f32,
    jitter_rotation: f32,
    jitter_strength: f32,
    random_seed: f32,
    symmetry_flags: u32,
    radial_count: u32,
    symmetry_offset_x: f32,
    symmetry_offset_y: f32,
    automask_cavity: f32,
    automask_angle: f32,
    automask_border: f32,
    automask_face_set: u32,
    curve_pressure: u32,
    curve_speed: u32,
    curve_tilt: u32,
    curve_direction: u32,
    extras: array<vec4<f32>, 6>,
    locked_plane_normal: vec3<f32>,
    locked_plane_offset: f32,
    locked_position: vec3<f32>,
    locked_radius: f32,
    // V2.1 fields
    pen_rotation: f32,
    stroke_type: u32,
    backface_threshold: f32,
    accumulation_limit: f32,
    color: vec4<f32>,
    gravity_direction: vec3<f32>,
    time: f32,
    _reserved: vec4<f32>,
}

// === BINDINGS ===
@group(0) @binding(0) var<storage, read_write> positions: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> normals: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: BrushParams;
@group(0) @binding(3) var<storage, read> candidates: array<u32>;
@group(0) @binding(4) var<storage, read> neighbor_offsets: array<u32>;  // CSR format
@group(0) @binding(5) var<storage, read> neighbor_indices: array<u32>;
@group(0) @binding(6) var<storage, read> counter: array<u32>;

// === HELPERS ===
fn has_flag(flag: u32) -> bool {
    return (params.flags & flag) != 0u;
}

fn get_pressure() -> f32 {
    return params.center.w;
}

fn falloff(dist: f32, radius: f32, hardness: f32) -> f32 {
    let t = clamp(dist / radius, 0.0, 1.0);
    let soft = 1.0 - t * t;
    let hard = 1.0 - t;
    return mix(soft, hard, hardness);
}

fn get_vertex_idx(idx: u32) -> u32 {
    let count = counter[0];
    if (count > 0u) {
        if (idx >= count) { return 0xFFFFFFFFu; }
        return candidates[idx];
    } else {
        if (idx >= params.vertex_count) { return 0xFFFFFFFFu; }
        return idx;
    }
}

// ============================================================================
// SMOOTH MAIN - Laplacian smoothing toward neighbor average
// extras[0] = iterations (for multi-pass, but we do single pass on GPU)
// extras[1] = preserve_volume (0-1)
// ============================================================================
@compute @workgroup_size(256)
fn smooth_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    let weight = falloff(dist, params.radius, params.hardness) * params.strength * get_pressure();
    
    // Get neighbor range (CSR format)
    let start = neighbor_offsets[vertex_idx];
    let end = neighbor_offsets[vertex_idx + 1u];
    let neighbor_count = end - start;
    
    if (neighbor_count == 0u) { return; }
    
    // Calculate average neighbor position
    var avg = vec3<f32>(0.0);
    for (var i = start; i < end; i = i + 1u) {
        let neighbor_idx = neighbor_indices[i];
        avg += positions[neighbor_idx].xyz;
    }
    avg = avg / f32(neighbor_count);
    
    // Blend toward average
    var smoothed = mix(pos, avg, weight);
    
    // Optional: preserve volume by projecting back along normal
    let preserve = params.extras[1].x;
    if (preserve > 0.0) {
        let n = normalize(nor);
        let volume_correction = dot(smoothed - pos, n);
        smoothed = smoothed - n * volume_correction * preserve;
    }
    
    positions[vertex_idx] = vec4<f32>(smoothed, 1.0);
}

// ============================================================================
// SMOOTH RELAX - Tangential-only smoothing (preserves silhouette)
// ============================================================================
@compute @workgroup_size(256)
fn smooth_relax(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normalize(normals[vertex_idx].xyz);
    let center = params.center.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    let weight = falloff(dist, params.radius, params.hardness) * params.strength * 0.5 * get_pressure();
    
    let start = neighbor_offsets[vertex_idx];
    let end = neighbor_offsets[vertex_idx + 1u];
    let neighbor_count = end - start;
    
    if (neighbor_count == 0u) { return; }
    
    // Weighted Laplacian (inverse edge length weighting)
    var laplacian = vec3<f32>(0.0);
    var total_weight = 0.0;
    
    for (var i = start; i < end; i = i + 1u) {
        let neighbor_idx = neighbor_indices[i];
        let neighbor_pos = positions[neighbor_idx].xyz;
        let edge_len = length(neighbor_pos - pos);
        let w = 1.0 / max(edge_len, 0.0001);
        laplacian += (neighbor_pos - pos) * w;
        total_weight += w;
    }
    
    if (total_weight > 0.0) {
        laplacian = laplacian / total_weight;
    }
    
    // Project tangentially (remove normal component)
    let tangent_component = laplacian - nor * dot(laplacian, nor);
    
    positions[vertex_idx] = vec4<f32>(pos + tangent_component * weight, 1.0);
}

// ============================================================================
// SMOOTH SURFACE - HC Laplacian (curvature-preserving smooth)
// extras[0] = lambda (0.5 typical)
// extras[1] = mu (-0.53 typical, must be negative)
// ============================================================================
@compute @workgroup_size(256)
fn smooth_surface(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.center.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    let weight = falloff(dist, params.radius, params.hardness) * params.strength * get_pressure();
    
    let start = neighbor_offsets[vertex_idx];
    let end = neighbor_offsets[vertex_idx + 1u];
    let neighbor_count = end - start;
    
    if (neighbor_count == 0u) { return; }
    
    // HC (Humphrey's Classes) Laplacian smoothing
    let lambda = params.extras[0].x;  // Smoothing factor (0.5 typical)
    let mu = params.extras[1].x;      // Counter-factor (-0.53 typical)
    
    // Step 1: Calculate average
    var avg = vec3<f32>(0.0);
    for (var i = start; i < end; i = i + 1u) {
        avg += positions[neighbor_indices[i]].xyz;
    }
    avg = avg / f32(neighbor_count);
    
    // Step 2: Move toward average (smoothing step)
    let q = pos + (avg - pos) * lambda * weight;
    
    // Step 3: Calculate difference (for curvature preservation)
    let b = q - pos;
    
    // Step 4: Average the differences of neighbors (for anti-shrink)
    var avg_b = vec3<f32>(0.0);
    for (var i = start; i < end; i = i + 1u) {
        let neighbor_pos = positions[neighbor_indices[i]].xyz;
        // Note: In a true HC smooth, we'd need previous iteration's b values
        // This is a simplified single-pass approximation
        avg_b += neighbor_pos - pos;
    }
    avg_b = avg_b / f32(neighbor_count);
    
    // Step 5: Push back against shrinkage
    let final_pos = q + (b + avg_b) * mu * weight;
    
    positions[vertex_idx] = vec4<f32>(final_pos, 1.0);
}

// ============================================================================
// SMOOTH SHARPEN - Anti-smooth (increases local curvature)
// extras[0] = sharpen_factor (1.0 = double curvature)
// ============================================================================
@compute @workgroup_size(256)
fn smooth_sharpen(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    let weight = falloff(dist, params.radius, params.hardness) * params.strength * get_pressure();
    
    let start = neighbor_offsets[vertex_idx];
    let end = neighbor_offsets[vertex_idx + 1u];
    let neighbor_count = end - start;
    
    if (neighbor_count == 0u) { return; }
    
    // Calculate average neighbor position
    var avg = vec3<f32>(0.0);
    for (var i = start; i < end; i = i + 1u) {
        avg += positions[neighbor_indices[i]].xyz;
    }
    avg = avg / f32(neighbor_count);
    
    // Sharpen: move AWAY from average (opposite of smooth)
    let sharpen_factor = params.extras[0].x;
    let to_avg = avg - pos;
    let sharpened = pos - to_avg * sharpen_factor * weight;
    
    positions[vertex_idx] = vec4<f32>(sharpened, 1.0);
}

// ============================================================================
// SMOOTH FLATTEN POLISH - Flatten + Smooth combo for hard surface
// extras[0] = flatten_amount (blend between pure smooth and flatten)
// ============================================================================
@compute @workgroup_size(256)
fn smooth_flatten_polish(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    let weight = falloff(dist, params.radius, params.hardness) * params.strength * get_pressure();
    
    let start = neighbor_offsets[vertex_idx];
    let end = neighbor_offsets[vertex_idx + 1u];
    let neighbor_count = end - start;
    
    if (neighbor_count == 0u) { return; }
    
    let flatten_amount = params.extras[0].x;
    
    // Smooth component
    var avg = vec3<f32>(0.0);
    for (var i = start; i < end; i = i + 1u) {
        avg += positions[neighbor_indices[i]].xyz;
    }
    avg = avg / f32(neighbor_count);
    let smooth_pos = mix(pos, avg, weight);
    
    // Flatten component
    let plane_dist = dot(to_center, brush_normal);
    let flat_pos = pos - brush_normal * plane_dist * weight;
    
    // Blend between smooth and flatten
    let final_pos = mix(smooth_pos, flat_pos, flatten_amount);
    
    positions[vertex_idx] = vec4<f32>(final_pos, 1.0);
}

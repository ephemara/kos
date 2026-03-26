// GPU Spatial Grid Query Shader
//
// Query the spatial grid to find vertices within a sphere.
// Writes candidate indices + indirect dispatch buffer for Level 5.
//
// IMPORTANT: candidates[0] is the atomic counter, actual vertex IDs start at candidates[1]

struct GridParams {
    bounds_min: vec4<f32>,
    bounds_max: vec4<f32>,
    cell_size: f32,
    // IMPORTANT: Using separate u32s instead of vec3 to match Rust struct layout!
    // vec3<u32> would add hidden padding that breaks alignment
    grid_dims_x: u32,
    grid_dims_y: u32,
    grid_dims_z: u32,
    vertex_count: u32,
    cell_count: u32,
    _pad: vec2<u32>,
}

struct QueryParams {
    center: vec4<f32>,
    radius: f32,
    max_candidates: u32,
    _pad: vec2<u32>,
}

struct IndirectDispatch {
    group_count_x: u32,
    group_count_y: u32,
    group_count_z: u32,
}

@group(0) @binding(0) var<uniform> grid_params: GridParams;
@group(0) @binding(1) var<uniform> query_params: QueryParams;
@group(0) @binding(2) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> cell_offsets: array<u32>;
@group(0) @binding(4) var<storage, read> vertex_indices: array<u32>;
// candidates = pure vertex IDs (no counter at [0])
@group(0) @binding(5) var<storage, read_write> candidates: array<u32>;
@group(0) @binding(6) var<storage, read_write> indirect: IndirectDispatch;
// Counter is now separate
@group(0) @binding(7) var<storage, read_write> counter: atomic<u32>;

// Helper: Convert world position to cell coords
fn pos_to_cell_coords(pos: vec3<f32>) -> vec3<i32> {
    let rel = pos - grid_params.bounds_min.xyz;
    return vec3<i32>(
        i32(rel.x / grid_params.cell_size),
        i32(rel.y / grid_params.cell_size),
        i32(rel.z / grid_params.cell_size)
    );
}

// Helper: Cell coords to linear index
fn cell_coords_to_index(coords: vec3<i32>) -> u32 {
    // Use separate u32 fields (no vec3 to avoid alignment issues)
    let dims_x = i32(grid_params.grid_dims_x);
    let dims_y = i32(grid_params.grid_dims_y);
    let dims_z = i32(grid_params.grid_dims_z);
    if (coords.x < 0 || coords.y < 0 || coords.z < 0 ||
        coords.x >= dims_x || coords.y >= dims_y || coords.z >= dims_z) {
        return 0xFFFFFFFFu; // Invalid
    }
    return u32(coords.z) * u32(dims_x * dims_y) + 
           u32(coords.y) * u32(dims_x) + 
           u32(coords.x);
}

// Get count of vertices in a cell
fn get_cell_count(cell_id: u32) -> u32 {
    if (cell_id >= grid_params.cell_count || cell_id == 0xFFFFFFFFu) {
        return 0u;
    }
    // Count = offset[cell+1] - offset[cell]
    let next_offset = select(
        cell_offsets[cell_id + 1u],
        grid_params.vertex_count,
        cell_id + 1u >= grid_params.cell_count
    );
    return next_offset - cell_offsets[cell_id];
}

// ============================================================================
// Clear candidates (call before query_sphere)
// ============================================================================
@compute @workgroup_size(1)
fn clear_candidates(@builtin(global_invocation_id) gid: vec3<u32>) {
    // Reset separate counter
    atomicStore(&counter, 0u);
    // Reset indirect dispatch
    indirect.group_count_x = 0u;
    indirect.group_count_y = 1u;
    indirect.group_count_z = 1u;
}

// ============================================================================
// Query: Find vertices within sphere, write to candidates buffer
// ============================================================================
@compute @workgroup_size(256)
fn query_sphere(@builtin(global_invocation_id) gid: vec3<u32>) {
    // Each thread handles one cell in the query region
    let thread_id = gid.x;
    
    // Calculate bounding box of query sphere in cell coords
    let query_center = query_params.center.xyz;
    let query_radius = query_params.radius;
    
    let min_corner = query_center - vec3<f32>(query_radius);
    let max_corner = query_center + vec3<f32>(query_radius);
    
    let min_cell = pos_to_cell_coords(min_corner);
    let max_cell = pos_to_cell_coords(max_corner);
    
    // Calculate cells to check
    let cell_range = max_cell - min_cell + vec3<i32>(1);
    let total_cells = u32(max(cell_range.x, 1) * max(cell_range.y, 1) * max(cell_range.z, 1));
    
    if (thread_id >= total_cells) {
        return;
    }
    
    // Map thread to cell in query region
    let range_x = max(cell_range.x, 1);
    let range_y = max(cell_range.y, 1);
    let local_z = i32(thread_id / u32(range_x * range_y));
    let remain = i32(thread_id) - local_z * range_x * range_y;
    let local_y = remain / range_x;
    let local_x = remain - local_y * range_x;
    
    let cell_coords = min_cell + vec3<i32>(local_x, local_y, local_z);
    let cell_id = cell_coords_to_index(cell_coords);
    
    if (cell_id == 0xFFFFFFFFu || cell_id >= grid_params.cell_count) {
        return;
    }
    
    // Check each vertex in this cell
    let cell_offset = cell_offsets[cell_id];
    let cell_count = get_cell_count(cell_id);
    let radius_sq = query_radius * query_radius;
    
    for (var i = 0u; i < cell_count; i++) {
        let vertex_id = vertex_indices[cell_offset + i];
        
        // Bounds check
        if (vertex_id >= grid_params.vertex_count) {
            continue;
        }
        
        let pos = positions[vertex_id].xyz;
        
        let diff = pos - query_center;
        let dist_sq = dot(diff, diff);
        
        if (dist_sq <= radius_sq) {
            // Atomic increment counter
            let slot = atomicAdd(&counter, 1u);
            
            // Write vertex ID at candidates[slot]
            if (slot < query_params.max_candidates) {
                candidates[slot] = vertex_id;
            }
        }
    }
}

// ============================================================================
// Write indirect dispatch buffer (call after query_sphere)
// ============================================================================
@compute @workgroup_size(1)
fn write_indirect(@builtin(global_invocation_id) gid: vec3<u32>) {
    // Read counter
    let count = atomicLoad(&counter);
    let clamped_count = min(count, query_params.max_candidates);
    
    // Dispatch groups = ceil(count / 256)
    let groups = select((clamped_count + 255u) / 256u, 1u, clamped_count == 0u);
    indirect.group_count_x = groups;
    indirect.group_count_y = 1u;
    indirect.group_count_z = 1u;
    
    // CRITICAL: Clamp counter so subsequent shaders don't read OOB candidates
    atomicStore(&counter, clamped_count);
}

// GPU Spatial Grid Build Shader (3-pass)
//
// Pass 1: count_cells - Count vertices per cell (atomicAdd)
// Pass 2: prefix_sum - Compute exclusive scan for cell offsets
// Pass 3: scatter - Place vertex indices into sorted buckets

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

@group(0) @binding(0) var<uniform> params: GridParams;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> cell_counts: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> cell_offsets: array<u32>;
@group(0) @binding(4) var<storage, read_write> vertex_indices: array<u32>;

// Helper: Convert world position to cell index
fn pos_to_cell(pos: vec3<f32>) -> u32 {
    let rel = pos - params.bounds_min.xyz;
    let cell_x = u32(rel.x / params.cell_size);
    let cell_y = u32(rel.y / params.cell_size);
    let cell_z = u32(rel.z / params.cell_size);
    
    // Clamp to grid bounds
    let cx = min(cell_x, params.grid_dims_x - 1u);
    let cy = min(cell_y, params.grid_dims_y - 1u);
    let cz = min(cell_z, params.grid_dims_z - 1u);
    
    // Linear index (z-major order)
    return cz * params.grid_dims_x * params.grid_dims_y + cy * params.grid_dims_x + cx;
}

// ============================================================================
// PASS 1: Count vertices per cell
// ============================================================================
@compute @workgroup_size(256)
fn count_cells(@builtin(global_invocation_id) gid: vec3<u32>) {
    let vertex_id = gid.x;
    if (vertex_id >= params.vertex_count) {
        return;
    }
    
    let pos = positions[vertex_id].xyz;
    let cell_id = pos_to_cell(pos);
    
    // Atomically increment cell count
    atomicAdd(&cell_counts[cell_id], 1u);
}

// ============================================================================
// PASS 2: Prefix sum (exclusive scan)
// Simple sequential scan - works for moderate cell counts
// For large grids, use parallel Blelloch scan
// ============================================================================
@compute @workgroup_size(1)
fn prefix_sum(@builtin(global_invocation_id) gid: vec3<u32>) {
    // Single-threaded prefix sum
    // TODO: Parallel Blelloch scan for large grids
    var running_sum = 0u;
    for (var i = 0u; i < params.cell_count; i++) {
        cell_offsets[i] = running_sum;
        running_sum += atomicLoad(&cell_counts[i]);
    }
}

// ============================================================================
// PASS 3: Scatter vertices into sorted buckets
// ============================================================================
@compute @workgroup_size(256)
fn scatter(@builtin(global_invocation_id) gid: vec3<u32>) {
    let vertex_id = gid.x;
    if (vertex_id >= params.vertex_count) {
        return;
    }
    
    let pos = positions[vertex_id].xyz;
    let cell_id = pos_to_cell(pos);
    
    // Get slot in cell's bucket (atomic increment of counter as insertion index)
    let slot = atomicAdd(&cell_counts[cell_id], 1u);
    let base_offset = cell_offsets[cell_id];
    
    // Write vertex index to sorted position
    vertex_indices[base_offset + slot] = vertex_id;
}

// ============================================================================
// PASS 0: Clear counts (call before count_cells)
// ============================================================================
@compute @workgroup_size(256)
fn clear_counts(@builtin(global_invocation_id) gid: vec3<u32>) {
    let cell_id = gid.x;
    if (cell_id >= params.cell_count) {
        return;
    }
    atomicStore(&cell_counts[cell_id], 0u);
}

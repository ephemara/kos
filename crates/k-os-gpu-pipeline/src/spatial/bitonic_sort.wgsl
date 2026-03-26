// GPU Bitonic Sort for Spatial Grid
//
// Optimized bitonic sorting implementation adapted from FPGA/CUDA samples
// Sorts (cell_id, vertex_id) pairs for efficient spatial queries
//
// Usage:
// 1. Initial local sort (bitonic_sort_local)
// 2. Global merge passes (bitonic_merge_global/local)

struct GridParams {
    bounds_min: vec4<f32>,
    bounds_max: vec4<f32>,
    cell_size: f32,
    grid_dims_x: u32,
    grid_dims_y: u32,
    grid_dims_z: u32,
    vertex_count: u32,
    cell_count: u32,
    _pad: vec2<u32>,
}

// Sort key: cell_id
// Sort value: vertex_id
struct SortPair {
    key: u32,
    value: u32,
}

@group(0) @binding(0) var<uniform> params: GridParams;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> sort_data: array<SortPair>;

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

// Comparator for bitonic sort
fn comparator(a: ptr<function, SortPair>, b: ptr<function, SortPair>, dir: bool) {
    if ((*a).key > (*b).key) == dir {
        // Swap both key and value
        let temp = *a;
        *a = *b;
        *b = temp;
    }
}

// ============================================================================
// INIT: Create (cell_id, vertex_id) pairs
// ============================================================================
@compute @workgroup_size(256)
fn init_pairs(@builtin(global_invocation_id) gid: vec3<u32>) {
    let vertex_id = gid.x;
    if (vertex_id >= params.vertex_count) {
        return;
    }
    
    let pos = positions[vertex_id].xyz;
    let cell_id = pos_to_cell(pos);
    
    sort_data[vertex_id] = SortPair(cell_id, vertex_id);
}

// ============================================================================
// PASS 1: Local bitonic sort within workgroup
// Sorts chunks of LOCAL_SIZE_LIMIT elements
// ============================================================================
@compute @workgroup_size(256)
fn bitonic_sort_local(@builtin(global_invocation_id) gid: vec3<u32>) {
    let local_id = gid.x % 256u;
    let group_id = gid.x / 256u;
    let base_idx = group_id * 256u;
    
    // Check if we have a full block
    let block_size = min(256u, params.vertex_count - base_idx);
    if (local_id >= block_size) {
        return;
    }
    
    // Load into "local memory" (actually registers/shared memory in WGSL)
    var local_data: array<SortPair, 256>;
    local_data[local_id] = sort_data[base_idx + local_id];
    
    // Synchronization would happen here in real CUDA/OpenCL
    // WGSL doesn't have explicit shared memory, so we work directly on global
    
    // Bitonic sort local
    var comparator_i = local_id & (128u - 1u);
    
    // Build bitonic sequences
    for (var size = 2u; size < block_size; size = size << 1u) {
        let dir = (comparator_i & (size / 2u)) != 0u;
        
        for (var stride = size / 2u; stride > 0u; stride = stride >> 1u) {
            workgroupBarrier();
            
            let pos = 2u * local_id - (local_id & (stride - 1u));
            if (pos + stride < block_size) {
                var a = sort_data[base_idx + pos];
                var b = sort_data[base_idx + pos + stride];
                comparator(&a, &b, dir);
                sort_data[base_idx + pos] = a;
                sort_data[base_idx + pos + stride] = b;
            }
        }
    }
    
    // Final odd/even merge
    let dir = group_id & 1u;
    for (var stride = block_size / 2u; stride > 0u; stride = stride >> 1u) {
        workgroupBarrier();
        
        let pos = 2u * local_id - (local_id & (stride - 1u));
        if (pos + stride < block_size) {
            var a = sort_data[base_idx + pos];
            var b = sort_data[base_idx + pos + stride];
            comparator(&a, &b, dir);
            sort_data[base_idx + pos] = a;
            sort_data[base_idx + pos + stride] = b;
        }
    }
}

// ============================================================================
// PASS 2: Global bitonic merge for large arrays
// Merges sorted blocks from pass 1
// ============================================================================
@compute @workgroup_size(256)
fn bitonic_merge_global(@builtin(global_invocation_id) gid: vec3<u32>) {
    let global_id = gid.x;
    if (global_id >= params.vertex_count / 2u) {
        return;
    }
    
    // Parameters for this merge pass
    let array_length = params.vertex_count;
    let size = 512u; // Size of sequences to merge (power of 2)
    let stride = 256u; // Current comparison distance
    let sort_dir = false; // Ascending order
    
    let comparator_i = global_id & (array_length / 2u - 1u);
    let dir = sort_dir != ((comparator_i & (size / 2u)) != 0u);
    
    let pos = 2u * global_id - (global_id & (stride - 1u));
    
    if (pos + stride < array_length) {
        var a = sort_data[pos];
        var b = sort_data[pos + stride];
        comparator(&a, &b, dir);
        sort_data[pos] = a;
        sort_data[pos + stride] = b;
    }
}

// ============================================================================
// PASS 3: Local merge for remaining passes
// Uses workgroup local memory for efficiency
// ============================================================================
@compute @workgroup_size(256)
fn bitonic_merge_local(@builtin(global_invocation_id) gid: vec3<u32>) {
    let local_id = gid.x % 256u;
    let group_id = gid.x / 256u;
    let base_idx = group_id * 256u;
    
    if (base_idx >= params.vertex_count) {
        return;
    }
    
    // Parameters
    let array_length = min(256u, params.vertex_count - base_idx);
    let stride = 128u; // Will be decremented in loop
    let size = 256u;
    let sort_dir = false;
    
    let comparator_i = local_id & (array_length / 2u - 1u);
    let dir = sort_dir != ((comparator_i & (size / 2u)) != 0u);
    
    // Merge with decreasing stride
    for (var current_stride = stride; current_stride > 0u; current_stride = current_stride >> 1u) {
        workgroupBarrier();
        
        let pos = 2u * local_id - (local_id & (current_stride - 1u));
        if (pos + current_stride < array_length && base_idx + pos + current_stride < params.vertex_count) {
            var a = sort_data[base_idx + pos];
            var b = sort_data[base_idx + pos + current_stride];
            comparator(&a, &b, dir);
            sort_data[base_idx + pos] = a;
            sort_data[base_idx + pos + current_stride] = b;
        }
    }
}

// ============================================================================
// MULTI-PASS BITONIC SORT DISPATCH HELPER
// Call this with different parameters for each pass
// ============================================================================
struct BitonicParams {
    stage: u32,    // Which stage of the algorithm
    pass: u32,     // Which pass within the stage
    array_size: u32,
    direction: u32, // 0 for ascending, 1 for descending
}

@group(0) @binding(3) var<uniform> bitonic_params: BitonicParams;

@compute @workgroup_size(256)
fn bitonic_sort_pass(@builtin(global_invocation_id) gid: vec3<u32>) {
    let idx = gid.x;
    if (idx >= bitonic_params.array_size) {
        return;
    }
    
    // Calculate comparison partners based on stage/pass
    let stage_mask = 1u << bitonic_params.stage;
    let pass_mask = 1u << bitonic_params.pass;
    let partner = idx ^ pass_mask;
    
    // Only compare if we're the lower partner
    if (partner > idx && partner < bitonic_params.array_size) {
        let should_swap = ((idx & stage_mask) != 0u) != (bitonic_params.direction != 0u);
        
        if (should_swap) {
            var a = sort_data[idx];
            var b = sort_data[partner];
            
            // Swap if a > b for ascending
            if (a.key > b.key) {
                sort_data[idx] = b;
                sort_data[partner] = a;
            }
        } else {
            var a = sort_data[idx];
            var b = sort_data[partner];
            
            // Swap if a < b for descending
            if (a.key < b.key) {
                sort_data[idx] = b;
                sort_data[partner] = a;
            }
        }
    }
}

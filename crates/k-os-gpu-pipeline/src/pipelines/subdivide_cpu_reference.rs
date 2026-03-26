//! CPU Reference Implementation for Loop Subdivision
//!
//! This is a reference implementation used for testing GPU subdivision correctness.
//! It implements the Loop subdivision scheme with proper weights.

use std::collections::HashMap;

/// Edge key for deduplication (always stores min vertex first)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct EdgeKey(u32, u32);

impl EdgeKey {
    fn new(a: u32, b: u32) -> Self {
        if a < b {
            EdgeKey(a, b)
        } else {
            EdgeKey(b, a)
        }
    }
}

/// CPU Loop subdivision result
#[derive(Debug, Clone)]
pub struct CpuSubdivisionResult {
    pub positions: Vec<f32>,
    pub indices: Vec<u32>,
    pub vertex_count: usize,
    pub face_count: usize,
}

/// CPU reference implementation of Loop subdivision
pub fn cpu_subdivide_loop(
    positions: &[f32],
    indices: &[u32],
) -> Result<CpuSubdivisionResult, String> {
    let vertex_count = positions.len() / 3;
    let face_count = indices.len() / 3;

    if vertex_count == 0 || face_count == 0 {
        return Err("Empty mesh".to_string());
    }

    // Step 1: Build edge map and adjacency
    let mut edge_map: HashMap<EdgeKey, u32> = HashMap::new();
    let mut neighbors: Vec<Vec<u32>> = vec![Vec::new(); vertex_count];
    let mut edge_faces: HashMap<EdgeKey, Vec<u32>> = HashMap::new();
    let mut next_edge_idx = 0u32;

    for face_idx in 0..face_count {
        let i0 = indices[face_idx * 3];
        let i1 = indices[face_idx * 3 + 1];
        let i2 = indices[face_idx * 3 + 2];

        // Process each edge
        for &(a, b) in &[(i0, i1), (i1, i2), (i2, i0)] {
            let key = EdgeKey::new(a, b);

            // Assign unique edge index if new
            edge_map.entry(key).or_insert_with(|| {
                let idx = next_edge_idx;
                next_edge_idx += 1;
                idx
            });

            // Track which faces use this edge
            edge_faces
                .entry(key)
                .or_insert_with(Vec::new)
                .push(face_idx as u32);

            // Build adjacency (avoid duplicates)
            if !neighbors[a as usize].contains(&b) {
                neighbors[a as usize].push(b);
            }
            if !neighbors[b as usize].contains(&a) {
                neighbors[b as usize].push(a);
            }
        }
    }

    let edge_count = next_edge_idx;
    let new_vertex_count = vertex_count + edge_count as usize;
    let new_face_count = face_count * 4;

    // Step 2: Compute new vertex positions
    let mut new_positions = vec![0.0f32; new_vertex_count * 3];

    // 2a: Smooth original vertices using Loop weights
    for v in 0..vertex_count {
        let n = neighbors[v].len();

        if n == 0 {
            // Isolated vertex - keep original position
            new_positions[v * 3] = positions[v * 3];
            new_positions[v * 3 + 1] = positions[v * 3 + 1];
            new_positions[v * 3 + 2] = positions[v * 3 + 2];
            continue;
        }

        // Loop subdivision weights
        // beta = (1/n) * (5/8 - (3/8 + 1/4 * cos(2*pi/n))^2)
        let n_f = n as f32;
        let angle = 2.0 * std::f32::consts::PI / n_f;
        let beta = (1.0 / n_f) * (5.0 / 8.0 - (3.0 / 8.0 + 0.25 * angle.cos()).powi(2));
        let alpha = 1.0 - n_f * beta;

        let mut x = positions[v * 3] * alpha;
        let mut y = positions[v * 3 + 1] * alpha;
        let mut z = positions[v * 3 + 2] * alpha;

        // Add weighted neighbor contributions
        for &neighbor in &neighbors[v] {
            let nv = neighbor as usize;
            x += positions[nv * 3] * beta;
            y += positions[nv * 3 + 1] * beta;
            z += positions[nv * 3 + 2] * beta;
        }

        new_positions[v * 3] = x;
        new_positions[v * 3 + 1] = y;
        new_positions[v * 3 + 2] = z;
    }

    // 2b: Compute edge vertex positions
    for (edge_key, &edge_idx) in &edge_map {
        let v0 = edge_key.0 as usize;
        let v1 = edge_key.1 as usize;
        let new_v_idx = vertex_count + edge_idx as usize;

        // Get faces adjacent to this edge
        let adjacent_faces = edge_faces.get(edge_key).unwrap();

        if adjacent_faces.len() == 2 {
            // Interior edge: use 4 vertices (edge endpoints + 2 opposite vertices)
            let face0 = adjacent_faces[0] as usize;
            let face1 = adjacent_faces[1] as usize;

            // Find opposite vertices
            let mut opposite0 = None;
            let mut opposite1 = None;

            for i in 0..3 {
                let vi = indices[face0 * 3 + i];
                if vi != edge_key.0 && vi != edge_key.1 {
                    opposite0 = Some(vi as usize);
                    break;
                }
            }

            for i in 0..3 {
                let vi = indices[face1 * 3 + i];
                if vi != edge_key.0 && vi != edge_key.1 {
                    opposite1 = Some(vi as usize);
                    break;
                }
            }

            if let (Some(opp0), Some(opp1)) = (opposite0, opposite1) {
                // Loop subdivision edge weights: 3/8 for edge endpoints, 1/8 for opposite vertices
                let x = (positions[v0 * 3] + positions[v1 * 3]) * 3.0 / 8.0
                    + (positions[opp0 * 3] + positions[opp1 * 3]) * 1.0 / 8.0;
                let y = (positions[v0 * 3 + 1] + positions[v1 * 3 + 1]) * 3.0 / 8.0
                    + (positions[opp0 * 3 + 1] + positions[opp1 * 3 + 1]) * 1.0 / 8.0;
                let z = (positions[v0 * 3 + 2] + positions[v1 * 3 + 2]) * 3.0 / 8.0
                    + (positions[opp0 * 3 + 2] + positions[opp1 * 3 + 2]) * 1.0 / 8.0;

                new_positions[new_v_idx * 3] = x;
                new_positions[new_v_idx * 3 + 1] = y;
                new_positions[new_v_idx * 3 + 2] = z;
            } else {
                // Fallback: simple midpoint
                let x = (positions[v0 * 3] + positions[v1 * 3]) * 0.5;
                let y = (positions[v0 * 3 + 1] + positions[v1 * 3 + 1]) * 0.5;
                let z = (positions[v0 * 3 + 2] + positions[v1 * 3 + 2]) * 0.5;

                new_positions[new_v_idx * 3] = x;
                new_positions[new_v_idx * 3 + 1] = y;
                new_positions[new_v_idx * 3 + 2] = z;
            }
        } else {
            // Boundary edge: simple midpoint
            let x = (positions[v0 * 3] + positions[v1 * 3]) * 0.5;
            let y = (positions[v0 * 3 + 1] + positions[v1 * 3 + 1]) * 0.5;
            let z = (positions[v0 * 3 + 2] + positions[v1 * 3 + 2]) * 0.5;

            new_positions[new_v_idx * 3] = x;
            new_positions[new_v_idx * 3 + 1] = y;
            new_positions[new_v_idx * 3 + 2] = z;
        }
    }

    // Step 3: Build new index buffer (4 triangles per original)
    let mut new_indices = Vec::with_capacity(new_face_count * 3);

    for face_idx in 0..face_count {
        let i0 = indices[face_idx * 3];
        let i1 = indices[face_idx * 3 + 1];
        let i2 = indices[face_idx * 3 + 2];

        // Get edge vertex indices
        let e01 = vertex_count as u32 + edge_map[&EdgeKey::new(i0, i1)];
        let e12 = vertex_count as u32 + edge_map[&EdgeKey::new(i1, i2)];
        let e20 = vertex_count as u32 + edge_map[&EdgeKey::new(i2, i0)];

        // Triangle 1: corner 0
        new_indices.push(i0);
        new_indices.push(e01);
        new_indices.push(e20);

        // Triangle 2: corner 1
        new_indices.push(e01);
        new_indices.push(i1);
        new_indices.push(e12);

        // Triangle 3: corner 2
        new_indices.push(e20);
        new_indices.push(e12);
        new_indices.push(i2);

        // Triangle 4: center
        new_indices.push(e01);
        new_indices.push(e12);
        new_indices.push(e20);
    }

    Ok(CpuSubdivisionResult {
        positions: new_positions,
        indices: new_indices,
        vertex_count: new_vertex_count,
        face_count: new_face_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpu_subdivide_simple_triangle() {
        // Simple triangle
        let positions = vec![
            0.0, 0.0, 0.0, // v0
            1.0, 0.0, 0.0, // v1
            0.0, 1.0, 0.0, // v2
        ];
        let indices = vec![0, 1, 2];

        let result = cpu_subdivide_loop(&positions, &indices).unwrap();

        // Should have 6 vertices (3 original + 3 edge vertices)
        assert_eq!(result.vertex_count, 6);
        // Should have 4 faces
        assert_eq!(result.face_count, 4);
        // Should have 12 indices (4 triangles * 3)
        assert_eq!(result.indices.len(), 12);
    }

    #[test]
    fn test_cpu_subdivide_quad() {
        // Two triangles forming a quad
        let positions = vec![
            0.0, 0.0, 0.0, // v0
            1.0, 0.0, 0.0, // v1
            1.0, 1.0, 0.0, // v2
            0.0, 1.0, 0.0, // v3
        ];
        let indices = vec![
            0, 1, 2, // triangle 1
            0, 2, 3, // triangle 2
        ];

        let result = cpu_subdivide_loop(&positions, &indices).unwrap();

        // Should have 9 vertices (4 original + 5 edge vertices)
        assert_eq!(result.vertex_count, 9);
        // Should have 8 faces (2 * 4)
        assert_eq!(result.face_count, 8);
    }

    #[test]
    fn test_cpu_subdivide_empty_mesh() {
        let positions = vec![];
        let indices = vec![];

        let result = cpu_subdivide_loop(&positions, &indices);
        assert!(result.is_err());
    }
}

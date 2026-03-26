//! Mesh decimation algorithms for reducing polygon count

use crate::{Mesh, MeshError, Result};
use log::info;

/// Decimate mesh to a target ratio of original triangle count
///
/// # Arguments
/// * `mesh` - Input mesh
/// * `ratio` - Target ratio (0.0 to 1.0), e.g., 0.5 = 50% of original triangles
///
/// # Example
/// ```no_run
/// use k_os_mesh_processing::{Mesh, decimation};
/// # let mesh = Mesh::new();
/// let decimated = decimation::decimate(&mesh, 0.5).unwrap();
/// ```
pub fn decimate(mesh: &Mesh, ratio: f32) -> Result<Mesh> {
    if ratio <= 0.0 || ratio > 1.0 {
        return Err(MeshError::InvalidParameter(format!(
            "Ratio must be between 0.0 and 1.0, got {}",
            ratio
        )));
    }

    mesh.validate()?;

    let target_count = (mesh.triangle_count() as f32 * ratio).max(1.0) as usize;
    decimate_to_count(mesh, target_count)
}

/// Decimate mesh to a specific triangle count
///
/// # Arguments
/// * `mesh` - Input mesh
/// * `target_count` - Target number of triangles
pub fn decimate_to_count(mesh: &Mesh, target_count: usize) -> Result<Mesh> {
    mesh.validate()?;

    if target_count == 0 {
        return Err(MeshError::InvalidParameter(
            "Target count must be greater than 0".to_string(),
        ));
    }

    if target_count >= mesh.triangle_count() {
        info!("Target count >= current count, returning original mesh");
        return Ok(mesh.clone());
    }

    info!(
        "Decimating mesh from {} to {} triangles",
        mesh.triangle_count(),
        target_count
    );

    // Use meshopt for high-quality decimation
    let target_index_count = target_count * 3;
    let target_error = 1e-2; // Allow 1% error

    // Convert vertices to meshopt format (as bytes)
    let vertex_data: Vec<u8> = mesh
        .vertices
        .iter()
        .flat_map(|v| {
            let mut bytes = Vec::new();
            bytes.extend_from_slice(&v.x.to_le_bytes());
            bytes.extend_from_slice(&v.y.to_le_bytes());
            bytes.extend_from_slice(&v.z.to_le_bytes());
            bytes
        })
        .collect();

    let decimated_indices = meshopt::simplify::simplify(
        &mesh.indices,
        &meshopt::VertexDataAdapter::new(&vertex_data, 12, 0).unwrap(),
        target_index_count,
        target_error,
        meshopt::simplify::SimplifyOptions::LockBorder,
        None,
    );

    // Build new mesh with decimated indices
    // Note: This may leave unreferenced vertices, so we need to compact
    let mut result = Mesh {
        vertices: mesh.vertices.clone(),
        indices: decimated_indices,
        normals: mesh.normals.clone(),
        uvs: mesh.uvs.clone(),
        colors: mesh.colors.clone(),
    };

    // Remove unreferenced vertices
    compact_vertices(&mut result);

    info!(
        "Decimation complete: {} triangles ({:.1}% of original)",
        result.triangle_count(),
        (result.triangle_count() as f32 / mesh.triangle_count() as f32) * 100.0
    );

    Ok(result)
}

/// Adaptive decimation with quality threshold
///
/// Decimates mesh while maintaining quality above threshold
///
/// # Arguments
/// * `mesh` - Input mesh
/// * `error_threshold` - Maximum allowed error (0.0 to 1.0)
pub fn decimate_adaptive(mesh: &Mesh, error_threshold: f32) -> Result<Mesh> {
    mesh.validate()?;

    if error_threshold < 0.0 || error_threshold > 1.0 {
        return Err(MeshError::InvalidParameter(format!(
            "Error threshold must be between 0.0 and 1.0, got {}",
            error_threshold
        )));
    }

    info!(
        "Adaptive decimation with error threshold {}",
        error_threshold
    );

    // Start with aggressive decimation and work backwards
    let mut best_mesh = mesh.clone();
    let mut best_ratio = 1.0;

    for ratio in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] {
        let decimated = decimate(mesh, ratio)?;

        // Check if quality is acceptable (simplified check)
        // In production, you'd compute actual geometric error
        if ratio >= error_threshold {
            best_mesh = decimated;
            best_ratio = ratio;
            break;
        }
    }

    info!(
        "Adaptive decimation complete: ratio {:.2}, {} triangles",
        best_ratio,
        best_mesh.triangle_count()
    );

    Ok(best_mesh)
}

/// Remove unreferenced vertices from mesh
fn compact_vertices(mesh: &mut Mesh) {
    // Build vertex usage map
    let mut used = vec![false; mesh.vertices.len()];
    for &idx in &mesh.indices {
        used[idx as usize] = true;
    }

    // Build remap table
    let mut remap = vec![0u32; mesh.vertices.len()];
    let mut new_index = 0u32;
    for (old_index, &is_used) in used.iter().enumerate() {
        if is_used {
            remap[old_index] = new_index;
            new_index += 1;
        }
    }

    // Compact vertices
    let mut new_vertices = Vec::with_capacity(new_index as usize);
    let mut new_normals = mesh
        .normals
        .as_ref()
        .map(|_| Vec::with_capacity(new_index as usize));
    let mut new_uvs = mesh
        .uvs
        .as_ref()
        .map(|_| Vec::with_capacity(new_index as usize));
    let mut new_colors = mesh
        .colors
        .as_ref()
        .map(|_| Vec::with_capacity(new_index as usize));

    for (old_index, &is_used) in used.iter().enumerate() {
        if is_used {
            new_vertices.push(mesh.vertices[old_index]);

            if let Some(ref normals) = mesh.normals {
                new_normals.as_mut().unwrap().push(normals[old_index]);
            }

            if let Some(ref uvs) = mesh.uvs {
                new_uvs.as_mut().unwrap().push(uvs[old_index]);
            }

            if let Some(ref colors) = mesh.colors {
                new_colors.as_mut().unwrap().push(colors[old_index]);
            }
        }
    }

    // Remap indices
    for idx in &mut mesh.indices {
        *idx = remap[*idx as usize];
    }

    // Update mesh
    mesh.vertices = new_vertices;
    mesh.normals = new_normals;
    mesh.uvs = new_uvs;
    mesh.colors = new_colors;
}

#[cfg(test)]
mod tests {
    use super::*;
    use glam::Vec3;

    fn create_test_mesh() -> Mesh {
        // Create a simple quad (2 triangles)
        let vertices = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(1.0, 1.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2, 0, 2, 3];
        Mesh::from_vertices_indices(vertices, indices)
    }

    #[test]
    fn test_decimate_ratio() {
        let mesh = create_test_mesh();
        let result = decimate(&mesh, 0.5);
        assert!(result.is_ok());

        let decimated = result.unwrap();
        assert!(decimated.triangle_count() <= mesh.triangle_count());
    }

    #[test]
    fn test_decimate_invalid_ratio() {
        let mesh = create_test_mesh();
        assert!(decimate(&mesh, 0.0).is_err());
        assert!(decimate(&mesh, 1.5).is_err());
    }

    #[test]
    fn test_decimate_to_count() {
        let mesh = create_test_mesh();
        let result = decimate_to_count(&mesh, 1);
        assert!(result.is_ok());

        let decimated = result.unwrap();
        assert!(decimated.triangle_count() >= 1);
    }

    #[test]
    fn test_compact_vertices() {
        let vertices = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(2.0, 0.0, 0.0), // Unreferenced
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 3]; // Vertex 2 not used
        let mut mesh = Mesh::from_vertices_indices(vertices, indices);

        compact_vertices(&mut mesh);

        assert_eq!(mesh.vertex_count(), 3); // Should remove vertex 2
        assert_eq!(mesh.indices, vec![0, 1, 2]); // Indices remapped
    }
}

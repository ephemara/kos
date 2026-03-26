//! Instant Meshes Integration
//!
//! Shell out to Instant Meshes.exe for field-aligned quad/tri remeshing.
//! This provides ZBrush-quality retopology via external binary.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::Instant;

/// Parameters for Instant Meshes remeshing
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct InstantMeshesParams {
    /// Target face count (mutually exclusive with vertices and scale)
    pub target_faces: Option<u32>,
    /// Target vertex count (mutually exclusive with faces and scale)
    pub target_vertices: Option<u32>,
    /// Target edge length in world space (mutually exclusive with faces and vertices)
    pub target_scale: Option<f32>,
    /// Dihedral angle threshold for creases (degrees)
    pub crease_angle: Option<f32>,
    /// Number of smoothing iterations (default: 2)
    pub smooth_iterations: Option<u32>,
    /// Use deterministic (slower but reproducible) algorithms
    pub deterministic: bool,
    /// Align edges to mesh boundaries
    pub align_boundaries: bool,
    /// Orientation symmetry: 2 (lines), 4 (quads), 6 (triangles)
    pub rosy: Option<u32>,
    /// Position symmetry: 4 (quads) or 6 (triangles)
    pub posy: Option<u32>,
    /// Generate dominant mesh (mixed tris/quads) instead of pure
    pub dominant: bool,
    /// Use intrinsic mode (default is extrinsic)
    pub intrinsic: bool,
}

impl Default for InstantMeshesParams {
    fn default() -> Self {
        Self {
            target_faces: Some(5000),
            target_vertices: None,
            target_scale: None,
            crease_angle: Some(30.0),
            smooth_iterations: Some(2),
            deterministic: false,
            align_boundaries: true,
            rosy: Some(4), // Quad orientation
            posy: Some(4), // Quad positions
            dominant: false,
            intrinsic: false,
        }
    }
}

/// Result from Instant Meshes remeshing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstantMeshesResult {
    pub positions: Vec<f32>,
    pub indices: Vec<u32>,
    pub normals: Vec<f32>,
    pub time_ms: f64,
    pub input_vertices: usize,
    pub output_vertices: usize,
    pub output_faces: usize,
    pub is_quad_mesh: bool,
}

/// Get the path to Instant Meshes executable
fn get_instant_meshes_path() -> Result<PathBuf, String> {
    // First, try relative to exe (for packaged app)
    if let Ok(exe_dir) = std::env::current_exe() {
        let bundled = exe_dir
            .parent()
            .map(|p| p.join("resources").join("bin").join("Instant Meshes.exe"));
        if let Some(path) = bundled {
            if path.exists() {
                return Ok(path);
            }
        }
    }

    // Development path - relative to project root
    let dev_paths = [
        "IMPORTS/instantmeshes/Instant Meshes.exe",
        "../IMPORTS/instantmeshes/Instant Meshes.exe",
        "../../IMPORTS/instantmeshes/Instant Meshes.exe",
    ];

    for path in dev_paths {
        let p = PathBuf::from(path);
        if p.exists() {
            return Ok(p);
        }
    }

    // Try current working directory
    if let Ok(cwd) = std::env::current_dir() {
        let cwd_path = cwd.join("IMPORTS/instantmeshes/Instant Meshes.exe");
        if cwd_path.exists() {
            return Ok(cwd_path);
        }
    }

    Err("Instant Meshes.exe not found. Please ensure it's in IMPORTS/instantmeshes/".into())
}

/// Write mesh to temporary OBJ file
fn write_temp_obj(positions: &[f32], indices: &[u32]) -> Result<PathBuf, String> {
    let temp_dir = std::env::temp_dir().join("kos_instantmesh");
    fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let input_path = temp_dir.join("input.obj");
    let mut obj_content = String::new();

    // Write vertices
    for chunk in positions.chunks(3) {
        obj_content.push_str(&format!("v {} {} {}\n", chunk[0], chunk[1], chunk[2]));
    }

    // Write faces (OBJ is 1-indexed)
    for chunk in indices.chunks(3) {
        obj_content.push_str(&format!(
            "f {} {} {}\n",
            chunk[0] + 1,
            chunk[1] + 1,
            chunk[2] + 1
        ));
    }

    fs::write(&input_path, obj_content).map_err(|e| format!("Failed to write input OBJ: {}", e))?;
    Ok(input_path)
}

/// Read mesh from OBJ file
fn read_obj_file(path: &PathBuf) -> Result<(Vec<f32>, Vec<u32>, bool), String> {
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read output OBJ: {}", e))?;

    let mut positions = Vec::new();
    let mut indices = Vec::new();
    let mut is_quad = false;

    for line in content.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        match parts[0] {
            "v" if parts.len() >= 4 => {
                positions.push(parts[1].parse::<f32>().unwrap_or(0.0));
                positions.push(parts[2].parse::<f32>().unwrap_or(0.0));
                positions.push(parts[3].parse::<f32>().unwrap_or(0.0));
            }
            "f" => {
                // Parse face indices (handle "v/vt/vn" format)
                let face_indices: Vec<u32> = parts[1..]
                    .iter()
                    .filter_map(|p| {
                        p.split('/').next()?.parse::<u32>().ok().map(|i| i - 1) // OBJ is 1-indexed
                    })
                    .collect();

                if face_indices.len() == 4 {
                    // Quad - triangulate
                    is_quad = true;
                    indices.extend_from_slice(&[face_indices[0], face_indices[1], face_indices[2]]);
                    indices.extend_from_slice(&[face_indices[0], face_indices[2], face_indices[3]]);
                } else if face_indices.len() == 3 {
                    indices.extend_from_slice(&face_indices);
                } else if face_indices.len() > 4 {
                    // N-gon - fan triangulate
                    for i in 1..face_indices.len() - 1 {
                        indices.extend_from_slice(&[
                            face_indices[0],
                            face_indices[i],
                            face_indices[i + 1],
                        ]);
                    }
                }
            }
            _ => {}
        }
    }

    Ok((positions, indices, is_quad))
}

/// Compute vertex normals from faces
fn compute_normals(positions: &[f32], indices: &[u32]) -> Vec<f32> {
    use glam::Vec3;

    let vertex_count = positions.len() / 3;
    let mut normals = vec![0.0f32; vertex_count * 3];

    for tri in indices.chunks(3) {
        if tri.len() < 3 {
            continue;
        }
        let (i0, i1, i2) = (tri[0] as usize, tri[1] as usize, tri[2] as usize);

        if i0 * 3 + 2 >= positions.len()
            || i1 * 3 + 2 >= positions.len()
            || i2 * 3 + 2 >= positions.len()
        {
            continue;
        }

        let a = Vec3::new(
            positions[i0 * 3],
            positions[i0 * 3 + 1],
            positions[i0 * 3 + 2],
        );
        let b = Vec3::new(
            positions[i1 * 3],
            positions[i1 * 3 + 1],
            positions[i1 * 3 + 2],
        );
        let c = Vec3::new(
            positions[i2 * 3],
            positions[i2 * 3 + 1],
            positions[i2 * 3 + 2],
        );
        let face_normal = (b - a).cross(c - a);

        for idx in [i0, i1, i2] {
            normals[idx * 3] += face_normal.x;
            normals[idx * 3 + 1] += face_normal.y;
            normals[idx * 3 + 2] += face_normal.z;
        }
    }

    // Normalize
    for chunk in normals.chunks_mut(3) {
        let len = (chunk[0] * chunk[0] + chunk[1] * chunk[1] + chunk[2] * chunk[2]).sqrt();
        if len > 0.0001 {
            chunk[0] /= len;
            chunk[1] /= len;
            chunk[2] /= len;
        } else {
            chunk[1] = 1.0;
        }
    }

    normals
}

/// Run Instant Meshes on the given mesh
pub fn run_instant_meshes(
    positions: &[f32],
    indices: &[u32],
    params: &InstantMeshesParams,
) -> Result<InstantMeshesResult, String> {
    let start = Instant::now();
    let input_vertices = positions.len() / 3;

    // Get executable path
    let exe_path = get_instant_meshes_path()?;
    log::info!("[InstantMeshes] Using executable: {:?}", exe_path);

    // Write input mesh
    let input_path = write_temp_obj(positions, indices)?;
    let output_path = input_path.parent().unwrap().join("output.obj");

    // Build command
    let mut cmd = Command::new(&exe_path);
    cmd.arg(&input_path);
    cmd.args(["-o", output_path.to_str().unwrap()]);

    // Add parameters
    if let Some(f) = params.target_faces {
        cmd.args(["-f", &f.to_string()]);
    } else if let Some(v) = params.target_vertices {
        cmd.args(["-v", &v.to_string()]);
    } else if let Some(s) = params.target_scale {
        cmd.args(["-s", &s.to_string()]);
    }

    if let Some(c) = params.crease_angle {
        cmd.args(["-c", &c.to_string()]);
    }
    if let Some(s) = params.smooth_iterations {
        cmd.args(["-S", &s.to_string()]);
    }
    if let Some(r) = params.rosy {
        cmd.args(["-r", &r.to_string()]);
    }
    if let Some(p) = params.posy {
        cmd.args(["-p", &p.to_string()]);
    }

    if params.deterministic {
        cmd.arg("-d");
    }
    if params.align_boundaries {
        cmd.arg("-b");
    }
    if params.dominant {
        cmd.arg("-D");
    }
    if params.intrinsic {
        cmd.arg("-i");
    }

    log::info!("[InstantMeshes] Running: {:?}", cmd);

    // Run the command
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run Instant Meshes: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "Instant Meshes failed:\nstdout: {}\nstderr: {}",
            stdout, stderr
        ));
    }

    // Read output mesh
    let (out_positions, out_indices, is_quad) = read_obj_file(&output_path)?;
    let normals = compute_normals(&out_positions, &out_indices);

    let output_vertices = out_positions.len() / 3;
    let output_faces = out_indices.len() / 3;
    let time_ms = start.elapsed().as_secs_f64() * 1000.0;

    log::info!(
        "[InstantMeshes] {}v → {}v, {}t, {} in {:.1}ms",
        input_vertices,
        output_vertices,
        output_faces,
        if is_quad { "QUADS" } else { "TRIS" },
        time_ms
    );

    // Cleanup temp files
    let _ = fs::remove_file(&input_path);
    let _ = fs::remove_file(&output_path);

    Ok(InstantMeshesResult {
        positions: out_positions,
        indices: out_indices,
        normals,
        time_ms,
        input_vertices,
        output_vertices,
        output_faces,
        is_quad_mesh: is_quad,
    })
}

/// Tauri command for Instant Meshes remeshing
#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn instant_meshes_remesh(
    positions: Vec<f32>,
    indices: Vec<u32>,
    params: Option<InstantMeshesParams>,
) -> Result<InstantMeshesResult, String> {
    let p = params.unwrap_or_default();
    run_instant_meshes(&positions, &indices, &p)
}

/// Check if Instant Meshes is available
#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn instant_meshes_available() -> bool {
    get_instant_meshes_path().is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_instant_meshes() {
        // This will pass if the exe is in the expected location
        let result = get_instant_meshes_path();
        println!("Instant Meshes path: {:?}", result);
    }
}

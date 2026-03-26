//! CPU atlas unwrap and mesh classification helpers.

use serde::Serialize;
use xatlas::{ChartOptions, IndexFormat, MeshDecl, PackOptions, Xatlas};

#[derive(Serialize)]
pub struct AtlasResult {
    pub positions: Vec<f32>,
    pub indices: Vec<u32>,
    pub uvs: Vec<f32>,
}

pub fn unwrap_mesh_xatlas(positions: Vec<f32>, indices: Vec<u32>) -> Result<AtlasResult, String> {
    log::info!(
        "KAtlas: Starting XAtlas unwrap for {} verts, {} indices",
        positions.len() / 3,
        indices.len()
    );

    let vertex_count = positions.len() / 3;
    let face_count = indices.len() / 3;

    if vertex_count < 3 {
        return Err("Mesh has too few vertices (need at least 3)".to_string());
    }
    if face_count < 1 {
        return Err("Mesh has no faces".to_string());
    }

    for i in 0..face_count {
        let a = indices[i * 3] as usize;
        let b = indices[i * 3 + 1] as usize;
        let c = indices[i * 3 + 2] as usize;

        if a >= vertex_count || b >= vertex_count || c >= vertex_count {
            return Err(format!("Face {} has out-of-bounds vertex index", i));
        }
        if a == b || b == c || c == a {
            log::warn!("Face {} is degenerate (duplicate vertices)", i);
        }
    }

    log::info!("KAtlas: Mesh validation passed, calling xatlas...");

    let atlas = Xatlas::new();

    let mesh_decl = MeshDecl {
        vertex_position_data: unsafe {
            std::slice::from_raw_parts(positions.as_ptr() as *const u8, positions.len() * 4)
        },
        vertex_count: (positions.len() / 3) as u32,
        vertex_position_stride: 12,
        index_data: unsafe {
            std::slice::from_raw_parts(indices.as_ptr() as *const u8, indices.len() * 4)
        },
        index_count: indices.len() as u32,
        index_format: IndexFormat::Uint32,
        ..Default::default()
    };

    atlas.add_mesh(&mesh_decl);

    let chart_options = ChartOptions::default();
    let pack_options = PackOptions {
        padding: 2,
        ..Default::default()
    };

    atlas.generate_simple(chart_options, pack_options);

    let mut atlas_mut = atlas;
    let meshes = atlas_mut.meshes();

    if meshes.is_empty() {
        return Err("XAtlas failed to generate any meshes".to_string());
    }

    let mesh = &meshes[0];
    let vertex_count = mesh.vertices.len();
    let index_count = mesh.indices.len();

    let mut max_u: f32 = 0.0;
    let mut max_v: f32 = 0.0;
    for v in mesh.vertices {
        if v.uv[0] > max_u {
            max_u = v.uv[0];
        }
        if v.uv[1] > max_v {
            max_v = v.uv[1];
        }
    }

    let atlas_width = if max_u > 0.0 { max_u } else { 1.0 };
    let atlas_height = if max_v > 0.0 { max_v } else { 1.0 };

    log::info!(
        "KAtlas: Generation Complete. Verts: {}, Indices: {}, Charts: {}, Atlas bounds: {}x{}",
        vertex_count,
        index_count,
        mesh.charts.len(),
        atlas_width,
        atlas_height
    );

    let mut new_positions = Vec::with_capacity(vertex_count * 3);
    let mut new_uvs = Vec::with_capacity(vertex_count * 2);
    let new_indices: Vec<u32> = mesh.indices.to_vec();

    for v in mesh.vertices {
        let orig_idx = v.xref as usize;
        new_positions.push(positions[orig_idx * 3]);
        new_positions.push(positions[orig_idx * 3 + 1]);
        new_positions.push(positions[orig_idx * 3 + 2]);

        new_uvs.push(v.uv[0] / atlas_width);
        new_uvs.push(v.uv[1] / atlas_height);
    }

    log::info!(
        "KAtlas: Returning {} positions, {} indices, {} uvs (normalized)",
        new_positions.len() / 3,
        new_indices.len(),
        new_uvs.len() / 2
    );

    Ok(AtlasResult {
        positions: new_positions,
        indices: new_indices,
        uvs: new_uvs,
    })
}

#[derive(Serialize, Clone)]
pub struct ClassificationResult {
    pub classification: String,
    pub sharp_edge_percent: f32,
    pub avg_curvature: f32,
    pub planarity_score: f32,
    pub time_ms: f64,
}

pub fn classify_mesh(
    positions: Vec<f32>,
    indices: Vec<u32>,
) -> Result<ClassificationResult, String> {
    use std::collections::HashMap;
    use std::time::Instant;

    let start = Instant::now();

    let vertex_count = positions.len() / 3;
    let face_count = indices.len() / 3;

    if face_count < 4 {
        return Ok(ClassificationResult {
            classification: "ORGANIC".to_string(),
            sharp_edge_percent: 0.0,
            avg_curvature: 0.0,
            planarity_score: 0.0,
            time_ms: start.elapsed().as_secs_f64() * 1000.0,
        });
    }

    let get_pos = |idx: u32| -> [f32; 3] {
        let i = idx as usize;
        [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]
    };

    let cross = |a: [f32; 3], b: [f32; 3]| -> [f32; 3] {
        [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        ]
    };

    let normalize = |v: [f32; 3]| -> [f32; 3] {
        let len = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
        if len > 1e-10 {
            [v[0] / len, v[1] / len, v[2] / len]
        } else {
            [0.0, 0.0, 1.0]
        }
    };

    let dot = |a: [f32; 3], b: [f32; 3]| -> f32 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] };

    let sub = |a: [f32; 3], b: [f32; 3]| -> [f32; 3] { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] };

    let mut face_normals: Vec<[f32; 3]> = Vec::with_capacity(face_count);
    let mut edge_to_faces: HashMap<(u32, u32), Vec<usize>> = HashMap::new();
    let mut vert_to_faces: Vec<Vec<usize>> = vec![Vec::new(); vertex_count];

    let make_key = |a: u32, b: u32| -> (u32, u32) {
        if a < b {
            (a, b)
        } else {
            (b, a)
        }
    };

    for f in 0..face_count {
        let ia = indices[f * 3];
        let ib = indices[f * 3 + 1];
        let ic = indices[f * 3 + 2];

        let pa = get_pos(ia);
        let pb = get_pos(ib);
        let pc = get_pos(ic);

        let ab = sub(pb, pa);
        let ac = sub(pc, pa);
        let normal = normalize(cross(ab, ac));
        face_normals.push(normal);

        for &(a, b) in &[(ia, ib), (ib, ic), (ic, ia)] {
            edge_to_faces.entry(make_key(a, b)).or_default().push(f);
        }

        vert_to_faces[ia as usize].push(f);
        vert_to_faces[ib as usize].push(f);
        vert_to_faces[ic as usize].push(f);
    }

    let sharp_threshold = 60.0_f32.to_radians();
    let mut edge_angles: Vec<f32> = Vec::new();

    for faces in edge_to_faces.values() {
        if faces.len() == 2 {
            let n1 = face_normals[faces[0]];
            let n2 = face_normals[faces[1]];
            let d = dot(n1, n2).clamp(-1.0, 1.0);
            let angle = d.acos();
            edge_angles.push(angle);
        }
    }

    let sharp_edges = edge_angles
        .iter()
        .filter(|&&a| (std::f32::consts::PI - a).abs() > (std::f32::consts::PI - sharp_threshold))
        .count();
    let sharp_percent = if edge_angles.is_empty() {
        0.0
    } else {
        sharp_edges as f32 / edge_angles.len() as f32
    };

    let mut curvatures: Vec<f32> = Vec::new();

    for faces in &vert_to_faces {
        if faces.len() >= 3 {
            let mut avg = [0.0_f32; 3];
            for &f in faces {
                avg[0] += face_normals[f][0];
                avg[1] += face_normals[f][1];
                avg[2] += face_normals[f][2];
            }
            let avg = normalize(avg);

            let mut variance = 0.0_f32;
            for &f in faces {
                let diff = 1.0 - dot(face_normals[f], avg);
                variance += diff * diff;
            }
            curvatures.push((variance / faces.len() as f32).sqrt());
        }
    }

    let avg_curvature = if curvatures.is_empty() {
        0.0
    } else {
        curvatures.iter().sum::<f32>() / curvatures.len() as f32
    };

    let mut normal_variance = [0.0_f32; 3];
    for n in &face_normals {
        normal_variance[0] += n[0] * n[0];
        normal_variance[1] += n[1] * n[1];
        normal_variance[2] += n[2] * n[2];
    }
    normal_variance[0] /= face_count as f32;
    normal_variance[1] /= face_count as f32;
    normal_variance[2] /= face_count as f32;
    let var_len = (normal_variance[0] + normal_variance[1] + normal_variance[2]).sqrt();
    let planarity_score = 1.0 - (var_len / 3.0_f32.sqrt());

    let is_hard_surface = sharp_percent > 0.4 && avg_curvature < 0.15 && planarity_score > 0.6;
    let is_organic = sharp_percent < 0.2 && avg_curvature > 0.2;

    let classification = if is_hard_surface {
        "HARD_SURFACE"
    } else if is_organic {
        "ORGANIC"
    } else {
        "MIXED"
    }
    .to_string();

    let elapsed = start.elapsed().as_secs_f64() * 1000.0;

    log::info!(
        "KAtlas Classify: {} (sharp: {:.1}%, curv: {:.3}, planar: {:.3}) in {:.2}ms",
        classification,
        sharp_percent * 100.0,
        avg_curvature,
        planarity_score,
        elapsed
    );

    Ok(ClassificationResult {
        classification,
        sharp_edge_percent: sharp_percent,
        avg_curvature,
        planarity_score,
        time_ms: elapsed,
    })
}

#[derive(Serialize)]
pub struct UnwrapOptimizeResult {
    pub positions: Vec<f32>,
    pub normals: Vec<f32>,
    pub uvs: Vec<f32>,
    pub indices: Vec<u32>,
    pub vertex_count: usize,
    pub face_count: usize,
    pub chart_count: usize,
    pub time_ms: f64,
}

pub fn unwrap_and_optimize(
    positions: Vec<f32>,
    _normals: Vec<f32>,
    indices: Vec<u32>,
) -> Result<UnwrapOptimizeResult, String> {
    use std::time::Instant;

    let start = Instant::now();
    let atlas_result = unwrap_mesh_xatlas(positions.clone(), indices.clone())?;

    let vertex_count = atlas_result.positions.len() / 3;
    let face_count = atlas_result.indices.len() / 3;

    let mut new_normals = Vec::with_capacity(vertex_count * 3);
    for _ in 0..vertex_count {
        new_normals.push(0.0);
        new_normals.push(1.0);
        new_normals.push(0.0);
    }

    let elapsed = start.elapsed().as_secs_f64() * 1000.0;

    log::info!(
        "KAtlas UnwrapOptimize: {} verts, {} faces in {:.2}ms",
        vertex_count,
        face_count,
        elapsed
    );

    Ok(UnwrapOptimizeResult {
        positions: atlas_result.positions,
        normals: new_normals,
        uvs: atlas_result.uvs,
        indices: atlas_result.indices,
        vertex_count,
        face_count,
        chart_count: 0,
        time_ms: elapsed,
    })
}

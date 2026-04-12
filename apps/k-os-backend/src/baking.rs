use k_os_baking::map_types::NormalSpace;
/**
 * Baking Module - Tauri commands for texture baking
 *
 * Wraps the k-os-baking crate functionality for frontend access.
 */
use k_os_baking::{BakeMesh, BakeSettings, BakingSystem, MapType};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::State;

/// Global baking system instance
pub struct BakingState {
    system: Arc<Mutex<Option<BakingSystem>>>,
}

impl BakingState {
    pub fn new() -> Self {
        Self {
            system: Arc::new(Mutex::new(None)),
        }
    }
}

/// Mesh data structure for IPC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshData {
    pub positions: Vec<f32>,
    pub normals: Vec<f32>,
    pub tangents: Vec<f32>,
    pub uvs: Vec<f32>,
    pub indices: Vec<u32>,
}

impl From<MeshData> for BakeMesh {
    fn from(data: MeshData) -> Self {
        use glam::{Vec2, Vec3};

        // Convert flat arrays to Vec3/Vec2
        let vertices: Vec<Vec3> = data
            .positions
            .chunks(3)
            .map(|chunk| Vec3::new(chunk[0], chunk[1], chunk[2]))
            .collect();

        let normals: Vec<Vec3> = data
            .normals
            .chunks(3)
            .map(|chunk| Vec3::new(chunk[0], chunk[1], chunk[2]))
            .collect();

        let tangents: Vec<Vec3> = data
            .tangents
            .chunks(3)
            .map(|chunk| Vec3::new(chunk[0], chunk[1], chunk[2]))
            .collect();

        let uvs: Vec<Vec2> = data
            .uvs
            .chunks(2)
            .map(|chunk| Vec2::new(chunk[0], chunk[1]))
            .collect();

        BakeMesh {
            vertices,
            normals,
            tangents,
            uvs,
            indices: data.indices,
        }
    }
}

/// Bake settings for IPC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BakeSettingsData {
    pub resolution: u32,
    pub samples: u32,
    pub max_distance: f32,
    pub cage_extrusion: Option<f32>,
    pub normal_space: String,
    pub dilation_iterations: u32,
    pub enable_antialiasing: bool,
}

impl From<BakeSettingsData> for BakeSettings {
    fn from(data: BakeSettingsData) -> Self {
        let normal_space = match data.normal_space.as_str() {
            "object" => NormalSpace::Object,
            "world" => NormalSpace::World,
            _ => NormalSpace::Tangent,
        };

        BakeSettings {
            resolution: data.resolution,
            samples: data.samples,
            max_distance: data.max_distance,
            cage_extrusion: data.cage_extrusion,
            normal_space,
            dilation_iterations: data.dilation_iterations,
            enable_antialiasing: data.enable_antialiasing,
        }
    }
}

/// Bake result for IPC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BakeResultData {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

/// Initialize baking system
#[tauri::command]
pub async fn init_baking_system(state: State<'_, BakingState>) -> Result<(), String> {
    let mut system_lock = state.system.lock().map_err(|e| e.to_string())?;

    if system_lock.is_none() {
        *system_lock = Some(BakingSystem::new());
        log::info!("[Baking] System initialized");
    }

    Ok(())
}

/// Check if GPU acceleration is available
#[tauri::command]
pub async fn baking_has_gpu() -> Result<bool, String> {
    // For now, assume GPU is available if wgpu is compiled in
    Ok(true)
}

/// Bake normal map
#[tauri::command]
pub async fn bake_normal_map(
    high_poly: MeshData,
    low_poly: MeshData,
    settings: BakeSettingsData,
    state: State<'_, BakingState>,
) -> Result<BakeResultData, String> {
    let system_lock = state.system.lock().map_err(|e| e.to_string())?;
    let system = system_lock
        .as_ref()
        .ok_or("Baking system not initialized")?;

    let high_mesh: BakeMesh = high_poly.into();
    let low_mesh: BakeMesh = low_poly.into();
    let bake_settings: BakeSettings = settings.into();

    let image = system
        .bake_normal_map(&high_mesh, &low_mesh, &bake_settings)
        .map_err(|e| format!("Normal map baking failed: {}", e))?;

    Ok(BakeResultData {
        width: image.width(),
        height: image.height(),
        data: image.into_raw(),
    })
}

/// Bake ambient occlusion map
#[tauri::command]
pub async fn bake_ao_map(
    mesh: MeshData,
    settings: BakeSettingsData,
    state: State<'_, BakingState>,
) -> Result<BakeResultData, String> {
    let system_lock = state.system.lock().map_err(|e| e.to_string())?;
    let system = system_lock
        .as_ref()
        .ok_or("Baking system not initialized")?;

    let bake_mesh: BakeMesh = mesh.into();
    let bake_settings: BakeSettings = settings.into();

    let image = system
        .bake_ao_map(&bake_mesh, &bake_settings)
        .map_err(|e| format!("AO map baking failed: {}", e))?;

    Ok(BakeResultData {
        width: image.width(),
        height: image.height(),
        data: image.into_raw(),
    })
}

/// Bake curvature map
#[tauri::command]
pub async fn bake_curvature_map(
    mesh: MeshData,
    settings: BakeSettingsData,
    state: State<'_, BakingState>,
) -> Result<BakeResultData, String> {
    let system_lock = state.system.lock().map_err(|e| e.to_string())?;
    let system = system_lock
        .as_ref()
        .ok_or("Baking system not initialized")?;

    let bake_mesh: BakeMesh = mesh.into();
    let bake_settings: BakeSettings = settings.into();

    let image = system
        .bake_curvature_map(&bake_mesh, &bake_settings)
        .map_err(|e| format!("Curvature map baking failed: {}", e))?;

    Ok(BakeResultData {
        width: image.width(),
        height: image.height(),
        data: image.into_raw(),
    })
}

/// Bake thickness map
#[tauri::command]
pub async fn bake_thickness_map(
    mesh: MeshData,
    settings: BakeSettingsData,
    state: State<'_, BakingState>,
) -> Result<BakeResultData, String> {
    let system_lock = state.system.lock().map_err(|e| e.to_string())?;
    let system = system_lock
        .as_ref()
        .ok_or("Baking system not initialized")?;

    let bake_mesh: BakeMesh = mesh.into();
    let bake_settings: BakeSettings = settings.into();

    let image = system
        .bake_thickness_map(&bake_mesh, &bake_settings)
        .map_err(|e| format!("Thickness map baking failed: {}", e))?;

    Ok(BakeResultData {
        width: image.width(),
        height: image.height(),
        data: image.into_raw(),
    })
}

/// Bake position map
#[tauri::command]
pub async fn bake_position_map(
    mesh: MeshData,
    settings: BakeSettingsData,
    state: State<'_, BakingState>,
) -> Result<BakeResultData, String> {
    let system_lock = state.system.lock().map_err(|e| e.to_string())?;
    let system = system_lock
        .as_ref()
        .ok_or("Baking system not initialized")?;

    let bake_mesh: BakeMesh = mesh.into();
    let bake_settings: BakeSettings = settings.into();

    let image = system
        .bake_position_map(&bake_mesh, &bake_settings)
        .map_err(|e| format!("Position map baking failed: {}", e))?;

    Ok(BakeResultData {
        width: image.width(),
        height: image.height(),
        data: image.into_raw(),
    })
}

/// Bake material ID map
#[tauri::command]
pub async fn bake_id_map(
    mesh: MeshData,
    material_ids: Vec<u32>,
    settings: BakeSettingsData,
    state: State<'_, BakingState>,
) -> Result<BakeResultData, String> {
    let system_lock = state.system.lock().map_err(|e| e.to_string())?;
    let system = system_lock
        .as_ref()
        .ok_or("Baking system not initialized")?;

    let bake_mesh: BakeMesh = mesh.into();
    let bake_settings: BakeSettings = settings.into();

    let image = system
        .bake_id_map(&bake_mesh, &material_ids, &bake_settings)
        .map_err(|e| format!("ID map baking failed: {}", e))?;

    Ok(BakeResultData {
        width: image.width(),
        height: image.height(),
        data: image.into_raw(),
    })
}

/// Batch bake multiple map types
#[tauri::command]
pub async fn bake_batch(
    high_poly: Option<MeshData>,
    low_poly: MeshData,
    map_types: Vec<String>,
    settings: BakeSettingsData,
    state: State<'_, BakingState>,
) -> Result<Vec<(String, BakeResultData)>, String> {
    let system_lock = state.system.lock().map_err(|e| e.to_string())?;
    let system = system_lock
        .as_ref()
        .ok_or("Baking system not initialized")?;

    let high_mesh = high_poly.map(|m| m.into());
    let low_mesh: BakeMesh = low_poly.into();
    let bake_settings: BakeSettings = settings.into();

    // Convert map type strings to MapType enum
    let mut map_type_enums = Vec::new();
    for map_type_str in &map_types {
        let map_type = match map_type_str.as_str() {
            "normal" => MapType::Normal(NormalSpace::Tangent),
            "ao" => MapType::AmbientOcclusion,
            "curvature" => MapType::Curvature,
            "thickness" => MapType::Thickness,
            "position" => MapType::Position,
            "id" => MapType::MaterialId,
            _ => return Err(format!("Unknown map type: {}", map_type_str)),
        };
        map_type_enums.push(map_type);
    }

    // Bake all maps
    let results = system
        .bake_batch(
            high_mesh.as_ref(),
            &low_mesh,
            &map_type_enums,
            &bake_settings,
        )
        .map_err(|e| format!("Batch baking failed: {}", e))?;

    // Convert results to IPC format
    let mut output = Vec::new();
    for (map_type, image) in results {
        let map_type_str = match map_type {
            MapType::Normal(_) => "normal",
            MapType::AmbientOcclusion => "ao",
            MapType::Curvature => "curvature",
            MapType::Thickness => "thickness",
            MapType::Position => "position",
            MapType::MaterialId => "id",
        };

        output.push((
            map_type_str.to_string(),
            BakeResultData {
                width: image.width(),
                height: image.height(),
                data: image.into_raw(),
            },
        ));
    }

    Ok(output)
}

/// Generate cage mesh
#[tauri::command]
pub async fn generate_cage(mesh: MeshData, extrusion: f32) -> Result<MeshData, String> {
    let bake_mesh: BakeMesh = mesh.into();

    let cage = k_os_baking::generate_cage(&bake_mesh, extrusion)
        .map_err(|e| format!("Cage generation failed: {}", e))?;

    // Convert BakeMesh back to MeshData
    let positions: Vec<f32> = cage
        .vertices
        .iter()
        .flat_map(|v| vec![v.x, v.y, v.z])
        .collect();
    let normals: Vec<f32> = cage
        .normals
        .iter()
        .flat_map(|v| vec![v.x, v.y, v.z])
        .collect();
    let tangents: Vec<f32> = cage
        .tangents
        .iter()
        .flat_map(|v| vec![v.x, v.y, v.z])
        .collect();
    let uvs: Vec<f32> = cage.uvs.iter().flat_map(|v| vec![v.x, v.y]).collect();

    Ok(MeshData {
        positions,
        normals,
        tangents,
        uvs,
        indices: cage.indices,
    })
}

/// Generate adaptive cage mesh
#[tauri::command]
pub async fn generate_cage_adaptive(
    mesh: MeshData,
    min_extrusion: f32,
    max_extrusion: f32,
) -> Result<MeshData, String> {
    let bake_mesh: BakeMesh = mesh.into();

    let cage = k_os_baking::generate_cage_adaptive(&bake_mesh, min_extrusion, max_extrusion)
        .map_err(|e| format!("Adaptive cage generation failed: {}", e))?;

    // Convert BakeMesh back to MeshData
    let positions: Vec<f32> = cage
        .vertices
        .iter()
        .flat_map(|v| vec![v.x, v.y, v.z])
        .collect();
    let normals: Vec<f32> = cage
        .normals
        .iter()
        .flat_map(|v| vec![v.x, v.y, v.z])
        .collect();
    let tangents: Vec<f32> = cage
        .tangents
        .iter()
        .flat_map(|v| vec![v.x, v.y, v.z])
        .collect();
    let uvs: Vec<f32> = cage.uvs.iter().flat_map(|v| vec![v.x, v.y]).collect();

    Ok(MeshData {
        positions,
        normals,
        tangents,
        uvs,
        indices: cage.indices,
    })
}

/// Validate cage mesh
#[tauri::command]
pub async fn validate_cage(mesh: MeshData, cage: MeshData) -> Result<(bool, Vec<String>), String> {
    let bake_mesh: BakeMesh = mesh.into();
    let cage_mesh: BakeMesh = cage.into();

    let (valid, issues) = k_os_baking::validate_cage(&bake_mesh, &cage_mesh)
        .map_err(|e| format!("Cage validation failed: {}", e))?;

    Ok((valid, issues))
}

/// Calculate recommended extrusion distance
#[tauri::command]
pub async fn calculate_recommended_extrusion(mesh: MeshData) -> Result<f32, String> {
    let bake_mesh: BakeMesh = mesh.into();

    let extrusion = k_os_baking::calculate_recommended_extrusion(&bake_mesh)
        .map_err(|e| format!("Extrusion calculation failed: {}", e))?;

    Ok(extrusion)
}

/// Export settings for image export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSettings {
    pub format: String,              // "png", "exr", "tga"
    pub bit_depth: Option<u8>,       // 8 or 16 for PNG, ignored for EXR (always 32-bit float)
    pub compression: Option<String>, // "none", "fast", "best" for PNG
}

/// Export a single baked map to file
#[tauri::command]
pub async fn export_map(
    path: String,
    width: u32,
    height: u32,
    data: Vec<u8>,
    settings: ExportSettings,
) -> Result<(), String> {
    use image::{ImageBuffer, Rgb, Rgba, RgbaImage};
    use std::path::Path;

    let path = Path::new(&path);

    // Export based on format
    match settings.format.to_lowercase().as_str() {
        "png" => {
            // Create image buffer from data
            let img: RgbaImage = ImageBuffer::from_raw(width, height, data)
                .ok_or_else(|| "Failed to create image buffer from data".to_string())?;

            // Handle bit depth for PNG
            let bit_depth = settings.bit_depth.unwrap_or(8);

            if bit_depth == 16 {
                // Convert to 16-bit PNG
                let img16: ImageBuffer<Rgba<u16>, Vec<u16>> =
                    ImageBuffer::from_fn(width, height, |x, y| {
                        let pixel = img.get_pixel(x, y);
                        Rgba([
                            (pixel[0] as u16) << 8,
                            (pixel[1] as u16) << 8,
                            (pixel[2] as u16) << 8,
                            (pixel[3] as u16) << 8,
                        ])
                    });
                img16
                    .save(path)
                    .map_err(|e| format!("Failed to save 16-bit PNG: {}", e))?;
            } else {
                // Save as 8-bit PNG
                img.save(path)
                    .map_err(|e| format!("Failed to save PNG: {}", e))?;
            }
        }

        "exr" => {
            // Convert to 32-bit float EXR
            // Convert RGBA u8 to RGB f32 (drop alpha for simplicity)
            let float_img: ImageBuffer<Rgb<f32>, Vec<f32>> =
                ImageBuffer::from_fn(width, height, |x, y| {
                    let idx = ((y * width + x) * 4) as usize;
                    if idx + 2 < data.len() {
                        Rgb([
                            data[idx] as f32 / 255.0,
                            data[idx + 1] as f32 / 255.0,
                            data[idx + 2] as f32 / 255.0,
                        ])
                    } else {
                        Rgb([0.0, 0.0, 0.0])
                    }
                });

            float_img
                .save(path)
                .map_err(|e| format!("Failed to save EXR: {}", e))?;
        }

        "tga" => {
            // Save as TGA
            use image::codecs::tga::TgaEncoder;
            use std::fs::File;
            use std::io::BufWriter;

            let file =
                File::create(path).map_err(|e| format!("Failed to create TGA file: {}", e))?;
            let writer = BufWriter::new(file);
            let encoder = TgaEncoder::new(writer);

            encoder
                .encode(&data, width, height, image::ColorType::Rgba8.into())
                .map_err(|e| format!("Failed to encode TGA: {}", e))?;
        }

        _ => {
            return Err(format!("Unsupported export format: {}", settings.format));
        }
    }

    log::info!(
        "[Baking] Exported map to: {:?} ({}x{}, format: {})",
        path,
        width,
        height,
        settings.format
    );
    Ok(())
}

/// Export multiple maps in batch
#[tauri::command]
pub async fn export_maps_batch(
    base_path: String,
    maps: Vec<(String, u32, u32, Vec<u8>)>, // (map_type, width, height, data)
    settings: ExportSettings,
) -> Result<Vec<String>, String> {
    use std::path::Path;

    let base = Path::new(&base_path);
    let parent = base.parent().ok_or("Invalid base path")?;
    let stem = base
        .file_stem()
        .ok_or("Invalid file name")?
        .to_str()
        .ok_or("Invalid UTF-8 in filename")?;
    let ext = match settings.format.to_lowercase().as_str() {
        "png" => "png",
        "exr" => "exr",
        "tga" => "tga",
        _ => return Err(format!("Unsupported format: {}", settings.format)),
    };

    let mut exported_paths = Vec::new();

    for (map_type, width, height, data) in maps {
        // Generate filename: base_maptype.ext (e.g., "mesh_normal.png")
        let filename = format!("{}_{}.{}", stem, map_type, ext);
        let path = parent.join(filename);

        // Export the map
        export_map(
            path.to_str().ok_or("Invalid UTF-8 in path")?.to_string(),
            width,
            height,
            data,
            settings.clone(),
        )
        .await?;

        exported_paths.push(path.to_str().unwrap().to_string());
    }

    log::info!("[Baking] Batch exported {} maps", exported_paths.len());
    Ok(exported_paths)
}

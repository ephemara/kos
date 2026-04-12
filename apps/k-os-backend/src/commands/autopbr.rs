//! KAutoPBR Tauri Command Handlers
//!
//! This module provides Tauri IPC command handlers that wrap the MaterialSystem
//! methods, enabling the TypeScript frontend to interact with the Rust backend.

use crate::python_bridge::PythonBridge;
use k_os_material::autopbr::{Material, MaterialCategory, MaterialMetadata, MaterialSystem};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::State;
use uuid::Uuid;

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/// Global MaterialSystem state managed by Tauri
pub struct MaterialSystemState {
    system: Arc<Mutex<MaterialSystem>>,
}

impl MaterialSystemState {
    pub fn new(system: MaterialSystem) -> Self {
        Self {
            system: Arc::new(Mutex::new(system)),
        }
    }
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialMetadataRequest {
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub author: String,
    pub category: MaterialCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialHandle {
    pub id: String,
    pub metadata: MaterialMetadataResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialMetadataResponse {
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub author: String,
    pub created_at: String,
    pub modified_at: String,
    pub version: u32,
    pub category: MaterialCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: String,
    pub name: String,
    pub score: f32,
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

/// Create a new material with the given metadata
///
/// # Arguments
/// * `metadata` - Material metadata (name, description, tags, author, category)
///
/// # Returns
/// UUID of the created material as a string
///
/// # Requirements
/// Validates: Requirements 9.1, 9.2
#[tauri::command]
pub async fn create_material(
    state: State<'_, MaterialSystemState>,
    metadata: MaterialMetadataRequest,
) -> Result<String, String> {
    let mut system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    // Convert request to MaterialMetadata
    let material_metadata = MaterialMetadata {
        name: metadata.name,
        description: metadata.description,
        tags: metadata.tags,
        author: metadata.author,
        created_at: chrono::Utc::now(),
        modified_at: chrono::Utc::now(),
        version: 1,
        category: metadata.category,
    };

    // Create material
    let id = system
        .create_material(material_metadata)
        .map_err(|e| format!("Failed to create material: {}", e))?;

    Ok(id.to_string())
}

/// Load a material from a file path
///
/// # Arguments
/// * `path` - File path to the material JSON file
///
/// # Returns
/// MaterialHandle containing the material ID and metadata
///
/// # Requirements
/// Validates: Requirements 9.1, 9.2
#[tauri::command]
pub async fn load_material(
    state: State<'_, MaterialSystemState>,
    path: String,
) -> Result<MaterialHandle, String> {
    let mut system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    let path_buf = PathBuf::from(path);
    let id = system
        .load_material(&path_buf)
        .map_err(|e| format!("Failed to load material: {}", e))?;

    // Get the material to return its metadata
    let material = system
        .get_material(&id)
        .ok_or_else(|| "Material not found after loading".to_string())?;

    Ok(MaterialHandle {
        id: id.to_string(),
        metadata: MaterialMetadataResponse {
            name: material.metadata.name.clone(),
            description: material.metadata.description.clone(),
            tags: material.metadata.tags.clone(),
            author: material.metadata.author.clone(),
            created_at: material.metadata.created_at.to_rfc3339(),
            modified_at: material.metadata.modified_at.to_rfc3339(),
            version: material.metadata.version,
            category: material.metadata.category.clone(),
        },
    })
}

/// Save a material to a file path
///
/// # Arguments
/// * `id` - UUID of the material to save
/// * `path` - File path where the material should be saved
///
/// # Returns
/// Success message
///
/// # Requirements
/// Validates: Requirements 9.1, 9.2
#[tauri::command]
pub async fn save_material(
    state: State<'_, MaterialSystemState>,
    id: String,
    path: String,
) -> Result<String, String> {
    let system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    let uuid = Uuid::parse_str(&id).map_err(|e| format!("Invalid UUID: {}", e))?;
    let path_buf = PathBuf::from(path);

    system
        .save_material(uuid, &path_buf)
        .map_err(|e| format!("Failed to save material: {}", e))?;

    Ok(format!("Material saved to {}", path_buf.display()))
}

/// Delete a material from the system
///
/// # Arguments
/// * `id` - UUID of the material to delete
///
/// # Returns
/// Success message
///
/// # Requirements
/// Validates: Requirements 9.1, 9.2
#[tauri::command]
pub async fn delete_material(
    state: State<'_, MaterialSystemState>,
    id: String,
) -> Result<String, String> {
    let mut system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    let uuid = Uuid::parse_str(&id).map_err(|e| format!("Invalid UUID: {}", e))?;

    system
        .delete_material(uuid)
        .map_err(|e| format!("Failed to delete material: {}", e))?;

    Ok(format!("Material {} deleted", id))
}

/// Search materials by query string
///
/// # Arguments
/// * `query` - Search query (searches name, description, and tags)
/// * `category` - Optional category filter
///
/// # Returns
/// List of search results with material IDs, names, and relevance scores
///
/// # Requirements
/// Validates: Requirements 9.4, 9.5
#[tauri::command]
pub async fn search_materials(
    state: State<'_, MaterialSystemState>,
    query: String,
    category: Option<MaterialCategory>,
) -> Result<Vec<SearchResult>, String> {
    let system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    let results = if let Some(cat) = category {
        system.search_with_category(&query, Some(cat))
    } else {
        system.search_materials(&query)
    };

    // Get scored results for better ranking
    let scored_results = system.search_materials_scored(&query);

    // Convert to response format
    let search_results: Vec<SearchResult> = scored_results
        .into_iter()
        .map(|result| {
            let material = system.get_material(&result.material_id);
            SearchResult {
                id: result.material_id.to_string(),
                name: material
                    .map(|m| m.metadata.name.clone())
                    .unwrap_or_else(|| "Unknown".to_string()),
                score: result.score as f32,
            }
        })
        .collect();

    Ok(search_results)
}

/// Get material metadata by ID
///
/// # Arguments
/// * `id` - UUID of the material
///
/// # Returns
/// MaterialHandle containing the material ID and metadata
#[tauri::command]
pub async fn get_material(
    state: State<'_, MaterialSystemState>,
    id: String,
) -> Result<MaterialHandle, String> {
    let system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    let uuid = Uuid::parse_str(&id).map_err(|e| format!("Invalid UUID: {}", e))?;

    let material = system
        .get_material(&uuid)
        .ok_or_else(|| format!("Material {} not found", id))?;

    Ok(MaterialHandle {
        id: id,
        metadata: MaterialMetadataResponse {
            name: material.metadata.name.clone(),
            description: material.metadata.description.clone(),
            tags: material.metadata.tags.clone(),
            author: material.metadata.author.clone(),
            created_at: material.metadata.created_at.to_rfc3339(),
            modified_at: material.metadata.modified_at.to_rfc3339(),
            version: material.metadata.version,
            category: material.metadata.category.clone(),
        },
    })
}

/// Filter materials by category
///
/// # Arguments
/// * `category` - Material category to filter by
///
/// # Returns
/// List of material IDs matching the category
///
/// # Requirements
/// Validates: Requirements 9.5
#[tauri::command]
pub async fn filter_materials_by_category(
    state: State<'_, MaterialSystemState>,
    category: MaterialCategory,
) -> Result<Vec<String>, String> {
    let system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    let results = system.filter_materials(category);

    Ok(results.into_iter().map(|id| id.to_string()).collect())
}

/// List all materials in the system
///
/// # Returns
/// List of all material handles
#[tauri::command]
pub async fn list_materials(
    state: State<'_, MaterialSystemState>,
) -> Result<Vec<MaterialHandle>, String> {
    let system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    let handles: Vec<MaterialHandle> = system
        .materials()
        .iter()
        .map(|(id, material)| MaterialHandle {
            id: id.to_string(),
            metadata: MaterialMetadataResponse {
                name: material.metadata.name.clone(),
                description: material.metadata.description.clone(),
                tags: material.metadata.tags.clone(),
                author: material.metadata.author.clone(),
                created_at: material.metadata.created_at.to_rfc3339(),
                modified_at: material.metadata.modified_at.to_rfc3339(),
                version: material.metadata.version,
                category: material.metadata.category.clone(),
            },
        })
        .collect();

    Ok(handles)
}

/// Evaluate animation at a given time
///
/// # Arguments
/// * `material_id` - UUID of the material
/// * `time` - Time in seconds to evaluate animation at
///
/// # Returns
/// HashMap mapping animation parameter names to their values at the given time
///
/// # Requirements
/// Validates: Requirements 5.5, 5.7
#[tauri::command]
pub async fn evaluate_animation(
    state: State<'_, MaterialSystemState>,
    material_id: String,
    time: f32,
) -> Result<HashMap<String, f32>, String> {
    let system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    let uuid = Uuid::parse_str(&material_id).map_err(|e| format!("Invalid UUID: {}", e))?;

    // Get the material
    let material = system
        .get_material(&uuid)
        .ok_or_else(|| format!("Material {} not found", material_id))?;

    // Check if material has animation data
    let animation_data = material
        .animation
        .as_ref()
        .ok_or_else(|| format!("Material {} has no animation data", material_id))?;

    // Evaluate animation at the given time
    let result = system
        .evaluate_animation(&uuid, time)
        .map_err(|e| format!("Failed to evaluate animation: {}", e))?;

    // Convert AnimationParameter enum keys to string keys for JSON serialization
    let string_result: HashMap<String, f32> = result
        .into_iter()
        .map(|(param, value)| {
            let param_name = match param {
                k_os_material::autopbr::animation::AnimationParameter::AlbedoColor => "albedoColor",
                k_os_material::autopbr::animation::AnimationParameter::AlbedoRed => "albedoRed",
                k_os_material::autopbr::animation::AnimationParameter::AlbedoGreen => "albedoGreen",
                k_os_material::autopbr::animation::AnimationParameter::AlbedoBlue => "albedoBlue",
                k_os_material::autopbr::animation::AnimationParameter::Roughness => "roughness",
                k_os_material::autopbr::animation::AnimationParameter::Metallic => "metallic",
                k_os_material::autopbr::animation::AnimationParameter::EmissiveIntensity => {
                    "emissiveIntensity"
                }
                k_os_material::autopbr::animation::AnimationParameter::EmissiveColor => {
                    "emissiveColor"
                }
                k_os_material::autopbr::animation::AnimationParameter::HeightOffset => {
                    "heightOffset"
                }
                k_os_material::autopbr::animation::AnimationParameter::NormalStrength => {
                    "normalStrength"
                }
                k_os_material::autopbr::animation::AnimationParameter::UVOffsetX => "uvOffsetX",
                k_os_material::autopbr::animation::AnimationParameter::UVOffsetY => "uvOffsetY",
                k_os_material::autopbr::animation::AnimationParameter::UVScaleX => "uvScaleX",
                k_os_material::autopbr::animation::AnimationParameter::UVScaleY => "uvScaleY",
                k_os_material::autopbr::animation::AnimationParameter::LayerOpacity => {
                    "layerOpacity"
                }
                k_os_material::autopbr::animation::AnimationParameter::LayerBlendMode => {
                    "layerBlendMode"
                }
            };
            (param_name.to_string(), value)
        })
        .collect();

    Ok(string_result)
}

// ============================================================================
// ANIMATION PRESET COMMANDS
// ============================================================================

/// List all available animation presets
///
/// # Returns
/// List of preset names sorted alphabetically
///
/// # Requirements
/// Validates: Requirements 14.2, 18.2
#[tauri::command]
pub async fn list_animation_presets(
    state: State<'_, MaterialSystemState>,
) -> Result<Vec<String>, String> {
    let system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    Ok(system.list_animation_presets())
}

/// Get an animation preset by name
///
/// # Arguments
/// * `name` - Name of the preset to retrieve
///
/// # Returns
/// Animation preset with all metadata and animation data
///
/// # Requirements
/// Validates: Requirements 14.2, 14.8
#[tauri::command]
pub async fn get_animation_preset(
    state: State<'_, MaterialSystemState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    let preset = system
        .get_animation_preset(&name)
        .ok_or_else(|| format!("Preset '{}' not found", name))?;

    // Serialize preset to JSON value for frontend
    serde_json::to_value(&preset).map_err(|e| format!("Failed to serialize preset: {}", e))
}

/// Apply an animation preset to a material
///
/// # Arguments
/// * `material_id` - UUID of the material to apply preset to
/// * `preset_name` - Name of the preset to apply
///
/// # Returns
/// Success message
///
/// # Requirements
/// Validates: Requirements 14.2, 14.4, 14.7
#[tauri::command]
pub async fn apply_animation_preset(
    state: State<'_, MaterialSystemState>,
    material_id: String,
    preset_name: String,
) -> Result<String, String> {
    let mut system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    let uuid = Uuid::parse_str(&material_id).map_err(|e| format!("Invalid UUID: {}", e))?;

    system
        .apply_preset(uuid, &preset_name)
        .map_err(|e| format!("Failed to apply preset: {}", e))?;

    Ok(format!(
        "Applied preset '{}' to material {}",
        preset_name, material_id
    ))
}

/// Search animation presets by name or tags
///
/// # Arguments
/// * `query` - Search query (case-insensitive)
///
/// # Returns
/// List of preset names matching the query
///
/// # Requirements
/// Validates: Requirements 14.9
#[tauri::command]
pub async fn search_animation_presets(
    state: State<'_, MaterialSystemState>,
    query: String,
) -> Result<Vec<String>, String> {
    let system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    Ok(system.search_animation_presets(&query))
}

/// List animation presets filtered by category
///
/// # Arguments
/// * `category` - Category to filter by (e.g., "Sci-Fi", "Organic", "Effects")
///
/// # Returns
/// List of preset names in the specified category
///
/// # Requirements
/// Validates: Requirements 14.3, 14.9
#[tauri::command]
pub async fn list_animation_presets_by_category(
    state: State<'_, MaterialSystemState>,
    category: String,
) -> Result<Vec<String>, String> {
    let system = state
        .system
        .lock()
        .map_err(|e| format!("Failed to lock MaterialSystem: {}", e))?;

    Ok(system.list_animation_presets_by_category(&category))
}
// ============================================================================
// AI/ML INTEGRATION COMMANDS
// ============================================================================

/// Upscale a texture using AI (Real-ESRGAN)
///
/// # Arguments
/// * `image_base64` - Base64-encoded input image (PNG/JPEG)
/// * `scale_factor` - Upscaling factor (2, 4, or 8)
///
/// # Returns
/// Base64-encoded upscaled image (PNG)
///
/// # Requirements
/// Validates: Requirements 11.1, 11.2
#[tauri::command]
pub async fn ai_upscale_texture(
    python: State<'_, PythonBridge>,
    image_base64: String,
    scale_factor: u32,
) -> Result<String, String> {
    use crate::python_bridge::python_call;

    if scale_factor != 2 && scale_factor != 4 && scale_factor != 8 {
        return Err(format!(
            "Invalid scale factor: {}. Must be 2, 4, or 8",
            scale_factor
        ));
    }

    let params = json!({
        "image_base64": image_base64,
        "scale_factor": scale_factor
    });

    let result = python_call(python, "upscale_texture".to_string(), params)
        .await
        .map_err(|e| format!("AI upscaling failed: {}", e))?;

    result
        .as_str()
        .ok_or_else(|| "Invalid response from Python".to_string())
        .map(|s| s.to_string())
}

/// Denoise a texture using AI (NAFNet)
///
/// # Arguments
/// * `image_base64` - Base64-encoded input image
/// * `strength` - Denoising strength (0.0-1.0)
///
/// # Returns
/// Base64-encoded denoised image (PNG)
///
/// # Requirements
/// Validates: Requirements 11.4, 11.5
#[tauri::command]
pub async fn ai_denoise_texture(
    python: State<'_, PythonBridge>,
    image_base64: String,
    strength: f32,
) -> Result<String, String> {
    use crate::python_bridge::python_call;

    if !(0.0..=1.0).contains(&strength) {
        return Err(format!(
            "Invalid strength: {}. Must be between 0.0 and 1.0",
            strength
        ));
    }

    let params = json!({
        "image_base64": image_base64,
        "strength": strength
    });

    let result = python_call(python, "denoise_texture".to_string(), params)
        .await
        .map_err(|e| format!("AI denoising failed: {}", e))?;

    result
        .as_str()
        .ok_or_else(|| "Invalid response from Python".to_string())
        .map(|s| s.to_string())
}

/// Identify material type using AI (CLIP)
///
/// # Arguments
/// * `image_base64` - Base64-encoded input image
///
/// # Returns
/// JSON object with "category" (string) and "confidence" (float) fields
///
/// # Requirements
/// Validates: Requirements 11.6, 11.7, 11.8
#[tauri::command]
pub async fn ai_identify_material(
    python: State<'_, PythonBridge>,
    image_base64: String,
) -> Result<Value, String> {
    use crate::python_bridge::python_call;

    let params = json!({
        "image_base64": image_base64
    });

    let result = python_call(python, "identify_material".to_string(), params)
        .await
        .map_err(|e| format!("Material identification failed: {}", e))?;

    Ok(result)
}

/// Make texture seamless using AI inpainting (Stable Diffusion)
///
/// # Arguments
/// * `image_base64` - Base64-encoded input image
/// * `strength` - Inpainting strength (0.0-1.0), default 0.8
///
/// # Returns
/// Base64-encoded seamless texture (PNG)
///
/// # Requirements
/// Validates: Requirements 4.1, 4.2, 4.3, 4.7, 4.9
#[tauri::command]
pub async fn ai_make_seamless(
    python: State<'_, PythonBridge>,
    image_base64: String,
    strength: Option<f32>,
) -> Result<String, String> {
    use crate::python_bridge::python_call;

    let strength_val = strength.unwrap_or(0.8);

    if !(0.0..=1.0).contains(&strength_val) {
        return Err(format!(
            "Invalid strength: {}. Must be between 0.0 and 1.0",
            strength_val
        ));
    }

    let params = json!({
        "image_base64": image_base64,
        "strength": strength_val
    });

    let result = python_call(python, "make_seamless".to_string(), params)
        .await
        .map_err(|e| format!("Seamless tiling failed: {}", e))?;

    result
        .as_str()
        .ok_or_else(|| "Invalid response from Python".to_string())
        .map(|s| s.to_string())
}

/// Correct perspective distortion in texture using AI
///
/// # Arguments
/// * `image_base64` - Base64-encoded input image
///
/// # Returns
/// Base64-encoded corrected image (PNG)
///
/// # Requirements
/// Validates: Requirements 4.5
#[tauri::command]
pub async fn ai_correct_perspective(
    python: State<'_, PythonBridge>,
    image_base64: String,
) -> Result<String, String> {
    use crate::python_bridge::python_call;

    let params = json!({
        "image_base64": image_base64
    });

    let result = python_call(python, "correct_perspective".to_string(), params)
        .await
        .map_err(|e| format!("Perspective correction failed: {}", e))?;

    result
        .as_str()
        .ok_or_else(|| "Invalid response from Python".to_string())
        .map(|s| s.to_string())
}

/// Remove fold artifacts from fabric textures using AI
///
/// # Arguments
/// * `image_base64` - Base64-encoded input image
///
/// # Returns
/// Base64-encoded fold-free image (PNG)
///
/// # Requirements
/// Validates: Requirements 4.4
#[tauri::command]
pub async fn ai_remove_folds(
    python: State<'_, PythonBridge>,
    image_base64: String,
) -> Result<String, String> {
    use crate::python_bridge::python_call;

    let params = json!({
        "image_base64": image_base64
    });

    let result = python_call(python, "remove_folds".to_string(), params)
        .await
        .map_err(|e| format!("Fold removal failed: {}", e))?;

    result
        .as_str()
        .ok_or_else(|| "Invalid response from Python".to_string())
        .map(|s| s.to_string())
}

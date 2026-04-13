// Tauri Commands for HDR Capture System

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

use k_os_gpu_pipeline::device::GpuComputeDevice as GpuCompute;
use k_os_hdr::{
    HDRCapture, HDRError, HDRFormat, HDRImage, HDRMergeInput, Light, LightType, ToneMappingMethod,
};

fn clone_global_gpu_compute() -> Arc<GpuCompute> {
    let gpu = GpuCompute::get_or_init_blocking().expect("GPU init failed");
    let gpu = gpu.lock();
    Arc::new(GpuCompute {
        device: gpu.device.clone(),
        queue: gpu.queue.clone(),
        adapter_info: gpu.adapter_info.clone(),
        force_sync: gpu.force_sync,
    })
}

/// HDR system state
pub struct HDRState {
    pub capture: Arc<HDRCapture>,
}

impl HDRState {
    pub fn new(_gpu_compute: Arc<GpuCompute>) -> Self {
        Self {
            capture: Arc::new(HDRCapture::new(clone_global_gpu_compute())),
        }
    }
}

/// Serializable light data for IPC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LightData {
    pub light_type: String, // "point", "directional", "area"
    pub position: [f32; 3],
    pub direction: [f32; 3],
    pub intensity: f32,
    pub color_temperature: f32,
    pub area_width: Option<f32>,
    pub area_height: Option<f32>,
}

/// Exposure data for HDR merging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExposureData {
    pub image_data: Vec<u8>,
    pub exposure_value: f32,
}

/// HDR merge request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HDRMergeRequest {
    pub exposures: Vec<ExposureData>,
    pub width: u32,
    pub height: u32,
}

/// Merge multiple exposures into HDR image
#[tauri::command]
pub async fn hdr_merge_exposures(
    request: HDRMergeRequest,
    state: State<'_, HDRState>,
) -> Result<String, String> {
    let input = HDRMergeInput {
        exposures: request
            .exposures
            .into_iter()
            .map(|e| (e.image_data, e.exposure_value))
            .collect(),
        width: request.width,
        height: request.height,
    };

    let hdr = state
        .capture
        .merge_exposures(input)
        .map_err(|e| format!("HDR merge failed: {}", e))?;

    // Save to temporary file and return path
    let temp_path = std::env::temp_dir().join(format!("hdr_merge_{}.hdr", uuid::Uuid::new_v4()));

    state
        .capture
        .save(&hdr, &temp_path)
        .map_err(|e| format!("Failed to save HDR: {}", e))?;

    Ok(temp_path.to_string_lossy().to_string())
}

/// Apply tone mapping to HDR image
#[tauri::command]
pub async fn hdr_tone_map(
    hdr_path: String,
    method: String,
    state: State<'_, HDRState>,
) -> Result<Vec<u8>, String> {
    let path = PathBuf::from(hdr_path);

    let hdr = state
        .capture
        .load(&path)
        .map_err(|e| format!("Failed to load HDR: {}", e))?;

    let tone_method = match method.to_lowercase().as_str() {
        "reinhard" => ToneMappingMethod::Reinhard,
        "filmic" => ToneMappingMethod::Filmic,
        "aces" => ToneMappingMethod::ACES,
        "uncharted2" => ToneMappingMethod::Uncharted2,
        _ => return Err(format!("Unknown tone mapping method: {}", method)),
    };

    state
        .capture
        .tone_map(&hdr, tone_method)
        .map_err(|e| format!("Tone mapping failed: {}", e))
}

/// Add light to HDR environment
#[tauri::command]
pub async fn hdr_add_light(
    hdr_path: String,
    light_data: LightData,
    state: State<'_, HDRState>,
) -> Result<String, String> {
    let path = PathBuf::from(hdr_path);

    let mut hdr = state
        .capture
        .load(&path)
        .map_err(|e| format!("Failed to load HDR: {}", e))?;

    // Convert light data to Light struct
    let light = convert_light_data(light_data)?;

    state
        .capture
        .add_light(&mut hdr, &light)
        .map_err(|e| format!("Failed to add light: {}", e))?;

    // Save modified HDR
    let output_path = std::env::temp_dir().join(format!("hdr_lit_{}.hdr", uuid::Uuid::new_v4()));

    state
        .capture
        .save(&hdr, &output_path)
        .map_err(|e| format!("Failed to save HDR: {}", e))?;

    Ok(output_path.to_string_lossy().to_string())
}

/// Convert panorama to HDR
#[tauri::command]
pub async fn hdr_panorama_to_hdr(
    image_data: Vec<u8>,
    width: u32,
    height: u32,
    state: State<'_, HDRState>,
) -> Result<String, String> {
    let hdr = state
        .capture
        .panorama_to_hdr(&image_data, width, height)
        .map_err(|e| format!("Panorama conversion failed: {}", e))?;

    let output_path = std::env::temp_dir().join(format!("hdr_pano_{}.hdr", uuid::Uuid::new_v4()));

    state
        .capture
        .save(&hdr, &output_path)
        .map_err(|e| format!("Failed to save HDR: {}", e))?;

    Ok(output_path.to_string_lossy().to_string())
}

/// Save HDR image
#[tauri::command]
pub async fn hdr_save(
    hdr_path: String,
    output_path: String,
    state: State<'_, HDRState>,
) -> Result<(), String> {
    let input = PathBuf::from(hdr_path);
    let output = PathBuf::from(output_path);

    let hdr = state
        .capture
        .load(&input)
        .map_err(|e| format!("Failed to load HDR: {}", e))?;

    state
        .capture
        .save(&hdr, &output)
        .map_err(|e| format!("Failed to save HDR: {}", e))
}

/// Load HDR image
#[tauri::command]
pub async fn hdr_load(path: String, state: State<'_, HDRState>) -> Result<HDRImageData, String> {
    let path = PathBuf::from(path);

    let hdr = state
        .capture
        .load(&path)
        .map_err(|e| format!("Failed to load HDR: {}", e))?;

    Ok(HDRImageData {
        width: hdr.width,
        height: hdr.height,
        format: match hdr.format {
            HDRFormat::RadianceRGBE => "rgbe".to_string(),
            HDRFormat::OpenEXR => "exr".to_string(),
        },
    })
}

/// HDR image metadata for IPC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HDRImageData {
    pub width: u32,
    pub height: u32,
    pub format: String,
}

/// Convert LightData to Light
fn convert_light_data(data: LightData) -> Result<Light, String> {
    use nalgebra::Vector3;

    let position = Vector3::new(data.position[0], data.position[1], data.position[2]);
    let direction = Vector3::new(data.direction[0], data.direction[1], data.direction[2]);

    match data.light_type.to_lowercase().as_str() {
        "point" => Light::point(position, data.intensity, data.color_temperature)
            .map_err(|e| format!("Invalid point light: {}", e)),

        "directional" => Light::directional(direction, data.intensity, data.color_temperature)
            .map_err(|e| format!("Invalid directional light: {}", e)),

        "area" => {
            let width = data.area_width.ok_or("Area light missing width")?;
            let height = data.area_height.ok_or("Area light missing height")?;

            Light::area(
                position,
                direction,
                width,
                height,
                data.intensity,
                data.color_temperature,
            )
            .map_err(|e| format!("Invalid area light: {}", e))
        }

        _ => Err(format!("Unknown light type: {}", data.light_type)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_light_data_conversion() {
        let point_light = LightData {
            light_type: "point".to_string(),
            position: [1.0, 2.0, 3.0],
            direction: [0.0, 0.0, 0.0],
            intensity: 1000.0,
            color_temperature: 6500.0,
            area_width: None,
            area_height: None,
        };

        assert!(convert_light_data(point_light).is_ok());

        let area_light = LightData {
            light_type: "area".to_string(),
            position: [0.0, 0.0, 0.0],
            direction: [0.0, 1.0, 0.0],
            intensity: 5000.0,
            color_temperature: 5000.0,
            area_width: Some(2.0),
            area_height: Some(2.0),
        };

        assert!(convert_light_data(area_light).is_ok());
    }
}

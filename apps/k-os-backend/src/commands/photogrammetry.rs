//! Photogrammetry Tauri Commands
//!
//! IPC commands for photogrammetry reconstruction pipeline.

use tauri::State;
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};

#[cfg(feature = "photogrammetry")]
use k_os_photogrammetry::{
    PhotogrammetryPipeline, PhotogrammetryInput, PhotogrammetryOutput,
    ImageData, CameraIntrinsics, ReconstructionOptions,
};
use k_os_gpu_pipeline::device::GpuComputeDevice as GpuCompute;

/// Photogrammetry state
pub struct PhotogrammetryState {
    #[cfg(feature = "photogrammetry")]
    pipeline: Option<PhotogrammetryPipeline>,
    gpu_compute: Arc<GpuCompute>,
}

impl PhotogrammetryState {
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Self {
        #[cfg(feature = "photogrammetry")]
        let pipeline = PhotogrammetryPipeline::new(gpu_compute.clone()).ok();
        
        Self {
            #[cfg(feature = "photogrammetry")]
            pipeline,
            gpu_compute,
        }
    }
}

/// Reconstruct 3D model from multi-angle photos
#[tauri::command]
#[cfg(feature = "photogrammetry")]
pub async fn photogrammetry_reconstruct(
    input: PhotogrammetryInput,
    state: State<'_, Arc<Mutex<PhotogrammetryState>>>,
) -> Result<PhotogrammetryOutput, String> {
    let state = state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
    
    let pipeline = state.pipeline.as_ref()
        .ok_or_else(|| "Photogrammetry pipeline not initialized".to_string())?;
    
    pipeline.reconstruct(input)
        .map_err(|e| format!("Reconstruction failed: {}", e))
}

/// Get photogrammetry pipeline status
#[tauri::command]
pub async fn photogrammetry_status(
    state: State<'_, Arc<Mutex<PhotogrammetryState>>>,
) -> Result<PhotogrammetryStatus, String> {
    #[cfg(feature = "photogrammetry")]
    {
        let state = state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
        Ok(PhotogrammetryStatus {
            available: state.pipeline.is_some(),
            gpu_available: true,
        })
    }
    
    #[cfg(not(feature = "photogrammetry"))]
    {
        Ok(PhotogrammetryStatus {
            available: false,
            gpu_available: false,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotogrammetryStatus {
    pub available: bool,
    pub gpu_available: bool,
}

/// Save photogrammetry output to material library
#[tauri::command]
#[cfg(feature = "photogrammetry")]
pub async fn photogrammetry_save_to_library(
    output: PhotogrammetryOutput,
    material_name: String,
    state: State<'_, Arc<Mutex<PhotogrammetryState>>>,
) -> Result<String, String> {
    // TODO: Integrate with Asset Manager to save mesh and PBR maps
    log::info!("Saving photogrammetry output '{}' to material library", material_name);
    
    // For now, return a placeholder UUID
    Ok(uuid::Uuid::new_v4().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_photogrammetry_status_creation() {
        let status = PhotogrammetryStatus {
            available: true,
            gpu_available: true,
        };
        
        assert!(status.available);
        assert!(status.gpu_available);
    }
}

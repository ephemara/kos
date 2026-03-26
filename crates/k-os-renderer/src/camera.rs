use crate::types::{CameraState, RendererError};

pub fn validate_camera(camera: &CameraState) -> Result<(), RendererError> {
    if !(camera.fov_degrees > 0.0 && camera.fov_degrees < 180.0) {
        return Err(RendererError::InvalidCamera(
            "fov_degrees must be in the range (0, 180)".to_string(),
        ));
    }

    if camera.near <= 0.0 {
        return Err(RendererError::InvalidCamera(
            "near plane must be greater than zero".to_string(),
        ));
    }

    if camera.far <= camera.near {
        return Err(RendererError::InvalidCamera(
            "far plane must be greater than near plane".to_string(),
        ));
    }

    let up = glam::Vec3::from_array(camera.up);
    if up.length_squared() <= f32::EPSILON {
        return Err(RendererError::InvalidCamera(
            "up vector must be non-zero".to_string(),
        ));
    }

    Ok(())
}

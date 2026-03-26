//! Main baking system for texture baking operations

use crate::cage::CageMesh;
use crate::dilation;
use crate::error::{BakingError, Result};
use crate::map_types::{AoBaker, BakeMesh, CurvatureBaker, MapType, NormalMapBaker, NormalSpace};
use crate::ray_tracing::GpuRayTracer;
use image::RgbaImage;
use std::sync::Arc;

/// Settings for texture baking
#[derive(Debug, Clone)]
pub struct BakeSettings {
    /// Output texture resolution (width and height)
    pub resolution: u32,
    /// Number of samples per pixel for anti-aliasing
    pub samples: u32,
    /// Maximum ray distance for baking
    pub max_distance: f32,
    /// Optional cage mesh for controlled baking
    pub cage_extrusion: Option<f32>,
    /// Output space for normal maps
    pub normal_space: NormalSpace,
    /// Number of dilation iterations to prevent seams
    pub dilation_iterations: u32,
    /// Enable multi-sampling for anti-aliasing
    pub enable_antialiasing: bool,
}

impl Default for BakeSettings {
    fn default() -> Self {
        Self {
            resolution: 1024,
            samples: 4,
            max_distance: 1.0,
            cage_extrusion: None,
            normal_space: NormalSpace::Tangent,
            dilation_iterations: 8,
            enable_antialiasing: true,
        }
    }
}

impl BakeSettings {
    /// Validate settings
    pub fn validate(&self) -> Result<()> {
        if self.resolution == 0 || self.resolution > 16384 {
            return Err(BakingError::InvalidSettings(
                "Resolution must be between 1 and 16384".to_string(),
            ));
        }

        if self.samples == 0 || self.samples > 256 {
            return Err(BakingError::InvalidSettings(
                "Samples must be between 1 and 256".to_string(),
            ));
        }

        if self.max_distance <= 0.0 {
            return Err(BakingError::InvalidSettings(
                "Max distance must be positive".to_string(),
            ));
        }

        if let Some(extrusion) = self.cage_extrusion {
            if extrusion <= 0.0 {
                return Err(BakingError::InvalidSettings(
                    "Cage extrusion must be positive".to_string(),
                ));
            }
        }

        Ok(())
    }
}

/// Main texture baking system
pub struct BakingSystem {
    gpu_tracer: Option<Arc<GpuRayTracer>>,
}

impl BakingSystem {
    /// Create a new baking system
    pub fn new() -> Self {
        Self { gpu_tracer: None }
    }

    /// Create a new baking system with GPU acceleration
    pub async fn new_with_gpu() -> Result<Self> {
        let gpu_tracer = GpuRayTracer::init().await?;
        Ok(Self {
            gpu_tracer: Some(Arc::new(gpu_tracer)),
        })
    }

    /// Check if GPU acceleration is available
    pub fn has_gpu(&self) -> bool {
        self.gpu_tracer.is_some()
    }

    /// Bake a normal map from high-poly to low-poly mesh
    pub fn bake_normal_map(
        &self,
        high_poly: &BakeMesh,
        low_poly: &BakeMesh,
        settings: &BakeSettings,
    ) -> Result<RgbaImage> {
        settings.validate()?;

        log::info!(
            "Baking normal map: resolution={}x{}, samples={}, space={:?}",
            settings.resolution,
            settings.resolution,
            settings.samples,
            settings.normal_space
        );

        let baker = NormalMapBaker::new(settings.normal_space);
        let mut image = baker.bake(
            high_poly,
            low_poly,
            settings.resolution,
            settings.samples,
            settings.max_distance,
        )?;

        // Apply dilation to prevent seams
        if settings.dilation_iterations > 0 {
            log::info!(
                "Applying {} dilation iterations",
                settings.dilation_iterations
            );
            image = dilation::dilate(&image, settings.dilation_iterations);
        }

        Ok(image)
    }

    /// Bake an ambient occlusion map
    pub fn bake_ao_map(&self, mesh: &BakeMesh, settings: &BakeSettings) -> Result<RgbaImage> {
        settings.validate()?;

        log::info!(
            "Baking AO map: resolution={}x{}, samples={}",
            settings.resolution,
            settings.resolution,
            settings.samples
        );

        let baker = AoBaker::new(settings.samples, settings.max_distance);
        let mut image = baker.bake(mesh, settings.resolution)?;

        if settings.dilation_iterations > 0 {
            image = dilation::dilate(&image, settings.dilation_iterations);
        }

        Ok(image)
    }

    /// Bake a curvature map
    pub fn bake_curvature_map(
        &self,
        mesh: &BakeMesh,
        settings: &BakeSettings,
    ) -> Result<RgbaImage> {
        settings.validate()?;

        log::info!(
            "Baking curvature map: resolution={}x{}",
            settings.resolution,
            settings.resolution
        );

        let baker = CurvatureBaker::new();
        let mut image = baker.bake(mesh, settings.resolution)?;

        if settings.dilation_iterations > 0 {
            image = dilation::dilate(&image, settings.dilation_iterations);
        }

        Ok(image)
    }

    /// Bake a thickness map
    pub fn bake_thickness_map(
        &self,
        _mesh: &BakeMesh,
        settings: &BakeSettings,
    ) -> Result<RgbaImage> {
        settings.validate()?;

        log::info!(
            "Baking thickness map: resolution={}x{}",
            settings.resolution,
            settings.resolution
        );

        // Thickness map implementation would go here
        // For now, return a placeholder
        let mut image = RgbaImage::new(settings.resolution, settings.resolution);

        if settings.dilation_iterations > 0 {
            image = dilation::dilate(&image, settings.dilation_iterations);
        }

        Ok(image)
    }

    /// Bake a position map
    pub fn bake_position_map(
        &self,
        _mesh: &BakeMesh,
        settings: &BakeSettings,
    ) -> Result<RgbaImage> {
        settings.validate()?;

        log::info!(
            "Baking position map: resolution={}x{}",
            settings.resolution,
            settings.resolution
        );

        // Position map implementation would go here
        let mut image = RgbaImage::new(settings.resolution, settings.resolution);

        if settings.dilation_iterations > 0 {
            image = dilation::dilate(&image, settings.dilation_iterations);
        }

        Ok(image)
    }

    /// Bake a material ID map
    pub fn bake_id_map(
        &self,
        mesh: &BakeMesh,
        material_ids: &[u32],
        settings: &BakeSettings,
    ) -> Result<RgbaImage> {
        settings.validate()?;

        if material_ids.len() != mesh.triangle_count() {
            return Err(BakingError::InvalidMesh(
                "Material ID count must match triangle count".to_string(),
            ));
        }

        log::info!(
            "Baking ID map: resolution={}x{}",
            settings.resolution,
            settings.resolution
        );

        // ID map implementation would go here
        let mut image = RgbaImage::new(settings.resolution, settings.resolution);

        if settings.dilation_iterations > 0 {
            image = dilation::dilate(&image, settings.dilation_iterations);
        }

        Ok(image)
    }

    /// Batch bake multiple map types
    pub fn bake_batch(
        &self,
        high_poly: Option<&BakeMesh>,
        low_poly: &BakeMesh,
        map_types: &[MapType],
        settings: &BakeSettings,
    ) -> Result<Vec<(MapType, RgbaImage)>> {
        settings.validate()?;

        let mut results = Vec::new();

        for map_type in map_types {
            log::info!("Baking {:?}", map_type);

            let image = match map_type {
                MapType::Normal(space) => {
                    if let Some(high) = high_poly {
                        let mut settings = settings.clone();
                        settings.normal_space = *space;
                        self.bake_normal_map(high, low_poly, &settings)?
                    } else {
                        return Err(BakingError::InvalidSettings(
                            "High-poly mesh required for normal map baking".to_string(),
                        ));
                    }
                }
                MapType::AmbientOcclusion => self.bake_ao_map(low_poly, settings)?,
                MapType::Curvature => self.bake_curvature_map(low_poly, settings)?,
                MapType::Thickness => self.bake_thickness_map(low_poly, settings)?,
                MapType::Position => self.bake_position_map(low_poly, settings)?,
                MapType::MaterialId => {
                    // Default material IDs (all 0)
                    let ids = vec![0; low_poly.triangle_count()];
                    self.bake_id_map(low_poly, &ids, settings)?
                }
            };

            results.push((*map_type, image));
        }

        Ok(results)
    }

    /// Generate a cage mesh for controlled baking
    pub fn generate_cage(&self, mesh: &BakeMesh, extrusion: f32) -> Result<CageMesh> {
        CageMesh::from_mesh(mesh, extrusion)
    }

    /// Generate an adaptive cage mesh
    pub fn generate_cage_adaptive(
        &self,
        mesh: &BakeMesh,
        min_extrusion: f32,
        max_extrusion: f32,
    ) -> Result<CageMesh> {
        CageMesh::from_mesh_adaptive(mesh, min_extrusion, max_extrusion)
    }
}

impl Default for BakingSystem {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use glam::{Vec2, Vec3};

    fn create_test_mesh() -> BakeMesh {
        let vertices = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let normals = vec![Vec3::Z, Vec3::Z, Vec3::Z];
        let tangents = vec![Vec3::X, Vec3::X, Vec3::X];
        let uvs = vec![Vec2::ZERO, Vec2::X, Vec2::Y];
        let indices = vec![0, 1, 2];

        BakeMesh::new(vertices, normals, tangents, uvs, indices).unwrap()
    }

    #[test]
    fn test_baking_system_creation() {
        let system = BakingSystem::new();
        assert!(!system.has_gpu());
    }

    #[test]
    fn test_bake_settings_validation() {
        let settings = BakeSettings::default();
        assert!(settings.validate().is_ok());

        let mut invalid = settings.clone();
        invalid.resolution = 0;
        assert!(invalid.validate().is_err());

        let mut invalid = settings.clone();
        invalid.samples = 0;
        assert!(invalid.validate().is_err());

        let mut invalid = settings.clone();
        invalid.max_distance = -1.0;
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_generate_cage() {
        let system = BakingSystem::new();
        let mesh = create_test_mesh();

        let cage = system.generate_cage(&mesh, 0.5).unwrap();
        assert_eq!(cage.vertices.len(), 3);
    }

    #[test]
    fn test_bake_ao_map() {
        let system = BakingSystem::new();
        let mesh = create_test_mesh();
        let settings = BakeSettings {
            resolution: 64,
            samples: 4,
            ..Default::default()
        };

        let result = system.bake_ao_map(&mesh, &settings);
        assert!(result.is_ok());

        let image = result.unwrap();
        assert_eq!(image.width(), 64);
        assert_eq!(image.height(), 64);
    }
}

// ============================================================================
// Standalone Helper Functions
// ============================================================================

/// Generate a uniform cage mesh with fixed extrusion
pub fn generate_cage(mesh: &BakeMesh, extrusion: f32) -> Result<BakeMesh> {
    let cage = CageMesh::from_mesh(mesh, extrusion)?;
    Ok(cage.to_bake_mesh())
}

/// Generate an adaptive cage mesh with variable extrusion
pub fn generate_cage_adaptive(
    mesh: &BakeMesh,
    min_extrusion: f32,
    max_extrusion: f32,
) -> Result<BakeMesh> {
    let cage = CageMesh::from_mesh_adaptive(mesh, min_extrusion, max_extrusion)?;
    Ok(cage.to_bake_mesh())
}

/// Validate that a cage properly encloses a mesh
pub fn validate_cage(mesh: &BakeMesh, cage: &BakeMesh) -> Result<(bool, Vec<String>)> {
    let mut issues = Vec::new();

    // Check vertex count matches
    if mesh.vertices.len() != cage.vertices.len() {
        issues.push(format!(
            "Vertex count mismatch: mesh has {} vertices, cage has {}",
            mesh.vertices.len(),
            cage.vertices.len()
        ));
    }

    // Check that cage vertices are outside mesh vertices
    let mut vertices_inside = 0;
    for i in 0..mesh.vertices.len() {
        let mesh_pos = mesh.vertices[i];
        let cage_pos = cage.vertices[i];

        let distance = (cage_pos - mesh_pos).length();
        if distance < 0.001 {
            vertices_inside += 1;
        }
    }

    if vertices_inside > mesh.vertices.len() / 30 {
        issues.push(format!(
            "Cage is too close to mesh: {} vertices are nearly coincident",
            vertices_inside
        ));
    }

    let valid = issues.is_empty();
    Ok((valid, issues))
}

/// Calculate recommended extrusion distance based on mesh geometry
pub fn calculate_recommended_extrusion(mesh: &BakeMesh) -> Result<f32> {
    if mesh.vertices.is_empty() {
        return Err(BakingError::InvalidMesh("Mesh has no vertices".to_string()));
    }

    // Calculate bounding box
    let mut min = glam::Vec3::splat(f32::INFINITY);
    let mut max = glam::Vec3::splat(f32::NEG_INFINITY);

    for vertex in &mesh.vertices {
        min = min.min(*vertex);
        max = max.max(*vertex);
    }

    // Calculate diagonal length
    let diagonal = (max - min).length();

    // Recommend 10% of diagonal as extrusion
    let extrusion = diagonal * 0.1;

    Ok(extrusion.max(0.01)) // Ensure minimum extrusion
}

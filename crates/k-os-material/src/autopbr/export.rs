// Export Pipeline Module
// Handles multi-format material export (SBSAR, glTF, USD, Unreal, Unity, Godot, CustomJSON)

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::Material;

/// Supported export formats for materials
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ExportFormat {
    /// Substance Archive format (.sbsar)
    SBSAR,
    /// glTF 2.0 format with PBR materials
    #[serde(rename = "glTF")]
    GlTF,
    /// Universal Scene Description format
    USD,
    /// Unreal Engine material format (.uasset)
    Unreal,
    /// Unity material format (.mat)
    Unity,
    /// Godot material resource format (.tres)
    Godot,
    /// Custom JSON format with all material data
    CustomJSON,
}

impl ExportFormat {
    /// Get the file extension for this export format
    pub fn extension(&self) -> &'static str {
        match self {
            ExportFormat::SBSAR => "sbsar",
            ExportFormat::GlTF => "gltf",
            ExportFormat::USD => "usd",
            ExportFormat::Unreal => "uasset",
            ExportFormat::Unity => "mat",
            ExportFormat::Godot => "tres",
            ExportFormat::CustomJSON => "json",
        }
    }

    /// Get a human-readable name for this export format
    pub fn display_name(&self) -> &'static str {
        match self {
            ExportFormat::SBSAR => "Substance Archive",
            ExportFormat::GlTF => "glTF 2.0",
            ExportFormat::USD => "Universal Scene Description",
            ExportFormat::Unreal => "Unreal Engine",
            ExportFormat::Unity => "Unity",
            ExportFormat::Godot => "Godot Engine",
            ExportFormat::CustomJSON => "Custom JSON",
        }
    }

    /// Check if this format supports animation export
    pub fn supports_animation(&self) -> bool {
        match self {
            ExportFormat::GlTF => true,
            ExportFormat::USD => true,
            ExportFormat::CustomJSON => true,
            _ => false,
        }
    }
}

/// Texture resolution options for export
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TextureResolution {
    /// Use source texture resolution
    Source,
    /// 512x512 pixels
    #[serde(rename = "512")]
    Res512,
    /// 1024x1024 pixels
    #[serde(rename = "1024")]
    Res1024,
    /// 2048x2048 pixels
    #[serde(rename = "2048")]
    Res2048,
    /// 4096x4096 pixels
    #[serde(rename = "4096")]
    Res4096,
    /// 8192x8192 pixels
    #[serde(rename = "8192")]
    Res8192,
    /// 16384x16384 pixels
    #[serde(rename = "16384")]
    Res16384,
}

impl TextureResolution {
    /// Get the pixel dimension for this resolution
    pub fn pixels(&self) -> Option<u32> {
        match self {
            TextureResolution::Source => None,
            TextureResolution::Res512 => Some(512),
            TextureResolution::Res1024 => Some(1024),
            TextureResolution::Res2048 => Some(2048),
            TextureResolution::Res4096 => Some(4096),
            TextureResolution::Res8192 => Some(8192),
            TextureResolution::Res16384 => Some(16384),
        }
    }
}

/// Texture format options for export
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TextureFormat {
    /// Portable Network Graphics (lossless)
    PNG,
    /// JPEG (lossy compression)
    JPEG,
    /// Truevision TGA (lossless)
    TGA,
    /// OpenEXR (HDR format)
    EXR,
    /// DirectDraw Surface (compressed)
    DDS,
    /// Khronos Texture 2.0 (compressed)
    KTX2,
}

impl TextureFormat {
    /// Get the file extension for this texture format
    pub fn extension(&self) -> &'static str {
        match self {
            TextureFormat::PNG => "png",
            TextureFormat::JPEG => "jpg",
            TextureFormat::TGA => "tga",
            TextureFormat::EXR => "exr",
            TextureFormat::DDS => "dds",
            TextureFormat::KTX2 => "ktx2",
        }
    }

    /// Check if this format supports HDR (high dynamic range)
    pub fn supports_hdr(&self) -> bool {
        matches!(self, TextureFormat::EXR)
    }

    /// Check if this format uses lossy compression
    pub fn is_lossy(&self) -> bool {
        matches!(
            self,
            TextureFormat::JPEG | TextureFormat::DDS | TextureFormat::KTX2
        )
    }
}

/// Export options for material export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportOptions {
    /// Target texture resolution
    pub texture_resolution: TextureResolution,

    /// Target texture format
    pub texture_format: TextureFormat,

    /// Whether to include animation data (if supported by format)
    pub include_animation: bool,

    /// Whether to bake animation to texture sequences if format doesn't support animation
    pub bake_animation_if_unsupported: bool,

    /// Animation baking frame rate (if baking is enabled)
    pub animation_bake_fps: u32,

    /// Whether to embed textures in the output file (if supported by format)
    pub embed_textures: bool,

    /// Whether to compress textures (if supported by format)
    pub compress_textures: bool,

    /// JPEG quality (0-100) for lossy formats
    pub jpeg_quality: u8,

    /// Custom metadata to include in export
    pub custom_metadata: HashMap<String, String>,
}

impl Default for ExportOptions {
    fn default() -> Self {
        Self {
            texture_resolution: TextureResolution::Res2048,
            texture_format: TextureFormat::PNG,
            include_animation: true,
            bake_animation_if_unsupported: false,
            animation_bake_fps: 30,
            embed_textures: true,
            compress_textures: false,
            jpeg_quality: 90,
            custom_metadata: HashMap::new(),
        }
    }
}

impl ExportOptions {
    /// Create export options optimized for game engines
    pub fn for_game_engine() -> Self {
        Self {
            texture_resolution: TextureResolution::Res2048,
            texture_format: TextureFormat::DDS,
            compress_textures: true,
            embed_textures: false,
            ..Default::default()
        }
    }

    /// Create export options optimized for high-quality archival
    pub fn for_archival() -> Self {
        Self {
            texture_resolution: TextureResolution::Source,
            texture_format: TextureFormat::PNG,
            compress_textures: false,
            embed_textures: true,
            ..Default::default()
        }
    }

    /// Create export options optimized for web delivery
    pub fn for_web() -> Self {
        Self {
            texture_resolution: TextureResolution::Res1024,
            texture_format: TextureFormat::JPEG,
            jpeg_quality: 85,
            compress_textures: true,
            embed_textures: true,
            ..Default::default()
        }
    }

    /// Validate export options for the given format
    pub fn validate_for_format(&self, format: ExportFormat) -> Result<()> {
        // Check animation support
        if self.include_animation
            && !format.supports_animation()
            && !self.bake_animation_if_unsupported
        {
            return Err(anyhow::anyhow!(
                "Format {} does not support animation. Enable bake_animation_if_unsupported or disable include_animation.",
                format.display_name()
            ));
        }

        // Check HDR format compatibility
        if self.texture_format.supports_hdr() {
            match format {
                ExportFormat::GlTF | ExportFormat::USD | ExportFormat::CustomJSON => {
                    // These formats support HDR textures
                }
                _ => {
                    return Err(anyhow::anyhow!(
                        "Format {} does not support HDR textures. Use a different texture format.",
                        format.display_name()
                    ));
                }
            }
        }

        // Validate JPEG quality
        if self.texture_format == TextureFormat::JPEG && self.jpeg_quality > 100 {
            return Err(anyhow::anyhow!(
                "JPEG quality must be between 0 and 100, got {}",
                self.jpeg_quality
            ));
        }

        // Validate animation bake FPS
        if self.bake_animation_if_unsupported
            && (self.animation_bake_fps == 0 || self.animation_bake_fps > 120)
        {
            return Err(anyhow::anyhow!(
                "Animation bake FPS must be between 1 and 120, got {}",
                self.animation_bake_fps
            ));
        }

        Ok(())
    }
}

/// Result of a material export operation
#[derive(Debug)]
pub struct ExportResult {
    /// The exported data as bytes
    pub data: Vec<u8>,

    /// Additional files that were generated (e.g., texture files)
    pub additional_files: HashMap<String, Vec<u8>>,

    /// Warnings generated during export
    pub warnings: Vec<String>,

    /// Export statistics
    pub stats: ExportStats,
}

/// Statistics about an export operation
#[derive(Debug, Default)]
pub struct ExportStats {
    /// Total size of exported data in bytes
    pub total_size_bytes: usize,

    /// Number of textures exported
    pub texture_count: usize,

    /// Number of layers exported
    pub layer_count: usize,

    /// Whether animation was included
    pub animation_included: bool,

    /// Whether animation was baked
    pub animation_baked: bool,

    /// Export duration in milliseconds
    pub export_duration_ms: u64,
}

/// Trait for material exporters
///
/// Implement this trait to add support for new export formats.
/// Each exporter is responsible for converting a Material to the target format.
pub trait MaterialExporter: Send + Sync {
    /// Get the export format this exporter handles
    fn format(&self) -> ExportFormat;

    /// Export a material to the target format
    ///
    /// # Arguments
    /// * `material` - The material to export
    /// * `options` - Export options controlling resolution, format, etc.
    ///
    /// # Returns
    /// ExportResult containing the exported data and metadata
    fn export(&self, material: &Material, options: &ExportOptions) -> Result<ExportResult>;

    /// Validate that a material can be exported with the given options
    ///
    /// This is called before export to catch issues early.
    /// Returns Ok(()) if validation passes, Err with descriptive message if it fails.
    fn validate(&self, material: &Material, options: &ExportOptions) -> Result<()> {
        // Default implementation: validate options for format
        options.validate_for_format(self.format())?;

        // Check if material has required data
        if material.layers.is_empty() {
            return Err(anyhow::anyhow!("Material has no layers to export"));
        }

        Ok(())
    }

    /// Get a list of capabilities this exporter supports
    fn capabilities(&self) -> ExporterCapabilities {
        ExporterCapabilities::default()
    }
}

/// Capabilities of a material exporter
#[derive(Debug, Clone)]
pub struct ExporterCapabilities {
    /// Whether this exporter supports animation export
    pub supports_animation: bool,

    /// Whether this exporter supports layer export
    pub supports_layers: bool,

    /// Whether this exporter supports texture embedding
    pub supports_embedded_textures: bool,

    /// Whether this exporter supports HDR textures
    pub supports_hdr: bool,

    /// Maximum texture resolution supported (None = unlimited)
    pub max_texture_resolution: Option<u32>,

    /// Supported texture formats
    pub supported_texture_formats: Vec<TextureFormat>,
}

impl Default for ExporterCapabilities {
    fn default() -> Self {
        Self {
            supports_animation: false,
            supports_layers: false,
            supports_embedded_textures: true,
            supports_hdr: false,
            max_texture_resolution: None,
            supported_texture_formats: vec![
                TextureFormat::PNG,
                TextureFormat::JPEG,
                TextureFormat::TGA,
            ],
        }
    }
}

/// Export Pipeline - manages multiple material exporters
///
/// The ExportPipeline is the central hub for material export operations.
/// It maintains a registry of exporters (one per format) and provides
/// validation before export to catch issues early.
///
/// # Example
/// ```no_run
/// use k_os_material::autopbr::export::*;
///
/// let mut pipeline = ExportPipeline::new();
///
/// // Register exporters
/// pipeline.register_exporter(Box::new(GltfExporter::new()));
/// pipeline.register_exporter(Box::new(CustomJsonExporter::new()));
///
/// // Export a material
/// let result = pipeline.export(&material, ExportFormat::GlTF, &options)?;
/// ```
pub struct ExportPipeline {
    /// Registered exporters, keyed by format
    exporters: HashMap<ExportFormat, Box<dyn MaterialExporter>>,
}

impl ExportPipeline {
    /// Create a new export pipeline with no registered exporters
    pub fn new() -> Self {
        Self {
            exporters: HashMap::new(),
        }
    }

    /// Register an exporter for a specific format
    ///
    /// If an exporter for this format already exists, it will be replaced.
    ///
    /// # Arguments
    /// * `exporter` - The exporter to register
    ///
    /// # Example
    /// ```no_run
    /// pipeline.register_exporter(Box::new(GltfExporter::new()));
    /// ```
    pub fn register_exporter(&mut self, exporter: Box<dyn MaterialExporter>) {
        let format = exporter.format();
        self.exporters.insert(format, exporter);
    }

    /// Unregister an exporter for a specific format
    ///
    /// Returns the exporter if it was registered, None otherwise.
    ///
    /// # Arguments
    /// * `format` - The format to unregister
    pub fn unregister_exporter(
        &mut self,
        format: ExportFormat,
    ) -> Option<Box<dyn MaterialExporter>> {
        self.exporters.remove(&format)
    }

    /// Check if an exporter is registered for a specific format
    ///
    /// # Arguments
    /// * `format` - The format to check
    pub fn has_exporter(&self, format: ExportFormat) -> bool {
        self.exporters.contains_key(&format)
    }

    /// Get a list of all registered export formats
    pub fn registered_formats(&self) -> Vec<ExportFormat> {
        self.exporters.keys().copied().collect()
    }

    /// Get the capabilities of a registered exporter
    ///
    /// Returns None if no exporter is registered for the format.
    ///
    /// # Arguments
    /// * `format` - The format to query
    pub fn get_capabilities(&self, format: ExportFormat) -> Option<ExporterCapabilities> {
        self.exporters.get(&format).map(|e| e.capabilities())
    }

    /// Validate that a material can be exported with the given format and options
    ///
    /// This performs validation before export to catch issues early:
    /// - Checks if an exporter is registered for the format
    /// - Validates export options for the format
    /// - Calls the exporter's validate method
    ///
    /// # Arguments
    /// * `material` - The material to validate
    /// * `format` - The target export format
    /// * `options` - Export options
    ///
    /// # Returns
    /// Ok(()) if validation passes, Err with descriptive message if it fails.
    ///
    /// # Example
    /// ```no_run
    /// // Validate before export
    /// pipeline.validate(&material, ExportFormat::GlTF, &options)?;
    ///
    /// // Now safe to export
    /// let result = pipeline.export(&material, ExportFormat::GlTF, &options)?;
    /// ```
    pub fn validate(
        &self,
        material: &Material,
        format: ExportFormat,
        options: &ExportOptions,
    ) -> Result<()> {
        // Check if exporter is registered
        let exporter = self.exporters.get(&format).ok_or_else(|| {
            anyhow::anyhow!(
                "No exporter registered for format: {}. Available formats: {:?}",
                format.display_name(),
                self.registered_formats()
            )
        })?;

        // Validate options for format
        options.validate_for_format(format)?;

        // Call exporter's validation
        exporter.validate(material, options)?;

        Ok(())
    }

    /// Export a material to the specified format
    ///
    /// This is the main export method. It validates the material and options,
    /// then delegates to the appropriate exporter.
    ///
    /// # Arguments
    /// * `material` - The material to export
    /// * `format` - The target export format
    /// * `options` - Export options controlling resolution, format, etc.
    ///
    /// # Returns
    /// ExportResult containing the exported data and metadata
    ///
    /// # Errors
    /// Returns an error if:
    /// - No exporter is registered for the format
    /// - Validation fails
    /// - Export operation fails
    ///
    /// # Example
    /// ```no_run
    /// let options = ExportOptions::for_game_engine();
    /// let result = pipeline.export(&material, ExportFormat::GlTF, &options)?;
    ///
    /// // Write to file
    /// std::fs::write("material.gltf", &result.data)?;
    ///
    /// // Write additional files (textures, etc.)
    /// for (filename, data) in result.additional_files {
    ///     std::fs::write(filename, data)?;
    /// }
    /// ```
    pub fn export(
        &self,
        material: &Material,
        format: ExportFormat,
        options: &ExportOptions,
    ) -> Result<ExportResult> {
        // Validate before export
        self.validate(material, format, options)?;

        // Get exporter (we know it exists because validate succeeded)
        let exporter = self
            .exporters
            .get(&format)
            .expect("Exporter should exist after validation");

        // Perform export
        let start_time = std::time::Instant::now();
        let mut result = exporter.export(material, options)?;
        let duration = start_time.elapsed();

        // Update export duration in stats
        result.stats.export_duration_ms = duration.as_millis() as u64;

        Ok(result)
    }

    /// Export a material with automatic validation and error handling
    ///
    /// This is a convenience method that wraps export() with additional
    /// error context and logging.
    ///
    /// # Arguments
    /// * `material` - The material to export
    /// * `format` - The target export format
    /// * `options` - Export options
    pub fn export_with_context(
        &self,
        material: &Material,
        format: ExportFormat,
        options: &ExportOptions,
    ) -> Result<ExportResult> {
        self.export(material, format, options).map_err(|e| {
            anyhow::anyhow!(
                "Failed to export material '{}' to {}: {}",
                material.metadata.name,
                format.display_name(),
                e
            )
        })
    }
}

#[cfg(test)]
mod pipeline_tests {
    use super::*;

    // Mock exporter for testing
    struct MockExporter {
        format: ExportFormat,
        should_fail_validation: bool,
        should_fail_export: bool,
    }

    impl MockExporter {
        fn new(format: ExportFormat) -> Self {
            Self {
                format,
                should_fail_validation: false,
                should_fail_export: false,
            }
        }

        fn with_validation_failure(mut self) -> Self {
            self.should_fail_validation = true;
            self
        }

        fn with_export_failure(mut self) -> Self {
            self.should_fail_export = true;
            self
        }
    }

    impl MaterialExporter for MockExporter {
        fn format(&self) -> ExportFormat {
            self.format
        }

        fn export(&self, material: &Material, _options: &ExportOptions) -> Result<ExportResult> {
            if self.should_fail_export {
                return Err(anyhow::anyhow!("Mock export failure"));
            }

            Ok(ExportResult {
                data: format!(
                    "Exported {} to {}",
                    material.metadata.name,
                    self.format.display_name()
                )
                .into_bytes(),
                additional_files: HashMap::new(),
                warnings: vec![],
                stats: ExportStats {
                    total_size_bytes: 100,
                    texture_count: material.layers.len(),
                    layer_count: material.layers.len(),
                    animation_included: material.animation.is_some(),
                    animation_baked: false,
                    export_duration_ms: 0,
                },
            })
        }

        fn validate(&self, material: &Material, options: &ExportOptions) -> Result<()> {
            if self.should_fail_validation {
                return Err(anyhow::anyhow!("Mock validation failure"));
            }

            // Call default validation
            options.validate_for_format(self.format())?;

            if material.layers.is_empty() {
                return Err(anyhow::anyhow!("Material has no layers to export"));
            }

            Ok(())
        }
    }

    // Helper to create a test material
    fn create_test_material() -> Material {
        use super::super::{Layer, Material, MaterialCategory, MaterialMetadata};
        use chrono::Utc;
        use uuid::Uuid;

        Material {
            id: Uuid::new_v4(),
            metadata: MaterialMetadata {
                name: "Test Material".to_string(),
                description: "A test material".to_string(),
                tags: vec!["test".to_string()],
                author: "Test Author".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 1,
                category: MaterialCategory::Metal,
            },
            layers: vec![Layer::default()],
            animation: None,
            variants: vec![],
            base_material: None,
        }
    }

    #[test]
    fn test_export_pipeline_new() {
        let pipeline = ExportPipeline::new();
        assert_eq!(pipeline.registered_formats().len(), 0);
    }

    #[test]
    fn test_export_pipeline_default() {
        let pipeline = ExportPipeline::default();
        assert_eq!(pipeline.registered_formats().len(), 0);
    }

    #[test]
    fn test_export_pipeline_register_exporter() {
        let mut pipeline = ExportPipeline::new();

        // Register an exporter
        pipeline.register_exporter(Box::new(MockExporter::new(ExportFormat::GlTF)));

        assert!(pipeline.has_exporter(ExportFormat::GlTF));
        assert!(!pipeline.has_exporter(ExportFormat::USD));
        assert_eq!(pipeline.registered_formats().len(), 1);
    }

    #[test]
    fn test_export_pipeline_register_multiple_exporters() {
        let mut pipeline = ExportPipeline::new();

        // Register multiple exporters
        pipeline.register_exporter(Box::new(MockExporter::new(ExportFormat::GlTF)));
        pipeline.register_exporter(Box::new(MockExporter::new(ExportFormat::USD)));
        pipeline.register_exporter(Box::new(MockExporter::new(ExportFormat::CustomJSON)));

        assert!(pipeline.has_exporter(ExportFormat::GlTF));
        assert!(pipeline.has_exporter(ExportFormat::USD));
        assert!(pipeline.has_exporter(ExportFormat::CustomJSON));
        assert!(!pipeline.has_exporter(ExportFormat::SBSAR));
        assert_eq!(pipeline.registered_formats().len(), 3);
    }

    #[test]
    fn test_export_pipeline_replace_exporter() {
        let mut pipeline = ExportPipeline::new();

        // Register an exporter
        pipeline.register_exporter(Box::new(MockExporter::new(ExportFormat::GlTF)));
        assert_eq!(pipeline.registered_formats().len(), 1);

        // Replace with another exporter for the same format
        pipeline.register_exporter(Box::new(MockExporter::new(ExportFormat::GlTF)));
        assert_eq!(pipeline.registered_formats().len(), 1);
        assert!(pipeline.has_exporter(ExportFormat::GlTF));
    }

    #[test]
    fn test_export_pipeline_unregister_exporter() {
        let mut pipeline = ExportPipeline::new();

        // Register an exporter
        pipeline.register_exporter(Box::new(MockExporter::new(ExportFormat::GlTF)));
        assert!(pipeline.has_exporter(ExportFormat::GlTF));

        // Unregister it
        let removed = pipeline.unregister_exporter(ExportFormat::GlTF);
        assert!(removed.is_some());
        assert!(!pipeline.has_exporter(ExportFormat::GlTF));

        // Try to unregister again
        let removed = pipeline.unregister_exporter(ExportFormat::GlTF);
        assert!(removed.is_none());
    }

    #[test]
    fn test_export_pipeline_get_capabilities() {
        let mut pipeline = ExportPipeline::new();

        // No exporter registered
        assert!(pipeline.get_capabilities(ExportFormat::GlTF).is_none());

        // Register an exporter
        pipeline.register_exporter(Box::new(MockExporter::new(ExportFormat::GlTF)));

        // Get capabilities
        let caps = pipeline.get_capabilities(ExportFormat::GlTF);
        assert!(caps.is_some());
    }

    #[test]
    fn test_export_pipeline_validate_no_exporter() {
        let pipeline = ExportPipeline::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        // Should fail because no exporter is registered
        let result = pipeline.validate(&material, ExportFormat::GlTF, &options);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("No exporter registered"));
    }

    #[test]
    fn test_export_pipeline_validate_success() {
        let mut pipeline = ExportPipeline::new();
        pipeline.register_exporter(Box::new(MockExporter::new(ExportFormat::GlTF)));

        let material = create_test_material();
        let options = ExportOptions::default();

        // Should succeed
        let result = pipeline.validate(&material, ExportFormat::GlTF, &options);
        assert!(result.is_ok());
    }

    #[test]
    fn test_export_pipeline_validate_exporter_failure() {
        let mut pipeline = ExportPipeline::new();
        pipeline.register_exporter(Box::new(
            MockExporter::new(ExportFormat::GlTF).with_validation_failure(),
        ));

        let material = create_test_material();
        let options = ExportOptions::default();

        // Should fail because exporter validation fails
        let result = pipeline.validate(&material, ExportFormat::GlTF, &options);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Mock validation failure"));
    }

    #[test]
    fn test_export_pipeline_validate_empty_layers() {
        let mut pipeline = ExportPipeline::new();
        pipeline.register_exporter(Box::new(MockExporter::new(ExportFormat::GlTF)));

        let mut material = create_test_material();
        material.layers.clear(); // Remove all layers

        let options = ExportOptions::default();

        // Should fail because material has no layers
        let result = pipeline.validate(&material, ExportFormat::GlTF, &options);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("no layers"));
    }

    #[test]
    fn test_export_pipeline_export_success() {
        let mut pipeline = ExportPipeline::new();
        pipeline.register_exporter(Box::new(MockExporter::new(ExportFormat::GlTF)));

        let material = create_test_material();
        let options = ExportOptions::default();

        // Should succeed
        let result = pipeline.export(&material, ExportFormat::GlTF, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();
        assert!(!export_result.data.is_empty());
        assert_eq!(export_result.stats.layer_count, 1);
        assert!(export_result.stats.total_size_bytes > 0);
    }

    #[test]
    fn test_export_pipeline_export_no_exporter() {
        let pipeline = ExportPipeline::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        // Should fail because no exporter is registered
        let result = pipeline.export(&material, ExportFormat::GlTF, &options);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("No exporter registered"));
    }

    #[test]
    fn test_export_pipeline_export_failure() {
        let mut pipeline = ExportPipeline::new();
        pipeline.register_exporter(Box::new(
            MockExporter::new(ExportFormat::GlTF).with_export_failure(),
        ));

        let material = create_test_material();
        let options = ExportOptions::default();

        // Should fail because exporter export fails
        let result = pipeline.export(&material, ExportFormat::GlTF, &options);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Mock export failure"));
    }

    #[test]
    fn test_export_pipeline_export_with_context() {
        let mut pipeline = ExportPipeline::new();
        pipeline.register_exporter(Box::new(MockExporter::new(ExportFormat::GlTF)));

        let material = create_test_material();
        let options = ExportOptions::default();

        // Should succeed
        let result = pipeline.export_with_context(&material, ExportFormat::GlTF, &options);
        assert!(result.is_ok());
    }

    #[test]
    fn test_export_pipeline_export_with_context_failure() {
        let mut pipeline = ExportPipeline::new();
        pipeline.register_exporter(Box::new(
            MockExporter::new(ExportFormat::GlTF).with_export_failure(),
        ));

        let material = create_test_material();
        let options = ExportOptions::default();

        // Should fail with context
        let result = pipeline.export_with_context(&material, ExportFormat::GlTF, &options);
        assert!(result.is_err());
        let error_msg = result.unwrap_err().to_string();
        assert!(error_msg.contains("Failed to export material"));
        assert!(error_msg.contains("Test Material"));
        assert!(error_msg.contains("glTF"));
    }
}

impl Default for ExportPipeline {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_format_extension() {
        assert_eq!(ExportFormat::SBSAR.extension(), "sbsar");
        assert_eq!(ExportFormat::GlTF.extension(), "gltf");
        assert_eq!(ExportFormat::USD.extension(), "usd");
        assert_eq!(ExportFormat::Unreal.extension(), "uasset");
        assert_eq!(ExportFormat::Unity.extension(), "mat");
        assert_eq!(ExportFormat::Godot.extension(), "tres");
        assert_eq!(ExportFormat::CustomJSON.extension(), "json");
    }

    #[test]
    fn test_export_format_animation_support() {
        assert!(!ExportFormat::SBSAR.supports_animation());
        assert!(ExportFormat::GlTF.supports_animation());
        assert!(ExportFormat::USD.supports_animation());
        assert!(!ExportFormat::Unreal.supports_animation());
        assert!(!ExportFormat::Unity.supports_animation());
        assert!(!ExportFormat::Godot.supports_animation());
        assert!(ExportFormat::CustomJSON.supports_animation());
    }

    #[test]
    fn test_texture_resolution_pixels() {
        assert_eq!(TextureResolution::Source.pixels(), None);
        assert_eq!(TextureResolution::Res512.pixels(), Some(512));
        assert_eq!(TextureResolution::Res1024.pixels(), Some(1024));
        assert_eq!(TextureResolution::Res2048.pixels(), Some(2048));
        assert_eq!(TextureResolution::Res4096.pixels(), Some(4096));
        assert_eq!(TextureResolution::Res8192.pixels(), Some(8192));
        assert_eq!(TextureResolution::Res16384.pixels(), Some(16384));
    }

    #[test]
    fn test_texture_format_properties() {
        assert!(!TextureFormat::PNG.is_lossy());
        assert!(TextureFormat::JPEG.is_lossy());
        assert!(!TextureFormat::TGA.is_lossy());
        assert!(!TextureFormat::EXR.is_lossy());
        assert!(TextureFormat::DDS.is_lossy());
        assert!(TextureFormat::KTX2.is_lossy());

        assert!(!TextureFormat::PNG.supports_hdr());
        assert!(!TextureFormat::JPEG.supports_hdr());
        assert!(TextureFormat::EXR.supports_hdr());
    }

    #[test]
    fn test_export_options_default() {
        let options = ExportOptions::default();
        assert_eq!(options.texture_resolution, TextureResolution::Res2048);
        assert_eq!(options.texture_format, TextureFormat::PNG);
        assert!(options.include_animation);
        assert!(!options.bake_animation_if_unsupported);
        assert_eq!(options.animation_bake_fps, 30);
        assert!(options.embed_textures);
        assert!(!options.compress_textures);
        assert_eq!(options.jpeg_quality, 90);
    }

    #[test]
    fn test_export_options_presets() {
        let game_options = ExportOptions::for_game_engine();
        assert_eq!(game_options.texture_format, TextureFormat::DDS);
        assert!(game_options.compress_textures);
        assert!(!game_options.embed_textures);

        let archival_options = ExportOptions::for_archival();
        assert_eq!(
            archival_options.texture_resolution,
            TextureResolution::Source
        );
        assert_eq!(archival_options.texture_format, TextureFormat::PNG);
        assert!(!archival_options.compress_textures);

        let web_options = ExportOptions::for_web();
        assert_eq!(web_options.texture_resolution, TextureResolution::Res1024);
        assert_eq!(web_options.texture_format, TextureFormat::JPEG);
        assert_eq!(web_options.jpeg_quality, 85);
    }

    #[test]
    fn test_export_options_validation_animation() {
        let mut options = ExportOptions::default();
        options.include_animation = true;
        options.bake_animation_if_unsupported = false;

        // Should fail for formats that don't support animation
        let result = options.validate_for_format(ExportFormat::SBSAR);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("does not support animation"));

        // Should succeed for formats that support animation
        let result = options.validate_for_format(ExportFormat::GlTF);
        assert!(result.is_ok());

        // Should succeed if baking is enabled
        options.bake_animation_if_unsupported = true;
        let result = options.validate_for_format(ExportFormat::SBSAR);
        assert!(result.is_ok());
    }

    #[test]
    fn test_export_options_validation_hdr() {
        let mut options = ExportOptions::default();
        options.texture_format = TextureFormat::EXR;
        options.include_animation = false;

        // Should succeed for formats that support HDR
        assert!(options.validate_for_format(ExportFormat::GlTF).is_ok());
        assert!(options.validate_for_format(ExportFormat::USD).is_ok());
        assert!(options
            .validate_for_format(ExportFormat::CustomJSON)
            .is_ok());

        // Should fail for formats that don't support HDR
        let result = options.validate_for_format(ExportFormat::Unity);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("HDR"));
    }

    #[test]
    fn test_export_options_validation_jpeg_quality() {
        let mut options = ExportOptions::default();
        options.texture_format = TextureFormat::JPEG;
        options.jpeg_quality = 150; // Invalid

        let result = options.validate_for_format(ExportFormat::GlTF);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("JPEG quality"));
    }

    #[test]
    fn test_export_options_validation_bake_fps() {
        let mut options = ExportOptions::default();
        options.bake_animation_if_unsupported = true;
        options.animation_bake_fps = 0; // Invalid

        let result = options.validate_for_format(ExportFormat::SBSAR);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("FPS"));

        options.animation_bake_fps = 200; // Invalid (too high)
        let result = options.validate_for_format(ExportFormat::SBSAR);
        assert!(result.is_err());
    }

    #[test]
    fn test_export_format_serialization() {
        let format = ExportFormat::GlTF;
        let json = serde_json::to_string(&format).unwrap();
        assert_eq!(json, "\"glTF\"");

        let deserialized: ExportFormat = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, ExportFormat::GlTF);
    }

    #[test]
    fn test_export_options_serialization() {
        let options = ExportOptions::default();
        let json = serde_json::to_string(&options).unwrap();
        let deserialized: ExportOptions = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.texture_resolution, options.texture_resolution);
        assert_eq!(deserialized.texture_format, options.texture_format);
        assert_eq!(deserialized.include_animation, options.include_animation);
    }
}

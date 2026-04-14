//! Brush Library
//!
//! Global brush asset library with disk persistence.
//! Loads .kbrush JSON files from the user's library folder.

use once_cell::sync::Lazy;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

use super::asset::{BrushKernel, BrushParams, KBrushAsset};
use super::curve::{BrushCurve, CurveLut};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BrushLoadProfile {
    Full,
    MinimalWgsl,
}

impl BrushLoadProfile {
    fn from_env() -> Self {
        Self::from_env_with(|key| std::env::var(key).ok())
    }

    fn from_env_with<F>(get_env: F) -> Self
    where
        F: Fn(&str) -> Option<String>,
    {
        if let Some(minimal_flag) = get_env("KOS_BRUSH_MINIMAL") {
            if minimal_flag == "1" || minimal_flag.eq_ignore_ascii_case("true") {
                return Self::MinimalWgsl;
            }
        }

        match get_env("KOS_BRUSH_PROFILE")
            .unwrap_or_else(|| "full".to_string())
            .to_ascii_lowercase()
            .as_str()
        {
            "minimal_wgsl" | "minimal" => Self::MinimalWgsl,
            _ => Self::Full,
        }
    }

    fn should_scan_disk(self) -> bool {
        matches!(self, Self::Full)
    }
}

const FULL_PRESET_IDS: &[&str] = &[
    "preset_clay",
    "preset_smooth",
    "preset_pinch",
    "preset_cloth",
    "preset_grab",
    "preset_snake_hook",
    "preset_twist",
    "preset_attractor",
    "preset_elastic",
    "preset_turbulence",
];

const MINIMAL_WGSL_PRESET_IDS: &[&str] = &[
    "preset_clay",
    "preset_smooth",
    "preset_pinch",
    "preset_grab",
    "preset_attractor",
];

fn preset_factory(id: &str) -> Option<fn() -> KBrushAsset> {
    match id {
        "preset_clay" => Some(KBrushAsset::preset_clay),
        "preset_smooth" => Some(KBrushAsset::preset_smooth),
        "preset_pinch" => Some(KBrushAsset::preset_pinch),
        "preset_cloth" => Some(KBrushAsset::preset_cloth),
        "preset_grab" => Some(KBrushAsset::preset_grab),
        "preset_snake_hook" => Some(KBrushAsset::preset_snake_hook),
        "preset_twist" => Some(KBrushAsset::preset_twist),
        "preset_attractor" => Some(KBrushAsset::preset_attractor),
        "preset_elastic" => Some(KBrushAsset::preset_elastic),
        "preset_turbulence" => Some(KBrushAsset::preset_turbulence),
        _ => None,
    }
}

fn preset_ids_for_profile(profile: BrushLoadProfile) -> &'static [&'static str] {
    match profile {
        BrushLoadProfile::Full => FULL_PRESET_IDS,
        BrushLoadProfile::MinimalWgsl => MINIMAL_WGSL_PRESET_IDS,
    }
}

const KAIN_SHADER_DESCRIPTORS: &[(&str, &str, &str, f32, f32)] = &[
    // shader, name, category, radius, strength
    ("stamp_main", "Kain Stamp Main", "KAIN/Stamp", 0.15, 0.60),
    ("stamp_clay", "Kain Clay", "KAIN/Stamp", 0.15, 0.60),
    ("stamp_inflate", "Kain Inflate", "KAIN/Stamp", 0.14, 0.45),
    ("stamp_flatten", "Kain Flatten", "KAIN/Stamp", 0.20, 0.50),
    ("stamp_crease", "Kain Crease", "KAIN/Stamp", 0.08, 0.70),
    ("stamp_scrape", "Kain Scrape", "KAIN/Stamp", 0.18, 0.48),
    ("stamp_blob", "Kain Blob", "KAIN/Stamp", 0.16, 0.65),
    ("stamp_layer", "Kain Layer", "KAIN/Stamp", 0.12, 0.52),
    ("stamp_hpolish", "Kain HPolish", "KAIN/Stamp", 0.18, 0.42),
    (
        "physics_attractor",
        "Kain Attractor",
        "KAIN/Physics",
        0.24,
        0.40,
    ),
    ("physics_magnet", "Kain Magnet", "KAIN/Physics", 0.24, 0.42),
    (
        "physics_elastic",
        "Kain Elastic",
        "KAIN/Physics",
        0.20,
        0.48,
    ),
    (
        "physics_inflate_pulse",
        "Kain Inflate Pulse",
        "KAIN/Physics",
        0.18,
        0.44,
    ),
    (
        "physics_turbulence",
        "Kain Turbulence",
        "KAIN/Physics",
        0.22,
        0.38,
    ),
    (
        "physics_gravity_drop",
        "Kain Gravity Drop",
        "KAIN/Physics",
        0.25,
        0.35,
    ),
    ("physics_wind", "Kain Wind", "KAIN/Physics", 0.24, 0.32),
    ("physics_vortex", "Kain Vortex", "KAIN/Physics", 0.20, 0.36),
];

fn include_kain_brushes(profile: BrushLoadProfile) -> bool {
    if matches!(profile, BrushLoadProfile::MinimalWgsl) {
        return false;
    }

    std::env::var("KOS_ENABLE_KAIN_BRUSHES")
        .map(|v| !(v == "0" || v.eq_ignore_ascii_case("false")))
        .unwrap_or(true)
}

fn kain_brush_presets() -> Vec<KBrushAsset> {
    KAIN_SHADER_DESCRIPTORS
        .iter()
        .map(|(shader, name, category, radius, strength)| {
            let mut params = BrushParams {
                radius: *radius,
                strength: *strength,
                hardness: 0.35,
                spacing: 0.06,
                accumulate: true,
                ..Default::default()
            };

            params.extras.insert("spirv".to_string(), 1.0);

            KBrushAsset {
                id: format!("kain_{}", shader),
                name: (*name).to_string(),
                category: (*category).to_string(),
                tags: vec![
                    "kain".to_string(),
                    "spirv".to_string(),
                    category
                        .split('/')
                        .next_back()
                        .unwrap_or("sculpt")
                        .to_ascii_lowercase(),
                ],
                // Custom kernel stores the SPIR-V shader identifier with explicit namespace.
                kernel: BrushKernel::Custom(format!("kain:{}", shader)),
                params,
                ..Default::default()
            }
        })
        .collect()
}

/// Global brush library instance
pub static BRUSH_LIBRARY: Lazy<RwLock<KBrushLibrary>> =
    Lazy::new(|| RwLock::new(KBrushLibrary::new()));

/// The brush library - manages all loaded brushes and curves
pub struct KBrushLibrary {
    /// Loaded brushes by ID
    brushes: HashMap<String, KBrushAsset>,
    /// Loaded curves by ID
    curves: HashMap<String, BrushCurve>,
    /// Baked curve LUTs (cached)
    curve_luts: HashMap<String, Arc<CurveLut>>,
    /// Library root path
    library_path: Option<PathBuf>,
    /// Whether library is initialized
    initialized: bool,
}

impl KBrushLibrary {
    pub fn new() -> Self {
        Self {
            brushes: HashMap::new(),
            curves: HashMap::new(),
            curve_luts: HashMap::new(),
            library_path: None,
            initialized: false,
        }
    }

    /// Initialize the library with the default path
    pub fn init(&mut self) -> Result<(), String> {
        if self.initialized {
            return Ok(());
        }

        let profile = BrushLoadProfile::from_env();

        // Determine library path
        let path = get_library_path()?;

        // Create directory if needed
        if !path.exists() {
            std::fs::create_dir_all(&path)
                .map_err(|e| format!("Failed to create library: {}", e))?;
            log::info!("[BrushLibrary] Created library at {:?}", path);
        }

        self.library_path = Some(path.clone());

        // Load built-in presets
        self.load_builtin_presets(profile);

        // Load user brushes from disk for full profile only
        if profile.should_scan_disk() {
            self.scan_library()?;
        } else {
            log::info!("[BrushLibrary] Minimal WGSL profile active, skipping disk brush scan");
        }

        self.initialized = true;
        log::info!(
            "[BrushLibrary] Initialized with {} brushes",
            self.brushes.len()
        );

        Ok(())
    }

    /// Initialize the library with Tauri app handle for proper resource resolution
    pub fn init_with_app(&mut self, app: &tauri::AppHandle) -> Result<(), String> {
        if self.initialized {
            return Ok(());
        }

        let profile = BrushLoadProfile::from_env();

        // Determine library path
        let path = get_library_path()?;

        // Create directory if needed
        if !path.exists() {
            std::fs::create_dir_all(&path)
                .map_err(|e| format!("Failed to create library: {}", e))?;
            log::info!("[BrushLibrary] Created library at {:?}", path);
        }

        self.library_path = Some(path.clone());

        // Load built-in presets using Tauri resource resolver
        self.load_builtin_presets_with_app(app, profile);

        // Load user brushes from disk for full profile only
        if profile.should_scan_disk() {
            self.scan_library()?;
        } else {
            log::info!("[BrushLibrary] Minimal WGSL profile active, skipping disk brush scan");
        }

        self.initialized = true;
        log::info!(
            "[BrushLibrary] Initialized with {} brushes",
            self.brushes.len()
        );

        Ok(())
    }

    /// Load built-in brush presets (from code AND from assets folder)
    fn load_builtin_presets(&mut self, profile: BrushLoadProfile) {
        self.load_code_presets(profile);

        if profile.should_scan_disk() {
            self.scan_bundled_brushes_from_paths();
        }

        self.load_builtin_curves();
    }

    /// Load built-in brush presets using Tauri's resource resolver
    fn load_builtin_presets_with_app(&mut self, app: &tauri::AppHandle, profile: BrushLoadProfile) {
        self.load_code_presets(profile);

        if profile.should_scan_disk() {
            self.scan_bundled_brushes_with_app(app);
        }

        self.load_builtin_curves();
    }

    fn load_code_presets(&mut self, profile: BrushLoadProfile) {
        for preset_id in preset_ids_for_profile(profile) {
            if let Some(factory) = preset_factory(preset_id) {
                let preset = factory();
                self.brushes.insert(preset.id.clone(), preset);
            }
        }

        if include_kain_brushes(profile) {
            for preset in kain_brush_presets() {
                self.brushes.insert(preset.id.clone(), preset);
            }
        }
    }

    fn load_builtin_curves(&mut self) {
        for curve in [BrushCurve::linear(), BrushCurve::soft(), BrushCurve::hard()] {
            self.curves.insert(curve.id.clone(), curve);
        }
    }

    fn scan_bundled_brushes_from_paths(&mut self) {
        // New unified location for all built-in brushes
        let resources_paths = [
            PathBuf::from("resources/KBrushes"),
            PathBuf::from("../resources/KBrushes"), // From apps/tauri subdir
            PathBuf::from("../../resources/KBrushes"), // From target/debug
            PathBuf::from("../../../resources/KBrushes"), // From deeper build dirs
            PathBuf::from("apps/tauri/resources/KBrushes"), // From project root
        ];

        for resources_path in &resources_paths {
            if !resources_path.exists() {
                continue;
            }

            let pattern = resources_path.join("**/*.kbrush");
            let pattern_str = pattern.to_string_lossy();
            log::info!(
                "[BrushLibrary] Scanning built-in brushes: {:?}",
                resources_path
            );

            if let Ok(entries) = glob::glob(&pattern_str) {
                for entry in entries.flatten() {
                    if let Err(e) = self.load_brush_file(&entry) {
                        log::warn!("[BrushLibrary] Failed to load built-in {:?}: {}", entry, e);
                    }
                }
            }
            break; // Found valid path, don't scan multiple locations
        }
    }

    fn scan_bundled_brushes_with_app(&mut self, app: &tauri::AppHandle) {
        let brushes_path = app
            .path()
            .resolve("resources/KBrushes", tauri::path::BaseDirectory::Resource)
            .ok();

        if let Some(brushes_path) = brushes_path {
            log::info!(
                "[BrushLibrary] Scanning bundled brushes: {:?}",
                brushes_path
            );

            let pattern = brushes_path.join("**/*.kbrush");
            let pattern_str = pattern.to_string_lossy();

            if let Ok(entries) = glob::glob(&pattern_str) {
                let mut loaded_count = 0;
                for entry in entries.flatten() {
                    match self.load_brush_file(&entry) {
                        Ok(_) => loaded_count += 1,
                        Err(e) => log::warn!("[BrushLibrary] Failed to load {:?}: {}", entry, e),
                    }
                }
                log::info!(
                    "[BrushLibrary] Loaded {} brushes from bundled resources",
                    loaded_count
                );
            }
        } else {
            log::warn!("[BrushLibrary] Could not resolve bundled brushes directory");
        }
    }

    /// Scan library folder for .kbrush files
    fn scan_library(&mut self) -> Result<(), String> {
        let Some(lib_path) = &self.library_path else {
            return Ok(());
        };

        let pattern = lib_path.join("**/*.kbrush");
        let pattern_str = pattern.to_string_lossy();

        for entry in glob::glob(&pattern_str).map_err(|e| e.to_string())? {
            if let Ok(path) = entry {
                if let Err(e) = self.load_brush_file(&path) {
                    log::warn!("[BrushLibrary] Failed to load {:?}: {}", path, e);
                }
            }
        }

        Ok(())
    }

    /// Load a single brush file
    fn load_brush_file(&mut self, path: &PathBuf) -> Result<String, String> {
        let content = std::fs::read_to_string(path).map_err(|e| format!("Read error: {}", e))?;

        let brush: KBrushAsset =
            serde_json::from_str(&content).map_err(|e| format!("Parse error: {}", e))?;

        let id = brush.id.clone();
        log::debug!("[BrushLibrary] Loaded brush: {} ({})", brush.name, id);
        self.brushes.insert(id.clone(), brush);

        Ok(id)
    }

    /// Get a brush by ID
    pub fn get(&self, id: &str) -> Option<&KBrushAsset> {
        self.brushes.get(id)
    }

    /// Get a brush by ID (cloned)
    pub fn get_cloned(&self, id: &str) -> Option<KBrushAsset> {
        self.brushes.get(id).cloned()
    }

    /// List all brushes
    pub fn list(&self) -> Vec<&KBrushAsset> {
        self.brushes.values().collect()
    }

    /// List brushes by category
    pub fn list_by_category(&self, category: &str) -> Vec<&KBrushAsset> {
        self.brushes
            .values()
            .filter(|b| b.category.starts_with(category))
            .collect()
    }

    /// Save a brush to the library
    pub fn save(&mut self, brush: KBrushAsset) -> Result<(), String> {
        let Some(lib_path) = &self.library_path else {
            return Err("Library not initialized".into());
        };

        // Determine file path based on category
        let category_path = lib_path.join(&brush.category);
        std::fs::create_dir_all(&category_path)
            .map_err(|e| format!("Failed to create category folder: {}", e))?;

        let file_path = category_path.join(format!("{}.kbrush", sanitize_filename(&brush.id)));

        let json =
            serde_json::to_string_pretty(&brush).map_err(|e| format!("Serialize error: {}", e))?;

        std::fs::write(&file_path, json).map_err(|e| format!("Write error: {}", e))?;

        log::info!("[BrushLibrary] Saved brush {} to {:?}", brush.id, file_path);
        self.brushes.insert(brush.id.clone(), brush);

        Ok(())
    }

    /// Delete a brush
    pub fn delete(&mut self, id: &str) -> Result<(), String> {
        self.brushes.remove(id);
        // TODO: Delete file from disk
        Ok(())
    }

    /// Get or bake a curve LUT
    pub fn get_curve_lut(&mut self, curve_id: &str, samples: usize) -> Option<Arc<CurveLut>> {
        // Check cache
        if let Some(lut) = self.curve_luts.get(curve_id) {
            return Some(lut.clone());
        }

        // Bake and cache
        if let Some(curve) = self.curves.get(curve_id) {
            let lut = Arc::new(curve.bake_lut(samples));
            self.curve_luts.insert(curve_id.into(), lut.clone());
            return Some(lut);
        }

        None
    }

    /// Get a curve by ID
    pub fn get_curve(&self, id: &str) -> Option<&BrushCurve> {
        self.curves.get(id)
    }

    /// Save a curve
    pub fn save_curve(&mut self, curve: BrushCurve) {
        // Invalidate cached LUT
        self.curve_luts.remove(&curve.id);
        self.curves.insert(curve.id.clone(), curve);
    }
}

impl Default for KBrushLibrary {
    fn default() -> Self {
        Self::new()
    }
}

/// Get the default library path
fn get_library_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA not set")?;
        Ok(PathBuf::from(appdata).join("K_OS").join("KBrushLibrary"))
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME not set")?;
        Ok(PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("K_OS")
            .join("KBrushLibrary"))
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME not set")?;
        Ok(PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("K_OS")
            .join("KBrushLibrary"))
    }
}

/// Sanitize a string for use as a filename
fn sanitize_filename(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Initialize the brush library
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn init_brush_library(app: tauri::AppHandle) -> Result<usize, String> {
    let mut lib = BRUSH_LIBRARY.write();
    lib.init_with_app(&app)?;
    Ok(lib.brushes.len())
}

/// List all brushes
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn list_brushes() -> Vec<KBrushAsset> {
    BRUSH_LIBRARY.read().list().into_iter().cloned().collect()
}

/// Get a brush by ID
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn get_brush(id: String) -> Option<KBrushAsset> {
    BRUSH_LIBRARY.read().get_cloned(&id)
}

/// Save a brush
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn save_brush(brush: KBrushAsset) -> Result<(), String> {
    BRUSH_LIBRARY.write().save(brush)
}

/// Delete a brush
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn delete_brush(id: String) -> Result<(), String> {
    BRUSH_LIBRARY.write().delete(&id)
}

#[cfg(test)]
mod tests {
    use super::{preset_ids_for_profile, BrushLoadProfile, KBrushLibrary};
    use std::collections::HashSet;

    #[test]
    fn brush_profile_defaults_to_full() {
        let profile = BrushLoadProfile::from_env_with(|_| None);
        assert_eq!(profile, BrushLoadProfile::Full);
    }

    #[test]
    fn brush_profile_accepts_minimal_flag() {
        let profile = BrushLoadProfile::from_env_with(|key| {
            if key == "KOS_BRUSH_MINIMAL" {
                Some("1".to_string())
            } else {
                None
            }
        });
        assert_eq!(profile, BrushLoadProfile::MinimalWgsl);
    }

    #[test]
    fn minimal_profile_loads_core_wgsl_brushes_only() {
        let mut lib = KBrushLibrary::new();
        lib.load_builtin_presets(BrushLoadProfile::MinimalWgsl);

        let expected_count = preset_ids_for_profile(BrushLoadProfile::MinimalWgsl).len();
        assert_eq!(lib.brushes.len(), expected_count);

        let shaders: HashSet<_> = lib
            .brushes
            .values()
            .map(|brush| brush.kernel.shader_name().to_string())
            .collect();

        assert!(shaders.contains("sculpt_stamp"));
        assert!(shaders.contains("sculpt_smooth"));
        assert!(shaders.contains("sculpt_pinch"));
        assert!(shaders.contains("sculpt_grab"));
        assert!(shaders.contains("sculpt_physics"));
    }
}

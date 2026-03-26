// Asset Manager
// Material library browsing, tagging, and version control

use anyhow::{Context, Result};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use sublime_fuzzy::FuzzySearch;
use uuid::Uuid;

use super::{Material, MaterialCategory};

/// Asset manager for material library organization with hierarchical folder structure
pub struct AssetManager {
    /// Root directory for the material library
    library_root: PathBuf,
    /// Folder structure for organizing materials by category
    folder_structure: HashMap<MaterialCategory, PathBuf>,
}

/// Search result with relevance score for ranking
#[derive(Debug, Clone)]
pub struct SearchResult {
    pub material_id: Uuid,
    pub score: isize,
}

impl AssetManager {
    /// Create a new asset manager with the specified library root directory
    pub fn new(library_root: PathBuf) -> Result<Self> {
        // Create root directory if it doesn't exist
        fs::create_dir_all(&library_root)
            .context("Failed to create material library root directory")?;

        // Initialize hierarchical folder structure
        let mut folder_structure = HashMap::new();

        // Create category folders
        for category in [
            MaterialCategory::Metal,
            MaterialCategory::Wood,
            MaterialCategory::Stone,
            MaterialCategory::Fabric,
            MaterialCategory::Plastic,
            MaterialCategory::Organic,
            MaterialCategory::SciFi,
            MaterialCategory::Fantasy,
        ] {
            let category_path = library_root.join(category_folder_name(category));
            fs::create_dir_all(&category_path)
                .with_context(|| format!("Failed to create category folder: {:?}", category))?;
            folder_structure.insert(category, category_path);
        }

        Ok(Self {
            library_root,
            folder_structure,
        })
    }

    /// Get the library root directory
    pub fn library_root(&self) -> &Path {
        &self.library_root
    }

    /// Get the folder path for a specific material category
    pub fn category_folder(&self, category: MaterialCategory) -> Option<&Path> {
        self.folder_structure.get(&category).map(|p| p.as_path())
    }

    /// Get the recommended file path for saving a material based on its metadata
    pub fn get_material_path(&self, material: &Material) -> PathBuf {
        let category_folder = self
            .folder_structure
            .get(&material.metadata.category)
            .expect("Category folder should exist");

        // Sanitize material name for filesystem
        let safe_name = sanitize_filename(&material.metadata.name);

        // Use UUID to ensure uniqueness
        let filename = format!("{}_{}.json", safe_name, material.id);

        category_folder.join(filename)
    }

    /// Search materials by query string with fuzzy matching
    /// Returns results sorted by relevance score (highest first)
    pub fn search(&self, query: &str, materials: &HashMap<Uuid, Material>) -> Vec<SearchResult> {
        if query.is_empty() {
            // Return all materials with neutral score
            return materials
                .keys()
                .map(|id| SearchResult {
                    material_id: *id,
                    score: 0,
                })
                .collect();
        }

        let mut results: Vec<SearchResult> = materials
            .iter()
            .filter_map(|(id, mat)| {
                // Calculate fuzzy match scores for name, description, and tags
                let name_score = FuzzySearch::new(query, &mat.metadata.name)
                    .case_insensitive()
                    .best_match()
                    .map(|m| m.score())
                    .unwrap_or(0);

                let desc_score = FuzzySearch::new(query, &mat.metadata.description)
                    .case_insensitive()
                    .best_match()
                    .map(|m| m.score())
                    .unwrap_or(0);

                // Check tags for fuzzy matches
                let tag_score = mat
                    .metadata
                    .tags
                    .iter()
                    .filter_map(|tag| {
                        FuzzySearch::new(query, tag)
                            .case_insensitive()
                            .best_match()
                            .map(|m| m.score())
                    })
                    .max()
                    .unwrap_or(0);

                // Use the best score from name, description, or tags
                let best_score = name_score.max(desc_score).max(tag_score);

                // Only include results with a positive score (some match found)
                if best_score > 0 {
                    Some(SearchResult {
                        material_id: *id,
                        score: best_score,
                    })
                } else {
                    None
                }
            })
            .collect();

        // Sort by score descending (best matches first)
        results.sort_by(|a, b| b.score.cmp(&a.score));

        results
    }

    /// Filter materials by category
    pub fn filter_by_category(
        &self,
        materials: &HashMap<Uuid, Material>,
        category: MaterialCategory,
    ) -> Vec<Uuid> {
        materials
            .iter()
            .filter(|(_, mat)| mat.metadata.category == category)
            .map(|(id, _)| *id)
            .collect()
    }

    /// Search materials with both fuzzy matching and category filtering
    pub fn search_with_category(
        &self,
        query: &str,
        materials: &HashMap<Uuid, Material>,
        category: Option<MaterialCategory>,
    ) -> Vec<SearchResult> {
        // First apply category filter if specified
        let filtered_materials: HashMap<Uuid, Material> = if let Some(cat) = category {
            materials
                .iter()
                .filter(|(_, mat)| mat.metadata.category == cat)
                .map(|(id, mat)| (*id, mat.clone()))
                .collect()
        } else {
            materials.clone()
        };

        // Then apply fuzzy search
        self.search(query, &filtered_materials)
    }
}

/// Convert MaterialCategory to folder name
fn category_folder_name(category: MaterialCategory) -> &'static str {
    match category {
        MaterialCategory::Metal => "Metal",
        MaterialCategory::Wood => "Wood",
        MaterialCategory::Stone => "Stone",
        MaterialCategory::Fabric => "Fabric",
        MaterialCategory::Plastic => "Plastic",
        MaterialCategory::Organic => "Organic",
        MaterialCategory::SciFi => "SciFi",
        MaterialCategory::Fantasy => "Fantasy",
    }
}

/// Sanitize a filename by replacing invalid characters
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

impl Default for AssetManager {
    fn default() -> Self {
        // Use a temporary directory for default instance
        let temp_dir = std::env::temp_dir().join("k_os_materials");
        Self::new(temp_dir).expect("Failed to create default AssetManager")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::material::MaterialMetadata;
    use chrono::Utc;
    use tempfile::TempDir;

    fn create_test_manager() -> (AssetManager, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let manager = AssetManager::new(temp_dir.path().to_path_buf()).unwrap();
        (manager, temp_dir)
    }

    fn create_test_material(
        name: &str,
        description: &str,
        tags: Vec<String>,
        category: MaterialCategory,
    ) -> Material {
        Material {
            id: Uuid::new_v4(),
            metadata: MaterialMetadata {
                name: name.to_string(),
                description: description.to_string(),
                tags,
                author: "Test".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 1,
                category,
            },
            layers: vec![],
            animation: None,
            variants: vec![],
            base_material: None,
        }
    }

    #[test]
    fn test_asset_manager_creation() {
        let (manager, _temp) = create_test_manager();

        // Verify library root exists
        assert!(manager.library_root().exists());

        // Verify all category folders exist
        for category in [
            MaterialCategory::Metal,
            MaterialCategory::Wood,
            MaterialCategory::Stone,
            MaterialCategory::Fabric,
            MaterialCategory::Plastic,
            MaterialCategory::Organic,
            MaterialCategory::SciFi,
            MaterialCategory::Fantasy,
        ] {
            let folder = manager.category_folder(category).unwrap();
            assert!(
                folder.exists(),
                "Category folder should exist: {:?}",
                category
            );
        }
    }

    #[test]
    fn test_get_material_path() {
        let (manager, _temp) = create_test_manager();

        let material = create_test_material(
            "Rusty Metal",
            "Old rusty metal texture",
            vec!["metal".to_string(), "rust".to_string()],
            MaterialCategory::Metal,
        );

        let path = manager.get_material_path(&material);

        // Verify path is in the Metal category folder
        assert!(path.starts_with(manager.category_folder(MaterialCategory::Metal).unwrap()));

        // Verify filename contains sanitized name and UUID
        let filename = path.file_name().unwrap().to_str().unwrap();
        assert!(filename.contains("Rusty Metal"));
        assert!(filename.contains(&material.id.to_string()));
        assert!(filename.ends_with(".json"));
    }

    #[test]
    fn test_sanitize_filename() {
        let (manager, _temp) = create_test_manager();

        let material = create_test_material(
            "Test/Material:With*Invalid?Chars",
            "Test description",
            vec![],
            MaterialCategory::Metal,
        );

        let path = manager.get_material_path(&material);
        let filename = path.file_name().unwrap().to_str().unwrap();

        // Verify invalid characters are replaced with underscores
        assert!(!filename.contains('/'));
        assert!(!filename.contains(':'));
        assert!(!filename.contains('*'));
        assert!(!filename.contains('?'));
    }

    #[test]
    fn test_fuzzy_search_by_name() {
        let (manager, _temp) = create_test_manager();
        let mut materials = HashMap::new();

        let material = create_test_material(
            "Rusty Metal",
            "Old rusty metal texture",
            vec!["metal".to_string(), "rust".to_string()],
            MaterialCategory::Metal,
        );
        let id = material.id;
        materials.insert(id, material);

        // Exact match
        let results = manager.search("Rusty Metal", &materials);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].material_id, id);
        assert!(results[0].score > 0);

        // Fuzzy match with typo
        let results = manager.search("Rsty", &materials);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].material_id, id);

        // Partial match
        let results = manager.search("rust", &materials);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].material_id, id);
    }

    #[test]
    fn test_fuzzy_search_by_description() {
        let (manager, _temp) = create_test_manager();
        let mut materials = HashMap::new();

        let material = create_test_material(
            "Material 1",
            "Weathered concrete surface",
            vec![],
            MaterialCategory::Stone,
        );
        let id = material.id;
        materials.insert(id, material);

        let results = manager.search("concrete", &materials);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].material_id, id);

        // Fuzzy match
        let results = manager.search("concret", &materials);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].material_id, id);
    }

    #[test]
    fn test_fuzzy_search_by_tags() {
        let (manager, _temp) = create_test_manager();
        let mut materials = HashMap::new();

        let material = create_test_material(
            "Material 1",
            "Test description",
            vec!["procedural".to_string(), "seamless".to_string()],
            MaterialCategory::Fabric,
        );
        let id = material.id;
        materials.insert(id, material);

        let results = manager.search("procedural", &materials);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].material_id, id);

        // Fuzzy match on tag
        let results = manager.search("procedul", &materials);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].material_id, id);
    }

    #[test]
    fn test_search_ranking() {
        let (manager, _temp) = create_test_manager();
        let mut materials = HashMap::new();

        // Material with exact name match
        let mat1 =
            create_test_material("Metal", "Some description", vec![], MaterialCategory::Metal);
        let id1 = mat1.id;
        materials.insert(id1, mat1);

        // Material with partial match in description
        let mat2 = create_test_material(
            "Material 2",
            "Contains metal in description",
            vec![],
            MaterialCategory::Stone,
        );
        let id2 = mat2.id;
        materials.insert(id2, mat2);

        let results = manager.search("metal", &materials);
        assert_eq!(results.len(), 2);

        assert!(results.iter().any(|result| result.material_id == id1));
        assert!(results.iter().any(|result| result.material_id == id2));
    }

    #[test]
    fn test_search_empty_query() {
        let (manager, _temp) = create_test_manager();
        let mut materials = HashMap::new();

        let mat1 = create_test_material("Mat1", "Desc1", vec![], MaterialCategory::Metal);
        let mat2 = create_test_material("Mat2", "Desc2", vec![], MaterialCategory::Wood);

        materials.insert(mat1.id, mat1);
        materials.insert(mat2.id, mat2);

        // Empty query should return all materials
        let results = manager.search("", &materials);
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_search_no_matches() {
        let (manager, _temp) = create_test_manager();
        let mut materials = HashMap::new();

        let material = create_test_material(
            "Rusty Metal",
            "Old rusty metal texture",
            vec!["metal".to_string()],
            MaterialCategory::Metal,
        );
        materials.insert(material.id, material);

        // Search for something completely unrelated
        let results = manager.search("zzzzzzzzz", &materials);
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_filter_by_category() {
        let (manager, _temp) = create_test_manager();
        let mut materials = HashMap::new();

        let metal1 = create_test_material("Metal 1", "Desc", vec![], MaterialCategory::Metal);
        let metal2 = create_test_material("Metal 2", "Desc", vec![], MaterialCategory::Metal);
        let wood1 = create_test_material("Wood 1", "Desc", vec![], MaterialCategory::Wood);

        let metal1_id = metal1.id;
        let metal2_id = metal2.id;

        materials.insert(metal1.id, metal1);
        materials.insert(metal2.id, metal2);
        materials.insert(wood1.id, wood1);

        let results = manager.filter_by_category(&materials, MaterialCategory::Metal);
        assert_eq!(results.len(), 2);
        assert!(results.contains(&metal1_id));
        assert!(results.contains(&metal2_id));
    }

    #[test]
    fn test_search_with_category() {
        let (manager, _temp) = create_test_manager();
        let mut materials = HashMap::new();

        let metal = create_test_material(
            "Rusty Metal",
            "Old metal",
            vec!["rust".to_string()],
            MaterialCategory::Metal,
        );
        let wood = create_test_material(
            "Rusty Wood",
            "Old wood",
            vec!["rust".to_string()],
            MaterialCategory::Wood,
        );

        let metal_id = metal.id;

        materials.insert(metal.id, metal);
        materials.insert(wood.id, wood);

        // Search for "rust" but only in Metal category
        let results =
            manager.search_with_category("rust", &materials, Some(MaterialCategory::Metal));
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].material_id, metal_id);

        // Search without category filter should return both
        let results = manager.search_with_category("rust", &materials, None);
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_case_insensitive_search() {
        let (manager, _temp) = create_test_manager();
        let mut materials = HashMap::new();

        let material = create_test_material(
            "Rusty Metal",
            "Old rusty metal texture",
            vec!["METAL".to_string()],
            MaterialCategory::Metal,
        );
        let id = material.id;
        materials.insert(id, material);

        // All these should match regardless of case
        let results = manager.search("RUSTY", &materials);
        assert_eq!(results.len(), 1);

        let results = manager.search("rusty", &materials);
        assert_eq!(results.len(), 1);

        let results = manager.search("RuStY", &materials);
        assert_eq!(results.len(), 1);
    }
}

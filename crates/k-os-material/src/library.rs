//! Material library for organizing and managing materials

use crate::error::{MaterialError, Result};
use crate::material::Material;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use uuid::Uuid;

/// A library for managing multiple materials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialLibrary {
    /// Library name
    name: String,
    /// Materials indexed by ID
    materials: HashMap<Uuid, Material>,
    /// Material name to ID mapping for quick lookup
    name_index: HashMap<String, Uuid>,
}

impl MaterialLibrary {
    /// Create a new empty material library
    pub fn new() -> Self {
        Self::with_name("Default Library")
    }

    /// Create a new material library with a specific name
    pub fn with_name(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            materials: HashMap::new(),
            name_index: HashMap::new(),
        }
    }

    /// Get the library name
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Set the library name
    pub fn set_name(&mut self, name: impl Into<String>) {
        self.name = name.into();
    }

    /// Add a material to the library
    pub fn add_material(&mut self, material: Material) -> Uuid {
        let id = material.id();
        let name = material.name().to_string();

        // Update name index
        self.name_index.insert(name, id);
        self.materials.insert(id, material);

        id
    }

    /// Get a material by ID
    pub fn get_material(&self, id: &Uuid) -> Option<&Material> {
        self.materials.get(id)
    }

    /// Get a mutable reference to a material by ID
    pub fn get_material_mut(&mut self, id: &Uuid) -> Option<&mut Material> {
        self.materials.get_mut(id)
    }

    /// Get a material by name
    pub fn get_material_by_name(&self, name: &str) -> Option<&Material> {
        self.name_index
            .get(name)
            .and_then(|id| self.materials.get(id))
    }

    /// Remove a material from the library
    pub fn remove_material(&mut self, id: &Uuid) -> Option<Material> {
        if let Some(material) = self.materials.remove(id) {
            self.name_index.remove(material.name());
            Some(material)
        } else {
            None
        }
    }

    /// Check if a material exists in the library
    pub fn contains_material(&self, id: &Uuid) -> bool {
        self.materials.contains_key(id)
    }

    /// Check if a material with the given name exists
    pub fn contains_name(&self, name: &str) -> bool {
        self.name_index.contains_key(name)
    }

    /// Get the number of materials in the library
    pub fn material_count(&self) -> usize {
        self.materials.len()
    }

    /// Check if the library is empty
    pub fn is_empty(&self) -> bool {
        self.materials.is_empty()
    }

    /// Clear all materials from the library
    pub fn clear(&mut self) {
        self.materials.clear();
        self.name_index.clear();
    }

    /// Get all material IDs
    pub fn material_ids(&self) -> Vec<Uuid> {
        self.materials.keys().copied().collect()
    }

    /// Get all material names
    pub fn material_names(&self) -> Vec<String> {
        self.name_index.keys().cloned().collect()
    }

    /// Get all materials
    pub fn materials(&self) -> Vec<&Material> {
        self.materials.values().collect()
    }

    /// Iterate over all materials
    pub fn iter(&self) -> impl Iterator<Item = &Material> {
        self.materials.values()
    }

    /// Rename a material
    pub fn rename_material(&mut self, id: &Uuid, new_name: impl Into<String>) -> Result<()> {
        let new_name = new_name.into();

        if new_name.is_empty() {
            return Err(MaterialError::InvalidName(
                "Name cannot be empty".to_string(),
            ));
        }

        // Check if name already exists
        if self.name_index.contains_key(&new_name) {
            return Err(MaterialError::InvalidName(format!(
                "Material with name '{}' already exists",
                new_name
            )));
        }

        if let Some(material) = self.materials.get_mut(id) {
            let old_name = material.name().to_string();
            material.set_name(&new_name)?;

            // Update name index
            self.name_index.remove(&old_name);
            self.name_index.insert(new_name, *id);

            Ok(())
        } else {
            Err(MaterialError::MaterialNotFound(*id))
        }
    }

    /// Duplicate a material with a new name
    pub fn duplicate_material(&mut self, id: &Uuid, new_name: impl Into<String>) -> Result<Uuid> {
        let new_name = new_name.into();

        if self.name_index.contains_key(&new_name) {
            return Err(MaterialError::InvalidName(format!(
                "Material with name '{}' already exists",
                new_name
            )));
        }

        if let Some(material) = self.materials.get(id) {
            let cloned = material.clone_with_name(&new_name);
            let new_id = self.add_material(cloned);
            Ok(new_id)
        } else {
            Err(MaterialError::MaterialNotFound(*id))
        }
    }

    /// Save the library to a JSON file
    pub fn save_to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let json = serde_json::to_string_pretty(self)?;
        fs::write(path, json)?;
        Ok(())
    }

    /// Load a library from a JSON file
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let json = fs::read_to_string(path)?;
        let library: MaterialLibrary = serde_json::from_str(&json)?;
        Ok(library)
    }

    /// Merge another library into this one
    pub fn merge(&mut self, other: &MaterialLibrary) -> Vec<Uuid> {
        let mut added_ids = Vec::new();

        for material in other.materials.values() {
            // If name conflicts, append a suffix
            let mut name = material.name().to_string();
            let mut counter = 1;
            while self.name_index.contains_key(&name) {
                name = format!("{}_{}", material.name(), counter);
                counter += 1;
            }

            let cloned = material.clone_with_name(&name);
            let id = cloned.id();
            self.add_material(cloned);
            added_ids.push(id);
        }

        added_ids
    }

    /// Validate all materials in the library
    pub fn validate(&self) -> Result<()> {
        for material in self.materials.values() {
            material.validate()?;
        }
        Ok(())
    }
}

impl Default for MaterialLibrary {
    fn default() -> Self {
        Self::new()
    }
}

/// Thread-safe shared material library
pub type SharedMaterialLibrary = Arc<RwLock<MaterialLibrary>>;

/// Create a new shared material library
pub fn create_shared_library() -> SharedMaterialLibrary {
    Arc::new(RwLock::new(MaterialLibrary::new()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_library_creation() {
        let library = MaterialLibrary::new();
        assert_eq!(library.name(), "Default Library");
        assert_eq!(library.material_count(), 0);
        assert!(library.is_empty());
    }

    #[test]
    fn test_add_and_get_material() {
        let mut library = MaterialLibrary::new();
        let material = Material::new("Test Material");
        let id = library.add_material(material);

        assert_eq!(library.material_count(), 1);
        assert!(library.contains_material(&id));

        let retrieved = library.get_material(&id).unwrap();
        assert_eq!(retrieved.name(), "Test Material");
    }

    #[test]
    fn test_get_material_by_name() {
        let mut library = MaterialLibrary::new();
        let material = Material::new("Named Material");
        library.add_material(material);

        let retrieved = library.get_material_by_name("Named Material");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name(), "Named Material");
    }

    #[test]
    fn test_remove_material() {
        let mut library = MaterialLibrary::new();
        let material = Material::new("To Remove");
        let id = library.add_material(material);

        assert_eq!(library.material_count(), 1);

        let removed = library.remove_material(&id);
        assert!(removed.is_some());
        assert_eq!(library.material_count(), 0);
        assert!(!library.contains_material(&id));
    }

    #[test]
    fn test_rename_material() {
        let mut library = MaterialLibrary::new();
        let material = Material::new("Original");
        let id = library.add_material(material);

        library.rename_material(&id, "Renamed").unwrap();

        assert!(library.contains_name("Renamed"));
        assert!(!library.contains_name("Original"));

        let mat = library.get_material(&id).unwrap();
        assert_eq!(mat.name(), "Renamed");
    }

    #[test]
    fn test_duplicate_material() {
        let mut library = MaterialLibrary::new();
        let material = Material::new("Original");
        let original_id = library.add_material(material);

        let duplicate_id = library
            .duplicate_material(&original_id, "Duplicate")
            .unwrap();

        assert_eq!(library.material_count(), 2);
        assert_ne!(original_id, duplicate_id);

        let duplicate = library.get_material(&duplicate_id).unwrap();
        assert_eq!(duplicate.name(), "Duplicate");
    }

    #[test]
    fn test_library_merge() {
        let mut library1 = MaterialLibrary::new();
        library1.add_material(Material::new("Mat1"));

        let mut library2 = MaterialLibrary::new();
        library2.add_material(Material::new("Mat2"));
        library2.add_material(Material::new("Mat3"));

        let added = library1.merge(&library2);

        assert_eq!(library1.material_count(), 3);
        assert_eq!(added.len(), 2);
    }

    #[test]
    fn test_library_clear() {
        let mut library = MaterialLibrary::new();
        library.add_material(Material::new("Mat1"));
        library.add_material(Material::new("Mat2"));

        assert_eq!(library.material_count(), 2);

        library.clear();

        assert_eq!(library.material_count(), 0);
        assert!(library.is_empty());
    }

    #[test]
    fn test_shared_library() {
        let shared = create_shared_library();

        {
            let mut lib = shared.write();
            lib.add_material(Material::new("Shared Material"));
        }

        {
            let lib = shared.read();
            assert_eq!(lib.material_count(), 1);
        }
    }
}

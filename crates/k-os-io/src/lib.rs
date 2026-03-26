//! K_OS IO Domain
//!
//! This crate is the ownership boundary for storage and import/export logic.

pub mod file_ops;
pub mod material_export;
pub mod paths;
pub mod storage;

#[doc(hidden)]
pub mod autopbr {
    pub use k_os_material::autopbr::*;
}

#[doc(hidden)]
pub mod material {
    pub use k_os_material::material::*;
}

pub use storage::{
    backends, cache, compression, config, engine, entanglement, import_export, matrix_db, metrics,
    transaction, types, version, Asset, AssetHandle, AssetMetadata, AssetQuery, AssetType,
    StorageBackend, StorageConfig, StorageEngine, StorageError, StorageMetrics,
};

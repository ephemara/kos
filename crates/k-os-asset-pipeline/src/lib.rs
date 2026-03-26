//! # K_OS Asset Pipeline
//!
//! Unified asset import/export/processing system with:
//! - Format detection by extension
//! - Trait-based extensible importers/exporters/processors
//! - File hash-based caching
//! - Thumbnail generation
//! - Metadata extraction
//! - Thread-safe design
//!
//! ## Example
//!
//! ```no_run
//! use k_os_asset_pipeline::{AssetPipeline, importers::GltfImporter};
//! use std::path::PathBuf;
//! use std::sync::Arc;
//!
//! let cache_dir = PathBuf::from("./cache/assets");
//! let pipeline = AssetPipeline::new(cache_dir).unwrap();
//!
//! // Register importers
//! pipeline.register_importer(Arc::new(GltfImporter::new()));
//!
//! // Import asset
//! let asset = pipeline.import(&PathBuf::from("model.gltf")).unwrap();
//! ```

pub mod asset;
pub mod cache;
pub mod error;
pub mod exporters;
pub mod hash;
pub mod importers;
pub mod metadata;
pub mod pipeline;
pub mod processors;
pub mod thumbnail;

// Unit test modules
#[cfg(test)]
mod cache_tests;
#[cfg(test)]
mod format_detection_tests;
#[cfg(test)]
mod import_export_tests;
#[cfg(test)]
mod processor_tests;

// Re-exports
pub use asset::{Asset, AssetData, AssetType};
pub use error::{AssetError, Result};
pub use pipeline::{AssetExporter, AssetImporter, AssetPipeline, AssetProcessor};

//! Asset processors for processing pipeline

pub mod metadata_processor;
pub mod thumbnail_processor;
pub mod validation_processor;

pub use metadata_processor::MetadataProcessor;
pub use thumbnail_processor::ThumbnailProcessor;
pub use validation_processor::ValidationProcessor;

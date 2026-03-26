//! K_OS Test Module Library
//! 
//! This library provides core functionality for testing the DocGen system.
//! It demonstrates typical patterns used in the K_OS DCC Suite.

pub mod processor;
pub mod utils;

pub use processor::{DataProcessor, ProcessorConfig, ProcessedData};
pub use utils::{MathUtils, FileUtils};

/// Library version constant
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Initialize the test module with default settings
pub fn init() -> Result<(), Box<dyn std::error::Error>> {
    println!("Initializing K_OS Test Module v{}", VERSION);
    Ok(())
}
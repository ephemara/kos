//! Error types for the plugin system

use thiserror::Error;

/// Result type for plugin operations
pub type Result<T> = std::result::Result<T, PluginError>;

/// Errors that can occur during plugin operations
#[derive(Error, Debug)]
pub enum PluginError {
    /// Plugin not found
    #[error("Plugin not found: {0}")]
    PluginNotFound(String),

    /// Plugin already loaded
    #[error("Plugin already loaded: {0}")]
    PluginAlreadyLoaded(String),

    /// Failed to load plugin library
    #[error("Failed to load plugin library: {0}")]
    LoadError(String),

    /// Plugin API version incompatible
    #[error(
        "Plugin API version incompatible: plugin={plugin_version}, required={required_version}"
    )]
    IncompatibleVersion {
        plugin_version: String,
        required_version: String,
    },

    /// Plugin initialization failed
    #[error("Plugin initialization failed: {0}")]
    InitializationError(String),

    /// Plugin shutdown failed
    #[error("Plugin shutdown failed: {0}")]
    ShutdownError(String),

    /// Plugin symbol not found
    #[error("Plugin symbol not found: {0}")]
    SymbolNotFound(String),

    /// Resource limit exceeded
    #[error("Resource limit exceeded: {resource} (limit: {limit}, current: {current})")]
    ResourceLimitExceeded {
        resource: String,
        limit: u64,
        current: u64,
    },

    /// Access denied to restricted resource
    #[error("Access denied to restricted resource: {0}")]
    AccessDenied(String),

    /// Plugin operation failed
    #[error("Plugin operation failed: {0}")]
    OperationFailed(String),

    /// IO error
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    /// Semver parsing error
    #[error("Semver parsing error: {0}")]
    SemverError(#[from] semver::Error),

    /// Other error
    #[error("{0}")]
    Other(String),
}

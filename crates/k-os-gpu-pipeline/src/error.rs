//! Error types for GPU Pipeline Manager

use thiserror::Error;

/// Result type for GPU Pipeline operations
pub type Result<T> = std::result::Result<T, GPUPipelineError>;

/// Errors that can occur in GPU Pipeline operations
#[derive(Error, Debug)]
pub enum GPUPipelineError {
    /// Shader compilation failed
    #[error("Shader compilation failed for '{shader_name}': {message}")]
    ShaderCompilationError {
        shader_name: String,
        message: String,
    },

    /// Shader file not found
    #[error("Shader file not found: {path}")]
    ShaderNotFound { path: String },

    /// Pipeline creation failed
    #[error("Pipeline creation failed: {0}")]
    PipelineCreationError(String),

    /// Buffer allocation failed
    #[error("Buffer allocation failed: size={size}, usage={usage:?}")]
    BufferAllocationError { size: u64, usage: String },

    /// GPU memory exhausted
    #[error("GPU memory exhausted: requested {requested} bytes, available {available} bytes")]
    OutOfMemory { requested: u64, available: u64 },

    /// Invalid buffer size
    #[error("Invalid buffer size: {size} (must be > 0)")]
    InvalidBufferSize { size: u64 },

    /// Hot-reload error
    #[error("Hot-reload error: {0}")]
    HotReloadError(String),

    /// File watcher error
    #[error("File watcher error: {0}")]
    FileWatcherError(#[from] notify::Error),

    /// IO error
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    /// WGPU error
    #[error("WGPU error: {0}")]
    WgpuError(String),
}

impl From<wgpu::Error> for GPUPipelineError {
    fn from(err: wgpu::Error) -> Self {
        GPUPipelineError::WgpuError(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shader_compilation_error_display() {
        let error = GPUPipelineError::ShaderCompilationError {
            shader_name: "test_shader".to_string(),
            message: "syntax error at line 10".to_string(),
        };
        let display = format!("{}", error);
        assert!(display.contains("test_shader"));
        assert!(display.contains("syntax error at line 10"));
    }

    #[test]
    fn test_shader_not_found_error_display() {
        let error = GPUPipelineError::ShaderNotFound {
            path: "shaders/missing.wgsl".to_string(),
        };
        let display = format!("{}", error);
        assert!(display.contains("shaders/missing.wgsl"));
    }

    #[test]
    fn test_invalid_buffer_size_error() {
        let error = GPUPipelineError::InvalidBufferSize { size: 0 };
        let display = format!("{}", error);
        assert!(display.contains("0"));
        assert!(display.contains("must be > 0"));
    }

    #[test]
    fn test_out_of_memory_error() {
        let error = GPUPipelineError::OutOfMemory {
            requested: 1024 * 1024 * 1024,
            available: 512 * 1024 * 1024,
        };
        let display = format!("{}", error);
        assert!(display.contains("1073741824"));
        assert!(display.contains("536870912"));
    }

    #[test]
    fn test_buffer_allocation_error() {
        let error = GPUPipelineError::BufferAllocationError {
            size: 4096,
            usage: "STORAGE | COPY_DST".to_string(),
        };
        let display = format!("{}", error);
        assert!(display.contains("4096"));
        assert!(display.contains("STORAGE"));
    }

    #[test]
    fn test_pipeline_creation_error() {
        let error = GPUPipelineError::PipelineCreationError("invalid entry point".to_string());
        let display = format!("{}", error);
        assert!(display.contains("invalid entry point"));
    }

    #[test]
    fn test_hot_reload_error() {
        let error = GPUPipelineError::HotReloadError("watcher failed".to_string());
        let display = format!("{}", error);
        assert!(display.contains("watcher failed"));
    }

    #[test]
    fn test_wgpu_error() {
        let error = GPUPipelineError::WgpuError("device lost".to_string());
        let display = format!("{}", error);
        assert!(display.contains("device lost"));
    }

    #[test]
    fn test_error_is_send_sync() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<GPUPipelineError>();
    }
}

//! Async Config - Loading states and error handling
//!
//! Configuration for handling async data (thumbnails, network requests, etc.)

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Async loading/error configuration
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct AsyncConfig {
    /// Component to show while loading
    #[serde(default)]
    pub loading: Option<String>,
    
    /// Component to show on error
    #[serde(default)]
    pub error: Option<String>,
    
    /// Props for loading component
    #[serde(default)]
    pub loading_props: serde_json::Value,
    
    /// Retry configuration
    #[serde(default)]
    pub retry: Option<RetryConfig>,
    
    /// Timeout in milliseconds
    #[serde(default)]
    pub timeout_ms: Option<u32>,
}

impl Default for AsyncConfig {
    fn default() -> Self {
        Self {
            loading: Some("Spinner".into()),
            error: Some("ErrorBadge".into()),
            loading_props: serde_json::Value::Object(Default::default()),
            retry: None,
            timeout_ms: None,
        }
    }
}

impl AsyncConfig {
    pub fn simple() -> Self {
        Self::default()
    }
    
    pub fn with_loading(component: impl Into<String>) -> Self {
        Self {
            loading: Some(component.into()),
            ..Default::default()
        }
    }
    
    pub fn with_retry(max_attempts: u32) -> Self {
        Self {
            retry: Some(RetryConfig {
                max_attempts,
                delay_ms: 1000,
                backoff: BackoffStrategy::Exponential,
            }),
            ..Default::default()
        }
    }
}

/// Retry configuration for failed async operations
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct RetryConfig {
    /// Maximum retry attempts
    pub max_attempts: u32,
    
    /// Initial delay between retries (ms)
    pub delay_ms: u32,
    
    /// Backoff strategy
    pub backoff: BackoffStrategy,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            delay_ms: 1000,
            backoff: BackoffStrategy::Exponential,
        }
    }
}

/// Backoff strategy for retries
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/krue/")]
pub enum BackoffStrategy {
    /// Fixed delay
    Fixed,
    /// Delay doubles each retry
    #[default]
    Exponential,
    /// Random jitter added
    Jitter,
}

/// Async value state (for bindings)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub enum AsyncValue<T> {
    /// Still loading
    Loading,
    
    /// Successfully loaded
    Ready(T),
    
    /// Failed to load
    Error { message: String },
}

impl<T> AsyncValue<T> {
    pub fn is_loading(&self) -> bool {
        matches!(self, Self::Loading)
    }
    
    pub fn is_ready(&self) -> bool {
        matches!(self, Self::Ready(_))
    }
    
    pub fn is_error(&self) -> bool {
        matches!(self, Self::Error { .. })
    }
    
    pub fn get(&self) -> Option<&T> {
        match self {
            Self::Ready(v) => Some(v),
            _ => None,
        }
    }
}

impl<T: Default> Default for AsyncValue<T> {
    fn default() -> Self {
        Self::Loading
    }
}

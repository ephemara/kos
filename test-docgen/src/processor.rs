use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Re-export from main module for convenience
pub use crate::{DataProcessor, ProcessorConfig, ProcessedData};

/// Advanced processing algorithms
pub struct AdvancedProcessor {
    base: DataProcessor,
    algorithms: Vec<Algorithm>,
}

/// Algorithm configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Algorithm {
    pub name: String,
    pub parameters: HashMap<String, f64>,
    pub enabled: bool,
}

impl AdvancedProcessor {
    /// Creates a new advanced processor with multiple algorithms
    pub fn new() -> Self {
        Self {
            base: DataProcessor::new(),
            algorithms: vec![
                Algorithm {
                    name: "fourier_transform".to_string(),
                    parameters: HashMap::from([("frequency".to_string(), 44100.0)]),
                    enabled: true,
                },
                Algorithm {
                    name: "noise_reduction".to_string(),
                    parameters: HashMap::from([("threshold".to_string(), 0.1)]),
                    enabled: false,
                },
            ],
        }
    }
    
    /// Processes data using advanced algorithms
    pub fn process_advanced(&self, input: Vec<i32>) -> ProcessedData {
        // Start with base processing
        let mut result = self.base.process_data(input);
        
        // Apply enabled algorithms
        for algorithm in &self.algorithms {
            if algorithm.enabled {
                result = self.apply_algorithm(&result, algorithm);
            }
        }
        
        result
    }
    
    /// Applies a specific algorithm to the data
    fn apply_algorithm(&self, data: &ProcessedData, algorithm: &Algorithm) -> ProcessedData {
        let mut new_data = data.clone();
        
        match algorithm.name.as_str() {
            "fourier_transform" => {
                // Simulate FFT processing
                new_data.values = data.values.iter().map(|&x| x.sin()).collect();
                new_data.metadata.insert("fft_applied".to_string(), "true".to_string());
            }
            "noise_reduction" => {
                // Simulate noise reduction
                let threshold = algorithm.parameters.get("threshold").unwrap_or(&0.1);
                new_data.values = data.values.iter()
                    .map(|&x| if x.abs() < *threshold { 0.0 } else { x })
                    .collect();
                new_data.metadata.insert("noise_reduced".to_string(), "true".to_string());
            }
            _ => {}
        }
        
        new_data
    }
}
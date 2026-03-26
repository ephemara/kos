use std::fs;
use std::path::Path;

/// Mathematical utility functions
pub struct MathUtils;

impl MathUtils {
    /// Calculates the mean of a vector of numbers
    pub fn mean(values: &[f64]) -> f64 {
        if values.is_empty() {
            return 0.0;
        }
        values.iter().sum::<f64>() / values.len() as f64
    }
    
    /// Calculates the standard deviation
    pub fn std_dev(values: &[f64]) -> f64 {
        let mean = Self::mean(values);
        let variance = values.iter()
            .map(|x| (x - mean).powi(2))
            .sum::<f64>() / values.len() as f64;
        variance.sqrt()
    }
    
    /// Normalizes values to 0-1 range
    pub fn normalize(values: &[f64]) -> Vec<f64> {
        let min = values.iter().fold(f64::INFINITY, |a, &b| a.min(b));
        let max = values.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));
        let range = max - min;
        
        if range == 0.0 {
            return vec![0.0; values.len()];
        }
        
        values.iter().map(|&x| (x - min) / range).collect()
    }
}

/// File system utility functions
pub struct FileUtils;

impl FileUtils {
    /// Reads a file and returns its contents as a string
    pub fn read_file<P: AsRef<Path>>(path: P) -> Result<String, std::io::Error> {
        fs::read_to_string(path)
    }
    
    /// Writes content to a file
    pub fn write_file<P: AsRef<Path>>(path: P, content: &str) -> Result<(), std::io::Error> {
        fs::write(path, content)
    }
    
    /// Checks if a file exists
    pub fn file_exists<P: AsRef<Path>>(path: P) -> bool {
        path.as_ref().exists()
    }
    
    /// Gets file size in bytes
    pub fn file_size<P: AsRef<Path>>(path: P) -> Result<u64, std::io::Error> {
        let metadata = fs::metadata(path)?;
        Ok(metadata.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_mean_calculation() {
        let values = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        assert_eq!(MathUtils::mean(&values), 3.0);
    }
    
    #[test]
    fn test_normalization() {
        let values = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let normalized = MathUtils::normalize(&values);
        assert_eq!(normalized, vec![0.0, 0.25, 0.5, 0.75, 1.0]);
    }
}
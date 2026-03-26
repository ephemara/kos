import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api';

interface ProcessedData {
  values: number[];
  metadata: Record<string, string>;
  timestamp: number;
}

interface ProcessorConfig {
  batch_size: number;
  use_gpu: boolean;
  precision: string;
}

/**
 * KTestApp - React component for testing DocGen system
 * Demonstrates typical K_OS app structure with Tauri integration
 */
export const KTestApp: React.FC = () => {
  const [inputData, setInputData] = useState<string>('1,2,3,4,5');
  const [result, setResult] = useState<ProcessedData | null>(null);
  const [config, setConfig] = useState<ProcessorConfig>({
    batch_size: 32,
    use_gpu: true,
    precision: 'fp16'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Processes input data using the Rust backend
   */
  const processData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const numbers = inputData.split(',').map(s => parseInt(s.trim()));
      const processed = await invoke<ProcessedData>('process_test_data', {
        input: numbers,
        config
      });
      
      setResult(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resets the application state
   */
  const resetState = () => {
    setResult(null);
    setError(null);
    setInputData('1,2,3,4,5');
  };

  useEffect(() => {
    // Initialize app on mount
    console.log('KTestApp initialized');
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">K_OS Test App</h1>
      <p className="text-gray-600 mb-8">
        Testing DocGen system with a sample React + Tauri application
      </p>

      {/* Configuration Panel */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Processor Configuration</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Batch Size</label>
            <input
              type="number"
              value={config.batch_size}
              onChange={(e) => setConfig({...config, batch_size: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Precision</label>
            <select
              value={config.precision}
              onChange={(e) => setConfig({...config, precision: e.target.value})}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="fp16">FP16</option>
              <option value="fp32">FP32</option>
            </select>
          </div>
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.use_gpu}
                onChange={(e) => setConfig({...config, use_gpu: e.target.checked})}
                className="mr-2"
              />
              Use GPU
            </label>
          </div>
        </div>
      </div>

      {/* Input Panel */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Input Data (comma-separated)</label>
        <input
          type="text"
          value={inputData}
          onChange={(e) => setInputData(e.target.value)}
          className="w-full px-3 py-2 border rounded"
          placeholder="1,2,3,4,5"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={processData}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Process Data'}
        </button>
        <button
          onClick={resetState}
          className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Reset
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded mb-6">
          <h3 className="text-red-800 font-semibold">Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="bg-green-50 border border-green-200 p-4 rounded">
          <h3 className="text-green-800 font-semibold mb-2">Processing Results</h3>
          <div className="space-y-2">
            <div>
              <strong>Values:</strong> [{result.values.join(', ')}]
            </div>
            <div>
              <strong>Timestamp:</strong> {new Date(result.timestamp * 1000).toLocaleString()}
            </div>
            <div>
              <strong>Metadata:</strong>
              <ul className="ml-4 mt-1">
                {Object.entries(result.metadata).map(([key, value]) => (
                  <li key={key}>
                    <code>{key}</code>: {value}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KTestApp;
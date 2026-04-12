import { useState } from 'react';
import { PreviewViewport, PreviewShape } from './ui/PreviewViewport';
import type { PBRMaps } from './types';

/**
 * KAutoPBR - Main application component for material sampling and PBR generation
 * 
 * This is a minimal implementation for Task 5.2 testing.
 * Full UI panels will be implemented in subsequent tasks.
 */
export function KAutoPBR() {
  const [shape, setShape] = useState<PreviewShape>('sphere');
  const [roughness, setRoughness] = useState(0.5);
  const [metallic, setMetallic] = useState(0.0);
  const [normalStrength, setNormalStrength] = useState(1.0);
  const [emissiveIntensity, setEmissiveIntensity] = useState(0.0);

  // Mock PBR maps for testing
  const mockMaps: PBRMaps = {
    // In real implementation, these would be loaded from the material system
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4">
        <h1 className="text-white font-semibold">KAutoPBR - Material Preview</h1>
      </div>

      <div className="flex-1 flex">
        {/* Left Panel - Controls */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="text-white text-sm font-medium block mb-2">
              Preview Shape
            </label>
            <select
              value={shape}
              onChange={(e) => setShape(e.target.value as PreviewShape)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
            >
              <option value="Sphere">Sphere</option>
              <option value="Cube">Cube</option>
              <option value="Cylinder">Cylinder</option>
              <option value="Plane">Plane</option>
              <option value="Torus">Torus</option>
            </select>
          </div>

          <div>
            <label className="text-white text-sm font-medium block mb-2">
              Roughness: {roughness.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={roughness}
              onChange={(e) => setRoughness(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-white text-sm font-medium block mb-2">
              Metallic: {metallic.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={metallic}
              onChange={(e) => setMetallic(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-white text-sm font-medium block mb-2">
              Normal Strength: {normalStrength.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={normalStrength}
              onChange={(e) => setNormalStrength(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-white text-sm font-medium block mb-2">
              Emissive Intensity: {emissiveIntensity.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={emissiveIntensity}
              onChange={(e) => setEmissiveIntensity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="pt-4 border-t border-gray-700">
            <p className="text-gray-400 text-xs">
              Task 5.2: PBR Material Rendering
              <br />
              Real-time parameter updates (&lt; 33ms)
            </p>
          </div>
        </div>

        {/* Center - Preview Viewport */}
        <div className="flex-1">
          <PreviewViewport
            shape={shape}
            lightingPreset="studio"
            materialProps={{
              roughnessValue: roughness,
              metallicValue: metallic,
              normalStrength,
              emissiveIntensity,
              emissiveColor: '#ffffff',
            }}
          />
        </div>
      </div>
    </div>
  );
}

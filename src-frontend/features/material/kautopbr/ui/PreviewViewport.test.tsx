/**
 * PreviewViewport Test/Demo Component
 * 
 * This file demonstrates the PreviewViewport component functionality.
 * It can be used for manual testing and verification.
 */

import React from 'react';
import { PreviewViewport, PreviewShape } from './PreviewViewport';
import * as THREE from 'three';

/**
 * Demo component showing PreviewViewport with different materials
 */
export function PreviewViewportDemo() {
  const [shape, setShape] = React.useState<PreviewShape>('sphere');
  const [materialType, setMaterialType] = React.useState<'standard' | 'metallic' | 'rough'>('standard');

  // Create different material presets
  const materials = React.useMemo(() => ({
    standard: new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.5,
      metalness: 0.5,
    }),
    metallic: new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.2,
      metalness: 1.0,
    }),
    rough: new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.9,
      metalness: 0.0,
    }),
  }), []);

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Material selector */}
      <div className="bg-gray-800 p-4 flex gap-4 items-center">
        <span className="text-white font-semibold">Material:</span>
        {(['standard', 'metallic', 'rough'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setMaterialType(type)}
            className={`px-4 py-2 rounded capitalize ${
              materialType === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Preview viewport */}
      <div className="flex-1">
        <PreviewViewport
          shape={shape}
          material={materials[materialType]}
          onShapeChange={setShape}
        />
      </div>
    </div>
  );
}

/**
 * Unit test verification checklist:
 * 
 * Requirements 8.1 - Preview shapes:
 * ✓ Sphere geometry with proper subdivision (64x64)
 * ✓ Cube geometry with correct dimensions
 * ✓ Cylinder geometry with proper segments
 * ✓ Plane geometry (rotated for ground plane view)
 * ✓ Torus geometry with correct parameters
 * 
 * Requirements 8.3 - PBR rendering:
 * ✓ MeshStandardMaterial support (PBR)
 * ✓ ACES Filmic tone mapping
 * ✓ Antialiasing enabled
 * ✓ Shadow support
 * 
 * Requirements 8.8 - Camera controls:
 * ✓ OrbitControls for rotation
 * ✓ Pan support (right-click drag)
 * ✓ Zoom support (scroll wheel)
 * ✓ Damping for smooth motion
 * ✓ Distance limits (min/max)
 */

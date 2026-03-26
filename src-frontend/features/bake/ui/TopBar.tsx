/**
 * TopBar - Main toolbar for KBake
 * 
 * Contains file operations, bake controls, and view options
 */

import React, { useState } from 'react';
import type { BakeEngine, MapType } from '../engine/bakeEngine';
import { ExportDialog } from './ExportDialog';
import { bakeExportClient, type ExportSettings } from '../../../services/bakeExportClient';

interface TopBarProps {
  engine: BakeEngine | null;
  onHighPolyVisibilityChange?: (visible: boolean) => void;
  onLowPolyVisibilityChange?: (visible: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ engine, onHighPolyVisibilityChange, onLowPolyVisibilityChange }) => {
  const [showHighPoly, setShowHighPoly] = useState(true);
  const [showLowPoly, setShowLowPoly] = useState(true);
  const [showCage, setShowCage] = useState(true);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [availableMaps, setAvailableMaps] = useState<MapType[]>([]);

  const handleLoadHighPoly = async () => {
    if (!engine) return;

    try {
      // Create file input element
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.obj,.gltf,.glb,.fbx';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        console.log('[TopBar] Loading high-poly mesh:', file.name);
        
        // TODO: Parse mesh file and convert to BakeMesh format
        // For now, create a simple test mesh
        const testMesh = createTestMesh();
        await engine.loadHighPolyMesh(testMesh);
        
        console.log('[TopBar] High-poly mesh loaded successfully');
      };

      input.click();
    } catch (error) {
      console.error('[TopBar] Failed to load high-poly mesh:', error);
      alert(`Failed to load high-poly mesh: ${error}`);
    }
  };

  const handleLoadLowPoly = async () => {
    if (!engine) return;

    try {
      // Create file input element
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.obj,.gltf,.glb,.fbx';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        console.log('[TopBar] Loading low-poly mesh:', file.name);
        
        // TODO: Parse mesh file and convert to BakeMesh format
        // For now, create a simple test mesh
        const testMesh = createTestMesh(0.8);
        await engine.loadLowPolyMesh(testMesh);
        
        console.log('[TopBar] Low-poly mesh loaded successfully');
      };

      input.click();
    } catch (error) {
      console.error('[TopBar] Failed to load low-poly mesh:', error);
      alert(`Failed to load low-poly mesh: ${error}`);
    }
  };

  // Helper function to create a test mesh (cube)
  const createTestMesh = (scale: number = 1.0) => {
    const s = scale;
    const positions = new Float32Array([
      // Front face
      -s, -s, s,  s, -s, s,  s, s, s,  -s, s, s,
      // Back face
      -s, -s, -s,  -s, s, -s,  s, s, -s,  s, -s, -s,
      // Top face
      -s, s, -s,  -s, s, s,  s, s, s,  s, s, -s,
      // Bottom face
      -s, -s, -s,  s, -s, -s,  s, -s, s,  -s, -s, s,
      // Right face
      s, -s, -s,  s, s, -s,  s, s, s,  s, -s, s,
      // Left face
      -s, -s, -s,  -s, -s, s,  -s, s, s,  -s, s, -s
    ]);

    const normals = new Float32Array([
      // Front
      0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
      // Back
      0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
      // Top
      0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
      // Bottom
      0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,
      // Right
      1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
      // Left
      -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0
    ]);

    const tangents = new Float32Array([
      // Front
      1, 0, 0, 1,  1, 0, 0, 1,  1, 0, 0, 1,  1, 0, 0, 1,
      // Back
      -1, 0, 0, 1,  -1, 0, 0, 1,  -1, 0, 0, 1,  -1, 0, 0, 1,
      // Top
      1, 0, 0, 1,  1, 0, 0, 1,  1, 0, 0, 1,  1, 0, 0, 1,
      // Bottom
      1, 0, 0, 1,  1, 0, 0, 1,  1, 0, 0, 1,  1, 0, 0, 1,
      // Right
      0, 0, -1, 1,  0, 0, -1, 1,  0, 0, -1, 1,  0, 0, -1, 1,
      // Left
      0, 0, 1, 1,  0, 0, 1, 1,  0, 0, 1, 1,  0, 0, 1, 1
    ]);

    const uvs = new Float32Array([
      // Front
      0, 0,  1, 0,  1, 1,  0, 1,
      // Back
      0, 0,  1, 0,  1, 1,  0, 1,
      // Top
      0, 0,  1, 0,  1, 1,  0, 1,
      // Bottom
      0, 0,  1, 0,  1, 1,  0, 1,
      // Right
      0, 0,  1, 0,  1, 1,  0, 1,
      // Left
      0, 0,  1, 0,  1, 1,  0, 1
    ]);

    const indices = new Uint32Array([
      0, 1, 2,  0, 2, 3,    // Front
      4, 5, 6,  4, 6, 7,    // Back
      8, 9, 10,  8, 10, 11, // Top
      12, 13, 14,  12, 14, 15, // Bottom
      16, 17, 18,  16, 18, 19, // Right
      20, 21, 22,  20, 22, 23  // Left
    ]);

    return { positions, normals, tangents, uvs, indices };
  };

  const handleGenerateCage = async () => {
    if (!engine) return;
    
    try {
      await engine.generateCage();
      console.log('[TopBar] Cage generated successfully');
    } catch (error) {
      console.error('[TopBar] Failed to generate cage:', error);
      alert(`Failed to generate cage: ${error}`);
    }
  };

  const handleBake = async () => {
    // TODO: Implement baking
    console.log('[TopBar] Start baking');
  };

  const handleExport = async () => {
    if (!engine) return;

    // Get all available baked maps
    const maps: MapType[] = [];
    const mapTypes: MapType[] = ['normal', 'ao', 'curvature', 'thickness', 'position', 'id'];
    
    for (const mapType of mapTypes) {
      if (engine.getBakedMap(mapType)) {
        maps.push(mapType);
      }
    }

    if (maps.length === 0) {
      alert('No baked maps available to export. Please bake some maps first.');
      return;
    }

    setAvailableMaps(maps);
    setShowExportDialog(true);
  };

  const handleExportConfirm = async (mapTypes: MapType[], settings: ExportSettings) => {
    if (!engine) return;

    try {
      if (mapTypes.length === 1) {
        // Single map export
        const mapType = mapTypes[0];
        const bakedMap = engine.getBakedMap(mapType);
        if (!bakedMap) {
          throw new Error(`Map ${mapType} not found`);
        }

        const defaultName = `baked_${mapType}.${settings.format}`;
        const path = await bakeExportClient.exportMapWithDialog(
          defaultName,
          bakedMap.texture.image.width,
          bakedMap.texture.image.height,
          bakedMap.data,
          settings
        );

        if (path) {
          console.log(`[TopBar] Exported ${mapType} map to: ${path}`);
          alert(`Successfully exported ${mapType} map!`);
        }
      } else {
        // Batch export
        const maps = mapTypes.map(mapType => {
          const bakedMap = engine.getBakedMap(mapType);
          if (!bakedMap) {
            throw new Error(`Map ${mapType} not found`);
          }
          return {
            mapType,
            width: bakedMap.texture.image.width,
            height: bakedMap.texture.image.height,
            data: bakedMap.data,
          };
        });

        const defaultName = `baked_maps.${settings.format}`;
        const paths = await bakeExportClient.exportMapsBatchWithDialog(
          defaultName,
          maps,
          settings
        );

        if (paths) {
          console.log(`[TopBar] Batch exported ${paths.length} maps`);
          alert(`Successfully exported ${paths.length} maps!`);
        }
      }
    } catch (error) {
      console.error('[TopBar] Export failed:', error);
      throw error;
    }
  };

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: '#1a1a1a',
        borderBottom: '1px solid #333'
      }}>
        {/* File operations */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={handleLoadHighPoly}
            style={{
              padding: '6px 12px',
              background: '#4488ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Load High-Poly
          </button>

          <button
            onClick={handleLoadLowPoly}
            style={{
              padding: '6px 12px',
              background: '#88ff44',
              color: 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Load Low-Poly
          </button>
        </div>

        <div style={{ width: '1px', height: '24px', background: '#333' }} />

        {/* Cage operations */}
        <button
          onClick={handleGenerateCage}
          disabled={!engine}
          style={{
            padding: '6px 12px',
            background: '#ff8844',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: engine ? 'pointer' : 'not-allowed',
            opacity: engine ? 1 : 0.5,
            fontSize: '13px'
          }}
        >
          Generate Cage
        </button>

        <div style={{ width: '1px', height: '24px', background: '#333' }} />

        {/* Bake operations */}
        <button
          onClick={handleBake}
          disabled={!engine}
          style={{
            padding: '6px 12px',
            background: '#44ff88',
            color: 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: engine ? 'pointer' : 'not-allowed',
            opacity: engine ? 1 : 0.5,
            fontSize: '13px',
            fontWeight: 'bold'
          }}
        >
          Bake
        </button>

        <button
          onClick={handleExport}
          disabled={!engine}
          style={{
            padding: '6px 12px',
            background: '#333',
            color: 'white',
            border: '1px solid #555',
            borderRadius: '4px',
            cursor: engine ? 'pointer' : 'not-allowed',
            opacity: engine ? 1 : 0.5,
            fontSize: '13px'
          }}
        >
          Export Maps
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* View options */}
        <div style={{ 
          display: 'flex', 
          gap: '8px',
          color: '#aaa',
          fontSize: '12px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={showHighPoly}
              onChange={(e) => {
                setShowHighPoly(e.target.checked);
                onHighPolyVisibilityChange?.(e.target.checked);
              }}
            />
            Show High-Poly
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={showLowPoly}
              onChange={(e) => {
                setShowLowPoly(e.target.checked);
                onLowPolyVisibilityChange?.(e.target.checked);
              }}
            />
            Show Low-Poly
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input 
              type="checkbox"
              checked={showCage}
              onChange={(e) => {
                setShowCage(e.target.checked);
                engine?.setCageVisible(e.target.checked);
              }}
            />
            Show Cage
          </label>
        </div>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        availableMaps={availableMaps}
        onExport={handleExportConfirm}
      />
    </>
  );
};

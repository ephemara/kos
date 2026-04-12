/**
 * LeftPanel - Map type selector for KBake
 * 
 * Allows users to select which map types to bake
 */

import React, { useState } from 'react';
import type { BakeEngine, MapType } from '../engine/bakeEngine';
import { CageEditPanel } from './CageEditPanel';

interface LeftPanelProps {
  engine: BakeEngine | null;
  onBakeStart?: () => void;
  onBakeComplete?: () => void;
  onBakeProgress?: (mapType: MapType, current: number, total: number) => void;
  selectedMaps: Set<MapType>;
  onSelectedMapsChange: (maps: Set<MapType>) => void;
}

interface MapTypeConfig {
  type: MapType;
  label: string;
  description: string;
  requiresHighPoly: boolean;
  color: string;
}

const MAP_TYPES: MapTypeConfig[] = [
  {
    type: 'normal',
    label: 'Normal Map',
    description: 'Transfer surface normals from high-poly to low-poly',
    requiresHighPoly: true,
    color: '#8888ff'
  },
  {
    type: 'ao',
    label: 'Ambient Occlusion',
    description: 'Compute surface occlusion',
    requiresHighPoly: false,
    color: '#888888'
  },
  {
    type: 'curvature',
    label: 'Curvature',
    description: 'Measure surface curvature',
    requiresHighPoly: false,
    color: '#ff8888'
  },
  {
    type: 'thickness',
    label: 'Thickness',
    description: 'Measure mesh thickness',
    requiresHighPoly: false,
    color: '#88ff88'
  },
  {
    type: 'position',
    label: 'Position',
    description: 'Store world-space position',
    requiresHighPoly: false,
    color: '#ffff88'
  },
  {
    type: 'id',
    label: 'Material ID',
    description: 'Encode material IDs as colors',
    requiresHighPoly: false,
    color: '#ff88ff'
  }
];

export const LeftPanel: React.FC<LeftPanelProps> = ({ 
  engine, 
  onBakeStart, 
  onBakeComplete,
  onBakeProgress,
  selectedMaps,
  onSelectedMapsChange
}) => {
  const [isBaking, setIsBaking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const toggleMap = (type: MapType) => {
    const newSelected = new Set(selectedMaps);
    if (newSelected.has(type)) {
      newSelected.delete(type);
    } else {
      newSelected.add(type);
    }
    onSelectedMapsChange(newSelected);
  };

  const handleBakeBatch = async () => {
    if (!engine || isBaking || selectedMaps.size === 0) return;

    setIsBaking(true);
    onBakeStart?.();

    try {
      const mapTypes = Array.from(selectedMaps);
      console.log(`[LeftPanel] Starting batch bake of ${mapTypes.length} maps...`);

      await engine.bakeBatch(mapTypes, (mapType, current, total) => {
        setProgress({ current, total });
        onBakeProgress?.(mapType, current, total);
      });

      console.log('[LeftPanel] Batch bake complete!');
      onBakeComplete?.();
    } catch (error) {
      console.error('[LeftPanel] Batch bake failed:', error);
      alert(`Batch bake failed: ${error}`);
    } finally {
      setIsBaking(false);
      setProgress(null);
    }
  };

  return (
    <div style={{
      width: '280px',
      background: '#1a1a1a',
      borderRight: '1px solid #333',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #333'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#fff'
        }}>
          Map Types
        </h3>
        <p style={{
          margin: '4px 0 0 0',
          fontSize: '12px',
          color: '#888'
        }}>
          Select maps to bake
        </p>
      </div>

      {/* Map type list */}
      <div style={{ flex: 1, padding: '8px' }}>
        {MAP_TYPES.map(mapType => {
          const isSelected = selectedMaps.has(mapType.type);

          return (
            <div
              key={mapType.type}
              onClick={() => toggleMap(mapType.type)}
              style={{
                padding: '12px',
                marginBottom: '8px',
                background: isSelected ? '#2a2a2a' : '#1a1a1a',
                border: `2px solid ${isSelected ? mapType.color : '#333'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '3px',
                  background: mapType.color,
                  flexShrink: 0
                }} />
                <span style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#fff'
                }}>
                  {mapType.label}
                </span>
                {mapType.requiresHighPoly && (
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    background: '#4488ff',
                    color: 'white',
                    borderRadius: '3px',
                    marginLeft: 'auto'
                  }}>
                    High-Poly
                  </span>
                )}
              </div>
              <p style={{
                margin: 0,
                fontSize: '11px',
                color: '#888',
                lineHeight: '1.4'
              }}>
                {mapType.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #333',
        background: '#1a1a1a'
      }}>
        {/* Progress */}
        {progress && (
          <div style={{
            marginBottom: '12px',
            padding: '8px',
            background: '#2a2a2a',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#4488ff'
          }}>
            Baking {progress.current} / {progress.total}...
          </div>
        )}

        {/* Bake Button */}
        <button
          onClick={handleBakeBatch}
          disabled={!engine || isBaking || selectedMaps.size === 0}
          style={{
            width: '100%',
            padding: '12px',
            background: isBaking ? '#666' : '#4488ff',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: (!engine || isBaking || selectedMaps.size === 0) ? 'not-allowed' : 'pointer',
            opacity: (!engine || selectedMaps.size === 0) ? 0.5 : 1,
            marginBottom: '12px',
            transition: 'all 0.2s'
          }}
        >
          {isBaking ? 'Baking...' : `Bake ${selectedMaps.size} Map${selectedMaps.size !== 1 ? 's' : ''}`}
        </button>

        <div style={{
          fontSize: '12px',
          color: '#888'
        }}>
          <div style={{ marginBottom: '8px' }}>
            Selected: {selectedMaps.size} / {MAP_TYPES.length}
          </div>
          <button
            onClick={() => onSelectedMapsChange(new Set(MAP_TYPES.map(m => m.type)))}
            disabled={isBaking}
            style={{
              padding: '4px 8px',
              background: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: isBaking ? 'not-allowed' : 'pointer',
              fontSize: '11px',
              marginRight: '4px',
              opacity: isBaking ? 0.5 : 1
            }}
          >
            Select All
          </button>
          <button
            onClick={() => onSelectedMapsChange(new Set())}
            disabled={isBaking}
            style={{
              padding: '4px 8px',
              background: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: isBaking ? 'not-allowed' : 'pointer',
              fontSize: '11px',
              opacity: isBaking ? 0.5 : 1
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Cage Editing Panel */}
      <CageEditPanel engine={engine} />
    </div>
  );
};

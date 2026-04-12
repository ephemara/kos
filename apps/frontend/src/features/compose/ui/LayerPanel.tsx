/**
 * LayerPanel - Layer stack management
 * 
 * Provides layer-based workflow with blend modes, opacity controls,
 * visibility toggles, and layer reordering.
 */

import React, { useState, useEffect } from 'react';
import { ComposeEngine } from '../engine/composeEngine';
import type { Layer, LayerId } from '../engine/layerSystem';

interface LayerPanelProps {
  engine: ComposeEngine | null;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({ engine }) => {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Update layers from engine
  useEffect(() => {
    if (!engine) return;

    const updateLayers = () => {
      const engineLayers = engine.getLayers();
      setLayers(engineLayers);
    };

    updateLayers();

    // Poll for updates
    const interval = setInterval(updateLayers, 500);
    return () => clearInterval(interval);
  }, [engine]);

  const handleAddLayer = () => {
    if (!engine) return;
    const layerId = engine.addLayer(`Layer ${layers.length + 1}`);
    setSelectedLayerId(layerId);
  };

  const handleRemoveLayer = (layerId: string) => {
    if (!engine) return;
    engine.removeLayer(layerId);
    if (selectedLayerId === layerId) {
      setSelectedLayerId(null);
    }
  };

  const handleDuplicateLayer = (layerId: string) => {
    if (!engine) return;
    const newLayerId = engine.duplicateLayer(layerId);
    if (newLayerId) {
      setSelectedLayerId(newLayerId);
    }
  };

  const handleToggleVisibility = (layerId: string) => {
    if (!engine) return;
    engine.toggleLayerVisibility(layerId);
  };

  const handleMoveLayerUp = (layerId: string) => {
    if (!engine) return;
    engine.moveLayerUp(layerId);
  };

  const handleMoveLayerDown = (layerId: string) => {
    if (!engine) return;
    engine.moveLayerDown(layerId);
  };

  const handleBlendModeChange = (layerId: string, blendMode: string) => {
    if (!engine) return;
    engine.setLayerBlendMode(layerId, blendMode as any);
  };

  const handleOpacityChange = (layerId: string, opacity: number) => {
    if (!engine) return;
    engine.setLayerOpacity(layerId, opacity);
  };

  const handleComposite = () => {
    if (!engine) return;
    engine.compositeLayers();
    console.log('[LayerPanel] Composited all layers');
  };

  return (
    <div style={{
      width: '280px',
      background: '#2a2a2a',
      borderRight: '1px solid #444',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid #444',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
          Layers
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            style={{
              padding: '4px 8px',
              background: '#4a7c59',
              border: 'none',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
            }}
            onClick={handleAddLayer}
            title="Add new layer"
          >
            + Add
          </button>
          <button
            style={{
              padding: '4px 8px',
              background: '#3a3a3a',
              border: '1px solid #555',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '11px',
            }}
            onClick={handleComposite}
            title="Composite all layers"
          >
            ⚡ Composite
          </button>
        </div>
      </div>

      {/* Layer List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px',
      }}>
        {layers.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: '#666',
            fontSize: '12px',
          }}>
            <div style={{ marginBottom: '8px' }}>No layers yet</div>
            <div style={{ fontSize: '11px', color: '#555' }}>
              Click "+ Add" to create a layer
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '6px' }}>
            {layers.map((layer, index) => (
              <div
                key={layer.id}
                style={{
                  padding: '10px',
                  background: selectedLayerId === layer.id ? '#3a3a3a' : '#2a2a2a',
                  border: selectedLayerId === layer.id ? '2px solid #4a7c59' : '1px solid #444',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => setSelectedLayerId(layer.id)}
              >
                {/* Layer Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Visibility Toggle */}
                    <button
                      style={{
                        padding: '2px 6px',
                        background: 'transparent',
                        border: '1px solid #555',
                        borderRadius: '3px',
                        color: layer.visible ? '#4a7c59' : '#666',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleVisibility(layer.id);
                      }}
                      title={layer.visible ? 'Hide layer' : 'Show layer'}
                    >
                      {layer.visible ? '👁' : '👁‍🗨'}
                    </button>

                    {/* Layer Name */}
                    <span style={{
                      fontSize: '12px',
                      color: '#fff',
                      fontWeight: 500,
                    }}>
                      {layer.name}
                    </span>
                  </div>

                  {/* Layer Actions */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      style={{
                        padding: '2px 6px',
                        background: '#3a3a3a',
                        border: '1px solid #555',
                        borderRadius: '2px',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '10px',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateLayer(layer.id);
                      }}
                      title="Duplicate layer"
                    >
                      ⎘
                    </button>
                    <button
                      style={{
                        padding: '2px 6px',
                        background: '#555',
                        border: 'none',
                        borderRadius: '2px',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '10px',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveLayer(layer.id);
                      }}
                      title="Delete layer"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Layer Order Controls */}
                <div style={{
                  display: 'flex',
                  gap: '4px',
                  marginBottom: '8px',
                }}>
                  <button
                    style={{
                      flex: 1,
                      padding: '4px',
                      background: '#1a1a1a',
                      border: '1px solid #555',
                      borderRadius: '3px',
                      color: '#ccc',
                      cursor: index < layers.length - 1 ? 'pointer' : 'not-allowed',
                      fontSize: '10px',
                      opacity: index < layers.length - 1 ? 1 : 0.5,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveLayerUp(layer.id);
                    }}
                    disabled={index >= layers.length - 1}
                    title="Move layer up"
                  >
                    ▲
                  </button>
                  <button
                    style={{
                      flex: 1,
                      padding: '4px',
                      background: '#1a1a1a',
                      border: '1px solid #555',
                      borderRadius: '3px',
                      color: '#ccc',
                      cursor: index > 0 ? 'pointer' : 'not-allowed',
                      fontSize: '10px',
                      opacity: index > 0 ? 1 : 0.5,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveLayerDown(layer.id);
                    }}
                    disabled={index <= 0}
                    title="Move layer down"
                  >
                    ▼
                  </button>
                </div>

                {/* Blend Mode */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{
                    fontSize: '10px',
                    color: '#999',
                    display: 'block',
                    marginBottom: '4px',
                    fontWeight: 500,
                  }}>
                    Blend Mode
                  </label>
                  <select
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      background: '#1a1a1a',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                    value={layer.blendMode}
                    onChange={(e) => handleBlendModeChange(layer.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="normal">Normal</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                    <option value="overlay">Overlay</option>
                    <option value="add">Add</option>
                    <option value="subtract">Subtract</option>
                    <option value="divide">Divide</option>
                    <option value="difference">Difference</option>
                    <option value="darken">Darken</option>
                    <option value="lighten">Lighten</option>
                    <option value="colorDodge">Color Dodge</option>
                    <option value="colorBurn">Color Burn</option>
                    <option value="hardLight">Hard Light</option>
                    <option value="softLight">Soft Light</option>
                    <option value="exclusion">Exclusion</option>
                  </select>
                </div>

                {/* Opacity */}
                <div>
                  <label style={{
                    fontSize: '10px',
                    color: '#999',
                    display: 'block',
                    marginBottom: '4px',
                    fontWeight: 500,
                  }}>
                    Opacity: {Math.round(layer.opacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={layer.opacity * 100}
                    style={{
                      width: '100%',
                      cursor: 'pointer',
                    }}
                    onChange={(e) => handleOpacityChange(layer.id, parseInt(e.target.value) / 100)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid #444',
        fontSize: '11px',
        color: '#666',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>{layers.length} layer{layers.length !== 1 ? 's' : ''}</span>
        <span>{layers.filter(l => l.visible).length} visible</span>
      </div>
    </div>
  );
};

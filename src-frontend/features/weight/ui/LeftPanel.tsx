/**
 * LeftPanel - Brush settings and weight operations
 * 
 * Controls for brush parameters, weight smoothing, normalization, and visualization.
 */

import React from 'react';
import { WeightPaintSettings } from '../engine/weightEngine';
import { VisualizationMode } from '../engine/visualization';

interface LeftPanelProps {
  paintSettings: WeightPaintSettings;
  onPaintSettingsChange: (settings: Partial<WeightPaintSettings>) => void;
  onSmoothWeights: (iterations: number) => void;
  onNormalizeWeights: () => void;
  visualizationMode: VisualizationMode;
  onVisualizationModeChange: (mode: VisualizationMode) => void;
}

const LeftPanel: React.FC<LeftPanelProps> = ({
  paintSettings,
  onPaintSettingsChange,
  onSmoothWeights,
  onNormalizeWeights,
  visualizationMode,
  onVisualizationModeChange,
}) => {
  return (
    <div style={{
      width: '320px',
      background: '#2a2a2a',
      borderRight: '1px solid #444',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Brush Settings */}
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '6px',
          padding: '12px',
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#fff',
            marginBottom: '12px',
          }}>
            Brush Settings
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Strength */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '11px', color: '#ccc', fontWeight: 500 }}>
                  Strength
                </label>
                <span style={{ fontSize: '11px', color: '#999' }}>
                  {(paintSettings.strength * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={paintSettings.strength * 100}
                onChange={(e) => onPaintSettingsChange({ strength: parseInt(e.target.value) / 100 })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            {/* Radius */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '11px', color: '#ccc', fontWeight: 500 }}>
                  Radius
                </label>
                <span style={{ fontSize: '11px', color: '#999' }}>
                  {paintSettings.radius.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={paintSettings.radius * 100}
                onChange={(e) => onPaintSettingsChange({ radius: parseInt(e.target.value) / 100 })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            {/* Falloff */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: '#ccc', fontWeight: 500 }}>
                Falloff
              </label>
              <select
                value={paintSettings.falloff}
                onChange={(e) => onPaintSettingsChange({ falloff: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  background: '#2a2a2a',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="constant">Constant</option>
                <option value="linear">Linear</option>
                <option value="smooth">Smooth</option>
                <option value="sharp">Sharp</option>
              </select>
            </div>

            {/* Paint Mode */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: '#ccc', fontWeight: 500 }}>
                Mode
              </label>
              <select
                value={paintSettings.mode}
                onChange={(e) => onPaintSettingsChange({ mode: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  background: '#2a2a2a',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="add">Add</option>
                <option value="subtract">Subtract</option>
                <option value="mix">Mix</option>
                <option value="blur">Blur</option>
              </select>
            </div>

            <div style={{ height: '1px', background: '#444' }} />

            {/* Auto Normalize */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '11px', color: '#ccc', fontWeight: 500 }}>
                Auto Normalize
              </label>
              <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                <input
                  type="checkbox"
                  checked={paintSettings.autoNormalize}
                  onChange={(e) => onPaintSettingsChange({ autoNormalize: e.target.checked })}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: paintSettings.autoNormalize ? '#4a7c59' : '#555',
                  transition: '0.3s',
                  borderRadius: '24px',
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: paintSettings.autoNormalize ? '23px' : '3px',
                    bottom: '3px',
                    background: 'white',
                    transition: '0.3s',
                    borderRadius: '50%',
                  }} />
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Symmetry */}
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '6px',
          padding: '12px',
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#fff',
            marginBottom: '12px',
          }}>
            Symmetry
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '11px', color: '#ccc', fontWeight: 500 }}>
                Enable Symmetry
              </label>
              <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                <input
                  type="checkbox"
                  checked={paintSettings.symmetry.enabled}
                  onChange={(e) =>
                    onPaintSettingsChange({
                      symmetry: { ...paintSettings.symmetry, enabled: e.target.checked },
                    })
                  }
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: paintSettings.symmetry.enabled ? '#4a7c59' : '#555',
                  transition: '0.3s',
                  borderRadius: '24px',
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: paintSettings.symmetry.enabled ? '23px' : '3px',
                    bottom: '3px',
                    background: 'white',
                    transition: '0.3s',
                    borderRadius: '50%',
                  }} />
                </span>
              </label>
            </div>

            {paintSettings.symmetry.enabled && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: '#ccc', fontWeight: 500 }}>
                    Axis
                  </label>
                  <select
                    value={paintSettings.symmetry.axis}
                    onChange={(e) =>
                      onPaintSettingsChange({
                        symmetry: { ...paintSettings.symmetry, axis: e.target.value as any },
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: '#2a2a2a',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="x">X</option>
                    <option value="y">Y</option>
                    <option value="z">Z</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '11px', color: '#ccc', fontWeight: 500 }}>
                      Threshold
                    </label>
                    <span style={{ fontSize: '11px', color: '#999' }}>
                      {paintSettings.symmetry.threshold.toFixed(4)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={paintSettings.symmetry.threshold * 10000}
                    onChange={(e) =>
                      onPaintSettingsChange({
                        symmetry: { ...paintSettings.symmetry, threshold: parseInt(e.target.value) / 10000 },
                      })
                    }
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Weight Operations */}
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '6px',
          padding: '12px',
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#fff',
            marginBottom: '12px',
          }}>
            Weight Operations
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => onSmoothWeights(1)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#3a3a3a',
                border: '1px solid #555',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#4a4a4a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#3a3a3a';
              }}
            >
              Smooth Weights (1x)
            </button>

            <button
              onClick={() => onSmoothWeights(3)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#3a3a3a',
                border: '1px solid #555',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#4a4a4a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#3a3a3a';
              }}
            >
              Smooth Weights (3x)
            </button>

            <button
              onClick={onNormalizeWeights}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#3a3a3a',
                border: '1px solid #555',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#4a4a4a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#3a3a3a';
              }}
            >
              Normalize All Weights
            </button>
          </div>
        </div>

        {/* Visualization */}
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '6px',
          padding: '12px',
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#fff',
            marginBottom: '12px',
          }}>
            Visualization
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: '#ccc', fontWeight: 500 }}>
                Display Mode
              </label>
              <select
                value={visualizationMode}
                onChange={(e) => onVisualizationModeChange(e.target.value as VisualizationMode)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  background: '#2a2a2a',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="gradient">Gradient</option>
                <option value="solid">Solid</option>
                <option value="wireframe">Wireframe</option>
                <option value="none">None</option>
              </select>
            </div>

            <div style={{
              padding: '8px',
              background: '#0a0a0a',
              borderRadius: '4px',
            }}>
              <div style={{
                fontSize: '10px',
                color: '#999',
                marginBottom: '8px',
              }}>
                Gradient Preview
              </div>
              <div style={{
                height: '24px',
                borderRadius: '4px',
                background: 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)',
              }} />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: '#666',
                marginTop: '4px',
              }}>
                <span>0.0</span>
                <span>0.5</span>
                <span>1.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeftPanel;

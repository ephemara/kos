/**
 * RightPanel - Settings and preview for KBake
 * 
 * Contains bake settings, cage settings, and baked map preview
 */

import React, { useState, useEffect } from 'react';
import type { BakeEngine, BakeSettings, MapType } from '../engine/bakeEngine';

interface RightPanelProps {
  engine: BakeEngine | null;
  onBakeStart?: () => void;
  onBakeComplete?: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({ engine, onBakeStart, onBakeComplete }) => {
  const [settings, setSettings] = useState<BakeSettings>({
    resolution: 2048,
    samples: 16,
    maxDistance: 1.0,
    cageExtrusion: null,
    normalSpace: 'tangent',
    dilationIterations: 8,
    enableAntialiasing: true
  });

  const [previewMap, setPreviewMap] = useState<MapType | null>(null);
  const [bakedMaps, setBakedMaps] = useState<Set<MapType>>(new Set());
  const [isBaking, setIsBaking] = useState(false);
  const [cageValidation, setCageValidation] = useState<{ valid: boolean; issues: string[] } | null>(null);

  // Update engine settings when they change
  useEffect(() => {
    engine?.setSettings(settings);
  }, [settings, engine]);

  // Check for baked maps
  useEffect(() => {
    if (!engine) return;

    const interval = setInterval(() => {
      const maps = new Set<MapType>();
      const mapTypes: MapType[] = ['normal', 'ao', 'curvature', 'thickness', 'position', 'id'];
      
      for (const type of mapTypes) {
        if (engine.getBakedMap(type)) {
          maps.add(type);
        }
      }
      
      setBakedMaps(maps);
      setIsBaking(engine.isBakingInProgress());
    }, 100);

    return () => clearInterval(interval);
  }, [engine]);

  const updateSetting = <K extends keyof BakeSettings>(
    key: K,
    value: BakeSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleGenerateCage = async () => {
    if (!engine) return;
    
    try {
      await engine.generateCage(settings.cageExtrusion ?? undefined);
      console.log('[RightPanel] Cage generated successfully');
      
      // Validate the generated cage
      await handleValidateCage();
    } catch (error) {
      console.error('[RightPanel] Failed to generate cage:', error);
      setCageValidation({ valid: false, issues: [`Generation failed: ${error}`] });
    }
  };

  const handleValidateCage = async () => {
    if (!engine) return;
    
    try {
      const validation = await engine.validateCage();
      setCageValidation(validation);
      console.log('[RightPanel] Cage validation:', validation);
    } catch (error) {
      console.error('[RightPanel] Failed to validate cage:', error);
      setCageValidation({ valid: false, issues: [`Validation failed: ${error}`] });
    }
  };

  const handleCalculateRecommendedExtrusion = async () => {
    if (!engine) return;
    
    try {
      const recommended = await engine.calculateRecommendedExtrusion();
      updateSetting('cageExtrusion', recommended);
      console.log('[RightPanel] Recommended extrusion:', recommended);
    } catch (error) {
      console.error('[RightPanel] Failed to calculate recommended extrusion:', error);
    }
  };

  const handlePreviewMap = (mapType: MapType) => {
    if (!engine) return;
    
    if (previewMap === mapType) {
      // Toggle off
      engine.clearPreview();
      setPreviewMap(null);
    } else {
      // Preview new map
      engine.previewBakedMap(mapType);
      setPreviewMap(mapType);
    }
  };

  const handleClearMaps = () => {
    if (!engine) return;
    engine.clearBakedMaps();
    engine.clearPreview();
    setPreviewMap(null);
    setBakedMaps(new Set());
  };

  return (
    <div style={{
      width: '320px',
      background: '#1a1a1a',
      borderLeft: '1px solid #333',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto'
    }}>
      {/* Bake Settings */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #333'
      }}>
        <h3 style={{
          margin: '0 0 12px 0',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#fff'
        }}>
          Bake Settings
        </h3>

        {/* Resolution */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            color: '#aaa',
            marginBottom: '4px'
          }}>
            Resolution
          </label>
          <select
            value={settings.resolution}
            onChange={(e) => updateSetting('resolution', Number(e.target.value))}
            style={{
              width: '100%',
              padding: '6px',
              background: '#2a2a2a',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            <option value={512}>512 x 512</option>
            <option value={1024}>1024 x 1024</option>
            <option value={2048}>2048 x 2048</option>
            <option value={4096}>4096 x 4096</option>
            <option value={8192}>8192 x 8192</option>
          </select>
        </div>

        {/* Samples */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            color: '#aaa',
            marginBottom: '4px'
          }}>
            Samples: {settings.samples}
          </label>
          <input
            type="range"
            min={1}
            max={64}
            value={settings.samples}
            onChange={(e) => updateSetting('samples', Number(e.target.value))}
            style={{
              width: '100%'
            }}
          />
        </div>

        {/* Max Distance */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            color: '#aaa',
            marginBottom: '4px'
          }}>
            Max Distance: {settings.maxDistance.toFixed(2)}
          </label>
          <input
            type="range"
            min={0.1}
            max={10}
            step={0.1}
            value={settings.maxDistance}
            onChange={(e) => updateSetting('maxDistance', Number(e.target.value))}
            style={{
              width: '100%'
            }}
          />
        </div>

        {/* Normal Space */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            color: '#aaa',
            marginBottom: '4px'
          }}>
            Normal Space
          </label>
          <select
            value={settings.normalSpace}
            onChange={(e) => updateSetting('normalSpace', e.target.value as any)}
            style={{
              width: '100%',
              padding: '6px',
              background: '#2a2a2a',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            <option value="tangent">Tangent Space</option>
            <option value="object">Object Space</option>
            <option value="world">World Space</option>
          </select>
        </div>

        {/* Dilation */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            color: '#aaa',
            marginBottom: '4px'
          }}>
            Dilation Iterations: {settings.dilationIterations}
          </label>
          <input
            type="range"
            min={0}
            max={32}
            value={settings.dilationIterations}
            onChange={(e) => updateSetting('dilationIterations', Number(e.target.value))}
            style={{
              width: '100%'
            }}
          />
        </div>

        {/* Anti-aliasing */}
        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: '#aaa',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={settings.enableAntialiasing}
              onChange={(e) => updateSetting('enableAntialiasing', e.target.checked)}
            />
            Enable Anti-aliasing
          </label>
        </div>
      </div>

      {/* Cage Settings */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #333'
      }}>
        <h3 style={{
          margin: '0 0 12px 0',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#fff'
        }}>
          Cage Settings
        </h3>

        {/* Enable Cage */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: '#aaa',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={settings.cageExtrusion !== null}
              onChange={(e) => updateSetting('cageExtrusion', e.target.checked ? 0.5 : null)}
            />
            Use Cage Mesh
          </label>
        </div>

        {/* Cage Extrusion */}
        {settings.cageExtrusion !== null && (
          <>
            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: '#aaa',
                marginBottom: '4px'
              }}>
                Extrusion: {settings.cageExtrusion.toFixed(2)}
              </label>
              <input
                type="range"
                min={0.1}
                max={5}
                step={0.1}
                value={settings.cageExtrusion}
                onChange={(e) => updateSetting('cageExtrusion', Number(e.target.value))}
                style={{
                  width: '100%'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                onClick={handleGenerateCage}
                disabled={!engine}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: '#4488ff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: engine ? 'pointer' : 'not-allowed',
                  opacity: engine ? 1 : 0.5
                }}
              >
                Generate Cage
              </button>

              <button
                onClick={handleCalculateRecommendedExtrusion}
                disabled={!engine}
                style={{
                  padding: '8px 12px',
                  background: '#2a2a2a',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: engine ? 'pointer' : 'not-allowed',
                  opacity: engine ? 1 : 0.5
                }}
                title="Calculate recommended extrusion distance"
              >
                Auto
              </button>
            </div>

            {/* Cage Validation Feedback */}
            {cageValidation && (
              <div style={{
                padding: '8px',
                background: cageValidation.valid ? '#2a4a2a' : '#4a2a2a',
                border: `1px solid ${cageValidation.valid ? '#44aa44' : '#aa4444'}`,
                borderRadius: '4px',
                marginBottom: '12px'
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: cageValidation.valid ? '#88ff88' : '#ff8888',
                  marginBottom: cageValidation.issues.length > 0 ? '4px' : 0
                }}>
                  {cageValidation.valid ? '✓ Cage Valid' : '✗ Cage Invalid'}
                </div>
                {cageValidation.issues.length > 0 && (
                  <div style={{
                    fontSize: '10px',
                    color: '#ccc',
                    lineHeight: '1.4'
                  }}>
                    {cageValidation.issues.map((issue, i) => (
                      <div key={i}>• {issue}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <p style={{
          margin: 0,
          fontSize: '11px',
          color: '#666',
          lineHeight: '1.4'
        }}>
          Cage meshes control ray casting direction and distance for more accurate baking.
        </p>
      </div>

      {/* Preview */}
      <div style={{
        flex: 1,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#fff'
          }}>
            Baked Maps
          </h3>

          {bakedMaps.size > 0 && (
            <button
              onClick={handleClearMaps}
              style={{
                padding: '4px 8px',
                background: '#ff4444',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Clear All
            </button>
          )}
        </div>

        {isBaking && (
          <div style={{
            padding: '12px',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '12px',
            color: '#4488ff',
            textAlign: 'center'
          }}>
            Baking in progress...
          </div>
        )}

        {bakedMaps.size === 0 && !isBaking ? (
          <div style={{
            width: '100%',
            aspectRatio: '1',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            fontSize: '12px',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div>No baked maps yet</div>
            <div style={{ fontSize: '11px', color: '#555' }}>
              Select maps and click Bake
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {Array.from(bakedMaps).map(mapType => (
              <button
                key={mapType}
                onClick={() => handlePreviewMap(mapType)}
                style={{
                  padding: '12px',
                  background: previewMap === mapType ? '#4488ff' : '#2a2a2a',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background 0.2s'
                }}
              >
                <span style={{ textTransform: 'capitalize' }}>
                  {mapType === 'ao' ? 'Ambient Occlusion' : mapType}
                </span>
                {previewMap === mapType && (
                  <span style={{ fontSize: '10px', opacity: 0.8 }}>
                    Previewing
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div style={{
          marginTop: 'auto',
          paddingTop: '12px',
          fontSize: '11px',
          color: '#888',
          lineHeight: '1.4'
        }}>
          Click a baked map to preview it on the low-poly mesh. Resolution: {settings.resolution}x{settings.resolution}
        </div>
      </div>
    </div>
  );
};

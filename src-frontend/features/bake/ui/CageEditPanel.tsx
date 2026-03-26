/**
 * CageEditPanel - Cage editing tools for KBake
 * 
 * Provides manual cage vertex manipulation tools
 */

import React, { useState, useEffect } from 'react';
import type { BakeEngine } from '../engine/bakeEngine';
import type { CageEditMode } from '../engine/cageEditor';

interface CageEditPanelProps {
  engine: BakeEngine | null;
}

export const CageEditPanel: React.FC<CageEditPanelProps> = ({ engine }) => {
  const [cageEditMode, setCageEditMode] = useState(false);
  const [editMode, setEditMode] = useState<CageEditMode['type']>('select');
  const [selectionCount, setSelectionCount] = useState(0);
  const [brushRadius, setBrushRadius] = useState(0.5);
  const [brushStrength, setBrushStrength] = useState(0.5);
  const [hasCage, setHasCage] = useState(false);

  // Check if cage exists
  useEffect(() => {
    if (!engine) return;

    const interval = setInterval(() => {
      setHasCage(!!engine.getCageMesh());
      if (cageEditMode) {
        setSelectionCount(engine.getCageSelectionCount());
      }
    }, 100);

    return () => clearInterval(interval);
  }, [engine, cageEditMode]);

  const handleToggleCageEdit = () => {
    const newMode = !cageEditMode;
    setCageEditMode(newMode);
    engine?.enableCageEditMode(newMode);
    
    if (!newMode) {
      // Apply edits when exiting edit mode
      engine?.applyCageEdits();
    }
  };

  const handleSetEditMode = (mode: CageEditMode['type']) => {
    setEditMode(mode);
    engine?.setCageEditMode({ 
      type: mode, 
      radius: brushRadius, 
      strength: brushStrength 
    });
  };

  const handleSmooth = () => {
    engine?.smoothCageVertices(1);
  };

  const handleReset = () => {
    if (confirm('Reset cage to original state? This cannot be undone.')) {
      engine?.resetCage();
    }
  };

  const handleClearSelection = () => {
    engine?.clearCageSelection();
  };

  return (
    <div style={{
      padding: '16px',
      borderTop: '1px solid #333',
      background: '#1a1a1a'
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
          Cage Editing
        </h3>

        <button
          onClick={handleToggleCageEdit}
          disabled={!hasCage}
          style={{
            padding: '6px 12px',
            background: cageEditMode ? '#ff8844' : '#4488ff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: hasCage ? 'pointer' : 'not-allowed',
            opacity: hasCage ? 1 : 0.5
          }}
        >
          {cageEditMode ? 'Exit Edit' : 'Edit Cage'}
        </button>
      </div>

      {!hasCage && (
        <div style={{
          padding: '12px',
          background: '#2a2a2a',
          border: '1px solid #444',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#888',
          lineHeight: '1.4'
        }}>
          Generate a cage mesh first to enable editing tools.
        </div>
      )}

      {cageEditMode && hasCage && (
        <>
          {/* Edit Mode Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              color: '#aaa',
              marginBottom: '8px'
            }}>
              Edit Mode
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px'
            }}>
              {(['select', 'move', 'scale', 'smooth'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleSetEditMode(mode)}
                  style={{
                    padding: '8px',
                    background: editMode === mode ? '#4488ff' : '#2a2a2a',
                    color: '#fff',
                    border: `1px solid ${editMode === mode ? '#4488ff' : '#444'}`,
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    fontWeight: editMode === mode ? 'bold' : 'normal'
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Brush Settings */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              color: '#aaa',
              marginBottom: '4px'
            }}>
              Brush Radius: {brushRadius.toFixed(2)}
            </label>
            <input
              type="range"
              min={0.1}
              max={2}
              step={0.1}
              value={brushRadius}
              onChange={(e) => {
                const value = Number(e.target.value);
                setBrushRadius(value);
                engine?.setCageEditMode({ 
                  type: editMode, 
                  radius: value, 
                  strength: brushStrength 
                });
              }}
              style={{ width: '100%' }}
            />
          </div>

          {editMode === 'smooth' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: '#aaa',
                marginBottom: '4px'
              }}>
                Strength: {brushStrength.toFixed(2)}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={brushStrength}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setBrushStrength(value);
                  engine?.setCageEditMode({ 
                    type: editMode, 
                    radius: brushRadius, 
                    strength: value 
                  });
                }}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* Selection Info */}
          <div style={{
            padding: '8px',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '11px',
            color: selectionCount > 0 ? '#4488ff' : '#aaa',
            fontWeight: selectionCount > 0 ? 'bold' : 'normal'
          }}>
            Selected: {selectionCount} vertices
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <button
              onClick={handleSmooth}
              disabled={selectionCount === 0}
              style={{
                padding: '8px',
                background: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: selectionCount > 0 ? 'pointer' : 'not-allowed',
                opacity: selectionCount > 0 ? 1 : 0.5
              }}
            >
              Smooth Selection
            </button>

            <button
              onClick={handleClearSelection}
              disabled={selectionCount === 0}
              style={{
                padding: '8px',
                background: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: selectionCount > 0 ? 'pointer' : 'not-allowed',
                opacity: selectionCount > 0 ? 1 : 0.5
              }}
            >
              Clear Selection
            </button>

            <button
              onClick={handleReset}
              style={{
                padding: '8px',
                background: '#4a2a2a',
                color: '#ff8888',
                border: '1px solid #aa4444',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Reset Cage
            </button>
          </div>

          {/* Instructions */}
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            fontSize: '10px',
            color: '#888',
            lineHeight: '1.5'
          }}>
            <div style={{ fontWeight: 'bold', color: '#aaa', marginBottom: '6px' }}>
              Instructions:
            </div>
            • Click to select vertices<br />
            • Shift+Click to add to selection<br />
            • Drag to move/scale selected<br />
            • Use smooth to relax geometry
          </div>
        </>
      )}
    </div>
  );
};

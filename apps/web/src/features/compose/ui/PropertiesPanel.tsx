/**
 * PropertiesPanel - Node properties editor
 * 
 * Displays and allows editing of properties for the selected node.
 * Provides specialized controls for different parameter types.
 */

import React, { useState, useEffect } from 'react';
import { ComposeEngine } from '../engine/composeEngine';
import type { CompositeNode } from '../engine/nodeGraph';

interface PropertiesPanelProps {
  engine: ComposeEngine | null;
  selectedNodeId: string | null;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  engine,
  selectedNodeId,
}) => {
  const [selectedNode, setSelectedNode] = useState<CompositeNode | null>(null);

  // Update selected node from engine
  useEffect(() => {
    if (!engine || !selectedNodeId) {
      setSelectedNode(null);
      return;
    }

    const node = engine.getNode(selectedNodeId);
    setSelectedNode(node || null);
  }, [engine, selectedNodeId]);

  const handleParameterChange = (key: string, value: any) => {
    if (!engine || !selectedNodeId) return;
    engine.updateNodeParameters(selectedNodeId, { [key]: value });
    
    // Update local state immediately for responsive UI
    if (selectedNode) {
      setSelectedNode({
        ...selectedNode,
        parameters: {
          ...selectedNode.parameters,
          [key]: value,
        },
      });
    }
  };

  const renderParameterControl = (key: string, value: any) => {
    const label = key.replace(/([A-Z])/g, ' $1').trim();
    const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

    // Number input with slider for certain parameters
    if (typeof value === 'number') {
      const isPercentage = key.includes('opacity') || key.includes('factor') || key.includes('strength');
      const isAngle = key.includes('angle') || key.includes('rotation');
      const isColor = key.includes('hue') || key.includes('saturation') || key.includes('lightness');

      let min = 0;
      let max = 1;
      let step = 0.01;

      if (isPercentage) {
        min = 0;
        max = 1;
        step = 0.01;
      } else if (isAngle) {
        min = -Math.PI;
        max = Math.PI;
        step = 0.01;
      } else if (isColor) {
        min = -1;
        max = 1;
        step = 0.01;
      } else if (key.includes('radius')) {
        min = 0;
        max = 50;
        step = 0.5;
      } else if (key.includes('threshold')) {
        min = 0;
        max = 1;
        step = 0.01;
      } else {
        min = -10;
        max = 10;
        step = 0.1;
      }

      return (
        <div key={key} style={{ marginBottom: '16px' }}>
          <label style={{
            fontSize: '11px',
            color: '#ccc',
            display: 'block',
            marginBottom: '6px',
            fontWeight: 500,
          }}>
            {capitalizedLabel}: {value.toFixed(2)}
          </label>
          
          {/* Slider */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            style={{
              width: '100%',
              marginBottom: '6px',
              cursor: 'pointer',
            }}
            onChange={(e) => handleParameterChange(key, parseFloat(e.target.value))}
          />
          
          {/* Numeric input */}
          <input
            type="number"
            value={value}
            step={step}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: '#1a1a1a',
              border: '1px solid #555',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '12px',
            }}
            onChange={(e) => handleParameterChange(key, parseFloat(e.target.value))}
          />
        </div>
      );
    }

    // Boolean checkbox
    if (typeof value === 'boolean') {
      return (
        <div key={key} style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            padding: '8px',
            background: '#1a1a1a',
            border: '1px solid #555',
            borderRadius: '4px',
          }}>
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => handleParameterChange(key, e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', color: '#ccc', fontWeight: 500 }}>
              {capitalizedLabel}
            </span>
            <span style={{
              marginLeft: 'auto',
              fontSize: '11px',
              color: value ? '#4a7c59' : '#666',
              fontWeight: 500,
            }}>
              {value ? 'ON' : 'OFF'}
            </span>
          </label>
        </div>
      );
    }

    // Color picker for color parameters
    if (typeof value === 'string' && value.startsWith('#')) {
      return (
        <div key={key} style={{ marginBottom: '16px' }}>
          <label style={{
            fontSize: '11px',
            color: '#ccc',
            display: 'block',
            marginBottom: '6px',
            fontWeight: 500,
          }}>
            {capitalizedLabel}
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="color"
              value={value}
              style={{
                width: '48px',
                height: '32px',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: 'pointer',
                background: 'transparent',
              }}
              onChange={(e) => handleParameterChange(key, e.target.value)}
            />
            <input
              type="text"
              value={value}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: '#1a1a1a',
                border: '1px solid #555',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
              onChange={(e) => handleParameterChange(key, e.target.value)}
            />
          </div>
        </div>
      );
    }

    // Select dropdown for specific parameters
    if (key === 'blendMode' || key === 'operation' || key === 'type') {
      let options: string[] = [];
      
      if (key === 'blendMode') {
        options = ['normal', 'multiply', 'screen', 'overlay', 'add', 'subtract'];
      } else if (key === 'operation') {
        options = ['add', 'subtract', 'multiply', 'divide', 'power', 'min', 'max'];
      } else if (key === 'type') {
        options = ['linear', 'radial', 'perlin', 'simplex', 'voronoi'];
      }

      return (
        <div key={key} style={{ marginBottom: '16px' }}>
          <label style={{
            fontSize: '11px',
            color: '#ccc',
            display: 'block',
            marginBottom: '6px',
            fontWeight: 500,
          }}>
            {capitalizedLabel}
          </label>
          <select
            value={value}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: '#1a1a1a',
              border: '1px solid #555',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '12px',
              cursor: 'pointer',
            }}
            onChange={(e) => handleParameterChange(key, e.target.value)}
          >
            {options.map(opt => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // Text input for strings
    if (typeof value === 'string') {
      return (
        <div key={key} style={{ marginBottom: '16px' }}>
          <label style={{
            fontSize: '11px',
            color: '#ccc',
            display: 'block',
            marginBottom: '6px',
            fontWeight: 500,
          }}>
            {capitalizedLabel}
          </label>
          <input
            type="text"
            value={value}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: '#1a1a1a',
              border: '1px solid #555',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '12px',
            }}
            onChange={(e) => handleParameterChange(key, e.target.value)}
          />
        </div>
      );
    }

    // Fallback for complex types
    return (
      <div key={key} style={{ marginBottom: '16px' }}>
        <label style={{
          fontSize: '11px',
          color: '#ccc',
          display: 'block',
          marginBottom: '6px',
          fontWeight: 500,
        }}>
          {capitalizedLabel}
        </label>
        <div style={{
          padding: '8px',
          background: '#1a1a1a',
          border: '1px solid #555',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#666',
          fontFamily: 'monospace',
        }}>
          {JSON.stringify(value)}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      width: '300px',
      background: '#2a2a2a',
      borderLeft: '1px solid #444',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid #444',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
          Properties
        </div>
      </div>

      {/* Properties Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
      }}>
        {!selectedNode ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: '#666',
            fontSize: '12px',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>
              📋
            </div>
            <div style={{ marginBottom: '8px' }}>No node selected</div>
            <div style={{ fontSize: '11px', color: '#555' }}>
              Click a node to edit its properties
            </div>
          </div>
        ) : (
          <div>
            {/* Node Info */}
            <div style={{
              marginBottom: '20px',
              padding: '12px',
              background: '#1a1a1a',
              border: '1px solid #444',
              borderRadius: '6px',
            }}>
              <div style={{
                fontSize: '14px',
                color: '#fff',
                fontWeight: 600,
                marginBottom: '6px',
              }}>
                {selectedNode.name}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#4a7c59',
                fontWeight: 500,
              }}>
                {selectedNode.type.toUpperCase()}
              </div>
            </div>

            {/* Node Parameters */}
            {Object.keys(selectedNode.parameters).length > 0 ? (
              <div>
                <div style={{
                  fontSize: '11px',
                  color: '#999',
                  marginBottom: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Parameters
                </div>
                {Object.entries(selectedNode.parameters).map(([key, value]) =>
                  renderParameterControl(key, value)
                )}
              </div>
            ) : (
              <div style={{
                padding: '16px',
                textAlign: 'center',
                color: '#666',
                fontSize: '11px',
              }}>
                No parameters
              </div>
            )}

            {/* Node Inputs */}
            {selectedNode.inputs.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <div style={{
                  fontSize: '11px',
                  color: '#999',
                  marginBottom: '8px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Inputs
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedNode.inputs.map(input => (
                    <div
                      key={input.name}
                      style={{
                        padding: '8px 10px',
                        background: '#1a1a1a',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#ccc',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{input.name}</span>
                      <span style={{
                        fontSize: '10px',
                        color: '#666',
                        background: '#2a2a2a',
                        padding: '2px 6px',
                        borderRadius: '3px',
                      }}>
                        {input.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Node Outputs */}
            {selectedNode.outputs.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <div style={{
                  fontSize: '11px',
                  color: '#999',
                  marginBottom: '8px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Outputs
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedNode.outputs.map(output => (
                    <div
                      key={output.name}
                      style={{
                        padding: '8px 10px',
                        background: '#1a1a1a',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#ccc',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{output.name}</span>
                      <span style={{
                        fontSize: '10px',
                        color: '#666',
                        background: '#2a2a2a',
                        padding: '2px 6px',
                        borderRadius: '3px',
                      }}>
                        {output.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

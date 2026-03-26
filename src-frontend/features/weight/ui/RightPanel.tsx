/**
 * RightPanel - Vertex group management
 * 
 * List of vertex groups with creation, deletion, renaming, and selection tools.
 */

import React, { useState } from 'react';
import { VertexGroup } from '../engine/weightEngine';

interface RightPanelProps {
  vertexGroups: VertexGroup[];
  activeGroupId: string | null;
  onCreateGroup: (name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onRenameGroup: (groupId: string, newName: string) => void;
  onSelectGroup: (groupId: string | null) => void;
  onSelectByWeight: (min: number, max: number) => void;
  onSelectByGroup: (groupId: string) => void;
  onClearSelection: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({
  vertexGroups,
  activeGroupId,
  onCreateGroup,
  onDeleteGroup,
  onRenameGroup,
  onSelectGroup,
  onSelectByWeight,
  onSelectByGroup,
  onClearSelection,
}) => {
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [weightRange, setWeightRange] = useState<[number, number]>([0, 1]);

  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      onCreateGroup(newGroupName.trim());
      setNewGroupName('');
    }
  };

  const handleStartEdit = (group: VertexGroup) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  const handleSaveEdit = () => {
    if (editingGroupId && editingName.trim()) {
      onRenameGroup(editingGroupId, editingName.trim());
      setEditingGroupId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setEditingName('');
  };

  const handleSelectByWeight = () => {
    onSelectByWeight(weightRange[0], weightRange[1]);
  };

  return (
    <div style={{
      width: '320px',
      background: '#2a2a2a',
      borderLeft: '1px solid #444',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Create New Group */}
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
            Create Vertex Group
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Group name..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateGroup();
              }}
              style={{
                flex: 1,
                padding: '6px 10px',
                background: '#2a2a2a',
                border: '1px solid #555',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '12px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim()}
              style={{
                padding: '6px 12px',
                background: newGroupName.trim() ? '#4a7c59' : '#3a3a3a',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                cursor: newGroupName.trim() ? 'pointer' : 'not-allowed',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* Vertex Groups List */}
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
            Vertex Groups ({vertexGroups.length})
          </div>
          <div style={{
            maxHeight: '384px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}>
            {vertexGroups.length === 0 ? (
              <div style={{
                fontSize: '12px',
                color: '#666',
                textAlign: 'center',
                padding: '32px 16px',
              }}>
                No vertex groups yet
              </div>
            ) : (
              vertexGroups.map((group) => (
                <div
                  key={group.id}
                  style={{
                    padding: '8px',
                    background: activeGroupId === group.id ? '#4a7c59' : '#2a2a2a',
                    border: activeGroupId === group.id ? '1px solid #5a8c69' : '1px solid #444',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => onSelectGroup(group.id)}
                >
                  {editingGroupId === group.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          background: '#1a1a1a',
                          border: '1px solid #555',
                          borderRadius: '3px',
                          color: '#fff',
                          fontSize: '12px',
                          outline: 'none',
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveEdit}
                        style={{
                          padding: '4px 8px',
                          background: 'transparent',
                          border: 'none',
                          color: '#4a7c59',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        style={{
                          padding: '4px 8px',
                          background: 'transparent',
                          border: 'none',
                          color: '#999',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: `#${group.color.getHexString()}`,
                          }}
                        />
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {group.name}
                        </span>
                        <span style={{ fontSize: '11px', color: '#999' }}>
                          ({group.weights.size})
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(group);
                          }}
                          style={{
                            padding: '4px',
                            background: 'transparent',
                            border: 'none',
                            color: '#999',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          ✎
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteGroup(group.id);
                          }}
                          style={{
                            padding: '4px',
                            background: 'transparent',
                            border: 'none',
                            color: '#e74c3c',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selection Tools */}
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
            Selection Tools
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Select by Weight Range */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: '#ccc', fontWeight: 500 }}>
                Select by Weight Range
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weightRange[0] * 100}
                  onChange={(e) => setWeightRange([parseInt(e.target.value) / 100, weightRange[1]])}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weightRange[1] * 100}
                  onChange={(e) => setWeightRange([weightRange[0], parseInt(e.target.value) / 100])}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999' }}>
                  <span>{weightRange[0].toFixed(2)}</span>
                  <span>{weightRange[1].toFixed(2)}</span>
                </div>
                <button
                  onClick={handleSelectByWeight}
                  disabled={!activeGroupId}
                  style={{
                    width: '100%',
                    padding: '6px 12px',
                    background: activeGroupId ? '#3a3a3a' : '#2a2a2a',
                    border: '1px solid #555',
                    borderRadius: '4px',
                    color: activeGroupId ? '#fff' : '#666',
                    cursor: activeGroupId ? 'pointer' : 'not-allowed',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  Select Vertices
                </button>
              </div>
            </div>

            <div style={{ height: '1px', background: '#444' }} />

            {/* Select by Group */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => activeGroupId && onSelectByGroup(activeGroupId)}
                disabled={!activeGroupId}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  background: activeGroupId ? '#3a3a3a' : '#2a2a2a',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: activeGroupId ? '#fff' : '#666',
                  cursor: activeGroupId ? 'pointer' : 'not-allowed',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                Select All in Active Group
              </button>

              <button
                onClick={onClearSelection}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  background: '#3a3a3a',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>

        {/* Group Statistics */}
        {activeGroupId && (() => {
          const group = vertexGroups.find((g) => g.id === activeGroupId);
          if (!group) return null;

          const weights = Array.from(group.weights.values());
          const avgWeight = weights.length > 0
            ? weights.reduce((a, b) => a + b, 0) / weights.length
            : 0;
          const minWeight = weights.length > 0 ? Math.min(...weights) : 0;
          const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;

          return (
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
                Active Group Stats
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#999' }}>Vertices:</span>
                  <span style={{ color: '#fff' }}>{group.weights.size}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#999' }}>Avg Weight:</span>
                  <span style={{ color: '#fff' }}>{avgWeight.toFixed(3)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#999' }}>Min Weight:</span>
                  <span style={{ color: '#fff' }}>{minWeight.toFixed(3)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#999' }}>Max Weight:</span>
                  <span style={{ color: '#fff' }}>{maxWeight.toFixed(3)}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default RightPanel;

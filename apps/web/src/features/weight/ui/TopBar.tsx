/**
 * TopBar - Main toolbar for KWeight
 * 
 * Contains brush controls, undo/redo, and file operations.
 */

import React, { useRef } from 'react';

interface TopBarProps {
  activeGroupId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExportWeights: () => void;
  onImportWeights: (file: File) => void;
}

const TopBar: React.FC<TopBarProps> = ({
  activeGroupId,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExportWeights,
  onImportWeights,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportWeights(file);
    }
  };

  return (
    <div style={{
      height: '56px',
      background: '#2a2a2a',
      borderBottom: '1px solid #444',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '12px',
    }}>
      {/* App Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 700,
          color: '#4a7c59',
          letterSpacing: '0.5px',
        }}>
          KWeight
        </div>
        <div style={{
          fontSize: '12px',
          color: '#999',
        }}>
          Weight Painting
        </div>
      </div>

      <div style={{ width: '1px', height: '32px', background: '#444' }} />

      {/* File Operations */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={handleImportClick}
          title="Import Weights"
          style={{
            padding: '6px 12px',
            background: '#3a3a3a',
            border: '1px solid #555',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#4a4a4a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#3a3a3a';
          }}
        >
          <span style={{ fontSize: '14px' }}>⬆</span>
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <button
          onClick={onExportWeights}
          title="Export Weights"
          style={{
            padding: '6px 12px',
            background: '#3a3a3a',
            border: '1px solid #555',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#4a4a4a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#3a3a3a';
          }}
        >
          <span style={{ fontSize: '14px' }}>⬇</span>
          Export
        </button>
      </div>

      <div style={{ width: '1px', height: '32px', background: '#444' }} />

      {/* Undo/Redo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{
            padding: '6px 12px',
            background: canUndo ? '#3a3a3a' : '#2a2a2a',
            border: '1px solid #555',
            borderRadius: '4px',
            color: canUndo ? '#fff' : '#666',
            cursor: canUndo ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (canUndo) {
              e.currentTarget.style.background = '#4a4a4a';
            }
          }}
          onMouseLeave={(e) => {
            if (canUndo) {
              e.currentTarget.style.background = '#3a3a3a';
            }
          }}
        >
          ↶
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{
            padding: '6px 12px',
            background: canRedo ? '#3a3a3a' : '#2a2a2a',
            border: '1px solid #555',
            borderRadius: '4px',
            color: canRedo ? '#fff' : '#666',
            cursor: canRedo ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (canRedo) {
              e.currentTarget.style.background = '#4a4a4a';
            }
          }}
          onMouseLeave={(e) => {
            if (canRedo) {
              e.currentTarget.style.background = '#3a3a3a';
            }
          }}
        >
          ↷
        </button>
      </div>

      <div style={{ width: '1px', height: '32px', background: '#444' }} />

      {/* Active Group Indicator */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ fontSize: '12px', color: '#999' }}>
          Active Group:
        </span>
        <span style={{
          fontSize: '12px',
          fontWeight: 500,
          color: activeGroupId ? '#4a7c59' : '#666',
        }}>
          {activeGroupId ? 'Selected' : 'None'}
        </span>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div style={{
        fontSize: '11px',
        color: '#666',
        padding: '4px 8px',
        background: '#1a1a1a',
        borderRadius: '4px',
      }}>
        LMB: Paint | Shift+LMB: Smooth | Ctrl+Z: Undo
      </div>
    </div>
  );
};

export default TopBar;

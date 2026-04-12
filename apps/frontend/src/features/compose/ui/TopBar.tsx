/**
 * TopBar - Main toolbar for KCompose
 * 
 * Provides file operations, evaluation controls, export options,
 * and render settings.
 */

import React, { useState } from 'react';
import { ComposeEngine } from '../engine/composeEngine';
import { ExportDialog, type ExportSettings } from './ExportDialog';

interface TopBarProps {
  engine: ComposeEngine | null;
  onEvaluate: () => void;
  onExport: (settings: ExportSettings) => void;
  isEvaluating: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  engine,
  onEvaluate,
  onExport,
  isEvaluating,
}) => {
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [hdrEnabled, setHdrEnabled] = useState(false);

  return (
    <div style={{
      height: '52px',
      background: '#2a2a2a',
      borderBottom: '1px solid #444',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '12px',
      color: '#fff',
    }}>
      {/* App Title */}
      <div style={{
        fontWeight: 700,
        fontSize: '15px',
        color: '#4a7c59',
        letterSpacing: '0.5px',
      }}>
        KCompose
      </div>

      <div style={{ width: '1px', height: '28px', background: '#444' }} />

      {/* File Operations */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          style={{
            padding: '7px 14px',
            background: '#3a3a3a',
            border: '1px solid #555',
            borderRadius: '5px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.2s',
          }}
          onClick={() => console.log('New project')}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#4a4a4a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#3a3a3a';
          }}
        >
          📄 New
        </button>

        <button
          style={{
            padding: '7px 14px',
            background: '#3a3a3a',
            border: '1px solid #555',
            borderRadius: '5px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.2s',
          }}
          onClick={() => console.log('Open project')}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#4a4a4a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#3a3a3a';
          }}
        >
          📂 Open
        </button>

        <button
          style={{
            padding: '7px 14px',
            background: '#3a3a3a',
            border: '1px solid #555',
            borderRadius: '5px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.2s',
          }}
          onClick={() => console.log('Save project')}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#4a4a4a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#3a3a3a';
          }}
        >
          💾 Save
        </button>
      </div>

      <div style={{ width: '1px', height: '28px', background: '#444' }} />

      {/* Evaluation */}
      <button
        style={{
          padding: '7px 20px',
          background: isEvaluating ? '#555' : '#4a7c59',
          border: isEvaluating ? '1px solid #666' : '1px solid #5a8c69',
          borderRadius: '5px',
          color: '#fff',
          cursor: isEvaluating ? 'not-allowed' : 'pointer',
          fontSize: '12px',
          fontWeight: 600,
          transition: 'all 0.2s',
          boxShadow: isEvaluating ? 'none' : '0 2px 4px rgba(74, 124, 89, 0.3)',
        }}
        onClick={onEvaluate}
        disabled={isEvaluating}
        onMouseEnter={(e) => {
          if (!isEvaluating) {
            e.currentTarget.style.background = '#5a8c69';
          }
        }}
        onMouseLeave={(e) => {
          if (!isEvaluating) {
            e.currentTarget.style.background = '#4a7c59';
          }
        }}
      >
        {isEvaluating ? '⏳ Evaluating...' : '▶ Evaluate Graph'}
      </button>

      <div style={{ width: '1px', height: '28px', background: '#444' }} />

      {/* HDR Toggle */}
      <button
        style={{
          padding: '7px 16px',
          background: hdrEnabled ? '#4a7c59' : '#3a3a3a',
          border: hdrEnabled ? '1px solid #5a8c69' : '1px solid #555',
          borderRadius: '5px',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s',
        }}
        onClick={() => {
          const newHdrState = !hdrEnabled;
          setHdrEnabled(newHdrState);
          engine?.setHDREnabled(newHdrState);
        }}
        onMouseEnter={(e) => {
          if (!hdrEnabled) {
            e.currentTarget.style.background = '#4a4a4a';
          }
        }}
        onMouseLeave={(e) => {
          if (!hdrEnabled) {
            e.currentTarget.style.background = '#3a3a3a';
          }
        }}
      >
        ✨ HDR {hdrEnabled ? 'ON' : 'OFF'}
      </button>

      <div style={{ width: '1px', height: '28px', background: '#444' }} />

      {/* Export */}
      <button
        style={{
          padding: '7px 16px',
          background: '#3a3a3a',
          border: '1px solid #555',
          borderRadius: '5px',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s',
        }}
        onClick={() => setShowExportDialog(true)}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#4a4a4a';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#3a3a3a';
        }}
      >
        📤 Export
      </button>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={onExport}
        defaultWidth={1920}
        defaultHeight={1080}
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Quick Stats */}
      {engine && (
        <div style={{
          display: 'flex',
          gap: '16px',
          fontSize: '11px',
          color: '#999',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#4a7c59' }}>●</span>
            <span>{engine.getNodes().length} nodes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#4a7c59' }}>●</span>
            <span>{engine.getLayers().length} layers</span>
          </div>
        </div>
      )}

      {/* Status */}
      <div style={{
        fontSize: '12px',
        color: engine ? '#4a7c59' : '#999',
        fontWeight: 500,
        padding: '6px 12px',
        background: engine ? 'rgba(74, 124, 89, 0.1)' : 'transparent',
        borderRadius: '4px',
      }}>
        {engine ? '● Ready' : 'Initializing...'}
      </div>
    </div>
  );
};

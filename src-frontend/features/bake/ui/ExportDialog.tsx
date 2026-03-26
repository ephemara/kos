/**
 * ExportDialog - Dialog for configuring and exporting baked maps
 * 
 * Allows users to select export format, bit depth, compression,
 * and choose which maps to export (single or batch).
 */

import React, { useState } from 'react';
import type { MapType } from '../engine/bakeEngine';
import type { ExportSettings } from '../../../services/bakeExportClient';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availableMaps: MapType[];
  onExport: (mapTypes: MapType[], settings: ExportSettings) => Promise<void>;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  availableMaps,
  onExport,
}) => {
  const [selectedMaps, setSelectedMaps] = useState<Set<MapType>>(new Set(availableMaps));
  const [format, setFormat] = useState<'png' | 'exr' | 'tga'>('png');
  const [bitDepth, setBitDepth] = useState<8 | 16>(8);
  const [compression, setCompression] = useState<'none' | 'fast' | 'best'>('best');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleToggleMap = (mapType: MapType) => {
    const newSelected = new Set(selectedMaps);
    if (newSelected.has(mapType)) {
      newSelected.delete(mapType);
    } else {
      newSelected.add(mapType);
    }
    setSelectedMaps(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedMaps(new Set(availableMaps));
  };

  const handleSelectNone = () => {
    setSelectedMaps(new Set());
  };

  const handleExport = async () => {
    if (selectedMaps.size === 0) {
      alert('Please select at least one map to export');
      return;
    }

    setIsExporting(true);
    try {
      const settings: ExportSettings = {
        format,
        bitDepth: format === 'png' ? bitDepth : undefined,
        compression: format === 'png' ? compression : undefined,
      };

      await onExport(Array.from(selectedMaps), settings);
      onClose();
    } catch (error) {
      console.error('[ExportDialog] Export failed:', error);
      alert(`Export failed: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#2a2a2a',
          borderRadius: '8px',
          padding: '24px',
          minWidth: '400px',
          maxWidth: '600px',
          border: '1px solid #444',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '20px' }}>
          Export Baked Maps
        </h2>

        {/* Map Selection */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px' 
          }}>
            <label style={{ color: '#ccc', fontSize: '14px', fontWeight: 'bold' }}>
              Maps to Export
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSelectAll}
                style={{
                  padding: '4px 8px',
                  background: '#444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Select All
              </button>
              <button
                onClick={handleSelectNone}
                style={{
                  padding: '4px 8px',
                  background: '#444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Select None
              </button>
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '8px',
            padding: '12px',
            background: '#1a1a1a',
            borderRadius: '4px',
          }}>
            {availableMaps.map((mapType) => (
              <label
                key={mapType}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: '14px',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedMaps.has(mapType)}
                  onChange={() => handleToggleMap(mapType)}
                  style={{ cursor: 'pointer' }}
                />
                {mapType.charAt(0).toUpperCase() + mapType.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {/* Format Selection */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#ccc', fontSize: '14px', marginBottom: '8px', fontWeight: 'bold' }}>
            Format
          </label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as 'png' | 'exr' | 'tga')}
            style={{
              width: '100%',
              padding: '8px',
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            <option value="png">PNG (Portable Network Graphics)</option>
            <option value="exr">EXR (OpenEXR HDR - 32-bit float)</option>
            <option value="tga">TGA (Targa)</option>
          </select>
        </div>

        {/* PNG-specific options */}
        {format === 'png' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '14px', marginBottom: '8px', fontWeight: 'bold' }}>
                Bit Depth
              </label>
              <select
                value={bitDepth}
                onChange={(e) => setBitDepth(Number(e.target.value) as 8 | 16)}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: '#1a1a1a',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value={8}>8-bit (Standard)</option>
                <option value={16}>16-bit (High Precision)</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '14px', marginBottom: '8px', fontWeight: 'bold' }}>
                Compression
              </label>
              <select
                value={compression}
                onChange={(e) => setCompression(e.target.value as 'none' | 'fast' | 'best')}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: '#1a1a1a',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value="none">None (Fastest)</option>
                <option value="fast">Fast</option>
                <option value="best">Best (Smallest File)</option>
              </select>
            </div>
          </>
        )}

        {/* Info text */}
        <div style={{ 
          padding: '12px', 
          background: '#1a1a1a', 
          borderRadius: '4px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#aaa',
        }}>
          {selectedMaps.size === 0 && (
            <p style={{ margin: 0 }}>⚠️ No maps selected</p>
          )}
          {selectedMaps.size === 1 && (
            <p style={{ margin: 0 }}>💾 Will export 1 map</p>
          )}
          {selectedMaps.size > 1 && (
            <p style={{ margin: 0 }}>
              💾 Will export {selectedMaps.size} maps with naming: base_maptype.{format}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isExporting}
            style={{
              padding: '8px 16px',
              background: '#444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.5 : 1,
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || selectedMaps.size === 0}
            style={{
              padding: '8px 16px',
              background: selectedMaps.size > 0 ? '#44ff88' : '#444',
              color: selectedMaps.size > 0 ? '#000' : '#888',
              border: 'none',
              borderRadius: '4px',
              cursor: isExporting || selectedMaps.size === 0 ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.5 : 1,
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
};

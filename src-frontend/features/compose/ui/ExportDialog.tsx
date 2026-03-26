/**
 * ExportDialog - Export settings dialog for KCompose
 * 
 * Provides options for exporting composites with various formats,
 * bit depths, and compression settings.
 */

import React, { useState } from 'react';

export interface ExportSettings {
  format: 'png' | 'exr' | 'tiff';
  bitDepth: 8 | 16 | 32;
  compression: 'none' | 'zip' | 'rle' | 'piz';
  width: number;
  height: number;
  filename: string;
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => void;
  defaultWidth: number;
  defaultHeight: number;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  defaultWidth,
  defaultHeight,
}) => {
  const [settings, setSettings] = useState<ExportSettings>({
    format: 'png',
    bitDepth: 8,
    compression: 'none',
    width: defaultWidth,
    height: defaultHeight,
    filename: 'composite',
  });

  if (!isOpen) return null;

  const handleExport = () => {
    onExport(settings);
    onClose();
  };

  const getAvailableBitDepths = (): number[] => {
    switch (settings.format) {
      case 'png':
        return [8, 16];
      case 'exr':
        return [16, 32];
      case 'tiff':
        return [8, 16, 32];
      default:
        return [8];
    }
  };

  const getAvailableCompressions = (): string[] => {
    switch (settings.format) {
      case 'png':
        return ['none', 'zip'];
      case 'exr':
        return ['none', 'zip', 'rle', 'piz'];
      case 'tiff':
        return ['none', 'zip', 'rle'];
      default:
        return ['none'];
    }
  };

  const availableBitDepths = getAvailableBitDepths();
  const availableCompressions = getAvailableCompressions();

  // Ensure current bit depth is valid for selected format
  if (!availableBitDepths.includes(settings.bitDepth)) {
    setSettings({ ...settings, bitDepth: availableBitDepths[0] as 8 | 16 | 32 });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 9998,
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#2a2a2a',
          border: '1px solid #444',
          borderRadius: '8px',
          padding: '24px',
          minWidth: '480px',
          maxWidth: '600px',
          zIndex: 9999,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          color: '#fff',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: '#4a7c59',
          }}>
            Export Composite
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#999',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Filename */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              marginBottom: '8px',
              color: '#ccc',
            }}>
              Filename
            </label>
            <input
              type="text"
              value={settings.filename}
              onChange={(e) => setSettings({ ...settings, filename: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#1a1a1a',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* Format */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              marginBottom: '8px',
              color: '#ccc',
            }}>
              Format
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['png', 'exr', 'tiff'] as const).map((format) => (
                <button
                  key={format}
                  onClick={() => setSettings({ ...settings, format })}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: settings.format === format ? '#4a7c59' : '#3a3a3a',
                    border: settings.format === format ? '1px solid #5a8c69' : '1px solid #555',
                    borderRadius: '4px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                  }}
                >
                  {format.toUpperCase()}
                  {format === 'exr' && <span style={{ fontSize: '10px', marginLeft: '4px' }}>✨ HDR</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Bit Depth */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              marginBottom: '8px',
              color: '#ccc',
            }}>
              Bit Depth
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {availableBitDepths.map((depth) => (
                <button
                  key={depth}
                  onClick={() => setSettings({ ...settings, bitDepth: depth as 8 | 16 | 32 })}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: settings.bitDepth === depth ? '#4a7c59' : '#3a3a3a',
                    border: settings.bitDepth === depth ? '1px solid #5a8c69' : '1px solid #555',
                    borderRadius: '4px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                  }}
                >
                  {depth}-bit
                  {depth === 32 && <span style={{ fontSize: '10px', marginLeft: '4px' }}>Float</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Compression */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              marginBottom: '8px',
              color: '#ccc',
            }}>
              Compression
            </label>
            <select
              value={settings.compression}
              onChange={(e) => setSettings({ ...settings, compression: e.target.value as any })}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#1a1a1a',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '13px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {availableCompressions.map((comp) => (
                <option key={comp} value={comp}>
                  {comp.toUpperCase()}
                  {comp === 'zip' && ' (Lossless)'}
                  {comp === 'rle' && ' (Run-Length)'}
                  {comp === 'piz' && ' (Wavelet)'}
                </option>
              ))}
            </select>
          </div>

          {/* Resolution */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                marginBottom: '8px',
                color: '#ccc',
              }}>
                Width
              </label>
              <input
                type="number"
                value={settings.width}
                onChange={(e) => setSettings({ ...settings, width: parseInt(e.target.value) || defaultWidth })}
                min={1}
                max={16384}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                marginBottom: '8px',
                color: '#ccc',
              }}>
                Height
              </label>
              <input
                type="number"
                value={settings.height}
                onChange={(e) => setSettings({ ...settings, height: parseInt(e.target.value) || defaultHeight })}
                min={1}
                max={16384}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Info */}
          <div style={{
            padding: '12px',
            background: 'rgba(74, 124, 89, 0.1)',
            border: '1px solid rgba(74, 124, 89, 0.3)',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#aaa',
            lineHeight: '1.5',
          }}>
            {settings.format === 'exr' && (
              <>
                <strong style={{ color: '#4a7c59' }}>HDR Workflow:</strong> EXR format supports floating-point precision
                for high dynamic range imaging. Use 32-bit for maximum quality.
              </>
            )}
            {settings.format === 'png' && (
              <>
                <strong style={{ color: '#4a7c59' }}>Standard Format:</strong> PNG is ideal for web and general use.
                16-bit provides better quality for gradients.
              </>
            )}
            {settings.format === 'tiff' && (
              <>
                <strong style={{ color: '#4a7c59' }}>Professional Format:</strong> TIFF supports high bit depths
                and is widely compatible with professional software.
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '24px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#3a3a3a',
              border: '1px solid #555',
              borderRadius: '5px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            style={{
              padding: '10px 24px',
              background: '#4a7c59',
              border: '1px solid #5a8c69',
              borderRadius: '5px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(74, 124, 89, 0.3)',
            }}
          >
            Export
          </button>
        </div>
      </div>
    </>
  );
};

/**
 * Unified Export Dialog Component
 * 
 * Reusable export dialog that reads available formats from ConfigRegistry.
 * Replaces hardcoded export UI across all DCC apps.
 */

import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Image, Box } from 'lucide-react';
import { ExportFormatConfig, ExportOption } from '@/services/configClient';
import { exportService } from '@/services/exportService';

interface ExportDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  
  /** Close callback */
  onClose: () => void;
  
  /** Export type filter */
  exportType: 'mesh' | 'texture' | 'all';
  
  /** Export callback - receives format ID and options */
  onExport: (formatId: string, options: Record<string, any>) => Promise<void>;
  
  /** Optional title override */
  title?: string;
}

export function ExportDialog({
  isOpen,
  onClose,
  exportType,
  onExport,
  title = 'Export'
}: ExportDialogProps) {
  const [formats, setFormats] = useState<ExportFormatConfig[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatConfig | null>(null);
  const [options, setOptions] = useState<Record<string, any>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  // Load available formats
  useEffect(() => {
    if (isOpen) {
      loadFormats();
    }
  }, [isOpen, exportType]);

  const loadFormats = async () => {
    try {
      let availableFormats: ExportFormatConfig[];
      
      switch (exportType) {
        case 'mesh':
          availableFormats = await exportService.getMeshFormats();
          break;
        case 'texture':
          availableFormats = await exportService.getTextureFormats();
          break;
        default:
          availableFormats = await exportService.getAvailableFormats();
      }
      
      setFormats(availableFormats);
      
      // Auto-select first format
      if (availableFormats.length > 0) {
        selectFormat(availableFormats[0]);
      }
    } catch (error) {
      console.error('[ExportDialog] Failed to load formats:', error);
    }
  };

  const selectFormat = (format: ExportFormatConfig) => {
    setSelectedFormat(format);
    
    // Initialize options with defaults
    const defaultOptions: Record<string, any> = {};
    format.options.forEach(opt => {
      defaultOptions[opt.id] = opt.default;
    });
    setOptions(defaultOptions);
  };

  const handleOptionChange = (optionId: string, value: any) => {
    setOptions(prev => ({
      ...prev,
      [optionId]: value
    }));
  };

  const handleExport = async () => {
    if (!selectedFormat) return;
    
    setIsExporting(true);
    setProgress(0);
    setStatus('Starting export...');
    
    try {
      await onExport(selectedFormat.id, options);
      setStatus('Export complete!');
      setProgress(100);
      
      // Close dialog after brief delay
      setTimeout(() => {
        onClose();
        setIsExporting(false);
        setProgress(0);
        setStatus('');
      }, 1000);
    } catch (error) {
      console.error('[ExportDialog] Export failed:', error);
      setStatus(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Download size={20} />
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isExporting}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {formats.map(format => (
                <button
                  key={format.id}
                  onClick={() => selectFormat(format)}
                  disabled={isExporting}
                  className={`p-3 rounded border transition-all text-left ${
                    selectedFormat?.id === format.id
                      ? 'bg-emerald-900/40 border-emerald-500 text-emerald-400'
                      : 'bg-[#151515] border-[#333] text-gray-400 hover:text-white hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {format.supportsMeshes && <Box size={14} />}
                    {format.supportsTextures && <Image size={14} />}
                    <span className="font-bold text-xs">{format.name}</span>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    .{format.extensions.join(', .')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Format Options */}
          {selectedFormat && selectedFormat.options.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Export Options
              </label>
              <div className="space-y-3 bg-[#151515] border border-[#333] rounded p-3">
                {selectedFormat.options.map(option => (
                  <div key={option.id}>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      {option.label}
                    </label>
                    {renderOptionInput(option, options[option.id], (value) => handleOptionChange(option.id, value), isExporting)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress */}
          {isExporting && (
            <div>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>{status}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-[#151515] border border-[#333] rounded overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#333]">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || !selectedFormat}
            className="px-4 py-2 text-sm font-bold bg-emerald-900/40 border border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// OPTION INPUT RENDERERS
// ============================================================================

function renderOptionInput(
  option: ExportOption,
  value: any,
  onChange: (value: any) => void,
  disabled: boolean
) {
  switch (option.type) {
    case 'bool':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value ?? option.default}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 rounded border-[#333] bg-[#1a1a1a] text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
          />
          <span className="text-xs text-gray-400">Enabled</span>
        </label>
      );

    case 'int':
    case 'float':
      return (
        <input
          type="number"
          value={value ?? option.default}
          onChange={(e) => onChange(option.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))}
          min={option.min}
          max={option.max}
          step={option.type === 'int' ? 1 : 0.1}
          disabled={disabled}
          className="w-full px-3 py-1.5 text-sm bg-[#1a1a1a] border border-[#333] rounded text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
        />
      );

    case 'enum':
      return (
        <select
          value={value ?? option.default}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-1.5 text-sm bg-[#1a1a1a] border border-[#333] rounded text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
        >
          {option.values?.map(val => (
            <option key={val} value={val}>
              {val}
            </option>
          ))}
        </select>
      );

    default:
      return (
        <input
          type="text"
          value={value ?? option.default}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-1.5 text-sm bg-[#1a1a1a] border border-[#333] rounded text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
        />
      );
  }
}

export default ExportDialog;

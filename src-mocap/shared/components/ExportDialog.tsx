/**
 * Export Dialog Component
 * 
 * Universal export dialog for texture channels and PBR materials.
 * Supports channel selection, format selection, and resolution options.
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@mocap/shared/primitives/Dialog';
import { Button } from '@mocap/shared/primitives/Button';
import { Checkbox } from '@mocap/shared/primitives/Checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mocap/shared/primitives/Select';
import { Download, Loader2 } from 'lucide-react';

export interface ExportChannel {
  id: string;
  label: string;
  enabled: boolean;
}

export interface ExportOptions {
  channels: string[];
  format: 'png' | 'tga' | 'exr';
  resolution: number;
  path?: string;
}

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  /** Available channels to export */
  channels: ExportChannel[];
  
  /** Default format */
  defaultFormat?: 'png' | 'tga' | 'exr';
  
  /** Default resolution */
  defaultResolution?: number;
  
  /** Available resolutions */
  resolutions?: number[];
  
  /** Export handler */
  onExport: (options: ExportOptions) => Promise<void>;
  
  /** Whether export is in progress */
  isExporting?: boolean;
  
  /** Title override */
  title?: string;
}

export function ExportDialog({
  open,
  onOpenChange,
  channels,
  defaultFormat = 'png',
  defaultResolution = 2048,
  resolutions = [512, 1024, 2048, 4096, 8192],
  onExport,
  isExporting = false,
  title = 'Export Textures',
}: ExportDialogProps) {
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(
    new Set(channels.filter(c => c.enabled).map(c => c.id))
  );
  const [format, setFormat] = useState<'png' | 'tga' | 'exr'>(defaultFormat);
  const [resolution, setResolution] = useState(defaultResolution);

  const toggleChannel = (channelId: string) => {
    const newSelected = new Set(selectedChannels);
    if (newSelected.has(channelId)) {
      newSelected.delete(channelId);
    } else {
      newSelected.add(channelId);
    }
    setSelectedChannels(newSelected);
  };

  const selectAll = () => {
    setSelectedChannels(new Set(channels.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedChannels(new Set());
  };

  const handleExport = async () => {
    const options: ExportOptions = {
      channels: Array.from(selectedChannels),
      format,
      resolution,
    };

    await onExport(options);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Channel Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-gray-200">Channels</label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="text-xs"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deselectAll}
                  className="text-xs"
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto border border-zinc-800 rounded-md p-3 bg-zinc-900/50">
              {channels.map((channel) => (
                <div key={channel.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`channel-${channel.id}`}
                    checked={selectedChannels.has(channel.id)}
                    onCheckedChange={() => toggleChannel(channel.id)}
                  />
                  <label
                    htmlFor={`channel-${channel.id}`}
                    className="text-sm text-gray-300 cursor-pointer flex-1"
                  >
                    {channel.label}
                  </label>
                </div>
              ))}
            </div>

            <div className="text-xs text-gray-500 mt-2">
              {selectedChannels.size} of {channels.length} channels selected
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="text-sm font-bold text-gray-200 mb-2 block">Format</label>
            <Select value={format} onValueChange={(v) => setFormat(v as any)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG (8-bit)</SelectItem>
                <SelectItem value="tga">TGA (8-bit)</SelectItem>
                <SelectItem value="exr">EXR (32-bit HDR)</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500 mt-1">
              {format === 'png' && 'Standard format, good compression'}
              {format === 'tga' && 'Uncompressed, fast export'}
              {format === 'exr' && 'High dynamic range, large files'}
            </div>
          </div>

          {/* Resolution Selection */}
          <div>
            <label className="text-sm font-bold text-gray-200 mb-2 block">Resolution</label>
            <Select value={resolution.toString()} onValueChange={(v) => setResolution(parseInt(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resolutions.map((res) => (
                  <SelectItem key={res} value={res.toString()}>
                    {res} × {res}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedChannels.size === 0 || isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

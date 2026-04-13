import React from 'react';
import { FlipHorizontal, Eye, EyeOff } from 'lucide-react';
import { WEBCAM_QUALITY_PRESETS } from '../types';

interface WebcamControlsProps {
  availableDevices: MediaDeviceInfo[];
  currentDeviceId: string;
  currentQuality: string;
  isMirrored: boolean;
  showOverlay: boolean;
  onDeviceChange: (deviceId: string) => void;
  onQualityChange: (quality: string) => void;
  onMirrorToggle: () => void;
  onOverlayToggle: () => void;
}

export const WebcamControls: React.FC<WebcamControlsProps> = ({
  availableDevices,
  currentDeviceId,
  currentQuality,
  isMirrored,
  showOverlay,
  onDeviceChange,
  onQualityChange,
  onMirrorToggle,
  onOverlayToggle,
}) => {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#0a0a0a] border-t border-white/10">
      {/* Camera Selector */}
      <div className="flex-1 min-w-0">
        <select
          value={currentDeviceId}
          onChange={(e) => onDeviceChange(e.target.value)}
          className="w-full px-3 py-1.5 text-xs bg-black/50 border border-white/10 rounded text-gray-300 hover:border-[#00ffcc]/50 focus:border-[#00ffcc] focus:outline-none transition-colors cursor-pointer truncate"
        >
          {availableDevices.length === 0 ? (
            <option value="">No cameras found</option>
          ) : (
            availableDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Quality Selector */}
      <div className="flex gap-1 bg-black/50 rounded p-1">
        {WEBCAM_QUALITY_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onQualityChange(preset.id)}
            className={`px-2.5 py-1 text-xs rounded transition-all ${
              currentQuality === preset.id
                ? 'bg-[#00ffcc] text-black font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Toggle Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onMirrorToggle}
          className={`p-2 rounded transition-all ${
            isMirrored
              ? 'bg-[#00ffcc]/20 text-[#00ffcc]'
              : 'bg-black/50 text-gray-400 hover:text-gray-200'
          }`}
          title="Mirror (M)"
        >
          <FlipHorizontal className="w-4 h-4" />
        </button>
        <button
          onClick={onOverlayToggle}
          className={`p-2 rounded transition-all ${
            showOverlay
              ? 'bg-[#00ffcc]/20 text-[#00ffcc]'
              : 'bg-black/50 text-gray-400 hover:text-gray-200'
          }`}
          title="Tracking Overlay"
        >
          {showOverlay ? (
            <Eye className="w-4 h-4" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};

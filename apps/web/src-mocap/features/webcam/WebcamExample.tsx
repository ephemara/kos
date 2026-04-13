/**
 * WebcamExample - Standalone example showing how to use the webcam system
 * 
 * This demonstrates the complete integration pattern used in ZenMocap.
 */

import React, { useRef } from 'react';
import { WebcamPanel } from './components/WebcamPanel';
import { useWebcamStream } from './hooks/useWebcamStream';
import type { JointFrame } from '@mocap/features/ZenMocap/types';

export const WebcamExample: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const latestFrame = useRef<JointFrame | null>(null);

  const {
    stream,
    isConnecting,
    error,
    availableDevices,
    currentDeviceId,
    currentQuality,
    startStream,
    stopStream,
    changeDevice,
    changeQuality,
  } = useWebcamStream();

  // Start stream when panel opens
  React.useEffect(() => {
    if (isOpen && !stream) {
      startStream();
    } else if (!isOpen && stream) {
      stopStream();
    }
  }, [isOpen, stream, startStream, stopStream]);

  // Simulate mocap frame updates (in real app, this comes from Tauri events)
  React.useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      // Mock frame data - in real app, this comes from AI inference pipeline
      latestFrame.current = {
        frame_id: Date.now(),
        timestamp_ms: Date.now(),
        model_id: 'mock',
        skeleton: [],
        joints: {
          nose: { position: [0.5, 0.3, 0], confidence: 0.9 },
          left_eye: { position: [0.48, 0.28, 0], confidence: 0.85 },
          right_eye: { position: [0.52, 0.28, 0], confidence: 0.85 },
          left_ear: { position: [0.46, 0.29, 0], confidence: 0.8 },
          right_ear: { position: [0.54, 0.29, 0], confidence: 0.8 },
          left_shoulder: { position: [0.42, 0.45, 0], confidence: 0.9 },
          right_shoulder: { position: [0.58, 0.45, 0], confidence: 0.9 },
          left_elbow: { position: [0.38, 0.6, 0], confidence: 0.85 },
          right_elbow: { position: [0.62, 0.6, 0], confidence: 0.85 },
          left_wrist: { position: [0.35, 0.75, 0], confidence: 0.8 },
          right_wrist: { position: [0.65, 0.75, 0], confidence: 0.8 },
          left_hip: { position: [0.45, 0.7, 0], confidence: 0.9 },
          right_hip: { position: [0.55, 0.7, 0], confidence: 0.9 },
          left_knee: { position: [0.44, 0.85, 0], confidence: 0.85 },
          right_knee: { position: [0.56, 0.85, 0], confidence: 0.85 },
          left_ankle: { position: [0.43, 0.98, 0], confidence: 0.8 },
          right_ankle: { position: [0.57, 0.98, 0], confidence: 0.8 },
        },
      };
    }, 33); // ~30fps

    return () => clearInterval(interval);
  }, [isOpen]);

  return (
    <div className="w-screen h-screen bg-[#0a0a0a] flex items-center justify-center">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-3 bg-[#00ffcc] text-black font-bold rounded-lg hover:bg-[#00ddaa] transition-colors"
      >
        {isOpen ? 'Close' : 'Open'} Webcam Preview
      </button>

      {isOpen && (
        <WebcamPanel
          stream={stream}
          isConnecting={isConnecting}
          error={error}
          onClose={() => {
            stopStream();
            setIsOpen(false);
          }}
          onDeviceChange={changeDevice}
          onQualityChange={changeQuality}
          availableDevices={availableDevices}
          currentDeviceId={currentDeviceId}
          currentQuality={currentQuality}
          latestFrameRef={latestFrame}
          showTracking={true}
        />
      )}
    </div>
  );
};

export default WebcamExample;

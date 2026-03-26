/**
 * WebcamWindowApp
 * 
 * Standalone app for the webcam preview window.
 * Listens for camera frames from the backend and displays them.
 */

import React, { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { X, Maximize2, Minimize2, Pin, PinOff } from 'lucide-react';

interface CameraFrame {
  data: number[]; // BGR frame data
  width: number;
  height: number;
  timestamp_ms: number;
}

export const WebcamWindowApp: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [fps, setFps] = useState(0);
  const [resolution, setResolution] = useState({ width: 0, height: 0 });
  const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now() });

  useEffect(() => {
    const window = getCurrentWindow();
    
    // Listen for camera frames from backend
    const unlisten = listen<CameraFrame>('mocap://camera_frame', (event) => {
      const frame = event.payload;
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Update resolution if changed
      if (resolution.width !== frame.width || resolution.height !== frame.height) {
        setResolution({ width: frame.width, height: frame.height });
        canvas.width = frame.width;
        canvas.height = frame.height;
      }

      // Draw frame to canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Convert BGR to RGB and draw
      const imageData = ctx.createImageData(frame.width, frame.height);
      const data = imageData.data;
      
      for (let i = 0; i < frame.data.length; i += 3) {
        const idx = i / 3 * 4;
        data[idx] = frame.data[i + 2];     // R (from B)
        data[idx + 1] = frame.data[i + 1]; // G
        data[idx + 2] = frame.data[i];     // B (from R)
        data[idx + 3] = 255;               // A
      }
      
      ctx.putImageData(imageData, 0, 0);

      // Update FPS counter
      fpsCounterRef.current.frames++;
      const now = Date.now();
      if (now - fpsCounterRef.current.lastTime >= 1000) {
        setFps(fpsCounterRef.current.frames);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastTime = now;
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [resolution]);

  const handleClose = async () => {
    const window = getCurrentWindow();
    await window.close();
  };

  const handleMinimize = async () => {
    const window = getCurrentWindow();
    await window.minimize();
  };

  const handleMaximize = async () => {
    const window = getCurrentWindow();
    const isMaximized = await window.isMaximized();
    if (isMaximized) {
      await window.unmaximize();
    } else {
      await window.maximize();
    }
  };

  const handleTogglePin = async () => {
    const window = getCurrentWindow();
    const newPinned = !isPinned;
    await window.setAlwaysOnTop(newPinned);
    setIsPinned(newPinned);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#060606]">
      {/* Title Bar */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-[#0a0a0a] to-[#060606] border-b border-white/10"
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#00ffcc] animate-pulse" />
          <span className="text-sm font-semibold text-gray-200 tracking-wide">
            WEBCAM PREVIEW
          </span>
          {fps > 0 && (
            <span className="text-xs text-gray-500 font-mono">
              {fps} FPS · {resolution.width}×{resolution.height}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePin}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            title={isPinned ? 'Unpin' : 'Pin on top'}
          >
            {isPinned ? (
              <PinOff className="w-4 h-4 text-gray-400" />
            ) : (
              <Pin className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={handleMinimize}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={handleMaximize}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            title="Maximize"
          >
            <Maximize2 className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center bg-black">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
          style={{ imageRendering: 'auto' }}
        />
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 bg-[#0a0a0a] border-t border-white/10 flex items-center justify-between">
        <span className="text-xs text-gray-500 font-mono">
          Backend-owned camera stream
        </span>
        {fps === 0 && (
          <span className="text-xs text-orange-400 font-mono animate-pulse">
            Waiting for frames...
          </span>
        )}
      </div>
    </div>
  );
};

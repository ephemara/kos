import React, { useState, useEffect, useCallback } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { X, Minimize2, Pin, PinOff } from 'lucide-react';
import { WebcamVideo } from './WebcamVideo';
import { WebcamControls } from './WebcamControls';
import { WebcamStatus } from './WebcamStatus';

interface WebcamPanelProps {
  stream: MediaStream | null;
  isConnecting: boolean;
  error: string | null;
  onClose: () => void;
  onDeviceChange: (deviceId: string) => void;
  onQualityChange: (quality: string) => void;
  availableDevices: MediaDeviceInfo[];
  currentDeviceId: string;
  currentQuality: string;
  latestFrameRef?: React.RefObject<any>;
  showTracking?: boolean;
}

interface PanelState {
  x: number;
  y: number;
  width: number;
  height: number;
  isPinned: boolean;
  isMinimized: boolean;
}

const STORAGE_KEY = 'zenmocap-webcam-panel-state';
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 960;
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;

export const WebcamPanel: React.FC<WebcamPanelProps> = ({
  stream,
  isConnecting,
  error,
  onClose,
  onDeviceChange,
  onQualityChange,
  availableDevices,
  currentDeviceId,
  currentQuality,
  latestFrameRef,
  showTracking = true,
}) => {
  console.log('[WebcamPanel] Rendered with:', { 
    hasStream: !!stream, 
    isConnecting, 
    error, 
    availableDevices: availableDevices.length,
    currentDeviceId,
    currentQuality,
    showTracking 
  });

  const dragControls = useDragControls();
  const [showOverlay, setShowOverlay] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [fps, setFps] = useState(0);
  const [resolution, setResolution] = useState({ width: 0, height: 0 });

  const [panelState, setPanelState] = useState<PanelState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback to defaults
      }
    }
    return {
      x: window.innerWidth - DEFAULT_WIDTH - 40,
      y: 40,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      isPinned: false,
      isMinimized: false,
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panelState));
  }, [panelState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMirrored((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = panelState.width;
    const startHeight = panelState.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + deltaX));
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + deltaY));

      setPanelState((prev) => ({
        ...prev,
        width: newWidth,
        height: newHeight,
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelState.width, panelState.height]);

  const togglePin = () => {
    setPanelState((prev) => ({ ...prev, isPinned: !prev.isPinned }));
  };

  const toggleMinimize = () => {
    setPanelState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }));
  };

  const getStatus = (): 'connecting' | 'live' | 'error' => {
    if (error) return 'error';
    if (isConnecting) return 'connecting';
    return 'live';
  };

  return (
    <motion.div
      drag={!panelState.isPinned && !isResizing}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={{
        left: 0,
        top: 0,
        right: window.innerWidth - panelState.width,
        bottom: window.innerHeight - panelState.height,
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        height: panelState.isMinimized ? 'auto' : panelState.height,
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      onDragEnd={(_, info) => {
        setPanelState((prev) => ({
          ...prev,
          x: prev.x + info.offset.x,
          y: prev.y + info.offset.y,
        }));
      }}
      className="fixed bg-[#060606]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden font-mono"
      style={{
        left: panelState.x,
        top: panelState.y,
        width: panelState.width,
        zIndex: 9999,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0a0a0a] to-[#060606] border-b border-white/10 cursor-move"
        onPointerDown={(e) => !panelState.isPinned && dragControls.start(e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#00ffcc] animate-pulse" />
          <span className="text-sm font-semibold text-gray-200 tracking-wide">
            WEBCAM FEED
          </span>
          <WebcamStatus status={getStatus()} fps={fps} resolution={resolution} />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={togglePin}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            title={panelState.isPinned ? 'Unpin' : 'Pin'}
          >
            {panelState.isPinned ? (
              <PinOff className="w-4 h-4 text-gray-400" />
            ) : (
              <Pin className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={toggleMinimize}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* Video Area */}
      {!panelState.isMinimized && (
        <>
          <div className="relative bg-black">
            <WebcamVideo
              stream={stream}
              isMirrored={isMirrored}
              showOverlay={showOverlay && showTracking}
              isConnecting={isConnecting}
              error={error}
              onFpsUpdate={setFps}
              onResolutionUpdate={setResolution}
              latestFrameRef={latestFrameRef}
            />
          </div>

          {/* Controls */}
          <WebcamControls
            availableDevices={availableDevices}
            currentDeviceId={currentDeviceId}
            currentQuality={currentQuality}
            isMirrored={isMirrored}
            showOverlay={showOverlay}
            onDeviceChange={onDeviceChange}
            onQualityChange={onQualityChange}
            onMirrorToggle={() => setIsMirrored((prev) => !prev)}
            onOverlayToggle={() => setShowOverlay((prev) => !prev)}
          />

          {/* Resize Handle */}
          <div
            className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize group"
            onMouseDown={handleResize}
          >
            <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-white/20 group-hover:border-[#00ffcc]/50 transition-colors" />
          </div>
        </>
      )}
    </motion.div>
  );
};

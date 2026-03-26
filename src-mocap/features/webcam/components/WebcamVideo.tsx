import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { JointFrame } from '@mocap/features/ZenMocap/types';
import { TrackingOverlay } from './TrackingOverlay';

interface WebcamVideoProps {
  stream: MediaStream | null;
  isMirrored: boolean;
  showOverlay: boolean;
  isConnecting: boolean;
  error: string | null;
  onFpsUpdate: (fps: number) => void;
  onResolutionUpdate: (resolution: { width: number; height: number }) => void;
  latestFrameRef?: React.RefObject<JointFrame | null>;
  showTracking?: boolean;
}

export const WebcamVideo: React.FC<WebcamVideoProps> = ({
  stream,
  isMirrored,
  showOverlay,
  isConnecting,
  error,
  onFpsUpdate,
  onResolutionUpdate,
  latestFrameRef,
  showTracking = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) {
      setIsVideoReady(false);
      return;
    }

    video.srcObject = stream;
    video.play().catch((err) => {
      console.error('Failed to play video:', err);
    });

    const handleLoadedMetadata = () => {
      setIsVideoReady(true);
      onResolutionUpdate({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.srcObject = null;
    };
  }, [stream, onResolutionUpdate]);

  useEffect(() => {
    if (!isVideoReady || !showOverlay) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const fpsCounter = fpsCounterRef.current;

    const drawFrame = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (showOverlay) {
          ctx.strokeStyle = '#00ffcc';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);

          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;

          ctx.beginPath();
          ctx.moveTo(centerX, 0);
          ctx.lineTo(centerX, canvas.height);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(0, centerY);
          ctx.lineTo(canvas.width, centerY);
          ctx.stroke();

          const circleRadius = Math.min(canvas.width, canvas.height) * 0.4;
          ctx.beginPath();
          ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
          ctx.stroke();
        }

        fpsCounter.frames++;
        const now = performance.now();
        if (now - fpsCounter.lastTime >= 1000) {
          onFpsUpdate(fpsCounter.frames);
          fpsCounter.frames = 0;
          fpsCounter.lastTime = now;
        }
      }

      animationFrameId = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isVideoReady, showOverlay, onFpsUpdate]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px] bg-black">
        <div className="text-center px-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <X className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-red-400 font-semibold mb-2">Camera Error</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (isConnecting || !stream) {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px] bg-black">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-[#00ffcc] animate-spin" />
          <p className="text-gray-400 text-sm">Connecting to camera...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
        style={{
          transform: isMirrored ? 'scaleX(-1)' : 'none',
        }}
      />
      {showOverlay && !showTracking && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            transform: isMirrored ? 'scaleX(-1)' : 'none',
          }}
        />
      )}
      {showTracking && latestFrameRef && (
        <TrackingOverlay
          latestFrameRef={latestFrameRef}
          enabled={showOverlay}
          showLegend={true}
          showFPS={true}
          style={{
            transform: isMirrored ? 'scaleX(-1)' : 'none',
          }}
        />
      )}
      {!isVideoReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="w-8 h-8 text-[#00ffcc] animate-spin" />
        </div>
      )}
    </div>
  );
};

const X: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

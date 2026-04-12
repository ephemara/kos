/**
 * Webcam Tracking Integration Example
 * 
 * Demonstrates how to integrate the webcam panel with ZenMocap's
 * real-time skeleton tracking pipeline.
 */

import React, { useRef, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { WebcamPanel, TrackingOverlay } from '@mocap/features/webcam';
import { useWebcamStream } from '@mocap/features/webcam/hooks/useWebcamStream';
import { JointFrame, RawJointFrame, normalizeJointFrame } from '@mocap/features/ZenMocap/types';

export function WebcamTrackingExample() {
  // Zero-copy frame storage (no React re-renders)
  const latestFrameRef = useRef<JointFrame | null>(null);

  // Webcam stream management
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

  // Listen for mocap frames from Rust backend
  useEffect(() => {
    const unlisten = listen<RawJointFrame>('mocap-frame', (event) => {
      // Normalize wire format to named-map format
      const frame = normalizeJointFrame(event.payload);
      
      // Update ref (zero-copy, no re-render)
      latestFrameRef.current = frame;
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Auto-start webcam on mount
  useEffect(() => {
    startStream();
    return () => stopStream();
  }, []);

  return (
    <WebcamPanel
      stream={stream}
      isConnecting={isConnecting}
      error={error}
      onClose={stopStream}
      onDeviceChange={changeDevice}
      onQualityChange={changeQuality}
      availableDevices={availableDevices}
      currentDeviceId={currentDeviceId}
      currentQuality={currentQuality}
      latestFrameRef={latestFrameRef}
      showTracking={true}
    />
  );
}

/**
 * Minimal Example - Just the overlay
 */
export function MinimalTrackingOverlay() {
  const latestFrameRef = useRef<JointFrame | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const unlisten = listen<RawJointFrame>('mocap-frame', (event) => {
      latestFrameRef.current = normalizeJointFrame(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video ref={videoRef} autoPlay playsInline muted />
      <TrackingOverlay
        latestFrameRef={latestFrameRef}
        enabled={true}
        showLegend={true}
        showFPS={true}
      />
    </div>
  );
}

/**
 * Custom Rendering Example
 */
export function CustomSkeletonRenderer() {
  const latestFrameRef = useRef<JointFrame | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const unlisten = listen<RawJointFrame>('mocap-frame', (event) => {
      latestFrameRef.current = normalizeJointFrame(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const frame = latestFrameRef.current;
      if (!frame) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Custom rendering logic
      const nose = frame.joints['nose'];
      const leftWrist = frame.joints['left_wrist'];
      const rightWrist = frame.joints['right_wrist'];

      // Draw face marker
      if (nose && nose.confidence > 0.5) {
        const x = nose.position[0] * canvas.width;
        const y = nose.position[1] * canvas.height;
        
        ctx.fillStyle = '#00ffcc';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw hand trails
      if (leftWrist && leftWrist.confidence > 0.5) {
        const x = leftWrist.position[0] * canvas.width;
        const y = leftWrist.position[1] * canvas.height;
        
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (rightWrist && rightWrist.confidence > 0.5) {
        const x = rightWrist.position[0] * canvas.width;
        const y = rightWrist.position[1] * canvas.height;
        
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={480}
      style={{ border: '1px solid #00ffcc' }}
    />
  );
}

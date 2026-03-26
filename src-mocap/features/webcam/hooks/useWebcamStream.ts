/**
 * useWebcamStream Hook
 * Manages MediaStream lifecycle with automatic cleanup and error handling
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { StreamQuality } from '../types';

interface UseWebcamStreamResult {
  stream: MediaStream | null;
  isConnecting: boolean;
  error: string | null;
  availableDevices: MediaDeviceInfo[];
  currentDeviceId: string;
  currentQuality: StreamQuality;
  startStream: (deviceId?: string, quality?: StreamQuality) => Promise<void>;
  stopStream: () => void;
  changeDevice: (deviceId: string) => Promise<void>;
  changeQuality: (quality: StreamQuality) => Promise<void>;
}

export function useWebcamStream(): UseWebcamStreamResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [currentQuality, setCurrentQuality] = useState<StreamQuality>('720p');
  
  const streamRef = useRef<MediaStream | null>(null);

  // Enumerate devices
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setAvailableDevices(videoDevices);
      
      // Set default device if not set
      if (!currentDeviceId && videoDevices.length > 0) {
        setCurrentDeviceId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  }, [currentDeviceId]);

  // Enumerate devices on mount
  useEffect(() => {
    enumerateDevices();
  }, [enumerateDevices]);

  const startStream = useCallback(async (deviceId?: string, quality: StreamQuality = '720p') => {
    try {
      setIsConnecting(true);
      setError(null);

      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setStream(null);
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser');
      }

      // Get quality constraints
      const qualityMap: Record<StreamQuality, { width: number; height: number }> = {
        '480p': { width: 640, height: 480 },
        '720p': { width: 1280, height: 720 },
        '1080p': { width: 1920, height: 1080 },
      };

      const constraints = qualityMap[quality];

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: constraints.width },
          height: { ideal: constraints.height },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setCurrentQuality(quality);
      if (deviceId) {
        setCurrentDeviceId(deviceId);
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to start webcam stream';
      setError(message);
      console.error('Failed to start stream:', err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  const changeDevice = useCallback(async (deviceId: string) => {
    await startStream(deviceId, currentQuality);
  }, [currentQuality, startStream]);

  const changeQuality = useCallback(async (quality: StreamQuality) => {
    await startStream(currentDeviceId, quality);
  }, [currentDeviceId, startStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
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
  };
}

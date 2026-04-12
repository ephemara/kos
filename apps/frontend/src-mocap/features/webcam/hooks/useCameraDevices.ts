/**
 * useCameraDevices Hook
 * Enumerates and manages camera device selection with auto-refresh
 */

import { useState, useEffect, useCallback } from 'react';
import { CameraDevice, WebcamError, WebcamErrorCode } from '../types';

interface UseCameraDevicesResult {
  devices: CameraDevice[];
  selectedDevice: CameraDevice | null;
  isLoading: boolean;
  error: WebcamError | null;
  selectDevice: (deviceId: string) => void;
  refreshDevices: () => Promise<void>;
}

export function useCameraDevices(): UseCameraDevicesResult {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<CameraDevice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<WebcamError | null>(null);

  const enumerateDevices = useCallback(async (): Promise<CameraDevice[]> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new Error('MediaDevices API not supported');
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      
      const videoDevices = allDevices
        .filter((device): device is MediaDeviceInfo & { kind: 'videoinput' } => 
          device.kind === 'videoinput'
        )
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
          groupId: device.groupId,
          kind: 'videoinput' as const,
        }));

      return videoDevices;
    } catch (err) {
      throw {
        code: WebcamErrorCode.UNKNOWN,
        message: `Failed to enumerate devices: ${(err as Error).message}`,
        originalError: err as Error,
      } as WebcamError;
    }
  }, []);

  const refreshDevices = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const hasPermission = await checkCameraPermission();
      
      if (!hasPermission) {
        try {
          await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (permErr) {
          throw {
            code: WebcamErrorCode.PERMISSION_DENIED,
            message: 'Camera permission required to list devices. Please allow camera access.',
            originalError: permErr as Error,
          } as WebcamError;
        }
      }

      const videoDevices = await enumerateDevices();

      if (videoDevices.length === 0) {
        throw {
          code: WebcamErrorCode.NO_DEVICES,
          message: 'No camera devices found. Please connect a camera.',
        } as WebcamError;
      }

      setDevices(videoDevices);

      if (!selectedDevice || !videoDevices.find(d => d.deviceId === selectedDevice.deviceId)) {
        setSelectedDevice(videoDevices[0]);
      }

    } catch (err) {
      const webcamError = err as WebcamError;
      setError(webcamError);
      setDevices([]);
      setSelectedDevice(null);
    } finally {
      setIsLoading(false);
    }
  }, [enumerateDevices, selectedDevice]);

  const selectDevice = useCallback((deviceId: string) => {
    const device = devices.find(d => d.deviceId === deviceId);
    if (device) {
      setSelectedDevice(device);
    }
  }, [devices]);

  useEffect(() => {
    refreshDevices();
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices) return;

    const handleDeviceChange = () => {
      refreshDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [refreshDevices]);

  return {
    devices,
    selectedDevice,
    isLoading,
    error,
    selectDevice,
    refreshDevices,
  };
}

async function checkCameraPermission(): Promise<boolean> {
  if (!navigator.permissions || !navigator.permissions.query) {
    return false;
  }

  try {
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return result.state === 'granted';
  } catch {
    return false;
  }
}

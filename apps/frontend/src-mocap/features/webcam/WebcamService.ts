/**
 * WebcamService
 * Singleton service for managing webcam operations and stream lifecycle
 */

import {
  CameraDevice,
  WebcamConfig,
  WebcamError,
  WebcamErrorCode,
  StreamQuality,
  WEBCAM_QUALITY_PRESETS,
} from './types';

class WebcamService {
  private static instance: WebcamService;
  private currentStream: MediaStream | null = null;
  private currentConfig: WebcamConfig | null = null;
  private streamListeners: Set<(stream: MediaStream | null) => void> = new Set();

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.stopStream();
      });
    }
  }

  public static getInstance(): WebcamService {
    if (!WebcamService.instance) {
      WebcamService.instance = new WebcamService();
    }
    return WebcamService.instance;
  }

  public async getCameras(): Promise<CameraDevice[]> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw this.createError(
          WebcamErrorCode.UNKNOWN,
          'MediaDevices API not supported in this browser'
        );
      }

      const hasPermission = await this.checkPermission();
      
      if (!hasPermission) {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(track => track.stop());
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

      if (videoDevices.length === 0) {
        throw this.createError(
          WebcamErrorCode.NO_DEVICES,
          'No camera devices found'
        );
      }

      return videoDevices;
    } catch (err) {
      if ((err as WebcamError).code) {
        throw err;
      }
      throw this.parseMediaError(err as Error);
    }
  }

  public async startStream(
    deviceId?: string,
    quality: StreamQuality = '720p'
  ): Promise<MediaStream> {
    try {
      this.stopStream();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw this.createError(
          WebcamErrorCode.UNKNOWN,
          'getUserMedia not supported in this browser'
        );
      }

      const preset = WEBCAM_QUALITY_PRESETS.find(p => p.id === quality);
      if (!preset) {
        throw new Error(`Invalid quality preset: ${quality}`);
      }
      
      const mediaConstraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: preset.width },
          height: { ideal: preset.height },
          frameRate: { ideal: 30 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      
      this.currentStream = stream;
      this.currentConfig = { deviceId, quality };
      
      this.setupStreamMonitoring(stream);
      this.notifyListeners(stream);

      return stream;
    } catch (err) {
      this.currentStream = null;
      this.currentConfig = null;
      throw this.parseMediaError(err as Error);
    }
  }

  public stopStream(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => {
        track.stop();
      });
      this.currentStream = null;
      this.currentConfig = null;
      this.notifyListeners(null);
    }
  }

  public getCurrentStream(): MediaStream | null {
    return this.currentStream;
  }

  public getCurrentConfig(): WebcamConfig | null {
    return this.currentConfig;
  }

  public isStreaming(): boolean {
    return this.currentStream !== null && 
           this.currentStream.active &&
           this.currentStream.getTracks().some(track => track.readyState === 'live');
  }

  public onStreamChange(callback: (stream: MediaStream | null) => void): () => void {
    this.streamListeners.add(callback);
    
    return () => {
      this.streamListeners.delete(callback);
    };
  }

  public async getStreamCapabilities(): Promise<MediaTrackCapabilities | null> {
    if (!this.currentStream) return null;

    const videoTrack = this.currentStream.getVideoTracks()[0];
    if (!videoTrack || !videoTrack.getCapabilities) return null;

    return videoTrack.getCapabilities();
  }

  public async getStreamSettings(): Promise<MediaTrackSettings | null> {
    if (!this.currentStream) return null;

    const videoTrack = this.currentStream.getVideoTracks()[0];
    if (!videoTrack) return null;

    return videoTrack.getSettings();
  }

  private setupStreamMonitoring(stream: MediaStream): void {
    const tracks = stream.getTracks();
    
    tracks.forEach(track => {
      track.addEventListener('ended', () => {
        this.handleStreamEnded();
      });

      track.addEventListener('mute', () => {
        console.warn('Camera track muted');
      });

      track.addEventListener('unmute', () => {
        console.log('Camera track unmuted');
      });
    });
  }

  private handleStreamEnded(): void {
    console.warn('Camera stream ended unexpectedly');
    this.currentStream = null;
    this.currentConfig = null;
    this.notifyListeners(null);
  }

  private notifyListeners(stream: MediaStream | null): void {
    this.streamListeners.forEach(listener => {
      try {
        listener(stream);
      } catch (err) {
        console.error('Error in stream listener:', err);
      }
    });
  }

  private async checkPermission(): Promise<boolean> {
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

  private parseMediaError(err: Error): WebcamError {
    const name = err.name;
    
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return this.createError(
        WebcamErrorCode.PERMISSION_DENIED,
        'Camera permission denied',
        err
      );
    }
    
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return this.createError(
        WebcamErrorCode.NOT_FOUND,
        'Camera device not found',
        err
      );
    }
    
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return this.createError(
        WebcamErrorCode.DEVICE_BUSY,
        'Camera is already in use',
        err
      );
    }
    
    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
      return this.createError(
        WebcamErrorCode.OVERCONSTRAINED,
        'Camera does not support requested settings',
        err
      );
    }
    
    return this.createError(
      WebcamErrorCode.UNKNOWN,
      `Camera error: ${err.message}`,
      err
    );
  }

  private createError(
    code: WebcamErrorCode,
    message: string,
    originalError?: Error
  ): WebcamError {
    return {
      code,
      message,
      originalError,
    };
  }
}

export const webcamService = WebcamService.getInstance();

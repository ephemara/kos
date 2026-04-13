/**
 * Webcam UI Component Types
 * Shared interfaces for the webcam panel system
 */

export interface CameraDevice {
  deviceId: string;
  label: string;
  kind: 'videoinput';
}

export type StreamQuality = '480p' | '720p' | '1080p';

export interface WebcamConfig {
  deviceId?: string;
  quality: StreamQuality;
  mirror?: boolean;
  facingMode?: 'user' | 'environment';
  frameRate?: number;
}

export enum WebcamErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  NO_DEVICES = 'NO_DEVICES',
  NOT_FOUND = 'NOT_FOUND',
  DEVICE_BUSY = 'DEVICE_BUSY',
  OVERCONSTRAINED = 'OVERCONSTRAINED',
  NOT_READABLE = 'NOT_READABLE',
  STREAM_FAILED = 'STREAM_FAILED',
  UNKNOWN = 'UNKNOWN',
}

export interface WebcamError {
  code: WebcamErrorCode;
  message: string;
  originalError?: Error;
}

export interface WebcamState {
  stream: MediaStream | null;
  isConnecting: boolean;
  error: WebcamError | null;
  config: WebcamConfig;
}

export interface WebcamPanelState {
  x: number;
  y: number;
  width: number;
  height: number;
  isPinned: boolean;
  isMinimized: boolean;
}

export interface WebcamQualityPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface WebcamResolution {
  width: number;
  height: number;
}

export type WebcamStatus = 'connecting' | 'live' | 'error';

export interface WebcamMetrics {
  fps: number;
  resolution: WebcamResolution;
  latency?: number;
}

export const WEBCAM_QUALITY_PRESETS: WebcamQualityPreset[] = [
  { id: '480p', label: '480p', width: 640, height: 480 },
  { id: '720p', label: '720p', width: 1280, height: 720 },
  { id: '1080p', label: '1080p', width: 1920, height: 1080 },
];

export const WEBCAM_CONSTRAINTS = {
  MIN_WIDTH: 320,
  MIN_HEIGHT: 240,
  MAX_WIDTH: 1280,
  MAX_HEIGHT: 960,
  DEFAULT_WIDTH: 640,
  DEFAULT_HEIGHT: 480,
} as const;

export const WEBCAM_STORAGE_KEY = 'zenmocap-webcam-panel-state';
export const WEBCAM_Z_INDEX = 9999;

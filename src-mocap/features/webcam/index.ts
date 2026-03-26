/**
 * Webcam Feature Module
 * 
 * Exports webcam panel components, hooks, and utilities for
 * real-time skeleton tracking visualization.
 */

// Main components
export * from './components';
export { WebcamPanel } from './components/WebcamPanel';
export { TrackingOverlay } from './components/TrackingOverlay';

// Hooks
export { useTrackingRenderer } from './hooks/useTrackingRenderer';
export { useWebcamStream } from './hooks/useWebcamStream';
export { useCameraDevices } from './hooks/useCameraDevices';

// Utilities
export * from './utils/skeletonRenderer';

// Types (excluding WebcamStatus to avoid conflict with component)
export type {
  WebcamPanelState,
  WebcamQualityPreset,
  WebcamResolution,
  WebcamMetrics,
  CameraDevice,
  StreamQuality,
  WebcamConfig,
  WebcamError,
  WebcamState,
} from './types';
export { WebcamErrorCode, WEBCAM_QUALITY_PRESETS, WEBCAM_CONSTRAINTS, WEBCAM_STORAGE_KEY, WEBCAM_Z_INDEX } from './types';

// Service
export { webcamService } from './WebcamService';

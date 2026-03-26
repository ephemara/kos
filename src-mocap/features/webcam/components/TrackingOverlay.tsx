/**
 * Tracking Overlay Component
 * 
 * Canvas overlay for rendering skeleton tracking visualization.
 * Positioned absolutely over video element with matching dimensions.
 * Renders at 60fps using requestAnimationFrame with zero-copy frame data.
 */

import React from 'react';
import { JointFrame } from '@mocap/features/ZenMocap/types';
import { useTrackingRenderer, type UseTrackingRendererOptions } from '../hooks/useTrackingRenderer';

export interface TrackingOverlayProps {
  latestFrameRef: React.RefObject<JointFrame | null>;
  enabled?: boolean;
  showLegend?: boolean;
  showFPS?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Canvas overlay for skeleton tracking visualization
 * 
 * Renders COCO 17-keypoint skeleton with confidence-based coloring:
 * - Cyan (#00ffcc): High confidence (>0.7)
 * - Yellow (#ffcc00): Medium confidence (0.4-0.7)
 * - Red (#ff4444): Low confidence (<0.4)
 * 
 * @example
 * ```tsx
 * const latestFrame = useRef<JointFrame | null>(null);
 * 
 * <div style={{ position: 'relative' }}>
 *   <video ref={videoRef} />
 *   <TrackingOverlay latestFrameRef={latestFrame} />
 * </div>
 * ```
 */
export const TrackingOverlay: React.FC<TrackingOverlayProps> = ({
  latestFrameRef,
  enabled = true,
  showLegend = true,
  showFPS = true,
  className = '',
  style = {},
}) => {
  const options: UseTrackingRendererOptions = {
    enabled,
    showLegend,
    showFPS,
  };

  const { canvasRef } = useTrackingRenderer(latestFrameRef, options);

  return (
    <canvas
      ref={canvasRef}
      className={`tracking-overlay ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
        ...style,
      }}
      aria-label="Skeleton tracking overlay"
    />
  );
};

export default TrackingOverlay;

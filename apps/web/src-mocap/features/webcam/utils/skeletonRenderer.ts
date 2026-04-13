/**
 * Skeleton Renderer Utilities
 * 
 * Pure functions for drawing COCO 17-keypoint skeletons on canvas.
 * Optimized for 60fps rendering with confidence-based styling.
 */

import { Joint } from '@mocap/features/ZenMocap/types';

export interface SkeletonRenderConfig {
  jointRadius: number;
  boneWidth: number;
  minConfidence: number;
  highConfidenceThreshold: number;
  mediumConfidenceThreshold: number;
}

export const DEFAULT_RENDER_CONFIG: SkeletonRenderConfig = {
  jointRadius: 4,
  boneWidth: 2.5,
  minConfidence: 0.3,
  highConfidenceThreshold: 0.7,
  mediumConfidenceThreshold: 0.4,
};

/**
 * Get color based on confidence level
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return '#00ffcc'; // Cyan - high confidence
  if (confidence >= 0.4) return '#ffcc00'; // Yellow - medium confidence
  return '#ff4444'; // Red - low confidence
}

/**
 * Get opacity based on confidence level
 */
export function getConfidenceOpacity(confidence: number): number {
  return Math.max(0.3, Math.min(1.0, confidence));
}

/**
 * Draw a single joint as a circle
 */
export function drawJoint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  confidence: number,
  radius: number = DEFAULT_RENDER_CONFIG.jointRadius
): void {
  const color = getConfidenceColor(confidence);
  const opacity = getConfidenceOpacity(confidence);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a bone (line between two joints)
 */
export function drawBone(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  confidence: number,
  width: number = DEFAULT_RENDER_CONFIG.boneWidth
): void {
  const color = getConfidenceColor(confidence);
  const opacity = getConfidenceOpacity(confidence);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Map normalized coordinates [0,1] to canvas pixels
 */
export function normalizedToCanvas(
  normalizedX: number,
  normalizedY: number,
  canvasWidth: number,
  canvasHeight: number
): [number, number] {
  return [
    normalizedX * canvasWidth,
    normalizedY * canvasHeight
  ];
}

/**
 * Draw complete skeleton with bones and joints
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  joints: Record<string, Joint>,
  bones: [string, string][],
  canvasWidth: number,
  canvasHeight: number,
  config: SkeletonRenderConfig = DEFAULT_RENDER_CONFIG
): void {
  // Clear canvas with transparency
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Enable anti-aliasing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw bones first (so joints appear on top)
  for (const [joint1Name, joint2Name] of bones) {
    const joint1 = joints[joint1Name];
    const joint2 = joints[joint2Name];

    if (!joint1 || !joint2) continue;

    // Filter by minimum confidence
    if (joint1.confidence < config.minConfidence || joint2.confidence < config.minConfidence) {
      continue;
    }

    // Map normalized coordinates to canvas pixels
    const [x1, y1] = normalizedToCanvas(
      joint1.position[0],
      joint1.position[1],
      canvasWidth,
      canvasHeight
    );
    const [x2, y2] = normalizedToCanvas(
      joint2.position[0],
      joint2.position[1],
      canvasWidth,
      canvasHeight
    );

    // Use average confidence for bone color
    const avgConfidence = (joint1.confidence + joint2.confidence) / 2;
    drawBone(ctx, x1, y1, x2, y2, avgConfidence, config.boneWidth);
  }

  // Draw joints on top
  for (const [jointName, joint] of Object.entries(joints)) {
    if (joint.confidence < config.minConfidence) continue;

    const [x, y] = normalizedToCanvas(
      joint.position[0],
      joint.position[1],
      canvasWidth,
      canvasHeight
    );

    drawJoint(ctx, x, y, joint.confidence, config.jointRadius);
  }
}

/**
 * Draw confidence legend in corner
 */
export function drawConfidenceLegend(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): void {
  const fontSize = 12;
  const lineHeight = 18;
  const dotRadius = 4;
  const dotOffset = 10;

  ctx.save();
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'middle';

  const legend = [
    { label: 'High', color: '#00ffcc', confidence: 0.9 },
    { label: 'Medium', color: '#ffcc00', confidence: 0.5 },
    { label: 'Low', color: '#ff4444', confidence: 0.3 },
  ];

  legend.forEach((item, i) => {
    const yPos = y + i * lineHeight;

    // Draw dot
    ctx.fillStyle = item.color;
    ctx.globalAlpha = getConfidenceOpacity(item.confidence);
    ctx.beginPath();
    ctx.arc(x + dotOffset, yPos, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw label
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(item.label, x + dotOffset + 12, yPos);
  });

  ctx.restore();
}

/**
 * Draw FPS counter
 */
export function drawFPS(
  ctx: CanvasRenderingContext2D,
  fps: number,
  x: number,
  y: number
): void {
  ctx.save();
  ctx.font = '14px monospace';
  ctx.fillStyle = '#00ffcc';
  ctx.globalAlpha = 0.9;
  ctx.textAlign = 'right';
  ctx.fillText(`${fps.toFixed(1)} FPS`, x, y);
  ctx.restore();
}

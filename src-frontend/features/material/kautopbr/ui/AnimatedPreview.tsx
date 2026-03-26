import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimationTimeline } from './AnimationTimeline';
import { PreviewViewport, type PBRMaterialProps } from './PreviewViewport';
import { autoPBRClient } from '@/services/autoPBRClient';
import type { AnimationData, Keyframe, InterpolationType, LoopMode } from '../types';

export interface AnimatedPreviewProps {
  /** Material ID to animate */
  materialId?: string;
  /** Animation data */
  animationData?: AnimationData;
  /** Base material properties (non-animated values) */
  baseMaterialProps?: PBRMaterialProps;
  /** Callback when animation data changes */
  onAnimationChange?: (animation: AnimationData) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AnimatedPreview Component
 * 
 * Integrates AnimationTimeline with PreviewViewport to provide real-time
 * animated material preview. Updates material parameters at 60fps during
 * playback and supports real-time scrubbing.
 * 
 * Requirements: 5.5, 5.7
 */
export function AnimatedPreview({
  materialId,
  animationData,
  baseMaterialProps = {},
  onAnimationChange,
  className,
}: AnimatedPreviewProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animatedProps, setAnimatedProps] = useState<Partial<PBRMaterialProps>>({});
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState<number | null>(null);
  
  // Track last evaluation time to avoid redundant calls
  const lastEvaluationTime = useRef<number>(-1);
  const evaluationInProgress = useRef(false);

  // Evaluate animation at current time and update material properties
  const evaluateAndUpdate = useCallback(async (time: number) => {
    if (!materialId || !animationData) return;
    
    // Avoid redundant evaluations for the same time
    if (Math.abs(time - lastEvaluationTime.current) < 0.001) return;
    
    // Prevent concurrent evaluations
    if (evaluationInProgress.current) return;
    
    evaluationInProgress.current = true;
    lastEvaluationTime.current = time;
    
    try {
      const startTime = performance.now();
      
      // Call backend to evaluate animation at this time
      const parameterValues = await autoPBRClient.evaluateAnimation(materialId, time);
      
      // Measure latency for requirement 5.7 (real-time scrubbing)
      const latency = performance.now() - startTime;
      if (latency > 33) {
        console.warn(`Animation evaluation latency: ${latency.toFixed(2)}ms (exceeds 33ms for 30fps)`);
      }
      
      // Convert parameter values to PBRMaterialProps
      const props: Partial<PBRMaterialProps> = {};
      
      // Handle color parameters (RGB channels)
      if ('albedoRed' in parameterValues || 'albedoGreen' in parameterValues || 'albedoBlue' in parameterValues) {
        const r = parameterValues.albedoRed ?? 1.0;
        const g = parameterValues.albedoGreen ?? 1.0;
        const b = parameterValues.albedoBlue ?? 1.0;
        props.albedoColor = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
      }
      
      // Handle scalar parameters
      if ('roughness' in parameterValues) {
        props.roughnessValue = parameterValues.roughness;
      }
      if ('metallic' in parameterValues) {
        props.metallicValue = parameterValues.metallic;
      }
      if ('emissiveIntensity' in parameterValues) {
        props.emissiveIntensity = parameterValues.emissiveIntensity;
      }
      if ('normalStrength' in parameterValues) {
        props.normalStrength = parameterValues.normalStrength;
      }
      
      // Handle emissive color
      if ('emissiveColor' in parameterValues) {
        // Assuming emissiveColor is a single value (grayscale) or we need separate RGB channels
        const intensity = parameterValues.emissiveColor;
        props.emissiveColor = `rgb(${Math.round(intensity * 255)}, ${Math.round(intensity * 255)}, ${Math.round(intensity * 255)})`;
      }
      
      setAnimatedProps(props);
    } catch (error) {
      console.error('Failed to evaluate animation:', error);
    } finally {
      evaluationInProgress.current = false;
    }
  }, [materialId, animationData]);

  // Update preview when time changes (scrubbing or playback)
  useEffect(() => {
    evaluateAndUpdate(currentTime);
  }, [currentTime, evaluateAndUpdate]);

  // Handle time change from timeline (scrubbing or playback)
  const handleTimeChange = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Handle play state change
  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  // Handle stop (reset to 0)
  const handleStop = useCallback(() => {
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  // Handle loop mode change
  const handleLoopModeChange = useCallback((mode: LoopMode) => {
    if (animationData && onAnimationChange) {
      onAnimationChange({
        ...animationData,
        loopMode: mode,
      });
    }
  }, [animationData, onAnimationChange]);

  // Handle keyframe operations
  const handleKeyframeAdd = useCallback((time: number) => {
    // TODO: Implement keyframe addition
    console.log('Add keyframe at time:', time);
  }, []);

  const handleKeyframeMove = useCallback((index: number, newTime: number) => {
    // TODO: Implement keyframe movement
    console.log('Move keyframe', index, 'to time:', newTime);
  }, []);

  const handleKeyframeSelect = useCallback((index: number | null) => {
    setSelectedKeyframeIndex(index);
  }, []);

  const handleKeyframeDelete = useCallback((index: number) => {
    // TODO: Implement keyframe deletion
    console.log('Delete keyframe:', index);
  }, []);

  const handleInterpolationChange = useCallback((interpolationType: InterpolationType) => {
    // TODO: Implement interpolation type change
    console.log('Change interpolation to:', interpolationType);
  }, []);

  // Merge base props with animated props (animated props override base)
  const mergedMaterialProps: PBRMaterialProps = {
    ...baseMaterialProps,
    ...animatedProps,
  };

  // Extract keyframes from animation data for timeline display
  // For now, we'll extract from the first track (TODO: support multiple tracks)
  const keyframes: Keyframe[] = [];
  let interpolationType: InterpolationType = 'Linear';
  
  if (animationData && animationData.tracks.length > 0) {
    const firstTrack = animationData.tracks[0];
    // Check if it's a keyframe animation (discriminated union)
    if ('Keyframe' in firstTrack.animationType) {
      const keyframeAnim = firstTrack.animationType.Keyframe;
      keyframes.push(...keyframeAnim.keyframes);
      interpolationType = keyframeAnim.interpolation;
    }
  }

  return (
    <div className={className}>
      {/* Preview Viewport */}
      <div className="h-[calc(100%-120px)] w-full">
        <PreviewViewport
          materialProps={mergedMaterialProps}
        />
      </div>

      {/* Animation Timeline */}
      <div className="h-[120px] w-full">
        <AnimationTimeline
          currentTime={currentTime}
          duration={animationData?.duration ?? 10}
          isPlaying={isPlaying}
          loopMode={animationData?.loopMode ?? 'Loop'}
          keyframes={keyframes}
          selectedKeyframeIndex={selectedKeyframeIndex}
          interpolationType={interpolationType}
          onTimeChange={handleTimeChange}
          onPlayStateChange={handlePlayStateChange}
          onStop={handleStop}
          onLoopModeChange={handleLoopModeChange}
          onKeyframeAdd={handleKeyframeAdd}
          onKeyframeMove={handleKeyframeMove}
          onKeyframeSelect={handleKeyframeSelect}
          onKeyframeDelete={handleKeyframeDelete}
          onInterpolationChange={handleInterpolationChange}
        />
      </div>
    </div>
  );
}

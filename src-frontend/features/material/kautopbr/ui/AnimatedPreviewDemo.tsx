import { useState } from 'react';
import { AnimatedPreview } from './AnimatedPreview';
import type { AnimationData, PBRMaterialProps } from '../types';

/**
 * AnimatedPreviewDemo Component
 * 
 * Demonstrates the integration of AnimationTimeline with PreviewViewport.
 * Shows real-time material parameter animation at 60fps with scrubbing support.
 * 
 * This demo creates a pulsing emissive material that animates between
 * low and high emissive intensity using keyframe interpolation.
 */
export function AnimatedPreviewDemo() {
  // Create sample animation data: pulsing emissive intensity
  const [animationData] = useState<AnimationData>({
    duration: 5.0,
    loopMode: 'Loop',
    tracks: [
      {
        parameter: 'EmissiveIntensity',
        animationType: {
          Keyframe: {
            keyframes: [
              { time: 0.0, value: 0.0 },
              { time: 1.25, value: 2.0 },
              { time: 2.5, value: 0.0 },
              { time: 3.75, value: 2.0 },
              { time: 5.0, value: 0.0 },
            ],
            interpolation: 'EaseInOut',
          },
        },
      },
      {
        parameter: 'Roughness',
        animationType: {
          Keyframe: {
            keyframes: [
              { time: 0.0, value: 0.8 },
              { time: 2.5, value: 0.2 },
              { time: 5.0, value: 0.8 },
            ],
            interpolation: 'Linear',
          },
        },
      },
    ],
  });

  // Base material properties (non-animated)
  const baseMaterialProps: PBRMaterialProps = {
    albedoColor: '#4080ff',
    metallicValue: 0.9,
    emissiveColor: '#4080ff',
  };

  const handleAnimationChange = (animation: AnimationData) => {
    console.log('Animation changed:', animation);
  };

  return (
    <div className="w-full h-screen bg-gray-950 p-4">
      <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
        <div className="bg-gray-900 rounded-lg p-4">
          <h1 className="text-2xl font-bold text-white mb-2">
            Animated Material Preview Demo
          </h1>
          <p className="text-gray-400 text-sm">
            Real-time material animation with 60fps playback and scrubbing support.
            This demo shows a pulsing emissive material with animated roughness.
          </p>
        </div>

        <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden">
          <AnimatedPreview
            materialId="demo-material-id"
            animationData={animationData}
            baseMaterialProps={baseMaterialProps}
            onAnimationChange={handleAnimationChange}
            className="w-full h-full"
          />
        </div>

        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-2">Animation Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Duration:</span>
              <span className="text-white ml-2">{animationData.duration}s</span>
            </div>
            <div>
              <span className="text-gray-400">Loop Mode:</span>
              <span className="text-white ml-2">{animationData.loopMode}</span>
            </div>
            <div>
              <span className="text-gray-400">Tracks:</span>
              <span className="text-white ml-2">{animationData.tracks.length}</span>
            </div>
            <div>
              <span className="text-gray-400">Parameters:</span>
              <span className="text-white ml-2">
                {animationData.tracks.map(t => t.parameter).join(', ')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

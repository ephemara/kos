import { useState } from 'react';
import { AnimationTimeline } from './AnimationTimeline';
import type { Keyframe, InterpolationType, LoopMode } from '../types';

/**
 * Demo component showing AnimationTimeline with keyframe editor functionality
 * 
 * This demonstrates:
 * - Adding keyframes by clicking on timeline
 * - Dragging keyframes to adjust timing
 * - Selecting keyframes
 * - Deleting keyframes with Delete key or button
 * - Changing interpolation type per keyframe
 */
export function AnimationTimelineDemo() {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>('Loop');
  const [keyframes, setKeyframes] = useState<Keyframe[]>([
    { time: 0, value: 0 },
    { time: 2.5, value: 0.5 },
    { time: 5, value: 1 },
    { time: 7.5, value: 0.5 },
    { time: 10, value: 0 },
  ]);
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState<number | null>(null);
  const [interpolationType, setInterpolationType] = useState<InterpolationType>('Linear');

  const handleKeyframeAdd = (time: number) => {
    // Find the value at this time by interpolating between existing keyframes
    let value = 0.5; // Default value
    
    // Find surrounding keyframes
    const before = keyframes.filter(kf => kf.time <= time).sort((a, b) => b.time - a.time)[0];
    const after = keyframes.filter(kf => kf.time > time).sort((a, b) => a.time - b.time)[0];
    
    if (before && after) {
      // Linear interpolation between surrounding keyframes
      const t = (time - before.time) / (after.time - before.time);
      value = before.value + (after.value - before.value) * t;
    } else if (before) {
      value = before.value;
    } else if (after) {
      value = after.value;
    }

    const newKeyframe: Keyframe = { time, value };
    const newKeyframes = [...keyframes, newKeyframe].sort((a, b) => a.time - b.time);
    setKeyframes(newKeyframes);
    
    // Select the newly added keyframe
    const newIndex = newKeyframes.findIndex(kf => kf.time === time);
    setSelectedKeyframeIndex(newIndex);
  };

  const handleKeyframeMove = (index: number, newTime: number) => {
    const newKeyframes = [...keyframes];
    newKeyframes[index] = { ...newKeyframes[index], time: newTime };
    // Re-sort after moving
    newKeyframes.sort((a, b) => a.time - b.time);
    setKeyframes(newKeyframes);
    
    // Update selected index after re-sorting
    const movedKeyframe = keyframes[index];
    const newIndex = newKeyframes.findIndex(kf => kf === movedKeyframe);
    setSelectedKeyframeIndex(newIndex);
  };

  const handleKeyframeDelete = (index: number) => {
    const newKeyframes = keyframes.filter((_, i) => i !== index);
    setKeyframes(newKeyframes);
    setSelectedKeyframeIndex(null);
  };

  const handleInterpolationChange = (newInterpolationType: InterpolationType) => {
    setInterpolationType(newInterpolationType);
    // In a real implementation, this would update the interpolation type
    // for the selected keyframe in the animation data structure
    console.log(`Changed interpolation to ${newInterpolationType} for keyframe ${selectedKeyframeIndex}`);
  };

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Animation Timeline with Keyframe Editor</h1>
          <p className="text-gray-400 text-sm">
            Click on timeline to add keyframes • Drag keyframes to move • Click to select • Delete key to remove
          </p>
        </div>

        <AnimationTimeline
          currentTime={currentTime}
          duration={10}
          isPlaying={isPlaying}
          loopMode={loopMode}
          playbackSpeed={1.0}
          keyframes={keyframes}
          selectedKeyframeIndex={selectedKeyframeIndex}
          interpolationType={interpolationType}
          onTimeChange={setCurrentTime}
          onPlayStateChange={setIsPlaying}
          onStop={() => setCurrentTime(0)}
          onLoopModeChange={setLoopMode}
          onKeyframeAdd={handleKeyframeAdd}
          onKeyframeMove={handleKeyframeMove}
          onKeyframeSelect={setSelectedKeyframeIndex}
          onKeyframeDelete={handleKeyframeDelete}
          onInterpolationChange={handleInterpolationChange}
        />

        {/* Debug Info */}
        <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-semibold text-white">Debug Info</h2>
          <div className="text-xs text-gray-400 space-y-1 font-mono">
            <div>Current Time: {currentTime.toFixed(2)}s</div>
            <div>Keyframes: {keyframes.length}</div>
            <div>Selected: {selectedKeyframeIndex !== null ? `#${selectedKeyframeIndex}` : 'None'}</div>
            <div>Interpolation: {interpolationType}</div>
          </div>
          
          <div className="pt-2 border-t border-gray-700/50">
            <h3 className="text-xs font-semibold text-white mb-1">Keyframe List:</h3>
            <div className="space-y-1">
              {keyframes.map((kf, i) => (
                <div 
                  key={i} 
                  className={`text-xs font-mono ${i === selectedKeyframeIndex ? 'text-yellow-400' : 'text-gray-500'}`}
                >
                  [{i}] t={kf.time.toFixed(2)}s, v={kf.value.toFixed(2)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

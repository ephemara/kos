import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Play, Pause, Square, Trash2 } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/primitives/Select';
import { cn } from '@/ui/primitives/cn';
import type { LoopMode, Keyframe, InterpolationType } from '../types';

export interface AnimationTimelineProps {
  /** Current animation time in seconds */
  currentTime?: number;
  /** Total animation duration in seconds */
  duration?: number;
  /** Whether animation is currently playing */
  isPlaying?: boolean;
  /** Loop mode for animation playback */
  loopMode?: LoopMode;
  /** Playback speed multiplier (1.0 = normal speed) */
  playbackSpeed?: number;
  /** Keyframes to display on timeline */
  keyframes?: Keyframe[];
  /** Currently selected keyframe index */
  selectedKeyframeIndex?: number;
  /** Callback when time changes (scrubbing or playback) */
  onTimeChange?: (time: number) => void;
  /** Callback when play state changes */
  onPlayStateChange?: (isPlaying: boolean) => void;
  /** Callback when stop is pressed */
  onStop?: () => void;
  /** Callback when loop mode changes */
  onLoopModeChange?: (mode: LoopMode) => void;
  /** Callback when a keyframe is added */
  onKeyframeAdd?: (time: number) => void;
  /** Callback when a keyframe is moved */
  onKeyframeMove?: (index: number, newTime: number) => void;
  /** Callback when a keyframe is selected */
  onKeyframeSelect?: (index: number | null) => void;
  /** Callback when a keyframe is deleted */
  onKeyframeDelete?: (index: number) => void;
  /** Callback when interpolation type changes for selected keyframe */
  onInterpolationChange?: (interpolationType: InterpolationType) => void;
  /** Current interpolation type for selected keyframe */
  interpolationType?: InterpolationType;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AnimationTimeline Component
 * 
 * Displays a timeline with time ruler, playhead, keyframe editor, and playback controls.
 * Supports scrubbing, play/pause/stop, loop mode selection, and keyframe manipulation.
 * 
 * Keyframe Editor Features:
 * - Display keyframes as markers on timeline
 * - Click on timeline to add keyframes
 * - Drag keyframes to adjust timing
 * - Select keyframes by clicking
 * - Delete selected keyframes with Delete key or button
 * - Change interpolation type for selected keyframe
 * 
 * Requirements: 5.2, 5.4, 5.7, 5.12
 */
export function AnimationTimeline({
  currentTime = 0,
  duration = 10,
  isPlaying = false,
  loopMode = 'Once',
  playbackSpeed = 1.0,
  keyframes = [],
  selectedKeyframeIndex,
  onTimeChange,
  onPlayStateChange,
  onStop,
  onLoopModeChange,
  onKeyframeAdd,
  onKeyframeMove,
  onKeyframeSelect,
  onKeyframeDelete,
  onInterpolationChange,
  interpolationType = 'Linear',
  className,
}: AnimationTimelineProps) {
  const [localTime, setLocalTime] = useState(currentTime);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingKeyframeIndex, setDraggingKeyframeIndex] = useState<number | null>(null);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(performance.now());
  const timelineRef = useRef<HTMLDivElement>(null);

  // Sync local time with prop
  useEffect(() => {
    if (!isDragging) {
      setLocalTime(currentTime);
    }
  }, [currentTime, isDragging]);

  // Animation playback loop using requestAnimationFrame
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      return;
    }

    lastTimeRef.current = performance.now();

    const animate = (time: number) => {
      const delta = (time - lastTimeRef.current) / 1000; // Convert to seconds
      lastTimeRef.current = time;

      setLocalTime((prev) => {
        let newTime = prev + delta * playbackSpeed;

        // Handle loop modes
        if (newTime >= duration) {
          switch (loopMode) {
            case 'Loop':
              newTime = newTime % duration;
              break;
            case 'PingPong':
              // TODO: Implement ping-pong (requires direction state)
              newTime = 0;
              break;
            case 'Once':
            default:
              newTime = duration;
              onPlayStateChange?.(false); // Stop at end
              break;
          }
        }

        onTimeChange?.(newTime);
        return newTime;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, duration, loopMode, playbackSpeed, onTimeChange, onPlayStateChange]);

  // Handle play/pause toggle
  const handlePlayPause = useCallback(() => {
    onPlayStateChange?.(!isPlaying);
  }, [isPlaying, onPlayStateChange]);

  // Handle stop (reset to 0)
  const handleStop = useCallback(() => {
    setLocalTime(0);
    onTimeChange?.(0);
    onPlayStateChange?.(false);
    onStop?.();
  }, [onTimeChange, onPlayStateChange, onStop]);

  // Handle timeline scrubbing
  const handleTimelineChange = useCallback((value: number) => {
    setLocalTime(value);
    onTimeChange?.(value);
  }, [onTimeChange]);

  // Format time as MM:SS.T (minutes:seconds.tenths)
  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const tenths = Math.floor((time % 1) * 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  }, []);

  // Generate time ruler markers
  const timeMarkers = useMemo(() => {
    const markers: { time: number; label: string; position: number }[] = [];
    const interval = duration <= 10 ? 1 : duration <= 60 ? 5 : 10;
    
    for (let t = 0; t <= duration; t += interval) {
      markers.push({
        time: t,
        label: `${t}s`,
        position: (t / duration) * 100,
      });
    }
    
    return markers;
  }, [duration]);

  // Calculate playhead position percentage
  const playheadPosition = (localTime / duration) * 100;

  // Handle keyframe click (select)
  const handleKeyframeClick = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onKeyframeSelect?.(index);
  }, [onKeyframeSelect]);

  // Handle keyframe drag start
  const handleKeyframeDragStart = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingKeyframeIndex(index);
    onKeyframeSelect?.(index);
  }, [onKeyframeSelect]);

  // Handle keyframe drag
  const handleKeyframeDrag = useCallback((e: MouseEvent) => {
    if (draggingKeyframeIndex === null || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;

    onKeyframeMove?.(draggingKeyframeIndex, newTime);
  }, [draggingKeyframeIndex, duration, onKeyframeMove]);

  // Handle keyframe drag end
  const handleKeyframeDragEnd = useCallback(() => {
    setDraggingKeyframeIndex(null);
  }, []);

  // Set up keyframe drag listeners
  useEffect(() => {
    if (draggingKeyframeIndex === null) return;

    window.addEventListener('mousemove', handleKeyframeDrag);
    window.addEventListener('mouseup', handleKeyframeDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleKeyframeDrag);
      window.removeEventListener('mouseup', handleKeyframeDragEnd);
    };
  }, [draggingKeyframeIndex, handleKeyframeDrag, handleKeyframeDragEnd]);

  // Handle timeline click to add keyframe
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    
    // Don't add keyframe if clicking on existing keyframe or playhead
    const target = e.target as HTMLElement;
    if (target.closest('[data-keyframe]') || target.closest('[data-playhead]')) {
      return;
    }

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * duration;

    onKeyframeAdd?.(time);
  }, [duration, onKeyframeAdd]);

  // Handle delete key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedKeyframeIndex !== undefined && selectedKeyframeIndex !== null) {
        e.preventDefault();
        onKeyframeDelete?.(selectedKeyframeIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedKeyframeIndex, onKeyframeDelete]);

  // Handle delete button click
  const handleDeleteClick = useCallback(() => {
    if (selectedKeyframeIndex !== undefined && selectedKeyframeIndex !== null) {
      onKeyframeDelete?.(selectedKeyframeIndex);
    }
  }, [selectedKeyframeIndex, onKeyframeDelete]);

  return (
    <div className={cn('flex flex-col gap-3 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4', className)}>
      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handlePlayPause}
            className="h-8 w-8"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            onClick={handleStop}
            className="h-8 w-8"
            title="Stop"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>

        {/* Time Display */}
        <div className="flex items-center gap-1 text-xs text-gray-300 font-mono min-w-[120px]">
          <span className="text-white">{formatTime(localTime)}</span>
          <span className="text-gray-500">/</span>
          <span className="text-gray-400">{formatTime(duration)}</span>
        </div>

        {/* Loop Mode Selector */}
        <div className="ml-auto">
          <Select value={loopMode} onValueChange={(v) => onLoopModeChange?.(v as LoopMode)}>
            <SelectTrigger className="w-32 h-8 text-xs bg-gray-800 border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Once">Once</SelectItem>
              <SelectItem value="Loop">Loop</SelectItem>
              <SelectItem value="PingPong">Ping-Pong</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative" ref={timelineRef}>
        {/* Time Ruler */}
        <div className="relative h-6 mb-2">
          {timeMarkers.map((marker) => (
            <div
              key={marker.time}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${marker.position}%` }}
            >
              <div className="w-px h-2 bg-gray-600" />
              <span className="text-[10px] text-gray-500 mt-0.5">{marker.label}</span>
            </div>
          ))}
        </div>

        {/* Timeline Slider with Keyframes */}
        <div className="relative" onClick={handleTimelineClick}>
          <SliderPrimitive.Root
            value={[localTime]}
            onValueChange={(v) => handleTimelineChange(v[0] ?? 0)}
            onPointerDown={() => setIsDragging(true)}
            onPointerUp={() => setIsDragging(false)}
            min={0}
            max={duration}
            step={0.01}
            className="relative flex w-full touch-none select-none items-center h-8 cursor-pointer"
          >
            <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-800 border border-gray-700">
              <SliderPrimitive.Range className="absolute h-full bg-blue-500/30" />
            </SliderPrimitive.Track>
            
            {/* Playhead */}
            <SliderPrimitive.Thumb 
              data-playhead
              className="block h-6 w-1.5 rounded-sm bg-blue-400 border border-blue-300 shadow-lg shadow-blue-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 transition-shadow hover:shadow-blue-500/70" 
            />
          </SliderPrimitive.Root>

          {/* Keyframe Markers */}
          {keyframes.map((keyframe, index) => {
            const position = (keyframe.time / duration) * 100;
            const isSelected = selectedKeyframeIndex === index;
            const isDraggingThis = draggingKeyframeIndex === index;
            
            return (
              <div
                key={index}
                data-keyframe
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full cursor-pointer transition-all",
                  "border-2 shadow-lg z-10",
                  isSelected
                    ? "bg-yellow-400 border-yellow-300 shadow-yellow-500/50 scale-125"
                    : "bg-green-400 border-green-300 shadow-green-500/30 hover:scale-110 hover:shadow-green-500/50",
                  isDraggingThis && "scale-150 shadow-green-500/70"
                )}
                style={{ left: `${position}%` }}
                onClick={(e) => handleKeyframeClick(index, e)}
                onMouseDown={(e) => handleKeyframeDragStart(index, e)}
                title={`Keyframe at ${keyframe.time.toFixed(2)}s (value: ${keyframe.value.toFixed(2)})`}
              />
            );
          })}

          {/* Playhead Line Extension (visual indicator) */}
          <div
            className="absolute top-0 bottom-0 w-px bg-blue-400/50 pointer-events-none"
            style={{ left: `${playheadPosition}%` }}
          />
        </div>
      </div>

      {/* Additional Info */}
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>Speed: {playbackSpeed.toFixed(1)}x</span>
        <span>{isPlaying ? 'Playing' : 'Paused'}</span>
      </div>

      {/* Keyframe Controls (shown when keyframe is selected) */}
      {selectedKeyframeIndex !== undefined && selectedKeyframeIndex !== null && keyframes[selectedKeyframeIndex] && (
        <div className="flex items-center gap-3 pt-3 border-t border-gray-700/50">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-gray-400">Keyframe:</span>
            <span className="text-xs text-white font-mono">
              {keyframes[selectedKeyframeIndex].time.toFixed(2)}s
            </span>
            <span className="text-xs text-gray-500">→</span>
            <span className="text-xs text-white font-mono">
              {keyframes[selectedKeyframeIndex].value.toFixed(2)}
            </span>
          </div>

          {/* Interpolation Type Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Interpolation:</span>
            <Select 
              value={interpolationType} 
              onValueChange={(v) => onInterpolationChange?.(v as InterpolationType)}
            >
              <SelectTrigger className="w-32 h-7 text-xs bg-gray-800 border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Linear">Linear</SelectItem>
                <SelectItem value="EaseIn">Ease In</SelectItem>
                <SelectItem value="EaseOut">Ease Out</SelectItem>
                <SelectItem value="EaseInOut">Ease In-Out</SelectItem>
                <SelectItem value="Bezier">Bezier</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Delete Button */}
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDeleteClick}
            className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            title="Delete Keyframe (Delete/Backspace)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Hint text when no keyframe selected */}
      {(selectedKeyframeIndex === undefined || selectedKeyframeIndex === null) && keyframes.length === 0 && (
        <div className="pt-3 border-t border-gray-700/50">
          <p className="text-xs text-gray-500 text-center">
            Click on timeline to add keyframes
          </p>
        </div>
      )}
    </div>
  );
}

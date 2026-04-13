import { useState } from 'react';
import { AnimationTrackList } from './AnimationTrackList';
import type { AnimationTrack, AnimationParameter } from '../types';

/**
 * Demo component showing AnimationTrackList functionality
 * 
 * This demonstrates:
 * - Adding/removing animation tracks
 * - Selecting different parameters
 * - Choosing animation types (Keyframe/Procedural/Physics)
 * - Editing procedural expressions
 * - Applying expression presets
 * - Enabling/disabling tracks
 */
export function AnimationTrackListDemo() {
  const [tracks, setTracks] = useState<AnimationTrack[]>([
    {
      parameter: 'Roughness',
      animationType: {
        Keyframe: {
          keyframes: [
            { time: 0, value: 0 },
            { time: 5, value: 1 },
          ],
          interpolation: 'Linear',
        },
      },
    },
    {
      parameter: 'EmissiveIntensity',
      animationType: {
        Procedural: {
          expression: 'sin(t * 2.0) * 0.5 + 0.5',
        },
      },
    },
    {
      parameter: 'UVOffsetX',
      animationType: {
        Procedural: {
          expression: 't * 0.5',
        },
      },
    },
  ]);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number | null>(null);

  const handleTrackAdd = (parameter: AnimationParameter, animationType: 'Keyframe' | 'Procedural' | 'Physics') => {
    const newTrack: AnimationTrack = {
      parameter,
      animationType:
        animationType === 'Keyframe'
          ? {
              Keyframe: {
                keyframes: [
                  { time: 0, value: 0 },
                  { time: 10, value: 1 },
                ],
                interpolation: 'Linear',
              },
            }
          : animationType === 'Procedural'
          ? {
              Procedural: {
                expression: 't * 0.1',
              },
            }
          : {
              Physics: {
                simulationType: 'RustSpreading',
              },
            },
    };

    setTracks([...tracks, newTrack]);
    setSelectedTrackIndex(tracks.length); // Select the newly added track
  };

  const handleTrackRemove = (index: number) => {
    const newTracks = tracks.filter((_, i) => i !== index);
    setTracks(newTracks);
    if (selectedTrackIndex === index) {
      setSelectedTrackIndex(null);
    } else if (selectedTrackIndex !== null && selectedTrackIndex > index) {
      setSelectedTrackIndex(selectedTrackIndex - 1);
    }
  };

  const handleExpressionChange = (index: number, expression: string) => {
    const newTracks = [...tracks];
    const track = newTracks[index];
    if (track && 'Procedural' in track.animationType) {
      track.animationType.Procedural.expression = expression;
      setTracks(newTracks);
    }
  };

  const handleTrackToggle = (index: number, enabled: boolean) => {
    console.log(`Track ${index} toggled to ${enabled}`);
    // In a real implementation, this would update the track's enabled state
  };

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Animation Track List</h1>
          <p className="text-gray-400 text-sm">
            Add tracks • Select parameters • Edit expressions • Apply presets
          </p>
        </div>

        <AnimationTrackList
          tracks={tracks}
          selectedTrackIndex={selectedTrackIndex}
          onTrackAdd={handleTrackAdd}
          onTrackRemove={handleTrackRemove}
          onTrackSelect={setSelectedTrackIndex}
          onTrackToggle={handleTrackToggle}
          onExpressionChange={handleExpressionChange}
        />

        {/* Debug Info */}
        <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-semibold text-white">Debug Info</h2>
          <div className="text-xs text-gray-400 space-y-1 font-mono">
            <div>Total Tracks: {tracks.length}</div>
            <div>Selected Track: {selectedTrackIndex !== null ? `#${selectedTrackIndex}` : 'None'}</div>
          </div>

          <div className="pt-2 border-t border-gray-700/50">
            <h3 className="text-xs font-semibold text-white mb-1">Track List:</h3>
            <div className="space-y-1">
              {tracks.map((track, i) => {
                const typeLabel = 'Keyframe' in track.animationType
                  ? 'Keyframe'
                  : 'Procedural' in track.animationType
                  ? 'Procedural'
                  : 'Physics';
                const expression =
                  'Procedural' in track.animationType
                    ? track.animationType.Procedural.expression
                    : '';

                return (
                  <div
                    key={i}
                    className={`text-xs font-mono ${i === selectedTrackIndex ? 'text-yellow-400' : 'text-gray-500'}`}
                  >
                    [{i}] {track.parameter} ({typeLabel})
                    {expression && (
                      <div className="ml-4 text-purple-400 truncate">expr: {expression}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

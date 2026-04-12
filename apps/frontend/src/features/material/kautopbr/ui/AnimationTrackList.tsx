import { useState, useCallback } from 'react';
import { Plus, Trash2, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/primitives/Select';
import { cn } from '@/ui/primitives/cn';
import type { AnimationTrack, AnimationParameter, AnimationType } from '../types';
import { ExpressionEditor } from './ExpressionEditor';
import { EXPRESSION_PRESETS } from './expressionPresets';

export interface AnimationTrackListProps {
  /** Animation tracks to display */
  tracks?: AnimationTrack[];
  /** Currently selected track index */
  selectedTrackIndex?: number | null;
  /** Callback when a track is added */
  onTrackAdd?: (parameter: AnimationParameter, animationType: 'Keyframe' | 'Procedural' | 'Physics') => void;
  /** Callback when a track is removed */
  onTrackRemove?: (index: number) => void;
  /** Callback when a track is selected */
  onTrackSelect?: (index: number | null) => void;
  /** Callback when track enabled state changes */
  onTrackToggle?: (index: number, enabled: boolean) => void;
  /** Callback when procedural expression changes */
  onExpressionChange?: (index: number, expression: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AnimationTrackList Component
 * 
 * Displays a list of animation tracks with controls for:
 * - Adding/removing tracks
 * - Selecting parameters
 * - Choosing animation type (Keyframe/Procedural/Physics)
 * - Editing procedural expressions with syntax highlighting
 * - Applying expression presets
 * - Enabling/disabling tracks
 * 
 * Requirements: 5.1, 5.12, 6.1, 6.12
 */
export function AnimationTrackList({
  tracks = [],
  selectedTrackIndex,
  onTrackAdd,
  onTrackRemove,
  onTrackSelect,
  onTrackToggle,
  onExpressionChange,
  className,
}: AnimationTrackListProps) {
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [newTrackParameter, setNewTrackParameter] = useState<AnimationParameter>('Roughness');
  const [newTrackType, setNewTrackType] = useState<'Keyframe' | 'Procedural' | 'Physics'>('Keyframe');

  // Get animation type label
  const getAnimationTypeLabel = useCallback((animationType: AnimationType): string => {
    if ('Keyframe' in animationType) return 'Keyframe';
    if ('Procedural' in animationType) return 'Procedural';
    if ('Physics' in animationType) return 'Physics';
    return 'Unknown';
  }, []);

  // Get animation type icon/color
  const getAnimationTypeColor = useCallback((animationType: AnimationType): string => {
    if ('Keyframe' in animationType) return 'text-green-400';
    if ('Procedural' in animationType) return 'text-purple-400';
    if ('Physics' in animationType) return 'text-orange-400';
    return 'text-gray-400';
  }, []);

  // Handle add track
  const handleAddTrack = useCallback(() => {
    onTrackAdd?.(newTrackParameter, newTrackType);
    setShowAddTrack(false);
  }, [newTrackParameter, newTrackType, onTrackAdd]);

  // Handle track click (select)
  const handleTrackClick = useCallback((index: number) => {
    onTrackSelect?.(selectedTrackIndex === index ? null : index);
  }, [selectedTrackIndex, onTrackSelect]);

  // Handle expression preset selection
  const handlePresetSelect = useCallback((index: number, presetExpression: string) => {
    onExpressionChange?.(index, presetExpression);
  }, [onExpressionChange]);

  // All available parameters
  const availableParameters: AnimationParameter[] = [
    'AlbedoColor',
    'AlbedoRed',
    'AlbedoGreen',
    'AlbedoBlue',
    'Roughness',
    'Metallic',
    'EmissiveIntensity',
    'EmissiveColor',
    'HeightOffset',
    'NormalStrength',
    'UVOffsetX',
    'UVOffsetY',
  ];

  // Format parameter name for display
  const formatParameterName = (param: AnimationParameter): string => {
    // Add spaces before capital letters
    return param.replace(/([A-Z])/g, ' $1').trim();
  };

  return (
    <div className={cn('flex flex-col gap-2 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">Animation Tracks</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowAddTrack(!showAddTrack)}
          className="h-7 px-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Track
        </Button>
      </div>

      {/* Add Track Panel */}
      {showAddTrack && (
        <div className="bg-gray-800/50 rounded-lg p-3 space-y-3 border border-gray-700/50">
          <div className="space-y-2">
            <label className="text-xs text-gray-400">Parameter</label>
            <Select value={newTrackParameter} onValueChange={(v) => setNewTrackParameter(v as AnimationParameter)}>
              <SelectTrigger className="w-full h-8 text-xs bg-gray-800 border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableParameters.map((param) => (
                  <SelectItem key={param} value={param}>
                    {formatParameterName(param)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-400">Animation Type</label>
            <Select value={newTrackType} onValueChange={(v) => setNewTrackType(v as 'Keyframe' | 'Procedural' | 'Physics')}>
              <SelectTrigger className="w-full h-8 text-xs bg-gray-800 border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Keyframe">Keyframe</SelectItem>
                <SelectItem value="Procedural">Procedural</SelectItem>
                <SelectItem value="Physics">Physics</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAddTrack}
              className="flex-1 h-7 text-xs"
            >
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAddTrack(false)}
              className="flex-1 h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Track List */}
      <div className="space-y-2">
        {tracks.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            No animation tracks. Click "Add Track" to create one.
          </div>
        ) : (
          tracks.map((track, index) => {
            const isSelected = selectedTrackIndex === index;
            const typeLabel = getAnimationTypeLabel(track.animationType);
            const typeColor = getAnimationTypeColor(track.animationType);
            const isProceduralTrack = 'Procedural' in track.animationType;

            return (
              <div
                key={index}
                className={cn(
                  'bg-gray-800/50 rounded-lg border transition-all',
                  isSelected
                    ? 'border-blue-500/50 bg-gray-800/80'
                    : 'border-gray-700/50 hover:border-gray-600/50'
                )}
              >
                {/* Track Header */}
                <div
                  className="flex items-center gap-2 p-3 cursor-pointer"
                  onClick={() => handleTrackClick(index)}
                >
                  {/* Enable/Disable Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrackToggle?.(index, true); // Toggle logic would be handled by parent
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Toggle track"
                  >
                    <Eye className="h-4 w-4" />
                  </button>

                  {/* Parameter Name */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {formatParameterName(track.parameter)}
                    </div>
                    <div className={cn('text-xs', typeColor)}>
                      {typeLabel}
                    </div>
                  </div>

                  {/* Expand Indicator (for procedural) */}
                  {isProceduralTrack && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-gray-400 transition-transform',
                        isSelected && 'rotate-180'
                      )}
                    />
                  )}

                  {/* Delete Button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrackRemove?.(index);
                    }}
                    className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    title="Remove track"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Procedural Expression Editor (expanded when selected) */}
                {isSelected && isProceduralTrack && (
                  <div className="px-3 pb-3 space-y-3 border-t border-gray-700/50 pt-3">
                    {/* Expression Preset Dropdown */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">Expression Preset</label>
                      <Select
                        value=""
                        onValueChange={(v) => handlePresetSelect(index, v)}
                      >
                        <SelectTrigger className="w-full h-8 text-xs bg-gray-800 border-gray-700">
                          <SelectValue placeholder="Select a preset..." />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPRESSION_PRESETS.map((preset) => (
                            <SelectItem key={preset.name} value={preset.expression}>
                              <div className="flex flex-col">
                                <span className="font-medium">{preset.name}</span>
                                <span className="text-xs text-gray-500">{preset.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Expression Editor */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">Expression</label>
                      <ExpressionEditor
                        value={('Procedural' in track.animationType ? track.animationType.Procedural.expression : '')}
                        onChange={(expr) => onExpressionChange?.(index, expr)}
                        placeholder="Enter expression (e.g., sin(t * 2.0) * 0.5 + 0.5)"
                      />
                    </div>

                    {/* Help Text */}
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Available functions: sin, cos, tan, abs, sqrt, pow, min, max, clamp, lerp</div>
                      <div>Noise functions: perlin, simplex, worley, fbm</div>
                      <div>Variable: t (time in seconds)</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

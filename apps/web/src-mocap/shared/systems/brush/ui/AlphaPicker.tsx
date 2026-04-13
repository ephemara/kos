/**
 * K_OS Alpha Picker
 * 
 * Universal alpha texture picker for KSculpt, KPainter, KGraphos.
 * Fully integrated with KBrushEngine GPU backend.
 * 
 * Features:
 * - Library mode: Browse GPU-pooled alphas with thumbnails
 * - Generator mode: Create procedural alphas on GPU
 * - File import: Load custom alpha textures
 * - Save to library: Persist generated alphas
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Grid, Sparkles, Upload, Save, RefreshCw, Circle,
    RotateCw, Waves, Trash2, FolderOpen, Plus, X,
    Square, Diamond, Hexagon, Target, Zap
} from 'lucide-react';

import {
    useBrushEngine,
    generateProceduralAlpha,
    loadAlphaFromFile,
    loadAlphaFromBase64,
    listAlphas,
    disposeAlpha,
    ProceduralType,
    AlphaInfo,
    PROCEDURAL_PRESETS
} from '../KBrushEngine';

// ============================================================================
// TYPES
// ============================================================================

export interface AlphaPickerProps {
    /** Compact mode for toolbars */
    compact?: boolean;
    /** Custom class */
    className?: string;
    /** Called when alpha changes */
    onAlphaChange?: (alpha: AlphaInfo | null) => void;
    /** Called when alpha is saved to library */
    onSaveAlpha?: (alpha: AlphaInfo) => void;
}

interface GeneratorParams {
    scale: number;
    detail: number;
    contrast: number;
    rotation: number;
    power: number;
    invert: boolean;
    seed: number;
    edgeWidth: number;
    cells: number;
}

// ============================================================================
// PROCEDURAL TYPE CONFIG
// ============================================================================

const PROCEDURAL_TYPES: {
    id: ProceduralType;
    label: string;
    icon: React.ReactNode;
    description: string;
}[] = [
        { id: 'radial', label: 'SOFT', icon: <Target size={12} />, description: 'Soft falloff brush' },
        { id: 'circle', label: 'HARD', icon: <Circle size={12} />, description: 'Hard edge circle' },
        { id: 'square', label: 'SQUARE', icon: <Square size={12} />, description: 'Square shape' },
        { id: 'diamond', label: 'DIAMOND', icon: <Diamond size={12} />, description: 'Diamond shape' },
        { id: 'perlin', label: 'NOISE', icon: <Waves size={12} />, description: 'Organic noise' },
        { id: 'voronoi', label: 'CELLS', icon: <Hexagon size={12} />, description: 'Voronoi cells' },
        { id: 'bricks', label: 'BRICKS', icon: <Grid size={12} />, description: 'Brick pattern' },
        { id: 'dots', label: 'DOTS', icon: <Zap size={12} />, description: 'Dot pattern' },
    ];

const DEFAULT_PARAMS: GeneratorParams = {
    scale: 4.0,
    detail: 4.0,
    contrast: 1.2,
    rotation: 0,
    power: 2.0,
    invert: false,
    seed: 0,
    edgeWidth: 0.1,
    cells: 16,
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function AlphaPicker({
    compact = false,
    className = '',
    onAlphaChange,
    onSaveAlpha,
}: AlphaPickerProps) {
    // Brush engine integration
    const { settings, updateSettings, alpha } = useBrushEngine();

    // UI State
    const [mode, setMode] = useState<'LIBRARY' | 'GENERATE'>('LIBRARY');
    const [selectedType, setSelectedType] = useState<ProceduralType>('radial');
    const [params, setParams] = useState<GeneratorParams>(DEFAULT_PARAMS);
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewAlpha, setPreviewAlpha] = useState<AlphaInfo | null>(null);
    const [libraryAlphas, setLibraryAlphas] = useState<AlphaInfo[]>([]);
    const [error, setError] = useState<string | null>(null);

    // File input ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ============================================================================
    // EFFECTS
    // ============================================================================

    // Load library on mount
    useEffect(() => {
        refreshLibrary();
    }, []);

    // Generate preview when params change
    useEffect(() => {
        if (mode !== 'GENERATE') return;

        const debounceTimer = setTimeout(() => {
            generatePreview();
        }, 150); // Debounce for smooth slider interaction

        return () => clearTimeout(debounceTimer);
    }, [mode, selectedType, params]);

    // Notify parent of alpha changes
    useEffect(() => {
        onAlphaChange?.(alpha);
    }, [alpha, onAlphaChange]);

    // ============================================================================
    // ACTIONS
    // ============================================================================

    const refreshLibrary = async () => {
        try {
            const alphas = await listAlphas();
            setLibraryAlphas(alphas);
        } catch (e) {
            console.error('Failed to load alpha library:', e);
        }
    };

    const generatePreview = async () => {
        setIsGenerating(true);
        setError(null);

        try {
            const procParams: Record<string, number> = {
                falloff: params.power,
                softness: 1 / (params.power + 0.1),
                scale: params.scale,
                octaves: params.detail,
                seed: params.seed,
                cells: params.cells,
                edge_width: params.edgeWidth,
                width: 0.25,
                height: 0.1,
                dot_size: 0.08,
                spacing: 0.15,
            };

            const alpha = await generateProceduralAlpha(selectedType, 256, procParams);
            setPreviewAlpha(alpha);
        } catch (e: any) {
            setError(e.message || 'Generation failed');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSelectAlpha = (alphaInfo: AlphaInfo | null) => {
        updateSettings({ alpha: alphaInfo });
    };

    const handleCommitPreview = async () => {
        if (!previewAlpha) return;

        // Set as active alpha
        updateSettings({ alpha: previewAlpha });

        // Notify parent
        onSaveAlpha?.(previewAlpha);

        // Refresh library
        await refreshLibrary();

        // Switch to library
        setMode('LIBRARY');
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const name = file.name.replace(/\.[^.]+$/, '');
                const alphaInfo = await loadAlphaFromBase64(base64, name);
                updateSettings({ alpha: alphaInfo });
                await refreshLibrary();
            };
            reader.readAsDataURL(file);
        } catch (e: any) {
            setError(e.message || 'Import failed');
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDeleteAlpha = async (alphaInfo: AlphaInfo) => {
        const confirmed = window.confirm(`Delete "${alphaInfo.name}"?`);
        if (!confirmed) return;

        await disposeAlpha(alphaInfo.handle);

        // Clear if active
        if (alpha?.handle === alphaInfo.handle) {
            updateSettings({ alpha: null });
        }

        await refreshLibrary();
    };

    const handleRandomize = () => {
        setParams(p => ({ ...p, seed: Math.random() * 1000 }));
    };

    // ============================================================================
    // RENDER HELPERS
    // ============================================================================

    const renderSlider = (
        label: string,
        value: number,
        onChange: (v: number) => void,
        min: number,
        max: number,
        step: number = 0.1,
        icon?: React.ReactNode
    ) => (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[9px] text-gray-400 font-medium">
                <span className="flex items-center gap-1">
                    {icon}
                    {label}
                </span>
                <span className="text-rose-400">{value.toFixed(1)}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer 
          [&::-webkit-slider-thumb]:appearance-none 
          [&::-webkit-slider-thumb]:w-3 
          [&::-webkit-slider-thumb]:h-3 
          [&::-webkit-slider-thumb]:rounded-full 
          [&::-webkit-slider-thumb]:bg-rose-500
          [&::-webkit-slider-thumb]:shadow-lg
          [&::-webkit-slider-thumb]:shadow-rose-500/30
          hover:[&::-webkit-slider-thumb]:bg-rose-400
          transition-all"
            />
        </div>
    );

    const renderAlphaThumbnail = (alphaInfo: AlphaInfo, isActive: boolean) => (
        <button
            key={alphaInfo.handle}
            onClick={() => handleSelectAlpha(alphaInfo)}
            className={`
        relative aspect-square rounded-lg overflow-hidden group
        border-2 transition-all duration-200
        ${isActive
                    ? 'border-rose-500 shadow-lg shadow-rose-500/30 scale-105'
                    : 'border-transparent hover:border-white/30'
                }
      `}
        >
            {/* Thumbnail - show actual preview if available */}
            {alphaInfo.preview ? (
                <img
                    src={alphaInfo.preview}
                    alt={alphaInfo.name}
                    className="w-full h-full object-cover"
                    style={{ imageRendering: 'pixelated' }}
                />
            ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <div className="text-[10px] text-gray-500 font-medium text-center p-1 truncate w-full">
                        {alphaInfo.name}
                    </div>
                </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                <span className="text-[10px] text-white font-bold truncate px-1">{alphaInfo.name}</span>
                <span className="text-[8px] text-gray-300">{alphaInfo.width}×{alphaInfo.height}</span>
                <div
                    role="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteAlpha(alphaInfo); }}
                    className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 cursor-pointer"
                >
                    <Trash2 size={10} />
                </div>
            </div>

            {/* Active indicator */}
            {isActive && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50" />
            )}
        </button>
    );

    // ============================================================================
    // RENDER
    // ============================================================================

    return (
        <div className={`flex flex-col bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] overflow-hidden ${className}`}>
            {/* Header */}
            <div className="flex bg-gradient-to-r from-[#111] to-[#0a0a0a] p-1 border-b border-[#1a1a1a]">
                <button
                    onClick={() => setMode('LIBRARY')}
                    className={`
            flex-1 py-2 text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 transition-all
            ${mode === 'LIBRARY'
                            ? 'bg-[#1a1a1a] text-white shadow-inner'
                            : 'text-gray-500 hover:text-gray-300'
                        }
          `}
                >
                    <Grid size={12} />
                    LIBRARY
                </button>
                <button
                    onClick={() => setMode('GENERATE')}
                    className={`
            flex-1 py-2 text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 transition-all
            ${mode === 'GENERATE'
                            ? 'bg-gradient-to-r from-rose-900/40 to-orange-900/40 text-rose-400 shadow-inner'
                            : 'text-gray-500 hover:text-gray-300'
                        }
          `}
                >
                    <Sparkles size={12} />
                    GENERATOR
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-3 overflow-y-auto custom-scrollbar" style={{ maxHeight: compact ? '300px' : '500px' }}>
                {/* LIBRARY MODE */}
                {mode === 'LIBRARY' && (
                    <div className="flex flex-col gap-3">
                        {/* Import button */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleSelectAlpha(null)}
                                className={`
                  flex-1 py-2 text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 transition-all
                  border ${!alpha
                                        ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                                        : 'bg-[#111] border-[#222] text-gray-500 hover:border-white/30'
                                    }
                `}
                            >
                                <X size={12} />
                                NO ALPHA
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 py-2 text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 transition-all
                  bg-[#111] border border-[#222] text-gray-500 hover:border-white/30 hover:text-white"
                            >
                                <Upload size={12} />
                                IMPORT
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileImport}
                                className="hidden"
                            />
                        </div>

                        {/* Alpha grid */}
                        <div className="grid grid-cols-4 gap-2">
                            {libraryAlphas.map(a => renderAlphaThumbnail(a, alpha?.handle === a.handle))}

                            {/* Empty state */}
                            {libraryAlphas.length === 0 && (
                                <div className="col-span-4 py-8 text-center text-gray-600 text-[11px]">
                                    No alphas loaded.<br />
                                    <span className="text-gray-500">Use GENERATOR or IMPORT to add alphas.</span>
                                </div>
                            )}
                        </div>

                        {/* Quick presets */}
                        <div className="border-t border-[#1a1a1a] pt-3 mt-2">
                            <div className="text-[9px] text-gray-500 font-bold mb-2">QUICK PRESETS</div>
                            <div className="grid grid-cols-4 gap-1">
                                {[
                                    { label: 'Soft', fn: PROCEDURAL_PRESETS.softRound },
                                    { label: 'Hard', fn: PROCEDURAL_PRESETS.hardRound },
                                    { label: 'Square', fn: PROCEDURAL_PRESETS.square },
                                    { label: 'Noise', fn: () => PROCEDURAL_PRESETS.perlinNoise(4, 4) },
                                ].map(preset => (
                                    <button
                                        key={preset.label}
                                        onClick={async () => {
                                            const a = await preset.fn();
                                            updateSettings({ alpha: a });
                                            await refreshLibrary();
                                        }}
                                        className="py-2 text-[9px] font-bold rounded border bg-[#111] border-[#222] text-gray-500 
                      hover:border-rose-500/50 hover:text-rose-400 transition-all"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* GENERATE MODE */}
                {mode === 'GENERATE' && (
                    <div className="flex flex-col gap-4">
                        {/* Preview */}
                        <div className="relative aspect-square w-full bg-[#111] rounded-xl overflow-hidden border border-[#1a1a1a] group">
                            {/* Preview visualization */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                {isGenerating ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <RefreshCw size={24} className="text-rose-500 animate-spin" />
                                        <span className="text-[10px] text-gray-500">Generating...</span>
                                    </div>
                                ) : previewAlpha ? (
                                    <div className="flex flex-col items-center gap-2 w-full h-full">
                                        {/* Show actual preview image if available */}
                                        {previewAlpha.preview ? (
                                            <img
                                                src={previewAlpha.preview}
                                                alt={previewAlpha.name}
                                                className="w-32 h-32 rounded-lg object-cover border border-white/10"
                                                style={{ imageRendering: 'auto' }}
                                            />
                                        ) : (
                                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-500/30 to-orange-500/30 flex items-center justify-center">
                                                <span className="text-white font-bold">{previewAlpha.name.slice(0, 8)}</span>
                                            </div>
                                        )}
                                        <span className="text-[10px] text-gray-400">
                                            {previewAlpha.width}×{previewAlpha.height}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-gray-600 text-[11px]">Select a type to preview</span>
                                )}
                            </div>

                            {/* Glow effect */}
                            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {/* Type selector */}
                        <div className="grid grid-cols-4 gap-1">
                            {PROCEDURAL_TYPES.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setSelectedType(type.id)}
                                    className={`
                    py-2 px-1 text-[8px] font-bold rounded-lg flex flex-col items-center justify-center gap-1 transition-all
                    border ${selectedType === type.id
                                            ? 'bg-gradient-to-br from-rose-900/40 to-orange-900/40 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/10'
                                            : 'bg-[#111] border-[#222] text-gray-500 hover:border-white/30'
                                        }
                  `}
                                    title={type.description}
                                >
                                    {type.icon}
                                    {type.label}
                                </button>
                            ))}
                        </div>

                        {/* Parameters */}
                        <div className="bg-[#111] rounded-xl p-3 border border-[#1a1a1a] space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                {renderSlider('SCALE', params.scale, v => setParams(p => ({ ...p, scale: v })), 1, 20)}
                                {renderSlider('DETAIL', params.detail, v => setParams(p => ({ ...p, detail: v })), 1, 8)}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {renderSlider('POWER', params.power, v => setParams(p => ({ ...p, power: v })), 0.5, 5)}
                                {renderSlider('ROTATE', params.rotation, v => setParams(p => ({ ...p, rotation: v })), 0, 360, 1, <RotateCw size={8} />)}
                            </div>

                            {/* Type-specific params */}
                            {selectedType === 'voronoi' && (
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#1a1a1a]">
                                    {renderSlider('CELLS', params.cells, v => setParams(p => ({ ...p, cells: v })), 4, 64, 1)}
                                    {renderSlider('EDGE', params.edgeWidth, v => setParams(p => ({ ...p, edgeWidth: v })), 0.01, 0.3)}
                                </div>
                            )}

                            {/* Utility buttons */}
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setParams(p => ({ ...p, invert: !p.invert }))}
                                    className={`
                    flex-1 py-2 text-[9px] font-bold rounded-lg border transition-all
                    ${params.invert
                                            ? 'bg-white text-black border-white'
                                            : 'bg-[#0a0a0a] border-[#222] text-gray-500 hover:border-white/30'
                                        }
                  `}
                                >
                                    INVERT
                                </button>
                                <button
                                    onClick={handleRandomize}
                                    className="flex-1 py-2 text-[9px] font-bold rounded-lg border bg-[#0a0a0a] border-[#222] 
                    text-gray-500 hover:border-white/30 hover:text-white flex items-center justify-center gap-2 transition-all"
                                >
                                    <RefreshCw size={10} />
                                    RANDOMIZE
                                </button>
                            </div>
                        </div>

                        {/* Error display */}
                        {error && (
                            <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
                                {error}
                            </div>
                        )}

                        {/* Commit button */}
                        <button
                            onClick={handleCommitPreview}
                            disabled={!previewAlpha || isGenerating}
                            className="
                w-full py-3 text-[11px] font-bold rounded-xl flex items-center justify-center gap-2 transition-all
                bg-gradient-to-r from-rose-600 to-orange-600 text-white shadow-lg shadow-rose-500/20
                hover:from-rose-500 hover:to-orange-500 hover:shadow-rose-500/30
                disabled:opacity-50 disabled:cursor-not-allowed
              "
                        >
                            <Save size={14} />
                            USE THIS ALPHA
                        </button>
                    </div>
                )}
            </div>

            {/* Footer - Active alpha indicator */}
            {alpha && (
                <div className="px-3 py-2 bg-gradient-to-r from-[#111] to-[#0a0a0a] border-t border-[#1a1a1a] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-gradient-to-br from-rose-500/30 to-orange-500/30" />
                        <span className="text-[10px] text-gray-300 font-medium truncate max-w-[120px]">
                            {alpha.name}
                        </span>
                    </div>
                    <button
                        onClick={() => handleSelectAlpha(null)}
                        className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-all"
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { AlphaPicker };

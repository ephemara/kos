/**
 * UnifiedMaterialDock - K_OS Universal Material Panel
 * 
 * The ONE material panel to rule them all. Premium design, industry-standard features.
 * Drop-in replacement for all app-specific material panels.
 * 
 * @usage
 * ```tsx
 * <UnifiedMaterialDock 
 *   materials={sharedState.materials}
 *   activeMaterial={activeMaterial}
 *   onSelect={setActiveMaterial}
 *   onCommit={onMaterialCommit}
 *   mode="full"
 * />
 * ```
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import {
    Palette, Library, Layers, Sparkles, Zap, Circle, Wand2,
    UploadCloud, Trash2, Download, Copy, Grid3X3, Eye, EyeOff,
    RotateCcw, Check, ChevronDown, ChevronRight, Settings, Box
} from 'lucide-react';

import type { KMaterialAsset } from '@mocap/three-d/systems/materials/KMaterialAsset';
import { getKMaterialBakedMaps, getKMaterialPreviewUrl } from '@mocap/three-d/systems/materials/KMaterialAsset';
import { resolveToThreeStandardMaterial } from '@mocap/three-d/systems/materials/materialResolver';
import { spawnPrimitiveToThree } from '@mocap/lib/primitives';

// ============================================================================
// TYPES
// ============================================================================

export interface MaterialParams {
    normalStrength: number;
    roughnessContrast: number;
    roughnessBrightness: number;
    metalBias: number;
    hue: number;
    wear: number;
    displacementScale: number;
    scale: number;
    makeSeamless: boolean;
}

export interface UnifiedMaterialDockProps {
    // Core - Required
    materials: KMaterialAsset[];
    activeMaterial: KMaterialAsset | null;
    onSelect: (mat: KMaterialAsset) => void;

    // Creation & Editing - Optional
    onCommit?: (mat: any) => void;
    onDelete?: (id: string) => void;
    onDuplicate?: (mat: KMaterialAsset) => void;

    // UI Modes
    mode?: 'full' | 'picker' | 'compact';

    // Feature Toggles
    showPreview?: boolean;
    showFluxParams?: boolean;
    showChannelToggles?: boolean;
    showQuickPresets?: boolean;
    showActions?: boolean;

    // For material creation
    currentColor?: string;
    processImage?: (img: HTMLImageElement, decal: any, type: string, params: any) => string | null;

    // Channel selection (for painting apps)
    channels?: Record<string, boolean>;
    onChannelsChange?: (channels: Record<string, boolean>) => void;

    // Custom accent color
    accentColor?: 'rose' | 'blue' | 'emerald' | 'purple' | 'amber';
}

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PARAMS: MaterialParams = {
    normalStrength: 2.0,
    roughnessContrast: 1.2,
    roughnessBrightness: 0,
    metalBias: -50,
    hue: 0,
    wear: 0.1,
    displacementScale: 0.0,
    scale: 1.0,
    makeSeamless: false,
};

const CHANNEL_LIST = [
    { id: 'albedo', label: 'Albedo', icon: Palette, color: 'rose' },
    { id: 'normal', label: 'Normal', icon: Layers, color: 'blue' },
    { id: 'roughness', label: 'Roughness', icon: Circle, color: 'green' },
    { id: 'metalness', label: 'Metallic', icon: Zap, color: 'yellow' },
    { id: 'emission', label: 'Emission', icon: Sparkles, color: 'purple' },
];

const QUICK_PRESETS = [
    { id: 'metal', name: 'Metal', channels: { albedo: true, roughness: true, metalness: true, normal: true, emission: false } },
    { id: 'wood', name: 'Wood', channels: { albedo: true, normal: true, roughness: true, metalness: false, emission: false } },
    { id: 'plastic', name: 'Plastic', channels: { albedo: true, roughness: true, metalness: false, normal: false, emission: false } },
    { id: 'stone', name: 'Stone', channels: { albedo: true, normal: true, roughness: true, metalness: false, emission: false } },
    { id: 'glow', name: 'Glow', channels: { albedo: true, emission: true, roughness: false, metalness: false, normal: false } },
    { id: 'glass', name: 'Glass', channels: { albedo: true, roughness: true, metalness: false, normal: true, emission: false } },
];

// ============================================================================
// ACCENT COLOR THEMES
// ============================================================================

const ACCENT_THEMES = {
    rose: {
        primary: 'rose-500',
        primaryDark: 'rose-900',
        ring: 'rose-500/50',
        gradient: 'from-rose-900/20 to-purple-900/20',
        border: 'rose-500/30',
        text: 'rose-400',
    },
    blue: {
        primary: 'blue-500',
        primaryDark: 'blue-900',
        ring: 'blue-500/50',
        gradient: 'from-blue-900/20 to-cyan-900/20',
        border: 'blue-500/30',
        text: 'blue-400',
    },
    emerald: {
        primary: 'emerald-500',
        primaryDark: 'emerald-900',
        ring: 'emerald-500/50',
        gradient: 'from-emerald-900/20 to-teal-900/20',
        border: 'emerald-500/30',
        text: 'emerald-400',
    },
    purple: {
        primary: 'purple-500',
        primaryDark: 'purple-900',
        ring: 'purple-500/50',
        gradient: 'from-purple-900/20 to-pink-900/20',
        border: 'purple-500/30',
        text: 'purple-400',
    },
    amber: {
        primary: 'amber-500',
        primaryDark: 'amber-900',
        ring: 'amber-500/50',
        gradient: 'from-amber-900/20 to-orange-900/20',
        border: 'amber-500/30',
        text: 'amber-400',
    },
};

// ============================================================================
// MATERIAL PREVIEW COMPONENT (3D Sphere)
// ============================================================================

function MaterialPreview({ material, size = 'md' }: { material: KMaterialAsset | null; size?: 'sm' | 'md' | 'lg' }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const frameRef = useRef<number>(0);

    const sizeClasses = {
        sm: 'h-24',
        md: 'h-40',
        lg: 'h-56',
    };

    useEffect(() => {
        if (!canvasRef.current || !material) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const w = rect.width || 200;
        const h = rect.height || 200;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        camera.position.z = 2.5;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        rendererRef.current = renderer;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
        keyLight.position.set(5, 5, 5);
        scene.add(keyLight);

        const rimLight = new THREE.PointLight(0x3b82f6, 2.0, 20);
        rimLight.position.set(-5, 2, -5);
        scene.add(rimLight);

        const fillLight = new THREE.PointLight(0xa855f7, 0.8, 15);
        fillLight.position.set(0, -3, 3);
        scene.add(fillLight);

        let cancelled = false;
        let geometry: THREE.BufferGeometry = new THREE.SphereGeometry(1, 64, 64);

        // Use the unified material resolver
        const mat = resolveToThreeStandardMaterial(material);
        const sphere = new THREE.Mesh(geometry, mat);
        scene.add(sphere);

        // Try to use high-quality primitive
        (async () => {
            try {
                const g = await spawnPrimitiveToThree('sphere', { subdivisions: 5 });
                if (cancelled) {
                    g.dispose();
                    return;
                }
                sphere.geometry.dispose();
                sphere.geometry = g;
            } catch (e) {
                // Fallback already set
            }
        })();

        const animate = () => {
            if (cancelled) return;
            frameRef.current = requestAnimationFrame(animate);
            sphere.rotation.y += 0.003;
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelled = true;
            cancelAnimationFrame(frameRef.current);
            renderer.dispose();
            geometry.dispose();
            mat.dispose();
        };
    }, [material]);

    if (!material) {
        return (
            <div className={`${sizeClasses[size]} w-full rounded-xl bg-[#0a0a0a] border border-dashed border-[#333] flex items-center justify-center`}>
                <div className="text-center">
                    <Box className="w-8 h-8 mx-auto text-gray-700 mb-2" />
                    <div className="text-[9px] text-gray-600 uppercase tracking-widest">No Material Selected</div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${sizeClasses[size]} w-full relative rounded-xl overflow-hidden bg-gradient-to-br from-[#0a0a0a] to-[#111] border border-[#222]`}>
            <canvas ref={canvasRef} className="w-full h-full" />
            {/* Material name overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-white truncate">{material.name}</div>
                        <div className="text-[8px] text-gray-500 uppercase tracking-wider">
                            {material.workflow === 'metalRough' ? 'PBR Metal/Rough' : 'PBR Spec/Gloss'}
                        </div>
                    </div>
                    <div className="flex gap-1">
                        {getKMaterialBakedMaps(material).normal && (
                            <div className="w-2 h-2 rounded-full bg-blue-500" title="Normal" />
                        )}
                        {getKMaterialBakedMaps(material).roughness && (
                            <div className="w-2 h-2 rounded-full bg-green-500" title="Roughness" />
                        )}
                        {getKMaterialBakedMaps(material).metallic && (
                            <div className="w-2 h-2 rounded-full bg-yellow-500" title="Metallic" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// MATERIAL GRID COMPONENT
// ============================================================================

function MaterialGrid({
    materials,
    activeMaterial,
    onSelect,
    onDelete,
    columns = 3,
    accent = 'rose',
}: {
    materials: KMaterialAsset[];
    activeMaterial: KMaterialAsset | null;
    onSelect: (mat: KMaterialAsset) => void;
    onDelete?: (id: string) => void;
    columns?: 2 | 3 | 4;
    accent?: keyof typeof ACCENT_THEMES;
}) {
    const theme = ACCENT_THEMES[accent];
    const gridCols = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

    if (!materials || materials.length === 0) {
        return (
            <div className="py-8 text-center border border-dashed border-[#222] rounded-xl bg-[#0a0a0a]/50">
                <Library className="w-8 h-8 mx-auto text-gray-700 mb-2" />
                <div className="text-[10px] text-gray-600 italic">No Materials in Library</div>
                <div className="text-[8px] text-gray-700 mt-1">Generate or import materials to get started</div>
            </div>
        );
    }

    return (
        <div className={`grid ${gridCols[columns]} gap-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1`}>
            {materials.map((mat) => {
                const isActive = activeMaterial?.id === mat.id;
                const previewUrl = getKMaterialPreviewUrl(mat);

                return (
                    <button
                        key={mat.id}
                        onClick={() => onSelect(mat)}
                        className={`group relative aspect-square rounded-lg border-2 overflow-hidden transition-all duration-200 ${isActive
                                ? `border-${theme.primary} ring-2 ring-${theme.ring} scale-[0.97]`
                                : 'border-[#333] hover:border-white/50 hover:scale-[0.98]'
                            }`}
                        title={mat.name}
                    >
                        {previewUrl ? (
                            <img
                                src={previewUrl}
                                className="w-full h-full object-cover"
                                alt={mat.name}
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] flex items-center justify-center">
                                <Box className="w-6 h-6 text-gray-700" />
                            </div>
                        )}

                        {/* Hover overlay with name */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="absolute bottom-0 left-0 right-0 p-2">
                                <div className="text-[9px] font-bold text-white truncate">{mat.name}</div>
                            </div>
                        </div>

                        {/* Active indicator */}
                        {isActive && (
                            <div className={`absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-${theme.primary} border-2 border-black shadow-lg`}>
                                <Check className="w-2 h-2 text-white m-0.5" />
                            </div>
                        )}

                        {/* Delete button */}
                        {onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(mat.id); }}
                                className="absolute top-1.5 left-1.5 p-1 rounded bg-red-900/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-all"
                                title="Delete Material"
                            >
                                <Trash2 size={10} />
                            </button>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ============================================================================
// FLUX PARAMS COMPONENT
// ============================================================================

function FluxParams({
    params,
    onChange,
    accent = 'rose',
}: {
    params: MaterialParams;
    onChange: (params: MaterialParams) => void;
    accent?: keyof typeof ACCENT_THEMES;
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    const sliders = [
        { key: 'scale', label: 'UV Scale', min: 0.1, max: 5, step: 0.1, color: 'white' },
        { key: 'normalStrength', label: 'Normal', min: 0.001, max: 5, step: 0.01, color: 'purple-400' },
        { key: 'roughnessContrast', label: 'Roughness', min: 0.1, max: 3, step: 0.1, color: 'green-400' },
        { key: 'metalBias', label: 'Metalness', min: -100, max: 100, step: 1, color: 'yellow-400' },
        { key: 'hue', label: 'Hue Shift', min: 0, max: 360, step: 1, color: 'pink-400' },
        { key: 'wear', label: 'Wear/Grunge', min: 0, max: 0.5, step: 0.01, color: 'amber-400' },
        { key: 'displacementScale', label: 'Displacement', min: 0, max: 0.5, step: 0.01, color: 'blue-400' },
    ];

    return (
        <div className="bg-[#0a0a0a] rounded-xl border border-[#222] overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#111] transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Settings size={12} className="text-gray-500" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">FLUX Parameters</span>
                </div>
                {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
            </button>

            {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-[#222]">
                    {sliders.map(({ key, label, min, max, step, color }) => (
                        <div key={key} className="pt-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className={`text-[9px] font-bold text-${color} uppercase tracking-wider`}>{label}</span>
                                <span className="text-[9px] text-white font-mono">
                                    {(params[key as keyof MaterialParams] as number).toFixed(key === 'hue' || key === 'metalBias' ? 0 : 2)}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={min}
                                max={max}
                                step={step}
                                value={params[key as keyof MaterialParams] as number}
                                onChange={(e) => onChange({ ...params, [key]: parseFloat(e.target.value) })}
                                className="w-full h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer accent-white"
                            />
                        </div>
                    ))}

                    {/* Seamless toggle */}
                    <button
                        onClick={() => onChange({ ...params, makeSeamless: !params.makeSeamless })}
                        className={`w-full flex items-center justify-center gap-2 py-2 mt-2 rounded-lg text-[9px] font-bold border transition-all ${params.makeSeamless
                                ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400'
                                : 'bg-[#111] border-[#333] text-gray-500 hover:border-white/30'
                            }`}
                    >
                        <Grid3X3 size={12} />
                        {params.makeSeamless ? 'SEAMLESS: ON' : 'SEAMLESS: OFF'}
                    </button>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// CHANNEL TOGGLES COMPONENT
// ============================================================================

function ChannelToggles({
    channels,
    onChange,
    presets,
}: {
    channels: Record<string, boolean>;
    onChange: (channels: Record<string, boolean>) => void;
    presets?: boolean;
}) {
    return (
        <div className="space-y-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Paint Channels</div>

            <div className="space-y-1.5">
                {CHANNEL_LIST.map(({ id, label, icon: Icon, color }) => {
                    const isActive = channels[id];
                    return (
                        <button
                            key={id}
                            onClick={() => onChange({ ...channels, [id]: !isActive })}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${isActive
                                    ? `bg-${color}-900/30 border-${color}-500/50 text-${color}-400`
                                    : 'bg-[#0a0a0a] border-[#222] text-gray-500 hover:border-white/30'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Icon size={14} />
                                <span className="text-[10px] font-bold">{label}</span>
                            </div>
                            <div className={`w-3 h-3 rounded-full border-2 transition-all ${isActive ? `bg-${color}-500 border-${color}-400` : 'border-gray-600'
                                }`} />
                        </button>
                    );
                })}
            </div>

            {presets && (
                <>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-2">Quick Presets</div>
                    <div className="grid grid-cols-3 gap-1.5">
                        {QUICK_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                onClick={() => onChange(preset.channels)}
                                className="px-2 py-1.5 text-[8px] font-bold rounded-lg border border-[#333] bg-[#0a0a0a] hover:border-white/50 hover:bg-[#111] text-gray-400 hover:text-white transition-all uppercase tracking-wider"
                            >
                                {preset.name}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================

function SectionHeader({ icon: Icon, label }: { icon: any; label: string }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <Icon size={12} className="text-gray-500" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UnifiedMaterialDock({
    materials,
    activeMaterial,
    onSelect,
    onCommit,
    onDelete,
    onDuplicate,
    mode = 'full',
    showPreview = true,
    showFluxParams = true,
    showChannelToggles = false,
    showQuickPresets = false,
    showActions = true,
    currentColor,
    processImage,
    channels = { albedo: true, normal: false, roughness: false, metalness: false, emission: false },
    onChannelsChange,
    accentColor = 'rose',
}: UnifiedMaterialDockProps) {
    const [fluxParams, setFluxParams] = useState<MaterialParams>(DEFAULT_PARAMS);
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const theme = ACCENT_THEMES[accentColor];

    // Handle texture upload
    const handleTextureUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !processImage || !onCommit) return;

        setIsGenerating(true);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const base = processImage(img, null, 'base', fluxParams);
                const normal = processImage(img, null, 'normal', fluxParams);
                const roughness = processImage(img, null, 'roughness', fluxParams);
                const metallic = processImage(img, null, 'metallic', fluxParams);

                if (base) {
                    onCommit({
                        name: file.name.replace(/\.[^/.]+$/, ''),
                        base,
                        normal,
                        roughness,
                        metallic,
                        preview: base,
                    });
                }
                setIsGenerating(false);
            };
            img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
    }, [processImage, onCommit, fluxParams]);

    // Create from color
    const handleCreateFromColor = useCallback(() => {
        if (!currentColor || !processImage || !onCommit) return;

        setIsGenerating(true);
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = currentColor;
            ctx.fillRect(0, 0, 512, 512);

            const img = new Image();
            img.onload = () => {
                const base = processImage(img, null, 'base', fluxParams);
                const normal = processImage(img, null, 'normal', fluxParams);
                const roughness = processImage(img, null, 'roughness', fluxParams);
                const metallic = processImage(img, null, 'metallic', fluxParams);

                if (base) {
                    onCommit({
                        name: `Color_${currentColor.substring(1)}`,
                        base,
                        normal,
                        roughness,
                        metallic,
                        preview: base,
                    });
                }
                setIsGenerating(false);
            };
            img.src = canvas.toDataURL();
        }
    }, [currentColor, processImage, onCommit, fluxParams]);

    // ========== RENDER: PICKER MODE ==========
    if (mode === 'picker') {
        return (
            <div className="p-3 bg-[#0a0a0a] rounded-xl border border-[#222]">
                <MaterialGrid
                    materials={materials}
                    activeMaterial={activeMaterial}
                    onSelect={onSelect}
                    columns={4}
                    accent={accentColor}
                />
            </div>
        );
    }

    // ========== RENDER: COMPACT MODE ==========
    if (mode === 'compact') {
        return (
            <div className="flex flex-col gap-3 p-3 bg-[#0a0a0a]">
                {showPreview && activeMaterial && (
                    <MaterialPreview material={activeMaterial} size="sm" />
                )}
                <MaterialGrid
                    materials={materials}
                    activeMaterial={activeMaterial}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    columns={3}
                    accent={accentColor}
                />
            </div>
        );
    }

    // ========== RENDER: FULL MODE ==========
    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">

                {/* === MATERIAL LIBRARY === */}
                <section>
                    <SectionHeader icon={Library} label="Material Library" />
                    <MaterialGrid
                        materials={materials}
                        activeMaterial={activeMaterial}
                        onSelect={onSelect}
                        onDelete={onDelete}
                        columns={3}
                        accent={accentColor}
                    />
                </section>

                {/* === 3D PREVIEW === */}
                {showPreview && (
                    <section>
                        <SectionHeader icon={Eye} label="Material Preview" />
                        <MaterialPreview material={activeMaterial} size="md" />
                    </section>
                )}

                {/* === ACTIONS === */}
                {showActions && (onCommit || onDuplicate) && (
                    <section className="border-t border-[#222] pt-4">
                        <SectionHeader icon={Wand2} label="Create Material" />
                        <div className="space-y-2">
                            {/* Upload texture */}
                            {processImage && (
                                <>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isGenerating}
                                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#333] bg-[#111] hover:bg-gradient-to-r hover:${theme.gradient} hover:border-${theme.primary}/50 text-gray-400 hover:text-white transition-all disabled:opacity-50`}
                                    >
                                        <UploadCloud size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                            {isGenerating ? 'Processing...' : 'Import Texture'}
                                        </span>
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleTextureUpload}
                                        className="hidden"
                                    />
                                </>
                            )}

                            {/* Create from color */}
                            {currentColor && processImage && (
                                <button
                                    onClick={handleCreateFromColor}
                                    disabled={isGenerating || !currentColor}
                                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#333] bg-[#111] hover:bg-gradient-to-r hover:${theme.gradient} hover:border-${theme.primary}/50 text-gray-400 hover:text-white transition-all disabled:opacity-50`}
                                >
                                    <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: currentColor }} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">
                                        From Current Color
                                    </span>
                                </button>
                            )}

                            {/* Duplicate active */}
                            {onDuplicate && activeMaterial && (
                                <button
                                    onClick={() => onDuplicate(activeMaterial)}
                                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-[#333] bg-[#111] hover:border-white/30 text-gray-500 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider"
                                >
                                    <Copy size={14} />
                                    Duplicate Selected
                                </button>
                            )}
                        </div>
                    </section>
                )}

                {/* === FLUX PARAMS === */}
                {showFluxParams && (
                    <section>
                        <FluxParams
                            params={fluxParams}
                            onChange={setFluxParams}
                            accent={accentColor}
                        />
                    </section>
                )}

                {/* === CHANNEL TOGGLES === */}
                {showChannelToggles && onChannelsChange && (
                    <section className="border-t border-[#222] pt-4">
                        <ChannelToggles
                            channels={channels}
                            onChange={onChannelsChange}
                            presets={showQuickPresets}
                        />
                    </section>
                )}
            </div>

            {/* === FOOTER === */}
            <div className="shrink-0 p-3 border-t border-[#222] bg-[#0a0a0a]">
                <div className={`bg-gradient-to-br ${theme.gradient} border border-${theme.border} rounded-xl p-3`}>
                    <div className={`text-[8px] font-bold text-${theme.text} uppercase tracking-widest mb-1`}>
                        🔥 K_OS Material System
                    </div>
                    <div className="text-[7px] text-gray-500 leading-relaxed">
                        Universal PBR materials • Schema v1 • {materials.length} in library
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MaterialPreview, MaterialGrid, FluxParams, ChannelToggles };

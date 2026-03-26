
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Activity, Scaling, Move, Box, Stamp, CircuitBoard, Aperture, Package, Palette, Layers } from 'lucide-react';
import { initGraphosEngine } from './KGraphosEngine';
import KGraphosCursor from './KGraphosCursor';
import KGraphosBrushMenu from './KGraphosBrushMenu';
import KGraphosSpaceMenu from './KGraphosSpaceMenu';
import KGraphosLayerMenu from './KGraphosLayerMenu';
import { FloatingMaterialPicker } from '@/ui/materials';
import AlphaMenu from '@/ui/widgets/AlphaMenu';
import { useGraphosInput } from './useGraphosInput';
import { useRegisterQuickMenuCommands } from '@/ui/shell/quickMenuRegistry';
import { GRAPHOS_SIMS } from './KGraphosSpaceMenu';
// AppShell integration
import { AppShell } from '@/ui/shell/AppShell';
import { AppMenuBar } from '@/ui/shell/AppMenuBar';
import TopBar from './ui/TopBar';
import LeftPanel from './ui/LeftPanel';
import RightPanel from './ui/RightPanel';
import {
    DEFAULT_GRAPHOS_SELECTION_MODE,
    DEFAULT_GRAPHOS_TOOL,
    GraphosSelectionMode,
    GraphosSelectionPreview,
    GraphosTool,
} from './tools';
import { invoke } from '@tauri-apps/api/core';
import { frameStateForLayer, upsertLayerKeyframe } from './animationUtils';

const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

// Default brush preset definitions — data-driven so adding presets is trivial
const DEFAULT_BRUSHES = [
    { id: 'INK', label: 'INK', icon: 'PenTool', hardness: 1.0, flow: 1.0, opacity: 1.0 },
    { id: 'SOFT', label: 'SOFT', icon: 'Brush', hardness: 0.0, flow: 0.5, opacity: 0.8 },
    { id: 'CHISEL', label: 'CHISEL', icon: 'Square', hardness: 1.0, flow: 0.8, opacity: 1.0 },
    { id: 'SKETCH', label: 'SKETCH', icon: 'Highlighter', hardness: 0.5, flow: 0.2, opacity: 0.6 },
    { id: 'WASH', label: 'WASH', icon: 'Droplet', hardness: 0.2, flow: 0.1, opacity: 0.4 },
    { id: 'ERASE', label: 'ERASE', icon: 'Eraser', hardness: 0.8, flow: 1.0, opacity: 1.0 },
    { id: 'SCATTER', label: 'CHAOS', icon: 'Shuffle', hardness: 0.5, flow: 0.5, opacity: 0.8 },
    { id: 'FILL', label: 'FILL', icon: 'PaintBucket', hardness: 1.0, flow: 1.0, opacity: 1.0 },
];

const DEFAULT_BRUSH_STATE = {
    size: 50,
    opacity: 1.0,
    flow: 1.0,
    hardness: 0.5,
    color: '#000000',
    alphaMap: null as any,
    isSeamless: false,
    spacing: 0.1,
    erase: false,
    tool: 'INK',
    angle: 0.0,
    jitterPos: 0.0,
    jitterSize: 0.0,
    jitterAngle: 0.0,
    jitterHue: 0.0,
    symmetry: 'NONE' as string,
};

const DEFAULT_SIM_STATE: Record<string, boolean> = {
    drip: false, bleed: false, liquify: false, gravity: false, rivulet: false,
    growth: false, wind: false, magnetic: false, datamosh: false, nebula: false,
    thermal: false, sort: false, life: false, vortex: false, erosion: false,
};

const DEFAULT_SIM_PARAMS = { speed: 1.0, chaos: 0.5, decay: 0.95, scale: 1.0 };

export default function KGraphos({ sharedState, onCommit, onAlphaCommit, onMaterialCommit, ...props }: any) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<any>(null);

    const [isEngineReady, setIsEngineReady] = useState(false);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
    const [layers, setLayers] = useState<any[]>([]);
    const [isHoveringViewport, setIsHoveringViewport] = useState(false);
    const [isSpaceHeld, setIsSpaceHeld] = useState(false);
    const [canvasConfig, setCanvasConfig] = useState({ width: 2048, height: 2048 });
    const [gpuMode, setGpuMode] = useState(true);
    const [activeTool, setActiveTool] = useState<GraphosTool>(DEFAULT_GRAPHOS_TOOL);
    const [selectionMode, setSelectionMode] = useState<GraphosSelectionMode>(DEFAULT_GRAPHOS_SELECTION_MODE);
    const [wandTolerance, setWandTolerance] = useState(28);
    const [selectionPreview, setSelectionPreview] = useState<GraphosSelectionPreview>({ rect: null, lasso: null });
    const [selectionBounds, setSelectionBounds] = useState<{ u0: number; v0: number; u1: number; v1: number } | null>(null);
    const [timeline, setTimeline] = useState({ frame: 1, maxFrames: 120, fps: 12, playing: false });

    // Smooth zoom/pan animation
    const targetZoom = useRef(1.0);
    const currentZoom = useRef(1.0);
    const targetPan = useRef(new THREE.Vector2(0, 0));
    const zoomWorldPoint = useRef<THREE.Vector2 | null>(null);
    const zoomScreenPoint = useRef<THREE.Vector2 | null>(null);
    const isZooming = useRef(false);
    const [displayZoom, setDisplayZoom] = useState(1.0);

    // Material painting
    const [materialMode, setMaterialMode] = useState(false);
    const [activeMaterial, setActiveMaterial] = useState<any>(null);
    const [materialChannels, setMaterialChannels] = useState({
        albedo: true, normal: false, roughness: false, metalness: false, emission: false
    });

    // Brushes
    const [savedBrushes, setSavedBrushes] = useState(DEFAULT_BRUSHES);
    const [brush, setBrush] = useState(DEFAULT_BRUSH_STATE);

    const handleBrushCommit = (newBrush: any) => {
        setSavedBrushes(prev => [...prev, newBrush]);
    };

    // Pop-up menus
    const [showBrushMenuState, setShowBrushMenuState] = useState({ show: false, x: 0, y: 0 });
    const [showSpaceMenuState, setShowSpaceMenuState] = useState({ show: false, x: 0, y: 0 });
    const [showLayerMenuState, setShowLayerMenuState] = useState({ show: false, x: 0, y: 0 });
    const [showAlphaMenuState, setShowAlphaMenuState] = useState({ show: false, x: 0, y: 0 });
    const [showMaterialMenuState, setShowMaterialMenuState] = useState({ show: false, x: 0, y: 0 });

    // Simulation state
    const [activeSims, setActiveSims] = useState<Record<string, boolean>>(DEFAULT_SIM_STATE);
    const [simParams, setSimParams] = useState(DEFAULT_SIM_PARAMS);

    // Keep a ref so animation loop can read latest values without stale closure
    const simStateRef = useRef({ activeSims, simParams, activeLayerId, gpuMode });
    useEffect(() => { simStateRef.current = { activeSims, simParams, activeLayerId, gpuMode }; },
        [activeSims, simParams, activeLayerId, gpuMode]);

    // Quick-menu command registration
    const graphosQuickMenuCommands = React.useMemo(
        () => GRAPHOS_SIMS.map((s) => ({
            id: `graphos:sim:${s.id}`,
            label: `Toggle ${s.label}`,
            description: s.desc,
            icon: s.icon,
            keywords: ['graphos', 'sim', s.id, s.label],
            category: 'K-GRAPHOS / Sims',
            action: () => setActiveSims((prev) => ({ ...prev, [s.id]: !prev[s.id] })),
        })),
        []
    );
    useRegisterQuickMenuCommands('kgraphos', graphosQuickMenuCommands as any);

    // Load material textures when activeMaterial changes
    useEffect(() => {
        if (activeMaterial) {
            const loader = new THREE.TextureLoader();
            const load = (url: string) => new Promise<THREE.Texture | null>(r => {
                if (!url) r(null);
                else loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; r(t); });
            });
            const maps = activeMaterial.baked?.maps || {};
            const baseColor = maps.baseColor || activeMaterial.base || '';
            const normal = maps.normal || activeMaterial.normal || '';
            const roughness = maps.roughness || activeMaterial.roughness || '';
            const metallic = maps.metallic || activeMaterial.metallic || '';
            const emissive = maps.emissive || activeMaterial.emissive || '';
            Promise.all([load(baseColor), load(normal), load(roughness), load(metallic), load(emissive)])
                .then(([alb, nrm, rgh, met, ems]) => {
                    if (nrm) nrm.colorSpace = THREE.LinearSRGBColorSpace;
                    if (rgh) rgh.colorSpace = THREE.LinearSRGBColorSpace;
                    if (met) met.colorSpace = THREE.LinearSRGBColorSpace;
                    if (engineRef.current) engineRef.current.loadedTextures = { albedo: alb, normal: nrm, roughness: rgh, metalness: met, emission: ems };
                });
        } else if (engineRef.current) {
            engineRef.current.loadedTextures = null;
        }
    }, [activeMaterial]);

    // Engine init + animation loop
    useEffect(() => {
        if (!canvasRef.current || !viewportRef.current) return;
        // Guard against Strict Mode double-init
        if (engineRef.current) return;

        const engine = initGraphosEngine(canvasRef.current, viewportRef.current, canvasConfig);
        engineRef.current = engine;

        // Create default background layer
        const bgId = `layer_bg_${Date.now()}`;
        engine.addLayer(bgId, 'Background', [1, 1, 1, 1]);
        setLayers([{
            id: bgId, name: 'Background', visible: true, opacity: 1.0,
            blendMode: 'source-over',
            keyframes: [], transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
        }]);
        setActiveLayerId(bgId);
        setIsEngineReady(true);

        setTimeout(() => {
            if (engineRef.current) {
                engineRef.current.fitToScreen();
                targetZoom.current = engineRef.current.zoom;
                currentZoom.current = engineRef.current.zoom;
                engineRef.current.compose();
            }
        }, 100);

        let frameId: number;

        const animate = () => {
            frameId = requestAnimationFrame(animate);
            const r = engineRef.current;
            const state = simStateRef.current;
            if (!r) return;

            // Smooth zoom/pan interpolation
            const diffZoom = targetZoom.current - currentZoom.current;
            const diffPanX = targetPan.current.x - r.pan.x;
            const diffPanY = targetPan.current.y - r.pan.y;

            if (Math.abs(diffZoom) > 0.0001 || Math.abs(diffPanX) > 0.1 || Math.abs(diffPanY) > 0.1) {
                isZooming.current = true;
                currentZoom.current = lerp(currentZoom.current, targetZoom.current, 0.15);
                r.pan.x = lerp(r.pan.x, targetPan.current.x, 0.15);
                r.pan.y = lerp(r.pan.y, targetPan.current.y, 0.15);
                r.setTransform(currentZoom.current, r.pan);
                setDisplayZoom(currentZoom.current);

                if (Math.abs(diffZoom) < 0.001 && Math.abs(diffPanX) < 0.1 && Math.abs(diffPanY) < 0.1) {
                    zoomWorldPoint.current = null;
                    zoomScreenPoint.current = null;
                    isZooming.current = false;
                }
            } else {
                isZooming.current = false;
            }

            // Run GPU simulations on active layer
            if (state.gpuMode && state.activeLayerId) {
                const layer = r.getLayer(state.activeLayerId);
                if (layer) {
                    let needsUpdate = false;

                    // Core sims
                    if (state.activeSims.drip) { r.runSim(state.activeLayerId, 'DRIP', state.simParams); needsUpdate = true; }
                    if (state.activeSims.bleed) { r.runSim(state.activeLayerId, 'BLEED', state.simParams); needsUpdate = true; }
                    if (state.activeSims.liquify) { r.runSim(state.activeLayerId, 'LIQUIFY', state.simParams); needsUpdate = true; }
                    if (state.activeSims.rivulet) { r.runSim(state.activeLayerId, 'RIVULET', state.simParams); needsUpdate = true; }
                    if (state.activeSims.growth) { r.runSim(state.activeLayerId, 'GROWTH', state.simParams); needsUpdate = true; }

                    // Advanced sims
                    if (state.activeSims.wind) { r.runSim(state.activeLayerId, 'WIND', state.simParams); needsUpdate = true; }
                    if (state.activeSims.magnetic) { r.runSim(state.activeLayerId, 'MAGNETIC', state.simParams); needsUpdate = true; }
                    if (state.activeSims.datamosh) { r.runSim(state.activeLayerId, 'DATAMOSH', state.simParams); needsUpdate = true; }
                    if (state.activeSims.nebula) { r.runSim(state.activeLayerId, 'NEBULA', state.simParams); needsUpdate = true; }
                    if (state.activeSims.thermal) { r.runSim(state.activeLayerId, 'THERMAL', state.simParams); needsUpdate = true; }
                    if (state.activeSims.sort) { r.runSim(state.activeLayerId, 'SORT', state.simParams); needsUpdate = true; }
                    if (state.activeSims.life) { r.runSim(state.activeLayerId, 'LIFE', state.simParams); needsUpdate = true; }
                    if (state.activeSims.vortex) { r.runSim(state.activeLayerId, 'VORTEX', state.simParams); needsUpdate = true; }

                    if (needsUpdate) r.needsUpdate = true;
                }
            }

            // Compose + render
            if (r.needsUpdate) {
                r.compose();
                r.needsUpdate = false;
            }
        };

        animate();

        const handleResize = () => {
            if (engineRef.current) {
                engineRef.current.fitToScreen();
                targetZoom.current = engineRef.current.zoom;
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', handleResize);
            if (engine) engine.dispose();
            engineRef.current = null;
        };
    }, []);

    const handleCanvasResize = (size: number) => {
        if (engineRef.current) {
            engineRef.current.resize(size, size);
            setCanvasConfig({ width: size, height: size });
        }
    };

    // Layer operations
    const handleLayerAdd = useCallback(() => {
        if (!engineRef.current || !isEngineReady) return;
        const id = `layer_${Date.now()}`;
        engineRef.current.addLayer(id, `Layer ${layers.length + 1}`, [0, 0, 0, 0]);
        setLayers(prev => [...prev, {
            id,
            name: `Layer ${prev.length + 1}`,
            visible: true,
            opacity: 1.0,
            blendMode: 'source-over',
            keyframes: [],
            transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
        }]);
        setActiveLayerId(id);
    }, [isEngineReady, layers.length]);

    const handleLayerDelete = useCallback((id: string) => {
        if (!engineRef.current) return;
        engineRef.current.deleteLayer(id);
        setLayers(prev => {
            const next = prev.filter(l => l.id !== id);
            if (activeLayerId === id) setActiveLayerId(next.length > 0 ? next[next.length - 1].id : null);
            return next;
        });
    }, [activeLayerId]);

    const handleLayerVisibility = useCallback((id: string, solo: boolean) => {
        if (!engineRef.current) return;
        if (solo) {
            setLayers(prev => prev.map(l => {
                const isTarget = l.id === id;
                const engLayer = engineRef.current.getLayer(l.id);
                if (engLayer) engLayer.visible = isTarget;
                return { ...l, visible: isTarget };
            }));
        } else {
            const layer = engineRef.current.getLayer(id);
            if (layer) {
                layer.visible = !layer.visible;
                setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: layer.visible } : l));
            }
        }
        engineRef.current.compose();
    }, []);

    const handleLayerOpacity = useCallback((id: string, opacity: number) => {
        if (!engineRef.current) return;
        const layer = engineRef.current.getLayer(id);
        if (layer) {
            layer.opacity = opacity;
            setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l));
            engineRef.current.compose();
        }
    }, []);

    const handleLayerBlendMode = useCallback((id: string, blendMode: GlobalCompositeOperation) => {
        if (!engineRef.current) return;
        engineRef.current.setLayerBlendMode?.(id, blendMode);
        setLayers(prev => prev.map(l => l.id === id ? { ...l, blendMode } : l));
    }, []);

    const handleUndo = useCallback(() => {
        if (!engineRef.current) return;
        if (engineRef.current.undo?.()) engineRef.current.compose?.();
    }, []);

    const applyFrameToEngine = useCallback((frame: number) => {
        if (!engineRef.current) return;
        setLayers(prev => {
            const next = prev.map((l: any) => {
                const st = frameStateForLayer(l, frame);
                const eng = engineRef.current.getLayer(l.id);
                if (eng) {
                    eng.visible = st.visible;
                    eng.opacity = st.opacity;
                    if (st.blendMode) engineRef.current.setLayerBlendMode?.(l.id, st.blendMode);
                }
                return { ...l, visible: st.visible, opacity: st.opacity, blendMode: st.blendMode };
            });
            engineRef.current.compose?.();
            return next;
        });
    }, []);

    const addKeyframeAtCurrentFrame = useCallback(() => {
        if (!activeLayerId) return;
        setLayers(prev => prev.map((l: any) => {
            if (l.id !== activeLayerId) return l;
            const keyframes = upsertLayerKeyframe(l.keyframes, {
                frame: timeline.frame,
                visible: l.visible,
                opacity: l.opacity,
                blendMode: l.blendMode ?? 'source-over',
            });
            return { ...l, keyframes };
        }));
    }, [activeLayerId, timeline.frame]);

    const handleCompileKainShader = useCallback(async (source: string): Promise<string> => {
        const request = {
            entry: `graphos_shader_${Date.now()}`,
            source,
            targets: ['spirv', 'hlsl', 'wasm'],
            toolchain: {
                enabled: true,
                kainRoot: 'M:/Code/Kain',
                asmCrateDir: 'M:/Code/Kain/crates/kain-asm',
                webCrateDir: 'M:/Code/Kain/crates/web',
                cliBin: 'kain',
            },
        };
        await invoke('kain_compile_multi_target', { request });
        return 'Kain compile completed (check backend artifacts)';
    }, []);

    const handleRedo = useCallback(() => {
        if (!engineRef.current) return;
        if (engineRef.current.redo?.()) engineRef.current.compose?.();
    }, []);

    // Export
    const handleExport = (type: 'PNG' | 'JPEG' | 'ALPHA' | 'SAMPLE') => {
        if (!engineRef.current) return;
        engineRef.current.exportImage((blob: Blob) => {
            if (type === 'ALPHA' && onAlphaCommit) {
                onAlphaCommit({ name: `Graphos_Alpha_${Date.now()}`, url: URL.createObjectURL(blob) });
            } else if (type === 'SAMPLE') {
                const url = URL.createObjectURL(blob);
                if ((props as any).setTempImage) (props as any).setTempImage(url);
                if ((props as any).switchModule) (props as any).switchModule('autopbr');
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Graphos_${Date.now()}.${type === 'JPEG' ? 'jpg' : 'png'}`;
                a.click();
            }
        }, type === 'JPEG' ? 'JPEG' : 'PNG');
    };

    // Menu lock state (for keeping radial menus open)
    const [lockedMenus, setLockedMenus] = useState<Set<string>>(new Set());
    const toggleMenuLock = (menuId: string) => {
        setLockedMenus(prev => {
            const next = new Set(prev);
            if (next.has(menuId)) next.delete(menuId); else next.add(menuId);
            return next;
        });
    };

    // Context menu → brush menu
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setShowBrushMenuState(prev => ({ show: !prev.show, x: e.clientX, y: e.clientY }));
        if (!lockedMenus.has('alpha')) setShowAlphaMenuState(prev => ({ ...prev, show: false }));
        if (!lockedMenus.has('space')) setShowSpaceMenuState(prev => ({ ...prev, show: false }));
        if (!lockedMenus.has('material')) setShowMaterialMenuState(prev => ({ ...prev, show: false }));
    };

    // Keyboard hotkeys
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.matches('input, textarea')) return;

            const key = e.key.toLowerCase();

            if (key === 'b') {
                e.preventDefault();
                if (e.shiftKey) {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect) setShowBrushMenuState({ show: !showBrushMenuState.show, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                } else {
                    setActiveTool('brush');
                    setBrush(prev => ({ ...prev, erase: false }));
                }
            }
            if (key === 'e') {
                e.preventDefault();
                setActiveTool('eraser');
                setBrush(prev => ({ ...prev, erase: true }));
            }
            if (key === 'v') {
                e.preventDefault();
                setActiveTool('move');
            }
            if (key === 'l') {
                e.preventDefault();
                if (e.shiftKey) {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect) setShowLayerMenuState({ show: !showLayerMenuState.show, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                } else {
                    setActiveTool('lasso');
                }
            }
            if (key === 'm') {
                e.preventDefault();
                if (e.shiftKey) {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect) setShowMaterialMenuState({ show: !showMaterialMenuState.show, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                } else {
                    setActiveTool('marquee');
                }
            }
            if (key === 'a') {
                e.preventDefault();
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) setShowAlphaMenuState({ show: !showAlphaMenuState.show, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
            }
            if (key === 'q') {
                if (lockedMenus.has('space')) return;
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) setShowSpaceMenuState(prev => ({ show: !prev.show, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }));
            }

            // Layer navigation
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setLayers(prev => {
                    const idx = prev.findIndex(l => l.id === activeLayerId);
                    if (idx < prev.length - 1) setActiveLayerId(prev[idx + 1].id);
                    return prev;
                });
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setLayers(prev => {
                    const idx = prev.findIndex(l => l.id === activeLayerId);
                    if (idx > 0) setActiveLayerId(prev[idx - 1].id);
                    return prev;
                });
            }

            // W = toggle active sims off, or enable wind
            if (key === 'w') {
                e.preventDefault();
                if (e.shiftKey) {
                    const activeKeys = Object.keys(activeSims).filter(k => activeSims[k]);
                    if (activeKeys.length > 0) {
                        const next = { ...activeSims };
                        activeKeys.forEach(k => next[k] = false);
                        setActiveSims(next);
                    } else {
                        setActiveSims(prev => ({ ...prev, wind: true }));
                    }
                } else {
                    setActiveTool('wand');
                }
            }

            if (e.key === 'Escape') {
                engineRef.current?.clearSelection?.();
                setSelectionPreview({ rect: null, lasso: null });
                setSelectionBounds(null);
            }

            if (key === 'k') {
                e.preventDefault();
                addKeyframeAtCurrentFrame();
            }

            if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
            }
            if (((e.ctrlKey || e.metaKey) && key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'z')) {
                e.preventDefault();
                handleRedo();
            }

            // S = solo active layer
            if (key === 's') {
                if (activeLayerId) { handleLayerVisibility(activeLayerId, true); engineRef.current?.compose(); }
            }

            // F = fit canvas
            if (key === 'f') {
                if (engineRef.current) {
                    engineRef.current.fitToScreen();
                    targetZoom.current = engineRef.current.zoom;
                    currentZoom.current = engineRef.current.zoom;
                    targetPan.current.set(engineRef.current.pan.x, engineRef.current.pan.y);
                    zoomWorldPoint.current = null;
                    zoomScreenPoint.current = null;
                }
            }
        };

        const trackMouse = (e: MouseEvent) => {
            (window as any).lastMouseX = e.clientX;
            (window as any).lastMouseY = e.clientY;
        };

        window.addEventListener('mousemove', trackMouse);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousemove', trackMouse);
        };
    }, [activeLayerId, layers, handleLayerVisibility, showSpaceMenuState.show, showBrushMenuState.show, showAlphaMenuState.show, activeSims, lockedMenus, showLayerMenuState.show, showMaterialMenuState.show, handleUndo, handleRedo, addKeyframeAtCurrentFrame]);

    useEffect(() => {
        if (!timeline.playing) return;
        const frameMs = Math.max(16, Math.floor(1000 / Math.max(1, timeline.fps)));
        const id = window.setInterval(() => {
            setTimeline(prev => {
                const nextFrame = prev.frame >= prev.maxFrames ? 1 : prev.frame + 1;
                applyFrameToEngine(nextFrame);
                return { ...prev, frame: nextFrame };
            });
        }, frameMs);
        return () => window.clearInterval(id);
    }, [timeline.playing, timeline.fps, applyFrameToEngine]);

    // Wire up gesture input
    useGraphosInput(
        canvasRef,
        viewportRef,
        engineRef,
        targetZoom,
        targetPan,
        zoomWorldPoint,
        zoomScreenPoint,
        setIsSpaceHeld,
        brush,
        activeLayerId,
        activeTool,
        selectionMode,
        wandTolerance,
        setSelectionPreview,
        setSelectionBounds
    );

    return (
        <div
            className="w-full h-full flex flex-col bg-[#000] overflow-hidden"
            style={{ userSelect: 'none', touchAction: 'none', position: 'relative' }}
        >
            <KGraphosCursor
                brush={brush}
                zoomRef={currentZoom}
                viewportRef={viewportRef}
                show={(isHoveringViewport || isZooming.current) && !isSpaceHeld && (activeTool === 'brush' || activeTool === 'eraser')}
            />

            {/* RADIAL MENUS */}
            <KGraphosBrushMenu
                visible={showBrushMenuState.show}
                position={{ x: showBrushMenuState.x, y: showBrushMenuState.y }}
                brush={brush}
                setBrush={setBrush}
                brushes={savedBrushes}
                onSelect={() => setShowBrushMenuState({ ...showBrushMenuState, show: false })}
                isLocked={lockedMenus.has('brush')}
                onToggleLock={() => toggleMenuLock('brush')}
            />
            <AlphaMenu
                visible={showAlphaMenuState.show}
                position={{ x: showAlphaMenuState.x, y: showAlphaMenuState.y }}
                alphas={sharedState?.alphas || []}
                activeAlpha={brush.alphaMap}
                onSelect={(alpha: any) => {
                    if (!alpha) {
                        setBrush(prev => ({ ...prev, alphaMap: null }));
                    } else {
                        const loader = new THREE.TextureLoader();
                        loader.load(alpha.url, (tex) => {
                            setBrush(prev => ({ ...prev, alphaMap: tex }));
                        });
                    }
                    setShowAlphaMenuState({ ...showAlphaMenuState, show: false });
                }}
            />
            <KGraphosSpaceMenu
                visible={showSpaceMenuState.show}
                position={{ x: showSpaceMenuState.x, y: showSpaceMenuState.y }}
                activeSims={activeSims}
                toggleSim={(id: string) => setActiveSims(prev => ({ ...prev, [id]: !prev[id] }))}
                simParams={simParams}
                setSimParams={setSimParams}
                onReset={() => {
                    if (activeLayerId && engineRef.current) {
                        const l = engineRef.current.getLayer(activeLayerId);
                        if (l) engineRef.current.paintEngine.clearLayer(l);
                        engineRef.current.compose();
                    }
                }}
                gpuMode={gpuMode}
                setGpuMode={setGpuMode}
                isLocked={lockedMenus.has('space')}
                onToggleLock={() => toggleMenuLock('space')}
            />
            <KGraphosLayerMenu
                visible={showLayerMenuState.show}
                position={{ x: showLayerMenuState.x, y: showLayerMenuState.y }}
                layers={layers}
                activeLayerId={activeLayerId}
                setActiveLayerId={setActiveLayerId}
                onAdd={handleLayerAdd}
                onDelete={handleLayerDelete}
                onToggleVisibility={handleLayerVisibility}
                onOpacityChange={handleLayerOpacity}
                onSelect={() => setShowLayerMenuState({ ...showLayerMenuState, show: false })}
            />
            <FloatingMaterialPicker
                visible={showMaterialMenuState.show}
                position={{ x: showMaterialMenuState.x, y: showMaterialMenuState.y }}
                materials={sharedState?.materials || []}
                activeMaterial={activeMaterial}
                onSelect={setActiveMaterial}
                onMaterialMode={setMaterialMode}
                onClose={() => setShowMaterialMenuState({ ...showMaterialMenuState, show: false })}
                accentColor="rose"
            />

            <AppShell
                menuBar={<AppMenuBar menus={[
                    {
                        label: 'File', items: [
                            { label: 'New Canvas', onSelect: () => { } },
                            { label: 'Export PNG', onSelect: () => handleExport('PNG') },
                            { label: 'Export JPEG', onSelect: () => handleExport('JPEG') },
                            { label: 'Commit as Alpha', onSelect: () => handleExport('ALPHA') },
                        ]
                    },
                    {
                        label: 'Edit', items: [
                            { label: 'Undo', onSelect: () => handleUndo() },
                            { label: 'Redo', onSelect: () => handleRedo() },
                            {
                                label: 'Clear Layer', onSelect: () => {
                                    if (activeLayerId && engineRef.current) {
                                        const l = engineRef.current.getLayer(activeLayerId);
                                        if (l) engineRef.current.paintEngine.clearLayer(l);
                                        engineRef.current.compose();
                                    }
                                }
                            },
                        ]
                    },
                    {
                        label: 'View', items: [
                            {
                                label: 'Fit Canvas', onSelect: () => {
                                    if (engineRef.current) {
                                        engineRef.current.fitToScreen();
                                        targetZoom.current = engineRef.current.zoom;
                                        currentZoom.current = engineRef.current.zoom;
                                    }
                                }
                            },
                        ]
                    },
                ]} />}
                topBar={
                    <TopBar
                        brush={brush}
                        setBrush={setBrush}
                        activeTool={activeTool}
                        setActiveTool={setActiveTool}
                        selectionMode={selectionMode}
                        setSelectionMode={setSelectionMode}
                        wandTolerance={wandTolerance}
                        setWandTolerance={setWandTolerance}
                        gpuMode={gpuMode}
                        setGpuMode={setGpuMode}
                        canvasConfig={canvasConfig}
                        onResize={handleCanvasResize}
                    />
                }
                left={{
                    tabs: [
                        {
                            id: 'alpha', label: 'Alpha', icon: Stamp, content: (
                                <LeftPanel tab="alpha" alphas={sharedState?.alphas || []} onAlphaCommit={onAlphaCommit} brush={brush} setBrush={setBrush} onBrushCommit={handleBrushCommit} engineRef={engineRef} activeLayerId={activeLayerId} handleExport={handleExport} onCompileKainShader={handleCompileKainShader} />
                            )
                        },
                        {
                            id: 'gen', label: 'Gen', icon: CircuitBoard, content: (
                                <LeftPanel tab="gen" alphas={sharedState?.alphas || []} onAlphaCommit={onAlphaCommit} brush={brush} setBrush={setBrush} onBrushCommit={handleBrushCommit} engineRef={engineRef} activeLayerId={activeLayerId} handleExport={handleExport} onCompileKainShader={handleCompileKainShader} />
                            )
                        },
                        {
                            id: 'filter', label: 'Filter', icon: Aperture, content: (
                                <LeftPanel tab="filter" alphas={sharedState?.alphas || []} onAlphaCommit={onAlphaCommit} brush={brush} setBrush={setBrush} onBrushCommit={handleBrushCommit} engineRef={engineRef} activeLayerId={activeLayerId} handleExport={handleExport} onCompileKainShader={handleCompileKainShader} />
                            )
                        },
                        {
                            id: 'export', label: 'Export', icon: Package, content: (
                                <LeftPanel tab="export" alphas={sharedState?.alphas || []} onAlphaCommit={onAlphaCommit} brush={brush} setBrush={setBrush} onBrushCommit={handleBrushCommit} engineRef={engineRef} activeLayerId={activeLayerId} handleExport={handleExport} onCompileKainShader={handleCompileKainShader} />
                            )
                        },
                    ],
                }}
                right={{
                    tabs: [
                        {
                            id: 'color', label: 'Color', icon: Palette, content: (
                                <RightPanel tab="color" brush={brush} setBrush={setBrush} projectMaterials={sharedState?.materials || []} activeMaterial={activeMaterial} setActiveMaterial={setActiveMaterial} materialMode={materialMode} setMaterialMode={setMaterialMode} materialChannels={materialChannels} setMaterialChannels={setMaterialChannels} engineRef={engineRef} onMaterialCommit={onMaterialCommit} layers={layers} activeLayerId={activeLayerId} setActiveLayerId={setActiveLayerId} onLayerAdd={handleLayerAdd} onLayerDelete={handleLayerDelete} onLayerVisibility={handleLayerVisibility} onLayerOpacity={handleLayerOpacity} onLayerBlendMode={handleLayerBlendMode} />
                            )
                        },
                        {
                            id: 'materials', label: 'PBR', icon: Box, content: (
                                <RightPanel tab="materials" brush={brush} setBrush={setBrush} projectMaterials={sharedState?.materials || []} activeMaterial={activeMaterial} setActiveMaterial={setActiveMaterial} materialMode={materialMode} setMaterialMode={setMaterialMode} materialChannels={materialChannels} setMaterialChannels={setMaterialChannels} engineRef={engineRef} onMaterialCommit={onMaterialCommit} layers={layers} activeLayerId={activeLayerId} setActiveLayerId={setActiveLayerId} onLayerAdd={handleLayerAdd} onLayerDelete={handleLayerDelete} onLayerVisibility={handleLayerVisibility} onLayerOpacity={handleLayerOpacity} onLayerBlendMode={handleLayerBlendMode} />
                            )
                        },
                        {
                            id: 'layers', label: 'Layers', icon: Layers, content: (
                                <RightPanel tab="layers" brush={brush} setBrush={setBrush} projectMaterials={sharedState?.materials || []} activeMaterial={activeMaterial} setActiveMaterial={setActiveMaterial} materialMode={materialMode} setMaterialMode={setMaterialMode} materialChannels={materialChannels} setMaterialChannels={setMaterialChannels} engineRef={engineRef} onMaterialCommit={onMaterialCommit} layers={layers} activeLayerId={activeLayerId} setActiveLayerId={setActiveLayerId} onLayerAdd={handleLayerAdd} onLayerDelete={handleLayerDelete} onLayerVisibility={handleLayerVisibility} onLayerOpacity={handleLayerOpacity} onLayerBlendMode={handleLayerBlendMode} />
                            )
                        },
                    ],
                }}
            >
                {/* VIEWPORT */}
                <div className="h-full w-full flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
                    <div
                        ref={viewportRef}
                        className={`flex-1 relative overflow-hidden bg-[#080808] ${isHoveringViewport ? 'cursor-none' : ''}`}
                        style={{ touchAction: 'none', minHeight: 0 }}
                        onContextMenu={handleContextMenu}
                        onPointerEnter={() => setIsHoveringViewport(true)}
                        onPointerLeave={() => setIsHoveringViewport(false)}
                    >
                        {/* Selection preview/overlay */}
                        {(selectionPreview.rect || selectionBounds) && (
                            <div
                                className="absolute border border-cyan-400/80 bg-cyan-400/10 pointer-events-none"
                                style={(() => {
                                    const r = selectionPreview.rect || selectionBounds!;
                                    const u0 = Math.min(r.u0, r.u1);
                                    const u1 = Math.max(r.u0, r.u1);
                                    const v0 = Math.min(r.v0, r.v1);
                                    const v1 = Math.max(r.v0, r.v1);
                                    const left = (engineRef.current?.pan?.x || 0) + u0 * canvasConfig.width * displayZoom;
                                    const top = (engineRef.current?.pan?.y || 0) + (1 - v1) * canvasConfig.height * displayZoom;
                                    const width = (u1 - u0) * canvasConfig.width * displayZoom;
                                    const height = (v1 - v0) * canvasConfig.height * displayZoom;
                                    return {
                                        left,
                                        top,
                                        width,
                                        height,
                                        boxShadow: '0 0 0 1px rgba(0,0,0,0.6) inset',
                                    };
                                })()}
                            />
                        )}
                        {selectionPreview.lasso && selectionPreview.lasso.length > 1 && (
                            <svg className="absolute inset-0 pointer-events-none overflow-visible">
                                <polyline
                                    fill="rgba(34,211,238,0.12)"
                                    stroke="rgba(34,211,238,0.9)"
                                    strokeWidth={1}
                                    points={selectionPreview.lasso.map((p) => {
                                        const x = (engineRef.current?.pan?.x || 0) + p.u * canvasConfig.width * displayZoom;
                                        const y = (engineRef.current?.pan?.y || 0) + (1 - p.v) * canvasConfig.height * displayZoom;
                                        return `${x},${y}`;
                                    }).join(' ')}
                                />
                            </svg>
                        )}
                        <canvas
                            ref={canvasRef}
                            className="absolute block touch-none"
                        />
                    </div>
                    {/* Status bar */}
                    <div className="h-8 shrink-0 bg-[#0a0a0a] border-t border-[#222] flex items-center justify-between px-4 text-[9px] z-10">
                        <div className="flex items-center gap-4 text-gray-500 font-bold">
                            <span className="flex items-center gap-2"><Scaling size={10} /> {(displayZoom * 100)?.toFixed(0)}%</span>
                            <span className="flex items-center gap-2"><Move size={10} /> {engineRef.current?.pan?.x.toFixed(0) || 0}, {engineRef.current?.pan?.y.toFixed(0) || 0}</span>
                            <span className="text-cyan-400/80 uppercase">{activeTool}</span>
                            {selectionBounds && <span className="text-cyan-300">Selection Active</span>}
                        </div>
                        <div className="flex items-center gap-2 text-rose-500 font-bold">
                            {gpuMode
                                ? <Activity size={10} className="animate-pulse" />
                                : <div className="w-2 h-2 rounded-full bg-gray-700" />
                            }
                            {gpuMode ? 'PHYSICS KERNEL ACTIVE' : 'STANDARD RENDERER'}
                        </div>
                    </div>
                    <div className="h-9 shrink-0 bg-[#060606] border-t border-[#1b1b1b] flex items-center gap-3 px-4 text-[10px]">
                        <button
                            onClick={() => setTimeline(prev => ({ ...prev, playing: !prev.playing }))}
                            className="px-2 py-1 rounded border border-[#333] text-cyan-300"
                        >
                            {timeline.playing ? 'Pause' : 'Play'}
                        </button>
                        <button
                            onClick={addKeyframeAtCurrentFrame}
                            className="px-2 py-1 rounded border border-[#333] text-emerald-300"
                            title="Add keyframe (K)"
                        >
                            +Key
                        </button>
                        <input
                            type="range"
                            min={1}
                            max={timeline.maxFrames}
                            value={timeline.frame}
                            onChange={(e) => {
                                const frame = Number(e.target.value);
                                setTimeline(prev => ({ ...prev, frame }));
                                applyFrameToEngine(frame);
                            }}
                            className="flex-1"
                        />
                        <span className="text-gray-300">F {timeline.frame}/{timeline.maxFrames}</span>
                        <input
                            type="number"
                            value={timeline.fps}
                            min={1}
                            max={60}
                            onChange={(e) => setTimeline(prev => ({ ...prev, fps: Math.max(1, Math.min(60, Number(e.target.value) || 12)) }))}
                            className="w-14 bg-[#0d0d0d] border border-[#2a2a2a] rounded px-1 py-0.5 text-center text-gray-200"
                            title="FPS"
                        />
                    </div>
                </div>
            </AppShell>
        </div>
    );
}

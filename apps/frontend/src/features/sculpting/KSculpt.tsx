import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { Activity, Paintbrush, Hexagon, Layers, Palette, Move, Zap } from 'lucide-react';

// Patch Three.js
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
import { AppShell } from '@/ui/shell/AppShell';
import { AppMenuBar } from '@/ui/shell/AppMenuBar';
import TopBar from './ui/TopBar';
import LeftPanel from './ui/LeftPanel';
import RightPanel from './ui/RightPanel';
import { KSculptQuickMenu } from './ui/QuickMenu';
import { applyBrushRust, applyBrushResultToGeometry, rustSculpt, rustSculptManager } from './engine/meshManager';
import { dispatchBrushPipeline, resolveBrushShaderName } from './engine/brushPipelineRouter';
import { rustRaycastManager } from '@/services/raycastClient';
import { rustSubdivide } from '@/services/subdivideClient';
import { rustMask, applyMaskResultToGeometry } from '@/services/maskClient';
import { ScreenspaceCursor } from './ui/ScreenspaceCursor';
import { useRegisterQuickMenuCommands } from '@/ui/shell/quickMenuRegistry';
import { ALL_BRUSHES, MATCAPS, MAX_HISTORY, HOVER_COLOR, getMatCapTexture, buildEnhancedMatcapMaterial, swapMatcapTexture } from './constants';
import { useFlux } from './engine/useFlux';
import { FluxPanel } from './ui/FluxPanel';
import { DEFAULT_FLUX_PARAMS } from './engine/fluxEngine';
import { MathBrushPanel } from '@/systems/kmath/MathBrushPanel';
import { MATH_BRUSH_REGISTRY, applyMathBrush, applyDisplacementToMesh } from '@/systems/kmath/mathBrushes';
import type { MathBrushId } from '@/systems/kmath/mathBrushes';
import { FlaskConical } from 'lucide-react';
import type { FluxMode, FluxParams } from './engine/fluxEngine';
import { useGlobalHotkeys } from '@/lib/hooks/useGlobalHotkeys';
import type { NativeGizmoResult, NativeGizmoTransform } from '@/services/gizmoClient';
import { rendererClient } from '@/services/rendererClient';
import type { SelectionResult as NativeSelectionResult, ViewportHandle } from '@/services/viewportClient';
import type { NativeViewportSyncSource } from '@/services/nativeViewportBridge';
import { useRegisterSharedViewport } from '@/features/viewport/sharedViewportSession';
// Model Mode
import { AppMode, DEFAULT_MODEL_STATE, ModelModeState, useIMMInteraction } from './model';
// Universal Primitive Library (Rust backend)
import { spawnPrimitiveToThree } from '@/lib/primitives';
// K_OS Object Registry for cross-app persistence
import { unregisterObject3D } from '@/systems/objects/meshRegistryBridge';
import { prepareForGLTFExport } from '@/systems/objects/meshRegistryBridge';
// Universal Brush System
import type { AlphaInfo } from '@/systems/brush';
import { brushClient, type KBrushAsset } from '@/services/brushClient';
import { compileKainMetaChainForBrush, isMetaphysicalBrush } from '@/services/kainMetaCompiler';
import { openKainAuthoringSession } from '@/kain';

// Constants imported from ./constants.ts

interface SculptLayer {
    id: string;
    name: string;
    visible: boolean;
    polyCount: number;
    materialId?: string; // ID of Kernel Material if assigned
}

interface KSculptRuntimeControls {
    enabled: boolean;
    enableRotate: boolean;
    enablePan: boolean;
    enableZoom: boolean;
    target: THREE.Vector3;
    update: () => void;
}

interface KSculptMoveData {
    indices: number[];
    weights: number[];
    initialPos: THREE.Vector3[];
    symIndices: number[];
    symWeights: number[];
    symInitialPos: THREE.Vector3[];
    grabPoint: THREE.Vector3;
    grabNormal: THREE.Vector3;
    screenPlane: THREE.Plane;
    dragStartMouse: {
        x: number;
        y: number;
    };
}

interface KSculptHistorySnapshot {
    layerId: string;
    pos: Float32Array;
    col: Float32Array;
    mask: Float32Array | null;
    uv: Float32Array | null;
    index: Uint32Array | null;
    count: number;
}

interface KSculptRuntimeSettings {
    activeTool: string;
    radius: number;
    intensity: number;
    symmetry: 'NONE' | 'X';
    mode: 'SCULPT' | 'TRANSFORM';
    activeLayerId: string | null;
    activeMaterial: any;
    brushMode: 'ADD' | 'SUB';
    activeAlpha: AlphaInfo | null;
    dynamicTopology: boolean;
    detailSize: number;
    activeColor: string;
    isSceneReady: boolean;
    isBevyActive: boolean;
    activeBrush: KBrushAsset | null;
    useNativeRenderer: boolean;
    isSculpting: boolean;
}

interface KSculptRuntimeState {
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    renderer: THREE.WebGLRenderer | null;
    controls: KSculptRuntimeControls;
    transformControl: any | null;
    raycaster: THREE.Raycaster;
    brushCursor: THREE.Mesh | null;
    symmetryCursor: THREE.Mesh | null;
    isSculpting: boolean;
    hoverPoint: THREE.Vector3 | null;
    hoverNormal: THREE.Vector3 | null;
    sculptHistory: KSculptHistorySnapshot[];
    historyIndex: number;
    moveData: KSculptMoveData | null;
    selectionBox: THREE.BoxHelper | null;
    topology: { build: (geometry: THREE.BufferGeometry) => void } | null;
    isBrushBusy: boolean;
    lastBrushTime: number;
    tick: (() => void) | null;
    lastBrushPoint: THREE.Vector3 | null;
    lastNdcX?: number;
    lastNdcY?: number;
    settings: KSculptRuntimeSettings;
}

function createNativeViewportSceneBootstrap() {
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 100);
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);

    const controls = {
        enabled: false,
        enableRotate: false,
        enablePan: false,
        enableZoom: false,
        target: new THREE.Vector3(0, 0, 0),
        update: () => {},
    };

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const cursorGeo = new THREE.RingGeometry(0.02, 0.03, 32);
    const brushCursor = new THREE.Mesh(
        cursorGeo,
        new THREE.MeshBasicMaterial({
            color: HOVER_COLOR,
            transparent: true,
            opacity: 0.8,
            depthTest: false,
            side: THREE.DoubleSide,
        })
    );
    brushCursor.visible = false;
    scene.add(brushCursor);

    const symmetryCursor = new THREE.Mesh(
        cursorGeo,
        new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.5,
            depthTest: false,
            side: THREE.DoubleSide,
        })
    );
    symmetryCursor.visible = false;
    scene.add(symmetryCursor);

    const selectionBox = new THREE.BoxHelper(undefined as any, 0xffaa00);
    selectionBox.visible = false;
    scene.add(selectionBox);

    return {
        scene,
        camera,
        controls,
        brushCursor,
        symmetryCursor,
        selectionBox,
    };
}

export default function KSculpt({ sharedState, onCommit, onAlphaCommit, performance }: any) {
    // --- UI STATE ---
    const [appMode, setAppMode] = useState<AppMode>('SCULPT');
    const [modelState, setModelState] = useState<ModelModeState>(DEFAULT_MODEL_STATE);
    const [mode, setMode] = useState<'SCULPT' | 'TRANSFORM'>('SCULPT');
    const [activeTab, setActiveTab] = useState<'BRUSH' | 'GEO' | 'PRIMS' | 'DATA'>('BRUSH');

    // --- INITIALIZATION STATE ---
    const [isSceneReady, setIsSceneReady] = useState(false);

    // --- DATA-DRIVEN BRUSH SYSTEM ---
    const [activeBrush, setActiveBrush] = useState<KBrushAsset | null>(null);
    const [brushesLoaded, setBrushesLoaded] = useState(false);
    const [activeTool, setActiveTool] = useState('CLAY');
    const [radius, setRadius] = useState(0.5);
    const [intensity, setIntensity] = useState(0.5);
    const [wireframe, setWireframe] = useState(false);
    const [symmetry, setSymmetry] = useState<'NONE' | 'X'>('NONE');
    const [status, setStatus] = useState("KIPP SCULPT ENGINE");
    const [activeColor, setActiveColor] = useState('#ffffff');
    const [brushMode, setBrushMode] = useState<'ADD' | 'SUB'>('ADD');

    const [lastGpuStroke, setLastGpuStroke] = useState<{ usedGpu: boolean; reason: string | null; timeMs: number; affectedCount: number } | null>(null);

    // Dynamic Topology State
    const [dynamicTopology, setDynamicTopology] = useState(false);
    const [detailSize, setDetailSize] = useState(0.5);

    // KAIN SPIR-V Pipeline State
    const [useKainShaders, setUseKainShaders] = useState(false);
    const [pipelineStatus, setPipelineStatus] = useState<'WGSL' | 'KAIN' | 'KAIN_META'>('WGSL');

    // Update pipeline status when brush or toggle changes
    useEffect(() => {
        if (!activeBrush) {
            setPipelineStatus('WGSL');
            return;
        }

        const isSpirv = typeof activeBrush.kernel === 'object' && activeBrush.kernel?.family === 'spirv';

        if (useKainShaders && isSpirv) {
            setPipelineStatus(isMetaphysicalBrush(activeBrush) ? 'KAIN_META' : 'KAIN');
        } else {
            setPipelineStatus('WGSL');
        }
    }, [useKainShaders, activeBrush]);

    // BEVY INTEGRATION
    const [isBevyActive, setIsBevyActive] = useState(false); // Make React transparent
    const useNativeRenderer = true;
    const [nativeSelection, setNativeSelection] = useState<NativeSelectionResult | null>(null);
    const [nativeViewportHandle, setNativeViewportHandle] = useState<ViewportHandle | null>(null);

    // Transform Gizmo State
    const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
    const [transformSpace, setTransformSpace] = useState<'world' | 'local'>('world');
    const [snapEnabled, setSnapEnabled] = useState(false);

    const lastRot = useRef<{ x: number, y: number }>({ x: 0, y: 0 }); // Track last rotation for delta

    // Menus
    const [isBrushMenuOpen, setIsBrushMenuOpen] = useState(false);
    const [isAlphaMenuOpen, setIsAlphaMenuOpen] = useState(false);

    // Space Menu State
    const [isSpaceMenuOpen, setIsSpaceMenuOpen] = useState(false);
    const [isSpaceMenuLocked, setIsSpaceMenuLocked] = useState(false);
    const [isBrushMenuLocked, setIsBrushMenuLocked] = useState(false);
    const [simGpuMode, setSimGpuMode] = useState(true);

    const sculptQuickMenuCommands = React.useMemo(
        () =>
            ALL_BRUSHES.map((b) => ({
                id: `sculpt:brush:${b.id}`,
                label: `Set Tool: ${b.label}`,
                description: b.desc || `${b.category} brush`,
                icon: b.icon,
                keywords: ['sculpt', 'tool', 'brush', b.id, b.label, b.category],
                category: 'K-SCULPT / Brushes',
                action: () => {
                    setActiveTool(b.id);
                    setMode('SCULPT');
                },
            })),
        []
    );

    useRegisterQuickMenuCommands('ksculpt', sculptQuickMenuCommands as any);

    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const mousePosRef = useRef({ x: 0, y: 0 });

    // Keybind for Space Menu (Q) - hold to open, release to close (unless pinned)
    // Track if Q was pressed for menu to prevent typing in search bar
    const qKeyActiveRef = React.useRef(false);

    useEffect(() => {
        const isTextInput = (target: EventTarget | null) => {
            if (!target) return false;
            const el = target as HTMLElement;
            const tag = el.tagName?.toLowerCase();
            return tag === 'input' || tag === 'textarea' || (el as any).isContentEditable;
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() !== 'q') return;
            if (e.repeat) return;
            // Skip if already in a text input (not our menu's search)
            if (isTextInput(e.target) && !qKeyActiveRef.current) return;

            // Prevent the 'q' from being typed anywhere
            e.preventDefault();
            e.stopPropagation();

            qKeyActiveRef.current = true;
            setIsSpaceMenuOpen(true);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() !== 'q') return;

            // Only respond if we were the ones who opened it
            if (!qKeyActiveRef.current) return;

            e.preventDefault();
            e.stopPropagation();

            qKeyActiveRef.current = false;
            if (!isSpaceMenuLocked) setIsSpaceMenuOpen(false);
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (!isSceneReady) return;

            // Check if we're in sculpt mode and have a valid mesh
            if (mode !== 'SCULPT') return;

            // This function is not used in the current sculpting system
            // The actual sculpting happens in onPointerDown and the input tick loop
        };

        // Use capture phase to intercept before cmdk input gets it
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keyup', handleKeyUp, true);
        window.addEventListener('mousedown', handleMouseDown, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keyup', handleKeyUp, true);
        };
    }, [isSpaceMenuLocked]);

    // Track mouse for menu position
    const handleGlobalMouseMove = (e: MouseEvent) => {
        mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    useEffect(() => {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
    }, []);

    // Initialize data-driven brush system
    useEffect(() => {
        const initializeBrushes = async () => {
            try {
                if (!brushClient.isReady()) {
                    await brushClient.init();
                }

                // Set default brush
                const defaultBrush = brushClient.getDefaultBrush();
                setActiveBrush(defaultBrush);
                setBrushesLoaded(true);

                console.log('[KSculpt] Data-driven brush system initialized');
            } catch (error) {
                console.error('[KSculpt] Failed to initialize brush system:', error);
                setBrushesLoaded(true); // Still mark as loaded to avoid infinite loading
            }
        };

        initializeBrushes();
    }, []);

    // Layer System
    const [layers, setLayers] = useState<SculptLayer[]>([]);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
    const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(new Set());

    // Material / Alpha
    const [materialMode, setMaterialMode] = useState<'CLAY' | 'PBR'>('CLAY');
    const [activeMaterial, setActiveMaterial] = useState<any>(null);
    const [activeAlpha, setActiveAlpha] = useState<AlphaInfo | null>(null); // GPU Alpha for brush intensity modulation
    const [currentMatCap, setCurrentMatCap] = useState<string>('CLAY');
    const [showGrid, setShowGrid] = useState(true);

    // ── KFlux — Turbo Lightspeed Flux Capacitor ──────────────────────────────
    const [fluxActive, setFluxActive] = useState(false);
    const [fluxMode, setFluxMode] = useState<FluxMode>('PUSH');
    const [fluxParams, setFluxParams] = useState<FluxParams>(DEFAULT_FLUX_PARAMS);

    // ── KMath — Experimental Math Brushes ───────────────────────────────────
    const [activeMathBrush, setActiveMathBrush] = useState<MathBrushId | null>(null);
    // Per-brush params: { SPECTRAL_SMOOTH: { lambda: 0.5, ... }, ... }
    const [mathBrushParams, setMathBrushParams] = useState<Record<string, Record<string, number | boolean | string>>>(
        () => Object.fromEntries(
            Object.values(MATH_BRUSH_REGISTRY).map(def => [
                def.id,
                Object.fromEntries(def.params.map(p => [p.key, p.default]))
            ])
        )
    );
    const [mathBrushStats, setMathBrushStats] = useState<{ computeMs: number; affectedVerts: number } | null>(null);

    const sceneRef = useRef<KSculptRuntimeState>({
        scene: null, camera: null, renderer: null, controls: null,
        transformControl: null, raycaster: new THREE.Raycaster(),
        brushCursor: null, symmetryCursor: null,
        isSculpting: false, hoverPoint: null, hoverNormal: null,
        sculptHistory: [], historyIndex: -1, moveData: null,
        selectionBox: null,
        topology: null,
        isBrushBusy: false,
        lastBrushTime: 0,
        tick: null as (() => void) | null,
        lastBrushPoint: null,
        settings: {
            activeTool: 'CLAY',
            radius: 0.5,
            intensity: 0.5,
            symmetry: 'X',
            mode: 'SCULPT',
            activeLayerId: null as string | null,
            activeMaterial: null as any,
            brushMode: 'ADD' as 'ADD' | 'SUB',
            activeAlpha: null as AlphaInfo | null,
            dynamicTopology: false,
            detailSize: 0.5,
            activeColor: '#ffffff',
            isSceneReady: false,
            isBevyActive: false,
            activeBrush: null as KBrushAsset | null,
            useNativeRenderer: false,
            isSculpting: false,
        }
    });
    const meshStoreRef = useRef<Map<string, THREE.Mesh>>(new Map());

    const getMeshById = React.useCallback((id: string | null | undefined): THREE.Mesh | null => {
        if (!id) return null;
        return meshStoreRef.current.get(id) ?? null;
    }, []);

    const hasMeshById = React.useCallback((id: string | null | undefined): boolean => {
        if (!id) return false;
        return meshStoreRef.current.has(id);
    }, []);

    const activeNativeMeshHandle = React.useMemo(() => {
        if (!activeLayerId) return null;
        const mesh = getMeshById(activeLayerId);
        if (!mesh) return null;
        return rustSculptManager.getHandle(mesh);
    }, [activeLayerId, getMeshById, layers]);
    const nativeSyncSource = React.useMemo<NativeViewportSyncSource>(() => {
        if (activeNativeMeshHandle == null) return { kind: 'none' };
        return { kind: 'sculpt-handle', sculptHandle: activeNativeMeshHandle };
    }, [activeNativeMeshHandle]);

    const getActiveNativeMesh = React.useCallback((): THREE.Mesh | null => {
        return getMeshById(activeLayerId);
    }, [activeLayerId, getMeshById]);

    const findMeshIdByObject = React.useCallback((object: THREE.Object3D): string | null => {
        for (const [id, mesh] of meshStoreRef.current.entries()) {
            if (mesh.uuid === object.uuid) {
                return id;
            }
        }
        return null;
    }, []);

    const flashSelectionBox = React.useCallback((mesh: THREE.Mesh, durationMs: number) => {
        if (useNativeRenderer) {
            return;
        }

        const selectionBox = sceneRef.current.selectionBox;
        if (!selectionBox) {
            return;
        }

        selectionBox.setFromObject(mesh);
        selectionBox.visible = true;
        window.setTimeout(() => {
            selectionBox.visible = false;
        }, durationMs);
    }, [useNativeRenderer]);

    const syncActiveMeshToNativeRenderer = React.useCallback(async () => {
        const mesh = getActiveNativeMesh();
        const sculptHandle = mesh ? rustSculptManager.getHandle(mesh) : null;
        const viewport = nativeViewportHandle;
        if (!mesh || sculptHandle == null || viewport == null) return;

        try {
            await rendererClient.syncSculptMesh(viewport, sculptHandle);
            setStatus(`NATIVE VIEWPORT SYNCED: ${mesh.name || 'SCULPT MESH'}`);
        } catch (error) {
            console.error('[KSculpt] Failed to sync active mesh to native renderer:', error);
            setStatus('NATIVE VIEWPORT SYNC FAILED');
        }
    }, [getActiveNativeMesh, nativeViewportHandle]);

    const applyNativeSelectionBrush = React.useCallback(async (selection: NativeSelectionResult | null) => {
        if (!selection?.hit || !selection.position || !selection.normal) return;
        const mesh = getActiveNativeMesh();
        if (!mesh) return;

        const point = new THREE.Vector3(...selection.position);
        const normal = new THREE.Vector3(...selection.normal);

        sceneRef.current.hoverPoint = point;
        sceneRef.current.hoverNormal = normal;

        if (activeTool === 'MOVE' || activeTool === 'STRETCH') {
            setStatus('NATIVE VIEWPORT MOVE/STRETCH NOT WIRED YET');
            return;
        }

        const handle = rustSculptManager.getHandle(mesh);
        if (!handle) return;

        const invMat = mesh.matrixWorld.clone();
        if (Math.abs(invMat.determinant()) < 1e-9) return;
        invMat.invert();
        const localPoint = point.clone().applyMatrix4(invMat);
        const localNormal = normal.clone().transformDirection(invMat).normalize();
        const scale = new THREE.Vector3();
        mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
        const safeScale = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3 || 1;
        const localRadius = radius / safeScale;
        const brushId = sceneRef.current.settings?.activeTool || activeTool;

        const result = await rustSculpt.applyBrush(
            handle,
            [localPoint.x, localPoint.y, localPoint.z],
            [localNormal.x, localNormal.y, localNormal.z],
            brushId,
            localRadius,
            brushMode === 'SUB' ? -intensity : intensity,
            symmetry,
            true,
            activeAlpha?.handle ?? null,
            null
        );

        if (result) {
            applyBrushResultToGeometry(mesh.geometry, result);
            flux.syncMesh();
        }
    }, [activeAlpha?.handle, activeTool, brushMode, getActiveNativeMesh, intensity, radius, symmetry]);

    useEffect(() => {
        void syncActiveMeshToNativeRenderer();
    }, [activeLayerId, nativeViewportHandle, syncActiveMeshToNativeRenderer]);

    const toNativeGizmoTransform = React.useCallback((mesh: THREE.Mesh): NativeGizmoTransform => {
        return {
            translation: [mesh.position.x, mesh.position.y, mesh.position.z],
            rotation: [mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w],
            scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
        };
    }, []);

    const applyNativeTransformTargets = React.useCallback((targets: NativeGizmoTransform[], result: NativeGizmoResult | null) => {
        if (!activeLayerId || targets.length === 0) return;

        const mesh = getMeshById(activeLayerId);
        if (!mesh) return;

        const target = targets[0];
        mesh.position.set(target.translation[0], target.translation[1], target.translation[2]);
        mesh.quaternion.set(target.rotation[0], target.rotation[1], target.rotation[2], target.rotation[3]);
        mesh.scale.set(
            target.scale[0] || 0.001,
            target.scale[1] || 0.001,
            target.scale[2] || 0.001,
        );

        setTransformData({
            posX: mesh.position.x,
            posY: mesh.position.y,
            posZ: mesh.position.z,
            rotX: mesh.rotation.x,
            rotY: mesh.rotation.y,
            rotZ: mesh.rotation.z,
            scaleX: mesh.scale.x,
            scaleY: mesh.scale.y,
            scaleZ: mesh.scale.z,
        });

        if (result) {
            setStatus(`NATIVE GIZMO: ${result.kind.toUpperCase()}`);
        }

        void syncActiveMeshToNativeRenderer();
    }, [activeLayerId, getMeshById, syncActiveMeshToNativeRenderer]);

    const fluxMesh = React.useMemo(() => {
        if (!activeLayerId) return null;
        return getMeshById(activeLayerId);
    }, [activeLayerId, getMeshById]);

    const flux = useFlux({
        mesh: fluxMesh,
        params: fluxParams,
        active: fluxActive,
        onFreeze: (geo) => {
            // Push deformed geometry to sculpt history
            // Note: sceneRef and saveHistory are defined later — the closure
            // captures them correctly at call time (not at hook setup time).
            const mesh = getMeshById((window as any).__ksculptActiveLayerId ?? '');
            if (mesh) {
                mesh.geometry.dispose();
                mesh.geometry = geo;
                (window as any).__ksculptSaveHistory?.();
            }
        },
        renderer: sceneRef.current?.renderer ?? undefined,
        scene: sceneRef.current?.scene ?? undefined,
        camera: sceneRef.current?.camera ?? undefined,
    });

    const immDefaultMaterialRef = useRef<THREE.MeshStandardMaterial>(
        new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.6,
            metalness: 0.0,
            vertexColors: true,
        })
    );

    const prevMaterialModeRef = useRef<'CLAY' | 'PBR'>('CLAY');
    const prevActiveMaterialRef = useRef<any>(null);

    const altOrbitEnabledRef = useRef(false);

    const ensureSculptGeometryAttributes = (geo: THREE.BufferGeometry) => {
        const pos = geo.attributes.position as THREE.BufferAttribute | undefined;
        if (!pos) return;

        const count = pos.count;

        if (!geo.attributes.color) {
            geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
        }

        if (!geo.attributes.mask) {
            geo.setAttribute('mask', new THREE.BufferAttribute(new Float32Array(count).fill(0), 1));
        }

        // Ensure tangent attribute exists for PBR normal mapping
        if (!geo.attributes.tangent) {
            geo.computeTangents(); // Three.js built-in tangent computation
        }
    };

    // Computed values for UI
    const activePolyCount = layers.find(l => l.id === activeLayerId)?.polyCount || 0;
    const [subdivisionLevel, setSubdivisionLevel] = useState(0);
    const [extractionThickness, setExtractionThickness] = useState(0.01);

    // Subdivision Progress State
    const [subdivisionProgress, setSubdivisionProgress] = useState<{
        isSubdividing: boolean;
        progress: number;
        message: string;
    } | null>(null);

    // Transform State
    const [transformData, setTransformData] = useState({
        posX: 0, posY: 0, posZ: 0,
        rotX: 0, rotY: 0, rotZ: 0,
        scaleX: 1, scaleY: 1, scaleZ: 1
    });

    const mountRef = useRef<HTMLDivElement>(null);

    // --- INPUT TICK LOOP ---
    useEffect(() => {
        sceneRef.current.tick = () => {
            const { camera, raycaster, brushCursor, symmetryCursor, isSculpting, moveData, settings } = sceneRef.current;
            const meshes = meshStoreRef.current;
            if (!camera || !mountRef.current) return;
            if (settings.useNativeRenderer) {
                if (!settings.isSculpting) {
                    if (brushCursor) brushCursor.visible = false;
                    if (symmetryCursor) symmetryCursor.visible = false;
                }
                return;
            }

            const { activeTool, radius, symmetry, mode, activeLayerId } = settings;

            // 1. Calc NDC
            // We use the last known mouse pos from the ref
            const rect = mountRef.current.getBoundingClientRect();
            // Check if mouse is roughly inside? Logic might run globally if dragging.

            const mx = mousePosRef.current.x;
            const my = mousePosRef.current.y;

            const x = ((mx - rect.left) / rect.width) * 2 - 1;
            const y = -((my - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

            // --- LEASH IPC: SYNC WITH BEVY ---
            invoke('leash_cursor', { x, y }).catch(() => { });


            if (mode === 'SCULPT') {
                if (activeTool === 'SELECT') {
                    if (brushCursor) brushCursor.visible = false;
                    if (symmetryCursor) symmetryCursor.visible = false;
                    document.body.style.cursor = 'pointer';
                    return;
                }

                if (!activeLayerId || !meshes.has(activeLayerId)) return;
                const mesh = meshes.get(activeLayerId);

                // === RUST RAYCAST (fast cached async) ===
                // Fire async raycast request (throttled internally)
                const rayOrigin = raycaster.ray.origin;
                const rayDir = raycaster.ray.direction;
                rustRaycastManager.requestRaycast(mesh, rayOrigin, rayDir, 1000);

                // Get cached result for instant 60fps response
                const cachedHit = rustRaycastManager.getCachedHit();

                // During active sculpting, we need super-fresh hits, so fallback to JS briefly
                // Otherwise use the fast Rust cached result
                let hitPoint: THREE.Vector3 | null = null;
                let hitNormal: THREE.Vector3 | null = null;
                let hasHit = false;

                if (cachedHit) {
                    // Use Rust cached result (FAST)
                    hitPoint = new THREE.Vector3(cachedHit.point.x, cachedHit.point.y, cachedHit.point.z);
                    hitNormal = new THREE.Vector3(cachedHit.normal.x, cachedHit.normal.y, cachedHit.normal.z);
                    hasHit = true;
                } else {
                    // Fallback to JS when Rust cache is stale (during sculpting OR hovering)
                    // The JS BVH is still fast enough for cursor display
                    const intersects = raycaster.intersectObject(mesh);
                    if (intersects.length > 0) {
                        hitPoint = intersects[0].point;
                        hitNormal = intersects[0].face?.normal || new THREE.Vector3(0, 1, 0);
                        hasHit = true;
                    }
                }

                if (hasHit && hitPoint && hitNormal) {
                    // NEW: ScreenspaceCursor handles display (no gpuBrushCursor needed)
                    // gpuBrushCursor.update({ point: hitPoint, face: { normal: hitNormal } } as any, radius, symmetry);
                    sceneRef.current.hoverPoint = hitPoint;
                    sceneRef.current.hoverNormal = hitNormal;

                    // Hide old 3D cursors (legacy)
                    if (brushCursor) brushCursor.visible = false;
                    if (symmetryCursor) symmetryCursor.visible = false;

                    if (isSculpting && activeTool !== 'MOVE' && activeTool !== 'STRETCH') {
                        const isBevyActiveNow = settings.isBevyActive;

                        // Only apply JS sculpting if Bevy is NOT active
                        if (!isBevyActiveNow) {
                            applyBrush(hitPoint, hitNormal);
                        }

                        // --- LEASH IPC: SEND BRUSH STROKE TO BEVY ---
                        const toolMap: Record<string, number> = {
                            'CLAY': 0, 'SMOOTH': 1, 'FLATTEN': 2,
                            'GRAB': 3, 'MOVE': 4, 'SNAKE': 5
                        };
                        const toolId = toolMap[activeTool] ?? 0;

                        // Compute Delta (NDC)
                        const lastX = sceneRef.current.lastNdcX ?? x;
                        const lastY = sceneRef.current.lastNdcY ?? y;
                        const dx = x - lastX;
                        const dy = y - lastY;

                        // Send
                        invoke('leash_brush', { tool: toolId, radius, intensity, x, y, dx, dy }).catch(() => { });

                        // Update last
                        sceneRef.current.lastNdcX = x;
                        sceneRef.current.lastNdcY = y;
                    }

                } else if (!isSculpting) {
                    if (brushCursor) brushCursor.visible = false;
                    if (symmetryCursor) symmetryCursor.visible = false;
                    sceneRef.current.hoverPoint = null;
                }

                // --- MOVE & STRETCH DRAG LOGIC ---
                // Reuse existing move logic but ensure it runs here
                if (isSculpting && (activeTool === 'MOVE' || activeTool === 'STRETCH') && moveData) {
                    if (activeTool === 'STRETCH') {
                        const dy = (my - moveData.dragStartMouse.y);
                        const stretchFactor = dy * 0.01;
                        const worldDelta = moveData.grabNormal.clone().multiplyScalar(-stretchFactor);

                        const invMat = mesh.matrixWorld.clone();
                        if (Math.abs(invMat.determinant()) > 1e-9) {
                            invMat.invert();
                            const localDelta = worldDelta.clone().transformDirection(invMat);
                            const posAttr = mesh.geometry.attributes.position;
                            for (let i = 0; i < moveData.indices.length; i++) {
                                const idx = moveData.indices[i];
                                const w = moveData.weights[i];
                                const orig = moveData.initialPos[i];
                                const moveVec = localDelta.clone().multiplyScalar(w);
                                posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                            }
                            // Symmetry
                            if (symmetry === 'X' && moveData.symIndices) {
                                const symDelta = localDelta.clone(); symDelta.x *= -1;
                                for (let i = 0; i < moveData.symIndices.length; i++) {
                                    const idx = moveData.symIndices[i];
                                    const w = moveData.symWeights[i];
                                    const orig = moveData.symInitialPos[i];
                                    const moveVec = symDelta.clone().multiplyScalar(w);
                                    posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                                }
                            }
                            posAttr.needsUpdate = true;
                        }
                    } else {
                        // MOVE
                        const targetPoint = new THREE.Vector3();
                        raycaster.ray.intersectPlane(moveData.screenPlane, targetPoint);
                        if (targetPoint) {
                            const invMat = mesh.matrixWorld.clone();
                            if (Math.abs(invMat.determinant()) > 1e-9) {
                                invMat.invert();
                                const localTarget = targetPoint.clone().applyMatrix4(invMat);
                                const localGrab = moveData.grabPoint.clone().applyMatrix4(invMat);
                                const delta = localTarget.sub(localGrab);

                                const posAttr = mesh.geometry.attributes.position;
                                for (let i = 0; i < moveData.indices.length; i++) {
                                    const idx = moveData.indices[i];
                                    const w = moveData.weights[i];
                                    const orig = moveData.initialPos[i];
                                    const moveVec = delta.clone().multiplyScalar(w);
                                    posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                                }
                                if (symmetry === 'X' && moveData.symIndices) {
                                    const symDelta = delta.clone(); symDelta.x *= -1;
                                    for (let i = 0; i < moveData.symIndices.length; i++) {
                                        const idx = moveData.symIndices[i];
                                        const w = moveData.symWeights[i];
                                        const orig = moveData.symInitialPos[i];
                                        const moveVec = symDelta.clone().multiplyScalar(w);
                                        posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                                    }
                                }
                                posAttr.needsUpdate = true;
                            }
                        }
                    }
                    if (sceneRef.current.topology) {
                        // Deferred normal update? Or immediate? Immediate for visual feedback is fine in animate loop.
                        mesh.geometry.computeVertexNormals();
                        // Note: moveData logic recomputes normals every frame. Expensive? 
                        // Move brush affects many verts? Usually radius based. O(N_modified). OK.
                    } else {
                        mesh.geometry.computeVertexNormals();
                    }
                }
            } else {
                // Not in sculpt mode logic (Transform mode handled by controls)
            }
        };
    }, []); // Run once
    // --- STATE SYNC ---
    // Sync React state to Ref for the Animation Loop to access without closures
    useEffect(() => {
        const s = sceneRef.current.settings;
        s.activeTool = activeTool;
        s.radius = radius;
        s.intensity = intensity;
        s.symmetry = symmetry;
        s.mode = mode;
        s.activeLayerId = activeLayerId;
        s.activeMaterial = activeMaterial;
        s.brushMode = brushMode;
        s.activeAlpha = activeAlpha;
        s.dynamicTopology = dynamicTopology;
        s.detailSize = detailSize;
        s.activeColor = activeColor;
        // FIX: Sync these to ref to avoid stale closures in tick loop
        s.isSceneReady = isSceneReady;
        s.isBevyActive = isBevyActive;
        s.activeBrush = activeBrush;
        s.useNativeRenderer = useNativeRenderer;
        s.isSculpting = sceneRef.current.isSculpting;
    }, [activeTool, radius, intensity, symmetry, mode, activeLayerId, activeMaterial, brushMode, activeAlpha, dynamicTopology, detailSize, activeColor, isSceneReady, isBevyActive, activeBrush, useNativeRenderer]);

    // --- BRUSH PARAMETER SYNC ---
    // Update UI controls when a new brush is selected
    useEffect(() => {
        if (activeBrush && activeBrush.params) {
            console.log('[KSculpt] Updating brush parameters:', activeBrush.params);
            // Only update if values are different to prevent potential loops
            if (radius !== activeBrush.params.radius) {
                setRadius(activeBrush.params.radius || 0.5);
            }
            if (intensity !== (activeBrush.params.strength || activeBrush.params.intensity)) {
                setIntensity(activeBrush.params.strength || activeBrush.params.intensity || 0.5);
            }
        }
    }, [activeBrush?.id]); // Only trigger when brush ID changes, not on every render

    // --- IMM BRUSH INTERACTION (MODEL MODE) ---
    // Helper to get active mesh for IMM spawning
    const getActiveMesh = React.useCallback((): THREE.Mesh | null => {
        return getMeshById(activeLayerId);
    }, [activeLayerId, getMeshById]);

    // Helper to get subdivision level
    const getSubdivisionLevel = React.useCallback((): number => {
        return subdivisionLevel;
    }, [subdivisionLevel]);

    // Callback when mesh is updated by IMM
    const handleIMMUpdate = React.useCallback((mesh: THREE.Mesh) => {
        // IMM merge replaces geometry; ensure clay shader expectations still hold
        ensureSculptGeometryAttributes(mesh.geometry);

        // Recompute poly count
        const newPolyCount = mesh.geometry.attributes.position
            ? Math.floor(mesh.geometry.attributes.position.count / 3)
            : 0;

        setLayers(prev => prev.map(l =>
            l.id === activeLayerId
                ? { ...l, polyCount: newPolyCount }
                : l
        ));

        // Re-register with Rust backend for raycasting
        if (activeLayerId) {
            rustSculptManager.registerMesh(mesh);
            rustRaycastManager.registerMesh(mesh);
        }
    }, [activeLayerId]);

    // IMM Hook - handles drag-to-spawn in MODEL mode
    useIMMInteraction({
        mountRef: mountRef,
        sceneRef: sceneRef,
        appMode: appMode,
        activeShape: modelState.activeShape,
        modifiers: modelState.modifiers,
        userImports: modelState.userImports,
        getActiveMesh,
        getSubdivisionLevel,
        onMeshUpdated: handleIMMUpdate,
        onStatusChange: setStatus,
    });

    useEffect(() => {
        if (!sceneRef.current || !sceneRef.current.scene) return;

        let grid = sceneRef.current.scene.getObjectByName("KSculptGrid");
        if (showGrid) {
            if (!grid) {
                // USER REQUEST: Bigger grid (50, 50)
                grid = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
                grid.name = "KSculptGrid";
                grid.position.y = -1; // Sit slightly below unit sphere
                sceneRef.current.scene.add(grid);
            }
        } else {
            if (grid) {
                sceneRef.current.scene.remove(grid);
            }
        }
    }, [showGrid, sceneRef.current.scene]); // Add scene dependency to ensure it runs when scene is ready

    // Mouse tracking for menus
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // --- INIT ENGINE ---
    useEffect(() => {
        setIsSceneReady(false);

        const {
            scene,
            camera,
            controls,
            brushCursor,
            symmetryCursor: symCursor,
            selectionBox,
        } = createNativeViewportSceneBootstrap();

        // Track Rotation
        lastRot.current = { x: camera.rotation.x, y: camera.rotation.y };

        const updateAltOrbit = (altDown: boolean) => {
            altOrbitEnabledRef.current = altDown;
            const c = sceneRef.current.controls;
            if (!c) return;
            c.enableRotate = altDown;
            c.enablePan = altDown;
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Alt') updateAltOrbit(true);
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') updateAltOrbit(false);
        };

        const onBlur = () => {
            updateAltOrbit(false);
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);

        sceneRef.current = {
            ...sceneRef.current,
            scene,
            camera,
            renderer: null,
            controls,
            transformControl: null,
            brushCursor,
            symmetryCursor: symCursor,
            selectionBox,
        };

        // Force Grid Update now that scene is ready
        // We can cheat by toggling state or just manually calling if needed, 
        // but adding scene dependency to the grid effect is cleaner (did that above).
        // Trigger a fake update just in case? No, the dependency change on sceneRef.current.scene might not trigger react effect if ref changes but state doesn't.
        // ACTUALLY: sceneRef is a ref. Changing .current doesn't re-render. 
        // So the grid effect won't fire just because we set sceneRef.current here.
        // We need to validly trigger it.
        // Simple hack: We know showGrid is default true.
        // Let's manually add it here if showGrid is true, to be safe and instant.
        if (showGrid) {
            const grid = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
            grid.name = "KSculptGrid";
            grid.position.y = -1;
            scene.add(grid);
        }

        // Default Load
        // Clear any existing state to handle Strict Mode / Hot Reload
        meshStoreRef.current.clear();

        let mounted = true;

        const initializeWithDelay = () => {
            if (!mounted) return;

            // Small delay to ensure everything is settled
            setTimeout(() => {
                if (!mounted) return;

                loadPrimitive('SPHERE', () => {
                    if (mounted) {
                        setIsSceneReady(true);
                        console.log('[KSculpt] Scene fully initialized and ready');
                    }
                    return mounted; // Return boolean as expected by loadPrimitive
                });
            }, 100); // 100ms delay for WebGL context stabilization
        };

        initializeWithDelay();

        return () => {
            mounted = false;
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
            setLayers([]);
            meshStoreRef.current.clear();
        };
    }, []);

    useEffect(() => {
        const controls = sceneRef.current?.controls;
        if (!controls) return;
        controls.enabled = !useNativeRenderer;
        controls.enableRotate = !useNativeRenderer && altOrbitEnabledRef.current;
        controls.enablePan = !useNativeRenderer && altOrbitEnabledRef.current;
        controls.enableZoom = !useNativeRenderer;
    }, [useNativeRenderer]);

    // Update Gizmo Settings
    useEffect(() => {
        const r = sceneRef.current;
        const tc = r.transformControl;
        if (tc) {
            tc.setMode(gizmoMode);
            tc.setSpace(transformSpace);
            if (snapEnabled) {
                tc.setTranslationSnap(1.0);
                tc.setRotationSnap(THREE.MathUtils.degToRad(15));
                tc.setScaleSnap(0.25);
            } else {
                tc.setTranslationSnap(null);
                tc.setRotationSnap(null);
                tc.setScaleSnap(null);
            }
        }
    }, [gizmoMode, transformSpace, snapEnabled]);

    // --- LAYER MANAGEMENT ---

    const addMeshToScene = (mesh: THREE.Mesh, name: string, importedMaterial?: THREE.Material) => {
        const { scene } = sceneRef.current;

        // Sanitize Geometry
        let geo = mesh.geometry;
        ensureSculptGeometryAttributes(geo);

        geo.computeVertexNormals();
        geo.computeBoundingBox();

        // ENHANCED MATCAP MATERIAL (Default)
        // Built by matcapSystem — procedural texture + cavity/rim/SSS shader injection
        const clayMat = buildEnhancedMatcapMaterial(currentMatCap, { vertexColors: true });

        mesh.material = clayMat;
        mesh.userData.clayMaterial = clayMat; // Cache

        if (importedMaterial) {
            // Handle potential multi-material (take first)
            const pbrMat = Array.isArray(importedMaterial) ? importedMaterial[0] : importedMaterial;

            // Ensure vertex colors are enabled if geometry has them
            if (geo.attributes.color) {
                pbrMat.vertexColors = true;
            }

            pbrMat.side = THREE.DoubleSide; // Safety

            mesh.userData.originalPBR = pbrMat;

            // Auto-switch to PBR mode
            setMaterialMode('PBR');

            // Apply immediately to override Clay
            mesh.material = pbrMat;
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = name;
        mesh.userData.isSculptable = true;

        const id = mesh.uuid;
        scene.add(mesh);
        meshStoreRef.current.set(id, mesh);

        // Initialize BVH (Async if possible? Sync for now)
        // @ts-ignore
        mesh.geometry.computeBoundsTree();

        // Register with Rust backend for high-performance sculpting
        rustSculptManager.registerMesh(mesh).then((handle) => {
            if (handle) {
                console.log(`[KSculpt] Sculpt mesh registered: ${name} (handle: ${handle})`);
            }
        });

        // Register with Rust backend for high-performance raycasting (parry3d BVH)
        rustRaycastManager.registerMesh(mesh).then((handle) => {
            if (handle) {
                console.log(`[KSculpt] Raycast mesh registered: ${name} (handle: ${handle})`);
            }
        });

        // NOTE: We NO LONGER auto-register with KObjectRegistry here!
        // Objects only get kId when they go through Kernel (uplink/export)
        // This prevents scene trash from accumulating in the registry

        setLayers(prev => [...prev, {
            id,
            name,
            visible: true,
            polyCount: geo.attributes.position.count
        }]);
        setActiveLayerId(id);
        setSelectedLayerIds(new Set([id]));

        sceneRef.current.sculptHistory = [];
        sceneRef.current.historyIndex = -1;
        saveHistory();

        setStatus(`${name.toUpperCase()} ADDED`);
        return id;
    };

    // Force default PBR material in MODEL mode (IMM) to avoid matcap/mask shader fragility
    useEffect(() => {
        if (appMode === 'MODEL') {
            prevMaterialModeRef.current = materialMode;
            prevActiveMaterialRef.current = activeMaterial;
            setMaterialMode('PBR');
            setActiveMaterial(null);
        } else {
            setMaterialMode(prevMaterialModeRef.current);
            setActiveMaterial(prevActiveMaterialRef.current);
        }
    }, [appMode]);

    // --- MERGE LOGIC ---
    const mergeMeshes = (idsToMerge: string[], newName: string) => {
        const meshesToMerge: THREE.Mesh[] = [];
        idsToMerge.forEach(id => {
            const mesh = getMeshById(id);
            if (mesh) meshesToMerge.push(mesh);
        });

        if (meshesToMerge.length < 2) return;

        setStatus("FUSING GEOMETRY...");

        const geometries: THREE.BufferGeometry[] = [];

        meshesToMerge.forEach(mesh => {
            mesh.updateMatrixWorld();
            const geo = mesh.geometry.clone();
            geo.applyMatrix4(mesh.matrixWorld);
            geometries.push(geo);
        });

        try {
            const mergedGeo = BufferGeometryUtils.mergeGeometries(geometries);
            mergedGeo.computeVertexNormals();

            // Use material of the last mesh (active one usually)
            const targetMat = meshesToMerge[meshesToMerge.length - 1].material;
            const newMesh = new THREE.Mesh(mergedGeo, targetMat);

            // Cleanup old
            meshesToMerge.forEach(m => {
                sceneRef.current.scene.remove(m);
                m.geometry.dispose();
                meshStoreRef.current.delete(m.uuid);
            });

            // Update State
            setLayers(prev => prev.filter(l => !idsToMerge.includes(l.id)));

            // Add New
            addMeshToScene(newMesh, newName);
            setStatus("FUSION COMPLETE");

        } catch (e) {
            console.error(e);
            setStatus("MERGE FAILED");
        }
    };

    const handleMergeDown = (layerId: string) => {
        const layerIndex = layers.findIndex(l => l.id === layerId);
        if (layerIndex === -1 || layerIndex >= layers.length - 1) return;
        const topLayer = layers[layerIndex];
        const bottomLayer = layers[layerIndex + 1];
        mergeMeshes([topLayer.id, bottomLayer.id], `${bottomLayer.name}_Fused`);
    };

    const handleMergeSelected = () => {
        if (selectedLayerIds.size < 2) return;
        // Convert Set to Array and sort by current layer order
        const ids = Array.from(selectedLayerIds) as string[];
        // Sort ids based on their index in the layers array to maintain hierarchy logic if needed
        // but simple array is fine for now.
        mergeMeshes(ids, "Fused_Entity");
        setSelectedLayerIds(new Set());
    };

    const handleMergeAll = () => {
        if (layers.length < 2) return;
        const ids = layers.map(l => l.id);
        mergeMeshes(ids, "Fusion_All");
    };

    const handleApplyMaterial = (mat: any) => {
        if (!activeLayerId || !mat) {
            if (!mat) setActiveMaterial(null);
            return;
        }
        setActiveMaterial(mat);
        setLayers(prev => prev.map(l => {
            if (l.id === activeLayerId) {
                return { ...l, materialId: mat.id };
            }
            return l;
        }));
        if (materialMode === 'PBR') {
            updateMeshMaterial(activeLayerId, mat);
        }
    };

    const updateMeshMaterial = (layerId: string, kernelMat: any | null) => {
        const mesh = getMeshById(layerId);
        if (!mesh) return;

        if (!kernelMat) {
            if (mesh.userData.clayMaterial) {
                mesh.material = mesh.userData.clayMaterial;
            }
            return;
        }

        const loader = new THREE.TextureLoader();
        const load = (url: string) => url ? loader.load(url) : null;

        const newMat = new THREE.MeshStandardMaterial({
            map: load(kernelMat.base),
            normalMap: load(kernelMat.normal),
            normalMapType: THREE.TangentSpaceNormalMap, // Ensure tangent-space normals
            roughnessMap: load(kernelMat.roughness),
            metalnessMap: load(kernelMat.metallic),
            aoMap: load(kernelMat.ao),
            emissiveMap: load(kernelMat.emissive),
            displacementMap: load(kernelMat.height),
            displacementScale: 0.05,
            roughness: 1.0,
            metalness: 1.0,
            color: 0xffffff
        });
        mesh.material = newMat;
    };

    const handleOpenKainAuthoring = React.useCallback(() => {
        const shaderName = activeBrush?.kernel?.shader;
        const isSpirv = (activeBrush?.kernel as any)?.family === 'spirv' && typeof shaderName === 'string';
        if (isSpirv) {
            openKainAuthoringSession({
                path: `crates/k-os-kain/domains/sculpting/sculpt_${shaderName}.kn`,
                target: 'spirv',
                domain: 'sculpt',
                label: activeBrush?.name ? `${activeBrush.name} KAIN Shader` : 'Sculpt KAIN Shader',
                description: 'Author the active KSculpt brush shader in KAIN and rebuild it through the crate-owned pipeline.',
            });
            return;
        }

        openKainAuthoringSession({
            target: 'spirv',
            domain: 'sculpt',
            label: 'KSculpt Scratch Shader',
            description: 'Create or prototype a new sculpt brush shader in KAIN.',
            source: `// KSculpt scratch KAIN shader\nshader compute sculpt_custom_brush(id: UVec3) -> Vec4:\n    return vec4(0.0, 0.0, 0.0, 1.0)\n`,
        });
    }, [activeBrush]);

    // Sync Material Mode Changes
    useEffect(() => {
        layers.forEach(layer => {
            const mesh = getMeshById(layer.id);
            if (!mesh) return;

            // MODEL mode always uses a stable default PBR
            if (appMode === 'MODEL') {
                mesh.material = immDefaultMaterialRef.current;
                return;
            }

            if (materialMode === 'CLAY') {
                if (mesh.userData.clayMaterial) {
                    // Swap matcap texture in-place — no material rebuild needed
                    swapMatcapTexture(mesh.userData.clayMaterial, currentMatCap);
                    mesh.material = mesh.userData.clayMaterial;
                }
            } else {
                if (layer.materialId) {
                    const matData = sharedState?.materials?.find((m: any) => m.id === layer.materialId);
                    if (matData) {
                        updateMeshMaterial(layer.id, matData);
                    }
                } else if (mesh.userData.originalPBR) {
                    mesh.material = mesh.userData.originalPBR;
                }
            }
        });
    }, [appMode, currentMatCap, getMeshById, layers, materialMode, sharedState?.materials]);

    // Update Wireframe
    useEffect(() => {
        layers.forEach(layer => {
            const mesh = getMeshById(layer.id);
            if (mesh && mesh.material) {
                (mesh.material as any).wireframe = wireframe;
            }
        });
    }, [getMeshById, wireframe, layers]);

    // --- SELECTION & FRAME ---
    const handleLayerSelect = (id: string, multi: boolean) => {
        // Always set active for sculpting
        setActiveLayerId(id);

        if (multi) {
            const newSet = new Set(selectedLayerIds);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            setSelectedLayerIds(newSet);
        } else {
            // If simply clicking, we just select this one
            setSelectedLayerIds(new Set([id]));
        }

        const mesh = getMeshById(id);
        if (mesh) {
            flashSelectionBox(mesh, 500);
        }
    };

    const handleFrameActive = () => {
        if (!activeLayerId) return;
        const mesh = getMeshById(activeLayerId);
        if (!mesh) return;

        const r = sceneRef.current;
        if (!r.camera) return;
        const box = new THREE.Box3().setFromObject(mesh);
        const center = new THREE.Vector3(); box.getCenter(center);
        const size = new THREE.Vector3(); box.getSize(size);

        const radius = Math.max(size.x, size.y, size.z) / 2;
        const fov = r.camera.fov * (Math.PI / 180);
        let cameraDist = Math.abs(radius / Math.sin(fov / 2));
        cameraDist *= 1.5;

        const direction = new THREE.Vector3().subVectors(r.camera.position, r.controls.target).normalize();
        const newPos = center.clone().add(direction.multiplyScalar(cameraDist));

        r.camera.position.copy(newPos);
        r.controls.target.copy(center);
        r.controls.update();

        if (useNativeRenderer && nativeViewportHandle != null) {
            void rendererClient.setCamera(nativeViewportHandle, {
                position: [newPos.x, newPos.y, newPos.z],
                target: [center.x, center.y, center.z],
                up: [0, 1, 0],
                fovDegrees: r.camera.fov,
                near: r.camera.near,
                far: r.camera.far,
            }).then(() => rendererClient.requestRedraw(nativeViewportHandle));
        }

        setStatus("FRAMED ACTIVE");
    };

    const handleCycleLayer = (direction: number) => {
        if (layers.length === 0) return;

        const currentIdx = layers.findIndex(l => l.id === activeLayerId);
        if (currentIdx === -1) {
            setActiveLayerId(layers[0].id);
            return;
        }

        const newIdx = Math.max(0, Math.min(layers.length - 1, currentIdx + direction));
        if (newIdx !== currentIdx) {
            const newId = layers[newIdx].id;
            setActiveLayerId(newId);
            setSelectedLayerIds(new Set([newId]));

            const mesh = getMeshById(newId);
            if (mesh) {
                flashSelectionBox(mesh, 300);
            }
        }
    };

    const loadPrimitive = async (type: string, isValid?: () => boolean) => {
        // Map UI type names to Universal Primitive Library IDs
        const PRIMITIVE_MAP: Record<string, { id: string; subdivisions?: number }> = {
            'SPHERE': { id: 'sphere', subdivisions: 5 },  // Quad sphere, high detail
            'CUBE': { id: 'cube', subdivisions: 5 },      // Subdivided quad cube
            'CYLINDER': { id: 'cylinder' },
            'TORUS': { id: 'torus' },
            'PLANE': { id: 'plane', subdivisions: 5 },
            'ICOSA': { id: 'icosphere', subdivisions: 3 },
            'CONE': { id: 'cone' },
            'CAPSULE': { id: 'capsule' },
        };

        const primitiveConfig = PRIMITIVE_MAP[type];

        if (primitiveConfig) {
            try {
                setStatus(`GENERATING ${type} (RUST)...`);
                console.log(`[KSculpt] Using Universal Primitive Library: ${primitiveConfig.id}`);

                // Spawn from Rust backend
                let geo = await spawnPrimitiveToThree(primitiveConfig.id, {
                    subdivisions: primitiveConfig.subdivisions,
                });

                if (isValid && !isValid()) return;

                // Weld vertices for sculpting (Rust already does this, but safety check)
                try {
                    geo = BufferGeometryUtils.mergeVertices(geo, 1e-4);
                } catch (e) { }

                // Ensure required sculpt attributes
                const count = geo.attributes.position.count;
                if (!geo.attributes.color) {
                    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
                }
                if (!geo.attributes.mask) {
                    geo.setAttribute('mask', new THREE.Float32BufferAttribute(new Float32Array(count).fill(0), 1));
                }

                // Compute normals if missing
                if (!geo.attributes.normal) {
                    geo.computeVertexNormals();
                }

                // Initialize BVH
                // @ts-ignore
                if (!geo.boundsTree) geo.computeBoundsTree();

                const mesh = new THREE.Mesh(geo);
                const id = addMeshToScene(mesh, type);

                if (id) {
                    handleLayerSelect(id, false);
                    setStatus(`${type} CREATED (${count} vertices)`);
                    console.log(`[KSculpt] Primitive created: ${type} with ${count} vertices`);
                }
                return;
            } catch (error) {
                console.error(`[KSculpt] Universal Primitive failed for ${type}:`, error);
                setStatus(`FAILED TO GENERATE ${type} (RUST)`);
                return;
            }
        }
    };

    const loadFromStorage = (item: any) => {
        const url = URL.createObjectURL(item.blob);
        const loader = new GLTFLoader();
        setStatus(`IMPORTING ${item.name}...`);

        loader.load(url, (gltf) => {
            // USER FIX: Import Scaling
            // Problem: Previous logic centered and normalized EACH mesh individually, destroying assembly.
            // Fix: Bake transforms, calc Global Bounding Box, and normalize the GROUP.

            gltf.scene.updateMatrixWorld(true);

            // 1. Collect Valid Meshes
            const validMeshes: { mesh: THREE.Mesh, bakedGeo: THREE.BufferGeometry }[] = [];

            gltf.scene.traverse((c: any) => {
                if (c.isMesh) {
                    const geo = c.geometry.clone();
                    // Bake World Matrix to respect hierarchy
                    geo.applyMatrix4(c.matrixWorld);
                    validMeshes.push({ mesh: c, bakedGeo: geo });
                }
            });

            if (validMeshes.length === 0) {
                setStatus("NO MESHES FOUND");
                URL.revokeObjectURL(url);
                return;
            }

            // 2. Compute Global Bounds
            const globalBox = new THREE.Box3();
            validMeshes.forEach(vm => {
                vm.bakedGeo.computeBoundingBox();
                if (vm.bakedGeo.boundingBox) {
                    globalBox.union(vm.bakedGeo.boundingBox);
                }
            });

            // 3. Calc Normalization Transforms
            const center = new THREE.Vector3();
            globalBox.getCenter(center);
            const size = new THREE.Vector3();
            globalBox.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);

            const scaleFactor = (maxDim > 0) ? (2.0 / maxDim) : 1.0;
            const offset = center.clone().negate();

            // 4. Apply to all geometries
            validMeshes.forEach(({ mesh: originalMesh, bakedGeo }, index) => {
                // Translate to origin then Scale
                bakedGeo.translate(offset.x, offset.y, offset.z);
                bakedGeo.scale(scaleFactor, scaleFactor, scaleFactor);
                bakedGeo.computeVertexNormals(); // Refresh normals

                // Create new Mesh (Clean identity transform)
                const newMesh = new THREE.Mesh(bakedGeo);
                // Reset Transforms
                newMesh.position.set(0, 0, 0);
                newMesh.rotation.set(0, 0, 0);
                newMesh.scale.set(1, 1, 1);

                // Use original material if possible
                addMeshToScene(
                    newMesh,
                    originalMesh.name || `${item.name}_${index}`,
                    Array.isArray(originalMesh.material) ? originalMesh.material[0] : originalMesh.material
                );
            });

            setStatus(`IMPORTED ${validMeshes.length} PARTS`);
            // Auto-Spawn Gizmo for Imports
            setMode('TRANSFORM');
            setGizmoMode('translate');

            URL.revokeObjectURL(url);
        });
    };

    // --- LOGIC ---

    // Register refs for KFlux freeze callback (which is set up before sceneRef is declared)
    (window as any).__ksculptSceneRef    = sceneRef;
    (window as any).__ksculptActiveLayerId = activeLayerId;
    const saveHistory = () => {
        const { sculptHistory, historyIndex } = sceneRef.current;
        const mesh = getMeshById(activeLayerId);
        if (!activeLayerId || !mesh) return;
        const geo = mesh.geometry;

        const snapshot: KSculptHistorySnapshot = {
            layerId: activeLayerId,
            pos: new Float32Array(geo.attributes.position.array),
            col: new Float32Array(geo.attributes.color.array),
            // Save Mask if exists
            mask: geo.attributes.mask ? new Float32Array(geo.attributes.mask.array) : null,
            // Save UV if exists
            uv: geo.attributes.uv ? new Float32Array(geo.attributes.uv.array) : null,
            // Save Index if exists
            index: geo.index ? new Uint32Array(geo.index.array) : null,
            count: geo.attributes.position.count
        };

        let newHistory = sculptHistory.slice(0, historyIndex + 1);
        newHistory.push(snapshot);
        if (newHistory.length > MAX_HISTORY) newHistory.shift();

        sceneRef.current.sculptHistory = newHistory;
        sceneRef.current.historyIndex = newHistory.length - 1;
    };
    (window as any).__ksculptSaveHistory  = saveHistory;

    const undo = () => {
        const { historyIndex, sculptHistory } = sceneRef.current;
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const snapshot = sculptHistory[newIndex];
            const mesh = getMeshById(snapshot.layerId);

            if (mesh) {
                // Check if topology changed (count or index presence mismatch)
                const currentGeo = mesh.geometry;
                const topoChanged = snapshot.count !== currentGeo.attributes.position.count ||
                    (!!snapshot.index !== !!currentGeo.index) ||
                    (snapshot.index && currentGeo.index && snapshot.index.length !== currentGeo.index.count);

                if (topoChanged) {
                    // Full Rebuild
                    const newGeo = new THREE.BufferGeometry();
                    newGeo.setAttribute('position', new THREE.BufferAttribute(snapshot.pos, 3));
                    newGeo.setAttribute('color', new THREE.BufferAttribute(snapshot.col, 3));
                    if (snapshot.mask) newGeo.setAttribute('mask', new THREE.BufferAttribute(snapshot.mask, 1));
                    if (snapshot.uv) newGeo.setAttribute('uv', new THREE.BufferAttribute(snapshot.uv, 2));
                    if (snapshot.index) newGeo.setIndex(new THREE.BufferAttribute(snapshot.index, 1));

                    newGeo.computeVertexNormals();
                    newGeo.computeBoundingBox();

                    mesh.geometry.dispose();
                    mesh.geometry = newGeo;

                    // Rebuild Optimization Structures
                    // @ts-ignore
                    newGeo.computeBoundsTree();
                    if (sceneRef.current.topology) sceneRef.current.topology.build(newGeo);

                } else {
                    // Fast Path: Update Attributes
                    mesh.geometry.attributes.position.array.set(snapshot.pos);
                    mesh.geometry.attributes.color.array.set(snapshot.col);
                    mesh.geometry.attributes.position.needsUpdate = true;
                    mesh.geometry.attributes.color.needsUpdate = true;

                    if (snapshot.mask && mesh.geometry.attributes.mask) {
                        mesh.geometry.attributes.mask.array.set(snapshot.mask);
                        mesh.geometry.attributes.mask.needsUpdate = true;
                    }

                    mesh.geometry.computeVertexNormals();
                }

                if (activeLayerId !== snapshot.layerId) setActiveLayerId(snapshot.layerId);

                // Update Polycount in UI
                const count = mesh.geometry.attributes.position.count;
                setLayers(prev => prev.map(l => l.id === snapshot.layerId ? { ...l, polyCount: count } : l));

                sceneRef.current.historyIndex = newIndex;
                setStatus("UNDO");
            }
        }
    };

    // --- INTERACTION ---

    const handleStepUp = () => {
        if (!hasMeshById(activeLayerId)) return;
        const mesh = getMeshById(activeLayerId);
        if (!mesh) return;

        setStatus("GPU SUBDIVIDING...");
        setTimeout(async () => {
            let oldGeo = mesh.geometry;

            if (!oldGeo.index) {
                const indexed = BufferGeometryUtils.mergeVertices(oldGeo.clone());
                indexed.computeVertexNormals();
                mesh.geometry.dispose();
                mesh.geometry = indexed;
                oldGeo = indexed;
                setStatus('INDEXING MESH FOR SUBDIVISION...');
            }

            const t_start = globalThis.performance.now();

            // Try GPU subdivision first (1000x faster!) using V2 (proper Loop weights)
            // FIX: V1 gpu_subdivide_and_register is NOT registered as a Tauri command.
            // Must use V2 which is registered as gpu_subdivide_v2_and_register.
            let result = await rustSubdivide.gpuSubdivideV2AndRegister(
                oldGeo.attributes.position.array as Float32Array,
                oldGeo.index.array as Uint32Array,
                1
            );

            // Fallback to CPU if GPU fails
            if (!result) {
                console.warn('[KSculpt] GPU subdivision failed, falling back to CPU...');
                setStatus("CPU SUBDIVIDING (fallback)...");

                const attrMap: any[] = [];
                const attributesToSend: any[] = [];
                if (oldGeo.attributes.uv) {
                    attrMap.push({ type: 'uv', size: 2 });
                    attributesToSend.push({ values: Array.from(oldGeo.attributes.uv.array), item_size: 2 });
                }
                if (oldGeo.attributes.color) {
                    attrMap.push({ type: 'color', size: 3 });
                    attributesToSend.push({ values: Array.from(oldGeo.attributes.color.array), item_size: 3 });
                }
                if (oldGeo.attributes.mask) {
                    attrMap.push({ type: 'mask', size: 1 });
                    attributesToSend.push({ values: Array.from(oldGeo.attributes.mask.array), item_size: 1 });
                }

                const cpuResult = await rustSubdivide.subdivideAndRegister(
                    oldGeo.attributes.position.array as Float32Array,
                    oldGeo.index.array as Uint32Array,
                    attributesToSend,
                    1
                );

                if (cpuResult) {
                    result = {
                        subdivision: cpuResult.subdivision,
                        sculptHandle: cpuResult.sculptHandle,
                    };
                }
            }

            if (result) {
                try {
                    const { subdivision, sculptHandle } = result;
                    console.log(`[KSculpt] GPU Subdivision complete: ${subdivision.vertex_count} verts, handle=${sculptHandle}`);

                    // Create Three.js geometry for rendering
                    const newGeo = new THREE.BufferGeometry();
                    newGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(subdivision.positions), 3));
                    newGeo.setIndex(subdivision.indices);

                    // Keep sculpt-specific attributes coherent after topology rebuild.
                    const vertCount = subdivision.vertex_count;
                    ensureSculptGeometryAttributes(newGeo);

                    // Swap geometry
                    mesh.geometry.dispose();
                    mesh.geometry = newGeo;

                    // Three.js needs its own normals for rendering
                    newGeo.computeVertexNormals();
                    newGeo.computeBoundingBox();
                    newGeo.computeBoundingSphere();

                    // Mark for GPU upload
                    newGeo.attributes.position.needsUpdate = true;
                    if (newGeo.attributes.normal) newGeo.attributes.normal.needsUpdate = true;
                    if (newGeo.attributes.color) newGeo.attributes.color.needsUpdate = true;

                    // FIX: Wire already-registered Rust handle to this mesh UUID.
                    // gpuSubdivideV2AndRegister registers the mesh inside Rust and returns the handle.
                    // We must NOT call registerMesh() here — that would create a duplicate.
                    rustSculptManager.setHandle(mesh.uuid, sculptHandle);
                    rustRaycastManager.registerMesh(mesh);
                    if (sceneRef.current.topology) {
                        sceneRef.current.topology.build(newGeo);
                    }

                    const t_geo = globalThis.performance.now();
                    console.log(`[KSculpt] GPU SUBDIVISION COMPLETE:`);
                    console.log(`  GPU compute + register: ${subdivision.time_ms.toFixed(1)}ms`);
                    console.log(`  JS geometry creation: ${(t_geo - t_start - subdivision.time_ms).toFixed(1)}ms`);
                    console.log(`  Total: ${(t_geo - t_start).toFixed(1)}ms`);

                    // Deferred: BVH rebuild in background
                    setTimeout(() => {
                        // @ts-ignore
                        if (newGeo.computeBoundsTree) {
                            const tb0 = globalThis.performance.now();
                            // @ts-ignore
                            newGeo.computeBoundsTree();
                            const tb1 = globalThis.performance.now();
                            console.log(`[KSculpt] Deferred BVH build: ${(tb1 - tb0).toFixed(1)}ms`);
                        }
                    }, 100);

                    setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, polyCount: vertCount } : l));
                    setSubdivisionLevel(prev => prev + 1);
                    saveHistory();
                    setStatus(`GPU SUBDIVIDED: ${vertCount} verts (${(t_geo - t_start).toFixed(0)}ms)`);
                    return;
                } catch (err) {
                    console.error('[KSculpt] Post-subdivision processing failed:', err);
                    setStatus('SUBDIVISION FAILED - check console');
                }
            } else {
                console.error('[KSculpt] Both GPU and CPU subdivision failed');
                setStatus('SUBDIVISION FAILED - both GPU and CPU failed');
            }
        }, 50);
    };

    const updateTransformFromUI = (key: string, value: number) => {
        if (!hasMeshById(activeLayerId)) return;
        const mesh = getMeshById(activeLayerId);
        if (!mesh) return;

        const safeVal = isNaN(value) ? 0 : value;
        setTransformData(prev => ({ ...prev, [key]: safeVal }));

        switch (key) {
            case 'posX': mesh.position.x = safeVal; break;
            case 'posY': mesh.position.y = safeVal; break;
            case 'posZ': mesh.position.z = safeVal; break;
            case 'rotX': mesh.rotation.x = safeVal; break;
            case 'rotY': mesh.rotation.y = safeVal; break;
            case 'rotZ': mesh.rotation.z = safeVal; break;
            case 'scaleX': mesh.scale.x = safeVal || 0.001; break;
            case 'scaleY': mesh.scale.y = safeVal || 0.001; break;
            case 'scaleZ': mesh.scale.z = safeVal || 0.001; break;
        }

        void syncActiveMeshToNativeRenderer();
    };

    const onPointerMove = (e: any) => {
        // CLEANUP: Logic moved to input tick loop for performance
        // This handler is kept as a no-op for event attachment compatibility
    };

    // --- INPUT HANDLING ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.matches('input, textarea')) return;

            // E KEY: Smart Gizmo Cycle
            if (e.key.toLowerCase() === 'e') {
                if (mode !== 'TRANSFORM') {
                    setMode('TRANSFORM');
                    setGizmoMode('translate');
                    setTransformSpace('world');
                    setStatus("TRANSFORM MODE ACTIVE");
                } else {
                    // Cycle Modes
                    setGizmoMode(prev => {
                        if (prev === 'translate') return 'rotate';
                        if (prev === 'rotate') return 'scale';
                        return 'translate';
                    });
                }
            }

            // W KEY: Instant Sculpt (Exit Transform)
            if (e.key.toLowerCase() === 'w') {
                if (mode === 'TRANSFORM') {
                    setMode('SCULPT');
                    setStatus("SCULPT MODE RESUMED");
                }
            }

            // ESC: Exit Transform (if active)
            if (e.key === 'Escape') {
                if (mode === 'TRANSFORM') {
                    setMode('SCULPT');
                    setStatus("SCULPT MODE RESUMED");
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode]);

    const onPointerDown = (e: any) => {
        if (useNativeRenderer) return;
        console.log('[KSculpt] onPointerDown event detected, button:', e.button, 'appMode:', appMode);

        if (e.button !== 0) {
            console.log('[KSculpt] Not left mouse button, ignoring');
            return;
        }

        // FIX: Guard against scene not ready - prevents race condition on init
        if (!sceneRef.current.settings?.isSceneReady) {
            console.log('[KSculpt] Scene not ready, ignoring pointer down');
            return;
        }

        // Skip sculpt input in MODEL mode - IMM hook handles it
        if (appMode === 'MODEL') {
            console.log('[KSculpt] In MODEL mode, ignoring pointer down');
            return;
        }

        console.log('[KSculpt] Processing sculpting pointer down');

        // --- BEVY HISTORY SNAPSHOT ---
        // Save state before starting a new stroke
        invoke('leash_snapshot').catch(() => { });

        // Gizmo Protection (if transform controls are active, let them handle it)
        // (Usually handled by TransformControls internal events, but if we click OFF, we might want to deselect)
        const { camera } = sceneRef.current;
        const meshes = meshStoreRef.current;
        if (!camera) return;
        const rect = mountRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

        // CHECK INTERSECTIONS
        const allMeshes = Array.from(meshes.values());
        const intersects = raycaster.intersectObjects(allMeshes as THREE.Object3D[]);

        // SHIFT-CLICK OR SELECT TOOL: Smart Selection
        if (e.shiftKey || activeTool === 'SELECT') {
            if (intersects.length > 0) {
                const hitMesh = intersects[0].object;
                const foundId = findMeshIdByObject(hitMesh);

                if (foundId) {
                    handleLayerSelect(foundId, false); // Select it

                    if (e.shiftKey) {
                        // SMART GIZMO TRIGGER
                        // If already in transform on this object, toggle off? Or maybe just ensure ON.
                        // User said: "shift click... and it also toggles the gizmo"
                        setMode('TRANSFORM');
                        setGizmoMode('translate');
                        setStatus(`QUICK MOVE: ${(hitMesh as any).name}`);
                    } else {
                        setStatus(`SELECTED: ${(hitMesh as any).name}`);
                    }
                }
            } else {
                // Clicked Empty Space
                if (mode === 'TRANSFORM') {
                    setMode('SCULPT');
                    setStatus("SCULPT MODE RESUMED");
                }
            }
            return;
        }

        if (mode === 'TRANSFORM') return; // Let Gizmo handle input

        // Use the hit we already computed above to begin a stroke.
        // Relying on tick-loop-populated hoverPoint makes the first click a no-op.
        if (intersects.length === 0) return;

        const hitPoint = intersects[0].point.clone();
        const hitNormal = (intersects[0].face?.normal ?? new THREE.Vector3(0, 1, 0)).clone();
        sceneRef.current.hoverPoint = hitPoint;
        sceneRef.current.hoverNormal = hitNormal;

        // If no active layer is selected yet, select the clicked mesh
        if (!activeLayerId) {
            const hitMesh = intersects[0].object;
            const foundId = findMeshIdByObject(hitMesh);
            if (foundId) {
                handleLayerSelect(foundId, false);
            }
        }

        const activeId = activeLayerId ?? sceneRef.current.settings.activeLayerId;
        if (activeId && meshes.has(activeId)) {
            // ALT KEY: Allow Orbit instead of Sculpt
            if (e.altKey) return;

            const mesh = meshes.get(activeId);
            sceneRef.current.isSculpting = true;
            sceneRef.current.controls.enabled = false;
            sceneRef.current.lastBrushPoint = hitPoint.clone(); // Reset stroke start point

            if (activeTool === 'MOVE' || activeTool === 'STRETCH') {
                // Prepare Move/Stretch Data (Indices, Weights)
                const posAttr = mesh.geometry.attributes.position;
                const indices = []; const weights = []; const initialPos = [];

                const symIndices = []; const symWeights = []; const symInitialPos = [];

                const invMat = mesh.matrixWorld.clone();
                if (Math.abs(invMat.determinant()) < 1e-9) return;
                invMat.invert();

                const localHover = hitPoint.clone().applyMatrix4(invMat);
                const symLocalHover = localHover.clone();
                symLocalHover.x *= -1;

                const scale = new THREE.Vector3();
                mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
                const safeScale = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3 || 1;
                const localRadius = radius / safeScale;
                const rSq = (localRadius / 2) * (localRadius / 2);

                for (let i = 0; i < posAttr.count; i++) {
                    const px = posAttr.getX(i); const py = posAttr.getY(i); const pz = posAttr.getZ(i);

                    // Main Brush
                    const dx = px - localHover.x;
                    const dy = py - localHover.y;
                    const dz = pz - localHover.z;
                    const distSq = dx * dx + dy * dy + dz * dz;

                    if (distSq < rSq) {
                        const falloff = Math.pow(1 - distSq / rSq, 2); // Soft falloff
                        indices.push(i);
                        weights.push(falloff);
                        initialPos.push(new THREE.Vector3(px, py, pz));
                    }

                    // Symmetry Brush
                    if (symmetry === 'X') {
                        const sdx = px - symLocalHover.x;
                        const sdy = py - symLocalHover.y;
                        const sdz = pz - symLocalHover.z;
                        const sDistSq = sdx * sdx + sdy * sdy + sdz * sdz;

                        if (sDistSq < rSq) {
                            const falloff = Math.pow(1 - sDistSq / rSq, 2);
                            symIndices.push(i);
                            symWeights.push(falloff);
                            symInitialPos.push(new THREE.Vector3(px, py, pz));
                        }
                    }
                }

                // Plane for Screen-Space Move
                const screenPlane = new THREE.Plane();
                const normal = camera.getWorldDirection(new THREE.Vector3());
                screenPlane.setFromNormalAndCoplanarPoint(normal, hitPoint);

                sceneRef.current.moveData = {
                    indices, weights, initialPos,
                    symIndices, symWeights, symInitialPos,
                    grabPoint: hitPoint.clone(),
                    grabNormal: hitNormal.clone(),
                    screenPlane,
                    dragStartMouse: { x: e.clientY, y: e.clientY } // Store Y for Stretch
                };
            } else {
                saveHistory();
            }
        }
    };

    const onPointerUp = () => {
        if (useNativeRenderer) {
            sceneRef.current.isSculpting = false;
            return;
        }
        // Re-enable camera controls when sculpting ends
        if (sceneRef.current.isSculpting) {
            sceneRef.current.isSculpting = false;
            sceneRef.current.controls.enabled = true;
            sceneRef.current.lastBrushPoint = null;
        }

        // Refit BVH if we sculpted
        if (sceneRef.current.isSculpting && activeLayerId) {
            const mesh = getMeshById(activeLayerId);
            if (mesh) {
                // @ts-ignore - Refit BVH (fast incremental update)
                if (mesh.geometry.boundsTree) mesh.geometry.boundsTree.refit();

                // REMOVED: mesh.geometry.computeVertexNormals()
                // Normals are now computed in Rust during each brush stroke
                // and applied via applyBrushResultToGeometry() - no JS freeze!

                // Mark mesh as dirty for raycast sync (async, non-blocking)
                rustRaycastManager.markDirty(mesh);
                // TODO: Share mesh state between sculpt and raycast modules in Rust
                // to eliminate this IPC entirely
            }
        }
    };

    const applyBrush = async (point: THREE.Vector3, normal: THREE.Vector3) => {
        // ── KMath intercept: route to Fortran math brush library ─────────────
        if (activeMathBrush) {
            const mesh = getMeshById(sceneRef.current.settings?.activeLayerId);
            if (mesh) {
                const output = applyMathBrush({
                    brushId: activeMathBrush,
                    mesh,
                    center: point,
                    normal: normal,
                    radius: sceneRef.current.settings?.radius ?? 0.5,
                    intensity: sceneRef.current.settings?.intensity ?? 0.5,
                    delta: sceneRef.current.lastBrushPoint
                        ? point.clone().sub(sceneRef.current.lastBrushPoint as THREE.Vector3)
                        : undefined,
                    params: mathBrushParams[activeMathBrush] ?? {},
                });
                applyDisplacementToMesh(mesh, output);
                flux.syncMesh();
                setMathBrushStats({ computeMs: output.computeMs, affectedVerts: output.affectedVerts });
                sceneRef.current.lastBrushPoint = point.clone();
            }
            return;
        }
        // ── KFlux intercept: route to GPU dynamics engine instead of sculpt ──
        if (fluxActive && flux.isReady) {
            const fluxMesh = getMeshById(sceneRef.current.settings?.activeLayerId);
            if (!fluxMesh) return;
            const inv = fluxMesh.matrixWorld.clone();
            if (Math.abs(inv.determinant()) < 1e-9) return;
            inv.invert();
            const localPoint = point.clone().applyMatrix4(inv);
            const localNormal = normal.clone().transformDirection(inv).normalize();
            flux.paintBrush({
                mode: fluxMode,
                center: localPoint,
                normal: localNormal,
                radius: sceneRef.current.settings?.radius ?? 0.5,
                strength: (sceneRef.current.settings?.intensity ?? 0.5) * 8.0,
                dt: fluxParams.dt,
            });
            return;
        }
        // FIX: Read activeBrush from ref to avoid stale closure
        const currentBrush = sceneRef.current.settings?.activeBrush;

        if (!currentBrush) return;
        if (sceneRef.current.isBrushBusy) return;

        const { settings } = sceneRef.current;
        const meshes = meshStoreRef.current;
        const { activeLayerId, brushMode, intensity, radius, symmetry, activeAlpha } = settings;

        if (!activeLayerId || !meshes.has(activeLayerId)) return;
        const mesh = meshes.get(activeLayerId);

        // === SIMPLE SPACING (no complex interpolation) ===
        // Just skip if we haven't moved enough from last stamp
        const stepSize = radius * 0.25;
        const lastPoint = sceneRef.current.lastBrushPoint as THREE.Vector3 | null;

        if (lastPoint) {
            const dist = point.distanceTo(lastPoint);
            if (dist < stepSize) return; // Skip - too close to last stamp
        }

        // Compute delta for Grab/Snake Hook brushes (world-space mouse movement)
        const delta = lastPoint ? point.clone().sub(lastPoint) : null;

        // Update last stamp position
        sceneRef.current.lastBrushPoint = point.clone();

        // Get alpha handle if an alpha texture is active
        const alphaHandle = activeAlpha?.handle ?? null;

        // Single stamp per call (no fire-and-forget racing)
        await executeBrushStamp(point, normal, mesh, brushMode, intensity, currentBrush, symmetry, radius, alphaHandle, delta);
        flux.syncMesh();
    };

    // Helper: Execute a single brush stamp (extracted for interpolation loop)
    const executeBrushStamp = async (
        point: THREE.Vector3,
        normal: THREE.Vector3,
        mesh: THREE.Mesh,
        brushMode: 'ADD' | 'SUB',
        intensity: number,
        brush: KBrushAsset,
        symmetry: 'NONE' | 'X',
        radius: number,
        alphaHandle: number | null = null,
        delta: THREE.Vector3 | null = null  // World-space mouse movement for Grab/Snake Hook
    ) => {
        if (sceneRef.current.isBrushBusy) return;
        sceneRef.current.isBrushBusy = true;

        const effectiveIntensity = brushMode === 'SUB' ? -intensity : intensity;

        try {
            // === MASK PAINTING MODE ===
            // FIX: Read activeTool from ref, not stale closure!
            const currentActiveTool = sceneRef.current.settings.activeTool;
            if (currentActiveTool === 'MASK') {
                const handle = rustSculptManager.getHandle(mesh);
                if (!handle) {
                    setStatus('⚠️ MASK: Mesh not registered');
                    return;
                }

                // Transform to local space
                const invMat = mesh.matrixWorld.clone().invert();
                const localPoint = point.clone().applyMatrix4(invMat);

                const scale = new THREE.Vector3();
                mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
                const safeScale = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3 || 1;
                const localRadius = radius / safeScale;

                // Get positions for mask painting
                const positions = mesh.geometry.attributes.position.array as Float32Array;

                // Paint mask (ADD mode adds mask, SUB mode removes mask)
                const maskIntensity = brushMode === 'SUB' ? -1.0 : 1.0;
                const result = await rustMask.paint(
                    handle,
                    positions,
                    [localPoint.x, localPoint.y, localPoint.z],
                    localRadius,
                    maskIntensity * intensity,
                    1.0 // falloff
                );

                if (result) {
                    // Apply mask result to geometry
                    applyMaskResultToGeometry(mesh.geometry, result);
                    setStatus(`🎭 MASK  ${result.modified_indices.length}v  ${result.time_ms.toFixed(2)}ms`);
                } else {
                    setStatus('⚠️ MASK: Paint failed');
                }

                return;
            }

            const runKainSpirvPipeline = async (statusPrefix: string = 'KAIN SPIR-V') => {
                const shaderName = resolveBrushShaderName(brush);

                // Get mesh handle for Rust backend
                const handle = rustSculptManager.getHandle(mesh);
                if (!handle) {
                    setStatus('⚠️ KAIN: Mesh not registered');
                    return;
                }

                // Transform to local space
                const invMat = mesh.matrixWorld.clone().invert();
                const localPoint = point.clone().applyMatrix4(invMat);
                const localNormal = normal.clone().transformDirection(invMat).normalize();

                const scale = new THREE.Vector3();
                mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
                const safeScale = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3 || 1;
                const localRadius = radius / safeScale;

                try {
                    const result = await rustSculpt.applyBrushSpirv(
                        handle,
                        [localPoint.x, localPoint.y, localPoint.z],
                        [localNormal.x, localNormal.y, localNormal.z],
                        shaderName,
                        localRadius,
                        effectiveIntensity,
                        alphaHandle
                    );

                    if (result) {
                        applyBrushResultToGeometry(mesh.geometry, result);
                        const timeMs = result.time_ms ?? 0;
                        const affectedCount = result.affected_count ?? 0;

                        setLastGpuStroke({ usedGpu: true, reason: null, timeMs, affectedCount });
                        setStatus(`⚡ ${statusPrefix}  ${affectedCount}v  ${timeMs.toFixed(2)}ms`);

                        // @ts-ignore
                        if (mesh.geometry.boundsTree) mesh.geometry.boundsTree.refit();
                        rustRaycastManager.markDirty(mesh);
                    } else {
                        setStatus('⚠️ KAIN FAILED: no result');
                    }
                } catch (error) {
                    console.error('[KSculpt] SPIR-V brush failed:', error);
                    setStatus(`⚠️ KAIN FAILED: ${error}`);
                }
            };

            await dispatchBrushPipeline(brush, useKainShaders, {
                onKainMeta: async () => {
                    const compileResult = await compileKainMetaChainForBrush(brush, {
                        requestedTargets: ['kainscript', 'typescript', 'wasm', 'usf', 'spirv', 'hlsl'],
                    });

                    if (compileResult.status === 'compiled') {
                        setStatus(`🧠 KAIN META CHAIN → ${compileResult.targets.join(', ')}`);
                    } else if (compileResult.status === 'fallback') {
                        setStatus('⚠️ KAIN META compile unavailable, using cached SPIR-V');
                    } else {
                        setStatus('⚠️ KAIN META disabled, using SPIR-V fallback');
                    }

                    await runKainSpirvPipeline('KAIN META SPIR-V');
                },
                onKainSpirv: async () => {
                    await runKainSpirvPipeline('KAIN SPIR-V');
                },
                onWgsl: async () => {
                    // === WGSL PIPELINE (Legacy) ===
                    const shaderName = resolveBrushShaderName(brush);
                    const r = await applyBrushRust(
                        mesh,
                        point,
                        normal,
                        radius,
                        effectiveIntensity,
                        shaderName,
                        symmetry,
                        true, // useGpu
                        alphaHandle, // GPU alpha texture for intensity modulation
                        delta  // For Grab/Snake Hook/Move brushes
                    );

                    if (r.usedRust) {
                        const usedGpuStroke = Boolean(r.usedGpu);
                        const reason = r.gpuFallbackReason ?? null;
                        setLastGpuStroke({ usedGpu: usedGpuStroke, reason, timeMs: r.timeMs, affectedCount: r.affectedCount });

                        if (usedGpuStroke) {
                            setStatus(`GPU STROKE ✓  ${r.affectedCount}v  ${r.timeMs.toFixed(2)}ms`);
                        } else {
                            setStatus(`CPU FALLBACK  ${reason ?? 'Unknown'}  ${r.timeMs.toFixed(2)}ms`);
                        }

                        // FIX: Update BVH immediately so cursor doesn't "glitch" into old geometry!
                        // 1. Refit JS BVH (Fast CPU update)
                        // @ts-ignore
                        if (mesh.geometry.boundsTree) mesh.geometry.boundsTree.refit();

                        // 2. Mark Rust raycaster dirty (Invalidates cache -> falls back to JS BVH next frame)
                        rustRaycastManager.markDirty(mesh);
                    }
                },
            });
        } finally {
            sceneRef.current.isBrushBusy = false;
        }
    };

    useGlobalHotkeys(
        {
            f9: () => {
                const s = lastGpuStroke;
                if (!s) {
                    setStatus('GPU DEBUG: No strokes yet');
                    return;
                }

                const msg = s.usedGpu
                    ? `GPU DEBUG: LAST=GPU  ${s.affectedCount}v  ${s.timeMs.toFixed(2)}ms`
                    : `GPU DEBUG: LAST=CPU  reason=${s.reason ?? 'Unknown'}  ${s.affectedCount}v  ${s.timeMs.toFixed(2)}ms`;

                console.log(msg);
                setStatus(msg);
            },
        },
        true
    );

    const commitToKernel = () => {
        if (!onCommit) return;

        // collect visible layers
        const visibleLayers = layers.filter(l => l.visible);
        if (visibleLayers.length === 0) {
            setStatus("NOTHING TO EXPORT");
            return;
        }

        setStatus("EXPORTING TO KERNEL...");

        try {
            const exportScene = new THREE.Scene();
            const meshesToDispose: THREE.Mesh[] = [];

            visibleLayers.forEach(layer => {
                const mesh = getMeshById(layer.id);
                if (mesh) {
                    const exportMesh = mesh.clone();
                    exportMesh.name = layer.name;

                    // PRESERVE kId for cross-app identity!
                    exportMesh.userData = {
                        kId: mesh.userData.kId, // Hot potato mode: kId survives export
                    };

                    // Handle Material
                    if ((mesh.material as any).isMeshMatcapMaterial) {
                        exportMesh.material = new THREE.MeshStandardMaterial({
                            color: 0xffffff,
                            roughness: 0.5,
                            metalness: 0.0,
                            vertexColors: true
                        });
                    }

                    exportScene.add(exportMesh);
                    meshesToDispose.push(exportMesh);
                }
            });

            // Embed kIds into GLTF extras for cross-app persistence
            prepareForGLTFExport(exportScene);

            const exporter = new GLTFExporter();
            exporter.parse(
                exportScene,
                (result) => {
                    const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
                    onCommit(blob, "SCULPT_EXPORT");
                    setStatus(`UPLOAD COMPLETE (${visibleLayers.length} MESHES)`);

                    // Cleanup
                    meshesToDispose.forEach(m => {
                        if ((m.material as any).isMeshStandardMaterial) {
                            (m.material as THREE.Material).dispose();
                        }
                    });
                },
                (err) => {
                    console.error("Export Error:", err);
                    setStatus("EXPORT FAILED: " + (err.message || "Unknown"));
                    // Cleanup
                    meshesToDispose.forEach(m => {
                        if ((m.material as any).isMeshStandardMaterial) {
                            (m.material as THREE.Material).dispose();
                        }
                    });
                },
                { binary: true }
            );
        } catch (e: any) {
            console.error("Export Crash:", e);
            setStatus("EXPORT CRASH: " + e.message);
        }
    };

    const handleToggleVis = (id: string) => {
        const mesh = getMeshById(id);
        if (mesh) {
            mesh.visible = !mesh.visible;
            setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: mesh.visible } : l));
        }
    };

    const handleDeleteLayer = (id: string) => {
        const mesh = getMeshById(id);
        if (mesh) {
            // Cleanup from K_OS Registry to prevent memory leak
            unregisterObject3D(mesh, false);

            sceneRef.current.scene.remove(mesh);
            mesh.geometry.dispose();
            meshStoreRef.current.delete(id);
            setLayers(prev => prev.filter(l => l.id !== id));
            if (activeLayerId === id) setActiveLayerId(null);
        }
    };

    // --- MASK OPERATIONS ---

    const clearMask = async () => {
        if (!activeLayerId) return;
        const mesh = getMeshById(activeLayerId);
        if (!mesh) return;

        const handle = rustSculptManager.getHandle(mesh);
        if (!handle) {
            setStatus('⚠️ CLEAR MASK: Mesh not registered');
            return;
        }

        const success = await rustMask.clear(handle);
        if (success) {
            // Update Three.js geometry
            if (mesh.geometry.attributes.mask) {
                const maskAttr = mesh.geometry.attributes.mask;
                const arr = maskAttr.array as Float32Array;
                arr.fill(0);
                maskAttr.needsUpdate = true;
            }
            setStatus('🎭 MASK CLEARED');
        } else {
            setStatus('⚠️ CLEAR MASK FAILED');
        }
    };

    const invertMask = async () => {
        if (!activeLayerId) return;
        const mesh = getMeshById(activeLayerId);
        if (!mesh) return;

        const handle = rustSculptManager.getHandle(mesh);
        if (!handle) {
            setStatus('⚠️ INVERT MASK: Mesh not registered');
            return;
        }

        const success = await rustMask.invert(handle);
        if (success) {
            // Update Three.js geometry
            if (mesh.geometry.attributes.mask) {
                const maskAttr = mesh.geometry.attributes.mask;
                const arr = maskAttr.array as Float32Array;
                for (let i = 0; i < arr.length; i++) {
                    arr[i] = 1.0 - arr[i];
                }
                maskAttr.needsUpdate = true;
            }
            setStatus('🎭 MASK INVERTED');
        } else {
            setStatus('⚠️ INVERT MASK FAILED');
        }
    };

    const extractMask = () => {
        if (!activeLayerId) return;
        const mesh = getMeshById(activeLayerId);
        if (!mesh || !mesh.geometry.attributes.mask) return;

        const maskAttr = mesh.geometry.attributes.mask;
        const posAttr = mesh.geometry.attributes.position;
        const colAttr = mesh.geometry.attributes.color;
        const indexAttr = mesh.geometry.index;

        const validFaces: number[] = [];
        const oldToNewIndex = new Map<number, number>();
        const newPositions: number[] = [];
        const newColors: number[] = [];
        const newIndices: number[] = [];

        const isMasked = (idx: number) => maskAttr.getX(idx) > 0.1;

        // Collect Faces
        if (indexAttr) {
            for (let i = 0; i < indexAttr.count; i += 3) {
                const a = indexAttr.getX(i);
                const b = indexAttr.getX(i + 1);
                const c = indexAttr.getX(i + 2);
                if (isMasked(a) && isMasked(b) && isMasked(c)) validFaces.push(a, b, c);
            }
        } else {
            for (let i = 0; i < posAttr.count; i += 3) {
                if (isMasked(i) && isMasked(i + 1) && isMasked(i + 2)) validFaces.push(i, i + 1, i + 2);
            }
        }

        if (validFaces.length === 0) {
            setStatus("NO MASK TO EXTRACT");
            return;
        }

        // Build Base Surface
        const getOrAddVertex = (oldIdx: number) => {
            if (oldToNewIndex.has(oldIdx)) return oldToNewIndex.get(oldIdx)!;
            const newIdx = newPositions.length / 3;
            newPositions.push(posAttr.getX(oldIdx), posAttr.getY(oldIdx), posAttr.getZ(oldIdx));
            if (colAttr) newColors.push(colAttr.getX(oldIdx), colAttr.getY(oldIdx), colAttr.getZ(oldIdx));
            else newColors.push(1, 1, 1);
            oldToNewIndex.set(oldIdx, newIdx);
            return newIdx;
        };

        validFaces.forEach(oldIdx => newIndices.push(getOrAddVertex(oldIdx)));

        // --- PANEL LOOPS (THICKNESS) ---
        if (extractionThickness > 0.0001) {
            // 1. Compute Base Geometry Logic
            const frontGeo = new THREE.BufferGeometry();
            frontGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
            frontGeo.setIndex(newIndices);
            frontGeo.computeVertexNormals();

            const posV = frontGeo.attributes.position.array as Float32Array;
            const normV = frontGeo.attributes.normal.array as Float32Array;
            const count = posV.length / 3;

            const finalPos: number[] = Array.from(posV);
            const finalCol: number[] = Array.from(newColors);
            const finalInd: number[] = Array.from(newIndices);

            // 2. Create Back Shell (Offset)
            for (let i = 0; i < count; i++) {
                const x = posV[i * 3]; const y = posV[i * 3 + 1]; const z = posV[i * 3 + 2];
                const nx = normV[i * 3]; const ny = normV[i * 3 + 1]; const nz = normV[i * 3 + 2];

                finalPos.push(x - nx * extractionThickness);
                finalPos.push(y - ny * extractionThickness);
                finalPos.push(z - nz * extractionThickness);

                finalCol.push(finalCol[i * 3], finalCol[i * 3 + 1], finalCol[i * 3 + 2]);
            }

            // 3. Faces for Back Shell (Inverted Winding)
            for (let i = 0; i < newIndices.length; i += 3) {
                finalInd.push(newIndices[i + 2] + count, newIndices[i + 1] + count, newIndices[i] + count);
            }

            // 4. Stitch Borders
            const edgeMap = new Map<string, number>();
            for (let i = 0; i < newIndices.length; i += 3) {
                const u = newIndices[i]; const v = newIndices[i + 1]; const w = newIndices[i + 2];
                const add = (a: number, b: number) => {
                    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
                    edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
                };
                add(u, v); add(v, w); add(w, u);
            }

            for (let i = 0; i < newIndices.length; i += 3) {
                const edges = [[newIndices[i], newIndices[i + 1]], [newIndices[i + 1], newIndices[i + 2]], [newIndices[i + 2], newIndices[i]]];
                edges.forEach(([u, v]) => {
                    const key = u < v ? `${u}_${v}` : `${v}_${u}`;
                    if (edgeMap.get(key) === 1) {
                        // Boundary Edge -> Create Quad
                        // Front: u -> v. Back: v+count -> u+count
                        finalInd.push(u, v, v + count);
                        finalInd.push(u, v + count, u + count);
                    }
                });
            }

            newPositions.length = 0; newPositions.push(...finalPos);
            newColors.length = 0; newColors.push(...finalCol);
            newIndices.length = 0; newIndices.push(...finalInd);
        }

        const newGeo = new THREE.BufferGeometry();
        newGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
        if (newColors.length > 0) newGeo.setAttribute('color', new THREE.Float32BufferAttribute(newColors, 3));
        newGeo.setIndex(newIndices);

        // Initial Mask Clear on new mesh
        const newCount = newPositions.length / 3;
        newGeo.setAttribute('mask', new THREE.Float32BufferAttribute(new Float32Array(newCount).fill(0), 1));

        newGeo.computeVertexNormals();

        const newMesh = new THREE.Mesh(newGeo);
        // Copy transform
        newMesh.position.copy(mesh.position);
        newMesh.rotation.copy(mesh.rotation);
        newMesh.scale.copy(mesh.scale);

        // Offset slightly if shell
        if (extractionThickness <= 0.0001) newMesh.position.add(new THREE.Vector3(0.01, 0.01, 0.01));

        const newName = `${layers.find(l => l.id === activeLayerId)?.name || 'Mesh'}_Extracted`;
        addMeshToScene(newMesh, newName); // Adds to scene and layer system
        setStatus(`MASK EXTRACTED (${extractionThickness > 0 ? 'SOLID' : 'SHELL'})`);
    };

    // --- VOXEL REMESHER (RUST POWERED) ---
    const handleVoxelRemesh = async () => {
        if (!hasMeshById(activeLayerId)) return;
        const mesh = getMeshById(activeLayerId)!;

        saveHistory(); // Undo Step
        setStatus("REMESHING (RUST)...");

        try {
            // Extract geometry data
            const geo = mesh.geometry;
            const posAttr = geo.attributes.position;
            const positions = Array.from(posAttr.array as Float32Array);
            const indices = geo.index ? Array.from(geo.index.array as Uint32Array) : [];

            if (indices.length === 0) {
                // Non-indexed geometry - skip
                setStatus("REMESH FAILED: Non-indexed geometry");
                return;
            }

            // Call Rust remesher (100 = resolution, higher = more detail)
            const { rustRemesh } = await import('@/services/remeshClient');
            const result = await rustRemesh.remesh(positions, indices, 100);

            // Create new geometry from Rust result
            const newGeo = new THREE.BufferGeometry();
            newGeo.setAttribute('position', new THREE.Float32BufferAttribute(result.positions, 3));
            newGeo.setIndex(result.indices);
            newGeo.computeVertexNormals();

            // Add required attributes
            const count = result.positions.length / 3;
            newGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
            newGeo.setAttribute('mask', new THREE.Float32BufferAttribute(new Float32Array(count).fill(0), 1));

            // Replace Geometry
            mesh.geometry.dispose();
            mesh.geometry = newGeo;

            // Rebuild BVH
            // @ts-ignore
            newGeo.computeBoundsTree();

            // Update Poly Count
            setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, polyCount: count } : l));

            setStatus(`REMESHED (RUST) - ${count} Verts - ${result.time_ms.toFixed(1)}ms`);
        } catch (err: any) {
            console.error("Rust remesh failed:", err);
            setStatus(`REMESH FAILED: ${err.message || err}`);
        }
    };

    // --- GPU DYNAMESH (WGPU COMPUTE - ZBrush-style) ---
    const handleGpuDynamesh = async (resolution: number = 128) => {
        if (!hasMeshById(activeLayerId)) return;
        const mesh = getMeshById(activeLayerId)!;

        saveHistory(); // Undo Step
        setStatus(`DYNAMESH (GPU) @ ${resolution}...`);

        try {
            const geo = mesh.geometry;
            const posAttr = geo.attributes.position;
            const positions = Array.from(posAttr.array as Float32Array);
            const indices = geo.index ? Array.from(geo.index.array as Uint32Array) : [];

            if (indices.length === 0) {
                setStatus("DYNAMESH FAILED: Non-indexed geometry");
                return;
            }

            // Call GPU Dynamesh via Tauri
            const result = await invoke('gpu_dynamesh', {
                positions,
                indices,
                params: {
                    resolution,
                    smooth_steps: 2,
                    padding: 0.05,
                    iso_level: 0.0,
                    vertex_smooth: 2,
                }
            }) as any;

            // Create new geometry from GPU result
            const newGeo = new THREE.BufferGeometry();
            newGeo.setAttribute('position', new THREE.Float32BufferAttribute(result.positions, 3));
            newGeo.setAttribute('normal', new THREE.Float32BufferAttribute(result.normals, 3));
            newGeo.setIndex(result.indices);

            // Add required attributes
            const count = result.positions.length / 3;
            newGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
            newGeo.setAttribute('mask', new THREE.Float32BufferAttribute(new Float32Array(count).fill(0), 1));

            // Replace Geometry
            mesh.geometry.dispose();
            mesh.geometry = newGeo;

            // Rebuild BVH
            // @ts-ignore
            newGeo.computeBoundsTree();

            // Update Poly Count
            setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, polyCount: count } : l));

            const stats = result.stats;
            setStatus(`DYNAMESH (GPU) ${stats.output_vertices}v ${stats.output_triangles}t in ${result.time_ms.toFixed(1)}ms`);
        } catch (err: any) {
            console.error("GPU Dynamesh failed:", err);
            setStatus(`DYNAMESH FAILED: ${err.message || err}`);
        }
    };

    useEffect(() => {
        const r = sceneRef.current;
        const activeMesh = getMeshById(activeLayerId);
        if (r.transformControl && activeMesh) {
            if (mode === 'TRANSFORM') {
                r.transformControl.attach(activeMesh);
            } else {
                r.transformControl.detach();
            }
        }
    }, [activeLayerId, getMeshById, mode]);

    // Keybinds now handled by global hotkeys (useGlobalHotkeys)

    // --- UPLINK ---
    const handleUplink = () => {
        if (!onCommit || layers.length === 0) return;
        setStatus("UPLINKING TO KERNEL...");

        const exporter = new GLTFExporter();
        const exportGroup = new THREE.Group();

        // Export visible layers — use dedicated live mesh store refs
        // (React state `layers` may hold stale mesh references after sculpting)
        layers.forEach(l => {
            if (l.visible) {
                const liveMesh = getMeshById(l.id);
                if (liveMesh) {
                    const clone = liveMesh.clone();
                    exportGroup.add(clone);
                }
            }
        });

        if (exportGroup.children.length === 0) {
            setStatus("NOTHING TO EXPORT");
            return;
        }

        exporter.parse(
            exportGroup,
            (gltf) => {
                const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
                onCommit(blob, 'K-SCULPT');
                setStatus("ASSETS SECURED IN KERNEL");
            },
            (err) => {
                console.error(err);
                setStatus("UPLINK FAILED");
            },
            { binary: true }
        );
    };

    const sharedViewportRequest = React.useMemo(() => {
        if (!useNativeRenderer) return null;
        return {
            ownerId: 'ksculpt',
            meshHandle: activeNativeMeshHandle,
            useSculptHandle: true,
            syncSource: nativeSyncSource,
            captureInput: true,
            hostInputMode: 'camera+cursor' as const,
            showDiagnostics: false,
            onViewportHandleChange: setNativeViewportHandle,
            gizmo: {
                enabled: mode === 'TRANSFORM' && !!activeLayerId,
                mode: gizmoMode,
                orientation: transformSpace,
                snapping: snapEnabled,
                targets: (() => {
                    const mesh = getMeshById(activeLayerId);
                    return mesh ? [toNativeGizmoTransform(mesh)] : [];
                })(),
                onTargetsChange: applyNativeTransformTargets,
            },
            onSelectionChange: (selection: NativeSelectionResult | null) => {
                setNativeSelection(selection);
                if (selection?.hit && selection.position && selection.normal) {
                    sceneRef.current.hoverPoint = new THREE.Vector3(...selection.position);
                    sceneRef.current.hoverNormal = new THREE.Vector3(...selection.normal);
                } else {
                    sceneRef.current.hoverPoint = null;
                    sceneRef.current.hoverNormal = null;
                }
            },
            onStrokeStart: (selection: NativeSelectionResult) => {
                sceneRef.current.isSculpting = true;
                void applyNativeSelectionBrush(selection);
            },
            onStrokeMove: (selection: NativeSelectionResult) => {
                sceneRef.current.isSculpting = true;
                void applyNativeSelectionBrush(selection);
            },
            onStrokeEnd: () => {
                sceneRef.current.isSculpting = false;
                void syncActiveMeshToNativeRenderer();
            },
            onStatusChange: (next: string) => setStatus(next),
        };
    }, [
        activeLayerId,
        activeNativeMeshHandle,
        applyNativeSelectionBrush,
        applyNativeTransformTargets,
        getMeshById,
        gizmoMode,
        mode,
        nativeSyncSource,
        snapEnabled,
        syncActiveMeshToNativeRenderer,
        toNativeGizmoTransform,
        transformSpace,
        useNativeRenderer,
    ]);

    useRegisterSharedViewport(sharedViewportRequest);

    return (
        <AppShell
            layoutKey="ksculpt"
            className={`text-gray-300 font-mono select-none overflow-hidden ${isBevyActive ? 'bg-transparent' : 'bg-[#050505]'}`}
            menuBar={
                <AppMenuBar
                    menus={[
                        {
                            label: 'File',
                            items: [
                                { label: 'Export / Uplink', onSelect: handleUplink, shortcut: 'Ctrl+S' },
                            ],
                        },
                        {
                            label: 'Edit',
                            items: [
                                { label: 'Undo', onSelect: undo, shortcut: 'Ctrl+Z' },
                            ],
                        },
                        {
                            label: 'View',
                            items: [
                                { label: 'Toggle Wireframe', onSelect: () => setWireframe(!wireframe), shortcut: 'W' },
                                { label: 'Toggle Grid', onSelect: () => setShowGrid(!showGrid) },
                            ],
                        },
                        {
                            label: 'Help',
                            items: [{ label: 'About', disabled: true }],
                        },
                    ]}
                />
            }
            menuBarDefaultOpen={false}
            centerTransparent={useNativeRenderer}
            topBar={
                <TopBar
                    appMode={appMode}
                    setAppMode={setAppMode}
                    activeBrush={activeBrush}
                    setActiveBrush={setActiveBrush}
                    brushesLoaded={brushesLoaded}
                    radius={radius}
                    setRadius={setRadius}
                    intensity={intensity}
                    setIntensity={setIntensity}
                    brushMode={brushMode}
                    setBrushMode={setBrushMode}
                    symmetry={symmetry}
                    setSymmetry={setSymmetry}
                    wireframe={wireframe}
                    setWireframe={setWireframe}
                    dynamicTopology={dynamicTopology}
                    setDynamicTopology={setDynamicTopology}
                    detailSize={detailSize}
                    setDetailSize={setDetailSize}
                    currentMatCap={currentMatCap}
                    setCurrentMatCap={setCurrentMatCap}
                    showGrid={showGrid}
                    setShowGrid={setShowGrid}
                    useKainShaders={useKainShaders}
                    setUseKainShaders={setUseKainShaders}
                    pipelineStatus={pipelineStatus}
                    onOpenKainAuthoring={handleOpenKainAuthoring}
                    onUplink={handleUplink}
                    fluxActive={fluxActive}
                    onFluxToggle={() => setFluxActive(v => !v)}
                />
            }
            left={{
                title: 'K-SCULPT',
                defaultSize: 22,
                minSize: 16,
                collapsedSize: 4,
                tabs: [
                    {
                        id: 'brushes',
                        label: 'Brushes',
                        icon: Paintbrush,
                        content: (
                            <LeftPanel
                                mode="brushes"
                                appMode={appMode}
                                modelState={modelState}
                                setModelState={setModelState}
                                activeBrush={activeBrush}
                                setActiveBrush={setActiveBrush}
                                brushesLoaded={brushesLoaded}
                                setMode={setMode}
                                activeColor={activeColor}
                                setActiveColor={setActiveColor}
                                undo={undo}
                                wireframe={wireframe}
                                setWireframe={setWireframe}
                                sharedState={sharedState}
                                activeAlpha={activeAlpha}
                                setActiveAlpha={setActiveAlpha}
                                hasSelection={Boolean(activeLayerId)}
                                onSaveAlphaToStorage={(alpha: { name: string; url: string }) => {
                                    if (onAlphaCommit) {
                                        setStatus("UPLINKING ALPHA...");
                                        onAlphaCommit(alpha);
                                        setStatus("ALPHA SECURED IN KERNEL");
                                    }
                                }}
                                subdivisionLevel={subdivisionLevel}
                                polyCount={activePolyCount}
                                handleStepUp={handleStepUp}
                                onRemesh={handleVoxelRemesh}
                                onClearMask={clearMask}
                                onInvertMask={invertMask}
                                onExtractMask={extractMask}
                                gizmoMode={gizmoMode}
                                setGizmoMode={setGizmoMode}
                                transformSpace={transformSpace}
                                setTransformSpace={setTransformSpace}
                                snapEnabled={snapEnabled}
                                setSnapEnabled={setSnapEnabled}
                                transformData={transformData}
                                updateTransformFromUI={updateTransformFromUI}
                            />
                        ),
                    },
                    {
                        id: 'geo',
                        label: 'Geometry',
                        icon: Hexagon,
                        content: (
                            <LeftPanel
                                mode="geo"
                                appMode={appMode}
                                modelState={modelState}
                                setModelState={setModelState}
                                activeTool={activeTool}
                                setActiveTool={setActiveTool}
                                setMode={setMode}
                                activeColor={activeColor}
                                setActiveColor={setActiveColor}
                                undo={undo}
                                wireframe={wireframe}
                                setWireframe={setWireframe}
                                sharedState={sharedState}
                                activeAlpha={activeAlpha}
                                setActiveAlpha={setActiveAlpha}
                                hasSelection={Boolean(activeLayerId)}
                                onSaveAlphaToStorage={() => { }}
                                subdivisionLevel={subdivisionLevel}
                                polyCount={activePolyCount}
                                handleStepUp={handleStepUp}
                                onRemesh={handleVoxelRemesh}
                                onGpuDynamesh={handleGpuDynamesh}
                                onClearMask={clearMask}
                                onInvertMask={invertMask}
                                onExtractMask={extractMask}
                                gizmoMode={gizmoMode}
                                setGizmoMode={setGizmoMode}
                                transformSpace={transformSpace}
                                setTransformSpace={setTransformSpace}
                                snapEnabled={snapEnabled}
                                setSnapEnabled={setSnapEnabled}
                                transformData={transformData}
                                updateTransformFromUI={updateTransformFromUI}
                            />
                        ),
                    },
                    {
                        id: 'edit',
                        label: 'Edit',
                        icon: Move,
                        content: (
                            <LeftPanel
                                mode="edit"
                                appMode={appMode}
                                modelState={modelState}
                                setModelState={setModelState}
                                activeTool={activeTool}
                                setActiveTool={setActiveTool}
                                setMode={setMode}
                                activeColor={activeColor}
                                setActiveColor={setActiveColor}
                                undo={undo}
                                wireframe={wireframe}
                                setWireframe={setWireframe}
                                sharedState={sharedState}
                                activeAlpha={activeAlpha}
                                setActiveAlpha={setActiveAlpha}
                                hasSelection={Boolean(activeLayerId)}
                                onSaveAlphaToStorage={() => { }}
                                subdivisionLevel={subdivisionLevel}
                                polyCount={activePolyCount}
                                handleStepUp={handleStepUp}
                                onRemesh={handleVoxelRemesh}
                                onClearMask={clearMask}
                                onInvertMask={invertMask}
                                onExtractMask={extractMask}
                                gizmoMode={gizmoMode}
                                setGizmoMode={setGizmoMode}
                                transformSpace={transformSpace}
                                setTransformSpace={setTransformSpace}
                                snapEnabled={snapEnabled}
                                setSnapEnabled={setSnapEnabled}
                                transformData={transformData}
                                updateTransformFromUI={updateTransformFromUI}
                            />
                        ),
                    },
                    {
                        id: 'kmath',
                        label: 'Experimental',
                        icon: FlaskConical,
                        content: (
                            <MathBrushPanel
                                activeMathBrush={activeMathBrush}
                                onSelectMathBrush={setActiveMathBrush}
                                brushParams={mathBrushParams}
                                onParamChange={(brushId, key, v) =>
                                    setMathBrushParams(prev => ({
                                        ...prev,
                                        [brushId]: { ...prev[brushId], [key]: v }
                                    }))
                                }
                                computeMs={mathBrushStats?.computeMs}
                                affectedVerts={mathBrushStats?.affectedVerts}
                            />
                        ),
                    },
                ],
            }}
            right={{
                title: 'INSPECT',
                defaultSize: 20,
                minSize: 14,
                collapsedSize: 4,
                tabs: [
                    {
                        id: 'layers',
                        label: 'Subtools',
                        icon: Layers,
                        content: (
                            <RightPanel
                                mode="layers"
                                layers={layers}
                                activeLayerId={activeLayerId}
                                setActiveLayerId={handleLayerSelect}
                                toggleVisibility={handleToggleVis}
                                deleteLayer={handleDeleteLayer}
                                mergeDown={handleMergeDown}
                                mergeSelected={handleMergeSelected}
                                mergeAll={handleMergeAll}
                                selectedLayerIds={selectedLayerIds}
                                loadPrimitive={loadPrimitive}
                                loadFromStorage={loadFromStorage}
                                sharedState={sharedState}
                                materialMode={materialMode}
                                setMaterialMode={setMaterialMode}
                                activeMaterial={activeMaterial}
                                applyMaterial={handleApplyMaterial}
                                projectMaterials={sharedState?.materials || []}
                            />
                        ),
                    },
                    {
                        id: 'materials',
                        label: 'Materials',
                        icon: Palette,
                        content: (
                            <RightPanel
                                mode="materials"
                                layers={layers}
                                activeLayerId={activeLayerId}
                                setActiveLayerId={handleLayerSelect}
                                toggleVisibility={handleToggleVis}
                                deleteLayer={handleDeleteLayer}
                                mergeDown={handleMergeDown}
                                mergeSelected={handleMergeSelected}
                                mergeAll={handleMergeAll}
                                selectedLayerIds={selectedLayerIds}
                                loadPrimitive={loadPrimitive}
                                loadFromStorage={loadFromStorage}
                                sharedState={sharedState}
                                materialMode={materialMode}
                                setMaterialMode={setMaterialMode}
                                activeMaterial={activeMaterial}
                                applyMaterial={handleApplyMaterial}
                                projectMaterials={sharedState?.materials || []}
                            />
                        ),
                    },
                    {
                        id: 'flux',
                        label: 'Flux',
                        icon: Zap,
                        content: (
                            <FluxPanel
                                active={fluxActive}
                                fluxMode={fluxMode}
                                setFluxMode={setFluxMode}
                                params={fluxParams}
                                setParams={(p) => setFluxParams(prev => ({ ...prev, ...p }))}
                                onFreeze={() => flux.freeze()}
                                onReset={() => flux.resetVelocity()}
                                isGPU={flux.isGPU}
                                isReady={flux.isReady}
                            />
                        ),
                    },
                ],
            }}
        >
            {/* VIEWPORT CONTENT */}
            <div
                className={`relative h-full w-full cursor-crosshair ${useNativeRenderer ? 'bg-transparent pointer-events-none' : 'bg-black'}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={async (e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const file = e.dataTransfer.files[0];
                        // @ts-ignore
                        const path = file.path;
                        if (path) {
                            setStatus(`LOADING: ${file.name}`);
                            invoke('leash_load_model', { path }).then(() => setStatus("SCULPT READY (BEVY)")).catch(err => console.error("Bevy Load Failed:", err));
                        }
                        return;
                    }
                    const data = e.dataTransfer.getData('application/json');
                    try {
                        const item = JSON.parse(data);
                        if (item.type === 'MESH') {
                            let artifact = item;
                            if (!item.blob && sharedState?.storage) {
                                const found = sharedState.storage.find((a: any) => a.id === item.id);
                                if (found) artifact = found;
                            }
                            if (artifact.path) invoke('leash_load_model', { path: artifact.path });
                            else if (artifact.blob) await loadFromStorage(artifact);
                        }
                        else if (item.type === 'MAT') handleApplyMaterial(item);
                        else if (item.type === 'ALPHA') setActiveAlpha(item);
                    } catch (err) { console.error("Drop failed", err); }
                }}
            >
                {/* Three.js Canvas */}
                <div
                    ref={mountRef}
                    className="absolute inset-0 z-0 outline-none opacity-0 pointer-events-none"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                />

                {/* NEW 2D SCREENSPACE CURSOR - Bulletproof, no glitches! */}
                <ScreenspaceCursor
                    radius={radius}
                    camera={sceneRef.current?.camera || null}
                    visible={isSceneReady && mode === 'SCULPT' && activeTool !== 'SELECT' && !isBevyActive && !useNativeRenderer}
                    isActive={sceneRef.current?.isSculpting || false}
                    symmetry={symmetry}
                    mountRef={mountRef}
                    color="#ff8c00"
                />

                {/* OVERLAYS - Using unified QuickMenu */}
                <KSculptQuickMenu
                    open={isSpaceMenuOpen}
                    onOpenChange={setIsSpaceMenuOpen}
                    activeBrush={activeBrush}
                    setActiveBrush={setActiveBrush}
                    intensity={intensity}
                    setIntensity={setIntensity}
                    radius={radius}
                    setRadius={setRadius}
                    gpuMode={simGpuMode}
                    setGpuMode={setSimGpuMode}
                    pinned={isSpaceMenuLocked}
                    setPinned={setIsSpaceMenuLocked}
                    onReset={() => {
                        const defaultBrush = brushClient.getDefaultBrush();
                        setActiveBrush(defaultBrush);
                        setIntensity(0.5);
                        setRadius(0.5);
                    }}
                />

                {/* STATUS BAR */}
                <div className="absolute top-20 left-6 flex flex-col gap-2 pointer-events-none">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-orange-500 bg-black/80 px-4 py-2 border-l-2 border-orange-500 shadow-xl backdrop-blur-md">
                        <Activity size={12} className="animate-pulse" /> {status}
                    </div>
                    <div className="text-[10px] font-bold text-sky-300 bg-sky-950/80 px-4 py-2 border-l-2 border-sky-400 shadow-xl backdrop-blur-md">
                        NATIVE VIEWPORT: PRIMARY
                    </div>
                    <div className="text-[10px] font-bold text-sky-300 bg-sky-950/70 px-4 py-2 border-l-2 border-sky-400 shadow-xl backdrop-blur-md">
                        PICK: {nativeSelection?.hit ? `FACE ${nativeSelection.faceIndex ?? '?'}` : 'NO-HIT'}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}


import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Layers, Settings, LayoutGrid, Zap, Box, Cpu, Share2, Grid, Mountain, Grid3X3, Image as ImageIcon, Columns, Maximize } from 'lucide-react';
import { normalizeObject, ensureUVs, MeshImportProfiles } from '@/systems/three/meshPipeline';
import { StudioStage, StudioStagePresets } from '@/systems/three/StudioStage';

// AppShell + SplitView
import { AppShell } from '@/ui/shell/AppShell';
import { AppMenuBar } from '@/ui/shell/AppMenuBar';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { cn } from '@/ui/primitives/cn';
import { GripVertical } from 'lucide-react';

// UI Components
import { AppTopBar, AppTopBarGroup, AppTopBarButton, AppTopBarToggleGroup, AppTopBarToggleItem, AppTopBarSeparator } from '@/ui/shell/AppTopBar';
import LeftPanel from './ui/LeftPanel';
import RightPanel from './ui/RightPanel';

// UV Engine
import { createKippUVGrid, applyUVProjection, applyLSCM, ProjectionConfig, applyGpuProjection, canUseGpuProjection, applyGpuPack } from './KAtlasUVEngine';
import { applyBoxProjection } from './KAtlasBox';
import { setupMaterialLink, updateMaterialView } from './KAtlasUVmatlink';
import { applyHybridAutoUnwrap } from './KAtlasHybrid';
import type { ProjectionMode } from '@/services/atlasClient';
import { spawnPrimitiveToThree } from '@/lib/primitives';

// UV Views
import KAtlasUVEditor from './KAtlasUVEditor';
import KAtlasUVHologram from './KAtlasUVHologram';

export default function KAtlas({ sharedState, onCommit }: any) {
    // Core State
    const [projection, setProjection] = useState('ORIGINAL');
    const [targetAxis, setTargetAxis] = useState('Y'); // X, Y, Z
    const [coordSpace, setCoordSpace] = useState('LOCAL'); // LOCAL, WORLD
    const [status, setStatus] = useState("SYSTEM_IDLE");
    const [isProcessing, setIsProcessing] = useState(false);
    const [uvStats, setUvStats] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'GRID' | 'MATERIAL'>('GRID');
    const [showOriginal, setShowOriginal] = useState(true);
    const [layoutMode, setLayoutMode] = useState<'3D' | 'SPLIT' | '2D'>('SPLIT');

    // Multi-Mesh State
    const [hierarchy, setHierarchy] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedFaceIndices, setSelectedFaceIndices] = useState<number[]>([]);

    // Modifier Stack State
    const [scale, setScale] = useState(1.0);
    const [stretchU, setStretchU] = useState(1.0);
    const [stretchV, setStretchV] = useState(1.0);
    const [rotation, setRotation] = useState(0);
    const [offsetU, setOffsetU] = useState(0.0);
    const [offsetV, setOffsetV] = useState(0.0);
    const [jitter, setJitter] = useState(0.0);

    // LSCM State
    const [lscmIterations, setLscmIterations] = useState(600);
    const [lscmPadding, setLscmPadding] = useState(2);
    const [lscmTexels, setLscmTexels] = useState(32);
    const [lscmResolution, setLscmResolution] = useState(1024);

    // Box Projection State
    const [boxPadding, setBoxPadding] = useState(0.005);
    const [boxWorldAlign, setBoxWorldAlign] = useState(true);
    const [boxCameraCount, setBoxCameraCount] = useState(6); // Multi-camera projection (6, 14, 26, 50, 98)

    // UV View Mode (2D flat vs 3D hologram)
    const [uvViewMode, setUvViewMode] = useState<'2D' | 'HOLOGRAM'>('HOLOGRAM');

    // Hybrid Mode State
    const [hybridAutoClassify, setHybridAutoClassify] = useState(true);
    const [hybridForceMode, setHybridForceMode] = useState<'AUTO' | 'LSCM' | 'BOX'>('AUTO');

    // GPU Compute State
    const [useGpu, setUseGpu] = useState(true); // GPU projection enabled by default
    const gpuAvailable = canUseGpuProjection();

    // Panel Layout Ref (Imperative Control)
    const panelGroupRef = useRef<any>(null);

    useEffect(() => {
        const group = panelGroupRef.current;
        if (!group) return;

        if (layoutMode === '3D') {
            group.setLayout([100, 0]);
        } else if (layoutMode === '2D') {
            group.setLayout([0, 100]);
        } else if (layoutMode === 'SPLIT') {
            const currentHandlers = group.getLayout(); // Check current layout
            // If one side is fully collapsed, reset to 50/50. Otherwise respect user's manual resize.
            if (currentHandlers && (currentHandlers[0] === 100 || currentHandlers[0] === 0)) {
                group.setLayout([50, 50]);
            }
        }
    }, [layoutMode]);

    const mountRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<StudioStage | null>(null);

    const engine = useRef<any>({
        rootGroup: null,
        checkerTex: createKippUVGrid(),
        selectionBox: null,
        meshes: {}, // Map<uuid, Mesh>
        originalGeos: {} // Map<uuid, BufferGeometry>
    });

    // --- INIT ENGINE ---
    useEffect(() => {
        if (!mountRef.current) return;

        // Use StudioStage for canonical runtime
        const stage = new StudioStage(mountRef.current, {
            ...StudioStagePresets.default,
            background: 0x050505,
            cameraPosition: [6, 5, 6],
            grid: false, // Custom grid below
        });
        stageRef.current = stage;

        // Custom grid for UV visualization
        const grid = new THREE.GridHelper(30, 30, 0x333333, 0x0a0a0a);
        grid.position.y = -2;
        stage.scene.add(grid);

        const rootGroup = new THREE.Group();
        stage.scene.add(rootGroup);

        const selectionBox = new THREE.BoxHelper(undefined, 0x00b894);
        selectionBox.visible = false;
        stage.scene.add(selectionBox);

        // KAtlas-specific accent light
        const backLight = new THREE.DirectionalLight(0x00b894, 0.5);
        backLight.position.set(-5, 2, -5);
        stage.scene.add(backLight);

        engine.current = { ...engine.current, rootGroup, selectionBox };

        let demoCancelled = false;

        // Initial Demo Load if no artifact
        if (!sharedState?.artifact) {
            (async () => {
                const group = new THREE.Group();

                let geo1: THREE.BufferGeometry;
                try {
                    geo1 = await spawnPrimitiveToThree('cube', { subdivisions: 3 });
                } catch (e) {
                    console.warn('[KAtlas] Universal primitive failed, using fallback');
                    geo1 = new THREE.BoxGeometry(1, 1, 1);
                }

                let geo2: THREE.BufferGeometry;
                try {
                    geo2 = await spawnPrimitiveToThree('sphere', { subdivisions: 4 });
                } catch (e) {
                    console.warn('[KAtlas] Universal primitive failed, using fallback');
                    geo2 = new THREE.SphereGeometry(0.6, 32, 32);
                }

                if (demoCancelled) {
                    geo1.dispose();
                    geo2.dispose();
                    return;
                }

                const m1 = new THREE.Mesh(geo1, new THREE.MeshStandardMaterial({ color: 0x3366ff }));
                m1.name = "Demo_Cube";
                m1.position.set(-1, 0, 0);
                m1.scale.setScalar(0.5);

                const m2 = new THREE.Mesh(geo2, new THREE.MeshStandardMaterial({ color: 0xff3366 }));
                m2.name = "Demo_Sphere";
                m2.position.set(1, 0, 0);
                m2.scale.setScalar(0.6);

                group.add(m1);
                group.add(m2);
                loadScene(group);
            })();
        }

        // Attach resize observer
        stage.attachResizeObserver(mountRef.current);

        return () => {
            demoCancelled = true;
            stage.dispose();
            stageRef.current = null;
        };
    }, []); // Empty dependency array means this runs once on mount

    // --- KERNEL HOT-SWAP ---
    useEffect(() => {
        if (sharedState?.artifact && engine.current.rootGroup) {
            setStatus("SYNCING_KERNEL...");
            const url = URL.createObjectURL(sharedState.artifact);
            const loader = new GLTFLoader();
            loader.load(url, (gltf) => {
                loadScene(gltf.scene);
                URL.revokeObjectURL(url);
            });
        }
    }, [sharedState?.artifact]);

    // --- VIEW MODE TOGGLE EFFECT ---
    useEffect(() => {
        const { rootGroup, checkerTex } = engine.current;
        if (rootGroup) {
            const commonMat = new THREE.MeshStandardMaterial({
                map: checkerTex,
                color: 0xffffff,
                roughness: 0.3,
                metalness: 0.2,
                side: THREE.DoubleSide
            });

            updateMaterialView(rootGroup, viewMode === 'MATERIAL', commonMat);
        }
    }, [viewMode]);

    const loadScene = (sceneRoot) => {
        const { rootGroup, checkerTex } = engine.current;

        // Clear old
        while (rootGroup.children.length > 0) {
            const c = rootGroup.children[0];
            rootGroup.remove(c);
            if (c.geometry) c.geometry.dispose();
        }

        engine.current.meshes = {};
        engine.current.originalGeos = {};

        const newHierarchy: any[] = [];
        const newIds: string[] = [];

        // Center and normalize the scene using canonical pipeline
        normalizeObject(sceneRoot, MeshImportProfiles.atlas);

        const commonMat = new THREE.MeshStandardMaterial({
            map: checkerTex,
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.2,
            side: THREE.DoubleSide
        });

        // 1. Preserve Originals via MatLink
        setupMaterialLink(sceneRoot);

        // Ensure all meshes have UVs
        ensureUVs(sceneRoot, { mode: 'zero' });

        let idx = 0;
        sceneRoot.traverse((child) => {
            if (child.isMesh) {
                const newGeo = child.geometry.clone();
                newGeo.computeVertexNormals();

                child.castShadow = true;
                child.receiveShadow = true;

                if (!child.name) child.name = `Polygroup_${idx}`;

                engine.current.meshes[child.uuid] = child;
                engine.current.originalGeos[child.uuid] = newGeo.clone(); // Backup with original UVs

                newHierarchy.push({
                    id: child.uuid,
                    name: child.name,
                    visible: true,
                    verts: newGeo.attributes.position.count
                });
                newIds.push(child.uuid);
                idx++;
            }
        });

        // 2. Apply initial view mode
        updateMaterialView(sceneRoot, viewMode === 'MATERIAL', commonMat);

        rootGroup.add(sceneRoot);
        setHierarchy(newHierarchy);
        setSelectedIds(newIds);
        setProjection('ORIGINAL'); // Reset projection mode
        setStatus(`SCENE_LOADED: ${idx} MESHES`);
    };

    const handleSelection = (id: string, multi: boolean) => {
        let newSelection = [...selectedIds];
        if (multi) {
            if (newSelection.includes(id)) newSelection = newSelection.filter(uid => uid !== id);
            else newSelection.push(id);
        } else {
            newSelection = [id];
        }
        setSelectedIds(newSelection);

        // Update Selection Box
        const { selectionBox, meshes } = engine.current;
        if (newSelection.length > 0) {
            if (newSelection.length === 1) {
                const m = meshes[newSelection[0]];
                if (m) { selectionBox.setFromObject(m); selectionBox.visible = true; }
            } else {
                selectionBox.visible = false;
            }
        } else {
            selectionBox.visible = false;
        }
    };

    const toggleVis = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const mesh = engine.current.meshes[id];
        if (mesh) {
            mesh.visible = !mesh.visible;
            setHierarchy(prev => prev.map(item => item.id === id ? { ...item, visible: mesh.visible } : item));
        }
    };

    // --- THE MULTI-WAR ALGORITHM ---
    const performUnwrap = (forceProj: string | null = null) => {
        if (selectedIds.length === 0) { setStatus("NO_MESH_SELECTED"); return; }

        const pMode = forceProj || projection;
        const { meshes, camera, originalGeos } = engine.current;

        setIsProcessing(true);
        setStatus(`BATCH_COMPUTE: ${pMode} [${coordSpace}]`);

        setTimeout(() => {
            let totalVerts = 0;

            // Projection Config Bundle
            const config: ProjectionConfig = {
                projection: pMode,
                targetAxis: targetAxis,
                coordSpace: coordSpace,
                scale: scale,
                stretchU: stretchU,
                stretchV: stretchV,
                rotation: rotation,
                offsetU: offsetU,
                offsetV: offsetV,
                jitter: jitter,
                camera: camera
            };

            const promises: Promise<void>[] = [];

            selectedIds.forEach(id => {
                const mesh = meshes[id];
                if (!mesh || !mesh.visible) return;

                // GPU PROJECTION PATH (1M+ vertices in milliseconds)
                // Supported modes: BOX, PLANAR_X/Y/Z, CYLINDRICAL, SPHERICAL
                const gpuModes = ['BOX', 'BOX_6AXIS', 'PLANAR_AXIS', 'CYLINDRICAL', 'SPHERICAL'];
                const canUseGpuPath = useGpu && gpuAvailable && gpuModes.includes(config.projection);

                if (canUseGpuPath) {
                    // Map projection mode to GPU mode
                    let gpuMode: ProjectionMode = 'BOX';
                    if (config.projection === 'BOX' || config.projection === 'BOX_6AXIS') {
                        gpuMode = 'BOX';
                    } else if (config.projection === 'PLANAR_AXIS') {
                        gpuMode = `PLANAR_${targetAxis}` as ProjectionMode;
                    } else if (config.projection === 'CYLINDRICAL') {
                        gpuMode = 'CYLINDRICAL';
                    } else if (config.projection === 'SPHERICAL') {
                        gpuMode = 'SPHERICAL';
                    }

                    promises.push(
                        applyGpuProjection(mesh, {
                            mode: gpuMode,
                            scale: scale,
                            offsetU: offsetU,
                            offsetV: offsetV,
                        }).then(result => {
                            totalVerts += result.vertCount;
                            console.log(`[GPU] ${result.vertCount} verts in ${result.timeMs.toFixed(2)}ms`);
                        }).catch(err => {
                            console.warn('[GPU] Falling back to CPU:', err);
                            // Fallback to CPU
                            const vertCount = applyUVProjection(mesh, originalGeos[id], config);
                            totalVerts += vertCount;
                        })
                    );
                } else if (config.projection === 'LSCM') {
                    const lscmConfig = {
                        maxIterations: lscmIterations,
                        padding: lscmPadding,
                        texelsPerUnit: lscmTexels,
                        resolution: lscmResolution
                    };
                    promises.push(applyLSCM(mesh, lscmConfig).then(count => {
                        totalVerts += count;
                    }));
                } else if (config.projection === 'BOX_6AXIS') {
                    // Start of Box Logic
                    applyBoxProjection(mesh, { padding: boxPadding, worldAlign: boxWorldAlign, cameraCount: boxCameraCount });
                    totalVerts += mesh.geometry.attributes.position.count;
                    promises.push(Promise.resolve());
                } else if (config.projection === 'HYBRID_AUTO') {
                    // New Hybrid Auto Mode - Intelligent unwrapping
                    const hybridConfig = {
                        lscmIterations: lscmIterations,
                        boxPadding: boxPadding,
                        boxWorldAlign: boxWorldAlign,
                        boxCameraCount: boxCameraCount,
                        autoClassify: hybridAutoClassify,
                        forceMode: hybridForceMode === 'AUTO' ? undefined : hybridForceMode
                    };

                    promises.push(applyHybridAutoUnwrap(mesh, hybridConfig).then(result => {
                        totalVerts += result.vertCount;
                        console.log(`Hybrid: ${result.classification} → ${result.solver} solver`);
                    }));
                } else {
                    const vertCount = applyUVProjection(mesh, originalGeos[id], config);
                    totalVerts += vertCount;
                }
            });

            Promise.all(promises).then(() => {
                setUvStats({ verts: totalVerts, meshes: selectedIds.length });
                setIsProcessing(false);
                setStatus("TOPOLOGY_UPDATED");
                // Force update editor by toggling selection or similar? 
                // Actually the Editor depends on selectedIds and meshes. 
                // If meshes geometry changes, we might need to signal update.
                // For now, we can just trigger a re-render of Editor by updating a dummy state or relying on selectedIds if they change.
                // But selectedIds don't change here.
                // We can pass a version number to Editor.
                setUvStats(prev => ({ ...prev, version: Date.now() }));
            });
        }, 20);
    };

    const handlePreset = (type: string) => {
        if (type === 'WALL') {
            setProjection('BOX');
            setCoordSpace('WORLD');
            setScale(1.0);
            setStretchU(1.0); setStretchV(1.0);
            setJitter(0.0);
            setTimeout(() => performUnwrap('BOX'), 0);
        } else if (type === 'FLOOR') {
            setProjection('PLANAR_AXIS');
            setTargetAxis('Y');
            setCoordSpace('WORLD');
            setScale(0.5);
            setJitter(0.0);
            setTimeout(() => performUnwrap('PLANAR_AXIS'), 0);
        } else if (type === 'PROP') {
            setProjection('BOX');
            setCoordSpace('LOCAL');
            setScale(1.0);
            setJitter(0.0);
            setTimeout(() => performUnwrap('BOX'), 0);
        } else if (type === 'ATLAS_GRID') {
            setProjection('BOX');
            setScale(4.0);
            setTimeout(() => performUnwrap('BOX'), 0);
        }
    };

    const handlePack = async () => {
        if (selectedIds.length === 0) return;

        const { meshes } = engine.current;

        setIsProcessing(true);
        setStatus(`PACKING ${selectedIds.length} MESHES...`);

        // Use GPU packing if available
        if (useGpu && gpuAvailable) {
            try {
                let totalIslands = 0;
                for (const id of selectedIds) {
                    const mesh = meshes[id];
                    if (!mesh || !mesh.geometry.attributes.uv) continue;

                    const result = await applyGpuPack(mesh, 0.01);
                    totalIslands += result.islandCount;
                }
                setStatus(`GPU PACKED ${totalIslands} ISLANDS`);
            } catch (err) {
                console.warn('[GPU Pack] Falling back to CPU:', err);
                // Fallback to simple grid packer
                cpuGridPack();
            }
        } else {
            cpuGridPack();
        }

        setIsProcessing(false);
        setUvStats(prev => ({ ...prev, version: Date.now() }));
    };

    // Simple CPU grid packer (fallback)
    const cpuGridPack = () => {
        const { meshes } = engine.current;
        const cols = Math.ceil(Math.sqrt(selectedIds.length));
        const cellSize = 1.0 / cols;

        selectedIds.forEach((id, idx) => {
            const mesh = meshes[id];
            if (!mesh) return;

            const col = idx % cols;
            const row = Math.floor(idx / cols);

            const uOff = col * cellSize;
            const vOff = row * cellSize;

            const geo = mesh.geometry;
            const uvs = geo.attributes.uv;

            for (let i = 0; i < uvs.count; i++) {
                let u = uvs.getX(i);
                let v = uvs.getY(i);

                u = u * cellSize + uOff;
                v = v * cellSize + vOff;

                uvs.setXY(i, u, v);
            }
            uvs.needsUpdate = true;
        });
        setStatus("CPU PACKING COMPLETE");
    };

    const handleCommit = () => {
        const { rootGroup } = engine.current;
        if (!rootGroup) return;
        setStatus("PACKING_SCENE...");

        // RESTORE MATERIALS BEFORE EXPORT if currently in GRID mode, 
        // or should we export what is seen? Typically user wants the UVs on their original mats.
        // So we force restore originals momentarily or just clone and restore.

        // Let's force restore originals for export to keep material data
        const commonMat = new THREE.MeshStandardMaterial(); // dummy
        updateMaterialView(rootGroup, true, commonMat);

        const exporter = new GLTFExporter();
        exporter.parse(
            rootGroup,
            (gltf) => {
                const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
                if (onCommit) {
                    onCommit(blob, "K-ATLAS_UNWRAP");
                    setStatus("SENT TO KERNEL");
                }
                // Restore view mode
                updateMaterialView(rootGroup, viewMode === 'MATERIAL', engine.current.checkerTex);
            },
            (err) => console.error(err),
            { binary: true }
        );
    };

    // 3D Viewport Component
    const Viewport3D = (
        <div className="relative w-full h-full bg-gradient-to-b from-[#080808] to-[#050505]">
            <div ref={mountRef} className="absolute inset-0 cursor-move" />
            <div className="absolute bottom-6 right-6 text-right pointer-events-none opacity-30">
                <h2 className="text-4xl font-black text-[#222] tracking-tighter">kipp engine</h2>
                <p className="text-[10px] font-mono text-gray-600">0.5 alpha</p>
            </div>
        </div>
    );

    // UV Editor Component
    const UVView = (
        <div className="relative w-full h-full bg-[#111]">
            {uvViewMode === '2D' ? (
                <KAtlasUVEditor
                    meshes={engine.current.meshes}
                    selectedIds={selectedIds}
                    syncSelection={selectedFaceIndices}
                    onSelectionChange={setSelectedFaceIndices}
                    version={uvStats?.version || 0}
                />
            ) : (
                <KAtlasUVHologram
                    meshes={engine.current.meshes}
                    selectedIds={selectedIds}
                    version={uvStats?.version || 0}
                />
            )}
        </div>
    );

    return (
        <AppShell
            className="bg-[#050505] text-gray-300 font-mono select-none overflow-hidden"
            menuBar={
                <AppMenuBar
                    menus={[
                        {
                            label: 'File',
                            items: [
                                { label: 'Export / Uplink', onSelect: handleCommit, shortcut: 'Ctrl+S' },
                            ],
                        },
                        {
                            label: 'Edit',
                            items: [
                                { label: 'Select All', onSelect: () => setSelectedIds(hierarchy.map(h => h.id)) },
                                { label: 'Invert Selection', disabled: true },
                            ],
                        },
                        {
                            label: 'UV',
                            items: [
                                { label: 'Apply Projection', onSelect: () => performUnwrap() },
                                { label: 'Pack Islands', onSelect: handlePack },
                                { label: 'Reset UVs', disabled: true },
                            ],
                        },
                        {
                            label: 'View',
                            items: [
                                { label: '3D Only', onSelect: () => setLayoutMode('3D') },
                                { label: 'Split View', onSelect: () => setLayoutMode('SPLIT') },
                                { label: 'UV Only', onSelect: () => setLayoutMode('2D') },
                            ],
                        },
                    ]}
                />
            }
            menuBarDefaultOpen={false}
            topBar={
                <AppTopBar>
                    {/* LEFT: Status and Stats */}
                    <AppTopBarGroup align="start">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-teal-400 bg-black/50 px-3 py-1.5 rounded border-l-2 border-teal-500">
                            <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-yellow-400 animate-ping' : 'bg-teal-400'}`} />
                            <span className="font-mono tracking-wider">{status}</span>
                        </div>

                        {uvStats && (
                            <div className="flex items-center gap-3 text-[9px] text-gray-500">
                                <span><span className="text-teal-400">{uvStats.verts?.toLocaleString()}</span> verts</span>
                                <span><span className="text-teal-400">{uvStats.meshes}</span> meshes</span>
                            </div>
                        )}

                        {/* GPU Toggle */}
                        {gpuAvailable && (
                            <AppTopBarButton
                                onClick={() => setUseGpu(!useGpu)}
                                tooltip={useGpu ? 'GPU Compute Active (click to disable)' : 'Enable GPU Compute'}
                                icon={<Cpu size={12} className={useGpu ? 'animate-pulse' : ''} />}
                                label={`GPU ${useGpu ? 'ON' : 'OFF'}`}
                                variant={useGpu ? 'solid' : 'ghost'}
                                active={useGpu}
                            />
                        )}
                    </AppTopBarGroup>

                    {/* CENTER: Layout and View Mode Controls */}
                    <AppTopBarGroup align="center">
                        <AppTopBarToggleGroup type="single" value={layoutMode} onValueChange={(val) => val && setLayoutMode(val as '3D' | 'SPLIT' | '2D')}>
                            <AppTopBarToggleItem value="3D" tooltip="3D View Only" icon={<Box size={14} />} />
                            <AppTopBarToggleItem value="SPLIT" tooltip="Split Screen" icon={<Columns size={14} />} />
                            <AppTopBarToggleItem value="2D" tooltip="UV Editor Fullscreen" icon={<Maximize size={14} />} />
                        </AppTopBarToggleGroup>

                        <AppTopBarSeparator />

                        {/* View Mode (Grid/Material) */}
                        <AppTopBarButton
                            onClick={() => setViewMode(viewMode === 'GRID' ? 'MATERIAL' : 'GRID')}
                            tooltip={viewMode === 'GRID' ? 'Show Original Materials' : 'Show UV Grid'}
                            icon={viewMode === 'GRID' ? <Grid3X3 size={14} /> : <ImageIcon size={14} />}
                            variant="ghost"
                        />

                        {/* UV View Mode (only when UV visible) */}
                        {(layoutMode === 'SPLIT' || layoutMode === '2D') && (
                            <>
                                <AppTopBarSeparator />
                                <AppTopBarToggleGroup type="single" value={uvViewMode} onValueChange={(val) => val && setUvViewMode(val as '2D' | 'HOLOGRAM')}>
                                    <AppTopBarToggleItem value="2D" tooltip="2D UV Editor" icon={<Grid size={10} />} label="2D" />
                                    <AppTopBarToggleItem value="HOLOGRAM" tooltip="3D Hologram View" icon={<Mountain size={10} />} label="3D" />
                                </AppTopBarToggleGroup>
                            </>
                        )}
                    </AppTopBarGroup>

                    {/* RIGHT: Uplink Button */}
                    <AppTopBarGroup align="end">
                        <AppTopBarButton
                            onClick={handleCommit}
                            tooltip="Export to Kernel / Asset Browser"
                            shortcut="Ctrl+S"
                            icon={<Share2 size={12} />}
                            label="UPLINK"
                            variant="solid"
                            className="bg-teal-500/10 hover:bg-teal-500 border border-teal-500/50 hover:border-teal-400 text-teal-400 hover:text-black"
                        />
                    </AppTopBarGroup>
                </AppTopBar>
            }
            left={{
                title: 'UV TOOLS',
                defaultSize: 26,
                minSize: 18,
                collapsedSize: 4,
                tabs: [
                    {
                        id: 'projection',
                        label: 'Project',
                        icon: Cpu,
                        content: (
                            <LeftPanel
                                mode="projection"
                                projection={projection}
                                setProjection={setProjection}
                                coordSpace={coordSpace}
                                setCoordSpace={setCoordSpace}
                                targetAxis={targetAxis}
                                setTargetAxis={setTargetAxis}
                                onPerformUnwrap={performUnwrap}
                                onPack={handlePack}
                                onPreset={handlePreset}
                                isProcessing={isProcessing}
                                scale={scale}
                                setScale={setScale}
                                stretchU={stretchU}
                                setStretchU={setStretchU}
                                stretchV={stretchV}
                                setStretchV={setStretchV}
                                rotation={rotation}
                                setRotation={setRotation}
                                offsetU={offsetU}
                                setOffsetU={setOffsetU}
                                offsetV={offsetV}
                                setOffsetV={setOffsetV}
                                jitter={jitter}
                                setJitter={setJitter}
                                lscmIterations={lscmIterations}
                                setLscmIterations={setLscmIterations}
                                lscmPadding={lscmPadding}
                                setLscmPadding={setLscmPadding}
                                lscmTexels={lscmTexels}
                                setLscmTexels={setLscmTexels}
                                lscmResolution={lscmResolution}
                                setLscmResolution={setLscmResolution}
                                boxPadding={boxPadding}
                                setBoxPadding={setBoxPadding}
                                boxWorldAlign={boxWorldAlign}
                                setBoxWorldAlign={setBoxWorldAlign}
                                boxCameraCount={boxCameraCount}
                                setBoxCameraCount={setBoxCameraCount}
                                hybridAutoClassify={hybridAutoClassify}
                                setHybridAutoClassify={setHybridAutoClassify}
                                hybridForceMode={hybridForceMode}
                                setHybridForceMode={setHybridForceMode}
                            />
                        ),
                    },
                    {
                        id: 'auto',
                        label: 'Auto',
                        icon: Zap,
                        content: (
                            <LeftPanel
                                mode="auto"
                                projection={projection}
                                setProjection={setProjection}
                                coordSpace={coordSpace}
                                setCoordSpace={setCoordSpace}
                                targetAxis={targetAxis}
                                setTargetAxis={setTargetAxis}
                                onPerformUnwrap={performUnwrap}
                                onPack={handlePack}
                                onPreset={handlePreset}
                                isProcessing={isProcessing}
                                scale={scale}
                                setScale={setScale}
                                stretchU={stretchU}
                                setStretchU={setStretchU}
                                stretchV={stretchV}
                                setStretchV={setStretchV}
                                rotation={rotation}
                                setRotation={setRotation}
                                offsetU={offsetU}
                                setOffsetU={setOffsetU}
                                offsetV={offsetV}
                                setOffsetV={setOffsetV}
                                jitter={jitter}
                                setJitter={setJitter}
                                lscmIterations={lscmIterations}
                                setLscmIterations={setLscmIterations}
                                lscmPadding={lscmPadding}
                                setLscmPadding={setLscmPadding}
                                lscmTexels={lscmTexels}
                                setLscmTexels={setLscmTexels}
                                lscmResolution={lscmResolution}
                                setLscmResolution={setLscmResolution}
                                boxPadding={boxPadding}
                                setBoxPadding={setBoxPadding}
                                boxWorldAlign={boxWorldAlign}
                                setBoxWorldAlign={setBoxWorldAlign}
                                boxCameraCount={boxCameraCount}
                                setBoxCameraCount={setBoxCameraCount}
                                hybridAutoClassify={hybridAutoClassify}
                                setHybridAutoClassify={setHybridAutoClassify}
                                hybridForceMode={hybridForceMode}
                                setHybridForceMode={setHybridForceMode}
                            />
                        ),
                    },
                    {
                        id: 'smart',
                        label: 'LSCM',
                        icon: Cpu,
                        content: (
                            <LeftPanel
                                mode="smart"
                                projection={projection}
                                setProjection={setProjection}
                                coordSpace={coordSpace}
                                setCoordSpace={setCoordSpace}
                                targetAxis={targetAxis}
                                setTargetAxis={setTargetAxis}
                                onPerformUnwrap={performUnwrap}
                                onPack={handlePack}
                                onPreset={handlePreset}
                                isProcessing={isProcessing}
                                scale={scale}
                                setScale={setScale}
                                stretchU={stretchU}
                                setStretchU={setStretchU}
                                stretchV={stretchV}
                                setStretchV={setStretchV}
                                rotation={rotation}
                                setRotation={setRotation}
                                offsetU={offsetU}
                                setOffsetU={setOffsetU}
                                offsetV={offsetV}
                                setOffsetV={setOffsetV}
                                jitter={jitter}
                                setJitter={setJitter}
                                lscmIterations={lscmIterations}
                                setLscmIterations={setLscmIterations}
                                lscmPadding={lscmPadding}
                                setLscmPadding={setLscmPadding}
                                lscmTexels={lscmTexels}
                                setLscmTexels={setLscmTexels}
                                lscmResolution={lscmResolution}
                                setLscmResolution={setLscmResolution}
                                boxPadding={boxPadding}
                                setBoxPadding={setBoxPadding}
                                boxWorldAlign={boxWorldAlign}
                                setBoxWorldAlign={setBoxWorldAlign}
                                boxCameraCount={boxCameraCount}
                                setBoxCameraCount={setBoxCameraCount}
                                hybridAutoClassify={hybridAutoClassify}
                                setHybridAutoClassify={setHybridAutoClassify}
                                hybridForceMode={hybridForceMode}
                                setHybridForceMode={setHybridForceMode}
                            />
                        ),
                    },
                    {
                        id: 'hard_surface',
                        label: 'Hard',
                        icon: Box,
                        content: (
                            <LeftPanel
                                mode="hard_surface"
                                projection={projection}
                                setProjection={setProjection}
                                coordSpace={coordSpace}
                                setCoordSpace={setCoordSpace}
                                targetAxis={targetAxis}
                                setTargetAxis={setTargetAxis}
                                onPerformUnwrap={performUnwrap}
                                onPack={handlePack}
                                onPreset={handlePreset}
                                isProcessing={isProcessing}
                                scale={scale}
                                setScale={setScale}
                                stretchU={stretchU}
                                setStretchU={setStretchU}
                                stretchV={stretchV}
                                setStretchV={setStretchV}
                                rotation={rotation}
                                setRotation={setRotation}
                                offsetU={offsetU}
                                setOffsetU={setOffsetU}
                                offsetV={offsetV}
                                setOffsetV={setOffsetV}
                                jitter={jitter}
                                setJitter={setJitter}
                                lscmIterations={lscmIterations}
                                setLscmIterations={setLscmIterations}
                                lscmPadding={lscmPadding}
                                setLscmPadding={setLscmPadding}
                                lscmTexels={lscmTexels}
                                setLscmTexels={setLscmTexels}
                                lscmResolution={lscmResolution}
                                setLscmResolution={setLscmResolution}
                                boxPadding={boxPadding}
                                setBoxPadding={setBoxPadding}
                                boxWorldAlign={boxWorldAlign}
                                setBoxWorldAlign={setBoxWorldAlign}
                                boxCameraCount={boxCameraCount}
                                setBoxCameraCount={setBoxCameraCount}
                                hybridAutoClassify={hybridAutoClassify}
                                setHybridAutoClassify={setHybridAutoClassify}
                                hybridForceMode={hybridForceMode}
                                setHybridForceMode={setHybridForceMode}
                            />
                        ),
                    },
                    {
                        id: 'editor',
                        label: 'Edit',
                        icon: Settings,
                        content: (
                            <LeftPanel
                                mode="editor"
                                projection={projection}
                                setProjection={setProjection}
                                coordSpace={coordSpace}
                                setCoordSpace={setCoordSpace}
                                targetAxis={targetAxis}
                                setTargetAxis={setTargetAxis}
                                onPerformUnwrap={performUnwrap}
                                onPack={handlePack}
                                onPreset={handlePreset}
                                isProcessing={isProcessing}
                                scale={scale}
                                setScale={setScale}
                                stretchU={stretchU}
                                setStretchU={setStretchU}
                                stretchV={stretchV}
                                setStretchV={setStretchV}
                                rotation={rotation}
                                setRotation={setRotation}
                                offsetU={offsetU}
                                setOffsetU={setOffsetU}
                                offsetV={offsetV}
                                setOffsetV={setOffsetV}
                                jitter={jitter}
                                setJitter={setJitter}
                                lscmIterations={lscmIterations}
                                setLscmIterations={setLscmIterations}
                                lscmPadding={lscmPadding}
                                setLscmPadding={setLscmPadding}
                                lscmTexels={lscmTexels}
                                setLscmTexels={setLscmTexels}
                                lscmResolution={lscmResolution}
                                setLscmResolution={setLscmResolution}
                                boxPadding={boxPadding}
                                setBoxPadding={setBoxPadding}
                                boxWorldAlign={boxWorldAlign}
                                setBoxWorldAlign={setBoxWorldAlign}
                                boxCameraCount={boxCameraCount}
                                setBoxCameraCount={setBoxCameraCount}
                                hybridAutoClassify={hybridAutoClassify}
                                setHybridAutoClassify={setHybridAutoClassify}
                                hybridForceMode={hybridForceMode}
                                setHybridForceMode={setHybridForceMode}
                            />
                        ),
                    },
                ],
            }}
            right={{
                title: 'MESHES',
                defaultSize: 20,
                minSize: 14,
                collapsedSize: 4,
                tabs: [
                    {
                        id: 'meshes',
                        label: 'Layers',
                        icon: Layers,
                        content: (
                            <RightPanel
                                mode="meshes"
                                hierarchy={hierarchy}
                                selectedIds={selectedIds}
                                onSelect={handleSelection}
                                onSelectAll={() => setSelectedIds(hierarchy.map(h => h.id))}
                                onToggleVis={toggleVis}
                                viewMode={viewMode}
                                setViewMode={setViewMode}
                                uvStats={uvStats}
                            />
                        ),
                    },
                    {
                        id: 'stats',
                        label: 'Stats',
                        icon: LayoutGrid,
                        content: (
                            <RightPanel
                                mode="stats"
                                hierarchy={hierarchy}
                                selectedIds={selectedIds}
                                onSelect={handleSelection}
                                onSelectAll={() => setSelectedIds(hierarchy.map(h => h.id))}
                                onToggleVis={toggleVis}
                                viewMode={viewMode}
                                setViewMode={setViewMode}
                                uvStats={uvStats}
                            />
                        ),
                    },
                ],
            }}
        >
            <PanelGroup
                ref={panelGroupRef}
                direction="horizontal"
                className="h-full w-full bg-[#050505]"
                autoSaveId="katlas-split-layout"
            >
                {/* PANEL 1: 3D VIEWPORT */}
                <Panel
                    defaultSize={50}
                    minSize={0}
                    collapsible={true}
                    collapsedSize={0}
                    order={1}
                    className={cn("relative transition-all duration-300 ease-in-out", layoutMode === '2D' && "opacity-0 pointer-events-none")}
                >
                    {Viewport3D}
                </Panel>

                <PanelResizeHandle
                    className={cn(
                        'group relative flex items-center justify-center transition-colors w-1.5 bg-[#111] hover:bg-[#222]',
                        (layoutMode === '3D' || layoutMode === '2D') && 'hidden'
                    )}
                >
                    <div className="absolute flex items-center justify-center w-4 h-8 rounded-full bg-[#333] group-hover:bg-teal-500 transition-colors">
                        <GripVertical size={10} className="text-gray-500 group-hover:text-white" />
                    </div>
                </PanelResizeHandle>

                {/* PANEL 2: UV EDITOR */}
                <Panel
                    defaultSize={50}
                    minSize={0}
                    collapsible={true}
                    collapsedSize={0}
                    order={2}
                    className={cn("relative transition-all duration-300 ease-in-out", layoutMode === '3D' && "opacity-0 pointer-events-none")}
                >
                    {UVView}
                </Panel>
            </PanelGroup>
        </AppShell>
    );
}

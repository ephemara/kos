import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import {
    Scan, Activity, Aperture, Sliders, Workflow,
    Box, UploadCloud, FileOutput, Image as ImageIcon, Waves
} from 'lucide-react';
import { HighFidelityRenderer, RenderSettings } from '@/features/inspect/HighFidelityRenderer';
import { ExchangeSystem } from '@/lib/utils/ExchangeSystem';
import { DEFAULT_EXPORT_FORMAT } from '@/lib/utils/exportConfig';
import { useKInspectExport } from '@/hooks/useKInspectExport';
import { AppShell } from '@/ui/shell/AppShell';
import { AppMenuBar } from '@/ui/shell/AppMenuBar';
import type { DockTab } from '@/ui/shell/DockPanel';

import TopBar from './ui/TopBar';
import InspectorPanel from './ui/InspectorPanel';
import MaterialsPanel from './ui/MaterialsPanel';
import ExportPanel from './ui/ExportPanel';
import HierarchyPanel from './ui/HierarchyPanel';
import type { NativeViewportSyncSource } from '@/services/nativeViewportBridge';
import { useRegisterSharedViewport } from '@/features/viewport/sharedViewportSession';

const MAP_SLOTS = [
    { key: 'map', label: 'ALBEDO', icon: <ImageIcon size={10} />, srgb: true },
    { key: 'normalMap', label: 'NORMAL', icon: <Activity size={10} />, srgb: false },
    { key: 'roughnessMap', label: 'ROUGH', icon: <Waves size={10} />, srgb: false },
    { key: 'metalnessMap', label: 'METAL', icon: <Box size={10} />, srgb: false },
    { key: 'emissiveMap', label: 'EMIT', icon: <Aperture size={10} />, srgb: true },
];

export default function KInspect({ sharedState }: any) {
    // UI State
    const [loading, setLoading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState("IDLE");

    // Model Data
    const [modelStats, setModelStats] = useState<any>(null);
    const [hierarchy, setHierarchy] = useState<any[]>([]);
    const [materials, setMaterials] = useState<any[]>([]);
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

    // Export State
    const [targetPreset, setTargetPreset] = useState('GENERIC');
    const [targetFormat, setTargetFormat] = useState(DEFAULT_EXPORT_FORMAT);
    const [useNativeRenderer, setUseNativeRenderer] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem('kinspect.useNativeRenderer') === '1';
    });

    // Tauri-native export hook
    const {
        isExporting,
        exportStatus,
        exportError,
        lastExportPath,
        runExport,
        clearExportError,
    } = useKInspectExport();

    // Render Settings
    const [settings, setSettings] = useState<RenderSettings>({
        exposure: 1.0,
        bloomStrength: 0.4,
        bloomRadius: 0.5,
        bloomThreshold: 0.85,
        rayTracing: false,
        autoRotate: false,
        wireframe: false,
        grid: true,
        clayMode: false
    });

    const mountRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<HighFidelityRenderer | null>(null);
    const textureLoader = useRef(new THREE.TextureLoader());

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem('kinspect.useNativeRenderer', useNativeRenderer ? '1' : '0');
    }, [useNativeRenderer]);

    // --- CORE LOGIC ---
    async function processFile(file: File) {
        setLoading(true);
        setError(null);
        setStatus(`LOADING ${file.name.toUpperCase()}...`);

        try {
            const rawGroup = await ExchangeSystem.import(file);
            const { object, meta } = ExchangeSystem.normalize(rawGroup);
            ExchangeSystem.sanitizeMaterials(object);

            const engine = engineRef.current;
            if (engine) {
                engine.modelGroup.clear();
                engine.modelGroup.add(object);
                scanScene(object);
                setModelStats({
                    name: file.name,
                    polyCount: meta.polyCount || 0,
                    originalScale: meta.originalSize,
                });
            }
            setStatus("ASSET MOUNTED");
        } catch (e: any) {
            console.error(e);
            setError(e?.message ?? String(e));
            setStatus("LOAD FAILED");
        } finally {
            setLoading(false);
        }
    }

    function scanScene(root: THREE.Object3D) {
        const mats: any = {};
        const hier: any[] = [];
        let polys = 0;

        const processNode = (node: any, depth: number) => {
            if (node.isMesh) {
                polys += node.geometry.index ? node.geometry.index.count / 3 : node.geometry.attributes.position.count / 3;
            }
            hier.push({
                uuid: node.uuid,
                name: node.name || `Object_${node.id}`,
                type: node.type,
                depth: depth,
                visible: node.visible,
            });
            if (node.children) node.children.forEach((c: any) => processNode(c, depth + 1));
        };

        processNode(root, 0);
        setHierarchy(hier);
        setModelStats((prev: any) => ({ ...(prev || {}), polyCount: Math.floor(polys) }));

        root.traverse((c: any) => {
            if (c.isMesh && c.material) {
                const ms = Array.isArray(c.material) ? c.material : [c.material];
                ms.forEach((m: any) => {
                    if (!mats[m.uuid]) {
                        mats[m.uuid] = m;
                        m.userData.previews = {};
                    }
                });
            }
        });
        setMaterials(Object.values(mats));
    }

    function setSelection(uuid: string | null) {
        setSelectedUuid(uuid);
        const engine = engineRef.current;
        if (!engine) return;
        if (!uuid) {
            engine.selectionBox.visible = false;
            return;
        }
        const obj = engine.modelGroup.getObjectByProperty('uuid', uuid);
        if (obj) {
            engine.selectionBox.setFromObject(obj);
            engine.selectionBox.visible = true;
        } else {
            engine.selectionBox.visible = false;
        }
    }

    function toggleVisible(uuid: string) {
        const engine = engineRef.current;
        if (!engine) return;
        const obj = engine.modelGroup.getObjectByProperty('uuid', uuid);
        if (obj) {
            obj.visible = !obj.visible;
            setHierarchy((prev) => prev.map((n) => (n.uuid === uuid ? { ...n, visible: obj.visible } : n)));
        }
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    }

    async function handleUniversalExport() {
        const engine = engineRef.current;
        if (!engine || engine.modelGroup.children.length === 0) return;

        const object = engine.modelGroup.children[0];
        const baseName = modelStats?.name?.replace(/\.[^.]+$/, '') ?? 'Asset';

        await runExport(object, targetPreset, targetFormat, baseName);
    }

    function updateMaterialValue(uuid: string, prop: string, val: number) {
        const mat = materials.find((m) => m.uuid === uuid);
        if (mat) {
            mat[prop] = val;
            mat.needsUpdate = true;
            setMaterials([...materials]);
        }
    }

    // --- INITIALIZATION ---
    useEffect(() => {
        if (!mountRef.current || useNativeRenderer) return;

        // 1. Ignite Engine
        const engine = new HighFidelityRenderer(mountRef.current);
        engineRef.current = engine;

        // 2. Initial Settings Apply
        engine.updateSettings(settings);

        // 3. Handle Resize
        const handleResize = () => engine.resize();
        window.addEventListener('resize', handleResize);

        // Force resize shortly after mount to catch layout shifts
        setTimeout(() => engine.resize(), 100);

        // 4. Load Kernel Artifact if present
        if (sharedState?.artifact) {
            // Small delay to ensure engine is ready
            setTimeout(() => {
                processFile(new File([sharedState.artifact], "Kernel_Artifact.glb"));
            }, 200);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            engine.dispose();
        };
    }, [useNativeRenderer]);

    const hasModel = Boolean(modelStats);

    const leftTabs: DockTab[] = [
        {
            id: 'inspector',
            label: 'INSPECT',
            icon: Scan,
            content: <InspectorPanel modelStats={modelStats} settings={settings} setSettings={setSettings} />,
        },
        {
            id: 'materials',
            label: 'MATERIALS',
            icon: Sliders,
            content: <MaterialsPanel materials={materials} updateMaterialValue={updateMaterialValue} />,
        },
        {
            id: 'export',
            label: 'EXPORT',
            icon: FileOutput,
            content: (
                <ExportPanel
                    targetPreset={targetPreset}
                    setTargetPreset={setTargetPreset}
                    targetFormat={targetFormat}
                    setTargetFormat={setTargetFormat}
                    isExporting={isExporting}
                    exportStatus={exportStatus}
                    exportError={exportError}
                    lastExportPath={lastExportPath}
                    onExport={handleUniversalExport}
                    onClearError={clearExportError}
                    hasModel={hasModel}
                />
            ),
        },
    ];

    const rightTabs: DockTab[] = [
        {
            id: 'scene',
            label: 'SCENE',
            icon: Workflow,
            content: (
                <HierarchyPanel
                    hierarchy={hierarchy}
                    selectedUuid={selectedUuid}
                    onSelect={setSelection}
                    onToggleVisible={toggleVisible}
                />
            ),
        },
    ];

    const menuBar = (
        <AppMenuBar
            menus={[
                {
                    label: 'File',
                    items: [
                        {
                            label: useNativeRenderer ? 'Use Legacy Viewport' : 'Use Native Viewport',
                            onSelect: () => setUseNativeRenderer((prev) => !prev),
                        },
                        {
                            label: 'Export',
                            shortcut: 'Ctrl+S',
                            onSelect: handleUniversalExport,
                            disabled: !hasModel || isExporting,
                        },
                    ],
                },
            ]}
        />
    );

    // --- SYNC SETTINGS ---
    useEffect(() => {
        if (engineRef.current) engineRef.current.updateSettings(settings);
    }, [settings]);

    const nativeSyncSource = useMemo<NativeViewportSyncSource>(() => {
        if (sharedState?.artifact) {
            return { kind: 'artifact-blob', blob: sharedState.artifact };
        }
        return { kind: 'none' };
    }, [sharedState?.artifact]);

    const sharedViewportRequest = useMemo(() => {
        if (!useNativeRenderer) return null;
        return {
            ownerId: 'kinspect',
            meshHandle: null,
            syncSource: nativeSyncSource,
            captureInput: true,
            hostInputMode: 'camera' as const,
            showDiagnostics: false,
            onStatusChange: setStatus,
        };
    }, [nativeSyncSource, useNativeRenderer]);

    useRegisterSharedViewport(sharedViewportRequest);

    return (
        <AppShell
            menuBar={menuBar}
            menuBarDefaultOpen={false}
            topBar={
                <TopBar
                    status={error ? `ERROR: ${error}` : status}
                    hasModel={hasModel}
                    isExporting={isExporting}
                    onImportFile={(file) => processFile(file)}
                    onExport={handleUniversalExport}
                    settings={settings}
                    setSettings={setSettings}
                />
            }
            left={{ title: 'K-INSPECT', defaultSize: 22, minSize: 14, collapsedSize: 4, tabs: leftTabs }}
            right={{ title: 'SCENE', defaultSize: 22, minSize: 14, collapsedSize: 4, tabs: rightTabs }}
            centerTransparent={useNativeRenderer}
        >
            <div
                className={`relative h-full w-full ${useNativeRenderer ? 'bg-transparent pointer-events-none' : 'bg-[#050505]'}`}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={() => setDragging(true)}
                onDragLeave={() => setDragging(false)}
            >
                {!useNativeRenderer && <canvas ref={mountRef} className="w-full h-full block outline-none" />}

                {loading ? (
                    <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-8 h-8 border-2 border-[#00ffcc] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <div className="text-[#00ffcc] text-[10px] font-bold tracking-widest animate-pulse">PROCESSING DATA STREAM...</div>
                        </div>
                    </div>
                ) : null}

                {dragging ? (
                    <div className="absolute inset-0 bg-[#00ffcc]/10 border-4 border-[#00ffcc] border-dashed z-50 flex items-center justify-center backdrop-blur-sm pointer-events-none">
                        <div className="text-[#00ffcc] font-bold text-xl tracking-widest flex flex-col items-center gap-2">
                            <UploadCloud size={48} className="animate-bounce" />
                            DROP ASSET TO LOAD
                        </div>
                    </div>
                ) : null}
            </div>
        </AppShell>
    );
}

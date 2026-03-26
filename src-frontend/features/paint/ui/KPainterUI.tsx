import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Activity, Paintbrush, Layers, LayoutGrid, Image as ImageIcon } from 'lucide-react';
import { usePainter } from '../PainterContext';
import KPainterUVView from '../KPainterUVView';
import TopBar from './TopBar';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';
import { KPainterQuickMenu } from './QuickMenu';
import { AppShell } from '@/ui/shell/AppShell';
import { AppMenuBar } from '@/ui/shell/AppMenuBar';
import { useGlobalHotkeys } from '@/lib/hooks/useGlobalHotkeys';

export default function KPainterUI({ canvasRef, engineRef, disableCanvasPointerEvents = false }: any) {
    const {
        brush, setBrush,
        layers, activeLayerId,
        handleLayerAdd, handleLayerDelete, handleLayerToggle, handleLayerSelect, handleLayerFill,
        activeMaterial, projectMaterials,
        setActiveMaterial, handleChangeMesh, handleExport,
        status,
        textureSets, activeSetId, handleSetSelect,
        alphas, handleGenerateAlpha, handleImportAlpha, isGeneratingAlpha, alphaPrompt, setAlphaPrompt,
        blackHole, setBlackHole,
        activeMods, setActiveMods,
        modParams, setModParams,
        viewMode, viewChannel,
        paint, recordHistory
    } = usePainter();

    const [quickMenuVisible, setQuickMenuVisible] = useState(false);
    const [quickMenuPinned, setQuickMenuPinned] = useState(false);

    const mousePosRef = useRef({ x: 0, y: 0 });
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const onExportHotkey = useCallback(
        (e: KeyboardEvent) => {
            e.preventDefault();
            handleExport();
        },
        [handleExport]
    );

    const onQuickMenuHotkey = useCallback((e: KeyboardEvent) => {
        e.preventDefault();
        setQuickMenuVisible((v) => !v);
    }, []);

    const hotkeyBindings = useMemo(
        () => ({
            'ctrl+s,command+s': onExportHotkey,
            q: onQuickMenuHotkey,
        }),
        [onExportHotkey, onQuickMenuHotkey]
    );
    useGlobalHotkeys(hotkeyBindings, true);

    // Memoized UV View props - MUST be at top level, not inside conditional JSX
    const uvViewMeshes = useMemo(() => {
        const engine = engineRef?.current;
        if (!engine?.textureSetData || !activeSetId) return [];
        const set = engine.textureSetData[activeSetId];
        return set?.meshes || [];
    }, [activeSetId, engineRef]);

    const activeCompositeLayer = useMemo(() => {
        const engine = engineRef?.current;
        if (!engine?.textureSetData || !activeSetId) return null;
        const set = engine.textureSetData[activeSetId];
        return set?.compositeLayer || null;
    }, [activeSetId, engineRef]);

    // Force UV view update trigger
    const [uvVersion, setUvVersion] = useState(0);

    // Update UV view when texture set changes
    React.useEffect(() => {
        setUvVersion(v => v + 1);
    }, [activeSetId, viewChannel]);

    // UV View Paint Handlers
    const lastUvRef = useRef<THREE.Vector2 | null>(null);

    const handlePaintDown = useCallback((uv: THREE.Vector2, e: React.PointerEvent) => {
        if (e.button !== 0 || e.altKey || e.ctrlKey) return;
        recordHistory();
        lastUvRef.current = uv.clone();
        paint(uv, e.pressure || 1.0, e);
    }, [recordHistory, paint]);

    const handlePaintMove = useCallback((uv: THREE.Vector2, e: React.PointerEvent) => {
        // Only paint if dragging (primary button)
        if (e.buttons !== 1) return;

        const pressure = e.pressure || 1.0;

        // Interpolation
        if (lastUvRef.current) {
            const dist = lastUvRef.current.distanceTo(uv);
            // KPainter generic size is roughly pixels based on 2048 map? 
            // Let's approximate spacing to 10% of brush size in UV space
            const uvBrushSize = (brush.size || 50) / 2048;
            const spacing = Math.max(0.0001, uvBrushSize * 0.1);

            const steps = Math.floor(dist / spacing);

            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const lerpedUV = lastUvRef.current.clone().lerp(uv, t);
                paint(lerpedUV, pressure, e);
            }
        }

        lastUvRef.current = uv.clone();
        paint(uv, pressure, e);
    }, [paint, brush.size]);

    const handlePaintUp = useCallback((e: React.PointerEvent) => {
        lastUvRef.current = null;
    }, []);

    const leftTabs = useMemo(
        () => [
            {
                id: 'brush',
                label: 'Brush',
                icon: Paintbrush,
                content: (
                    <LeftPanel
                        brush={brush}
                        setBrush={setBrush}
                        projectMaterials={projectMaterials}
                        activeMaterial={activeMaterial}
                        setActiveMaterial={setActiveMaterial}
                        handleChangeMesh={handleChangeMesh}
                        handleExport={handleExport}
                        alphas={alphas}
                        handleGenerateAlpha={handleGenerateAlpha}
                        handleImportAlpha={handleImportAlpha}
                        isGeneratingAlpha={isGeneratingAlpha}
                        alphaPrompt={alphaPrompt}
                        setAlphaPrompt={setAlphaPrompt}
                    />
                ),
            },
        ],
        [
            activeMaterial,
            alphas,
            alphaPrompt,
            brush.alphaMap,
            handleChangeMesh,
            handleExport,
            handleGenerateAlpha,
            handleImportAlpha,
            isGeneratingAlpha,
            projectMaterials,
            setActiveMaterial,
            setAlphaPrompt,
            setBrush,
        ]
    );

    const rightTabs = useMemo(
        () => [
            {
                id: 'layers',
                label: 'Layers',
                icon: Layers,
                content: (
                    <RightPanel
                        mode="layers"
                        layers={layers}
                        activeLayerId={activeLayerId}
                        onAdd={handleLayerAdd}
                        onDelete={handleLayerDelete}
                        onToggle={handleLayerToggle}
                        onSelect={handleLayerSelect}
                        onFill={handleLayerFill}
                        textureSets={textureSets}
                        activeSetId={activeSetId}
                        handleSetSelect={handleSetSelect}
                        engineRef={engineRef}
                    />
                ),
            },
            {
                id: 'sets',
                label: 'Texture Sets',
                icon: LayoutGrid,
                content: (
                    <RightPanel
                        mode="sets"
                        layers={layers}
                        activeLayerId={activeLayerId}
                        onAdd={handleLayerAdd}
                        onDelete={handleLayerDelete}
                        onToggle={handleLayerToggle}
                        onSelect={handleLayerSelect}
                        onFill={handleLayerFill}
                        textureSets={textureSets}
                        activeSetId={activeSetId}
                        handleSetSelect={handleSetSelect}
                        engineRef={engineRef}
                    />
                ),
            },
            {
                id: 'textures',
                label: 'Textures',
                icon: ImageIcon,
                content: (
                    <RightPanel
                        mode="textures"
                        layers={layers}
                        activeLayerId={activeLayerId}
                        onAdd={handleLayerAdd}
                        onDelete={handleLayerDelete}
                        onToggle={handleLayerToggle}
                        onSelect={handleLayerSelect}
                        onFill={handleLayerFill}
                        textureSets={textureSets}
                        activeSetId={activeSetId}
                        handleSetSelect={handleSetSelect}
                        engineRef={engineRef}
                    />
                ),
            },
        ],
        [
            activeLayerId,
            activeSetId,
            engineRef,
            handleLayerAdd,
            handleLayerDelete,
            handleLayerFill,
            handleLayerSelect,
            handleLayerToggle,
            handleSetSelect,
            layers,
            textureSets,
        ]
    );

    const menuBar = useMemo(
        () => (
            <AppMenuBar
                menus={[
                    {
                        label: 'File',
                        items: [
                            {
                                label: 'Export / Uplink',
                                shortcut: 'Ctrl+S',
                                onSelect: handleExport,
                            },
                        ],
                    },
                ]}
            />
        ),
        [handleExport]
    );

    return (
        <AppShell
            menuBar={menuBar}
            menuBarDefaultOpen={false}
            topBar={<TopBar />}
            left={{ title: 'K-PAINTER', defaultSize: 22, minSize: 14, collapsedSize: 4, tabs: leftTabs }}
            right={{ title: 'INSPECT', defaultSize: 22, minSize: 14, collapsedSize: 4, tabs: rightTabs }}
        >
            <div className="relative h-full w-full bg-[#090909] cursor-crosshair overflow-hidden select-none">
                <canvas ref={canvasRef} className={`block w-full h-full outline-none touch-none ${disableCanvasPointerEvents ? 'pointer-events-none opacity-0' : ''}`} />

                {viewMode === '2D' && (
                    <div className="absolute inset-0 z-10 pointer-events-none">
                        <div className="w-full h-full pointer-events-auto">
                            <KPainterUVView
                                meshes={uvViewMeshes}
                                compositeLayer={activeCompositeLayer}
                                viewChannel={viewChannel as any}
                                version={uvVersion}
                                cursorSize={brush.size / 2048}
                                cursorColor="#3daee9"
                                onPointerDown={handlePaintDown}
                                onPointerMove={handlePaintMove}
                                onPointerUp={handlePaintUp}
                                transparentBackground={true}
                            />
                        </div>
                    </div>
                )}

                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded text-[10px] text-gray-400 font-mono border border-gray-800 flex items-center gap-2 pointer-events-none z-30">
                    <Activity size={12} className={status.includes('READY') ? 'text-green-500' : 'text-orange-500 animate-pulse'} />
                    {status}
                </div>

                <div className="absolute top-20 left-4 pointer-events-none opacity-50">
                    <div className="text-[9px] font-bold text-gray-500 flex flex-col gap-1">
                        <span>Q: QUICK MENU</span>
                        <span>{viewMode === '3D' ? 'ALT: ORBIT' : 'MMB: PAN | SCROLL: ZOOM'}</span>
                    </div>
                </div>

                <KPainterQuickMenu
                    open={quickMenuVisible}
                    onOpenChange={setQuickMenuVisible}
                    brush={brush}
                    setBrush={setBrush}
                    pinned={quickMenuPinned}
                    setPinned={setQuickMenuPinned}
                    alphas={alphas}
                    activeMods={activeMods}
                    setActiveMods={setActiveMods}
                />
            </div>
        </AppShell>
    );
}

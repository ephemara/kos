
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { StudioStage, StudioStagePresets } from '@mocap/three-d/systems/three/StudioStage';
import { Box, Layers } from 'lucide-react';

import { AppShell } from '@mocap/shared/shell/AppShell';
import { AppMenuBar } from '@mocap/shared/shell/AppMenuBar';
import { TopBar } from './ui/TopBar';
import { LeftPanel } from './ui/LeftPanel';
import { RightPanel } from './ui/RightPanel';
import { Sequencer, SequencerTrack } from '@mocap/shared/shell/Sequencer';
import { MODIFIERS, createChainInstance, createModifierInstance, noise, hash } from './KClonerUtils';

export default function KCloner({ sharedState, onCommit }: any) {
    const [isPlaying, setIsPlaying] = useState(true);
    const [fps, setFps] = useState(30);
    const [baking, setBaking] = useState(false);
    const [status, setStatus] = useState("kipp engine 0.6 beta");

    // EXPORT SETTINGS
    const [exportFormat, setExportFormat] = useState('GLB');
    const [exportMode, setExportMode] = useState('ANIM');
    const [targetEngine, setTargetEngine] = useState('GENERIC');
    const [splitAnimations, setSplitAnimations] = useState(false);

    // FEATURES
    const [normalizeScale, setNormalizeScale] = useState(true);
    const [distributionMode, setDistributionMode] = useState('ROUND_ROBIN');

    // KEYFRAME SYSTEM
    // Record<string, {t: seconds, v: value}[]>
    const [keyframes, setKeyframes] = useState<Record<string, { t: number, v: number }[]>>({});
    const [activeKeyId, setActiveKeyId] = useState<string | null>(null);

    const timeRef = useRef(0);

    // CHAIN SYSTEM
    const [chains, setChains] = useState(() => {
        const initialChain = createChainInstance(0);
        initialChain.modifiers = [createModifierInstance('FLOAT')];
        return [initialChain];
    });
    const [activeChainId, setActiveChainId] = useState(() => chains[0]?.id);
    const [playbackChainId, setPlaybackChainId] = useState<string | null>(null);
    const [selectedModId, setSelectedModId] = useState<string | null>(() => chains[0]?.modifiers[0]?.instanceId);

    // CLONER SETTINGS
    const [clonerMode, setClonerMode] = useState('GRID');
    const [clonerCount, setClonerCount] = useState({ x: 5, y: 1, z: 5 });
    const [clonerSpacing, setClonerSpacing] = useState({ x: 2.0, y: 2.0, z: 2.0 });
    const [radialRadius, setRadialRadius] = useState(5.0);
    const [radialCount, setRadialCount] = useState(8);

    const mountRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const stageRef = useRef<StudioStage | null>(null);
    const clockRef = useRef(new THREE.Clock());

    const lastBlobRef = useRef<{ data: Blob | ArrayBuffer, name: string } | null>(null);
    const meshGroupRef = useRef<any>(null);
    const dummyRef = useRef(new THREE.Object3D());
    const originalsRef = useRef<any[]>([]);
    const geometriesRef = useRef<any[]>([]);
    const materialsRef = useRef<any[]>([]);
    const scriptCache = useRef<any>({});

    const totalDuration = chains.reduce((acc, chain) => acc + chain.duration, 0);

    // --- REFS FOR LOOP ACCESS ---
    const stateRef = useRef({
        isPlaying, totalDuration, chains, clonerMode, clonerCount,
        clonerSpacing, radialRadius, radialCount, exportFormat, exportMode, targetEngine,
        splitAnimations, keyframes, distributionMode
    });

    useEffect(() => {
        stateRef.current = {
            isPlaying, totalDuration, chains, clonerMode, clonerCount,
            clonerSpacing, radialRadius, radialCount, exportFormat, exportMode, targetEngine,
            splitAnimations, keyframes, distributionMode
        };
        if (meshGroupRef.current) rebuildLayout();
    }, [isPlaying, totalDuration, chains, clonerMode, clonerCount, clonerSpacing, radialRadius, radialCount, exportFormat, exportMode, targetEngine, splitAnimations, distributionMode, keyframes]);

    // --- HELPER: GET KEYFRAME VALUE ---
    const getVal = useCallback((id: string, def: number, timeOverride?: number) => {
        const t = timeOverride ?? timeRef.current;
        const track = keyframes[id];
        if (!track || track.length === 0) return def;

        const sorted = [...track].sort((a, b) => a.t - b.t);
        if (t <= sorted[0].t) return sorted[0].v;
        if (t >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1].v;

        const idx = sorted.findIndex(k => k.t > t);
        if (idx === -1) return sorted[sorted.length - 1].v;

        const k1 = sorted[idx - 1];
        const k2 = sorted[idx];
        const pct = (t - k1.t) / (k2.t - k1.t);
        return k1.v + (k2.v - k1.v) * pct;
    }, [keyframes]);

    // --- TOGGLE KEYFRAME ---
    const toggleKey = (id: string, val: number) => {
        const t = parseFloat(timeRef.current.toFixed(2));
        setKeyframes(prev => {
            const track = prev[id] || [];
            const existsIdx = track.findIndex(k => Math.abs(k.t - t) < 0.05);

            if (existsIdx >= 0) {
                const next = [...track];
                next.splice(existsIdx, 1);
                const res = { ...prev, [id]: next };
                if (next.length === 0) delete res[id];
                return res;
            } else {
                return { ...prev, [id]: [...track, { t, v: val }].sort((a, b) => a.t - b.t) };
            }
        });
    };

    // --- SEQUENCER TRACKS MAP ---
    const sequencerTracks: SequencerTrack[] = Object.keys(keyframes).map(id => ({
        id,
        label: id.replace('mod_', '').replace('grid_', '').replace('rad_', '').replace('_', ' ').toUpperCase(),
        keyframes: keyframes[id].map(k => ({ frame: Math.round(k.t * fps), value: k.v })),
        color: id.includes('count') ? '#22d3ee' : id.includes('space') ? '#fbbf24' : '#a855f7'
    }));

    // --- THREE.JS INIT ---
    const rebuildLayout = () => {
        const group = meshGroupRef.current;
        if (!group) return;
        const { clonerMode, clonerCount, clonerSpacing, radialRadius, radialCount, distributionMode } = stateRef.current;
        const origins: any[] = [];
        let totalCount = 0;

        if (clonerMode === 'SINGLE') { origins.push({ pos: new THREE.Vector3(0, 0.5, 0), rot: new THREE.Euler(), scale: new THREE.Vector3(1, 1, 1) }); totalCount = 1; }
        else if (clonerMode === 'GRID') {
            const offX = (clonerCount.x - 1) * clonerSpacing.x * 0.5;
            const offY = (clonerCount.y - 1) * clonerSpacing.y - (clonerCount.y - 1) * clonerSpacing.y * 0.5 + 0.5;
            const offZ = (clonerCount.z - 1) * clonerSpacing.z * 0.5;
            for (let x = 0; x < clonerCount.x; x++) for (let y = 0; y < clonerCount.y; y++) for (let z = 0; z < clonerCount.z; z++) {
                origins.push({
                    pos: new THREE.Vector3(x * clonerSpacing.x - offX, y * clonerSpacing.y - offY, z * clonerSpacing.z - offZ),
                    rot: new THREE.Euler(), scale: new THREE.Vector3(1, 1, 1)
                });
                totalCount++;
            }
        }
        else if (clonerMode === 'RADIAL') {
            const step = (Math.PI * 2) / radialCount;
            for (let i = 0; i < radialCount; i++) {
                const angle = step * i;
                origins.push({
                    pos: new THREE.Vector3(Math.cos(angle) * radialRadius, 0.5, Math.sin(angle) * radialRadius),
                    rot: new THREE.Euler(0, -angle, 0), scale: new THREE.Vector3(1, 1, 1)
                });
                totalCount++;
            }
        }
        else if (clonerMode === 'LINEAR') {
            const offY = (clonerCount.y - 1) * clonerSpacing.y * 0.5;
            for (let i = 0; i < clonerCount.y; i++) {
                origins.push({ pos: new THREE.Vector3(0, i * clonerSpacing.y - offY + 2, 0), rot: new THREE.Euler(), scale: new THREE.Vector3(1, 1, 1) });
                totalCount++;
            }
        }
        originalsRef.current = origins;

        // MESH MANAGEMENT (Same as before)
        const geometries = geometriesRef.current;
        const materials = materialsRef.current;
        const numVariants = geometries.length;
        if (numVariants === 0) return;

        while (group.children.length > numVariants) group.children.pop().dispose();
        while (group.children.length < numVariants) {
            const mesh = new THREE.InstancedMesh(geometries[group.children.length], materials[group.children.length], 10000);
            mesh.castShadow = true; mesh.receiveShadow = true;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.userData.globalIndices = [];
            group.add(mesh);
        }

        const countsPerVariant = new Array(numVariants).fill(0);
        const assignments = new Int32Array(totalCount);
        for (let i = 0; i < totalCount; i++) assignments[i] = distributionMode === 'RANDOM' ? Math.floor(Math.random() * numVariants) : i % numVariants;
        for (let i = 0; i < totalCount; i++) countsPerVariant[assignments[i]]++;

        group.children.forEach((mesh: any, vIdx: number) => {
            const needed = countsPerVariant[vIdx];
            if (needed > mesh.instanceMatrix.count) {
                const newMesh = new THREE.InstancedMesh(geometries[vIdx], materials[vIdx], Math.max(mesh.instanceMatrix.count * 2, needed + 1000));
                newMesh.castShadow = true; newMesh.receiveShadow = true; newMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                group.children[vIdx] = newMesh;
                mesh.dispose();
                mesh = newMesh;
            }
            mesh.count = needed;
            mesh.userData.globalIndices = new Int32Array(needed);
            mesh.userData.localCounter = 0;
            mesh.geometry = geometries[vIdx];
            mesh.material = materials[vIdx];
        });

        const dum = dummyRef.current;
        for (let i = 0; i < totalCount; i++) {
            const variantIdx = assignments[i];
            const mesh = group.children[variantIdx];
            const localIdx = mesh.userData.localCounter++;
            mesh.userData.globalIndices[localIdx] = i;
            const o = origins[i];
            dum.position.copy(o.pos); dum.rotation.copy(o.rot); dum.scale.copy(o.scale); dum.updateMatrix();
            mesh.setMatrixAt(localIdx, dum.matrix);
        }
        group.children.forEach((m: any) => { m.instanceMatrix.needsUpdate = true; delete m.userData.localCounter; });
    };

    const applyModifierLogic = (obj: any, mod: any, t: number, index: number, getK: any) => {
        const baseP = mod.params;
        const getP = (k: string) => getK(`mod_${mod.instanceId}_${k}`, baseP[k]);

        // Proxy for script access
        const p: any = new Proxy(baseP, {
            get: (target, prop: string) => {
                if (['step', 'axis', 'error', 'sliders', 'code'].includes(prop)) return target[prop];
                return getP(prop);
            }
        });

        const step = baseP.step ?? 0.1;
        const time = t + index * step;

        // (Include Modifier Logic from previous file - Condensed for brevity but keep all logic)
        switch (mod.type) {
            case 'orbit': const rr = (time * p.speed) * Math.PI * 0.2; if (p.axis === 'y') obj.rotation.y += rr; else if (p.axis === 'x') obj.rotation.x += rr; else obj.rotation.z += rr; break;
            case 'float': obj.position.y += Math.sin((time * p.speed) + p.phase) * p.height; break;
            case 'pulse': obj.scale.multiplyScalar(1 + Math.sin(time * p.speed) * p.scale); break;
            case 'shake': obj.position.add(new THREE.Vector3((noise(t * p.frequency + index) - 0.5) * p.intensity, (noise(t * p.frequency + 100 + index) - 0.5) * p.intensity, (noise(t * p.frequency + 200 + index) - 0.5) * p.intensity)); break;
            // ... (Add all other cases from original)
            case 'code':
                const cacheKey = mod.instanceId; let script = scriptCache.current[cacheKey]; const v = {}; if (p.sliders) p.sliders.forEach((s: any) => { v[s.id] = s.val; });
                if (!script || script.raw !== p.code) {
                    try { const func = new Function('p', 'r', 's', 't', 'i', 'M', 'v', p.code); scriptCache.current[cacheKey] = { raw: p.code, func: func, valid: true }; if (p.error) p.error = null; }
                    catch (e: any) { scriptCache.current[cacheKey] = { raw: p.code, valid: false, error: e.message }; p.error = e.message; return; }
                    script = scriptCache.current[cacheKey];
                }
                if (script && script.valid) { try { script.func(obj.position, obj.rotation, obj.scale, t, index, Math, v); } catch (re: any) { script.valid = false; p.error = re.message; } }
                break;
            // Add generic fallbacks or copy full list
            case 'scale': obj.scale.multiplyScalar(p.s); break;
        }
    };

    // --- ANIMATION LOOP ---
    useEffect(() => {
        if (!mountRef.current) return;

        // Use StudioStage for canonical runtime
        const stage = new StudioStage(mountRef.current, {
            ...StudioStagePresets.default,
            background: 0x050505,
            cameraPosition: [15, 15, 20],
            grid: false, // We add custom large grid
        });
        stageRef.current = stage;

        // Add fog
        stage.scene.fog = new THREE.Fog(0x050505, 500, 3000);

        // Custom accent lights for KCloner style
        const cyanSpot = new THREE.SpotLight(0x00ffff, 50);
        cyanSpot.position.set(20, 40, 20);
        cyanSpot.castShadow = true;
        stage.scene.add(cyanSpot);

        const magentaSpot = new THREE.SpotLight(0xff00ff, 20);
        stage.scene.add(magentaSpot);

        // Large grid for cloner visualization
        stage.scene.add(new THREE.GridHelper(2000, 200, 0x1a1a1a, 0x0a0a0a));

        // Mesh group for instanced meshes
        const group = new THREE.Group();
        stage.scene.add(group);
        meshGroupRef.current = group;

        // Default geometry
        geometriesRef.current = [new THREE.BoxGeometry(1, 1, 1)];
        materialsRef.current = [new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.8 })];

        rebuildLayout();

        // Animation loop callback
        const unsubscribe = stage.onLoop(() => {
            const state = stateRef.current;
            const delta = clockRef.current.getDelta();

            if (state.isPlaying && state.totalDuration > 0) {
                timeRef.current = (timeRef.current + delta) % state.totalDuration;
            }

            const globalTime = timeRef.current;

            // Helper inside loop for performance
            const getK = (id: string, def: number) => {
                const track = state.keyframes[id];
                if (!track?.length) return def;
                if (globalTime <= track[0].t) return track[0].v;
                if (globalTime >= track[track.length - 1].t) return track[track.length - 1].v;
                for (let i = 0; i < track.length - 1; i++) {
                    if (globalTime >= track[i].t && globalTime < track[i + 1].t) {
                        const t = (globalTime - track[i].t) / (track[i + 1].t - track[i].t);
                        return track[i].v + (track[i + 1].v - track[i].v) * t;
                    }
                }
                return def;
            };

            // Layout Update
            if (meshGroupRef.current) {
                let activeChain = state.chains[0];
                let localTime = 0, acc = 0;
                for (const c of state.chains) {
                    if (globalTime < acc + c.duration) { activeChain = c; localTime = globalTime - acc; break; }
                    acc += c.duration;
                }

                const group = meshGroupRef.current;
                const dum = dummyRef.current;
                const origins = originalsRef.current;
                let effectiveTime = localTime;

                group.children.forEach((mesh: any) => {
                    if (!mesh.isInstancedMesh) return;
                    for (let i = 0; i < mesh.count; i++) {
                        const globIdx = mesh.userData.globalIndices[i];
                        const orig = origins[globIdx];
                        if (!orig) continue;
                        dum.position.copy(orig.pos); dum.rotation.copy(orig.rot); dum.scale.copy(orig.scale);

                        activeChain.modifiers.forEach((mod: any) => {
                            applyModifierLogic(dum, mod, effectiveTime, i, getK);
                        });

                        dum.updateMatrix();
                        mesh.setMatrixAt(i, dum.matrix);
                    }
                    mesh.instanceMatrix.needsUpdate = true;
                });
            }

            if (state.isPlaying) {
                setUiTime(globalTime);
            }
        });

        // Attach resize observer
        stage.attachResizeObserver(mountRef.current);

        return () => {
            unsubscribe();
            stage.dispose();
            stageRef.current = null;
        };
    }, []);

    const handleImport = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleBake = async () => {
        if (baking) return;
        setBaking(true);
        // Simulate bake for now until GLTFExporter is integrated
        await new Promise(r => setTimeout(r, 2000));
        setBaking(false);
    };
    const handleAddModifier = (key: string) => {
        const newMod = createModifierInstance(key);
        setChains(prev => prev.map(c => c.id === activeChainId ? { ...c, modifiers: [...c.modifiers, newMod] } : c));
        if (activeChainId) setSelectedModId(newMod.instanceId);
    };

    const handleAction = (type: string, payload: any) => {
        // Centralized handler for RightPanel actions
        if (type === 'ADD_CHAIN') { setChains(p => [...p, createChainInstance(p.length)]); }
        else if (type === 'REMOVE_CHAIN') { setChains(p => p.filter(c => c.id !== payload)); if (activeChainId === payload) setActiveChainId(chains[0].id); }
        else if (type === 'UPDATE_CHAIN') { setChains(p => p.map(c => c.id === payload.id ? { ...c, [payload.field]: payload.val } : c)); }
        else if (type === 'REMOVE_MOD') { setChains(p => p.map(c => c.id === activeChainId ? { ...c, modifiers: c.modifiers.filter(m => m.instanceId !== payload) } : c)); }
        else if (type === 'UPDATE_PARAM') {
            setChains(p => p.map(c => c.id === activeChainId ? {
                ...c, modifiers: c.modifiers.map(m => m.instanceId === payload.modId ? { ...m, params: { ...m.params, [payload.param]: payload.val } } : m)
            } : c));
        }
    };

    const [uiTime, setUiTime] = useState(0);

    return (
        <AppShell
            menuBar={<AppMenuBar />}
            topBar={
                <TopBar
                    exportFormat={exportFormat} setExportFormat={setExportFormat}
                    exportMode={exportMode} setExportMode={setExportMode}
                    targetEngine={targetEngine} setTargetEngine={setTargetEngine}
                    splitAnimations={splitAnimations} setSplitAnimations={setSplitAnimations}
                    baking={baking}
                    onImport={handleImport}
                    onBrowse={() => { }} // Browse disabled
                    onUplink={() => console.log("Uplink")}
                    onBake={handleBake}
                    cloneCount={
                        clonerMode === 'GRID' ? clonerCount.x * clonerCount.y * clonerCount.z :
                            clonerMode === 'RADIAL' ? radialCount :
                                clonerMode === 'LINEAR' ? clonerCount.y : 1
                    }
                />
            }
            left={{
                title: "CLONER",
                tabs: [{
                    id: 'gen', label: 'Generator', icon: Box,
                    content: <LeftPanel
                        clonerMode={clonerMode} setClonerMode={setClonerMode}
                        distributionMode={distributionMode} setDistributionMode={setDistributionMode}
                        clonerCount={clonerCount} setClonerCount={setClonerCount}
                        clonerSpacing={clonerSpacing} setClonerSpacing={setClonerSpacing}
                        radialCount={radialCount} setRadialCount={setRadialCount}
                        radialRadius={radialRadius} setRadialRadius={setRadialRadius}
                        normalizeScale={normalizeScale} setNormalizeScale={setNormalizeScale}
                        onAddModifier={handleAddModifier}
                        keyframes={keyframes} toggleKey={toggleKey} currentTime={timeRef.current}
                    />
                }]
            }}
            right={{
                title: "STACK",
                tabs: [{
                    id: 'stack', label: 'Properties', icon: Layers,
                    content: <RightPanel
                        chains={chains} activeChainId={activeChainId} setActiveChainId={setActiveChainId}
                        playbackChainId={playbackChainId}
                        addChain={() => handleAction('ADD_CHAIN', null)}
                        removeChain={(id) => handleAction('REMOVE_CHAIN', id)}
                        updateChain={(id, field, val) => handleAction('UPDATE_CHAIN', { id, field, val })}
                        modifiers={chains.find(c => c.id === activeChainId)?.modifiers || []}
                        selectedModId={selectedModId} setSelectedModId={setSelectedModId}
                        removeModifier={(id) => handleAction('REMOVE_MOD', id)}
                        clearModifiers={() => { }}
                        updateParam={(modId, param, val) => handleAction('UPDATE_PARAM', { modId, param, val })}
                        keyframes={keyframes} toggleKey={toggleKey} currentTime={timeRef.current}
                    />
                }]
            }}
            bottom={
                <Sequencer
                    currentFrame={Math.floor((isPlaying ? uiTime : timeRef.current) * fps)}
                    totalFrames={Math.floor(totalDuration * fps)}
                    fps={fps}
                    isPlaying={isPlaying}
                    onPlayPause={setIsPlaying}
                    onSeek={(f) => {
                        timeRef.current = f / fps;
                        setUiTime(timeRef.current); // Force update UI on seek
                    }}
                    tracks={sequencerTracks}
                    activeTrackId={null}
                    onSelectTrack={() => { }}
                    onAddKeyframe={() => { }}
                    onDeleteKeyframe={(trackId, frame) => toggleKey(trackId, 0) /* simplistic delete */}
                />
            }
        >
            <div ref={mountRef} className="w-full h-full relative group">
                {/* Overlay for status if needed, or keeping it clean */}
                <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" />
            </div>
        </AppShell>
    );
}

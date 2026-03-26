
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { StudioStage, StudioStagePresets } from '@/systems/three/StudioStage';
import { Box, Layers } from 'lucide-react';

import { AppShell } from '@/ui/shell/AppShell';
import { AppMenuBar } from '@/ui/shell/AppMenuBar';
import { TopBar } from './ui/TopBar';
import { LeftPanel } from './ui/LeftPanel';
import { RightPanel } from './ui/RightPanel';
import { Sequencer, SequencerTrack } from '@/ui/shell/Sequencer';
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

        // Properly dispose excess meshes - geometry and material are shared, so don't dispose them here
        while (group.children.length > numVariants) {
            const mesh = group.children.pop();
            if (mesh) mesh.dispose();
        }
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

        // Proxy: non-meta params go through keyframe interpolation
        const p: any = new Proxy(baseP, {
            get: (target, prop: string) => {
                if (['step', 'axis', 'error', 'sliders', 'code'].includes(prop)) return target[prop];
                return getP(prop as string);
            }
        });

        const step = baseP.step ?? 0.1;
        const time = t + index * step;
        const DEG = Math.PI / 180;

        switch (mod.type) {
            // --- CLASSICS ---
            case 'orbit': {
                const rr = time * p.speed * Math.PI * 2;
                if (p.axis === 'y') obj.rotation.y += rr;
                else if (p.axis === 'x') obj.rotation.x += rr;
                else obj.rotation.z += rr;
                break;
            }
            case 'float':
                obj.position.y += Math.sin(time * p.speed + (p.phase ?? 0)) * p.height;
                break;
            case 'pulse':
                obj.scale.multiplyScalar(1 + Math.sin(time * p.speed) * p.scale);
                break;
            case 'shake':
                obj.position.x += (noise(t * p.frequency + index) - 0.5) * p.intensity;
                obj.position.y += (noise(t * p.frequency + 100 + index) - 0.5) * p.intensity;
                obj.position.z += (noise(t * p.frequency + 200 + index) - 0.5) * p.intensity;
                break;
            case 'elastic': {
                const stretch = Math.sin(time * p.speed + index * step) * p.amount;
                if (p.axis === 'y') { obj.scale.y += stretch; obj.scale.x -= stretch * 0.5; obj.scale.z -= stretch * 0.5; }
                else if (p.axis === 'x') { obj.scale.x += stretch; obj.scale.y -= stretch * 0.5; obj.scale.z -= stretch * 0.5; }
                else { obj.scale.z += stretch; obj.scale.x -= stretch * 0.5; obj.scale.y -= stretch * 0.5; }
                break;
            }
            // --- INTERMEDIATE ---
            case 'pendulum': {
                const swing = Math.sin(time * p.speed) * p.angle * DEG;
                if (p.axis === 'z') obj.rotation.z += swing;
                else if (p.axis === 'x') obj.rotation.x += swing;
                else obj.rotation.y += swing;
                break;
            }
            case 'wobble': {
                obj.rotation.x += Math.sin(time * p.speed * 1.1 + index) * p.intensity;
                obj.rotation.z += Math.cos(time * p.speed * 0.9 + index) * p.intensity;
                break;
            }
            case 'figure8': {
                const a = time * p.speed;
                obj.position.x += Math.sin(a) * p.width;
                obj.position.y += Math.sin(a * 2) * p.height;
                break;
            }
            case 'heartbeat': {
                const period = 60 / p.bpm;
                const phase = (t % period) / period;
                const beat = phase < 0.1 ? Math.sin(phase / 0.1 * Math.PI) :
                    phase < 0.2 ? Math.sin((phase - 0.1) / 0.1 * Math.PI) * 0.5 : 0;
                obj.scale.multiplyScalar(1 + beat * p.intensity);
                break;
            }
            case 'glitch': {
                const slot = Math.floor(t / p.interval);
                const rng = hash(slot * 1234 + index * 5678);
                if (rng > 0.7) {
                    obj.position.x += (hash(slot + 1) - 0.5) * p.scatter * 2;
                    obj.position.y += (hash(slot + 2) - 0.5) * p.scatter * 2;
                    obj.position.z += (hash(slot + 3) - 0.5) * p.scatter * 2;
                }
                break;
            }
            case 'step': {
                // Quantize time to stop-motion fps
                const stepT = Math.floor(t * p.fps) / p.fps;
                // Freeze upstream time contribution — handled by parent loop, so no position change needed here.
                // Just quantize position to nearest slot (store in obj.userData)
                if (!obj.userData._stepLast || Math.abs(obj.userData._stepLast - stepT) > 0.001) {
                    obj.userData._stepLast = stepT;
                    obj.userData._stepPos = obj.position.clone();
                    obj.userData._stepRot = obj.rotation.clone();
                }
                if (obj.userData._stepPos) {
                    obj.position.copy(obj.userData._stepPos);
                    obj.rotation.copy(obj.userData._stepRot);
                }
                break;
            }
            // --- PHYSICS & FX ---
            case 'bounce': {
                const bt = (time * p.speed) % (Math.PI);
                const h = Math.abs(Math.sin(bt)) * p.height;
                obj.position.y += h;
                // Squash on ground
                const squash = 1 - Math.max(0, (1 - h / p.height) * p.squash);
                obj.scale.y *= squash;
                obj.scale.x /= Math.sqrt(squash);
                obj.scale.z /= Math.sqrt(squash);
                break;
            }
            case 'tumble':
                obj.rotation.x += time * p.speedX;
                obj.rotation.y += time * p.speedY;
                obj.rotation.z += time * p.speedZ;
                break;
            case 'strobe': {
                // Alternate full/zero scale on strobe beat
                const cycle = (t * p.speed) % 1.0;
                if (cycle > p.duty) { obj.scale.set(0.001, 0.001, 0.001); }
                break;
            }
            case 'corkscrew': {
                const angle = time * p.speed * Math.PI * 2 * p.rotations;
                obj.position.x += Math.cos(angle) * 0.3;
                obj.position.y += time * p.height * p.speed;
                obj.position.z += Math.sin(angle) * 0.3;
                obj.rotation.y += time * p.speed * p.rotations;
                break;
            }
            case 'shiver':
                obj.position.x += (Math.random() - 0.5) * p.intensity;
                obj.position.y += (Math.random() - 0.5) * p.intensity;
                obj.position.z += (Math.random() - 0.5) * p.intensity;
                break;
            case 'sway': {
                const swayAngle = Math.sin(time * p.speed + index * step) * p.angle * DEG;
                obj.rotation.z += swayAngle;
                break;
            }
            case 'yoyo': {
                const yo = Math.abs(Math.sin(time * p.speed));
                obj.position.y += yo * p.length;
                break;
            }
            case 'crab': {
                obj.position.x += Math.sin(time * p.speed + index * step) * p.width;
                break;
            }
            // --- COMPLEX ---
            case 'lissajous': {
                const lx = Math.sin(time * p.speed * p.a + Math.PI / 2) * p.size;
                const ly = Math.sin(time * p.speed * p.b) * p.size * 0.5;
                obj.position.x += lx;
                obj.position.y += ly;
                break;
            }
            case 'flip': {
                const flipT = (Math.floor(t / p.interval) + index) % 2;
                const progress = Math.min(1, ((t % p.interval) * p.speed));
                const angle = flipT * Math.PI + progress * Math.PI;
                if (p.axis === 'x') obj.rotation.x += angle;
                else if (p.axis === 'z') obj.rotation.z += angle;
                else obj.rotation.y += angle;
                break;
            }
            case 'tremor':
                obj.position.x += Math.sin(t * p.speed + index * 37.3) * p.intensity;
                obj.position.z += Math.cos(t * p.speed + index * 19.7) * p.intensity;
                break;
            case 'scan': {
                const scanT = Math.sin(time * p.speed);
                if (p.axis === 'x') obj.position.x += scanT * p.distance;
                else if (p.axis === 'z') obj.position.z += scanT * p.distance;
                else obj.position.y += scanT * p.distance;
                break;
            }
            case 'warp': {
                const wt = time * p.speed;
                const sx = 1 + Math.sin(wt + index) * p.stretch;
                const sy = 1 + Math.cos(wt * 1.3 + index) * p.stretch;
                obj.scale.x *= sx;
                obj.scale.y *= sy;
                break;
            }
            case 'drift': {
                const da = time * p.speed;
                obj.position.x += Math.cos(da + index * 1.23) * p.radius * 0.016;
                obj.position.z += Math.sin(da + index * 1.23) * p.radius * 0.016;
                break;
            }
            case 'bobble': {
                obj.position.y += Math.sin(time * p.speed + index * step) * p.amount;
                obj.rotation.z += Math.cos(time * p.speed * 1.1 + index) * 0.05;
                break;
            }
            case 'twist': {
                const twistAngle = Math.sin(time * p.speed + index * step) * p.angle * DEG;
                if (p.axis === 'y') obj.rotation.y += twistAngle;
                else if (p.axis === 'x') obj.rotation.x += twistAngle;
                else obj.rotation.z += twistAngle;
                break;
            }
            // --- ADVANCED ---
            case 'spiral': {
                const sa = time * p.speed + index * (Math.PI * 2 / Math.max(1, p.rotations));
                const sr = p.radius * (1 + index * p.grow * 0.01);
                obj.position.x += Math.cos(sa) * sr * 0.016;
                obj.position.z += Math.sin(sa) * sr * 0.016;
                obj.position.y += time * p.speed * 0.01;
                break;
            }
            case 'vortex': {
                const dist = Math.sqrt(obj.position.x ** 2 + obj.position.z ** 2) || 0.001;
                const pull = p.strength / (dist + p.falloff);
                const vAngle = time * p.speed;
                obj.position.x += (-Math.sin(vAngle) * pull + (0 - obj.position.x) * 0.001) * Math.min(dist / p.radius, 1);
                obj.position.z += (Math.cos(vAngle) * pull + (0 - obj.position.z) * 0.001) * Math.min(dist / p.radius, 1);
                break;
            }
            case 'magnet': {
                const mx = obj.position.x, mz = obj.position.z;
                const md = Math.sqrt(mx * mx + mz * mz) + 0.001;
                if (md < p.range) {
                    const force = p.strength * (1 - md / p.range) * p.speed * 0.01;
                    obj.position.x -= (mx / md) * force;
                    obj.position.z -= (mz / md) * force;
                }
                break;
            }
            case 'noise_flow': {
                const ns = p.scale;
                obj.position.x += (noise(obj.position.x * ns + t * p.speed) - 0.5) * p.force * 0.05;
                obj.position.y += (noise(obj.position.y * ns + t * p.speed + 100) - 0.5) * p.force * 0.02;
                obj.position.z += (noise(obj.position.z * ns + t * p.speed + 200) - 0.5) * p.force * 0.05;
                break;
            }
            case 'ripple': {
                const rDist = Math.sqrt(obj.position.x ** 2 + obj.position.z ** 2);
                const rWave = Math.sin(rDist * p.frequency - time * p.speed) * p.amplitude * Math.exp(-rDist * p.decay);
                obj.position.y += rWave;
                break;
            }
            case 'squash': {
                const sq = 1 + Math.sin(time * p.speed + index * step) * p.amount;
                if (p.axis === 'y') { obj.scale.y *= sq; obj.scale.x *= 1 / Math.sqrt(sq); obj.scale.z *= 1 / Math.sqrt(sq); }
                else if (p.axis === 'x') { obj.scale.x *= sq; obj.scale.y *= 1 / Math.sqrt(sq); obj.scale.z *= 1 / Math.sqrt(sq); }
                else { obj.scale.z *= sq; obj.scale.x *= 1 / Math.sqrt(sq); obj.scale.y *= 1 / Math.sqrt(sq); }
                break;
            }
            case 'accordion': {
                const acc = Math.sin(time * p.speed + index * step) * p.amount;
                if (p.axis === 'y') obj.scale.y += acc;
                else if (p.axis === 'x') obj.scale.x += acc;
                else obj.scale.z += acc;
                break;
            }
            case 'chaos': {
                const ct = t * p.speed + index;
                obj.position.x += (noise(ct) - 0.5) * p.scale * 0.05;
                obj.position.y += (noise(ct + 33) - 0.5) * p.scale * 0.05;
                obj.position.z += (noise(ct + 66) - 0.5) * p.scale * 0.05;
                obj.rotation.y += (noise(ct + 99) - 0.5) * 0.05;
                break;
            }
            case 'breathe': {
                const breath = 1 + Math.sin(time * p.speed * Math.PI * 2 + index * step) * p.amount;
                obj.scale.multiplyScalar(breath);
                break;
            }
            case 'explode': {
                if (t > p.trigger) {
                    const age = t - p.trigger;
                    const dir = new THREE.Vector3(
                        hash(index * 3 + 1) - 0.5,
                        hash(index * 3 + 2),
                        hash(index * 3 + 3) - 0.5
                    ).normalize();
                    const strength = p.strength * Math.exp(-age * p.decay);
                    obj.position.addScaledVector(dir, strength * 0.016);
                    obj.rotation.x += dir.x * 0.1;
                    obj.rotation.z += dir.z * 0.1;
                }
                break;
            }
            // --- K-SCRIPT ---
            case 'code': {
                const cacheKey = mod.instanceId;
                let script = scriptCache.current[cacheKey];
                const v: any = {};
                if (p.sliders) p.sliders.forEach((s: any) => { v[s.id] = s.val; });
                if (!script || script.raw !== p.code) {
                    try {
                        const func = new Function('p', 'r', 's', 't', 'i', 'M', 'v', p.code);
                        scriptCache.current[cacheKey] = { raw: p.code, func, valid: true };
                        if (p.error) p.error = null;
                    } catch (e: any) {
                        scriptCache.current[cacheKey] = { raw: p.code, valid: false, error: e.message };
                        p.error = e.message;
                        return;
                    }
                    script = scriptCache.current[cacheKey];
                }
                if (script?.valid) {
                    try { script.func(obj.position, obj.rotation, obj.scale, t, index, Math, v); }
                    catch (re: any) { script.valid = false; p.error = re.message; }
                }
                break;
            }
        }
    };

    // --- ANIMATION LOOP ---
    useEffect(() => {
        if (!mountRef.current) return;

        // ── STUDIO STAGE ────────────────────────────────────────────────────────
        // lighting:false — we set up our own 3-point rig below so StudioStage's
        // ambient (0.08) + directional (2.0) don't fight with our accent lights.
        const stage = new StudioStage(mountRef.current, {
            ...StudioStagePresets.default,
            background: 0x080810,
            cameraPosition: [15, 12, 20],
            grid: false,            // custom grid added below
            lighting: false,        // own rig below
            toneMappingExposure: 1.4,
            environmentIntensity: 0.6,
        });
        stageRef.current = stage;

        // ── ATMOSPHERIC FOG ──────────────────────────────────────────────────────
        stage.scene.fog = new THREE.FogExp2(0x080810, 0.008);

        // ── 3-POINT LIGHT RIG ────────────────────────────────────────────────────
        // 1. Ambient lift — keeps shadows from going pure black
        const ambient = new THREE.AmbientLight(0x223355, 0.6);
        stage.scene.add(ambient);

        // 2. Key light — warm white from front-right-top
        const keyLight = new THREE.DirectionalLight(0xfff4e0, 3.5);
        keyLight.position.set(10, 18, 14);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(2048, 2048);
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 200;
        keyLight.shadow.camera.left = -30;
        keyLight.shadow.camera.right = 30;
        keyLight.shadow.camera.top = 30;
        keyLight.shadow.camera.bottom = -30;
        stage.scene.add(keyLight);

        // 3. Cyan fill — left side rim, sci-fi feel
        const cyanFill = new THREE.DirectionalLight(0x00d4ff, 1.8);
        cyanFill.position.set(-16, 8, -10);
        stage.scene.add(cyanFill);

        // 4. Magenta back light — edge pop on objects
        const magentaBack = new THREE.DirectionalLight(0xff40cc, 2.2);
        magentaBack.position.set(-5, 6, -18);
        stage.scene.add(magentaBack);

        // 5. Ground bounce — warm low fill from below
        const groundBounce = new THREE.PointLight(0x442200, 1.5, 50);
        groundBounce.position.set(0, -3, 0);
        stage.scene.add(groundBounce);

        // ── GRID ─────────────────────────────────────────────────────────────────
        // Two-layer grid: fine inner + coarse outer for depth
        const gridFine = new THREE.GridHelper(60, 60, 0x1a1a2e, 0x0f0f1a);
        const gridCoarse = new THREE.GridHelper(400, 40, 0x151520, 0x0a0a12);
        gridFine.position.y = -0.01;
        gridCoarse.position.y = -0.02;
        stage.scene.add(gridFine, gridCoarse);

        // ── MESH GROUP ───────────────────────────────────────────────────────────
        const group = new THREE.Group();
        stage.scene.add(group);
        meshGroupRef.current = group;

        // Default geometry — light grey, semi-metallic so lights read well
        geometriesRef.current = [new THREE.BoxGeometry(1, 1, 1)];
        materialsRef.current = [new THREE.MeshStandardMaterial({
            color: 0x8899bb,
            roughness: 0.35,
            metalness: 0.6,
        })];

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

            // Cleanup: Dispose all geometries and materials
            geometriesRef.current.forEach(geom => {
                if (geom && typeof geom.dispose === 'function') {
                    geom.dispose();
                }
            });
            materialsRef.current.forEach(mat => {
                if (mat && typeof mat.dispose === 'function') {
                    mat.dispose();
                }
            });

            // Cleanup: Dispose all meshes in the group
            if (meshGroupRef.current) {
                meshGroupRef.current.children.forEach((mesh: any) => {
                    if (mesh && typeof mesh.dispose === 'function') {
                        mesh.dispose();
                    }
                });
            }

            stage.dispose();
            stageRef.current = null;
        };
    }, []);

    // --- CLEANUP ON MODE CHANGES ---
    // Track previous mode to detect changes and cleanup geometries
    const prevModeRef = useRef(clonerMode);

    useEffect(() => {
        // When mode changes, we don't need to dispose geometries since they're reused
        // The cleanup happens in rebuildLayout when meshes are removed
        prevModeRef.current = clonerMode;
    }, [clonerMode]);

    const handleImport = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleBake = async () => {
        if (baking) return;

        const group = meshGroupRef.current;
        if (!group || group.children.length === 0) {
            setStatus("Error: No clones to export");
            return;
        }

        setBaking(true);
        setStatus("Exporting clones...");

        try {
            // Create export scene with all instances baked to real meshes
            const exportScene = new THREE.Scene();
            const dummy = new THREE.Object3D();

            let totalExported = 0;

            // Iterate through all instanced meshes and bake them to real meshes
            for (const instancedMesh of group.children) {
                if (!(instancedMesh instanceof THREE.InstancedMesh)) continue;

                const geometry = instancedMesh.geometry;
                const material = instancedMesh.material;

                // Export each instance as a separate mesh
                for (let i = 0; i < instancedMesh.count; i++) {
                    instancedMesh.getMatrixAt(i, dummy.matrix);
                    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

                    // Create a real mesh for this instance
                    const mesh = new THREE.Mesh(geometry.clone(), material.clone());
                    mesh.position.copy(dummy.position);
                    mesh.quaternion.copy(dummy.quaternion);
                    mesh.scale.copy(dummy.scale);
                    mesh.name = `clone_${totalExported}`;

                    exportScene.add(mesh);
                    totalExported++;
                }
            }

            setStatus(`Baking ${totalExported} instances...`);

            // ── Shared Tauri-native save helper (replaces all link.click() calls) ──
            const saveBlob = async (blob: Blob, filename: string) => {
                lastBlobRef.current = { data: blob, name: filename };
                const { saveBlobToFile } = await import('@/lib/utils/tauriSave');
                const saved = await saveBlobToFile(blob, filename);
                if (saved) {
                    setStatus(`Exported ${totalExported} clones → ${filename}`);
                } else {
                    setStatus('Export cancelled');
                }
                setBaking(false);
            };

            // Export based on format
            if (exportFormat === 'GLB' || exportFormat === 'GLTF') {
                const exporter = new GLTFExporter();
                const options = {
                    binary: exportFormat === 'GLB',
                    embedImages: true,
                    maxTextureSize: 4096,
                };

                exporter.parse(
                    exportScene,
                    async (result) => {
                        const blob = exportFormat === 'GLB'
                            ? new Blob([result as ArrayBuffer], { type: 'application/octet-stream' })
                            : new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                        const filename = `kcloner_export_${Date.now()}.${exportFormat.toLowerCase()}`;
                        await saveBlob(blob, filename);
                    },
                    (error) => {
                        console.error('Export error:', error);
                        setStatus(`Export failed: ${error.message}`);
                        setBaking(false);
                    },
                    options
                );
            } else if (exportFormat === 'OBJ') {
                const exporter = new OBJExporter();
                const result = exporter.parse(exportScene);
                const blob = new Blob([result], { type: 'text/plain' });
                const filename = `kcloner_export_${Date.now()}.obj`;
                await saveBlob(blob, filename);
            } else if (exportFormat === 'USDZ') {
                const exporter = new USDZExporter();
                const result = await exporter.parse(exportScene);
                // Normalise the result to a plain ArrayBuffer (guards against SharedArrayBuffer)
                let buffer: ArrayBuffer;
                if (result instanceof ArrayBuffer) {
                    buffer = result;
                } else if (result instanceof Uint8Array) {
                    const srcBuffer = result.buffer;
                    buffer = srcBuffer instanceof ArrayBuffer
                        ? srcBuffer.slice(result.byteOffset, result.byteOffset + result.byteLength)
                        : (() => { const b = new ArrayBuffer(result.byteLength); new Uint8Array(b).set(result); return b; })();
                } else {
                    buffer = new ArrayBuffer(0);
                }
                const blob = new Blob([buffer], { type: 'application/octet-stream' });
                const filename = `kcloner_export_${Date.now()}.usdz`;
                await saveBlob(blob, filename);
            } else {
                // JSON instance-transform dump
                const instanceData = {
                    version: '1.0',
                    timestamp: Date.now(),
                    clonerMode,
                    totalInstances: totalExported,
                    instances: [] as any[],
                };

                for (const instancedMesh of group.children) {
                    if (!(instancedMesh instanceof THREE.InstancedMesh)) continue;
                    for (let i = 0; i < instancedMesh.count; i++) {
                        instancedMesh.getMatrixAt(i, dummy.matrix);
                        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                        instanceData.instances.push({
                            position: dummy.position.toArray(),
                            rotation: dummy.quaternion.toArray(),
                            scale: dummy.scale.toArray(),
                        });
                    }
                }

                const blob = new Blob([JSON.stringify(instanceData, null, 2)], { type: 'application/json' });
                const filename = `kcloner_instances_${Date.now()}.json`;
                await saveBlob(blob, filename);
            }

            // Cleanup export scene
            exportScene.traverse((obj) => {
                if (obj instanceof THREE.Mesh) {
                    obj.geometry.dispose();
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });

        } catch (error: any) {
            console.error('Export error:', error);
            setStatus(`Export failed: ${error.message}`);
            setBaking(false);
        }
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
            bottomTabs={[
                {
                    id: 'sequencer',
                    label: 'SEQUENCER',
                    content: (
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
                    )
                }
            ]}
            bottomTitle="SEQUENCER"
            bottomHeight={240}
        >
            <div ref={mountRef} className="w-full h-full relative group">
                {/* Overlay for status if needed, or keeping it clean */}
                <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" />
            </div>
        </AppShell>
    );
}

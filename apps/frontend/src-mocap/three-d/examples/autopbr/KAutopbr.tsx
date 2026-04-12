import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
    Monitor, Library, Sliders, Settings, Sun, Layers, Image as ImageIcon
} from 'lucide-react';
import { processImage, processAllPbrMapsGpu, generateAITexture } from './KAutopbrEngine';
import { python } from '@mocap/shared/services/pythonBridge'
import { spawnPrimitiveToThree } from '@mocap/lib/primitives';
import { createMaterial } from '@mocap/shared/services/kernelServices'
import { normalizeObject, MeshImportProfiles } from '@mocap/three-d/systems/three/meshPipeline';

// UI Components
import { AppShell } from '@mocap/shared/shell/AppShell';
import { AppMenuBar } from '@mocap/shared/shell/AppMenuBar';
import { DockPanel, DockTab } from '@mocap/shared/shell/DockPanel';
import TopBar from './ui/TopBar';
import LeftPanel from './ui/LeftPanel';
import RightPanel from './ui/RightPanel';
import { DEFAULT_PARAMS } from './KAutopbrpresets';

export default function KAutopbr({ sharedState, onMaterialCommit, onCommit, tempImage, setTempImage }: any) {
    const canvasRef = useRef<any>(null);
    const sceneRef = useRef<any>(null);
    const rendererRef = useRef<any>(null);
    const meshRef = useRef<any>(null);
    const cameraRef = useRef<any>(null);
    const frameId = useRef<any>(null);
    const isDragging = useRef(false);
    const previousMousePosition = useRef({ x: 0, y: 0 });
    const lightsRef = useRef<any>({});

    // State
    const [sourceImage, setSourceImage] = useState(null);
    const [sourceImgObj, setSourceImgObj] = useState<HTMLImageElement | null>(null);
    const [decalImage, setDecalImage] = useState(null);
    const [decalImgObj, setDecalImgObj] = useState<HTMLImageElement | null>(null);
    const [loading, setLoading] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isBaking, setIsBaking] = useState(false);
    const [aiBakeMode, setAiBakeMode] = useState(false);
    const [aiBakeOptions, setAiBakeOptions] = useState({ upscale: false, tile: false, delight: true });
    const [materialMode, setMaterialMode] = useState<'matte' | 'glossy'>('matte');
    const [viewShape, setViewShape] = useState(sharedState?.artifact ? 'artifact' : 'sphere');
    const [sceneMaterials, setSceneMaterials] = useState<any[]>([]);
    const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
    const [maps, setMaps] = useState<any>({ base: null, normal: null, roughness: null, metallic: null, ao: null, height: null, emissive: null });
    const [lighting, setLighting] = useState({ envIntensity: 0.5, keyIntensity: 1.5, keyColor: '#ffffff', keyAngle: 45, rimIntensity: 2.0, rimColor: '#3b82f6' });
    const [envMode, setEnvMode] = useState('studio');
    const [envPath, setEnvPath] = useState('');
    const [params, setParams] = useState(DEFAULT_PARAMS);

    // Environment Handling
    const handleEnvironmentChange = (mode: string, path: string = '') => {
        setEnvMode(mode);
        setEnvPath(path);
        if (!sceneRef.current || !(window as any).pmremGenerator) return;
        const scene = sceneRef.current;
        const pmrem = (window as any).pmremGenerator;

        if (mode === 'studio') {
            scene.environment = (window as any).defaultEnv || null;
            scene.background = null;
        } else if (mode === 'custom' && path) {
            if (path.startsWith('data:') || path.startsWith('blob:')) {
                new THREE.TextureLoader().load(path, (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    const envMap = pmrem.fromEquirectangular(texture).texture;
                    scene.environment = envMap; scene.background = envMap; texture.dispose();
                });
            } else {
                new RGBELoader().load(path, (texture) => {
                    const envMap = pmrem.fromEquirectangular(texture).texture;
                    scene.environment = envMap; scene.background = envMap; texture.dispose();
                });
            }
        }
    };

    // Initialization & Event Loops
    useEffect(() => {
        if (tempImage) { const img = new Image(); img.onload = () => { setSourceImgObj(img); setSourceImage(tempImage); if (setTempImage) setTempImage(null); }; img.src = tempImage; }
    }, [tempImage, setTempImage]);

    useEffect(() => {
        if (sourceImage && typeof sourceImage === 'string') {
            if (!sourceImgObj || sourceImgObj.src !== sourceImage) { const img = new Image(); img.onload = () => { setSourceImgObj(img); }; img.src = sourceImage; }
        }
    }, [sourceImage]);

    useEffect(() => {
        if (!canvasRef.current) return;
        const w = canvasRef.current.clientWidth || 800;
        const h = canvasRef.current.clientHeight || 600;
        const scene = new THREE.Scene();

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); dirLight.position.set(5, 8, 5); dirLight.castShadow = true; scene.add(dirLight);
        const rimLight = new THREE.PointLight(0x3b82f6, 2.0, 20); rimLight.position.set(-5, 2, -5); scene.add(rimLight);
        const fillLight = new THREE.PointLight(0xa855f7, 0.5); fillLight.position.set(0, -5, 0); scene.add(fillLight);
        lightsRef.current = { ambientLight, dirLight, rimLight, fillLight };

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100); camera.position.set(0, 0, 3.5); cameraRef.current = camera;
        const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
        renderer.setSize(w, h); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader();
        const room = new RoomEnvironment(); const defaultEnv = pmrem.fromScene(room).texture; scene.environment = defaultEnv;
        (window as any).pmremGenerator = pmrem; (window as any).defaultEnv = defaultEnv;

        sceneRef.current = scene; rendererRef.current = renderer;

        const animate = () => {
            if (meshRef.current && !isDragging.current) { meshRef.current.rotation.y += 0.0015; }
            renderer.render(scene, camera); frameId.current = requestAnimationFrame(animate);
        };
        animate();

        const handleResize = () => {
            if (canvasRef.current && camera && renderer) {
                const width = canvasRef.current.clientWidth; const height = canvasRef.current.clientHeight;
                if (!width || !height) return;
                camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
            }
        };
        window.addEventListener('resize', handleResize);
        const resizeObserver = new ResizeObserver(() => handleResize()); resizeObserver.observe(canvasRef.current);

        return () => {
            window.removeEventListener('resize', handleResize); resizeObserver.disconnect();
            cancelAnimationFrame(frameId.current); renderer.dispose(); pmrem.dispose();
        };
    }, []);

    useEffect(() => {
        const l = lightsRef.current;
        if (!l.ambientLight) return;
        l.ambientLight.intensity = lighting.envIntensity;
        l.dirLight.intensity = lighting.keyIntensity; l.dirLight.color.set(lighting.keyColor);
        const rad = (lighting.keyAngle * Math.PI) / 180; l.dirLight.position.set(Math.sin(rad) * 8, 8, Math.cos(rad) * 8);
        l.rimLight.intensity = lighting.rimIntensity; l.rimLight.color.set(lighting.rimColor);
    }, [lighting]);

    // Mesh & Material Management
    useEffect(() => {
        if (!sceneRef.current) return;
        const scene = sceneRef.current;
        if (meshRef.current) { scene.remove(meshRef.current); }

        let previewCancelled = false;

        const scanMaterials = (root) => {
            const mats = new Set(); const matList: any[] = [];
            root.traverse((c) => {
                if (c.isMesh && c.material) {
                    const m = c.material;
                    if (!mats.has(m.uuid)) {
                        mats.add(m.uuid);
                        if (!m.isMeshStandardMaterial) {
                            const newMat = new THREE.MeshStandardMaterial({ color: m.color || 0x888888, map: m.map || null });
                            c.material = newMat; matList.push(newMat);
                        } else { matList.push(m); }
                    }
                }
            });
            return matList;
        };

        if (viewShape === 'artifact' && sharedState?.artifact) {
            const loader = new GLTFLoader();
            const url = URL.createObjectURL(sharedState.artifact);
            loader.load(url, (gltf) => {
                const root = gltf.scene;
                normalizeObject(root, MeshImportProfiles.preview);
                scene.add(root); meshRef.current = root;
                const foundMats = scanMaterials(root);
                setSceneMaterials(foundMats);
                if (foundMats.length > 0) setActiveMaterialId(foundMats[0].uuid);
            });
        } else {
            (async () => {
                let geo: THREE.BufferGeometry;
                const primitiveId = viewShape === 'cube' ? 'cube' : 'sphere';
                try {
                    geo = await spawnPrimitiveToThree(primitiveId, { subdivisions: 5 });
                } catch (e) {
                    console.warn('[KAutopbr] Universal primitive failed, using fallback');
                    if (viewShape === 'cube') geo = new THREE.BoxGeometry(1.5, 1.5, 1.5, 64, 64, 64);
                    else geo = new THREE.SphereGeometry(1, 128, 128);
                }
                if (previewCancelled) {
                    geo.dispose();
                    return;
                }
                const newMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.0, name: 'Primitive_Mat' });
                const newMesh = new THREE.Mesh(geo, newMat);
                if (viewShape === 'cube') newMesh.scale.setScalar(0.75);
                newMesh.castShadow = true; newMesh.receiveShadow = true;
                scene.add(newMesh); meshRef.current = newMesh;
                setSceneMaterials([newMat]); setActiveMaterialId(newMat.uuid);
            })();
        }

        return () => { previewCancelled = true; };
    }, [viewShape, sharedState?.artifact]);

    // Material Update Loop
    useEffect(() => {
        if (!maps.base || !activeMaterialId || sceneMaterials.length === 0) return;
        const targetMat = sceneMaterials.find(m => m.uuid === activeMaterialId);
        if (!targetMat) return;
        const loader = new THREE.TextureLoader();
        const load = (url) => { if (!url) return null; const t = loader.load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; };

        // Helper to update distinct map types
        const applyMap = (mapType, mapUrl, isLinear = false) => {
            if (!mapUrl) return;
            const tex = load(mapUrl);
            if (tex) {
                if (isLinear) tex.colorSpace = THREE.LinearSRGBColorSpace;
                tex.repeat.set(params.scale, params.scale);
                targetMat[mapType] = tex;
            }
        };

        applyMap('map', maps.base);
        applyMap('normalMap', maps.normal, true);
        applyMap('roughnessMap', maps.roughness, true);
        applyMap('metalnessMap', maps.metallic, true);
        applyMap('aoMap', maps.ao, true);
        if (maps.height) { targetMat.displacementMap = load(maps.height); targetMat.displacementScale = params.displacementScale; if (targetMat.displacementMap) targetMat.displacementMap.repeat.set(params.scale, params.scale); }

        if (maps.emissive && params.emissiveThreshold > 0.01) {
            applyMap('emissiveMap', maps.emissive);
            targetMat.emissive = new THREE.Color(0xffffff); targetMat.emissiveIntensity = 2.0;
        } else {
            targetMat.emissiveMap = null; targetMat.emissive = new THREE.Color(0x000000); targetMat.emissiveIntensity = 0.0;
        }
        targetMat.needsUpdate = true;
    }, [maps, activeMaterialId, params, sceneMaterials]);

    // Map Generation Logic (GPU-Accelerated! 🚀)
    const generateMaps = useCallback(async () => {
        if (!sourceImgObj) return;
        setLoading(true);
        try {
            const gpuResult = await processAllPbrMapsGpu(sourceImgObj, params);
            setMaps({
                base: gpuResult.base,
                normal: gpuResult.normal,
                roughness: gpuResult.roughness,
                metallic: gpuResult.metallic,
                ao: gpuResult.ao,
                height: gpuResult.height,
                emissive: gpuResult.emissive || null,
            });
            console.log(`[KAutoPBR] 🚀 GPU generation: ${gpuResult.time_ms.toFixed(1)}ms`);
        } catch (error) {
            console.error('[KAutoPBR] GPU generation failed:', error);
        } finally {
            setLoading(false);
        }
    }, [sourceImgObj, params]);

    useEffect(() => { const t = setTimeout(() => { if (sourceImgObj) generateMaps(); }, 800); return () => clearTimeout(t); }, [generateMaps]);

    // Actions
    const handleMapOverride = (type: string, e: any) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => { if (ev.target?.result) setMaps((prev: any) => ({ ...prev, [type]: ev.target?.result })); };
            reader.readAsDataURL(file);
        }
    };

    const applyPreset = (preset: any) => {
        const currentScale = params.scale; const currentSeamless = params.makeSeamless;
        setParams({ ...DEFAULT_PARAMS, scale: currentScale, makeSeamless: currentSeamless, ...preset.params });
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                if (ev.target?.result) {
                    const dataUrl = ev.target.result as string;
                    if (aiBakeMode) { await handleAIBake(dataUrl); }
                    else { const img = new Image(); img.onload = () => { setSourceImgObj(img); setSourceImage(img.src as any); }; img.src = dataUrl; }
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDecalUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => { if (ev.target?.result) { const img = new Image(); img.onload = () => { setDecalImgObj(img); setDecalImage(img.src as any); }; img.src = ev.target.result as string; } };
            reader.readAsDataURL(file);
        }
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt) return;
        setIsGenerating(true);
        const b64 = await generateAITexture(aiPrompt);
        if (b64) {
            const img = new Image(); img.onload = () => { setSourceImgObj(img); setSourceImage(img.src as any); setIsGenerating(false); }; img.src = b64;
        } else { setIsGenerating(false); }
    };

    const handleLocalAiGenerate = async () => {
        if (!aiPrompt) return;
        setIsGenerating(true);
        try {
            await python.start().catch(() => { });
            const result: any = await python.call('ml.generate_image', { prompt: aiPrompt, width: 512, height: 512, steps: 25 });
            if (result && result.image_base64) {
                const b64 = `data:image/png;base64,${result.image_base64}`;
                const img = new Image(); img.onload = () => { setSourceImgObj(img); setSourceImage(b64); setIsGenerating(false); }; img.src = b64;
            } else { setIsGenerating(false); }
        } catch (e) { console.error(e); setIsGenerating(false); }
    };

    const handleAIBake = async (imageDataUrl: string) => {
        if (!imageDataUrl) return;
        setIsBaking(true);
        try {
            await python.start().catch(() => { });
            let result: any;
            try { result = await python.call('autopbr.bake_v3', { b64_data: imageDataUrl }); }
            catch (err: any) {
                if (err.toString().includes('Method not found')) {
                    await python.reloadScript('autopbr_bake').catch(() => { });
                    await new Promise(r => setTimeout(r, 200));
                    result = await python.call('autopbr.bake_v3', { b64_data: imageDataUrl });
                } else throw err;
            }
            if (result.status === 'success' && result.maps) {
                const newMaps = { ...maps };
                const keys = Object.keys(result.maps);
                for (const key of keys) {
                    try {
                        const data: any = await python.call('autopbr.get_b64', { path: result.maps[key] });
                        if (data && data.data) {
                            const b64 = data.data;
                            if (key === 'base') { newMaps.base = b64; const img = new Image(); img.onload = () => { setSourceImgObj(img); setSourceImage(img.src as any); }; img.src = b64; }
                            if (key === 'normal') newMaps.normal = b64; if (key === 'roughness') newMaps.roughness = b64;
                            if (key === 'ao') newMaps.ao = b64; if (key === 'height') newMaps.height = b64;
                        }
                    } catch (e) { console.error(e); }
                }
                setMaps(newMaps);
            }
        } catch (e) { console.error(e); } finally { setIsBaking(false); }
    };

    const handleSendToKernel = () => {
        if (!maps.base) return;
        if (!onMaterialCommit) return;

        const asset = createMaterial(
            {
                ...maps,
                name: `AutoPBR_${Date.now().toString().slice(-4)}`,
                preview: maps.base,
            },
            sharedState?.materials?.length ?? 0
        );

        asset.params = {
            normalStrength: params.normalStrength,
            roughnessFactor: params.roughnessBase,
            metallicFactor: params.metallicBase,
            emissiveStrength: 1.0,
            displacementScale: params.displacementScale,
            uv: {
                scale: [params.scale ?? 1.0, params.scale ?? 1.0],
            },
        };

        onMaterialCommit(asset);
    };
    const handleArtifactUplink = () => {
        if (!meshRef.current) return;
        const exporter = new GLTFExporter();
        exporter.parse(meshRef.current, (gltf) => {
            const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
            if (onCommit) onCommit(blob, "K-AUTOPBR_UPLINK");
        }, (err) => console.error(err), { binary: true, embedImages: true });
    };
    const handleExtractFromMesh = () => {
        if (!activeMaterialId) return;
        const mat = sceneMaterials.find(m => m.uuid === activeMaterialId);
        if (mat && mat.map && mat.map.image) {
            const img = mat.map.image;
            const canvas = document.createElement('canvas'); canvas.width = img.width || 1024; canvas.height = img.height || 1024;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL();
                const newImg = new Image(); newImg.onload = () => { setSourceImgObj(newImg); setSourceImage(dataUrl); }; newImg.src = dataUrl;
            }
        }
    };
    const loadMaterialFromLibrary = (mat) => { const img = new Image(); img.src = mat.base; img.onload = () => { setSourceImgObj(img); setSourceImage(img.src as any); }; };
    const resetTargetMaterial = () => {
        if (!activeMaterialId) return;
        const targetMat = sceneMaterials.find(m => m.uuid === activeMaterialId);
        if (targetMat) {
            targetMat.map = null; targetMat.normalMap = null; targetMat.roughnessMap = null; targetMat.metalnessMap = null; targetMat.aoMap = null;
            targetMat.displacementMap = null; targetMat.emissiveMap = null; targetMat.color.setHex(0x888888); targetMat.needsUpdate = true;
        }
    };
    const exportGLB = () => {
        if (!meshRef.current) return;
        const exporter = new GLTFExporter();
        exporter.parse(meshRef.current, (gltf) => {
            const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.style.display = 'none'; link.href = url; link.download = 'Kipp_Flux_Asset.glb'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
        }, (err) => console.error(err), { binary: true, embedImages: true });
    };
    const handleReset = () => {
        setSourceImage(null); setSourceImgObj(null); setDecalImage(null); setDecalImgObj(null);
        setMaps({ base: null, normal: null, roughness: null, metallic: null, ao: null, height: null, emissive: null });
        setAiPrompt(""); setViewShape('sphere');
    };
    const downloadMap = (dataUrl, name) => {
        if (!dataUrl) return;
        const link = document.createElement('a'); link.download = `K_${name}.png`; link.href = dataUrl; link.style.display = 'none'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };
    const downloadAll = () => { Object.keys(maps).filter(k => maps[k]).forEach((k, i) => setTimeout(() => downloadMap(maps[k], k), i * 800)); };

    const handlePointerDown = (e) => { isDragging.current = true; previousMousePosition.current = { x: e.clientX, y: e.clientY }; if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'; };
    const handlePointerMove = (e) => { if (!isDragging.current || !meshRef.current) return; const delta = { x: e.clientX - previousMousePosition.current.x, y: e.clientY - previousMousePosition.current.y }; meshRef.current.rotation.y += delta.x * 0.005; meshRef.current.rotation.x += delta.y * 0.005; previousMousePosition.current = { x: e.clientX, y: e.clientY }; };
    const handlePointerUp = () => { isDragging.current = false; if (canvasRef.current) canvasRef.current.style.cursor = 'grab'; };
    const handleWheel = (e) => { e.preventDefault(); if (!cameraRef.current) return; const zoomSpeed = 0.001; const newZ = cameraRef.current.position.z + e.deltaY * zoomSpeed; cameraRef.current.position.z = Math.min(Math.max(newZ, 1.5), 10); };


    // AppShell Config
    const leftTabs: DockTab[] = [
        {
            id: 'source', label: 'SOURCE', icon: Monitor, content: (
                <LeftPanel tab='source' sourceImage={sourceImage} setSourceImage={setSourceImage} params={params} setParams={setParams} decalImage={decalImage} handleDecalUpload={handleDecalUpload} sharedState={sharedState} loadMaterialFromLibrary={loadMaterialFromLibrary} applyPreset={applyPreset} />
            )
        },
        {
            id: 'library', label: 'LIBRARY', icon: Library, content: (
                <LeftPanel tab='library' sourceImage={sourceImage} setSourceImage={setSourceImage} params={params} setParams={setParams} decalImage={decalImage} handleDecalUpload={handleDecalUpload} sharedState={sharedState} loadMaterialFromLibrary={loadMaterialFromLibrary} applyPreset={applyPreset} />
            )
        }
    ];

    const rightTabs: DockTab[] = [
        {
            id: 'props', label: 'PROPERTIES', icon: Sliders, content: (
                <RightPanel tab='props' params={params} setParams={setParams} materialMode={materialMode} setMaterialMode={setMaterialMode} envMode={envMode} onEnvChange={handleEnvironmentChange} lighting={lighting} setLighting={setLighting} sceneMaterials={sceneMaterials} activeMaterialId={activeMaterialId} setActiveMaterialId={setActiveMaterialId} resetTargetMaterial={resetTargetMaterial} viewShape={viewShape} handleExtractFromMesh={handleExtractFromMesh} maps={maps} handleMapOverride={handleMapOverride} downloadMap={downloadMap} downloadAll={downloadAll} />
            )
        },
        {
            id: 'light', label: 'LIGHTING', icon: Sun, content: (
                <RightPanel tab='light' params={params} setParams={setParams} materialMode={materialMode} setMaterialMode={setMaterialMode} envMode={envMode} onEnvChange={handleEnvironmentChange} lighting={lighting} setLighting={setLighting} sceneMaterials={sceneMaterials} activeMaterialId={activeMaterialId} setActiveMaterialId={setActiveMaterialId} resetTargetMaterial={resetTargetMaterial} viewShape={viewShape} handleExtractFromMesh={handleExtractFromMesh} maps={maps} handleMapOverride={handleMapOverride} downloadMap={downloadMap} downloadAll={downloadAll} />
            )
        },
        {
            id: 'scene', label: 'SCENE', icon: Layers, content: (
                <RightPanel tab='scene' params={params} setParams={setParams} materialMode={materialMode} setMaterialMode={setMaterialMode} envMode={envMode} onEnvChange={handleEnvironmentChange} lighting={lighting} setLighting={setLighting} sceneMaterials={sceneMaterials} activeMaterialId={activeMaterialId} setActiveMaterialId={setActiveMaterialId} resetTargetMaterial={resetTargetMaterial} viewShape={viewShape} handleExtractFromMesh={handleExtractFromMesh} maps={maps} handleMapOverride={handleMapOverride} downloadMap={downloadMap} downloadAll={downloadAll} />
            )
        },
        {
            id: 'maps', label: 'MAPS', icon: ImageIcon, content: (
                <RightPanel tab='maps' params={params} setParams={setParams} materialMode={materialMode} setMaterialMode={setMaterialMode} envMode={envMode} onEnvChange={handleEnvironmentChange} lighting={lighting} setLighting={setLighting} sceneMaterials={sceneMaterials} activeMaterialId={activeMaterialId} setActiveMaterialId={setActiveMaterialId} resetTargetMaterial={resetTargetMaterial} viewShape={viewShape} handleExtractFromMesh={handleExtractFromMesh} maps={maps} handleMapOverride={handleMapOverride} downloadMap={downloadMap} downloadAll={downloadAll} />
            )
        }
    ];

    return (
        <AppShell
            menuBar={<AppMenuBar />}
            topBar={
                <TopBar
                    viewShape={viewShape} setViewShape={setViewShape} sharedState={sharedState}
                    aiBakeMode={aiBakeMode} setAiBakeMode={setAiBakeMode}
                    aiBakeOptions={aiBakeOptions} setAiBakeOptions={setAiBakeOptions}
                    isBaking={isBaking} handleUpload={handleUpload}
                    handleLocalAiGenerate={handleLocalAiGenerate} isGenerating={isGenerating}
                    aiPrompt={aiPrompt} setAiPrompt={setAiPrompt} handleAiGenerate={handleAiGenerate}
                    handleReset={handleReset} handleSendToKernel={handleSendToKernel}
                    handleArtifactUplink={handleArtifactUplink} exportGLB={exportGLB} sourceImage={sourceImage}
                />
            }
            left={{ tabs: leftTabs, defaultSize: 20 }}
            right={{ tabs: rightTabs, defaultSize: 25 }}
        >
            <div className="flex-1 relative flex flex-col bg-[#050505] min-w-0 h-full">
                <div className="flex-1 relative group h-full" style={{ cursor: 'grab' }}>
                    <canvas ref={canvasRef} className="w-full h-full block outline-none touch-none relative z-10" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onWheel={handleWheel} />
                    {!sourceImage && viewShape !== 'artifact' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-700 z-0">
                            {/* <Globe size={64} className="mb-4 opacity-20" /> */}
                            {/* <p className="text-xl font-bold tracking-widest uppercase opacity-20">KIPP ENGINE IDLE</p> */}
                            {/* Replaced idle content with nothing or maybe a subtle grid? Keeping it clean for now. */}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
};

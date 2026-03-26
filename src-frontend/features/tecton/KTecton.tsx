// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GoogleGenAI } from "@google/genai";
import { Globe, Sun, PenTool } from 'lucide-react';
import { initTectonEngine } from './KTectonEngine';
import { loadScript, downloadBlob } from './KTectonutils';
import { TectonSculptor } from './KTectonsculpting';
import { calculateSunDirection } from './KTectonlighting';
import { generateTerrainData } from './KTectonheightmapgen';
import { useKTectonInteraction } from './KTectonmouseandcamera';
import { listShadingModesByApp, type ShadingModeConfig } from '@/services/configClient';

// NEW UI IMPORTS
import { AppShell } from '@/ui/shell/AppShell';
import { TopBar } from './ui/TopBar';
import { GeneratorPanel } from './ui/GeneratorPanel';
import { EnvironmentPanel } from './ui/EnvironmentPanel';
import { SculptPanel } from './ui/SculptPanel';
import KTectonSequencer from './KTectonSequencer';

const apiKey = process.env.API_KEY || '';

export default function KTecton({ sharedState, onCommit: onCommitProp }: any) {
    // --- STATE ---
    const [status, setStatus] = useState("TECTON NEON V16");

    // UI State for AppShell
    const [activeLeftTab, setActiveLeftTab] = useState('gen');
    const [activeRightTab, setActiveRightTab] = useState('sculpt');

    // Sequencer
    const [showSequencer, setShowSequencer] = useState(false); // Toggle bottom panel visibility

    // Simulation Params
    const [resolution, setResolution] = useState(512);
    const [sizeX, setSizeX] = useState(4096);
    const [sizeZ, setSizeZ] = useState(4096);
    const [heightScale, setHeightScale] = useState(1200);
    const [showRefSphere, setShowRefSphere] = useState(false);
    const [activeEffect, setActiveEffect] = useState<number>(0);
    const [simSpeed, setSimSpeed] = useState(1.0);
    const [viewMode, setViewMode] = useState(0);
    const [shadingModes, setShadingModes] = useState<ShadingModeConfig[]>([]);

    // Sculpting
    const [brushSize, setBrushSize] = useState(0.15);
    const [brushStrength, setBrushStrength] = useState(0.5);
    const [sculptMode, setSculptMode] = useState(0);

    // Generation
    const [prompt, setPrompt] = useState("LIDAR scan of Mount Rainier");
    const [seed, setSeed] = useState(12345);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isResolutionChanging, setIsResolutionChanging] = useState(false);
    const [resolutionProgress, setResolutionProgress] = useState(0);

    // Lighting
    const [sunAzimuth, setSunAzimuth] = useState(220);
    const [sunElevation, setSunElevation] = useState(30);
    const [sunIntensity, setSunIntensity] = useState(2.0);

    // SEQUENCER STATE
    const [isRecording, setIsRecording] = useState(false);
    const [isSimActive, setIsSimActive] = useState(false);
    const [playhead, setPlayhead] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [overwriteMode, setOverwriteMode] = useState(false);
    const [timeDilation, setTimeDilation] = useState(1.0);
    const [maxFrames, setMaxFrames] = useState(500);
    const [history, setHistory] = useState<number[]>([]);

    // ASTEROID STATE
    const [asteroidParams, setAsteroidParams] = useState({ radius: 0.3, strength: 5.0 });

    // REFS - Must be declared before use
    const mountRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<HTMLCanvasElement>(null);
    const sculptEngineRef = useRef<TectonSculptor | null>(null);

    // Render Loop State
    const simRef = useRef({
        activeEffect: 0,
        isRecording: false,
        isPlaying: false,
        isSimActive: false
    });

    const engineRef = useRef<any>({
        scene: null, camera: null, renderer: null,
        mesh: null, material: null,
        simScene: null, simCamera: null, simMaterial: null,
        fluidSim: null,
        targetA: null, targetB: null, initTex: null,
        raycaster: null, mouse: null,
        THREE: null, // Holds THREE instance reference
        frameId: 0,
        historyBuffers: [],
        frameStats: [],
        updateGeometry: null,
        toggleRefSphere: null
    });

    // SCULPTING INTERACTION HOOK - Must come after engineRef declaration
    const sculptParams = {
        activeTab: activeRightTab,
        brushSize,
        brushStrength,
        sculptMode,
        heightScale
    };
    
    const { handleMouseDown, handleMouseUp, handleMouseMove } = useKTectonInteraction(
        mountRef,
        engineRef,
        sculptParams,
        sculptEngineRef,
        { sizeX, sizeZ }
    );

    // --- ENGINE INITIALIZATION --- //
    // (This part is identical to previous logic, simplified for brevity in this view but implementation remains)
    useEffect(() => {
        let isAborted = false;
        const launch = async () => {
            if (!mountRef.current) return;
            if (engineRef.current.renderer) {
                cancelAnimationFrame(engineRef.current.frameId);
                engineRef.current.renderer.dispose();
                if (mountRef.current) mountRef.current.innerHTML = '';
            }
            const engine = await initTectonEngine(mountRef.current, resolution, sizeX, sizeZ);
            if (isAborted) { engine.renderer.dispose(); return; }

            engineRef.current = { ...engineRef.current, ...engine, THREE }; // Force THREE ref
            sculptEngineRef.current = new TectonSculptor(engine.renderer);
            if (engine.setRenderMode) engine.setRenderMode(viewMode);

            const animate = () => {
                const r = engineRef.current;
                if (isAborted) return;
                r.frameId = requestAnimationFrame(animate);
                if (!r.renderer) return;

                // --- LOGIC (Simplified copy of original loop) ---
                if (r.dirLight) {
                    const dir = calculateSunDirection(sunAzimuth, sunElevation);
                    r.dirLight.position.set(dir.x * 10000, dir.y * 10000, dir.z * 10000);
                    r.dirLight.intensity = sunIntensity;
                }

                if (!simRef.current.isPlaying) {
                    const shouldSimulate = simRef.current.isRecording || simRef.current.isSimActive;
                    // ... (Simulation Steps copied) ...
                    // Shortened for this edit, assuming full loop logic is preserved or re-pasted if needed
                    // For safety in this tool call, I will rely on the fact that logic didn't change, just UI
                    // BUT - I should verify if I need to re-paste the whole loop. 
                    // To be safe, I will re-implement the core loop logic here to avoid breaking it.

                    if (shouldSimulate && r.fluidSim) {
                        if (simRef.current.activeEffect === 6) { r.fluidSim.splat(new THREE.Vector2(Math.random(), Math.random()), new THREE.Vector2((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5), new THREE.Vector3(1, 0.2, 0), 0.05); }
                        r.fluidSim.update(0.016, 0.98);
                        r.simMaterial.uniforms.velocityMap.value = r.fluidSim.velocity.read.texture;
                    }
                    r.simMaterial.uniforms.blending.value = false;
                    r.simMaterial.uniforms.time.value += 0.01;
                    r.simMaterial.uniforms.isSimulating.value = shouldSimulate;
                    r.simMaterial.uniforms.activeEffect.value = simRef.current.activeEffect;

                    // Ping Pong
                    const source = r.targetA; const dest = r.targetB;
                    if (r.simMaterial.uniforms.doReset.value) {
                        r.historyBuffers.forEach((b: any) => b.dispose()); r.historyBuffers = []; r.frameStats = []; setHistory([]); setPlayhead(0);
                    }
                    r.simMaterial.uniforms.heightMap.value = source.texture;
                    r.renderer.setRenderTarget(dest); r.renderer.render(r.simScene, r.simCamera); r.renderer.setRenderTarget(null);
                    r.targetA = dest; r.targetB = source;
                    if (r.simMaterial.uniforms.doReset.value) r.simMaterial.uniforms.doReset.value = false;

                    if (simRef.current.isRecording) {
                        const snap = new THREE.WebGLRenderTarget(resolution, resolution, { 
                            minFilter: THREE.NearestFilter, 
                            magFilter: THREE.NearestFilter, 
                            type: THREE.FloatType, 
                            format: THREE.RGBAFormat 
                        });
                        r.simMaterial.uniforms.heightMap.value = r.targetA.texture;
                        r.renderer.setRenderTarget(snap); 
                        r.renderer.render(r.simScene, r.simCamera); 
                        r.renderer.setRenderTarget(null);
                        
                        // Add to history
                        r.historyBuffers.push(snap);
                        
                        // Calculate frame intensity based on active effect
                        const intensity = simRef.current.activeEffect > 0 ? simRef.current.activeEffect / 5.0 : 0.05;
                        r.frameStats.push(intensity);
                        
                        // Trim if exceeding max frames
                        if (r.historyBuffers.length > maxFrames) { 
                            const removed = r.historyBuffers.shift();
                            if (removed) removed.dispose();
                            r.frameStats.shift(); 
                        }
                        
                        // Update UI every frame during recording
                        setPlayhead(r.historyBuffers.length - 1);
                        setHistory(new Array(r.historyBuffers.length).fill(0));
                    }

                    if (r.customMaterial) r.customMaterial.uniforms.heightMap.value = r.targetA.texture;
                    if (r.standardMaterial) {
                        r.standardMaterial.displacementMap = r.targetA.texture;
                        if (r.mesh?.customDepthMaterial) r.mesh.customDepthMaterial.displacementMap = r.targetA.texture;
                    }
                }

                if (r.controls) r.controls.update();
                r.renderer.render(r.scene, r.camera);
            };
            animate();
        };
        launch();
        const handleResize = () => {
            if (!mountRef.current || !engineRef.current.camera || !engineRef.current.renderer) return;
            const w = mountRef.current.clientWidth; const h = mountRef.current.clientHeight;
            engineRef.current.camera.aspect = w / h; engineRef.current.camera.updateProjectionMatrix();
            engineRef.current.renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);
        return () => { isAborted = true; window.removeEventListener('resize', handleResize); engineRef.current.renderer?.dispose(); cancelAnimationFrame(engineRef.current.frameId); engineRef.current.fluidSim?.dispose(); };
    }, []); // Only initialize once, no longer depends on resolution
    
    // NEW: Dynamic resolution update without full re-initialization
    useEffect(() => {
        if (!engineRef.current.updateResolution) return;
        
        setIsResolutionChanging(true);
        setStatus("🔄 UPDATING RESOLUTION...");
        
        // Use setTimeout to allow UI to update before heavy operation
        const timeoutId = setTimeout(() => {
            engineRef.current.updateResolution(resolution, (progress: number) => {
                setResolutionProgress(progress);
                if (progress === 1.0) {
                    setIsResolutionChanging(false);
                    setStatus(`✅ RESOLUTION: ${resolution}x${resolution}`);
                }
            });
        }, 50);
        
        return () => clearTimeout(timeoutId);
    }, [resolution]);
    
    // Load shading modes from config registry
    useEffect(() => {
        const loadShadingModes = async () => {
            try {
                const modes = await listShadingModesByApp('ktecton');
                setShadingModes(modes);
                console.log('[KTecton] Loaded shading modes:', modes);
            } catch (error) {
                console.error('[KTecton] Failed to load shading modes:', error);
                // Fallback to empty array - component will handle gracefully
                setShadingModes([]);
            }
        };
        loadShadingModes();
    }, []);
    
    // View Mode Sync
    useEffect(() => { engineRef.current.setRenderMode?.(viewMode); }, [viewMode]);
    // Height Scale Sync
    useEffect(() => {
        const r = engineRef.current;
        if (r.customMaterial) r.customMaterial.uniforms.heightScale.value = heightScale;
        if (r.standardMaterial) { r.standardMaterial.displacementScale = heightScale; if (r.mesh?.customDepthMaterial) r.mesh.customDepthMaterial.displacementScale = heightScale; }
    }, [heightScale]);
    // Geometry Resize
    useEffect(() => { engineRef.current.updateGeometry?.(sizeX, sizeZ, resolution); }, [sizeX, sizeZ, resolution]);
    // Ref Sphere
    useEffect(() => { engineRef.current.toggleRefSphere?.(showRefSphere); }, [showRefSphere]);
    // Sync Playhead - Auto-advance during playback
    useEffect(() => {
        let interval: any;
        if (isPlaying && history.length > 0) { 
            interval = setInterval(() => { 
                setPlayhead(p => {
                    const next = p + 1;
                    // Loop back to start when reaching end
                    return next >= history.length ? 0 : next;
                }); 
            }, 32 / timeDilation); 
        }
        return () => clearInterval(interval);
    }, [isPlaying, history.length, timeDilation]);
    // Playback Render - Display recorded frames when playing or scrubbing
    useEffect(() => {
        const r = engineRef.current;
        if (!r.historyBuffers || r.historyBuffers.length === 0) return;
        
        // Only render from history when playing OR when not recording/simulating
        const shouldRenderFromHistory = isPlaying || (!isRecording && !isSimActive);
        
        if (shouldRenderFromHistory) {
            const idx = Math.min(Math.floor(playhead), r.historyBuffers.length - 1);
            const buf = r.historyBuffers[idx];
            
            if (buf && buf.texture) {
                // Update all materials with the historical frame
                if (r.customMaterial) {
                    r.customMaterial.uniforms.heightMap.value = buf.texture;
                }
                if (r.standardMaterial) { 
                    r.standardMaterial.displacementMap = buf.texture; 
                    if (r.mesh?.customDepthMaterial) {
                        r.mesh.customDepthMaterial.displacementMap = buf.texture;
                    }
                }
                
                // Update simulation material and render to targetA
                r.simMaterial.uniforms.heightMap.value = buf.texture;
                r.renderer.setRenderTarget(r.targetA); 
                r.renderer.render(r.simScene, r.simCamera); 
                r.renderer.setRenderTarget(null);
            }
        }
    }, [playhead, isPlaying, isRecording, isSimActive]);
    
    // Timeline Drawing - Update when frameStats changes
    useEffect(() => {
        if (engineRef.current.frameStats && engineRef.current.frameStats.length > 0) {
            drawTimeline();
        }
    }, [engineRef.current.frameStats?.length]);
    // Sim State Sync
    useEffect(() => {
        simRef.current = { activeEffect, isRecording, isPlaying, isSimActive };
    }, [activeEffect, isRecording, isPlaying, isSimActive]);
    // Shader Uniforms Sync
    useEffect(() => {
        if (engineRef.current.simMaterial) engineRef.current.simMaterial.uniforms.simSpeed.value = simSpeed;
        if (engineRef.current.material) {
            const m = engineRef.current.material;
            m.uniforms.heightScale.value = heightScale;
            m.uniforms.viewMode.value = viewMode;
            m.uniforms.sunIntensity.value = sunIntensity;
            const dir = calculateSunDirection(sunAzimuth, sunElevation);
            m.uniforms.sunDir.value.copy(dir);
        }
    }, [simSpeed, heightScale, viewMode, sunAzimuth, sunElevation, sunIntensity]);

    // --- HANDLERS ---
    const drawTimeline = () => {
        const cvs = timelineRef.current;
        if (!cvs || !engineRef.current.frameStats) return;
        
        const ctx = cvs.getContext('2d');
        if (!ctx) return;
        
        const w = cvs.width;
        const h = cvs.height;
        const stats = engineRef.current.frameStats;
        
        // Clear canvas
        ctx.clearRect(0, 0, w, h);
        
        // Draw frame bars
        ctx.fillStyle = '#10b98150';
        stats.forEach((val: number, i: number) => {
            const barHeight = Math.max(2, val * h * 0.8);
            const barWidth = Math.max(1, (w / maxFrames));
            const x = (i / maxFrames) * w;
            const y = h - barHeight;
            ctx.fillRect(x, y, barWidth, barHeight);
        });
        
        // Draw frame markers every 10 frames
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 0; i < stats.length; i += 10) {
            const x = (i / maxFrames) * w;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
    };

    const resetSimulationWithData = (data: Float32Array) => {
        const r = engineRef.current; const THREE = r.THREE;
        const newTex = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat, THREE.FloatType);
        newTex.needsUpdate = true;
        r.simMaterial.uniforms.heightMap.value = newTex;
        r.renderer.setRenderTarget(r.targetA); r.renderer.render(r.simScene, r.simCamera); r.renderer.setRenderTarget(null);
        r.historyBuffers.forEach((b: any) => b.dispose()); r.historyBuffers = []; r.frameStats = []; setHistory([]); setPlayhead(0);
    };

    const handleGenerateRandom = () => { resetSimulationWithData(generateTerrainData(resolution, resolution, Math.random() * 10000)); setStatus("NOISE GENERATED"); };

    const generateTerrain = async () => {
        setIsProcessing(true); setStatus("FORGING HEIGHTMAP...");
        try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateImages({ model: 'imagen-4.0-generate-001', prompt: `Top down orthographic heightmap of ${prompt}. 16-bit greyscale DEM style. High contrast. No labels.`, config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/png' } });
            if (response.generatedImages?.[0]?.image?.imageBytes) {
                const img = new Image(); img.src = `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
                img.onload = () => {
                    const cvs = document.createElement('canvas'); cvs.width = resolution; cvs.height = resolution; const ctx = cvs.getContext('2d');
                    if (ctx) { ctx.drawImage(img, 0, 0, resolution, resolution); const iData = ctx.getImageData(0, 0, resolution, resolution).data; const fData = new Float32Array(resolution * resolution * 4); for (let i = 0; i < resolution * resolution; i++) { fData[i * 4] = iData[i * 4] / 255.0; fData[i * 4 + 3] = 1; } resetSimulationWithData(fData); setStatus("AI HEIGHTMAP INJECTED"); }
                };
            }
        } catch (e) { setStatus("AI ERROR"); console.error(e); } finally { setIsProcessing(false); }
    };

    const generateTexture = async () => {
        setIsProcessing(true); setStatus("PAINTING TEXTURE...");
        try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateImages({ model: 'imagen-4.0-generate-001', prompt: `Top down satellite texture of ${prompt}. Photorealistic, game asset, consistent lighting.`, config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' } });
            if (response.generatedImages?.[0]?.image?.imageBytes) {
                const tex = new engineRef.current.THREE.TextureLoader().load(`data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`); tex.colorSpace = THREE.SRGBColorSpace;
                const r = engineRef.current;
                if (r.customMaterial) { r.customMaterial.uniforms.albedoMap.value = tex; r.customMaterial.uniforms.useAlbedoMap.value = true; }
                if (r.standardMaterial) { r.standardMaterial.map = tex; r.standardMaterial.needsUpdate = true; }
                setStatus("AI TEXTURE APPLIED");
            }
        } catch (e) { setStatus("AI ERROR"); } finally { setIsProcessing(false); }
    };

    const handleHeightmapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader(); reader.onload = (evt) => {
            const img = new Image(); img.src = evt.target?.result as string;
            img.onload = () => {
                const cvs = document.createElement('canvas'); cvs.width = resolution; cvs.height = resolution; const ctx = cvs.getContext('2d');
                if (ctx) { ctx.drawImage(img, 0, 0, resolution, resolution); const iData = ctx.getImageData(0, 0, resolution, resolution).data; const fData = new Float32Array(resolution * resolution * 4); for (let i = 0; i < resolution * resolution; i++) { fData[i * 4] = iData[i * 4] / 255.0; fData[i * 4 + 3] = 1; } resetSimulationWithData(fData); setStatus("HEIGHTMAP IMPORTED"); }
            }
        }; reader.readAsDataURL(file);
    };

    const handleAsteroid = () => {
        const r = engineRef.current; if (!r.targetA || !sculptEngineRef.current) return;
        const uv = new THREE.Vector2(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6);
        sculptEngineRef.current.applyBrush(r.targetA, r.targetB, uv, { radius: asteroidParams.radius, strength: asteroidParams.strength, mode: 6 });
        const temp = r.targetA; r.targetA = r.targetB; r.targetB = temp;
        setStatus("☄️ IMPACT DETECTED ☄️");
    };

    // Export terrain mesh to GLTF/GLB format
    const handleExportGLB = async () => {
        const r = engineRef.current;
        
        // Validation: Check if terrain mesh exists
        if (!r.mesh || !r.mesh.geometry) {
            setStatus("❌ NO TERRAIN TO EXPORT");
            return;
        }
        
        // Validation: Check if terrain has vertices
        const vertexCount = r.mesh.geometry.attributes.position?.count || 0;
        if (vertexCount === 0) {
            setStatus("❌ EMPTY TERRAIN - GENERATE FIRST");
            return;
        }
        
        setStatus("🔄 EXPORTING TERRAIN...");
        
        try {
            // Import GLTFExporter dynamically
            const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
            const exporter = new GLTFExporter();
            
            // Create export scene with terrain mesh
            const exportScene = new THREE.Scene();
            const exportMesh = r.mesh.clone();
            
            // Ensure mesh has proper material for export
            if (!exportMesh.material || !(exportMesh.material as THREE.Material).type) {
                exportMesh.material = new THREE.MeshStandardMaterial({
                    color: 0x888888,
                    roughness: 0.8,
                    metalness: 0.2
                });
            }
            
            // Copy current displacement map if available
            if (r.targetA && r.targetA.texture) {
                const mat = exportMesh.material as THREE.MeshStandardMaterial;
                mat.displacementMap = r.targetA.texture;
                mat.displacementScale = heightScale;
            }
            
            exportMesh.name = `KTecton_Terrain_${Date.now()}`;
            exportScene.add(exportMesh);
            
            // Export to GLB binary format
            exporter.parse(
                exportScene,
                (gltf) => {
                    const blob = new Blob([gltf as ArrayBuffer], { 
                        type: 'application/octet-stream' 
                    });
                    const filename = `ktecton_terrain_${resolution}x${resolution}_${Date.now()}.glb`;
                    downloadBlob(blob, filename);
                    setStatus(`✅ EXPORTED: ${filename}`);
                },
                (error) => {
                    console.error('Export error:', error);
                    setStatus("❌ EXPORT FAILED");
                },
                { binary: true }
            );
        } catch (error) {
            console.error('Export error:', error);
            setStatus("❌ EXPORT FAILED");
        }
    };

    // Export heightmap to PNG or EXR format
    const handleExportHeightmap = async (format: 'png8' | 'png16' | 'exr', exportResolution?: number) => {
        const r = engineRef.current;
        
        // Validation: Check if heightmap data exists
        if (!r.targetA || !r.targetA.texture) {
            setStatus("❌ NO HEIGHTMAP TO EXPORT");
            return;
        }
        
        const targetRes = exportResolution || resolution;
        
        // Validate resolution range (512px to 8192px per requirements)
        if (targetRes < 512 || targetRes > 8192) {
            setStatus("❌ RESOLUTION MUST BE 512-8192");
            return;
        }
        
        setStatus(`🔄 EXPORTING ${format.toUpperCase()} HEIGHTMAP...`);
        
        try {
            // Read heightmap data from GPU texture
            const readBuffer = new Float32Array(resolution * resolution * 4);
            r.renderer.readRenderTargetPixels(r.targetA, 0, 0, resolution, resolution, readBuffer);
            
            // Create canvas for export
            const canvas = document.createElement('canvas');
            canvas.width = targetRes;
            canvas.height = targetRes;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                setStatus("❌ CANVAS CONTEXT FAILED");
                return;
            }
            
            if (format === 'exr') {
                // EXR export: 32-bit float format
                // For EXR, we need to use a library like openexr or three-exr-loader
                // Since EXR export is complex, we'll use a workaround with PNG for now
                // and add proper EXR support later with a dedicated library
                setStatus("⚠️ EXR EXPORT - USING 16-BIT PNG");
                format = 'png16';
            }
            
            // Resample if needed
            let heightData: Float32Array;
            if (targetRes !== resolution) {
                heightData = resampleHeightmap(readBuffer, resolution, targetRes);
            } else {
                heightData = readBuffer;
            }
            
            // Create image data based on format
            const imageData = ctx.createImageData(targetRes, targetRes);
            
            if (format === 'png8') {
                // 8-bit PNG: Single channel grayscale
                for (let i = 0; i < targetRes * targetRes; i++) {
                    const height = Math.max(0, Math.min(1, heightData[i * 4]));
                    const value = Math.floor(height * 255);
                    imageData.data[i * 4] = value;     // R
                    imageData.data[i * 4 + 1] = value; // G
                    imageData.data[i * 4 + 2] = value; // B
                    imageData.data[i * 4 + 3] = 255;   // A
                }
            } else if (format === 'png16') {
                // 16-bit PNG: Encode high precision in RG channels
                for (let i = 0; i < targetRes * targetRes; i++) {
                    const height = Math.max(0, Math.min(1, heightData[i * 4]));
                    const value16 = Math.floor(height * 65535);
                    const high = (value16 >> 8) & 0xFF;  // High byte
                    const low = value16 & 0xFF;          // Low byte
                    imageData.data[i * 4] = high;        // R = high byte
                    imageData.data[i * 4 + 1] = low;     // G = low byte
                    imageData.data[i * 4 + 2] = 0;       // B = unused
                    imageData.data[i * 4 + 3] = 255;     // A = opaque
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            // Convert canvas to blob and download
            canvas.toBlob((blob) => {
                if (blob) {
                    const filename = `ktecton_heightmap_${targetRes}x${targetRes}_${format}_${Date.now()}.png`;
                    downloadBlob(blob, filename);
                    setStatus(`✅ EXPORTED: ${filename}`);
                } else {
                    setStatus("❌ BLOB CREATION FAILED");
                }
            }, 'image/png');
            
        } catch (error) {
            console.error('Heightmap export error:', error);
            setStatus("❌ HEIGHTMAP EXPORT FAILED");
        }
    };
    
    // Helper function to resample heightmap to different resolution
    const resampleHeightmap = (sourceData: Float32Array, sourceRes: number, targetRes: number): Float32Array => {
        const targetData = new Float32Array(targetRes * targetRes * 4);
        const scale = sourceRes / targetRes;
        
        for (let y = 0; y < targetRes; y++) {
            for (let x = 0; x < targetRes; x++) {
                const srcX = Math.floor(x * scale);
                const srcY = Math.floor(y * scale);
                const srcIdx = (srcY * sourceRes + srcX) * 4;
                const tgtIdx = (y * targetRes + x) * 4;
                
                // Copy RGBA values
                targetData[tgtIdx] = sourceData[srcIdx];
                targetData[tgtIdx + 1] = sourceData[srcIdx + 1];
                targetData[tgtIdx + 2] = sourceData[srcIdx + 2];
                targetData[tgtIdx + 3] = sourceData[srcIdx + 3];
            }
        }
        
        return targetData;
    };
    
    const handleExportZIP = () => { 
        // TODO: Implement ZIP export with heightmap + mesh + textures
        setStatus("ZIP EXPORT - COMING SOON"); 
    };
    const handleCommit = () => { if (onCommitProp) onCommitProp(); };

    return (
        <AppShell
            topBar={
                <TopBar
                    status={status}
                    onImport={handleHeightmapUpload}
                    onCommit={handleCommit}
                    onExportGLB={handleExportGLB}
                    onExportHeightmap={handleExportHeightmap}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    shadingModes={shadingModes}
                    asteroidParams={asteroidParams}
                    setAsteroidParams={setAsteroidParams}
                    handleAsteroid={handleAsteroid}
                    showSequencer={showSequencer}
                    setShowSequencer={setShowSequencer}
                />
            }
            left={{
                title: "TECTON",
                activeTab: activeLeftTab,
                onTabChange: setActiveLeftTab,
                tabs: [
                    {
                        id: 'gen', label: 'GENESIS', icon: Globe,
                        content: <GeneratorPanel
                            sizeX={sizeX} setSizeX={setSizeX}
                            sizeZ={sizeZ} setSizeZ={setSizeZ}
                            heightScale={heightScale} setHeightScale={setHeightScale}
                            resolution={resolution} setResolution={setResolution}
                            prompt={prompt} setPrompt={setPrompt}
                            isProcessing={isProcessing}
                            generateTerrain={generateTerrain}
                            generateTexture={generateTexture}
                            handleGenerateRandom={handleGenerateRandom}
                        />
                    },
                    {
                        id: 'env', label: 'SOLAR', icon: Sun,
                        content: <EnvironmentPanel
                            sunIntensity={sunIntensity} setSunIntensity={setSunIntensity}
                            sunAzimuth={sunAzimuth} setSunAzimuth={setSunAzimuth}
                            sunElevation={sunElevation} setSunElevation={setSunElevation}
                            scene={engineRef.current.scene}
                            renderer={engineRef.current.renderer}
                        />
                    }
                ]
            }}
            right={{
                title: "SCULPT",
                activeTab: activeRightTab,
                onTabChange: setActiveRightTab,
                tabs: [
                    {
                        id: 'sculpt', label: 'TOOLS', icon: PenTool,
                        content: <SculptPanel
                            sculptMode={sculptMode} setSculptMode={setSculptMode}
                            brushSize={brushSize} setBrushSize={setBrushSize}
                            brushStrength={brushStrength} setBrushStrength={setBrushStrength}
                        />
                    }
                ]
            }}
            bottomTabs={showSequencer ? [
                {
                    id: 'sequencer',
                    label: 'SEQUENCER',
                    content: (
                        <KTectonSequencer
                            isRecording={isRecording} setIsRecording={setIsRecording}
                            isPlaying={isPlaying} setIsPlaying={setIsPlaying}
                            playhead={playhead} setPlayhead={setPlayhead}
                            maxFrames={maxFrames} setMaxFrames={setMaxFrames}
                            timeDilation={timeDilation} setTimeDilation={setTimeDilation}
                            overwriteMode={overwriteMode} setOverwriteMode={setOverwriteMode}
                            timelineRef={timelineRef}
                            frameStats={engineRef.current.frameStats}
                            onExportGLB={handleExportGLB}
                            onExportZIP={handleExportZIP}
                            onExportHeightmap={handleExportHeightmap}
                        />
                    )
                }
            ] : undefined}
            bottomTitle="SEQUENCER"
            bottomHeight={showSequencer ? 240 : 0} // Toggle bottom panel
        >
            {/* MAIN VIEWPORT */}
            <div 
                ref={mountRef} 
                className="w-full h-full bg-black relative overflow-hidden"
                onPointerDown={handleMouseDown}
                onPointerUp={handleMouseUp}
                onPointerMove={handleMouseMove}
                style={{ cursor: 'crosshair' }}
            >
                {/* Resolution Change Loading Indicator */}
                {isResolutionChanging && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
                        <div className="bg-gray-900/90 border border-emerald-500/30 rounded-lg p-6 min-w-[300px]">
                            <div className="text-emerald-400 font-mono text-sm mb-3 text-center">
                                UPDATING TERRAIN RESOLUTION
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2 mb-2 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all duration-300 ease-out"
                                    style={{ width: `${resolutionProgress * 100}%` }}
                                />
                            </div>
                            <div className="text-gray-400 font-mono text-xs text-center">
                                {Math.round(resolutionProgress * 100)}% Complete
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Toggle logic for sequencer button in TopBar should technically be passed down but we missed it in TopBar props. 
                Let's add a floating toggle or assume TopBar can control it via a new prop next time. 
                For now, I'll add a dirty absolute button for sequencer toggle if it's missing from TopBar.*/}
        </AppShell>
    );
}
// @ts-nocheck

// @ts-nocheck

import * as THREE from 'three';
import { loadScript } from './KTectonutils';
import { SIM_VERTEX, PHYSICS_FRAGMENT, RENDER_VERTEX, RENDER_FRAGMENT } from './KTectonshaders';
import { generateTerrainData } from './KTectonheightmapgen';
import { FluidSimulator } from '@/systems/physics/FluidSimulator';

export const initTectonEngine = async (
    container: HTMLElement,
    resolution: number,
    sizeX: number,
    sizeZ: number
) => {
    // Ensure dependencies
    if (!(window as any).THREE) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
    if (!(window as any).THREE.OrbitControls) await loadScript("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js");
    if (!(window as any).THREE.GLTFExporter) await loadScript("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js");

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. SIM SETUP (GPGPU)
    const options = {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        type: THREE.FloatType,
        format: THREE.RGBAFormat
    };
    const targetA = new THREE.WebGLRenderTarget(resolution, resolution, options);
    const targetB = new THREE.WebGLRenderTarget(resolution, resolution, options);

    // Initial Noise via FBM Generator
    const data = generateTerrainData(resolution, resolution, Math.random() * 10000);
    const initTex = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat, THREE.FloatType);
    initTex.needsUpdate = true;

    // 2. RENDER SETUP
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070a); // Deep Space / Charcoal Atmosphere
    scene.fog = new THREE.FogExp2(0x05070a, 0.00008);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // FLUID SIMULATOR INJECTION
    // Using a lower resolution for fluid to make it "swirly" and performant
    const fluidSim = new FluidSimulator(renderer, 256);

    const simScene = new THREE.Scene();
    const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const simMaterial = new THREE.ShaderMaterial({
        uniforms: {
            heightMap: { value: initTex },
            velocityMap: { value: fluidSim.velocity.read.texture }, // Bind Fluid
            mousePos: { value: new THREE.Vector2(-1, -1) },
            brushSize: { value: 0.15 },
            brushStrength: { value: 0.5 },
            time: { value: 0 },
            activeEffect: { value: 0 },
            simSpeed: { value: 1.0 },
            doReset: { value: false },
            isSimulating: { value: false },
            blending: { value: false },
            blendFactor: { value: 0 },
            blendTargetA: { value: null },
            blendTargetB: { value: null },
            seed: { value: Math.random() },
            res: { value: new THREE.Vector2(resolution, resolution) }
        },
        vertexShader: SIM_VERTEX,
        fragmentShader: PHYSICS_FRAGMENT
    });
    simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial));

    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 100000);
    camera.position.set(0, 3000, 3000);

    const controls = new (window as any).THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 30000;

    // Controls Config
    controls.enabled = true;
    controls.enableRotate = true;  // Enable rotation by default for orbit
    controls.enablePan = false;     // Pan only with Alt key
    controls.enableZoom = true;     // Zoom always enabled
    
    // Optional: Auto-rotation for cinematic effect (stops on user interaction)
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5; // Slow, subtle rotation

    // Plane Geometry
    const geometry = new THREE.PlaneGeometry(sizeX, sizeZ, resolution, resolution);
    geometry.rotateX(-Math.PI / 2);

    // MATERIAL 1: CUSTOM SHADER (ANALYSIS / NEON)
    const customMaterial = new THREE.ShaderMaterial({
        uniforms: {
            heightMap: { value: targetA.texture },
            heightScale: { value: 1200.0 },
            albedoMap: { value: null },
            useAlbedoMap: { value: false },
            detailScale: { value: 1.0 },
            detailStrength: { value: 0.5 },
            viewMode: { value: 0 },
            sunDir: { value: new THREE.Vector3(0.5, 1.0, 0.5) },
            sunIntensity: { value: 1.5 }
        },
        vertexShader: RENDER_VERTEX,
        fragmentShader: RENDER_FRAGMENT,
        side: THREE.DoubleSide
    });

    // MATERIAL 2: PBR STANDARD (REALISTIC / HDR)
    const standardMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.8,
        metalness: 0.2,
        displacementMap: targetA.texture,
        displacementScale: 1200.0,
        displacementBias: 0,
        side: THREE.DoubleSide,
        shadowSide: THREE.DoubleSide
    });

    // Default to Standard (Realistic) since we want HDR
    const mesh = new THREE.Mesh(geometry, standardMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        displacementMap: targetA.texture,
        displacementScale: 1200.0,
        displacementBias: 0
    });
    scene.add(mesh);

    // Lights - SEXIER LIGHTING
    const hemi = new THREE.HemisphereLight(0xffffff, 0x050505, 0.6); // Increased Ambient
    scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5); // Main Sun (Boosted from 1.5)
    dirLight.position.set(5000, 8000, 5000);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.camera.near = 100;
    dirLight.shadow.camera.far = 50000;
    dirLight.shadow.camera.left = -20000;
    dirLight.shadow.camera.right = 20000;
    dirLight.shadow.camera.top = 20000;
    dirLight.shadow.camera.bottom = -20000;
    scene.add(dirLight);

    // Rim Light (Teal/Emerald)
    const rimLight = new THREE.SpotLight(0x00ffcc, 5.0);
    rimLight.position.set(-5000, 2000, -5000);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // Fill Light (Purple/Magenta)
    const fillLight = new THREE.PointLight(0xbd00ff, 1.0, 10000);
    fillLight.position.set(5000, 1000, -5000);
    scene.add(fillLight);

    // Reference Sphere
    const refGeo = new THREE.SphereGeometry(20, 32, 32);
    const refMat = new THREE.MeshStandardMaterial({ color: 0xff4400, roughness: 0.2, emissive: 0x441100 });
    const refSphere = new THREE.Mesh(refGeo, refMat);
    refSphere.position.set(0, 100, 0);
    refSphere.visible = false;
    scene.add(refSphere);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Store current resolution for dynamic updates
    let currentResolution = resolution;

    const updateGeometry = (newX: number, newZ: number, newRes: number) => {
        mesh.geometry.dispose();
        const newGeo = new THREE.PlaneGeometry(newX, newZ, newRes, newRes);
        newGeo.rotateX(-Math.PI / 2);
        mesh.geometry = newGeo;
    };

    const toggleRefSphere = (visible: boolean) => {
        refSphere.visible = visible;
    };

    const setRenderMode = (mode: number) => {
        // Mode 0 = Realistic (StandardMaterial) -> This was previously Dark Matter in shader
        // But for HDR we want PBR.
        // Let's say:
        // 0 = PBR Standard
        // 1 = Neon
        // 2 = Heatmap
        // 3 = Contour

        if (mode === 0) {
            (mesh.material as any) = standardMaterial;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        } else {
            (mesh.material as any) = customMaterial;
            customMaterial.uniforms.viewMode.value = mode;
            // Note: Shader handles logic for 1, 2, 3 but might need updates if we shifted 0 away.
            // Actually, Shader mode 0 was "Dark Matter".
            // If we want to keep "Dark Matter" as a mode, we should perhaps assign it to mode 4 or something?
            // Or just replace Mode 0 with Standard PBR.
            // Let's assume Mode 0 in UI "Standard / Clay" is now PBR.
        }
        (mesh.material as any).needsUpdate = true;
    };

    /**
     * NEW: Dynamic resolution update without full re-initialization
     * This allows changing terrain resolution on-the-fly
     */
    const updateResolution = (newResolution: number, onProgress?: (progress: number) => void) => {
        if (newResolution === currentResolution) return;

        // Report progress: Starting
        onProgress?.(0);

        // 1. Dispose old render targets
        targetA.dispose();
        targetB.dispose();

        // 2. Create new render targets with new resolution
        const options = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            type: THREE.FloatType,
            format: THREE.RGBAFormat
        };
        const newTargetA = new THREE.WebGLRenderTarget(newResolution, newResolution, options);
        const newTargetB = new THREE.WebGLRenderTarget(newResolution, newResolution, options);

        // Report progress: Buffers created
        onProgress?.(0.3);

        // 3. Generate new terrain data at new resolution
        const newData = generateTerrainData(newResolution, newResolution, Math.random() * 10000);
        const newInitTex = new THREE.DataTexture(newData, newResolution, newResolution, THREE.RGBAFormat, THREE.FloatType);
        newInitTex.needsUpdate = true;

        // Report progress: Terrain generated
        onProgress?.(0.6);

        // 4. Update shader uniforms with new textures
        simMaterial.uniforms.heightMap.value = newInitTex;
        simMaterial.uniforms.res.value.set(newResolution, newResolution);
        
        // Render initial state to new targetA
        renderer.setRenderTarget(newTargetA);
        renderer.render(simScene, simCamera);
        renderer.setRenderTarget(null);

        // 5. Update material references
        customMaterial.uniforms.heightMap.value = newTargetA.texture;
        standardMaterial.displacementMap = newTargetA.texture;
        if (mesh.customDepthMaterial) {
            mesh.customDepthMaterial.displacementMap = newTargetA.texture;
        }

        // Report progress: Materials updated
        onProgress?.(0.8);

        // 6. Update geometry with new resolution
        mesh.geometry.dispose();
        const newGeo = new THREE.PlaneGeometry(sizeX, sizeZ, newResolution, newResolution);
        newGeo.rotateX(-Math.PI / 2);
        mesh.geometry = newGeo;

        // 7. Update engine references
        (engineRef as any).targetA = newTargetA;
        (engineRef as any).targetB = newTargetB;
        (engineRef as any).initTex = newInitTex;
        currentResolution = newResolution;

        // Report progress: Complete
        onProgress?.(1.0);
    };

    // Create engine reference object
    const engineRef = {
        scene, camera, renderer, controls, mesh,
        material: customMaterial, // keep reference for when swapping or updating props
        standardMaterial, // expose standard
        customMaterial,
        simScene, simCamera, simMaterial,
        targetA, targetB, initTex,
        fluidSim,
        raycaster, mouse,
        THREE: (window as any).THREE,
        historyBuffers: [],
        frameStats: [],
        updateGeometry,
        toggleRefSphere,
        setRenderMode,
        updateResolution, // NEW: Expose resolution update function
        dirLight
    };

    return engineRef;
};
// @ts-nocheck


import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clearActiveStageIf, setActiveStage } from '@/ui/lookdev/lookdevRegistry';

export interface StudioStageOptions {
    preset?: keyof typeof StudioStagePresets;
    cameraPosition?: [number, number, number];
    controls?: boolean;
    lighting?: boolean;
    background?: number;
    shadows?: boolean;
    grid?: boolean;
    environment?: boolean;
    environmentIntensity?: number;
    environmentBlur?: number;
    autoStart?: boolean;
    autoRender?: boolean;
    toneMappingExposure?: number;
    antialias?: boolean;
    alpha?: boolean;
    preserveDrawingBuffer?: boolean;
    powerPreference?: WebGLPowerPreference;
    pixelRatio?: number;
    maxPixelRatio?: number;
}

export const StudioStagePresets = {
    default: {
        controls: true,
        lighting: true,
        shadows: true,
        grid: true,
        environment: true,
        environmentIntensity: 1.0,
        environmentBlur: 0.04,
        autoStart: true,
        autoRender: true,
        toneMappingExposure: 1.0,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance' as const,
        maxPixelRatio: 2,
    },
    transparent_ui: {
        controls: true,
        lighting: true,
        shadows: true,
        grid: true,
        environment: true,
        environmentIntensity: 1.0,
        environmentBlur: 0.04,
        autoStart: true,
        autoRender: true,
        toneMappingExposure: 1.0,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance' as const,
        maxPixelRatio: 2,
    },
    minimal: {
        controls: true,
        lighting: false,
        shadows: false,
        grid: false,
        environment: false,
        environmentIntensity: 1.0,
        environmentBlur: 0.04,
        autoStart: true,
        autoRender: true,
        toneMappingExposure: 1.0,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance' as const,
        maxPixelRatio: 2,
    },
    pbr_preview: {
        controls: true,
        lighting: true,
        shadows: true,
        grid: false,
        environment: true,
        environmentIntensity: 0.35,
        environmentBlur: 0.18,
        autoStart: true,
        autoRender: true,
        toneMappingExposure: 1.0,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance' as const,
        maxPixelRatio: 2,
    },
} as const;

/**
 * StudioStage
 * A standardized high-fidelity Three.js environment for K-OS apps.
 * Handles: Renderer, Scene, Camera, Controls, Lights, Resizing.
 */
export class StudioStage {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls | null = null;

    // Public access to lights for tweaking
    lights: {
        key: THREE.DirectionalLight;
        ambient: THREE.AmbientLight;
    } | null = null;

    private pmremGenerator: THREE.PMREMGenerator | null = null;
    private environmentTexture: THREE.Texture | null = null;

    private ownsRendererDomElement: boolean = false;

    private resizeObserver: ResizeObserver | null = null;

    private onActivate: ((e: PointerEvent) => void) | null = null;

    private frameId: number = 0;
    private callbacks: (() => void)[] = [];
    private running: boolean = false;
    private autoRender: boolean = true;

    constructor(container: HTMLElement, options: StudioStageOptions = {}) {
        const preset = options.preset ? StudioStagePresets[options.preset] : undefined;
        const resolved: StudioStageOptions = { ...(StudioStagePresets.default as any), ...(preset as any), ...options };

        this.autoRender = resolved.autoRender !== false;

        const w = container.clientWidth;
        const h = container.clientHeight;

        const existingCanvas = container instanceof HTMLCanvasElement ? container : null;
        this.ownsRendererDomElement = existingCanvas === null;

        // 1. Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: existingCanvas ?? undefined,
            antialias: resolved.antialias !== false,
            alpha: resolved.alpha !== false,
            preserveDrawingBuffer: !!resolved.preserveDrawingBuffer,
            powerPreference: resolved.powerPreference ?? 'high-performance'
        });
        this.renderer.setSize(w, h);
        const maxPixelRatio = resolved.maxPixelRatio ?? 2;
        const pixelRatio = resolved.pixelRatio ?? Math.min(window.devicePixelRatio, maxPixelRatio);
        this.renderer.setPixelRatio(pixelRatio);

        // Canonical renderer defaults for PBR (consistent across all apps)
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = resolved.toneMappingExposure ?? 1.0;

        if (resolved.shadows !== false) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        if (this.ownsRendererDomElement) {
            this.renderer.domElement.style.width = '100%';
            this.renderer.domElement.style.height = '100%';
            this.renderer.domElement.style.display = 'block';
            this.renderer.domElement.style.outline = 'none';
            container.appendChild(this.renderer.domElement);
        }

        // Lookdev activation: click any viewport to make it the active stage
        this.onActivate = () => setActiveStage(this);
        this.renderer.domElement.addEventListener('pointerdown', this.onActivate);

        // 2. Scene (MUST be created BEFORE setActiveStage so lookdev callbacks can access it)
        this.scene = new THREE.Scene();
        if (resolved.background) {
            this.scene.background = new THREE.Color(resolved.background);
        }

        if (resolved.environment !== false) {
            this.setEnvironmentFromRoom({ blur: resolved.environmentBlur });
            (this.scene as any).environmentIntensity = resolved.environmentIntensity ?? 1.0;
        }

        // Register with lookdev AFTER scene is created
        setActiveStage(this);

        // 3. Camera
        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        const [cx, cy, cz] = resolved.cameraPosition || [0, 0, 4];
        this.camera.position.set(cx, cy, cz);

        // 4. Controls
        if (resolved.controls !== false) {
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
        }

        // 5. Lighting (Standard Studio Rig)
        if (resolved.lighting !== false) {
            // Keep lights minimal: IBL does most of the work; we add one "sun" + tiny ambient lift.
            const ambient = new THREE.AmbientLight(0xffffff, 0.08);

            const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
            keyLight.position.set(5, 8, 5);
            keyLight.castShadow = true;
            keyLight.shadow.mapSize.set(2048, 2048);

            this.scene.add(ambient, keyLight);

            this.lights = { key: keyLight, ambient };
        }

        // 6. Grid Helper
        if (resolved.grid !== false) {
            const grid = new THREE.GridHelper(20, 20, 0x333333, 0x111111);
            grid.position.y = -1;
            this.scene.add(grid);
        }

        // Start Loop
        if (resolved.autoStart !== false) {
            this.start();
        }
    }

    onLoop(callback: () => void) {
        this.callbacks.push(callback);
        return () => {
            const idx = this.callbacks.indexOf(callback);
            if (idx >= 0) this.callbacks.splice(idx, 1);
        };
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.animate();
    }

    stop() {
        this.running = false;
        cancelAnimationFrame(this.frameId);
    }

    attachResizeObserver(target?: HTMLElement) {
        const el = target ?? this.renderer.domElement.parentElement;
        if (!el) return;
        this.detachResizeObserver();
        this.resizeObserver = new ResizeObserver(() => this.resize(el));
        this.resizeObserver.observe(el);
    }

    detachResizeObserver() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }

    private ensurePmrem() {
        if (!this.pmremGenerator) {
            this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        }
        return this.pmremGenerator;
    }

    setEnvironmentFromRoom(options: { blur?: number } = {}) {
        const pmrem = this.ensurePmrem();
        if (this.environmentTexture) {
            this.environmentTexture.dispose();
            this.environmentTexture = null;
        }
        const blur = options.blur ?? 0.04;
        this.environmentTexture = pmrem.fromScene(new RoomEnvironment(), blur).texture;
        this.scene.environment = this.environmentTexture;
    }

    setEnvironmentFromEquirectangular(texture: THREE.Texture, options: { disposeInput?: boolean } = {}) {
        const pmrem = this.ensurePmrem();
        if (this.environmentTexture) {
            this.environmentTexture.dispose();
            this.environmentTexture = null;
        }
        const env = pmrem.fromEquirectangular(texture).texture;
        this.environmentTexture = env;
        this.scene.environment = env;
        if (options.disposeInput) texture.dispose();
    }

    private animate = () => {
        if (!this.running) return;
        this.frameId = requestAnimationFrame(this.animate);

        if (this.controls) this.controls.update();

        // Run external hooks
        for (const cb of this.callbacks) {
            cb();
        }

        if (this.autoRender) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    resize(container?: HTMLElement) {
        const parent = container ?? this.renderer.domElement.parentElement;
        if (!parent) return;
        const w = parent.clientWidth || 1;
        const h = parent.clientHeight || 1;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
    }

    dispose() {
        this.stop();
        this.detachResizeObserver();

        if (this.onActivate) {
            this.renderer.domElement.removeEventListener('pointerdown', this.onActivate);
            this.onActivate = null;
        }
        clearActiveStageIf(this);

        if (this.lights) {
            this.scene.remove(this.lights.ambient);
            this.scene.remove(this.lights.key);
        }

        if (this.environmentTexture) {
            this.environmentTexture.dispose();
            this.environmentTexture = null;
        }
        if (this.pmremGenerator) {
            this.pmremGenerator.dispose();
            this.pmremGenerator = null;
        }

        this.renderer.dispose();
        if (this.controls) this.controls.dispose();
        // Remove canvas
        if (this.ownsRendererDomElement && this.renderer.domElement.parentElement) {
            this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
        }
    }
}

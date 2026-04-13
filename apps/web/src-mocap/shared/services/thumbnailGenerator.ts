import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getBoundingBox } from '@mocap/lib/utils/geometryUtils';
import { python } from '@mocap/shared/services/pythonBridge'

/**
 * Thumbnail Generator Singleton
 * 
 * Uses Python backend for high-quality thumbnails with:
 * - PCA-based auto-orientation
 * - Best-view detection (samples multiple angles)
 * - Professional 3-point lighting
 * 
 * Falls back to Three.js if Python is unavailable.
 */
class ThumbnailGenerator {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer | null = null;
    private mainLight: THREE.DirectionalLight;
    private fillLight: THREE.HemisphereLight;
    private loader: GLTFLoader;
    private initialized: boolean = false;
    private pythonAvailable: boolean | null = null;

    // Configuration
    private readonly FOV = 45;
    private readonly BG_COLOR = 0x000000;
    private readonly BG_ALPHA = 0;
    private readonly THUMB_SIZE = 256;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(this.FOV, 1, 0.01, 1000);
        this.fillLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
        this.mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.loader = new GLTFLoader();
    }

    private initThreeJS(): void {
        if (this.initialized) return;

        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
            logarithmicDepthBuffer: true
        });

        this.renderer.setSize(this.THUMB_SIZE, this.THUMB_SIZE);
        this.renderer.setClearColor(this.BG_COLOR, this.BG_ALPHA);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene.add(this.fillLight);
        this.scene.add(this.mainLight);
        this.scene.add(this.camera);
        this.camera.add(this.mainLight);
        this.mainLight.position.set(2, 4, 3);

        this.initialized = true;
    }

    /**
     * Check if Python thumbnail service is available
     */
    private async checkPythonAvailable(): Promise<boolean> {
        if (this.pythonAvailable !== null) {
            return this.pythonAvailable;
        }

        try {
            await python.ping();
            // Check if thumbnail function is registered
            const functions = await python.listFunctions();
            this.pythonAvailable = functions.includes('thumbnail.generate');
        } catch (e) {
            console.warn('[ThumbnailGen] Python not available, using Three.js fallback');
            this.pythonAvailable = false;
        }

        return this.pythonAvailable;
    }

    /**
     * Generate thumbnail using Python backend
     */
    private async generateWithPython(blob: Blob): Promise<string> {
        // Convert blob to base64
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const base64 = btoa(String.fromCharCode(...bytes));

        // Call Python thumbnail generator
        const result = await python.call<string>('thumbnail.generate', {
            glb_base64: base64,
            size: this.THUMB_SIZE,
            background: 'transparent',
            auto_orient: true,
            best_view: true
        });

        return result;
    }

    /**
     * Generate thumbnail using Three.js (fallback)
     */
    private async generateWithThreeJS(blob: Blob): Promise<string> {
        this.initThreeJS();
        const url = URL.createObjectURL(blob);

        return new Promise((resolve) => {
            this.loader.load(
                url,
                (gltf) => {
                    const root = gltf.scene;
                    this.scene.add(root);

                    const bounds = getBoundingBox(root);
                    const { center, maxDim } = bounds;
                    const objectRadius = maxDim / 2;

                    const fovRad = (this.FOV * Math.PI) / 180;
                    const cameraDist = (objectRadius / Math.sin(fovRad / 2)) * 1.5;

                    // Use a classic 3/4 view angle
                    const viewDir = new THREE.Vector3(1, 0.8, 1).normalize();
                    const camPos = center.clone().add(viewDir.multiplyScalar(cameraDist));

                    this.camera.position.copy(camPos);
                    this.camera.lookAt(center);

                    this.camera.near = cameraDist / 100;
                    this.camera.far = cameraDist * 100;
                    this.camera.updateProjectionMatrix();

                    this.renderer!.render(this.scene, this.camera);
                    const dataUrl = this.renderer!.domElement.toDataURL('image/png');

                    this.scene.remove(root);
                    URL.revokeObjectURL(url);

                    resolve(dataUrl);
                },
                undefined,
                (err) => {
                    console.error('Thumbnail generation failed:', err);
                    URL.revokeObjectURL(url);
                    resolve('');
                }
            );
        });
    }

    /**
     * Generate a thumbnail for a 3D model blob.
     * 
     * Tries Python backend first (better quality), falls back to Three.js.
     */
    async generate(blob: Blob): Promise<string> {
        try {
            const usePython = await this.checkPythonAvailable();

            if (usePython) {
                return await this.generateWithPython(blob);
            } else {
                return await this.generateWithThreeJS(blob);
            }
        } catch (e) {
            console.warn('[ThumbnailGen] Python failed, falling back to Three.js:', e);
            return await this.generateWithThreeJS(blob);
        }
    }

    /**
     * Force Python for next generation (for testing)
     */
    forcePython(): void {
        this.pythonAvailable = true;
    }

    /**
     * Force Three.js fallback (for testing)
     */
    forceThreeJS(): void {
        this.pythonAvailable = false;
    }
}

// Export singleton instance
export const ThumbnailGen = new ThumbnailGenerator();

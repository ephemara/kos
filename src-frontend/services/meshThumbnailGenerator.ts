/**
 * MeshThumbnailGenerator - Lightweight thumbnail generation for scene meshes
 * 
 * Used by KSculpt layer panel to show previews of each subtool/mesh.
 * Renders directly from THREE.Mesh objects (no file I/O needed).
 */

import * as THREE from 'three';

class MeshThumbnailGenerator {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer | null = null;
    private mainLight: THREE.DirectionalLight;
    private fillLight: THREE.HemisphereLight;
    private initialized: boolean = false;

    // Configuration
    private readonly FOV = 45;
    private readonly BG_COLOR = 0x1a1a1a;
    private readonly BG_ALPHA = 1;
    private readonly THUMB_SIZE = 64; // Small for layer panel

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(this.FOV, 1, 0.01, 1000);
        this.fillLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        this.mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    }

    private init(): void {
        if (this.initialized) return;

        // Create offscreen renderer
        this.renderer = new THREE.WebGLRenderer({
            alpha: false,
            antialias: true,
            preserveDrawingBuffer: true,
        });

        this.renderer.setSize(this.THUMB_SIZE, this.THUMB_SIZE);
        this.renderer.setClearColor(this.BG_COLOR, this.BG_ALPHA);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene.add(this.fillLight);
        this.scene.add(this.camera);
        this.camera.add(this.mainLight);
        this.mainLight.position.set(2, 2, 3);

        this.initialized = true;
    }

    /**
     * Generate a thumbnail for a THREE.Mesh
     * Returns a data URL (base64 PNG)
     */
    generateFromMesh(mesh: THREE.Mesh): string {
        this.init();
        if (!this.renderer) return '';

        try {
            // Clone the mesh to avoid modifying original
            const clone = mesh.clone();

            // Use a simple material for thumbnail (ignore complex shaders)
            const thumbMaterial = new THREE.MeshStandardMaterial({
                color: 0x888888,
                roughness: 0.6,
                metalness: 0.0,
            });
            clone.material = thumbMaterial;

            // Reset transform for consistent thumbnails
            clone.position.set(0, 0, 0);
            clone.rotation.set(0, 0, 0);
            clone.scale.set(1, 1, 1);
            clone.updateMatrixWorld(true);

            this.scene.add(clone);

            // Calculate bounds
            const box = new THREE.Box3().setFromObject(clone);
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            box.getCenter(center);
            box.getSize(size);

            const maxDim = Math.max(size.x, size.y, size.z);
            const objectRadius = maxDim / 2;

            // Position camera for 3/4 view
            const fovRad = (this.FOV * Math.PI) / 180;
            const cameraDist = (objectRadius / Math.sin(fovRad / 2)) * 1.5;

            const viewDir = new THREE.Vector3(1, 0.6, 1.2).normalize();
            const camPos = center.clone().add(viewDir.multiplyScalar(cameraDist));

            this.camera.position.copy(camPos);
            this.camera.lookAt(center);
            this.camera.near = cameraDist / 100;
            this.camera.far = cameraDist * 100;
            this.camera.updateProjectionMatrix();

            // Render
            this.renderer.render(this.scene, this.camera);
            const dataUrl = this.renderer.domElement.toDataURL('image/png');

            // Cleanup
            this.scene.remove(clone);
            clone.geometry.dispose();
            thumbMaterial.dispose();

            return dataUrl;
        } catch (e) {
            console.error('[MeshThumbnailGen] Failed:', e);
            return '';
        }
    }

    /**
     * Generate thumbnails for multiple meshes
     */
    generateBatch(meshes: Map<string, THREE.Mesh>): Map<string, string> {
        const thumbnails = new Map<string, string>();

        meshes.forEach((mesh, id) => {
            const thumb = this.generateFromMesh(mesh);
            if (thumb) {
                thumbnails.set(id, thumb);
            }
        });

        return thumbnails;
    }

    /**
     * Dispose renderer resources
     */
    dispose(): void {
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        this.initialized = false;
    }
}

// Export singleton
export const meshThumbnailGen = new MeshThumbnailGenerator();

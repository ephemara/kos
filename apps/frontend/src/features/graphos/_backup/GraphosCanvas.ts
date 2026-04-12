/**
 * GraphosCanvas - Core canvas manager for KGraphos
 * Handles WebGL rendering, layers, compositing, and transforms
 * Uses Three.js for GPU-accelerated rendering
 */

import * as THREE from 'three';
import { PaintEngine, PaintLayer } from '@/features/paint/engine/PaintSystem';
import { GraphosPainter, SplatPoint, BrushParams } from './GraphosPainter';

export interface GraphosCanvasConfig {
    width: number;
    height: number;
}

export interface Brush {
    size: number;
    opacity: number;
    hardness: number;
    color: string;
    spacing: number;
    jitterPos: number;
    jitterSize: number;
    jitterAngle: number;
    symmetry: 'NONE' | 'X' | 'Y' | 'RADIAL';
    erase: boolean;
    alphaMap?: THREE.Texture | null;
}

export class GraphosCanvas {
    // Core Three.js components
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private displayMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

    // Layer system
    private paintEngine: PaintEngine;
    private layers: PaintLayer[] = [];
    private compLayer: PaintLayer;
    private previewLayer: PaintLayer;

    // Painting
    private painter: GraphosPainter;
    private isStroking: boolean = false;

    // Transform
    private _zoom: number = 1.0;
    private _pan: THREE.Vector2 = new THREE.Vector2(0, 0);
    private canvas: HTMLCanvasElement;
    private viewport: HTMLElement;
    private config: GraphosCanvasConfig;

    // Observer
    private resizeObserver: ResizeObserver | null = null;

    // Loaded textures for material painting
    public loadedTextures: { albedo?: THREE.Texture; normal?: THREE.Texture; roughness?: THREE.Texture; metalness?: THREE.Texture; emission?: THREE.Texture } | null = null;

    // Dirty flag for animation loop
    public needsUpdate: boolean = false;

    constructor(canvas: HTMLCanvasElement, viewport: HTMLElement, config: GraphosCanvasConfig) {
        this.canvas = canvas;
        this.viewport = viewport;
        this.config = config;
        this.painter = new GraphosPainter();

        // Initialize WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: false,
            alpha: true,
            preserveDrawingBuffer: true,
            premultipliedAlpha: false
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(config.width, config.height, false);
        this.renderer.setClearColor(0x000000, 0);

        // Setup canvas transform
        canvas.style.transformOrigin = '0 0';

        // Scene & Camera
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 100);
        this.camera.position.z = 10;

        // Display mesh (shows the composited result)
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            side: THREE.DoubleSide
        });
        this.displayMesh = new THREE.Mesh(geo, mat);
        this.scene.add(this.displayMesh);

        // Paint Engine & Layers
        this.paintEngine = new PaintEngine(this.renderer);
        this.compLayer = new PaintLayer('comp', 'Composite', config.width, config.height);
        this.previewLayer = new PaintLayer('preview', 'Preview', config.width, config.height);

        // Setup resize observer
        this.resizeObserver = new ResizeObserver(() => this.fitToScreen());
        this.resizeObserver.observe(viewport);

        // Initial fit
        setTimeout(() => this.fitToScreen(), 50);
    }

    // ============ TRANSFORM ============

    get zoom(): number { return this._zoom; }
    get pan(): THREE.Vector2 { return this._pan; }

    setTransform(zoom: number, pan: THREE.Vector2): void {
        this._zoom = Math.max(0.01, Math.min(50, zoom));
        this._pan.copy(pan);
        this.canvas.style.transform = `translate(${this._pan.x}px, ${this._pan.y}px) scale(${this._zoom})`;
    }

    fitToScreen(): void {
        const pw = this.viewport.clientWidth;
        const ph = this.viewport.clientHeight;
        if (pw <= 0 || ph <= 0) return;

        const margin = 40;
        const scaleX = (pw - margin) / this.config.width;
        const scaleY = (ph - margin) / this.config.height;
        const newZoom = Math.min(scaleX, scaleY, 1.0);

        if (newZoom > 0 && isFinite(newZoom)) {
            const scaledW = this.config.width * newZoom;
            const scaledH = this.config.height * newZoom;
            const panX = (pw - scaledW) / 2;
            const panY = (ph - scaledH) / 2;
            this.setTransform(newZoom, new THREE.Vector2(panX, panY));
            this.render();
        }
    }

    // ============ LAYERS ============

    addLayer(id: string, name: string, initialColor?: number[]): PaintLayer {
        const layer = new PaintLayer(id, name, this.config.width, this.config.height);
        this.paintEngine.clearLayer(layer);
        if (initialColor) {
            this.paintEngine.fillLayer(layer, {
                albedo: initialColor,
                normal: [0.5, 0.5, 1, 0],
                roughness: [0, 0, 0, 0],
                metalness: [0, 0, 0, 0],
                emission: [0, 0, 0, 0]
            });
        }
        this.layers.push(layer);
        this.compose();
        return layer;
    }

    deleteLayer(id: string): void {
        const idx = this.layers.findIndex(l => l.id === id);
        if (idx !== -1) {
            this.layers[idx].dispose();
            this.layers.splice(idx, 1);
            this.compose();
        }
    }

    getLayer(id: string): PaintLayer | undefined {
        return this.layers.find(l => l.id === id);
    }

    getLayers(): PaintLayer[] {
        return this.layers;
    }

    // ============ COMPOSITING ============

    compose(): void {
        if (this.layers.length === 0) {
            this.displayMesh.material.map = null;
            this.displayMesh.material.needsUpdate = true;
            return;
        }

        this.paintEngine.compose(this.layers, this.compLayer);
        const tex = this.compLayer.getRead('albedo').texture;
        if (tex) {
            this.displayMesh.material.map = tex;
            this.displayMesh.material.needsUpdate = true;
        }
    }

    render(): void {
        this.renderer.render(this.scene, this.camera);
    }

    // ============ PAINTING ============

    startStroke(): void {
        this.painter.reset();
        this.paintEngine.clearLayer(this.previewLayer);
        this.isStroking = true;
    }

    continueStroke(u: number, v: number, pressure: number, brush: Brush, layerId: string): void {
        if (!this.isStroking) return;

        const layer = this.getLayer(layerId);
        if (!layer || !layer.visible) return;

        // Add point to painter
        this.painter.addPoint(u, v, pressure);

        // Generate splats
        const params: BrushParams = {
            size: brush.size,
            spacing: brush.spacing || 0.1,
            jitterPos: brush.jitterPos || 0,
            jitterSize: brush.jitterSize || 0,
            jitterAngle: brush.jitterAngle || 0,
            symmetry: brush.symmetry || 'NONE'
        };

        const splats = this.painter.generateSplats(params);

        // Paint each splat
        for (const splat of splats) {
            const splatBrush = {
                ...brush,
                size: splat.size,
                angle: splat.angle
            };

            const textures = this.loadedTextures || (brush.alphaMap ? { albedo: brush.alphaMap } : null);

            this.paintEngine.paint(
                new THREE.Vector2(splat.x, splat.y),
                splatBrush,
                layer,
                { albedo: true, normal: false, roughness: false, metalness: false, emission: false },
                this.displayMesh,
                textures
            );
        }

        this.compose();
        this.needsUpdate = true;
    }

    endStroke(layerId: string | null): void {
        this.isStroking = false;
        this.compose();
    }

    // ============ UTILITIES ============

    resize(width: number, height: number): void {
        this.config.width = width;
        this.config.height = height;
        this.renderer.setSize(width, height, false);
        this.fitToScreen();
    }

    exportImage(callback: (blob: Blob) => void, type: 'PNG' | 'JPEG' = 'PNG'): void {
        this.render();
        this.canvas.toBlob(
            (blob) => { if (blob) callback(blob); },
            type === 'PNG' ? 'image/png' : 'image/jpeg',
            0.95
        );
    }

    dispose(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.layers.forEach(l => l.dispose());
        this.compLayer.dispose();
        this.previewLayer.dispose();
        this.paintEngine.dispose();
        this.renderer.dispose();
    }

    // Expose paint engine for advanced operations (sims, filters, etc.)
    getPaintEngine(): PaintEngine {
        return this.paintEngine;
    }

    getRenderer(): THREE.WebGLRenderer {
        return this.renderer;
    }
}

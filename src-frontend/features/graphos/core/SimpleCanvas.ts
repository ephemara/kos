/**
 * SimpleCanvas - Enhanced 2D painting canvas with perfect-freehand strokes
 * and Three.js GPU simulations
 */

import * as THREE from 'three';
import getStroke from 'perfect-freehand';

export interface SimpleLayer {
    id: string;
    name: string;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    visible: boolean;
    opacity: number;
    blendMode: GlobalCompositeOperation;
    // WebGL texture for GPU operations
    texture?: THREE.Texture;
    renderTarget?: THREE.WebGLRenderTarget;
}

export interface SimpleBrush {
    size: number;
    opacity: number;
    hardness: number;
    color: string;
    spacing: number;
    erase: boolean;
    // Symmetry mode
    symmetry: 'OFF' | 'X' | 'Y' | 'RADIAL';
    radialSegments?: number; // For radial symmetry
}

export interface StrokePoint {
    x: number;
    y: number;
    pressure: number;
}

export type SelectionMode = 'replace' | 'add' | 'subtract' | 'intersect';

export interface SelectionBoundsUV {
    u0: number;
    v0: number;
    u1: number;
    v1: number;
}

interface LayerSnapshot {
    id: string;
    name: string;
    width: number;
    height: number;
    visible: boolean;
    opacity: number;
    blendMode: GlobalCompositeOperation;
    pixels: Uint8ClampedArray;
}

interface CanvasSnapshot {
    layers: LayerSnapshot[];
}

export class SimpleCanvas {
    private mainCanvas: HTMLCanvasElement;
    private mainCtx: CanvasRenderingContext2D;
    private layers: SimpleLayer[] = [];
    private width: number;
    private height: number;
    private viewport: HTMLElement;

    // Transform state
    private _zoom: number = 1.0;
    private _pan = { x: 0, y: 0 };

    // Stroke state
    private isStroking = false;
    private currentStroke: StrokePoint[] = [];
    private currentLayerId: string | null = null;
    private currentBrush: SimpleBrush | null = null;
    private selectionMask: Uint8Array;

    // WebGL for GPU simulations
    private renderer: THREE.WebGLRenderer | null = null;
    private simScene: THREE.Scene | null = null;
    private simCamera: THREE.OrthographicCamera | null = null;
    private simQuad: THREE.Mesh | null = null;

    // Resize observer
    private resizeObserver: ResizeObserver | null = null;
    // History
    private history: CanvasSnapshot[] = [];
    private historyIndex = -1;
    private readonly maxHistory = 64;

    constructor(canvas: HTMLCanvasElement, viewport: HTMLElement, width: number = 2048, height: number = 2048) {
        this.mainCanvas = canvas;
        this.viewport = viewport;
        this.width = width;
        this.height = height;
        this.selectionMask = new Uint8Array(width * height);

        // Set canvas size
        canvas.width = width;
        canvas.height = height;
        canvas.style.transformOrigin = '0 0';

        // Get 2D context
        const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false });
        if (!ctx) throw new Error('Failed to get 2D context');
        this.mainCtx = ctx;

        // Initial clear
        this.mainCtx.clearRect(0, 0, width, height);

        // Initialize WebGL for simulations
        this.initWebGL();

        // Setup resize observer
        this.resizeObserver = new ResizeObserver(() => this.fitToScreen());
        this.resizeObserver.observe(viewport);

        // Initial fit
        requestAnimationFrame(() => this.fitToScreen());
        this.pushHistory();
    }

    private initWebGL(): void {
        try {
            // Create offscreen canvas for WebGL
            const glCanvas = document.createElement('canvas');
            glCanvas.width = this.width;
            glCanvas.height = this.height;

            this.renderer = new THREE.WebGLRenderer({
                canvas: glCanvas,
                alpha: true,
                preserveDrawingBuffer: true,
                antialias: false
            });
            this.renderer.setSize(this.width, this.height);

            this.simScene = new THREE.Scene();
            this.simCamera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
            this.simCamera.position.z = 1;

            const geometry = new THREE.PlaneGeometry(1, 1);
            this.simQuad = new THREE.Mesh(geometry);
            this.simScene.add(this.simQuad);
        } catch (e) {
            console.warn('WebGL init failed for simulations:', e);
        }
    }

    // ========== TRANSFORM ==========

    get zoom(): number { return this._zoom; }
    get pan() { return this._pan; }

    setTransform(zoom: number, panX: number, panY: number): void {
        this._zoom = Math.max(0.05, Math.min(20, zoom));
        this._pan.x = panX;
        this._pan.y = panY;
        this.mainCanvas.style.transform = `translate(${this._pan.x}px, ${this._pan.y}px) scale(${this._zoom})`;
    }

    fitToScreen(): void {
        const vw = this.viewport.clientWidth;
        const vh = this.viewport.clientHeight;
        if (vw <= 0 || vh <= 0) return;

        const margin = 60;
        const scaleX = (vw - margin) / this.width;
        const scaleY = (vh - margin) / this.height;
        const newZoom = Math.min(scaleX, scaleY, 1.0);

        const scaledW = this.width * newZoom;
        const scaledH = this.height * newZoom;
        const panX = (vw - scaledW) / 2;
        const panY = (vh - scaledH) / 2;

        this.setTransform(newZoom, panX, panY);
    }

    // ========== LAYERS ==========

    addLayer(id: string, name: string, fillColor?: string): SimpleLayer {
        const offscreen = document.createElement('canvas');
        offscreen.width = this.width;
        offscreen.height = this.height;
        const ctx = offscreen.getContext('2d', { alpha: true })!;

        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.fillRect(0, 0, this.width, this.height);
        }

        // Create WebGL render target for GPU simulations
        let renderTarget: THREE.WebGLRenderTarget | undefined;
        if (this.renderer) {
            renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat
            });
        }

        const layer: SimpleLayer = {
            id,
            name,
            canvas: offscreen,
            ctx,
            visible: true,
            opacity: 1.0,
            blendMode: 'source-over',
            renderTarget
        };

        this.layers.push(layer);
        this.compose();
        this.pushHistory();
        return layer;
    }

    deleteLayer(id: string): void {
        const idx = this.layers.findIndex(l => l.id === id);
        if (idx !== -1) {
            const layer = this.layers[idx];
            layer.renderTarget?.dispose();
            this.layers.splice(idx, 1);
            this.compose();
            this.pushHistory();
        }
    }

    getLayer(id: string): SimpleLayer | undefined {
        return this.layers.find(l => l.id === id);
    }

    getLayers(): SimpleLayer[] {
        return this.layers;
    }

    // ========== COMPOSITING ==========

    compose(): void {
        this.mainCtx.clearRect(0, 0, this.width, this.height);
        this.drawCheckerboard();

        for (const layer of this.layers) {
            if (!layer.visible) continue;
            this.mainCtx.globalAlpha = layer.opacity;
            this.mainCtx.globalCompositeOperation = layer.blendMode || 'source-over';
            this.mainCtx.drawImage(layer.canvas, 0, 0);
        }
        this.mainCtx.globalAlpha = 1.0;
        this.mainCtx.globalCompositeOperation = 'source-over';
    }

    private drawCheckerboard(): void {
        const size = 20;
        const lightColor = '#2a2a2a';
        const darkColor = '#222222';

        for (let y = 0; y < this.height; y += size) {
            for (let x = 0; x < this.width; x += size) {
                const isLight = ((x / size) + (y / size)) % 2 === 0;
                this.mainCtx.fillStyle = isLight ? lightColor : darkColor;
                this.mainCtx.fillRect(x, y, size, size);
            }
        }
    }

    // ========== PAINTING with perfect-freehand ==========

    startStroke(): void {
        this.isStroking = true;
        this.currentStroke = [];
        this.pushHistory();
    }

    continueStroke(u: number, v: number, pressure: number, brush: SimpleBrush, layerId: string): void {
        if (!this.isStroking) return;

        const layer = this.getLayer(layerId);
        if (!layer || !layer.visible) return;

        // Store brush and layer for endStroke
        this.currentBrush = brush;
        this.currentLayerId = layerId;

        // Convert UV to pixel coordinates
        const x = u * this.width;
        const y = (1 - v) * this.height;

        // Add point to current stroke
        this.currentStroke.push({ x, y, pressure });

        // Render the stroke incrementally for immediate feedback
        this.renderStrokePreview(layer, brush);
    }

    private renderStrokePreview(layer: SimpleLayer, brush: SimpleBrush): void {
        if (this.currentStroke.length < 2) return;

        const ctx = layer.ctx;

        // Generate all symmetry versions of the stroke
        const strokes = this.generateSymmetricStrokes(this.currentStroke, brush);

        for (const stroke of strokes) {
            // Use perfect-freehand for smooth stroke outline
            const points = stroke.map(p => [p.x, p.y, p.pressure]);

            const outlinePoints = getStroke(points, {
                size: brush.size,
                thinning: 0.5,
                smoothing: 0.5,
                streamline: 0.5,
                easing: (t: number) => t,
                start: { cap: true, taper: 0, easing: (t: number) => t },
                end: { cap: true, taper: 0, easing: (t: number) => t }
            });

            if (outlinePoints.length === 0) continue;

            // Draw filled stroke
            ctx.save();

            if (brush.erase) {
                ctx.globalCompositeOperation = 'destination-out';
            } else {
                ctx.globalCompositeOperation = 'source-over';
            }

            ctx.globalAlpha = brush.opacity;
            ctx.fillStyle = brush.color;

            ctx.beginPath();
            const [firstX, firstY] = outlinePoints[0];
            ctx.moveTo(firstX, firstY);

            for (let i = 1; i < outlinePoints.length; i++) {
                const [px, py] = outlinePoints[i];
                ctx.lineTo(px, py);
            }

            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        this.compose();
    }

    private generateSymmetricStrokes(stroke: StrokePoint[], brush: SimpleBrush): StrokePoint[][] {
        const strokes: StrokePoint[][] = [stroke];
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        if (brush.symmetry === 'X' || brush.symmetry === 'RADIAL') {
            // Mirror across X axis (vertical symmetry)
            const mirrored = stroke.map(p => ({
                x: this.width - p.x,
                y: p.y,
                pressure: p.pressure
            }));
            strokes.push(mirrored);
        }

        if (brush.symmetry === 'Y' || brush.symmetry === 'RADIAL') {
            // Mirror across Y axis (horizontal symmetry)
            const mirrored = stroke.map(p => ({
                x: p.x,
                y: this.height - p.y,
                pressure: p.pressure
            }));
            strokes.push(mirrored);
        }

        if (brush.symmetry === 'RADIAL') {
            // Add diagonal mirror (both axes)
            const diagonal = stroke.map(p => ({
                x: this.width - p.x,
                y: this.height - p.y,
                pressure: p.pressure
            }));
            strokes.push(diagonal);

            // Add more radial segments if specified
            const segments = brush.radialSegments || 8;
            if (segments > 4) {
                for (let i = 1; i < segments / 2; i++) {
                    const angle = (Math.PI * 2 * i) / segments;
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);

                    const rotated = stroke.map(p => {
                        const dx = p.x - centerX;
                        const dy = p.y - centerY;
                        return {
                            x: centerX + dx * cos - dy * sin,
                            y: centerY + dx * sin + dy * cos,
                            pressure: p.pressure
                        };
                    });
                    strokes.push(rotated);

                    // Also add the X-mirrored version
                    const rotatedMirrored = rotated.map(p => ({
                        x: this.width - p.x,
                        y: p.y,
                        pressure: p.pressure
                    }));
                    strokes.push(rotatedMirrored);
                }
            }
        }

        return strokes;
    }

    endStroke(layerId?: string): void {
        this.isStroking = false;
        this.currentStroke = [];
        this.currentBrush = null;
        this.currentLayerId = null;
        this.pushHistory();
    }

    // ========== GPU SIMULATIONS ==========

    applySimulation(layerId: string, shaderMaterial: THREE.ShaderMaterial): void {
        if (!this.renderer || !this.simScene || !this.simCamera || !this.simQuad) {
            console.warn('WebGL not available for simulations');
            return;
        }

        const layer = this.getLayer(layerId);
        if (!layer) return;

        // Create texture from layer canvas
        const inputTexture = new THREE.CanvasTexture(layer.canvas);
        inputTexture.minFilter = THREE.LinearFilter;
        inputTexture.magFilter = THREE.LinearFilter;

        // Set input texture in shader
        if (shaderMaterial.uniforms.tInput) {
            shaderMaterial.uniforms.tInput.value = inputTexture;
        }
        if (shaderMaterial.uniforms.uResolution) {
            shaderMaterial.uniforms.uResolution.value.set(this.width, this.height);
        }

        this.simQuad.material = shaderMaterial;

        // Create render target
        const renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        });

        // Render to target
        this.renderer.setRenderTarget(renderTarget);
        this.renderer.render(this.simScene, this.simCamera);
        this.renderer.setRenderTarget(null);

        // Read pixels back to layer canvas
        const pixels = new Uint8Array(this.width * this.height * 4);
        this.renderer.readRenderTargetPixels(renderTarget, 0, 0, this.width, this.height, pixels);

        // Create ImageData and put it on the layer
        const imageData = new ImageData(new Uint8ClampedArray(pixels), this.width, this.height);

        // Flip Y (WebGL is bottom-up, Canvas is top-down)
        const flippedData = this.flipImageDataY(imageData);
        layer.ctx.putImageData(flippedData, 0, 0);

        // Cleanup
        inputTexture.dispose();
        renderTarget.dispose();

        this.compose();
    }

    private flipImageDataY(imageData: ImageData): ImageData {
        const { width, height, data } = imageData;
        const flipped = new Uint8ClampedArray(data.length);
        const rowSize = width * 4;

        for (let y = 0; y < height; y++) {
            const srcRow = y * rowSize;
            const dstRow = (height - 1 - y) * rowSize;
            for (let x = 0; x < rowSize; x++) {
                flipped[dstRow + x] = data[srcRow + x];
            }
        }

        return new ImageData(flipped, width, height);
    }

    // ========== UTILITIES ==========

    clear(layerId: string): void {
        const layer = this.getLayer(layerId);
        if (layer) {
            layer.ctx.clearRect(0, 0, this.width, this.height);
            this.compose();
            this.pushHistory();
        }
    }

    fill(layerId: string, color: string): void {
        const layer = this.getLayer(layerId);
        if (layer) {
            layer.ctx.fillStyle = color;
            layer.ctx.fillRect(0, 0, this.width, this.height);
            this.compose();
            this.pushHistory();
        }
    }

    clearSelection(): void {
        this.selectionMask.fill(0);
        this.pushHistory();
    }

    selectMarquee(layerId: string, u0: number, v0: number, u1: number, v1: number, mode: SelectionMode = 'replace'): void {
        const layer = this.getLayer(layerId);
        if (!layer) return;
        const next = new Uint8Array(this.width * this.height);
        const minX = Math.max(0, Math.floor(Math.min(u0, u1) * this.width));
        const maxX = Math.min(this.width - 1, Math.ceil(Math.max(u0, u1) * this.width));
        const minY = Math.max(0, Math.floor((1 - Math.max(v0, v1)) * this.height));
        const maxY = Math.min(this.height - 1, Math.ceil((1 - Math.min(v0, v1)) * this.height));

        for (let y = minY; y <= maxY; y++) {
            const row = y * this.width;
            for (let x = minX; x <= maxX; x++) next[row + x] = 1;
        }
        this.applySelectionMask(next, mode);
        this.pushHistory();
    }

    selectLasso(layerId: string, pointsUV: Array<{ u: number; v: number }>, mode: SelectionMode = 'replace'): void {
        const layer = this.getLayer(layerId);
        if (!layer || pointsUV.length < 3) return;

        const pts = pointsUV.map(p => ({
            x: Math.max(0, Math.min(this.width - 1, p.u * this.width)),
            y: Math.max(0, Math.min(this.height - 1, (1 - p.v) * this.height)),
        }));
        const next = new Uint8Array(this.width * this.height);

        let minX = this.width - 1;
        let maxX = 0;
        let minY = this.height - 1;
        let maxY = 0;
        for (const p of pts) {
            minX = Math.min(minX, Math.floor(p.x));
            maxX = Math.max(maxX, Math.ceil(p.x));
            minY = Math.min(minY, Math.floor(p.y));
            maxY = Math.max(maxY, Math.ceil(p.y));
        }
        minX = Math.max(0, minX);
        minY = Math.max(0, minY);
        maxX = Math.min(this.width - 1, maxX);
        maxY = Math.min(this.height - 1, maxY);

        for (let y = minY; y <= maxY; y++) {
            const row = y * this.width;
            for (let x = minX; x <= maxX; x++) {
                if (this.pointInPolygon(x + 0.5, y + 0.5, pts)) next[row + x] = 1;
            }
        }
        this.applySelectionMask(next, mode);
        this.pushHistory();
    }

    selectMagicWand(layerId: string, u: number, v: number, tolerance = 24, mode: SelectionMode = 'replace'): void {
        const layer = this.getLayer(layerId);
        if (!layer) return;

        const x0 = Math.max(0, Math.min(this.width - 1, Math.floor(u * this.width)));
        const y0 = Math.max(0, Math.min(this.height - 1, Math.floor((1 - v) * this.height)));
        const imageData = layer.ctx.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;
        const next = new Uint8Array(this.width * this.height);
        const startIdx = (y0 * this.width + x0) * 4;
        const sr = data[startIdx];
        const sg = data[startIdx + 1];
        const sb = data[startIdx + 2];
        const sa = data[startIdx + 3];
        const tolSq = tolerance * tolerance * 3;
        const visited = new Uint8Array(this.width * this.height);
        const queue = new Int32Array(this.width * this.height);
        let head = 0;
        let tail = 0;
        queue[tail++] = y0 * this.width + x0;
        visited[y0 * this.width + x0] = 1;

        while (head < tail) {
            const idx = queue[head++];
            const px = idx % this.width;
            const py = (idx / this.width) | 0;
            const i4 = idx * 4;
            const dr = data[i4] - sr;
            const dg = data[i4 + 1] - sg;
            const db = data[i4 + 2] - sb;
            const da = data[i4 + 3] - sa;
            const distSq = dr * dr + dg * dg + db * db + da * da * 0.35;
            if (distSq > tolSq) continue;
            next[idx] = 1;

            if (px > 0) tail = this.pushPixel(px - 1, py, visited, queue, tail);
            if (px < this.width - 1) tail = this.pushPixel(px + 1, py, visited, queue, tail);
            if (py > 0) tail = this.pushPixel(px, py - 1, visited, queue, tail);
            if (py < this.height - 1) tail = this.pushPixel(px, py + 1, visited, queue, tail);
        }

        this.applySelectionMask(next, mode);
        this.pushHistory();
    }

    getSelectionBoundsUV(): SelectionBoundsUV | null {
        let minX = this.width;
        let minY = this.height;
        let maxX = -1;
        let maxY = -1;
        const N = this.width * this.height;
        for (let i = 0; i < N; i++) {
            if (this.selectionMask[i] === 0) continue;
            const x = i % this.width;
            const y = (i / this.width) | 0;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
        if (maxX < minX || maxY < minY) return null;
        return {
            u0: minX / this.width,
            v0: 1 - (maxY + 1) / this.height,
            u1: (maxX + 1) / this.width,
            v1: 1 - minY / this.height,
        };
    }

    hasSelection(): boolean {
        for (let i = 0; i < this.selectionMask.length; i++) {
            if (this.selectionMask[i] !== 0) return true;
        }
        return false;
    }

    private applySelectionMask(next: Uint8Array, mode: SelectionMode): void {
        const N = this.selectionMask.length;
        if (mode === 'replace') {
            this.selectionMask.set(next);
            return;
        }
        if (mode === 'add') {
            for (let i = 0; i < N; i++) this.selectionMask[i] = this.selectionMask[i] || next[i] ? 1 : 0;
            return;
        }
        if (mode === 'subtract') {
            for (let i = 0; i < N; i++) this.selectionMask[i] = this.selectionMask[i] && !next[i] ? 1 : 0;
            return;
        }
        for (let i = 0; i < N; i++) this.selectionMask[i] = this.selectionMask[i] && next[i] ? 1 : 0;
    }

    private pointInPolygon(x: number, y: number, pts: Array<{ x: number; y: number }>): boolean {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i].x, yi = pts[i].y;
            const xj = pts[j].x, yj = pts[j].y;
            const intersects = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-8) + xi);
            if (intersects) inside = !inside;
        }
        return inside;
    }

    private pushPixel(
        x: number,
        y: number,
        visited: Uint8Array,
        queue: Int32Array,
        tail: number
    ): number {
        const idx = y * this.width + x;
        if (visited[idx]) return tail;
        visited[idx] = 1;
        queue[tail] = idx;
        return tail + 1;
    }

    setLayerBlendMode(layerId: string, blendMode: GlobalCompositeOperation): void {
        const layer = this.getLayer(layerId);
        if (!layer) return;
        layer.blendMode = blendMode;
        this.compose();
        this.pushHistory();
    }

    undo(): boolean {
        if (this.historyIndex <= 0) return false;
        this.historyIndex -= 1;
        this.restoreSnapshot(this.history[this.historyIndex]);
        return true;
    }

    redo(): boolean {
        if (this.historyIndex >= this.history.length - 1) return false;
        this.historyIndex += 1;
        this.restoreSnapshot(this.history[this.historyIndex]);
        return true;
    }

    canUndo(): boolean {
        return this.historyIndex > 0;
    }

    canRedo(): boolean {
        return this.historyIndex >= 0 && this.historyIndex < this.history.length - 1;
    }

    resize(newWidth: number, newHeight: number): void {
        this.width = newWidth;
        this.height = newHeight;
        this.selectionMask = new Uint8Array(newWidth * newHeight);
        this.mainCanvas.width = newWidth;
        this.mainCanvas.height = newHeight;

        for (const layer of this.layers) {
            const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
            layer.canvas.width = newWidth;
            layer.canvas.height = newHeight;
            layer.ctx.putImageData(imageData, 0, 0);
        }

        if (this.renderer) {
            this.renderer.setSize(newWidth, newHeight);
        }

        this.compose();
        this.fitToScreen();
        this.pushHistory();
    }

    exportImage(callback: (blob: Blob) => void, type: 'PNG' | 'JPEG' = 'PNG'): void {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.width;
        exportCanvas.height = this.height;
        const ctx = exportCanvas.getContext('2d')!;

        for (const layer of this.layers) {
            if (!layer.visible) continue;
            ctx.globalAlpha = layer.opacity;
            ctx.globalCompositeOperation = layer.blendMode || 'source-over';
            ctx.drawImage(layer.canvas, 0, 0);
        }
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';

        exportCanvas.toBlob(
            (blob) => { if (blob) callback(blob); },
            type === 'PNG' ? 'image/png' : 'image/jpeg',
            0.95
        );
    }

    dispose(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        for (const layer of this.layers) {
            layer.renderTarget?.dispose();
        }
        this.renderer?.dispose();
        this.layers = [];
        this.history = [];
        this.historyIndex = -1;
    }

    // ========== GETTERS ==========

    getWidth(): number { return this.width; }
    getHeight(): number { return this.height; }
    getCanvas(): HTMLCanvasElement { return this.mainCanvas; }
    getRenderer(): THREE.WebGLRenderer | null { return this.renderer; }

    private pushHistory(): void {
        const snap = this.captureSnapshot();
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(snap);
        if (this.history.length > this.maxHistory) this.history.shift();
        this.historyIndex = this.history.length - 1;
    }

    private captureSnapshot(): CanvasSnapshot {
        return {
            layers: this.layers.map((l) => ({
                id: l.id,
                name: l.name,
                width: l.canvas.width,
                height: l.canvas.height,
                visible: l.visible,
                opacity: l.opacity,
                blendMode: l.blendMode || 'source-over',
                pixels: new Uint8ClampedArray(
                    l.ctx.getImageData(0, 0, l.canvas.width, l.canvas.height).data
                ),
            })),
        };
    }

    private restoreSnapshot(snap: CanvasSnapshot): void {
        const byId = new Map(this.layers.map((l) => [l.id, l] as const));
        this.layers = [];
        for (const layerSnap of snap.layers) {
            let layer = byId.get(layerSnap.id);
            if (!layer) {
                const offscreen = document.createElement('canvas');
                offscreen.width = layerSnap.width;
                offscreen.height = layerSnap.height;
                const ctx = offscreen.getContext('2d', { alpha: true })!;
                layer = {
                    id: layerSnap.id,
                    name: layerSnap.name,
                    canvas: offscreen,
                    ctx,
                    visible: true,
                    opacity: 1,
                    blendMode: 'source-over',
                };
            }
            if (layer.canvas.width !== layerSnap.width || layer.canvas.height !== layerSnap.height) {
                layer.canvas.width = layerSnap.width;
                layer.canvas.height = layerSnap.height;
            }
            layer.ctx.putImageData(
                new ImageData(new Uint8ClampedArray(layerSnap.pixels), layerSnap.width, layerSnap.height),
                0,
                0
            );
            layer.visible = layerSnap.visible;
            layer.opacity = layerSnap.opacity;
            layer.blendMode = layerSnap.blendMode;
            layer.name = layerSnap.name;
            this.layers.push(layer);
        }
        this.compose();
    }
}

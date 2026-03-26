/**
 * K-INSPECT WEBGPU PATH TRACER
 * 
 * A native WebGPU path tracer for photorealistic preview rendering.
 * Uses compute shaders for ray tracing with progressive accumulation.
 */

import * as THREE from 'three';

export interface PathTracerConfig {
    maxBounces: number;
    samplesPerFrame: number;
    tileSize: number;
}

const DEFAULT_CONFIG: PathTracerConfig = {
    maxBounces: 4,
    samplesPerFrame: 1,
    tileSize: 8
};

export class WebGPUPathTracer {
    private device: GPUDevice | null = null;
    private context: GPUCanvasContext | null = null;
    private config: PathTracerConfig;

    // Buffers
    private accumulationBuffer: GPUBuffer | null = null;
    private uniformBuffer: GPUBuffer | null = null;
    private vertexBuffer: GPUBuffer | null = null;
    private indexBuffer: GPUBuffer | null = null;
    private bvhBuffer: GPUBuffer | null = null;
    private materialBuffer: GPUBuffer | null = null;

    // Pipeline
    private pipeline: GPUComputePipeline | null = null;
    private blitPipeline: GPURenderPipeline | null = null;
    private bindGroup: GPUBindGroup | null = null;

    // State
    private width: number = 0;
    private height: number = 0;
    private sampleCount: number = 0;
    private isReady: boolean = false;
    private sceneBuilt: boolean = false;

    constructor(config: Partial<PathTracerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
        if (!navigator.gpu) {
            console.warn('[WebGPU PT] WebGPU not available in this browser');
            return false;
        }

        try {
            const adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance'
            });
            if (!adapter) {
                console.warn('[WebGPU PT] No GPU adapter found');
                return false;
            }

            this.device = await adapter.requestDevice({
                requiredFeatures: [],
                requiredLimits: {
                    maxStorageBufferBindingSize: 256 * 1024 * 1024, // 256MB
                    maxBufferSize: 256 * 1024 * 1024
                }
            });

            this.context = canvas.getContext('webgpu') as GPUCanvasContext;
            if (!this.context) {
                console.warn('[WebGPU PT] Failed to get WebGPU context');
                return false;
            }

            const format = navigator.gpu.getPreferredCanvasFormat();
            this.context.configure({
                device: this.device,
                format,
                alphaMode: 'opaque'
            });

            this.width = canvas.width;
            this.height = canvas.height;

            await this.createPipelines();
            this.createBuffers();

            this.isReady = true;
            console.log('[WebGPU PT] Initialized successfully');
            return true;
        } catch (e) {
            console.error('[WebGPU PT] Initialization failed:', e);
            return false;
        }
    }

    private async createPipelines(): Promise<void> {
        if (!this.device) return;

        // Path tracing compute shader
        const ptShaderModule = this.device.createShaderModule({
            label: 'Path Tracer Compute',
            code: this.getPathTracerShader()
        });

        this.pipeline = this.device.createComputePipeline({
            label: 'Path Tracer Pipeline',
            layout: 'auto',
            compute: {
                module: ptShaderModule,
                entryPoint: 'main'
            }
        });

        // Blit shader for displaying result
        const blitShaderModule = this.device.createShaderModule({
            label: 'Blit Shader',
            code: this.getBlitShader()
        });

        this.blitPipeline = this.device.createRenderPipeline({
            label: 'Blit Pipeline',
            layout: 'auto',
            vertex: {
                module: blitShaderModule,
                entryPoint: 'vs_main'
            },
            fragment: {
                module: blitShaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: navigator.gpu.getPreferredCanvasFormat()
                }]
            },
            primitive: {
                topology: 'triangle-strip'
            }
        });
    }

    private createBuffers(): void {
        if (!this.device) return;

        // Accumulation buffer (RGBA float per pixel)
        const pixelCount = this.width * this.height;
        this.accumulationBuffer = this.device.createBuffer({
            label: 'Accumulation Buffer',
            size: pixelCount * 4 * 4, // 4 floats per pixel
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        // Uniform buffer
        this.uniformBuffer = this.device.createBuffer({
            label: 'Uniforms',
            size: 256, // Generous size for uniforms
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
    }

    async setScene(scene: THREE.Scene, camera: THREE.PerspectiveCamera): Promise<void> {
        if (!this.device) return;

        console.log('[WebGPU PT] Building scene...');

        // Extract geometry from scene
        const vertices: number[] = [];
        const indices: number[] = [];
        const materials: number[] = [];
        let indexOffset = 0;

        scene.traverse((object) => {
            if (object instanceof THREE.Mesh && object.geometry) {
                const geo = object.geometry;
                const posAttr = geo.attributes.position;

                // Transform vertices to world space
                const matrix = object.matrixWorld;
                const v = new THREE.Vector3();

                for (let i = 0; i < posAttr.count; i++) {
                    v.fromBufferAttribute(posAttr, i);
                    v.applyMatrix4(matrix);
                    vertices.push(v.x, v.y, v.z);
                }

                // Handle indices
                if (geo.index) {
                    for (let i = 0; i < geo.index.count; i++) {
                        indices.push(geo.index.getX(i) + indexOffset);
                    }
                } else {
                    for (let i = 0; i < posAttr.count; i++) {
                        indices.push(i + indexOffset);
                    }
                }

                // Extract material color
                const mat = object.material as THREE.MeshStandardMaterial;
                const color = mat?.color || new THREE.Color(0.8, 0.8, 0.8);
                const roughness = mat?.roughness ?? 0.5;
                const metalness = mat?.metalness ?? 0.0;

                // One material entry per triangle
                const triCount = geo.index ? geo.index.count / 3 : posAttr.count / 3;
                for (let i = 0; i < triCount; i++) {
                    materials.push(color.r, color.g, color.b, roughness, metalness, 0, 0, 0);
                }

                indexOffset += posAttr.count;
            }
        });

        if (vertices.length === 0) {
            console.warn('[WebGPU PT] No geometry found in scene');
            return;
        }

        // Create GPU buffers
        this.vertexBuffer?.destroy();
        this.indexBuffer?.destroy();
        this.materialBuffer?.destroy();

        this.vertexBuffer = this.device.createBuffer({
            label: 'Vertices',
            size: Math.max(16, vertices.length * 4),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();

        this.indexBuffer = this.device.createBuffer({
            label: 'Indices',
            size: Math.max(16, indices.length * 4),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint32Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();

        this.materialBuffer = this.device.createBuffer({
            label: 'Materials',
            size: Math.max(16, materials.length * 4),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.materialBuffer.getMappedRange()).set(materials);
        this.materialBuffer.unmap();

        // Update bind group
        this.updateBindGroup(camera);

        this.sampleCount = 0;
        this.sceneBuilt = true;
        console.log(`[WebGPU PT] Scene built: ${vertices.length / 3} vertices, ${indices.length / 3} triangles`);
    }

    private updateBindGroup(camera: THREE.PerspectiveCamera): void {
        if (!this.device || !this.pipeline || !this.accumulationBuffer ||
            !this.uniformBuffer || !this.vertexBuffer || !this.indexBuffer || !this.materialBuffer) return;

        // Update uniform data
        const uniformData = new Float32Array([
            this.width, this.height, this.sampleCount, this.config.maxBounces,
            camera.position.x, camera.position.y, camera.position.z, camera.fov,
            // Camera forward direction
            ...camera.getWorldDirection(new THREE.Vector3()).toArray(), 0,
            // Camera up
            ...camera.up.toArray(), 0,
            // Random seed
            Math.random(), Math.random(), Math.random(), Math.random()
        ]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

        this.bindGroup = this.device.createBindGroup({
            label: 'Path Tracer Bind Group',
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.accumulationBuffer } },
                { binding: 2, resource: { buffer: this.vertexBuffer } },
                { binding: 3, resource: { buffer: this.indexBuffer } },
                { binding: 4, resource: { buffer: this.materialBuffer } }
            ]
        });
    }

    renderSample(camera: THREE.PerspectiveCamera): void {
        if (!this.isReady || !this.sceneBuilt || !this.device || !this.context ||
            !this.pipeline || !this.blitPipeline || !this.bindGroup || !this.accumulationBuffer) return;

        // Update uniforms with new sample count and camera
        this.updateBindGroup(camera);

        const encoder = this.device.createCommandEncoder();

        // Compute pass - path trace
        const computePass = encoder.beginComputePass();
        computePass.setPipeline(this.pipeline);
        computePass.setBindGroup(0, this.bindGroup);
        computePass.dispatchWorkgroups(
            Math.ceil(this.width / this.config.tileSize),
            Math.ceil(this.height / this.config.tileSize)
        );
        computePass.end();

        // TODO: Blit to screen (simplified for now - just runs compute)

        this.device.queue.submit([encoder.finish()]);
        this.sampleCount++;
    }

    reset(): void {
        this.sampleCount = 0;
        // Clear accumulation buffer
        if (this.device && this.accumulationBuffer) {
            const zeros = new Float32Array(this.width * this.height * 4);
            this.device.queue.writeBuffer(this.accumulationBuffer, 0, zeros);
        }
    }

    getSampleCount(): number {
        return this.sampleCount;
    }

    dispose(): void {
        this.accumulationBuffer?.destroy();
        this.uniformBuffer?.destroy();
        this.vertexBuffer?.destroy();
        this.indexBuffer?.destroy();
        this.bvhBuffer?.destroy();
        this.materialBuffer?.destroy();
        this.device = null;
        this.context = null;
        this.isReady = false;
    }

    // ========== SHADERS ==========

    private getPathTracerShader(): string {
        return `
            struct Uniforms {
                width: f32,
                height: f32,
                sampleIndex: f32,
                maxBounces: f32,
                camPosX: f32,
                camPosY: f32,
                camPosZ: f32,
                fov: f32,
                camDirX: f32,
                camDirY: f32,
                camDirZ: f32,
                pad0: f32,
                camUpX: f32,
                camUpY: f32,
                camUpZ: f32,
                pad1: f32,
                seed0: f32,
                seed1: f32,
                seed2: f32,
                seed3: f32,
            }

            @group(0) @binding(0) var<uniform> uniforms: Uniforms;
            @group(0) @binding(1) var<storage, read_write> accumulation: array<vec4f>;
            @group(0) @binding(2) var<storage, read> vertices: array<f32>;
            @group(0) @binding(3) var<storage, read> indices: array<u32>;
            @group(0) @binding(4) var<storage, read> materials: array<f32>;

            fn rand(seed: ptr<function, u32>) -> f32 {
                *seed = *seed * 747796405u + 2891336453u;
                let result = ((*seed >> ((*seed >> 28u) + 4u)) ^ *seed) * 277803737u;
                return f32((result >> 22u) ^ result) / 4294967295.0;
            }

            fn rayTriangleIntersect(
                ro: vec3f, rd: vec3f,
                v0: vec3f, v1: vec3f, v2: vec3f
            ) -> f32 {
                let e1 = v1 - v0;
                let e2 = v2 - v0;
                let h = cross(rd, e2);
                let a = dot(e1, h);
                if (abs(a) < 0.0001) { return -1.0; }
                let f = 1.0 / a;
                let s = ro - v0;
                let u = f * dot(s, h);
                if (u < 0.0 || u > 1.0) { return -1.0; }
                let q = cross(s, e1);
                let v = f * dot(rd, q);
                if (v < 0.0 || u + v > 1.0) { return -1.0; }
                let t = f * dot(e2, q);
                if (t > 0.0001) { return t; }
                return -1.0;
            }

            @compute @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) gid: vec3u) {
                let x = gid.x;
                let y = gid.y;
                let w = u32(uniforms.width);
                let h = u32(uniforms.height);
                
                if (x >= w || y >= h) { return; }

                let idx = y * w + x;
                var seed = idx + u32(uniforms.sampleIndex * 1000.0);

                // Generate camera ray
                let camPos = vec3f(uniforms.camPosX, uniforms.camPosY, uniforms.camPosZ);
                let camDir = normalize(vec3f(uniforms.camDirX, uniforms.camDirY, uniforms.camDirZ));
                let camUp = normalize(vec3f(uniforms.camUpX, uniforms.camUpY, uniforms.camUpZ));
                let camRight = normalize(cross(camDir, camUp));
                
                let aspect = uniforms.width / uniforms.height;
                let fovRad = uniforms.fov * 3.14159 / 180.0;
                let halfH = tan(fovRad * 0.5);
                let halfW = halfH * aspect;
                
                let u = (f32(x) + rand(&seed)) / uniforms.width * 2.0 - 1.0;
                let v = (f32(y) + rand(&seed)) / uniforms.height * 2.0 - 1.0;
                
                let rd = normalize(camDir + camRight * u * halfW + camUp * v * halfH);
                var ro = camPos;

                // Simple ray trace
                var color = vec3f(0.0);
                var throughput = vec3f(1.0);
                let triCount = arrayLength(&indices) / 3u;

                for (var bounce = 0u; bounce < u32(uniforms.maxBounces); bounce++) {
                    var closestT = 1e30;
                    var hitTriIdx = -1;
                    var hitNormal = vec3f(0.0);

                    // Brute force intersection (BVH would be faster)
                    for (var t = 0u; t < triCount; t++) {
                        let i0 = indices[t * 3u + 0u];
                        let i1 = indices[t * 3u + 1u];
                        let i2 = indices[t * 3u + 2u];
                        
                        let v0 = vec3f(vertices[i0 * 3u], vertices[i0 * 3u + 1u], vertices[i0 * 3u + 2u]);
                        let v1 = vec3f(vertices[i1 * 3u], vertices[i1 * 3u + 1u], vertices[i1 * 3u + 2u]);
                        let v2 = vec3f(vertices[i2 * 3u], vertices[i2 * 3u + 1u], vertices[i2 * 3u + 2u]);
                        
                        let tHit = rayTriangleIntersect(ro, rd, v0, v1, v2);
                        if (tHit > 0.0 && tHit < closestT) {
                            closestT = tHit;
                            hitTriIdx = i32(t);
                            hitNormal = normalize(cross(v1 - v0, v2 - v0));
                        }
                    }

                    if (hitTriIdx < 0) {
                        // Sky
                        let skyColor = mix(vec3f(0.8, 0.9, 1.0), vec3f(0.2, 0.4, 0.8), rd.y * 0.5 + 0.5);
                        color += throughput * skyColor;
                        break;
                    }

                    // Get material
                    let matBase = u32(hitTriIdx) * 8u;
                    let albedo = vec3f(materials[matBase], materials[matBase + 1u], materials[matBase + 2u]);
                    let roughness = materials[matBase + 3u];

                    // Flip normal if backface
                    if (dot(hitNormal, rd) > 0.0) { hitNormal = -hitNormal; }

                    // Diffuse bounce
                    ro = ro + rd * closestT + hitNormal * 0.001;
                    
                    // Cosine-weighted hemisphere sampling
                    let r1 = rand(&seed);
                    let r2 = rand(&seed);
                    let phi = 2.0 * 3.14159 * r1;
                    let cosTheta = sqrt(1.0 - r2);
                    let sinTheta = sqrt(r2);
                    
                    let w = hitNormal;
                    let tangent = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(w.y) < 0.999);
                    let u_vec = normalize(cross(tangent, w));
                    let v_vec = cross(w, u_vec);
                    
                    rd = normalize(u_vec * cos(phi) * sinTheta + v_vec * sin(phi) * sinTheta + w * cosTheta);
                    throughput *= albedo;
                    
                    // Russian roulette
                    if (bounce > 2u) {
                        let p = max(throughput.x, max(throughput.y, throughput.z));
                        if (rand(&seed) > p) { break; }
                        throughput /= p;
                    }
                }

                // Accumulate
                let prev = accumulation[idx].xyz;
                let n = uniforms.sampleIndex;
                let newColor = mix(prev, color, 1.0 / (n + 1.0));
                accumulation[idx] = vec4f(newColor, 1.0);
            }
        `;
    }

    private getBlitShader(): string {
        return `
            @vertex
            fn vs_main(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4f {
                var pos = array<vec2f, 4>(
                    vec2f(-1.0, -1.0),
                    vec2f(1.0, -1.0),
                    vec2f(-1.0, 1.0),
                    vec2f(1.0, 1.0)
                );
                return vec4f(pos[idx], 0.0, 1.0);
            }

            @fragment
            fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
                return vec4f(1.0, 0.0, 1.0, 1.0); // Placeholder
            }
        `;
    }
}

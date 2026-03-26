// @ts-nocheck
/**
 * WebGPU HyperFluid Engine - Native WGSL Compute
 * Production-grade CFD with full GPU acceleration
 * Based on FluidDynamics.kn - UE5-level fluid simulation
 */

import { FluidClass, SolverFamily } from './fluid';

export interface HyperFluidConfig {
    resolution: [number, number, number];
    fluidClass: FluidClass;
    solverFamily: SolverFamily;
    viscosity: number;
    density: number;
    surfaceTension: number;
    temperature: number;
    buoyancyAlpha: number;
    buoyancyBeta: number;
    vorticityConfinement: number;
    dt: number;
    substeps: number;
    pressureIterations: number;
}

export const DEFAULT_CONFIG: HyperFluidConfig = {
    resolution: [64, 64, 64],
    fluidClass: FluidClass.Smoke(),
    solverFamily: SolverFamily.NavierStokesIncompressible(),
    viscosity: 0.001,
    density: 1.0,
    surfaceTension: 0.0,
    temperature: 293.0,
    buoyancyAlpha: 0.1,
    buoyancyBeta: 2.0,
    vorticityConfinement: 1.0,
    dt: 0.016,
    substeps: 1,
    pressureIterations: 40,
};

interface GPUResources {
    device: GPUDevice;
    
    // Textures
    velocityTexture: GPUTexture;
    velocityTextureB: GPUTexture;
    densityTexture: GPUTexture;
    densityTextureB: GPUTexture;
    temperatureTexture: GPUTexture;
    temperatureTextureB: GPUTexture;
    pressureTexture: GPUTexture;
    pressureTextureB: GPUTexture;
    divergenceTexture: GPUTexture;
    
    // Buffers
    physicsBuffer: GPUBuffer;
    thermalBuffer: GPUBuffer;
    timeBuffer: GPUBuffer;
    
    // Pipelines
    advectVelocityPipeline: GPUComputePipeline;
    advectDensityPipeline: GPUComputePipeline;
    advectTemperaturePipeline: GPUComputePipeline;
    applyForcesPipeline: GPUComputePipeline;
    computeDivergencePipeline: GPUComputePipeline;
    jacobiPressurePipeline: GPUComputePipeline;
    subtractGradientPipeline: GPUComputePipeline;
    vorticityConfinementPipeline: GPUComputePipeline;
    
    // Bind Groups
    advectVelocityBindGroup: GPUBindGroup;
    advectDensityBindGroup: GPUBindGroup;
    advectTemperatureBindGroup: GPUBindGroup;
    applyForcesBindGroup: GPUBindGroup;
    computeDivergenceBindGroup: GPUBindGroup;
    jacobiPressureBindGroup: GPUBindGroup;
    subtractGradientBindGroup: GPUBindGroup;
    vorticityConfinementBindGroup: GPUBindGroup;
}

export class WebGPUFluidEngine {
    private config: HyperFluidConfig;
    private gpu: GPUResources | null = null;
    private initialized = false;
    
    constructor(config: Partial<HyperFluidConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        // Request WebGPU adapter and device
        const adapter = await navigator.gpu?.requestAdapter();
        if (!adapter) {
            throw new Error('WebGPU not supported');
        }
        
        const device = await adapter.requestDevice();
        
        // Load shaders
        const [
            advectionShader,
            pressureShader,
            forcesShader,
        ] = await Promise.all([
            fetch('/src-frontend/features/quantum/fluid/shaders/advection.wgsl').then(r => r.text()),
            fetch('/src-frontend/features/quantum/fluid/shaders/pressure.wgsl').then(r => r.text()),
            fetch('/src-frontend/features/quantum/fluid/shaders/forces.wgsl').then(r => r.text()),
        ]);
        
        // Create textures
        const [w, h, d] = this.config.resolution;
        const textureDesc: GPUTextureDescriptor = {
            size: { width: w, height: h, depthOrArrayLayers: d },
            format: 'rgba32float',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
            dimension: '3d',
        };
        
        const velocityTexture = device.createTexture(textureDesc);
        const velocityTextureB = device.createTexture(textureDesc);
        const densityTexture = device.createTexture(textureDesc);
        const densityTextureB = device.createTexture(textureDesc);
        const temperatureTexture = device.createTexture(textureDesc);
        const temperatureTextureB = device.createTexture(textureDesc);
        const pressureTexture = device.createTexture(textureDesc);
        const pressureTextureB = device.createTexture(textureDesc);
        const divergenceTexture = device.createTexture(textureDesc);
        
        // Create uniform buffers (16-byte aligned)
        const physicsBuffer = device.createBuffer({
            size: 64, // 16 floats * 4 bytes
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        const thermalBuffer = device.createBuffer({
            size: 32, // 8 floats * 4 bytes
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        const timeBuffer = device.createBuffer({
            size: 16, // 4 floats * 4 bytes
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        // Update buffers with initial values
        this.updateUniforms(device, physicsBuffer, thermalBuffer, timeBuffer);
        
        // Create compute pipelines
        const advectionModule = device.createShaderModule({ code: advectionShader });
        const pressureModule = device.createShaderModule({ code: pressureShader });
        const forcesModule = device.createShaderModule({ code: forcesShader });
        
        // Create sampler for texture sampling
        const linearSampler = device.createSampler({ 
            magFilter: 'linear', 
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            addressModeW: 'clamp-to-edge',
        });
        
        // Advect Velocity Pipeline
        const advectVelocityPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: advectionModule,
                entryPoint: 'advect_velocity',
            },
        });
        
        const advectVelocityBindGroup = device.createBindGroup({
            layout: advectVelocityPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: physicsBuffer } },
                { binding: 1, resource: { buffer: timeBuffer } },
                { binding: 2, resource: velocityTexture.createView() },
                { binding: 3, resource: linearSampler },
                { binding: 4, resource: velocityTextureB.createView() },
            ],
        });
        
        // Advect Density Pipeline
        const advectDensityPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: advectionModule,
                entryPoint: 'advect_density',
            },
        });
        
        const advectDensityBindGroup = device.createBindGroup({
            layout: advectDensityPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: physicsBuffer } },
                { binding: 1, resource: { buffer: timeBuffer } },
                { binding: 2, resource: velocityTexture.createView() },
                { binding: 3, resource: linearSampler },
                { binding: 4, resource: velocityTexture.createView() },
                { binding: 5, resource: densityTexture.createView() },
                { binding: 6, resource: linearSampler },
                { binding: 7, resource: densityTextureB.createView() },
            ],
        });
        
        // Advect Temperature Pipeline
        const advectTemperaturePipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: advectionModule,
                entryPoint: 'advect_temperature',
            },
        });
        
        const advectTemperatureBindGroup = device.createBindGroup({
            layout: advectTemperaturePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: physicsBuffer } },
                { binding: 1, resource: { buffer: timeBuffer } },
                { binding: 2, resource: velocityTexture.createView() },
                { binding: 3, resource: linearSampler },
                { binding: 4, resource: velocityTexture.createView() },
                { binding: 5, resource: densityTexture.createView() },
                { binding: 6, resource: linearSampler },
                { binding: 7, resource: densityTextureB.createView() },
                { binding: 8, resource: temperatureTexture.createView() },
                { binding: 9, resource: linearSampler },
                { binding: 10, resource: temperatureTextureB.createView() },
            ],
        });
        
        // Apply Forces Pipeline
        const applyForcesPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: forcesModule,
                entryPoint: 'apply_external_forces',
            },
        });
        
        const applyForcesBindGroup = device.createBindGroup({
            layout: applyForcesPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: physicsBuffer } },
                { binding: 1, resource: { buffer: thermalBuffer } },
                { binding: 2, resource: { buffer: timeBuffer } },
                { binding: 3, resource: velocityTexture.createView() },
                { binding: 4, resource: linearSampler },
                { binding: 5, resource: densityTexture.createView() },
                { binding: 6, resource: linearSampler },
                { binding: 7, resource: temperatureTexture.createView() },
                { binding: 8, resource: linearSampler },
                { binding: 9, resource: velocityTextureB.createView() },
            ],
        });
        
        // Compute Divergence Pipeline
        const computeDivergencePipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: pressureModule,
                entryPoint: 'compute_divergence',
            },
        });
        
        const computeDivergenceBindGroup = device.createBindGroup({
            layout: computeDivergencePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: physicsBuffer } },
                { binding: 1, resource: velocityTexture.createView() },
                { binding: 2, resource: linearSampler },
                { binding: 3, resource: divergenceTexture.createView() },
            ],
        });
        
        // Jacobi Pressure Pipeline
        const jacobiPressurePipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: pressureModule,
                entryPoint: 'jacobi_pressure',
            },
        });
        
        const jacobiPressureBindGroup = device.createBindGroup({
            layout: jacobiPressurePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: physicsBuffer } },
                { binding: 1, resource: velocityTexture.createView() },
                { binding: 2, resource: linearSampler },
                { binding: 3, resource: divergenceTexture.createView() },
                { binding: 4, resource: pressureTexture.createView() },
                { binding: 5, resource: linearSampler },
                { binding: 6, resource: divergenceTexture.createView() },
                { binding: 7, resource: linearSampler },
                { binding: 8, resource: pressureTextureB.createView() },
            ],
        });
        
        // Subtract Gradient Pipeline
        const subtractGradientPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: pressureModule,
                entryPoint: 'subtract_gradient',
            },
        });
        
        const subtractGradientBindGroup = device.createBindGroup({
            layout: subtractGradientPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: physicsBuffer } },
                { binding: 1, resource: velocityTexture.createView() },
                { binding: 2, resource: linearSampler },
                { binding: 3, resource: divergenceTexture.createView() },
                { binding: 4, resource: pressureTexture.createView() },
                { binding: 5, resource: linearSampler },
                { binding: 6, resource: divergenceTexture.createView() },
                { binding: 7, resource: linearSampler },
                { binding: 8, resource: pressureTextureB.createView() },
                { binding: 9, resource: velocityTextureB.createView() },
            ],
        });
        
        // Vorticity Confinement Pipeline
        const vorticityConfinementPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: forcesModule,
                entryPoint: 'vorticity_confinement',
            },
        });
        
        const vorticityConfinementBindGroup = device.createBindGroup({
            layout: vorticityConfinementPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: physicsBuffer } },
                { binding: 1, resource: { buffer: thermalBuffer } },
                { binding: 2, resource: { buffer: timeBuffer } },
                { binding: 3, resource: velocityTexture.createView() },
                { binding: 4, resource: linearSampler },
                { binding: 5, resource: densityTexture.createView() },
                { binding: 6, resource: linearSampler },
                { binding: 7, resource: temperatureTexture.createView() },
                { binding: 8, resource: linearSampler },
                { binding: 9, resource: velocityTextureB.createView() },
                { binding: 10, resource: { buffer: device.createBuffer({ size: 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }) } },
            ],
        });
        
        // Write vorticity strength to buffer
        device.queue.writeBuffer(
            (vorticityConfinementBindGroup as any).entries[10].resource.buffer,
            0,
            new Float32Array([this.config.vorticityConfinement])
        );
        
        // Store resources
        this.gpu = {
            device,
            velocityTexture,
            velocityTextureB,
            densityTexture,
            densityTextureB,
            temperatureTexture,
            temperatureTextureB,
            pressureTexture,
            pressureTextureB,
            divergenceTexture,
            physicsBuffer,
            thermalBuffer,
            timeBuffer,
            advectVelocityPipeline,
            advectDensityPipeline,
            advectTemperaturePipeline,
            applyForcesPipeline,
            computeDivergencePipeline,
            jacobiPressurePipeline,
            subtractGradientPipeline,
            vorticityConfinementPipeline,
            advectVelocityBindGroup,
            advectDensityBindGroup,
            advectTemperatureBindGroup,
            applyForcesBindGroup,
            computeDivergenceBindGroup,
            jacobiPressureBindGroup,
            subtractGradientBindGroup,
            vorticityConfinementBindGroup,
        };
        
        this.initialized = true;
    }
    
    private updateUniforms(device: GPUDevice, physicsBuffer: GPUBuffer, thermalBuffer: GPUBuffer, timeBuffer: GPUBuffer) {
        // Physics params (16-byte aligned)
        const physicsData = new Float32Array([
            this.config.viscosity,
            this.config.density,
            this.config.surfaceTension,
            0.0, // compressibility
            0.0, // conductivity
            0.0, // permittivity
            0.0, // permeability
            0.0, // reactivity
            0.0, // radiation_absorption
            1.0, // gravity_scale
            0.0, // anisotropy
            0.0, // cavitation_threshold
            0.0, // yield_stress
            0.0, // foam_threshold
            0.0, // spray_threshold
            0.0, // bubble_coalescence
        ]);
        device.queue.writeBuffer(physicsBuffer, 0, physicsData);
        
        // Thermal params
        const thermalData = new Float32Array([
            this.config.temperature,
            0.01, // thermal_diffusivity
            this.config.buoyancyAlpha,
            this.config.buoyancyBeta,
            0.0, // radiation_gain
            0.0, // padding
            0.0,
            0.0,
        ]);
        device.queue.writeBuffer(thermalBuffer, 0, thermalData);
        
        // Time params
        const timeData = new Float32Array([
            this.config.dt,
            0.0, // current_time
            0.0, // cfl_number
            0.0, // padding
        ]);
        device.queue.writeBuffer(timeBuffer, 0, timeData);
    }
    
    async step(): Promise<void> {
        if (!this.gpu) throw new Error('Engine not initialized');
        
        const { device } = this.gpu;
        const [w, h, d] = this.config.resolution;
        const workgroupSize = [8, 8, 8];
        const dispatchSize = [
            Math.ceil(w / workgroupSize[0]),
            Math.ceil(h / workgroupSize[1]),
            Math.ceil(d / workgroupSize[2]),
        ];
        
        for (let substep = 0; substep < this.config.substeps; substep++) {
            const commandEncoder = device.createCommandEncoder();
            
            // 1. Advect Velocity
            let pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.gpu.advectVelocityPipeline);
            pass.setBindGroup(0, this.gpu.advectVelocityBindGroup);
            pass.dispatchWorkgroups(...dispatchSize);
            pass.end();
            
            // Swap velocity textures
            [this.gpu.velocityTexture, this.gpu.velocityTextureB] = [this.gpu.velocityTextureB, this.gpu.velocityTexture];
            
            // 2. Advect Density
            pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.gpu.advectDensityPipeline);
            pass.setBindGroup(0, this.gpu.advectDensityBindGroup);
            pass.dispatchWorkgroups(...dispatchSize);
            pass.end();
            
            // Swap density textures
            [this.gpu.densityTexture, this.gpu.densityTextureB] = [this.gpu.densityTextureB, this.gpu.densityTexture];
            
            // 3. Advect Temperature
            pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.gpu.advectTemperaturePipeline);
            pass.setBindGroup(0, this.gpu.advectTemperatureBindGroup);
            pass.dispatchWorkgroups(...dispatchSize);
            pass.end();
            
            // Swap temperature textures
            [this.gpu.temperatureTexture, this.gpu.temperatureTextureB] = [this.gpu.temperatureTextureB, this.gpu.temperatureTexture];
            
            // 4. Apply Forces (gravity, buoyancy)
            pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.gpu.applyForcesPipeline);
            pass.setBindGroup(0, this.gpu.applyForcesBindGroup);
            pass.dispatchWorkgroups(...dispatchSize);
            pass.end();
            
            // Swap velocity textures
            [this.gpu.velocityTexture, this.gpu.velocityTextureB] = [this.gpu.velocityTextureB, this.gpu.velocityTexture];
            
            // 5. Compute Divergence
            pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.gpu.computeDivergencePipeline);
            pass.setBindGroup(0, this.gpu.computeDivergenceBindGroup);
            pass.dispatchWorkgroups(...dispatchSize);
            pass.end();
            
            // 6. Pressure Solve (Jacobi iterations)
            for (let i = 0; i < this.config.pressureIterations; i++) {
                pass = commandEncoder.beginComputePass();
                pass.setPipeline(this.gpu.jacobiPressurePipeline);
                pass.setBindGroup(0, this.gpu.jacobiPressureBindGroup);
                pass.dispatchWorkgroups(...dispatchSize);
                pass.end();
                
                // Swap pressure textures
                [this.gpu.pressureTexture, this.gpu.pressureTextureB] = [this.gpu.pressureTextureB, this.gpu.pressureTexture];
            }
            
            // 7. Subtract Pressure Gradient (projection)
            pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.gpu.subtractGradientPipeline);
            pass.setBindGroup(0, this.gpu.subtractGradientBindGroup);
            pass.dispatchWorkgroups(...dispatchSize);
            pass.end();
            
            // Swap velocity textures
            [this.gpu.velocityTexture, this.gpu.velocityTextureB] = [this.gpu.velocityTextureB, this.gpu.velocityTexture];
            
            // 8. Vorticity Confinement (optional)
            if (this.config.vorticityConfinement > 0) {
                pass = commandEncoder.beginComputePass();
                pass.setPipeline(this.gpu.vorticityConfinementPipeline);
                pass.setBindGroup(0, this.gpu.vorticityConfinementBindGroup);
                pass.dispatchWorkgroups(...dispatchSize);
                pass.end();
                
                // Swap velocity textures
                [this.gpu.velocityTexture, this.gpu.velocityTextureB] = [this.gpu.velocityTextureB, this.gpu.velocityTexture];
            }
            
            device.queue.submit([commandEncoder.finish()]);
        }
        
        await device.queue.onSubmittedWorkDone();
    }
    
    async addSource(position: [number, number, number], radius: number, velocity: [number, number, number], density: number, temperature: number): Promise<void> {
        if (!this.gpu) throw new Error('Engine not initialized');
        
        // Create source injection compute shader
        const sourceShader = `
            struct SourceParams {
                position: vec3<f32>,
                radius: f32,
                velocity: vec3<f32>,
                density: f32,
                temperature: f32,
                _padding: vec3<f32>,
            }
            
            @group(0) @binding(0) var<uniform> source: SourceParams;
            @group(0) @binding(1) var velocity_texture: texture_3d<f32>;
            @group(0) @binding(2) var velocity_output: texture_storage_3d<rgba32float, write>;
            @group(0) @binding(3) var density_texture: texture_3d<f32>;
            @group(0) @binding(4) var density_output: texture_storage_3d<rgba32float, write>;
            @group(0) @binding(5) var temperature_texture: texture_3d<f32>;
            @group(0) @binding(6) var temperature_output: texture_storage_3d<rgba32float, write>;
            
            @compute @workgroup_size(8, 8, 8)
            fn inject_source(@builtin(global_invocation_id) id: vec3<u32>) {
                let dims = textureDimensions(velocity_texture);
                if (id.x >= dims.x || id.y >= dims.y || id.z >= dims.z) {
                    return;
                }
                
                // Convert grid coords to normalized space [-1, 1]
                let pos = (vec3<f32>(id) / vec3<f32>(dims)) * 2.0 - 1.0;
                let dist = length(pos - source.position);
                
                // Gaussian falloff
                let influence = exp(-dist * dist / (source.radius * source.radius));
                
                // Read current values
                let old_vel = textureLoad(velocity_texture, id, 0).xyz;
                let old_dens = textureLoad(density_texture, id, 0).x;
                let old_temp = textureLoad(temperature_texture, id, 0).x;
                
                // Inject with falloff
                let new_vel = old_vel + source.velocity * influence;
                let new_dens = old_dens + source.density * influence;
                let new_temp = old_temp + source.temperature * influence;
                
                textureStore(velocity_output, id, vec4<f32>(new_vel, 1.0));
                textureStore(density_output, id, vec4<f32>(new_dens, 0.0, 0.0, 1.0));
                textureStore(temperature_output, id, vec4<f32>(new_temp, 0.0, 0.0, 1.0));
            }
        `;
        
        const module = this.gpu.device.createShaderModule({ code: sourceShader });
        const pipeline = this.gpu.device.createComputePipeline({
            layout: 'auto',
            compute: { module, entryPoint: 'inject_source' },
        });
        
        // Create uniform buffer for source params
        const sourceBuffer = this.gpu.device.createBuffer({
            size: 64, // 16 floats * 4 bytes
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        const sourceData = new Float32Array([
            position[0], position[1], position[2], radius,
            velocity[0], velocity[1], velocity[2], density,
            temperature, 0, 0, 0,
            0, 0, 0, 0,
        ]);
        this.gpu.device.queue.writeBuffer(sourceBuffer, 0, sourceData);
        
        // Create bind group
        const bindGroup = this.gpu.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: sourceBuffer } },
                { binding: 1, resource: this.gpu.velocityTexture.createView() },
                { binding: 2, resource: this.gpu.velocityTextureB.createView() },
                { binding: 3, resource: this.gpu.densityTexture.createView() },
                { binding: 4, resource: this.gpu.densityTextureB.createView() },
                { binding: 5, resource: this.gpu.temperatureTexture.createView() },
                { binding: 6, resource: this.gpu.temperatureTextureB.createView() },
            ],
        });
        
        // Execute injection
        const [w, h, d] = this.config.resolution;
        const commandEncoder = this.gpu.device.createCommandEncoder();
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(
            Math.ceil(w / 8),
            Math.ceil(h / 8),
            Math.ceil(d / 8)
        );
        pass.end();
        this.gpu.device.queue.submit([commandEncoder.finish()]);
        
        // Swap textures
        [this.gpu.velocityTexture, this.gpu.velocityTextureB] = [this.gpu.velocityTextureB, this.gpu.velocityTexture];
        [this.gpu.densityTexture, this.gpu.densityTextureB] = [this.gpu.densityTextureB, this.gpu.densityTexture];
        [this.gpu.temperatureTexture, this.gpu.temperatureTextureB] = [this.gpu.temperatureTextureB, this.gpu.temperatureTexture];
        
        await this.gpu.device.queue.onSubmittedWorkDone();
        
        // Cleanup
        sourceBuffer.destroy();
    }
    
    async getDensityField(): Promise<Float32Array> {
        if (!this.gpu) throw new Error('Engine not initialized');
        
        const [w, h, d] = this.config.resolution;
        const size = w * h * d * 4 * 4; // RGBA * float32
        
        const readBuffer = this.gpu.device.createBuffer({
            size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        
        const commandEncoder = this.gpu.device.createCommandEncoder();
        commandEncoder.copyTextureToBuffer(
            { texture: this.gpu.densityTexture },
            { buffer: readBuffer, bytesPerRow: w * 4 * 4, rowsPerImage: h },
            { width: w, height: h, depthOrArrayLayers: d }
        );
        this.gpu.device.queue.submit([commandEncoder.finish()]);
        
        await readBuffer.mapAsync(GPUMapMode.READ);
        const data = new Float32Array(readBuffer.getMappedRange());
        const result = new Float32Array(data);
        readBuffer.unmap();
        
        return result;
    }
    
    dispose(): void {
        if (!this.gpu) return;
        
        this.gpu.velocityTexture.destroy();
        this.gpu.velocityTextureB.destroy();
        this.gpu.densityTexture.destroy();
        this.gpu.densityTextureB.destroy();
        this.gpu.temperatureTexture.destroy();
        this.gpu.temperatureTextureB.destroy();
        this.gpu.pressureTexture.destroy();
        this.gpu.pressureTextureB.destroy();
        this.gpu.divergenceTexture.destroy();
        
        this.gpu.physicsBuffer.destroy();
        this.gpu.thermalBuffer.destroy();
        this.gpu.timeBuffer.destroy();
        
        this.gpu = null;
        this.initialized = false;
    }
}
// @ts-nocheck

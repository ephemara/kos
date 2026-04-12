declare global {
    interface Navigator {
        gpu?: any;
    }

    type GPUDevice = any;
    type GPUAdapter = any;
    type GPUQueue = any;
    type GPUBuffer = any;
    type GPUShaderModule = any;
    type GPUComputePipeline = any;
    type GPURenderPipeline = any;
    type GPUCommandEncoder = any;
    type GPUComputePassEncoder = any;
    type GPUBindGroup = any;
    type GPUBindGroupLayout = any;
    type GPUCanvasContext = any;

    const GPUBufferUsage: any;
    const GPUMapMode: any;
}

export { }; 

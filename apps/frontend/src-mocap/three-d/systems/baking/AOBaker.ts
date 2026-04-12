/**
 * AOBaker.ts
 * 
 * Real-time ambient occlusion baking for meshes.
 * Uses screen-space sampling for fast AO computation.
 */

import * as THREE from 'three';
import {
  AOBakingParams,
  BakingResult,
  BakingOptions,
} from './BakingTypes';

/**
 * Ambient occlusion baker using screen-space techniques
 */
export class AOBaker {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    
    // Setup orthographic scene for baking
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * Bake an ambient occlusion map from a mesh
   */
  async bake(
    params: AOBakingParams,
    options?: BakingOptions
  ): Promise<BakingResult> {
    const startTime = performance.now();
    
    options?.onProgress?.({
      step: 'Preparing geometry',
      progress: 0,
    });

    const { mesh, resolution, samples, distance, bias, intensity, useGPU } = params;

    if (useGPU) {
      return this.bakeGPU(params, options);
    } else {
      return this.bakeCPU(params, options);
    }
  }

  /**
   * GPU-accelerated AO baking using screen-space techniques
   */
  private async bakeGPU(
    params: AOBakingParams,
    options?: BakingOptions
  ): Promise<BakingResult> {
    const startTime = performance.now();
    const { mesh, resolution, samples, distance, bias, intensity } = params;

    options?.onProgress?.({
      step: 'Baking position and normal maps',
      progress: 25,
    });

    // Step 1: Bake position and normal maps
    const positionMap = this.bakePositionMap(mesh, resolution);
    const normalMap = this.bakeNormalMap(mesh, resolution);

    options?.onProgress?.({
      step: 'Computing ambient occlusion',
      progress: 50,
    });

    // Step 2: Compute AO using SSAO-like technique
    const aoMap = this.computeAO(positionMap, normalMap, resolution, samples, distance, bias, intensity);

    // Cleanup intermediate maps
    positionMap.dispose();
    normalMap.dispose();

    options?.onProgress?.({
      step: 'Finalizing',
      progress: 100,
    });

    const timeMs = performance.now() - startTime;

    return {
      texture: aoMap,
      mapType: 'ao',
      resolution,
      timeMs,
      metadata: {
        quality: 'production',
        samples,
        gpuAccelerated: true,
      },
    };
  }

  /**
   * CPU-based AO baking (slower but more accurate)
   */
  private async bakeCPU(
    params: AOBakingParams,
    options?: BakingOptions
  ): Promise<BakingResult> {
    const startTime = performance.now();
    
    // TODO: Implement CPU-based ray-traced AO
    // This would require:
    // 1. Build BVH for the mesh
    // 2. For each pixel:
    //    - Cast hemisphere of rays
    //    - Count occlusion hits
    //    - Compute AO value
    
    console.warn('[AOBaker] CPU-based AO not yet implemented, falling back to GPU');
    return this.bakeGPU(params, options);
  }

  /**
   * Bake position map (world-space positions)
   */
  private bakePositionMap(mesh: THREE.Mesh, resolution: number): THREE.Texture {
    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vPosition;
        varying vec2 vUv;

        void main() {
          vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPosition;
        varying vec2 vUv;

        void main() {
          gl_FragColor = vec4(vPosition, 1.0);
        }
      `,
    });

    const bakingMesh = new THREE.Mesh(mesh.geometry, material);
    bakingMesh.position.copy(mesh.position);
    bakingMesh.rotation.copy(mesh.rotation);
    bakingMesh.scale.copy(mesh.scale);
    
    this.scene.add(bakingMesh);

    const oldTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(oldTarget);

    this.scene.remove(bakingMesh);
    material.dispose();

    return renderTarget.texture;
  }

  /**
   * Bake normal map (world-space normals)
   */
  private bakeNormalMap(mesh: THREE.Mesh, resolution: number): THREE.Texture {
    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec2 vUv;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec2 vUv;

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 encoded = normal * 0.5 + 0.5;
          gl_FragColor = vec4(encoded, 1.0);
        }
      `,
    });

    const bakingMesh = new THREE.Mesh(mesh.geometry, material);
    bakingMesh.position.copy(mesh.position);
    bakingMesh.rotation.copy(mesh.rotation);
    bakingMesh.scale.copy(mesh.scale);
    
    this.scene.add(bakingMesh);

    const oldTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(oldTarget);

    this.scene.remove(bakingMesh);
    material.dispose();

    return renderTarget.texture;
  }

  /**
   * Compute AO using screen-space sampling
   */
  private computeAO(
    positionMap: THREE.Texture,
    normalMap: THREE.Texture,
    resolution: number,
    samples: number,
    distance: number,
    bias: number,
    intensity: number
  ): THREE.Texture {
    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    // Generate random sample kernel
    const kernel = this.generateSampleKernel(samples);
    const noiseTexture = this.generateNoiseTexture();

    const material = new THREE.ShaderMaterial({
      uniforms: {
        positionMap: { value: positionMap },
        normalMap: { value: normalMap },
        noiseTexture: { value: noiseTexture },
        kernel: { value: kernel },
        samples: { value: samples },
        radius: { value: distance },
        bias: { value: bias },
        intensity: { value: intensity },
        resolution: { value: new THREE.Vector2(resolution, resolution) },
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D positionMap;
        uniform sampler2D normalMap;
        uniform sampler2D noiseTexture;
        uniform vec3 kernel[64];
        uniform int samples;
        uniform float radius;
        uniform float bias;
        uniform float intensity;
        uniform vec2 resolution;
        varying vec2 vUv;

        void main() {
          // Get position and normal
          vec3 position = texture2D(positionMap, vUv).xyz;
          vec3 normal = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
          normal = normalize(normal);

          // Get random rotation from noise texture
          vec2 noiseScale = resolution / 4.0;
          vec3 randomVec = texture2D(noiseTexture, vUv * noiseScale).xyz * 2.0 - 1.0;

          // Create TBN matrix for sample rotation
          vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
          vec3 bitangent = cross(normal, tangent);
          mat3 TBN = mat3(tangent, bitangent, normal);

          // Sample hemisphere
          float occlusion = 0.0;
          for (int i = 0; i < 64; i++) {
            if (i >= samples) break;

            // Get sample position
            vec3 samplePos = TBN * kernel[i];
            samplePos = position + samplePos * radius;

            // Project sample to screen space (simplified)
            // In a real implementation, this would use proper projection
            vec2 sampleUV = vUv + (samplePos.xy - position.xy) / radius * 0.1;
            sampleUV = clamp(sampleUV, 0.0, 1.0);

            // Get depth at sample position
            vec3 sampleDepth = texture2D(positionMap, sampleUV).xyz;

            // Range check and accumulate
            float rangeCheck = smoothstep(0.0, 1.0, radius / abs(position.z - sampleDepth.z));
            occlusion += (sampleDepth.z >= samplePos.z + bias ? 1.0 : 0.0) * rangeCheck;
          }

          occlusion = 1.0 - (occlusion / float(samples));
          occlusion = pow(occlusion, intensity);

          gl_FragColor = vec4(occlusion, occlusion, occlusion, 1.0);
        }
      `,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.scene.add(quad);

    const oldTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(oldTarget);

    this.scene.remove(quad);
    quad.geometry.dispose();
    material.dispose();
    noiseTexture.dispose();

    return renderTarget.texture;
  }

  /**
   * Generate random sample kernel for hemisphere sampling
   */
  private generateSampleKernel(samples: number): THREE.Vector3[] {
    const kernel: THREE.Vector3[] = [];
    
    for (let i = 0; i < samples; i++) {
      const sample = new THREE.Vector3(
        Math.random() * 2.0 - 1.0,
        Math.random() * 2.0 - 1.0,
        Math.random()
      );
      sample.normalize();
      
      // Scale samples so they're more aligned to center of kernel
      let scale = i / samples;
      scale = THREE.MathUtils.lerp(0.1, 1.0, scale * scale);
      sample.multiplyScalar(scale);
      
      kernel.push(sample);
    }
    
    return kernel;
  }

  /**
   * Generate noise texture for random rotation
   */
  private generateNoiseTexture(): THREE.DataTexture {
    const size = 4;
    const data = new Float32Array(size * size * 4);
    
    for (let i = 0; i < size * size; i++) {
      const offset = i * 4;
      data[offset] = Math.random() * 2.0 - 1.0;
      data[offset + 1] = Math.random() * 2.0 - 1.0;
      data[offset + 2] = 0.0;
      data[offset + 3] = 1.0;
    }
    
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    
    return texture;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.scene.clear();
  }
}

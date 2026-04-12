/**
 * NormalMapBaker.ts
 * 
 * Real-time normal map baking for meshes.
 * Supports both world-space and tangent-space normal maps.
 */

import * as THREE from 'three';
import {
  NormalMapBakingParams,
  BakingResult,
  BakingOptions,
  BakingProgress,
} from './BakingTypes';

/**
 * Normal map baker for generating normal maps from mesh geometry
 */
export class NormalMapBaker {
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
   * Bake a normal map from a mesh
   */
  async bake(
    params: NormalMapBakingParams,
    options?: BakingOptions
  ): Promise<BakingResult> {
    const startTime = performance.now();
    
    options?.onProgress?.({
      step: 'Preparing geometry',
      progress: 0,
    });

    const { mesh, resolution, tangentSpace, highPolyMesh, rayDistance = 0.1 } = params;

    // Create render target
    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    options?.onProgress?.({
      step: 'Baking normals',
      progress: 50,
    });

    // Create baking material
    const material = tangentSpace
      ? this.createTangentSpaceMaterial(mesh)
      : this.createWorldSpaceMaterial(mesh);

    // Render to texture
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

    options?.onProgress?.({
      step: 'Finalizing',
      progress: 100,
    });

    const timeMs = performance.now() - startTime;

    return {
      texture: renderTarget.texture,
      mapType: 'normal',
      resolution,
      timeMs,
      metadata: {
        quality: 'production',
        gpuAccelerated: true,
      },
    };
  }

  /**
   * Create world-space normal baking material
   */
  private createWorldSpaceMaterial(mesh: THREE.Mesh): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
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
          // World-space normals encoded to [0,1] range
          vec3 normal = normalize(vNormal);
          vec3 encoded = normal * 0.5 + 0.5;
          gl_FragColor = vec4(encoded, 1.0);
        }
      `,
    });
  }

  /**
   * Create tangent-space normal baking material
   */
  private createTangentSpaceMaterial(mesh: THREE.Mesh): THREE.ShaderMaterial {
    // Ensure geometry has tangents
    const geometry = mesh.geometry;
    if (!geometry.attributes.tangent) {
      geometry.computeTangents();
    }

    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vTangent;
        varying vec3 vBitangent;
        varying vec2 vUv;

        attribute vec4 tangent;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vTangent = normalize(normalMatrix * tangent.xyz);
          vBitangent = normalize(cross(vNormal, vTangent) * tangent.w);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vTangent;
        varying vec3 vBitangent;
        varying vec2 vUv;

        void main() {
          // Build TBN matrix
          mat3 TBN = mat3(vTangent, vBitangent, vNormal);
          mat3 TBN_inv = transpose(TBN);
          
          // Transform world-space normal to tangent space
          vec3 tangentNormal = TBN_inv * normalize(vNormal);
          
          // Encode to [0,1] range
          vec3 encoded = tangentNormal * 0.5 + 0.5;
          gl_FragColor = vec4(encoded, 1.0);
        }
      `,
    });
  }

  /**
   * Bake high-poly to low-poly normal map
   * (Advanced feature - requires ray tracing)
   */
  async bakeHighToLow(
    lowPolyMesh: THREE.Mesh,
    highPolyMesh: THREE.Mesh,
    resolution: number,
    rayDistance: number = 0.1,
    options?: BakingOptions
  ): Promise<BakingResult> {
    // TODO: Implement high-to-low baking with ray tracing
    // This requires:
    // 1. Build BVH for high-poly mesh
    // 2. For each pixel on low-poly UV:
    //    - Cast ray from low-poly surface
    //    - Find intersection with high-poly mesh
    //    - Sample high-poly normal at intersection
    //    - Transform to low-poly tangent space
    
    console.warn('[NormalMapBaker] High-to-low baking not yet implemented');
    
    // Fallback to regular baking
    return this.bake({
      mesh: lowPolyMesh,
      resolution,
      tangentSpace: true,
    }, options);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Cleanup scene
    this.scene.clear();
  }
}

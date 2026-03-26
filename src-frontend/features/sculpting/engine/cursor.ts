/**
 * KSculptCursor.ts
 * 
 * GPU-based brush cursor for KSculpt.
 * Projects a circle directly onto the mesh surface via shader.
 * No 3D geometry needed - zero overhead, perfect accuracy.
 * 
 * Inspired by ZBrush/Blender's surface cursor implementation.
 */

import * as THREE from 'three';

// Shader uniforms for brush cursor
export interface BrushCursorUniforms {
    uBrushPosition: THREE.Vector3;
    uBrushRadius: number;
    uBrushColor: THREE.Color;
    uBrushVisible: boolean;
    uSymmetryPosition: THREE.Vector3;
    uSymmetryVisible: boolean;
}

// Vertex shader - just passes world position to fragment
const brushCursorVertexChunk = `
varying vec3 vWorldPosition;
`;

const brushCursorVertexMain = `
vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
`;

// Fragment shader - draws circle at brush position
const brushCursorFragmentChunk = `
uniform vec3 uBrushPosition;
uniform float uBrushRadius;
uniform vec3 uBrushColor;
uniform bool uBrushVisible;
uniform vec3 uSymmetryPosition;
uniform bool uSymmetryVisible;

varying vec3 vWorldPosition;

float drawBrushCircle(vec3 worldPos, vec3 brushCenter, float radius) {
    float dist = distance(worldPos, brushCenter);
    
    // Ring effect: visible between 0.9*radius and 1.0*radius
    float innerRadius = radius * 0.92;
    float outerRadius = radius * 1.0;
    
    // Smooth ring
    float ring = smoothstep(innerRadius - 0.01, innerRadius, dist) 
               - smoothstep(outerRadius, outerRadius + 0.01, dist);
    
    return ring;
}
`;

const brushCursorFragmentMain = `
    vec3 cursorColor = vec3(0.0);
    float cursorAlpha = 0.0;
    
    // Main brush cursor
    if (uBrushVisible) {
        float brushRing = drawBrushCircle(vWorldPosition, uBrushPosition, uBrushRadius);
        cursorColor += uBrushColor * brushRing;
        cursorAlpha = max(cursorAlpha, brushRing * 0.8);
    }
    
    // Symmetry cursor
    if (uSymmetryVisible) {
        float symRing = drawBrushCircle(vWorldPosition, uSymmetryPosition, uBrushRadius);
        cursorColor += vec3(1.0, 0.3, 0.0) * symRing; // Orange for symmetry
        cursorAlpha = max(cursorAlpha, symRing * 0.5);
    }
    
    // Blend cursor onto surface color
    if (cursorAlpha > 0.0) {
        gl_FragColor.rgb = mix(gl_FragColor.rgb, cursorColor, cursorAlpha);
    }
`;

/**
 * Creates brush cursor uniforms with default values
 */
export function createBrushCursorUniforms(): { [key: string]: THREE.IUniform } {
    return {
        uBrushPosition: { value: new THREE.Vector3(0, 0, 0) },
        uBrushRadius: { value: 1.0 },
        uBrushColor: { value: new THREE.Color(0x3daee9) }, // Same as HOVER_COLOR
        uBrushVisible: { value: false },
        uSymmetryPosition: { value: new THREE.Vector3(0, 0, 0) },
        uSymmetryVisible: { value: false },
    };
}

/**
 * Patches an existing Three.js material to include brush cursor projection.
 * Works with MeshStandardMaterial, MeshPhongMaterial, MeshMatcapMaterial, etc.
 * 
 * NOTE: We modify the material IN-PLACE to preserve existing onBeforeCompile callbacks.
 * Material.clone() does NOT copy onBeforeCompile, so we can't use it here.
 */
export function patchMaterialWithBrushCursor(
    material: THREE.Material,
    uniforms: { [key: string]: THREE.IUniform }
): THREE.Material {
    // Add our uniforms to the material (in-place)
    (material as any).uniforms = {
        ...(material as any).uniforms || {},
        ...uniforms,
    };

    // PRESERVE existing onBeforeCompile (e.g., mask visualization)
    const existingCallback = material.onBeforeCompile;

    // Chain our shader injection with existing callback
    material.onBeforeCompile = (shader, renderer) => {
        // Call existing callback first (mask visualization, etc.)
        if (existingCallback) {
            existingCallback.call(material, shader, renderer);
        }

        // Merge uniforms
        Object.assign(shader.uniforms, uniforms);

        // Inject vertex shader (only if not already injected)
        if (!shader.vertexShader.includes('vWorldPosition')) {
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                ${brushCursorVertexChunk}`
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                ${brushCursorVertexMain}`
            );
        }

        // Inject fragment shader (only if not already injected)
        if (!shader.fragmentShader.includes('uBrushPosition')) {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                ${brushCursorFragmentChunk}`
            );

            // Inject fragment logic after final color calculation
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `#include <dithering_fragment>
                ${brushCursorFragmentMain}`
            );
        }
    };

    // Force recompile
    material.needsUpdate = true;

    return material;
}

/**
 * Updates brush cursor uniforms from raycast hit
 */
export function updateBrushCursor(
    uniforms: { [key: string]: THREE.IUniform },
    hit: { point: THREE.Vector3; normal?: THREE.Vector3 } | null,
    radius: number,
    symmetry: 'NONE' | 'X' = 'NONE'
): void {
    if (hit) {
        // Offset cursor slightly above surface to prevent jitter during sculpting
        const normal = hit.normal || new THREE.Vector3(0, 1, 0);
        const offset = radius * 0.02; // 2% of radius hover offset
        uniforms.uBrushPosition.value.copy(hit.point).addScaledVector(normal, offset);
        uniforms.uBrushRadius.value = radius;
        uniforms.uBrushVisible.value = true;

        // Symmetry
        if (symmetry === 'X') {
            const symPoint = new THREE.Vector3(-hit.point.x, hit.point.y, hit.point.z);
            const symNormal = new THREE.Vector3(-normal.x, normal.y, normal.z);
            uniforms.uSymmetryPosition.value.copy(symPoint).addScaledVector(symNormal, offset);
            uniforms.uSymmetryVisible.value = true;
        } else {
            uniforms.uSymmetryVisible.value = false;
        }
    } else {
        uniforms.uBrushVisible.value = false;
        uniforms.uSymmetryVisible.value = false;
    }
}

/**
 * Manager class for GPU brush cursor
 */
export class GPUBrushCursor {
    private uniforms: { [key: string]: THREE.IUniform };
    private patchedMaterials: Map<string, THREE.Material> = new Map();

    // Smoothing state
    private targetPosition: THREE.Vector3 = new THREE.Vector3();
    private currentPosition: THREE.Vector3 = new THREE.Vector3();
    private targetSymPosition: THREE.Vector3 = new THREE.Vector3();
    private currentSymPosition: THREE.Vector3 = new THREE.Vector3();
    private smoothingFactor: number = 0.3; // 0 = no smoothing, 1 = instant snap

    constructor() {
        this.uniforms = createBrushCursorUniforms();
    }

    /**
     * Patch a mesh's material to include GPU brush cursor
     */
    patchMesh(mesh: THREE.Mesh): void {
        if (!mesh.material) return;

        const meshId = mesh.uuid;
        if (this.patchedMaterials.has(meshId)) return; // Already patched

        // Patch material in-place (preserves existing onBeforeCompile like mask visualization)
        patchMaterialWithBrushCursor(mesh.material as THREE.Material, this.uniforms);

        // Track that this mesh has been patched
        this.patchedMaterials.set(meshId, mesh.material as THREE.Material);

        console.log('[GPUBrushCursor] Patched mesh material for GPU cursor');
    }

    update(
        hit: { point: THREE.Vector3; normal?: THREE.Vector3 } | null,
        radius: number,
        symmetry: 'NONE' | 'X' = 'NONE'
    ): void {
        if (hit) {
            // TARGET: Exact hit point (BVH is now fresh, so this is surface-accurate)
            // We removed the normal offset because it causes jitter on steep slopes (noisy normals)
            this.targetPosition.copy(hit.point);

            // LERP current position towards target (smooth movement)
            this.currentPosition.lerp(this.targetPosition, this.smoothingFactor);

            // Update uniform with smoothed position
            this.uniforms.uBrushPosition.value.copy(this.currentPosition);
            this.uniforms.uBrushRadius.value = radius;
            this.uniforms.uBrushVisible.value = true;

            // Symmetry with smoothing
            if (symmetry === 'X') {
                const symPoint = new THREE.Vector3(-hit.point.x, hit.point.y, hit.point.z);
                this.targetSymPosition.copy(symPoint); // Exact symmetry point
                this.currentSymPosition.lerp(this.targetSymPosition, this.smoothingFactor);
                this.uniforms.uSymmetryPosition.value.copy(this.currentSymPosition);
                this.uniforms.uSymmetryVisible.value = true;
            } else {
                this.uniforms.uSymmetryVisible.value = false;
            }
        } else {
            this.uniforms.uBrushVisible.value = false;
            this.uniforms.uSymmetryVisible.value = false;
        }
    }

    /**
     * Hide the cursor
     */
    hide(): void {
        this.uniforms.uBrushVisible.value = false;
        this.uniforms.uSymmetryVisible.value = false;
    }

    /**
     * Set cursor color
     */
    setColor(color: THREE.Color | number): void {
        if (typeof color === 'number') {
            this.uniforms.uBrushColor.value.set(color);
        } else {
            this.uniforms.uBrushColor.value.copy(color);
        }
    }

    /**
     * Dispose and cleanup
     */
    dispose(): void {
        this.patchedMaterials.forEach((mat) => mat.dispose());
        this.patchedMaterials.clear();
    }
}

// Global singleton for easy access
export const gpuBrushCursor = new GPUBrushCursor();

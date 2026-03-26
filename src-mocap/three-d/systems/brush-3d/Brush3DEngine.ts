/**
 * 3D BRUSH ENGINE
 * 
 * Handles 3D sculpting and mesh painting operations.
 * Integrates with Rust GPU backend for high-performance brush strokes.
 * 
 * Features:
 * - GPU-accelerated sculpting via Rust backend
 * - Alpha texture modulation
 * - Symmetry support (X, Y, Z, radial)
 * - Stroke interpolation
 * - Undo/redo support
 * 
 * @module Brush3DEngine
 */

import * as THREE from 'three';
import {
  type BaseBrushParams,
  type Sculpt3DBrushParams,
  type BrushStrokePoint,
  type BrushStroke,
  type BrushResult,
  type IBrushEngine,
  DEFAULT_BRUSH_PARAMS,
} from '@mocap/shared/systems/brush/BrushTypes';
import { rustSculpt, type SculptMeshHandle } from '@mocap/three-d/services/sculptClient';

// ============================================================================
// 3D BRUSH ENGINE
// ============================================================================

/**
 * 3D brush engine for sculpting and mesh painting
 */
export class Brush3DEngine implements IBrushEngine {
  private params: Sculpt3DBrushParams;
  private currentStroke: BrushStroke | null = null;
  private meshHandle: SculptMeshHandle | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private isInitialized = false;

  constructor() {
    this.params = {
      ...DEFAULT_BRUSH_PARAMS,
      mode: 'add',
      frontFacesOnly: true,
      accumulate: true,
      invert: false,
      useGpu: true,
    };
  }

  /**
   * Initialize the brush engine with a mesh
   */
  async init(geometry?: THREE.BufferGeometry): Promise<void> {
    if (geometry) {
      await this.setGeometry(geometry);
    }
    this.isInitialized = true;
  }

  /**
   * Set the target geometry for sculpting
   */
  async setGeometry(geometry: THREE.BufferGeometry): Promise<void> {
    // Dispose previous mesh handle
    if (this.meshHandle !== null) {
      await rustSculpt.dispose(this.meshHandle);
      this.meshHandle = null;
    }

    this.geometry = geometry;

    // Initialize Rust backend with mesh data
    const positions = geometry.attributes.position.array as Float32Array;
    const indices = geometry.index?.array as Uint32Array;

    if (!indices) {
      throw new Error('Geometry must have an index buffer');
    }

    // Use binary path for better performance
    this.meshHandle = await rustSculpt.initMeshBinary(positions, indices);

    if (this.meshHandle === null) {
      throw new Error('Failed to initialize Rust sculpting backend');
    }
  }

  /**
   * Start a new brush stroke
   */
  startStroke(params: Sculpt3DBrushParams, point: BrushStrokePoint): void {
    this.params = { ...this.params, ...params };
    
    this.currentStroke = {
      id: `stroke_${Date.now()}_${Math.random()}`,
      params: this.params,
      points: [point],
      startTime: Date.now(),
      isComplete: false,
    };
  }

  /**
   * Continue brush stroke with new point
   */
  continueStroke(point: BrushStrokePoint): void {
    if (!this.currentStroke) {
      console.warn('[Brush3DEngine] No active stroke to continue');
      return;
    }

    this.currentStroke.points.push(point);
  }

  /**
   * End current brush stroke
   */
  endStroke(): void {
    if (!this.currentStroke) {
      return;
    }

    this.currentStroke.isComplete = true;
    this.currentStroke.endTime = Date.now();
    this.currentStroke = null;
  }

  /**
   * Apply a complete stroke to the mesh
   */
  async applyStroke(stroke: BrushStroke): Promise<void> {
    if (!this.meshHandle || !this.geometry) {
      throw new Error('Brush engine not initialized with geometry');
    }

    const params = stroke.params as Sculpt3DBrushParams;

    // Apply each point in the stroke
    for (let i = 0; i < stroke.points.length; i++) {
      const point = stroke.points[i];
      const pos = point.position as THREE.Vector3;
      const normal = point.normal || new THREE.Vector3(0, 1, 0);

      // Calculate delta for grab-type brushes
      let delta: [number, number, number] | null = null;
      if (params.mode === 'grab' && i > 0) {
        const prevPos = stroke.points[i - 1].position as THREE.Vector3;
        delta = [
          pos.x - prevPos.x,
          pos.y - prevPos.y,
          pos.z - prevPos.z,
        ];
      }

      // Apply brush stroke via Rust backend
      const result = await rustSculpt.applyBrush(
        this.meshHandle,
        [pos.x, pos.y, pos.z],
        [normal.x, normal.y, normal.z],
        this.mapBrushModeToTool(params.mode),
        params.size,
        params.strength * point.pressure,
        params.symmetry === 'X' ? 'X' : 'NONE',
        params.useGpu,
        params.alpha?.handle || null,
        delta
      );

      if (result) {
        this.applyBrushResultToGeometry(result);
      }
    }
  }

  /**
   * Apply a single brush dab at a point
   */
  async applyDab(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    pressure: number = 1.0,
    delta?: THREE.Vector3
  ): Promise<BrushResult | null> {
    if (!this.meshHandle || !this.geometry) {
      throw new Error('Brush engine not initialized with geometry');
    }

    const deltaArray: [number, number, number] | null = delta
      ? [delta.x, delta.y, delta.z]
      : null;

    const result = await rustSculpt.applyBrush(
      this.meshHandle,
      [position.x, position.y, position.z],
      [normal.x, normal.y, normal.z],
      this.mapBrushModeToTool(this.params.mode),
      this.params.size,
      this.params.strength * pressure,
      this.params.symmetry === 'X' ? 'X' : 'NONE',
      this.params.useGpu,
      this.params.alpha?.handle || null,
      deltaArray
    );

    if (result) {
      this.applyBrushResultToGeometry(result);
      return {
        modifiedIndices: result.modified_indices,
        newData: result.new_positions,
        newNormals: result.new_normals,
        normalIndices: result.normal_indices,
        affectedCount: result.affected_count,
        timeMs: result.time_ms,
        usedGpu: result.used_gpu,
        gpuFallbackReason: result.gpu_fallback_reason || undefined,
      };
    }

    return null;
  }

  /**
   * Get current brush parameters
   */
  getParams(): Sculpt3DBrushParams {
    return { ...this.params };
  }

  /**
   * Update brush parameters
   */
  setParams(params: Partial<Sculpt3DBrushParams>): void {
    this.params = { ...this.params, ...params };
  }

  /**
   * Update mesh positions (for undo/redo)
   */
  async updatePositions(positions: Float32Array): Promise<boolean> {
    if (!this.meshHandle) {
      return false;
    }

    return await rustSculpt.updatePositionsBinary(this.meshHandle, positions);
  }

  /**
   * Get current mesh positions
   */
  async getPositions(): Promise<Float32Array | null> {
    if (!this.meshHandle) {
      return null;
    }

    return await rustSculpt.getPositionsBinary(this.meshHandle);
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    if (this.meshHandle !== null) {
      await rustSculpt.dispose(this.meshHandle);
      this.meshHandle = null;
    }
    this.geometry = null;
    this.currentStroke = null;
    this.isInitialized = false;
  }

  /**
   * Check if engine is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.meshHandle !== null;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Map brush mode to Rust tool name
   */
  private mapBrushModeToTool(mode: string): string {
    const modeMap: Record<string, string> = {
      add: 'CLAY',
      subtract: 'SCRAPE',
      smooth: 'SMOOTH',
      flatten: 'FLATTEN',
      grab: 'MOVE',
      pinch: 'PINCH',
      paint: 'PAINT',
      noise: 'NOISE',
    };

    return modeMap[mode] || 'CLAY';
  }

  /**
   * Apply brush result to Three.js geometry
   */
  private applyBrushResultToGeometry(result: any): void {
    if (!this.geometry) return;

    const posAttr = this.geometry.attributes.position;
    const posArray = posAttr.array as Float32Array;

    // Apply modified positions
    for (let i = 0; i < result.modified_indices.length; i++) {
      const idx = result.modified_indices[i];
      posArray[idx * 3] = result.new_positions[i * 3];
      posArray[idx * 3 + 1] = result.new_positions[i * 3 + 1];
      posArray[idx * 3 + 2] = result.new_positions[i * 3 + 2];
    }
    posAttr.needsUpdate = true;

    // Apply Rust-computed normals
    if (result.new_normals && result.normal_indices) {
      const normalAttr = this.geometry.attributes.normal;
      if (normalAttr) {
        const normalArray = normalAttr.array as Float32Array;
        for (let i = 0; i < result.normal_indices.length; i++) {
          const idx = result.normal_indices[i];
          normalArray[idx * 3] = result.new_normals[i * 3];
          normalArray[idx * 3 + 1] = result.new_normals[i * 3 + 1];
          normalArray[idx * 3 + 2] = result.new_normals[i * 3 + 2];
        }
        normalAttr.needsUpdate = true;
      }
    } else {
      // Fallback to JS normal computation
      this.geometry.computeVertexNormals();
    }

    // Update bounding sphere
    this.geometry.computeBoundingSphere();
  }
}

// ============================================================================
// STROKE INTERPOLATION
// ============================================================================

/**
 * Interpolate points between two stroke points for smooth strokes
 */
export function interpolateStrokePoints(
  p0: BrushStrokePoint,
  p1: BrushStrokePoint,
  spacing: number
): BrushStrokePoint[] {
  const pos0 = p0.position as THREE.Vector3;
  const pos1 = p1.position as THREE.Vector3;
  
  const distance = pos0.distanceTo(pos1);
  const steps = Math.max(1, Math.ceil(distance / spacing));
  
  const points: BrushStrokePoint[] = [];
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const position = new THREE.Vector3().lerpVectors(pos0, pos1, t);
    
    // Interpolate normal if available
    let normal: THREE.Vector3 | undefined;
    if (p0.normal && p1.normal) {
      normal = new THREE.Vector3().lerpVectors(p0.normal, p1.normal, t).normalize();
    }
    
    // Interpolate pressure
    const pressure = THREE.MathUtils.lerp(p0.pressure, p1.pressure, t);
    
    points.push({
      position,
      normal,
      pressure,
      timestamp: THREE.MathUtils.lerp(p0.timestamp, p1.timestamp, t),
    });
  }
  
  return points;
}

/**
 * Apply jitter to a brush stroke point
 */
export function applyJitter(
  point: BrushStrokePoint,
  params: Sculpt3DBrushParams,
  rng: () => number
): BrushStrokePoint {
  const pos = point.position as THREE.Vector3;
  
  // Position jitter
  if (params.scatterAmount > 0) {
    const scatter = params.scatterAmount * params.size;
    pos.x += (rng() - 0.5) * scatter;
    pos.y += (rng() - 0.5) * scatter;
    pos.z += (rng() - 0.5) * scatter;
  }
  
  // Size jitter (affects strength)
  let pressure = point.pressure;
  if (params.sizeJitter > 0) {
    pressure *= 1.0 + (rng() - 0.5) * params.sizeJitter;
    pressure = THREE.MathUtils.clamp(pressure, 0, 1);
  }
  
  return {
    ...point,
    position: pos,
    pressure,
  };
}

// ============================================================================
// SYMMETRY HELPERS
// ============================================================================

/**
 * Generate symmetry points for a given position
 */
export function generateSymmetryPoints(
  position: THREE.Vector3,
  normal: THREE.Vector3,
  symmetry: string,
  radialSegments: number = 4
): Array<{ position: THREE.Vector3; normal: THREE.Vector3 }> {
  const points: Array<{ position: THREE.Vector3; normal: THREE.Vector3 }> = [];
  
  // Base point
  points.push({ position: position.clone(), normal: normal.clone() });
  
  switch (symmetry) {
    case 'X':
      points.push({
        position: new THREE.Vector3(-position.x, position.y, position.z),
        normal: new THREE.Vector3(-normal.x, normal.y, normal.z),
      });
      break;
      
    case 'Y':
      points.push({
        position: new THREE.Vector3(position.x, -position.y, position.z),
        normal: new THREE.Vector3(normal.x, -normal.y, normal.z),
      });
      break;
      
    case 'Z':
      points.push({
        position: new THREE.Vector3(position.x, position.y, -position.z),
        normal: new THREE.Vector3(normal.x, normal.y, -normal.z),
      });
      break;
      
    case 'RADIAL':
      for (let i = 1; i < radialSegments; i++) {
        const angle = (i / radialSegments) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        points.push({
          position: new THREE.Vector3(
            position.x * cos - position.z * sin,
            position.y,
            position.x * sin + position.z * cos
          ),
          normal: new THREE.Vector3(
            normal.x * cos - normal.z * sin,
            normal.y,
            normal.x * sin + normal.z * cos
          ),
        });
      }
      break;
  }
  
  return points;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Brush3DEngine;

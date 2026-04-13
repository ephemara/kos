/**
 * KWeight Engine - Core weight painting logic
 * 
 * Manages vertex groups, weight painting operations, and weight visualization.
 * Provides the main interface for weight painting functionality.
 */

import * as THREE from 'three';
import { BrushSystem, BrushSettings } from './brushSystem';
import { WeightVisualization, VisualizationMode } from './visualization';
import { WeightTransfer, TransferSettings } from './transfer';

export interface VertexGroup {
  id: string;
  name: string;
  weights: Map<number, number>; // vertex index -> weight value [0, 1]
  color: THREE.Color;
  visible: boolean;
  locked: boolean;
}

export interface WeightPaintSettings {
  strength: number; // [0, 1]
  radius: number;
  falloff: 'linear' | 'smooth' | 'sharp' | 'constant';
  mode: 'add' | 'subtract' | 'mix' | 'blur';
  autoNormalize: boolean;
  symmetry: {
    enabled: boolean;
    axis: 'x' | 'y' | 'z';
    threshold: number;
  };
}

export interface WeightEngineState {
  mesh: THREE.Mesh | null;
  vertexGroups: Map<string, VertexGroup>;
  activeGroupId: string | null;
  paintSettings: WeightPaintSettings;
  visualizationMode: VisualizationMode;
  selectedVertices: Set<number>;
  history: WeightHistoryEntry[];
  historyIndex: number;
}

interface WeightHistoryEntry {
  groupId: string;
  changes: Map<number, { old: number; new: number }>;
  timestamp: number;
}

export class WeightEngine {
  private state: WeightEngineState;
  private brushSystem: BrushSystem;
  private visualization: WeightVisualization;
  private transfer: WeightTransfer;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  constructor() {
    this.state = {
      mesh: null,
      vertexGroups: new Map(),
      activeGroupId: null,
      paintSettings: {
        strength: 0.5,
        radius: 0.1,
        falloff: 'smooth',
        mode: 'mix',
        autoNormalize: true,
        symmetry: {
          enabled: false,
          axis: 'x',
          threshold: 0.001,
        },
      },
      visualizationMode: 'gradient',
      selectedVertices: new Set(),
      history: [],
      historyIndex: -1,
    };

    this.brushSystem = new BrushSystem();
    this.visualization = new WeightVisualization();
    this.transfer = new WeightTransfer();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  // Mesh Management
  setMesh(mesh: THREE.Mesh): void {
    this.state.mesh = mesh;
    this.visualization.setMesh(mesh);
    this.brushSystem.setMesh(mesh);
  }

  getMesh(): THREE.Mesh | null {
    return this.state.mesh;
  }

  // Vertex Group Management
  createVertexGroup(name: string): string {
    const id = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const group: VertexGroup = {
      id,
      name,
      weights: new Map(),
      color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
      visible: true,
      locked: false,
    };
    this.state.vertexGroups.set(id, group);
    return id;
  }

  deleteVertexGroup(groupId: string): boolean {
    if (this.state.activeGroupId === groupId) {
      this.state.activeGroupId = null;
    }
    return this.state.vertexGroups.delete(groupId);
  }

  renameVertexGroup(groupId: string, newName: string): boolean {
    const group = this.state.vertexGroups.get(groupId);
    if (!group) return false;
    group.name = newName;
    return true;
  }

  getVertexGroup(groupId: string): VertexGroup | undefined {
    return this.state.vertexGroups.get(groupId);
  }

  getAllVertexGroups(): VertexGroup[] {
    return Array.from(this.state.vertexGroups.values());
  }

  setActiveGroup(groupId: string | null): void {
    this.state.activeGroupId = groupId;
    if (groupId) {
      this.visualization.setActiveGroup(groupId, this.state.vertexGroups.get(groupId)!);
    }
  }

  getActiveGroup(): VertexGroup | null {
    if (!this.state.activeGroupId) return null;
    return this.state.vertexGroups.get(this.state.activeGroupId) || null;
  }

  // Weight Assignment
  setVertexWeight(groupId: string, vertexIndex: number, weight: number): void {
    const group = this.state.vertexGroups.get(groupId);
    if (!group || group.locked) return;

    weight = Math.max(0, Math.min(1, weight));
    
    if (weight === 0) {
      group.weights.delete(vertexIndex);
    } else {
      group.weights.set(vertexIndex, weight);
    }

    if (this.state.paintSettings.autoNormalize) {
      this.normalizeVertexWeights(vertexIndex);
    }
  }

  getVertexWeight(groupId: string, vertexIndex: number): number {
    const group = this.state.vertexGroups.get(groupId);
    return group?.weights.get(vertexIndex) || 0;
  }

  // Weight Painting
  paintWeights(
    position: THREE.Vector3,
    camera: THREE.Camera,
    strength: number = this.state.paintSettings.strength
  ): void {
    if (!this.state.mesh || !this.state.activeGroupId) return;

    const group = this.state.vertexGroups.get(this.state.activeGroupId);
    if (!group || group.locked) return;

    const affectedVertices = this.brushSystem.getAffectedVertices(
      position,
      this.state.paintSettings.radius,
      this.state.paintSettings.falloff
    );

    const changes = new Map<number, { old: number; new: number }>();

    affectedVertices.forEach(({ index, influence }) => {
      const oldWeight = group.weights.get(index) || 0;
      let newWeight = oldWeight;

      switch (this.state.paintSettings.mode) {
        case 'add':
          newWeight = Math.min(1, oldWeight + strength * influence);
          break;
        case 'subtract':
          newWeight = Math.max(0, oldWeight - strength * influence);
          break;
        case 'mix':
          newWeight = oldWeight + (strength - oldWeight) * influence;
          break;
        case 'blur':
          newWeight = this.getBlurredWeight(index, group);
          break;
      }

      if (Math.abs(newWeight - oldWeight) > 0.001) {
        changes.set(index, { old: oldWeight, new: newWeight });
        this.setVertexWeight(this.state.activeGroupId!, index, newWeight);
      }
    });

    // Handle symmetry
    if (this.state.paintSettings.symmetry.enabled && changes.size > 0) {
      this.applySymmetry(changes, group);
    }

    // Record history
    if (changes.size > 0) {
      this.recordHistory(this.state.activeGroupId, changes);
    }

    // Update visualization
    this.visualization.updateWeights(group);
  }

  // Weight Smoothing
  smoothWeights(groupId: string, vertexIndices: number[], iterations: number = 1): void {
    const group = this.state.vertexGroups.get(groupId);
    if (!group || group.locked || !this.state.mesh) return;

    const geometry = this.state.mesh.geometry;
    const position = geometry.attributes.position;

    for (let iter = 0; iter < iterations; iter++) {
      const newWeights = new Map<number, number>();

      vertexIndices.forEach(index => {
        const neighbors = this.getVertexNeighbors(index);
        if (neighbors.length === 0) return;

        let sum = group.weights.get(index) || 0;
        let count = 1;

        neighbors.forEach(neighborIndex => {
          sum += group.weights.get(neighborIndex) || 0;
          count++;
        });

        newWeights.set(index, sum / count);
      });

      newWeights.forEach((weight, index) => {
        this.setVertexWeight(groupId, index, weight);
      });
    }

    this.visualization.updateWeights(group);
  }

  // Weight Normalization
  normalizeVertexWeights(vertexIndex: number): void {
    let totalWeight = 0;
    const groupWeights: Array<{ groupId: string; weight: number }> = [];

    this.state.vertexGroups.forEach((group, groupId) => {
      const weight = group.weights.get(vertexIndex) || 0;
      if (weight > 0) {
        totalWeight += weight;
        groupWeights.push({ groupId, weight });
      }
    });

    // If no weights, nothing to normalize
    if (totalWeight === 0) return;
    
    // If already normalized (within tight tolerance), skip
    if (Math.abs(totalWeight - 1.0) < 0.00001) return;

    groupWeights.forEach(({ groupId, weight }) => {
      const normalizedWeight = weight / totalWeight;
      const group = this.state.vertexGroups.get(groupId);
      if (group) {
        group.weights.set(vertexIndex, normalizedWeight);
      }
    });
  }

  normalizeAllWeights(): void {
    if (!this.state.mesh) return;
    const vertexCount = this.state.mesh.geometry.attributes.position.count;
    for (let i = 0; i < vertexCount; i++) {
      this.normalizeVertexWeights(i);
    }
  }

  // Selection
  selectVerticesByWeight(groupId: string, min: number, max: number): void {
    const group = this.state.vertexGroups.get(groupId);
    if (!group || !this.state.mesh) return;

    this.state.selectedVertices.clear();
    const vertexCount = this.state.mesh.geometry.attributes.position.count;

    for (let i = 0; i < vertexCount; i++) {
      const weight = group.weights.get(i) || 0;
      if (weight >= min && weight <= max) {
        this.state.selectedVertices.add(i);
      }
    }
  }

  selectVerticesByGroup(groupId: string): void {
    const group = this.state.vertexGroups.get(groupId);
    if (!group) return;

    this.state.selectedVertices.clear();
    group.weights.forEach((_, index) => {
      this.state.selectedVertices.add(index);
    });
  }

  getSelectedVertices(): Set<number> {
    return new Set(this.state.selectedVertices);
  }

  clearSelection(): void {
    this.state.selectedVertices.clear();
  }

  // Weight Transfer
  transferWeights(
    sourceGroupId: string,
    targetMesh: THREE.Mesh,
    settings: TransferSettings
  ): Map<number, number> {
    const sourceGroup = this.state.vertexGroups.get(sourceGroupId);
    if (!sourceGroup || !this.state.mesh) {
      return new Map();
    }

    return this.transfer.transferWeights(
      this.state.mesh,
      sourceGroup,
      targetMesh,
      settings
    );
  }

  // Visualization
  setVisualizationMode(mode: VisualizationMode): void {
    this.state.visualizationMode = mode;
    this.visualization.setMode(mode);
  }

  getVisualizationMode(): VisualizationMode {
    return this.state.visualizationMode;
  }

  updateVisualization(): void {
    const activeGroup = this.getActiveGroup();
    if (activeGroup) {
      this.visualization.updateWeights(activeGroup);
    }
  }

  /**
   * Set custom gradient for weight visualization
   */
  setVisualizationGradient(stops: Array<{ position: number; color: THREE.Color }>): void {
    this.visualization.setGradient(stops);
  }

  /**
   * Get current visualization gradient
   */
  getVisualizationGradient(): Array<{ position: number; color: THREE.Color }> {
    return this.visualization.getGradient();
  }

  /**
   * Set visualization lighting parameters
   */
  setVisualizationLighting(params: {
    lightDirection?: THREE.Vector3;
    lightColor?: THREE.Color;
    ambientIntensity?: number;
    diffuseIntensity?: number;
    specularIntensity?: number;
    shininess?: number;
  }): void {
    this.visualization.setLightingParams(params);
  }

  /**
   * Set visualization opacity
   */
  setVisualizationOpacity(opacity: number): void {
    this.visualization.setOpacity(opacity);
  }

  /**
   * Update camera position for visualization (call each frame)
   */
  updateVisualizationCamera(camera: THREE.Camera): void {
    this.visualization.updateCameraPosition(camera);
  }

  // Settings
  setPaintSettings(settings: Partial<WeightPaintSettings>): void {
    this.state.paintSettings = { ...this.state.paintSettings, ...settings };
  }

  getPaintSettings(): WeightPaintSettings {
    return { ...this.state.paintSettings };
  }

  // History (Undo/Redo)
  private recordHistory(groupId: string, changes: Map<number, { old: number; new: number }>): void {
    // Remove any redo history
    this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);

    this.state.history.push({
      groupId,
      changes,
      timestamp: Date.now(),
    });

    this.state.historyIndex++;

    // Limit history size
    const maxHistory = 100;
    if (this.state.history.length > maxHistory) {
      this.state.history.shift();
      this.state.historyIndex--;
    }
  }

  undo(): boolean {
    if (this.state.historyIndex < 0) return false;

    const entry = this.state.history[this.state.historyIndex];
    const group = this.state.vertexGroups.get(entry.groupId);
    if (!group) return false;

    entry.changes.forEach(({ old }, index) => {
      if (old === 0) {
        group.weights.delete(index);
      } else {
        group.weights.set(index, old);
      }
    });

    this.state.historyIndex--;
    this.visualization.updateWeights(group);
    return true;
  }

  redo(): boolean {
    if (this.state.historyIndex >= this.state.history.length - 1) return false;

    this.state.historyIndex++;
    const entry = this.state.history[this.state.historyIndex];
    const group = this.state.vertexGroups.get(entry.groupId);
    if (!group) return false;

    entry.changes.forEach(({ new: newWeight }, index) => {
      if (newWeight === 0) {
        group.weights.delete(index);
      } else {
        group.weights.set(index, newWeight);
      }
    });

    this.visualization.updateWeights(group);
    return true;
  }

  canUndo(): boolean {
    return this.state.historyIndex >= 0;
  }

  canRedo(): boolean {
    return this.state.historyIndex < this.state.history.length - 1;
  }

  // Helper Methods
  private getBlurredWeight(vertexIndex: number, group: VertexGroup): number {
    const neighbors = this.getVertexNeighbors(vertexIndex);
    if (neighbors.length === 0) return group.weights.get(vertexIndex) || 0;

    let sum = group.weights.get(vertexIndex) || 0;
    let count = 1;

    neighbors.forEach(neighborIndex => {
      sum += group.weights.get(neighborIndex) || 0;
      count++;
    });

    return sum / count;
  }

  private getVertexNeighbors(vertexIndex: number): number[] {
    if (!this.state.mesh) return [];

    const geometry = this.state.mesh.geometry;
    const index = geometry.index;
    if (!index) return [];

    const neighbors = new Set<number>();
    const indexArray = index.array;

    for (let i = 0; i < indexArray.length; i += 3) {
      const i0 = indexArray[i];
      const i1 = indexArray[i + 1];
      const i2 = indexArray[i + 2];

      if (i0 === vertexIndex) {
        neighbors.add(i1);
        neighbors.add(i2);
      } else if (i1 === vertexIndex) {
        neighbors.add(i0);
        neighbors.add(i2);
      } else if (i2 === vertexIndex) {
        neighbors.add(i0);
        neighbors.add(i1);
      }
    }

    return Array.from(neighbors);
  }

  private applySymmetry(
    changes: Map<number, { old: number; new: number }>,
    group: VertexGroup
  ): void {
    if (!this.state.mesh) return;

    const geometry = this.state.mesh.geometry;
    const position = geometry.attributes.position;
    const { axis, threshold } = this.state.paintSettings.symmetry;
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;

    changes.forEach(({ new: newWeight }, index) => {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);

      // Find symmetric vertex
      for (let i = 0; i < position.count; i++) {
        if (i === index) continue;

        const sx = position.getX(i);
        const sy = position.getY(i);
        const sz = position.getZ(i);

        let isSymmetric = false;
        if (axisIndex === 0) {
          isSymmetric = Math.abs(sx + x) < threshold && Math.abs(sy - y) < threshold && Math.abs(sz - z) < threshold;
        } else if (axisIndex === 1) {
          isSymmetric = Math.abs(sx - x) < threshold && Math.abs(sy + y) < threshold && Math.abs(sz - z) < threshold;
        } else {
          isSymmetric = Math.abs(sx - x) < threshold && Math.abs(sy - y) < threshold && Math.abs(sz + z) < threshold;
        }

        if (isSymmetric) {
          this.setVertexWeight(group.id, i, newWeight);
          break;
        }
      }
    });
  }

  // Export/Import
  exportWeights(): Record<string, any> {
    const data: Record<string, any> = {
      version: '1.0',
      groups: [],
    };

    this.state.vertexGroups.forEach(group => {
      data.groups.push({
        id: group.id,
        name: group.name,
        color: group.color.getHex(),
        weights: Array.from(group.weights.entries()),
      });
    });

    return data;
  }

  importWeights(data: Record<string, any>): void {
    if (data.version !== '1.0') {
      console.warn('Unsupported weight data version');
      return;
    }

    this.state.vertexGroups.clear();

    data.groups.forEach((groupData: any) => {
      const group: VertexGroup = {
        id: groupData.id,
        name: groupData.name,
        weights: new Map(groupData.weights),
        color: new THREE.Color(groupData.color),
        visible: true,
        locked: false,
      };
      this.state.vertexGroups.set(group.id, group);
    });
  }

  // Cleanup
  dispose(): void {
    this.brushSystem.dispose();
    this.visualization.dispose();
    this.transfer.dispose();
  }
}

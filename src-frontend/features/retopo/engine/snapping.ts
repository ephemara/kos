import * as THREE from 'three';

/**
 * Surface snapping system for retopology
 * Projects drawn points onto the reference mesh surface
 */
export class SnappingSystem {
  private referenceMesh: THREE.Mesh | null = null;
  private raycaster: THREE.Raycaster;
  private enabled = true;
  private snapDistance = 0.1;

  constructor() {
    this.raycaster = new THREE.Raycaster();
  }

  /**
   * Set the reference mesh for snapping
   */
  setReferenceMesh(mesh: THREE.Mesh): void {
    this.referenceMesh = mesh;

    // Ensure mesh has BVH for fast raycasting
    // @ts-ignore - three-mesh-bvh adds this method
    if (mesh.geometry.computeBoundsTree) {
      // @ts-ignore
      mesh.geometry.computeBoundsTree();
    }
  }

  /**
   * Enable or disable snapping
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Set the snap distance threshold
   */
  setSnapDistance(distance: number): void {
    this.snapDistance = distance;
  }

  /**
   * Snap a point to the reference surface
   * Returns the snapped position or original if no snap found
   */
  snapToSurface(point: THREE.Vector3, direction?: THREE.Vector3): THREE.Vector3 {
    if (!this.enabled || !this.referenceMesh) {
      return point.clone();
    }

    // Try multiple directions to find closest surface point
    const directions = direction ? [direction] : [
      new THREE.Vector3(0, -1, 0),  // Down
      new THREE.Vector3(0, 1, 0),   // Up
      new THREE.Vector3(1, 0, 0),   // Right
      new THREE.Vector3(-1, 0, 0),  // Left
      new THREE.Vector3(0, 0, 1),   // Forward
      new THREE.Vector3(0, 0, -1),  // Back
    ];

    let closestPoint: THREE.Vector3 | null = null;
    let closestDistance = Infinity;

    for (const dir of directions) {
      // Cast ray from point in direction
      this.raycaster.set(point, dir.clone().normalize());
      const intersects = this.raycaster.intersectObject(this.referenceMesh, false);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const distance = point.distanceTo(hit.point);

        if (distance < closestDistance && distance <= this.snapDistance) {
          closestDistance = distance;
          closestPoint = hit.point.clone();
        }
      }

      // Try opposite direction
      this.raycaster.set(point, dir.clone().negate().normalize());
      const intersectsBack = this.raycaster.intersectObject(this.referenceMesh, false);

      if (intersectsBack.length > 0) {
        const hit = intersectsBack[0];
        const distance = point.distanceTo(hit.point);

        if (distance < closestDistance && distance <= this.snapDistance) {
          closestDistance = distance;
          closestPoint = hit.point.clone();
        }
      }
    }

    // Return closest point if found, otherwise original
    return closestPoint || point.clone();
  }

  /**
   * Project a point onto the surface along camera view direction
   */
  projectToSurface(
    point: THREE.Vector3,
    camera: THREE.Camera
  ): THREE.Vector3 | null {
    if (!this.referenceMesh) {
      return null;
    }

    // Get ray direction from camera through point
    const direction = new THREE.Vector3();
    direction.subVectors(point, camera.position).normalize();

    // Cast ray
    this.raycaster.set(camera.position, direction);
    const intersects = this.raycaster.intersectObject(this.referenceMesh, false);

    if (intersects.length > 0) {
      return intersects[0].point.clone();
    }

    return null;
  }

  /**
   * Find the closest point on the surface to a given point
   */
  closestPointOnSurface(point: THREE.Vector3): THREE.Vector3 | null {
    if (!this.referenceMesh) {
      return null;
    }

    // Cast rays in multiple directions to find closest hit
    const directions = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];

    let closestPoint: THREE.Vector3 | null = null;
    let closestDistance = Infinity;

    for (const dir of directions) {
      this.raycaster.set(point, dir);
      const intersects = this.raycaster.intersectObject(this.referenceMesh, false);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const distance = point.distanceTo(hit.point);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = hit.point.clone();
        }
      }
    }

    return closestPoint;
  }

  /**
   * Get the surface normal at a point
   */
  getSurfaceNormal(point: THREE.Vector3): THREE.Vector3 | null {
    if (!this.referenceMesh) {
      return null;
    }

    // Find closest surface point
    const surfacePoint = this.closestPointOnSurface(point);
    if (!surfacePoint) {
      return null;
    }

    // Cast ray to get intersection with normal
    const direction = new THREE.Vector3().subVectors(surfacePoint, point).normalize();
    this.raycaster.set(point, direction);
    const intersects = this.raycaster.intersectObject(this.referenceMesh, false);

    if (intersects.length > 0) {
      return intersects[0].face?.normal.clone() || null;
    }

    return null;
  }
}

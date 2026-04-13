import * as THREE from 'three';

export interface Edge {
  v1: number;
  v2: number;
}

export interface Face {
  vertices: number[];
}

export interface TopologyStats {
  vertices: number;
  edges: number;
  faces: number;
  quads: number;
  tris: number;
  ngons: number;
}

/**
 * Topology manipulation tools for retopology
 * Handles edge loops, edge operations, and topology analysis
 */
export class TopologyTools {
  /**
   * Insert an edge loop at the specified position
   * Finds parallel edges and inserts new vertices/edges between them
   * Position is a value between 0 and 1 (0 = at v1, 1 = at v2)
   */
  insertEdgeLoop(mesh: THREE.Mesh, edge: Edge, position: number = 0.5): void {
    const geometry = mesh.geometry;
    const positionAttr = geometry.getAttribute('position');
    const index = geometry.getIndex();

    if (!positionAttr || !index) {
      console.warn('Geometry missing position or index attributes');
      return;
    }

    // Clamp position to valid range
    position = Math.max(0, Math.min(1, position));

    // Find all faces that share this edge
    const facesWithEdge = this.findFacesWithEdge(index, edge);
    
    if (facesWithEdge.length === 0) {
      console.warn('Edge not found in mesh');
      return;
    }

    // Find parallel edges in the loop
    const loopEdges = this.findEdgeLoop(index, edge);
    
    if (loopEdges.length === 0) {
      console.warn('Could not find edge loop');
      return;
    }

    // Create new vertices along each edge in the loop
    const newVertices: THREE.Vector3[] = [];
    const edgeToNewVertex = new Map<string, number>();
    
    const positions = positionAttr.array as Float32Array;
    const newPositions: number[] = Array.from(positions);
    
    loopEdges.forEach(loopEdge => {
      const v1 = new THREE.Vector3(
        positions[loopEdge.v1 * 3],
        positions[loopEdge.v1 * 3 + 1],
        positions[loopEdge.v1 * 3 + 2]
      );
      const v2 = new THREE.Vector3(
        positions[loopEdge.v2 * 3],
        positions[loopEdge.v2 * 3 + 1],
        positions[loopEdge.v2 * 3 + 2]
      );

      // Interpolate new vertex position
      const newVertex = v1.clone().lerp(v2, position);
      newVertices.push(newVertex);

      // Add to position array
      const newVertexIndex = newPositions.length / 3;
      newPositions.push(newVertex.x, newVertex.y, newVertex.z);
      
      edgeToNewVertex.set(this.edgeKey(loopEdge.v1, loopEdge.v2), newVertexIndex);
    });

    // Update geometry with new vertices
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newPositions), 3));

    // Split faces that contain loop edges
    const newIndices: number[] = [];
    
    for (let i = 0; i < index.count; i += 3) {
      const v0 = index.getX(i);
      const v1 = index.getX(i + 1);
      const v2 = index.getX(i + 2);

      // Check if this face contains any loop edges
      const edges = [
        { v1: v0, v2: v1 },
        { v1: v1, v2: v2 },
        { v1: v2, v2: v0 }
      ];

      const newVertexIndices = edges.map(e => 
        edgeToNewVertex.get(this.edgeKey(e.v1, e.v2))
      );

      const hasNewVertices = newVertexIndices.some(idx => idx !== undefined);

      if (!hasNewVertices) {
        // Face not affected, keep as is
        newIndices.push(v0, v1, v2);
      } else {
        // Face needs to be split
        // This is a simplified implementation - proper quad subdivision would be more complex
        newIndices.push(v0, v1, v2);
      }
    }

    geometry.setIndex(newIndices);
    geometry.computeVertexNormals();
  }

  /**
   * Dissolve an edge (merge adjacent faces)
   * Removes the edge and merges the two adjacent faces into one
   */
  dissolveEdge(mesh: THREE.Mesh, edge: Edge): void {
    const geometry = mesh.geometry;
    const index = geometry.getIndex();

    if (!index) {
      console.warn('Geometry missing index attribute');
      return;
    }

    // Find the two faces that share this edge
    const facesWithEdge = this.findFacesWithEdge(index, edge);

    if (facesWithEdge.length !== 2) {
      console.warn('Edge must be shared by exactly 2 faces to dissolve');
      return;
    }

    const [face1, face2] = facesWithEdge;

    // Get all vertices from both faces
    const face1Verts = [
      index.getX(face1 * 3),
      index.getX(face1 * 3 + 1),
      index.getX(face1 * 3 + 2)
    ];

    const face2Verts = [
      index.getX(face2 * 3),
      index.getX(face2 * 3 + 1),
      index.getX(face2 * 3 + 2)
    ];

    // Find the vertices that are NOT part of the shared edge
    const allVerts = new Set([...face1Verts, ...face2Verts]);
    allVerts.delete(edge.v1);
    allVerts.delete(edge.v2);

    const remainingVerts = Array.from(allVerts);

    if (remainingVerts.length !== 2) {
      console.warn('Unexpected vertex configuration for edge dissolve');
      return;
    }

    // Create new quad from the 4 vertices (2 from edge + 2 remaining)
    // Order matters for proper face orientation
    const newFaceVerts = [edge.v1, remainingVerts[0], edge.v2, remainingVerts[1]];

    // Rebuild index array without the two old faces
    const newIndices: number[] = [];
    
    for (let i = 0; i < index.count; i += 3) {
      const faceIndex = i / 3;
      
      if (faceIndex !== face1 && faceIndex !== face2) {
        // Keep this face
        newIndices.push(
          index.getX(i),
          index.getX(i + 1),
          index.getX(i + 2)
        );
      }
    }

    // Add the new merged face (as two triangles for now)
    newIndices.push(
      newFaceVerts[0], newFaceVerts[1], newFaceVerts[2],
      newFaceVerts[0], newFaceVerts[2], newFaceVerts[3]
    );

    geometry.setIndex(newIndices);
    geometry.computeVertexNormals();
  }

  /**
   * Collapse an edge (merge vertices)
   * Merges v2 into v1, updating all connected faces
   */
  collapseEdge(mesh: THREE.Mesh, edge: Edge): void {
    const geometry = mesh.geometry;
    const positionAttr = geometry.getAttribute('position');
    const index = geometry.getIndex();

    if (!positionAttr || !index) {
      console.warn('Geometry missing position or index attributes');
      return;
    }

    const positions = positionAttr.array as Float32Array;

    // Calculate midpoint for the collapsed vertex
    const v1Pos = new THREE.Vector3(
      positions[edge.v1 * 3],
      positions[edge.v1 * 3 + 1],
      positions[edge.v1 * 3 + 2]
    );

    const v2Pos = new THREE.Vector3(
      positions[edge.v2 * 3],
      positions[edge.v2 * 3 + 1],
      positions[edge.v2 * 3 + 2]
    );

    const midpoint = v1Pos.clone().lerp(v2Pos, 0.5);

    // Update v1 position to midpoint
    positions[edge.v1 * 3] = midpoint.x;
    positions[edge.v1 * 3 + 1] = midpoint.y;
    positions[edge.v1 * 3 + 2] = midpoint.z;

    // Update all references to v2 to point to v1
    const newIndices: number[] = [];
    const facesToRemove = new Set<number>();

    // Find faces that use the edge (these will be degenerate after collapse)
    const facesWithEdge = this.findFacesWithEdge(index, edge);
    facesWithEdge.forEach(faceIdx => facesToRemove.add(faceIdx));

    // Rebuild index array
    for (let i = 0; i < index.count; i += 3) {
      const faceIndex = i / 3;

      if (facesToRemove.has(faceIndex)) {
        // Skip degenerate faces
        continue;
      }

      let v0 = index.getX(i);
      let v1 = index.getX(i + 1);
      let v2 = index.getX(i + 2);

      // Replace v2 references with v1
      if (v0 === edge.v2) v0 = edge.v1;
      if (v1 === edge.v2) v1 = edge.v1;
      if (v2 === edge.v2) v2 = edge.v1;

      // Check for degenerate triangle (all vertices the same)
      if (v0 === v1 || v1 === v2 || v2 === v0) {
        continue; // Skip degenerate
      }

      newIndices.push(v0, v1, v2);
    }

    geometry.setIndex(newIndices);
    geometry.setAttribute('position', positionAttr);
    geometry.computeVertexNormals();
  }

  /**
   * Subdivide a quad face into 4 quads (Catmull-Clark style)
   * Creates a center vertex and edge midpoints, then connects them
   */
  subdivideQuad(mesh: THREE.Mesh, face: Face): void {
    if (face.vertices.length !== 4) {
      console.warn('Can only subdivide quad faces');
      return;
    }

    const geometry = mesh.geometry;
    const positionAttr = geometry.getAttribute('position');
    const index = geometry.getIndex();

    if (!positionAttr || !index) {
      console.warn('Geometry missing position or index attributes');
      return;
    }

    const positions = positionAttr.array as Float32Array;
    const newPositions: number[] = Array.from(positions);

    // Get the 4 corner vertices
    const corners = face.vertices.map(vIdx => new THREE.Vector3(
      positions[vIdx * 3],
      positions[vIdx * 3 + 1],
      positions[vIdx * 3 + 2]
    ));

    // Calculate face center (average of 4 corners)
    const center = new THREE.Vector3();
    corners.forEach(c => center.add(c));
    center.divideScalar(4);

    // Calculate edge midpoints
    const edgeMidpoints = [
      corners[0].clone().lerp(corners[1], 0.5), // Edge 0-1
      corners[1].clone().lerp(corners[2], 0.5), // Edge 1-2
      corners[2].clone().lerp(corners[3], 0.5), // Edge 2-3
      corners[3].clone().lerp(corners[0], 0.5), // Edge 3-0
    ];

    // Add new vertices to geometry
    const centerIdx = newPositions.length / 3;
    newPositions.push(center.x, center.y, center.z);

    const midpointIndices = edgeMidpoints.map(mp => {
      const idx = newPositions.length / 3;
      newPositions.push(mp.x, mp.y, mp.z);
      return idx;
    });

    // Update position attribute
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newPositions), 3));

    // Find and remove the original face from indices
    const newIndices: number[] = [];
    let faceRemoved = false;

    for (let i = 0; i < index.count; i += 3) {
      const v0 = index.getX(i);
      const v1 = index.getX(i + 1);
      const v2 = index.getX(i + 2);

      // Check if this is part of the face we're subdividing
      const faceVerts = [v0, v1, v2];
      const isTargetFace = face.vertices.some(fv => faceVerts.includes(fv));

      if (isTargetFace && !faceRemoved) {
        // Skip the original face triangles (assuming quad is 2 triangles)
        faceRemoved = true;
        continue;
      }

      newIndices.push(v0, v1, v2);
    }

    // Create 4 new quads (each as 2 triangles)
    // Quad 0: corner[0] - midpoint[0] - center - midpoint[3]
    newIndices.push(
      face.vertices[0], midpointIndices[0], centerIdx,
      face.vertices[0], centerIdx, midpointIndices[3]
    );

    // Quad 1: midpoint[0] - corner[1] - midpoint[1] - center
    newIndices.push(
      midpointIndices[0], face.vertices[1], midpointIndices[1],
      midpointIndices[0], midpointIndices[1], centerIdx
    );

    // Quad 2: center - midpoint[1] - corner[2] - midpoint[2]
    newIndices.push(
      centerIdx, midpointIndices[1], face.vertices[2],
      centerIdx, face.vertices[2], midpointIndices[2]
    );

    // Quad 3: midpoint[3] - center - midpoint[2] - corner[3]
    newIndices.push(
      midpointIndices[3], centerIdx, midpointIndices[2],
      midpointIndices[3], midpointIndices[2], face.vertices[3]
    );

    geometry.setIndex(newIndices);
    geometry.computeVertexNormals();
  }

  /**
   * Analyze topology and return statistics
   */
  analyzeTopology(geometry: THREE.BufferGeometry): TopologyStats {
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex();

    if (!position || !index) {
      return {
        vertices: 0,
        edges: 0,
        faces: 0,
        quads: 0,
        tris: 0,
        ngons: 0,
      };
    }

    const vertexCount = position.count;
    const faceCount = index.count / 3; // Assuming triangulated

    // Build edge set
    const edges = new Set<string>();
    for (let i = 0; i < index.count; i += 3) {
      const v1 = index.getX(i);
      const v2 = index.getX(i + 1);
      const v3 = index.getX(i + 2);

      // Add edges (sorted to avoid duplicates)
      edges.add(this.edgeKey(v1, v2));
      edges.add(this.edgeKey(v2, v3));
      edges.add(this.edgeKey(v3, v1));
    }

    // Count face types
    // For now, assume all triangles (quads would be stored differently)
    const tris = faceCount;
    const quads = 0;
    const ngons = 0;

    return {
      vertices: vertexCount,
      edges: edges.size,
      faces: faceCount,
      quads,
      tris,
      ngons,
    };
  }

  /**
   * Validate that mesh is manifold
   * (each edge shared by exactly 2 faces)
   */
  validateManifold(mesh: THREE.Mesh): boolean {
    const geometry = mesh.geometry;
    const index = geometry.getIndex();

    if (!index) {
      return false;
    }

    // Count edge usage
    const edgeCount = new Map<string, number>();

    for (let i = 0; i < index.count; i += 3) {
      const v1 = index.getX(i);
      const v2 = index.getX(i + 1);
      const v3 = index.getX(i + 2);

      // Count each edge
      this.incrementEdge(edgeCount, v1, v2);
      this.incrementEdge(edgeCount, v2, v3);
      this.incrementEdge(edgeCount, v3, v1);
    }

    // Check that all edges are used exactly twice
    for (const count of edgeCount.values()) {
      if (count !== 2) {
        return false;
      }
    }

    return true;
  }

  /**
   * Detect non-manifold edges
   */
  detectNonManifold(geometry: THREE.BufferGeometry): Edge[] {
    const index = geometry.getIndex();
    if (!index) return [];

    const edgeCount = new Map<string, number>();
    const edgeVertices = new Map<string, [number, number]>();

    for (let i = 0; i < index.count; i += 3) {
      const v1 = index.getX(i);
      const v2 = index.getX(i + 1);
      const v3 = index.getX(i + 2);

      this.trackEdge(edgeCount, edgeVertices, v1, v2);
      this.trackEdge(edgeCount, edgeVertices, v2, v3);
      this.trackEdge(edgeCount, edgeVertices, v3, v1);
    }

    // Find edges used more or less than twice
    const nonManifold: Edge[] = [];
    for (const [key, count] of edgeCount.entries()) {
      if (count !== 2) {
        const [v1, v2] = edgeVertices.get(key)!;
        nonManifold.push({ v1, v2 });
      }
    }

    return nonManifold;
  }

  /**
   * Detect self-intersections in the mesh
   */
  detectSelfIntersections(mesh: THREE.Mesh): boolean {
    // TODO: Implement BVH-based self-intersection detection
    // This would require three-mesh-bvh or similar
    console.log('Self-intersection detection not yet implemented');
    return false;
  }

  /**
   * Create a unique key for an edge (sorted vertices)
   */
  private edgeKey(v1: number, v2: number): string {
    return v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
  }

  /**
   * Increment edge count in map
   */
  private incrementEdge(map: Map<string, number>, v1: number, v2: number): void {
    const key = this.edgeKey(v1, v2);
    map.set(key, (map.get(key) || 0) + 1);
  }

  /**
   * Track edge vertices and count
   */
  private trackEdge(
    countMap: Map<string, number>,
    vertexMap: Map<string, [number, number]>,
    v1: number,
    v2: number
  ): void {
    const key = this.edgeKey(v1, v2);
    countMap.set(key, (countMap.get(key) || 0) + 1);
    if (!vertexMap.has(key)) {
      vertexMap.set(key, [v1, v2]);
    }
  }

  /**
   * Find all faces that contain the specified edge
   */
  private findFacesWithEdge(index: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, edge: Edge): number[] {
    const faces: number[] = [];

    for (let i = 0; i < index.count; i += 3) {
      const v0 = index.getX(i);
      const v1 = index.getX(i + 1);
      const v2 = index.getX(i + 2);

      // Check if this face contains the edge
      const hasEdge = 
        (v0 === edge.v1 && v1 === edge.v2) ||
        (v0 === edge.v2 && v1 === edge.v1) ||
        (v1 === edge.v1 && v2 === edge.v2) ||
        (v1 === edge.v2 && v2 === edge.v1) ||
        (v2 === edge.v1 && v0 === edge.v2) ||
        (v2 === edge.v2 && v0 === edge.v1);

      if (hasEdge) {
        faces.push(i / 3);
      }
    }

    return faces;
  }

  /**
   * Find an edge loop starting from the given edge
   * Returns all edges in the loop
   */
  private findEdgeLoop(index: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, startEdge: Edge): Edge[] {
    const loop: Edge[] = [startEdge];
    
    // Build edge-to-faces map
    const edgeToFaces = new Map<string, number[]>();
    
    for (let i = 0; i < index.count; i += 3) {
      const v0 = index.getX(i);
      const v1 = index.getX(i + 1);
      const v2 = index.getX(i + 2);
      
      const edges = [
        { v1: v0, v2: v1 },
        { v1: v1, v2: v2 },
        { v1: v2, v2: v0 }
      ];
      
      edges.forEach(e => {
        const key = this.edgeKey(e.v1, e.v2);
        if (!edgeToFaces.has(key)) {
          edgeToFaces.set(key, []);
        }
        edgeToFaces.get(key)!.push(i / 3);
      });
    }

    // For now, return just the starting edge
    // A full implementation would traverse parallel edges
    // This is a simplified version for the MVP
    return loop;
  }
}

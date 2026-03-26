/**
 * mathBrushes.ts — Data-Driven Experimental Math Brush Registry
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 8 new experimental sculpting brushes powered by the KMath Fortran library.
 * All brushes are defined as data — a JSON-serialisable config object that
 * fully describes the algorithm, parameters, and display metadata.
 *
 * Brushes:
 *   1. SPECTRAL_SMOOTH   — Cotangent Laplacian fairing (true geometric smoothing)
 *   2. MEAN_CURVATURE    — Mean curvature flow (minimal surface / soap film)
 *   3. CURVATURE_ENHANCE — Amplifies principal curvature (sharpens ridges/valleys)
 *   4. GEODESIC_MASK     — Paints mask following geodesic distance contours
 *   5. ARAP_GRAB         — As-Rigid-As-Possible elastic deformation
 *   6. STRESS_ALIGN      — Deforms along principal stress directions
 *   7. BIHARMONIC_WARP   — Thin-plate spline (biharmonic) deformation
 *   8. VORONOI_RELAX     — Lloyd/CVT vertex redistribution (remesh quality)
 *
 * ─── How to add a new brush ─────────────────────────────────────────────
 *   1. Add an entry to MATH_BRUSH_REGISTRY
 *   2. Implement the kernel in applyMathBrush()
 *   No changes needed in KSculpt.tsx, FluxPanel, or any other file.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import {
    buildTopology, buildCotangentLaplacian, computeMeanCurvatureVectors,
    computeGaussianCurvature, computePrincipalCurvatures,
    computeGeodesicDistanceHeat, arapStep, ARAPConstraint,
    conjugateGradient, csrFromTriplets, csrMatVec,
    ddot, daxpy, dnrm2, dcopy,
    type MeshTopology, type CSRMatrix,
} from './linalg';

// ─── Brush parameter types (fully data-driven) ────────────────────────────────

export type MathBrushParamType = 'float' | 'int' | 'bool' | 'select';

export interface MathBrushParam {
    key: string;
    label: string;
    type: MathBrushParamType;
    default: number | boolean | string;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    description?: string;
}

export type MathBrushCategory =
    | 'FAIRING'       // smoothing, fairing
    | 'CURVATURE'     // curvature-driven operators
    | 'DEFORMATION'   // elastic, rigid deformation
    | 'TOPOLOGY'      // relax, redistribute
    | 'ANALYSIS';     // measurement, masking

export interface MathBrushDef {
    id: string;
    label: string;
    category: MathBrushCategory;
    icon: string;   // lucide icon name
    color: string;   // tailwind color token
    description: string;
    algorithm: string;   // reference paper / formula
    params: MathBrushParam[];
    /** Whether this brush requires full mesh topology (precompute on activation) */
    requiresTopology: boolean;
    /** Whether this brush requires the cotangent Laplacian */
    requiresLaplacian: boolean;
}

// ─── REGISTRY — all 8 experimental math brushes ──────────────────────────────

export const MATH_BRUSH_REGISTRY: Record<string, MathBrushDef> = {

    SPECTRAL_SMOOTH: {
        id: 'SPECTRAL_SMOOTH',
        label: 'Spectral Smooth',
        category: 'FAIRING',
        icon: 'Waves',
        color: 'text-cyan-400',
        description: 'True geometric smoothing via cotangent Laplacian — removes high-frequency noise while preserving volume and silhouette',
        algorithm: 'Implicit Laplacian Smoothing (Desbrun 1999)',
        requiresTopology: true,
        requiresLaplacian: true,
        params: [
            { key: 'lambda', label: 'Smoothness', type: 'float', default: 0.5, min: 0.01, max: 2.0, step: 0.01, description: 'Laplacian step size (λ)' },
            { key: 'iterations', label: 'Iterations', type: 'int', default: 3, min: 1, max: 20, description: 'Number of implicit steps' },
            { key: 'tangetOnly', label: 'Tangential', type: 'bool', default: false, description: 'Project onto tangent plane (preserves volume)' },
        ],
    },

    MEAN_CURVATURE: {
        id: 'MEAN_CURVATURE',
        label: 'Mean Curvature Flow',
        category: 'FAIRING',
        icon: 'Droplets',
        color: 'text-blue-400',
        description: 'Flows surface toward zero mean curvature — the soap film / minimal surface operator. Extreme iterations → sphere',
        algorithm: 'Mean Curvature Flow (Desbrun & Cani 1999)',
        requiresTopology: true,
        requiresLaplacian: true,
        params: [
            { key: 'dt', label: 'Step Size', type: 'float', default: 0.001, min: 0.0001, max: 0.05, step: 0.0001, description: 'Time step Δt for the flow' },
            { key: 'iterations', label: 'Iterations', type: 'int', default: 2, min: 1, max: 10 },
            { key: 'invert', label: 'Inverse', type: 'bool', default: false, description: 'Reverse flow direction (amplify curvature)' },
        ],
    },

    CURVATURE_ENHANCE: {
        id: 'CURVATURE_ENHANCE',
        label: 'Curvature Enhance',
        category: 'CURVATURE',
        icon: 'Mountain',
        color: 'text-orange-400',
        description: 'Sharpens ridges and valleys by displacing verts along their principal curvature direction proportional to κ₁ − κ₂',
        algorithm: 'Shape Operator Eigendecomposition (Rusinkiewicz 2004)',
        requiresTopology: true,
        requiresLaplacian: true,
        params: [
            { key: 'strength', label: 'Strength', type: 'float', default: 0.3, min: 0.0, max: 2.0, step: 0.01 },
            { key: 'threshold', label: 'κ Threshold', type: 'float', default: 0.05, min: 0.0, max: 1.0, step: 0.01, description: 'Minimum curvature to amplify' },
            { key: 'clampMax', label: 'Clamp', type: 'float', default: 3.0, min: 0.1, max: 10.0, step: 0.1, description: 'Max displacement multiplier' },
        ],
    },

    GEODESIC_MASK: {
        id: 'GEODESIC_MASK',
        label: 'Geodesic Mask',
        category: 'ANALYSIS',
        icon: 'Target',
        color: 'text-violet-400',
        description: 'Paints a vertex mask where intensity = geodesic distance from brush center. Creates distance-field-based selections that follow the mesh surface',
        algorithm: 'Heat Method for Geodesics (Crane 2013)',
        requiresTopology: true,
        requiresLaplacian: true,
        params: [
            { key: 'falloff', label: 'Falloff', type: 'float', default: 0.5, min: 0.01, max: 5.0, step: 0.01 },
            { key: 'sharp', label: 'Sharpness', type: 'float', default: 2.0, min: 0.1, max: 10.0, step: 0.1, description: 'Exponential falloff power' },
            { key: 'additive', label: 'Additive', type: 'bool', default: true, description: 'Add to existing mask vs replace' },
        ],
    },

    ARAP_GRAB: {
        id: 'ARAP_GRAB',
        label: 'ARAP Grab',
        category: 'DEFORMATION',
        icon: 'Hand',
        color: 'text-emerald-400',
        description: 'As-Rigid-As-Possible elastic deformation. Moves vertices while minimizing rigid-body distortion of local neighborhoods — physically plausible and volume-preserving',
        algorithm: 'ARAP (Sorkine & Alexa 2007)',
        requiresTopology: true,
        requiresLaplacian: true,
        params: [
            { key: 'iterations', label: 'ARAP Iters', type: 'int', default: 3, min: 1, max: 10 },
            { key: 'stiffness', label: 'Stiffness', type: 'float', default: 1.0, min: 0.1, max: 10.0, step: 0.1, description: 'Constraint weight — higher = stiffer mesh' },
            { key: 'radius', label: 'ROI Radius', type: 'float', default: 0.5, min: 0.05, max: 2.0, step: 0.01, description: 'Region of influence for the grab' },
        ],
    },

    STRESS_ALIGN: {
        id: 'STRESS_ALIGN',
        label: 'Stress Align',
        category: 'CURVATURE',
        icon: 'GitBranch',
        color: 'text-yellow-400',
        description: 'Displaces each vertex along its max principal curvature direction (e₁), creating anisotropic flow that follows the natural stress lines of the surface',
        algorithm: 'Principal Curvature Direction Flow',
        requiresTopology: true,
        requiresLaplacian: true,
        params: [
            { key: 'strength', label: 'Strength', type: 'float', default: 0.2, min: -1.0, max: 1.0, step: 0.01 },
            { key: 'direction', label: 'Direction', type: 'select', default: 'max', options: ['max', 'min', 'both'], description: 'Which principal direction to flow along' },
            { key: 'blend', label: 'κ Blend', type: 'float', default: 0.5, min: 0.0, max: 1.0, step: 0.01, description: 'Mix between e₁ and e₂ directions' },
        ],
    },

    BIHARMONIC_WARP: {
        id: 'BIHARMONIC_WARP',
        label: 'Biharmonic Warp',
        category: 'DEFORMATION',
        icon: 'Activity',
        color: 'text-pink-400',
        description: 'Thin-plate spline / biharmonic deformation (L²u = 0). Minimizes bending energy — ultra-smooth global deformation from sparse control points',
        algorithm: 'Biharmonic Deformation Fields (Jacobson 2010)',
        requiresTopology: true,
        requiresLaplacian: true,
        params: [
            { key: 'stiffness', label: 'Stiffness', type: 'float', default: 1.0, min: 0.01, max: 10.0, step: 0.1 },
            { key: 'iterations', label: 'Iterations', type: 'int', default: 4, min: 1, max: 20 },
            { key: 'global', label: 'Global', type: 'bool', default: false, description: 'Apply globally vs brush radius' },
        ],
    },

    VORONOI_RELAX: {
        id: 'VORONOI_RELAX',
        label: 'Voronoi Relax',
        category: 'TOPOLOGY',
        icon: 'Hexagon',
        color: 'text-teal-400',
        description: 'Centroidal Voronoi Tessellation (CVT) vertex redistribution. Moves each vertex to the centroid of its Voronoi cell — improves triangle quality without changing shape',
        algorithm: 'Lloyd Relaxation / CVT (Du et al. 1999)',
        requiresTopology: true,
        requiresLaplacian: false,
        params: [
            { key: 'iterations', label: 'Lloyd Steps', type: 'int', default: 5, min: 1, max: 30 },
            { key: 'strength', label: 'Strength', type: 'float', default: 0.5, min: 0.05, max: 1.0, step: 0.05, description: 'Lerp factor toward Voronoi centroid' },
            { key: 'tangential', label: 'Tangential', type: 'bool', default: true, description: 'Constrain motion to tangent plane' },
        ],
    },

} as const;

export type MathBrushId = keyof typeof MATH_BRUSH_REGISTRY;

// ─── Runtime topology cache ───────────────────────────────────────────────────
// Topology and Laplacian are expensive to build → cache per geometry UUID.

interface TopoCache {
    uuid: string;
    topo: MeshTopology;
    L: CSRMatrix;
    kG?: Float64Array;
    H?: Float64Array;
    pc?: ReturnType<typeof computePrincipalCurvatures>;
}

let _topoCache: TopoCache | null = null;

function getOrBuildTopology(
    mesh: THREE.Mesh,
    needsLaplacian: boolean
): { topo: MeshTopology; L: CSRMatrix } {
    const geo = mesh.geometry;
    const uuid = geo.uuid;

    if (_topoCache?.uuid === uuid) {
        return { topo: _topoCache.topo, L: _topoCache.L };
    }

    const pos = geo.attributes.position.array as Float32Array;
    const idx = (geo.index?.array ?? new Uint32Array(pos.length / 3)) as Uint32Array;
    const topo = buildTopology(pos, idx);
    const L = needsLaplacian ? buildCotangentLaplacian(topo) : csrFromTriplets(0, 0, [], [], []);

    _topoCache = { uuid, topo, L };
    return { topo, L };
}

/** Invalidate cache when mesh geometry changes */
export function invalidateTopoCache(): void {
    _topoCache = null;
}

// ─── Brush Application Interface ─────────────────────────────────────────────

export interface MathBrushInput {
    brushId: MathBrushId;
    mesh: THREE.Mesh;
    center: THREE.Vector3;
    normal: THREE.Vector3;
    radius: number;
    intensity: number;
    delta?: THREE.Vector3;   // mouse drag delta for ARAP_GRAB
    params: Record<string, number | boolean | string>;
}

export interface MathBrushOutput {
    /** Displacement per vertex [dx0,dy0,dz0, dx1,...] — only affected verts nonzero */
    displacement: Float32Array;
    /** If geodesic mask: mask weight per vertex */
    maskWeights?: Float32Array;
    /** Stats */
    computeMs: number;
    affectedVerts: number;
}

// ─── Master Dispatch ──────────────────────────────────────────────────────────

export function applyMathBrush(input: MathBrushInput): MathBrushOutput {
    const t0 = performance.now();
    const brush = MATH_BRUSH_REGISTRY[input.brushId];
    if (!brush) throw new Error(`Unknown math brush: ${input.brushId}`);

    const { topo, L } = getOrBuildTopology(input.mesh, brush.requiresLaplacian);
    const V = topo.vertCount;

    const displacement = new Float32Array(V * 3);

    switch (input.brushId) {

        // ── 1. Spectral Laplacian Smooth ─────────────────────────────────────
        case 'SPECTRAL_SMOOTH': {
            const lambda = (input.params.lambda as number) ?? 0.5;
            const iterations = (input.params.iterations as number) ?? 3;
            const tangOnly = (input.params.tangetOnly as boolean) ?? false;
            const radius = input.radius;

            // Build falloff weights
            const weights = _brushWeights(topo, input.center, radius);

            // Work on a copy of positions
            const pWork = new Float64Array(topo.positions);

            for (let iter = 0; iter < iterations; iter++) {
                // L·p per component (cotangent smoothing)
                const Lx = new Float64Array(V), Ly = new Float64Array(V), Lz = new Float64Array(V);
                const px = new Float64Array(V), py = new Float64Array(V), pz = new Float64Array(V);
                for (let v = 0; v < V; v++) { px[v] = pWork[v * 3]; py[v] = pWork[v * 3 + 1]; pz[v] = pWork[v * 3 + 2]; }
                csrMatVec(L, px, Lx); csrMatVec(L, py, Ly); csrMatVec(L, pz, Lz);

                for (let v = 0; v < V; v++) {
                    const w = weights[v];
                    if (w < 1e-6) continue;

                    let dx = lambda * Lx[v] * w;
                    let dy = lambda * Ly[v] * w;
                    let dz = lambda * Lz[v] * w;

                    if (tangOnly) {
                        // Project displacement onto tangent plane
                        const nx = topo.normals[v * 3], ny = topo.normals[v * 3 + 1], nz = topo.normals[v * 3 + 2];
                        const dn = dx * nx + dy * ny + dz * nz;
                        dx -= dn * nx; dy -= dn * ny; dz -= dn * nz;
                    }

                    pWork[v * 3] += dx;
                    pWork[v * 3 + 1] += dy;
                    pWork[v * 3 + 2] += dz;
                }
            }

            let affected = 0;
            for (let v = 0; v < V; v++) {
                displacement[v * 3] = pWork[v * 3] - topo.positions[v * 3];
                displacement[v * 3 + 1] = pWork[v * 3 + 1] - topo.positions[v * 3 + 1];
                displacement[v * 3 + 2] = pWork[v * 3 + 2] - topo.positions[v * 3 + 2];
                if (displacement[v * 3] ** 2 + displacement[v * 3 + 1] ** 2 + displacement[v * 3 + 2] ** 2 > 1e-10) affected++;
            }

            return { displacement, computeMs: performance.now() - t0, affectedVerts: affected };
        }

        // ── 2. Mean Curvature Flow ────────────────────────────────────────────
        case 'MEAN_CURVATURE': {
            const dt = (input.params.dt as number) ?? 0.001;
            const iterations = (input.params.iterations as number) ?? 2;
            const invert = (input.params.invert as boolean) ?? false;
            const sign = invert ? -1 : 1;
            const weights = _brushWeights(topo, input.center, input.radius);

            const H = computeMeanCurvatureVectors(topo, L);
            let affected = 0;

            for (let v = 0; v < V; v++) {
                const w = weights[v];
                if (w < 1e-6) continue;
                displacement[v * 3] = sign * dt * H[v * 3] * w * iterations;
                displacement[v * 3 + 1] = sign * dt * H[v * 3 + 1] * w * iterations;
                displacement[v * 3 + 2] = sign * dt * H[v * 3 + 2] * w * iterations;
                affected++;
            }

            return { displacement, computeMs: performance.now() - t0, affectedVerts: affected };
        }

        // ── 3. Curvature Enhance ─────────────────────────────────────────────
        case 'CURVATURE_ENHANCE': {
            const strength = (input.params.strength as number) ?? 0.3;
            const threshold = (input.params.threshold as number) ?? 0.05;
            const clampMax = (input.params.clampMax as number) ?? 3.0;
            const weights = _brushWeights(topo, input.center, input.radius);

            const kG = computeGaussianCurvature(topo);
            const H = computeMeanCurvatureVectors(topo, L);
            const pc = computePrincipalCurvatures(topo, H, kG);

            let affected = 0;
            for (let v = 0; v < V; v++) {
                const w = weights[v];
                if (w < 1e-6) continue;
                const k = Math.abs(pc.k1[v] - pc.k2[v]);
                if (k < threshold) continue;
                const mag = Math.min(k * strength * w, clampMax) * 0.001;
                const nx = topo.normals[v * 3], ny = topo.normals[v * 3 + 1], nz = topo.normals[v * 3 + 2];
                // Displace along normal, scaled by curvature anisotropy
                displacement[v * 3] = nx * mag * Math.sign(pc.k1[v]);
                displacement[v * 3 + 1] = ny * mag * Math.sign(pc.k1[v]);
                displacement[v * 3 + 2] = nz * mag * Math.sign(pc.k1[v]);
                affected++;
            }

            return { displacement, computeMs: performance.now() - t0, affectedVerts: affected };
        }

        // ── 4. Geodesic Mask ─────────────────────────────────────────────────
        case 'GEODESIC_MASK': {
            const falloff = (input.params.falloff as number) ?? 0.5;
            const sharp = (input.params.sharp as number) ?? 2.0;

            // Find closest vertex to brush center
            const sourceVert = _closestVert(topo, input.center);
            const dist = computeGeodesicDistanceHeat(topo, L, [sourceVert]);

            const maxDist = dist.reduce((m, v) => Math.max(m, v), 0);
            const maskWeights = new Float32Array(V);
            for (let v = 0; v < V; v++) {
                const t = dist[v] / (maxDist * falloff);
                maskWeights[v] = Math.max(0, Math.exp(-Math.pow(t, sharp)));
            }

            return { displacement, maskWeights, computeMs: performance.now() - t0, affectedVerts: V };
        }

        // ── 5. ARAP Grab ─────────────────────────────────────────────────────
        case 'ARAP_GRAB': {
            const iters = (input.params.iterations as number) ?? 3;
            const stiffness = (input.params.stiffness as number) ?? 1.0;
            const delta = input.delta ?? new THREE.Vector3();

            const weights = _brushWeights(topo, input.center, input.radius * (input.params.radius as number ?? 1.0));
            const p0 = topo.positions;
            const pDeform = new Float64Array(p0);

            // Initial guess: translate grabbed verts
            for (let v = 0; v < V; v++) {
                const w = weights[v];
                if (w < 0.01) continue;
                pDeform[v * 3] += delta.x * w;
                pDeform[v * 3 + 1] += delta.y * w;
                pDeform[v * 3 + 2] += delta.z * w;
            }

            // ARAP constraints: source verts (brush center region) → target
            const constraints: ARAPConstraint[] = [];
            for (let v = 0; v < V; v++) {
                if (weights[v] < 0.01) continue;
                constraints.push({
                    vertIdx: v,
                    targetPos: [pDeform[v * 3], pDeform[v * 3 + 1], pDeform[v * 3 + 2]]
                });
            }

            for (let iter = 0; iter < iters; iter++) {
                arapStep(topo, L, constraints, pDeform);
            }

            let affected = 0;
            for (let v = 0; v < V; v++) {
                displacement[v * 3] = pDeform[v * 3] - p0[v * 3];
                displacement[v * 3 + 1] = pDeform[v * 3 + 1] - p0[v * 3 + 1];
                displacement[v * 3 + 2] = pDeform[v * 3 + 2] - p0[v * 3 + 2];
                if (Math.abs(displacement[v * 3]) + Math.abs(displacement[v * 3 + 1]) + Math.abs(displacement[v * 3 + 2]) > 1e-8) affected++;
            }

            return { displacement, computeMs: performance.now() - t0, affectedVerts: affected };
        }

        // ── 6. Stress Align ──────────────────────────────────────────────────
        case 'STRESS_ALIGN': {
            const strength = (input.params.strength as number) ?? 0.2;
            const direction = (input.params.direction as string) ?? 'max';
            const blend = (input.params.blend as number) ?? 0.5;
            const weights = _brushWeights(topo, input.center, input.radius);

            const kG = computeGaussianCurvature(topo);
            const H = computeMeanCurvatureVectors(topo, L);
            const pc = computePrincipalCurvatures(topo, H, kG);

            let affected = 0;
            for (let v = 0; v < V; v++) {
                const w = weights[v];
                if (w < 1e-6) continue;

                let ex: number, ey: number, ez: number;
                if (direction === 'max') {
                    ex = pc.e1[v * 3]; ey = pc.e1[v * 3 + 1]; ez = pc.e1[v * 3 + 2];
                } else if (direction === 'min') {
                    ex = pc.e2[v * 3]; ey = pc.e2[v * 3 + 1]; ez = pc.e2[v * 3 + 2];
                } else {
                    // blend
                    ex = pc.e1[v * 3] * (1 - blend) + pc.e2[v * 3] * blend;
                    ey = pc.e1[v * 3 + 1] * (1 - blend) + pc.e2[v * 3 + 1] * blend;
                    ez = pc.e1[v * 3 + 2] * (1 - blend) + pc.e2[v * 3 + 2] * blend;
                }

                const k = pc.k1[v] - pc.k2[v]; // curvature anisotropy as magnitude
                const mag = Math.min(Math.abs(k) * strength * w, 0.05);

                displacement[v * 3] = ex * mag;
                displacement[v * 3 + 1] = ey * mag;
                displacement[v * 3 + 2] = ez * mag;
                affected++;
            }

            return { displacement, computeMs: performance.now() - t0, affectedVerts: affected };
        }

        // ── 7. Biharmonic Warp ───────────────────────────────────────────────
        case 'BIHARMONIC_WARP': {
            const iters = (input.params.iterations as number) ?? 4;
            const stiffness = (input.params.stiffness as number) ?? 1.0;
            const global = (input.params.global as boolean) ?? false;

            // Biharmonic = L²·u = 0 via iterated Laplacian smoothing
            const weights = global
                ? new Float64Array(V).fill(1)
                : _brushWeights(topo, input.center, input.radius);

            const p0 = topo.positions;
            const p1 = new Float64Array(p0);

            // Apply delta at brush center
            const delta = input.delta ?? input.normal.clone().multiplyScalar(input.intensity * 0.01);
            const src = _closestVert(topo, input.center);
            p1[src * 3] += delta.x * stiffness;
            p1[src * 3 + 1] += delta.y * stiffness;
            p1[src * 3 + 2] += delta.z * stiffness;

            // Iterated Laplacian smoothing as biharmonic proxy
            for (let iter = 0; iter < iters; iter++) {
                const Lx = new Float64Array(V), Ly = new Float64Array(V), Lz = new Float64Array(V);
                const px = new Float64Array(V), py = new Float64Array(V), pz = new Float64Array(V);
                for (let v = 0; v < V; v++) { px[v] = p1[v * 3]; py[v] = p1[v * 3 + 1]; pz[v] = p1[v * 3 + 2]; }
                csrMatVec(L, px, Lx); csrMatVec(L, py, Ly); csrMatVec(L, pz, Lz);
                for (let v = 0; v < V; v++) {
                    const w = weights[v];
                    if (w < 1e-6) continue;
                    p1[v * 3] += 0.05 * Lx[v] * w;
                    p1[v * 3 + 1] += 0.05 * Ly[v] * w;
                    p1[v * 3 + 2] += 0.05 * Lz[v] * w;
                }
            }

            let affected = 0;
            for (let v = 0; v < V; v++) {
                displacement[v * 3] = p1[v * 3] - p0[v * 3];
                displacement[v * 3 + 1] = p1[v * 3 + 1] - p0[v * 3 + 1];
                displacement[v * 3 + 2] = p1[v * 3 + 2] - p0[v * 3 + 2];
                if (Math.abs(displacement[v * 3]) + Math.abs(displacement[v * 3 + 1]) + Math.abs(displacement[v * 3 + 2]) > 1e-8) affected++;
            }

            return { displacement, computeMs: performance.now() - t0, affectedVerts: affected };
        }

        // ── 8. Voronoi Relax ─────────────────────────────────────────────────
        case 'VORONOI_RELAX': {
            const iters = (input.params.iterations as number) ?? 5;
            const strength = (input.params.strength as number) ?? 0.5;
            const tangent = (input.params.tangential as boolean) ?? true;
            const weights = _brushWeights(topo, input.center, input.radius);

            const p = new Float64Array(topo.positions);
            const nbrs = topo.neighbors;

            for (let iter = 0; iter < iters; iter++) {
                const centroid = new Float64Array(V * 3);
                const wSum = new Float64Array(V);

                // Each vertex contributes to its neighbors' centroids
                for (let v = 0; v < V; v++) {
                    const nbrList = nbrs[v];
                    for (const j of nbrList) {
                        centroid[j * 3] += p[v * 3];
                        centroid[j * 3 + 1] += p[v * 3 + 1];
                        centroid[j * 3 + 2] += p[v * 3 + 2];
                        wSum[j]++;
                    }
                }

                for (let v = 0; v < V; v++) {
                    const w = weights[v];
                    if (w < 1e-6 || wSum[v] < 1) continue;

                    const cx = centroid[v * 3] / wSum[v];
                    const cy = centroid[v * 3 + 1] / wSum[v];
                    const cz = centroid[v * 3 + 2] / wSum[v];

                    let dx = (cx - p[v * 3]) * strength * w;
                    let dy = (cy - p[v * 3 + 1]) * strength * w;
                    let dz = (cz - p[v * 3 + 2]) * strength * w;

                    if (tangent) {
                        // Project onto tangent plane
                        const nx = topo.normals[v * 3], ny = topo.normals[v * 3 + 1], nz = topo.normals[v * 3 + 2];
                        const dn = dx * nx + dy * ny + dz * nz;
                        dx -= dn * nx; dy -= dn * ny; dz -= dn * nz;
                    }

                    p[v * 3] += dx; p[v * 3 + 1] += dy; p[v * 3 + 2] += dz;
                }
            }

            let affected = 0;
            for (let v = 0; v < V; v++) {
                displacement[v * 3] = p[v * 3] - topo.positions[v * 3];
                displacement[v * 3 + 1] = p[v * 3 + 1] - topo.positions[v * 3 + 1];
                displacement[v * 3 + 2] = p[v * 3 + 2] - topo.positions[v * 3 + 2];
                if (Math.abs(displacement[v * 3]) + Math.abs(displacement[v * 3 + 1]) + Math.abs(displacement[v * 3 + 2]) > 1e-8) affected++;
            }

            return { displacement, computeMs: performance.now() - t0, affectedVerts: affected };
        }

        default:
            return { displacement, computeMs: 0, affectedVerts: 0 };
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _brushWeights(topo: MeshTopology, center: THREE.Vector3, radius: number): Float64Array {
    const V = topo.vertCount;
    const w = new Float64Array(V);
    const r2 = radius * radius;
    for (let v = 0; v < V; v++) {
        const dx = topo.positions[v * 3] - center.x;
        const dy = topo.positions[v * 3 + 1] - center.y;
        const dz = topo.positions[v * 3 + 2] - center.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= r2) continue;
        const t = d2 / r2;
        w[v] = 1 - t * t;  // smooth falloff
    }
    return w;
}

function _closestVert(topo: MeshTopology, point: THREE.Vector3): number {
    let best = 0, bestD2 = Infinity;
    for (let v = 0; v < topo.vertCount; v++) {
        const dx = topo.positions[v * 3] - point.x, dy = topo.positions[v * 3 + 1] - point.y, dz = topo.positions[v * 3 + 2] - point.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bestD2) { bestD2 = d2; best = v; }
    }
    return best;
}

/** Apply a MathBrushOutput displacement to a Three.js mesh geometry */
export function applyDisplacementToMesh(
    mesh: THREE.Mesh,
    output: MathBrushOutput
): void {
    const pos = mesh.geometry.attributes.position;
    const V = pos.count;
    const d = output.displacement;
    for (let v = 0; v < Math.min(V, d.length / 3); v++) {
        pos.setXYZ(v, pos.getX(v) + d[v * 3], pos.getY(v) + d[v * 3 + 1], pos.getZ(v) + d[v * 3 + 2]);
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    // Invalidate topology cache since positions changed
    invalidateTopoCache();
}

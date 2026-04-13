/**
 * K_OS Universal Primitive Registry
 * 
 * ONE library. ONE quality standard. EVERY app uses it.
 * 
 * This is THE source of truth for all spawnable primitives across:
 * - KSculpt (Simple + Advanced)
 * - KGreeble
 * - KScatter
 * - KPainter
 * - Bevy Advanced Mode
 * 
 * Quality Floor (non-negotiables):
 * - Minimum ~500+ vertices for base meshes (no 70-vert garbage)
 * - Topology: quads preferred; tris only where mathematically required
 * - Watertight: no holes, no flipped normals
 * - Welded: shared vertices at edges
 * - UVs: present, consistent orientation, 0-1 range
 * - Scale: unit-sized (fits in 2x2x2 bounding box)
 * - Pivot: bottom-center by default (sits on ground at Y=0)
 *   Exception: sphere, torus, icosphere → center
 */

// ============================================================================
// TYPES
// ============================================================================

export type PrimitiveCategory =
    | 'core'           // Must-have, sculpt-ready (sphere, cube, cylinder, plane, cone, torus, capsule)
    | 'extended'       // Common DCC shapes (icosphere, uvsphere, pyramid, ring, tube, wedge, disc)
    | 'architectural'  // Hard-surface (wall, platform, pillar, stairs, arch, beam)
    | 'organic'        // Sculpt starters (head, body, limb)
    | 'procedural';    // Generated at spawn (greeble, rock, crystal)

export type PrimitiveTag =
    | 'sculpt_ready'   // High-poly, good for sculpting
    | 'quad'           // All-quad topology
    | 'tri'            // Triangle-based (icosphere, cone apex)
    | 'uv_ready'       // UVs are set up correctly
    | 'welded'         // No seam splits
    | 'center_pivot'   // Pivot at center (not bottom)
    | 'hard_surface'   // Good for hard-surface modeling
    | 'organic';       // Good for organic sculpting

export type ParamType = 'int' | 'float' | 'bool';

export interface ParamDefinition {
    name: string;
    type: ParamType;
    min?: number;
    max?: number;
    default: number | boolean;
    description?: string;
}

export type GeneratorBackend = 'rust' | 'ts_procedural';

export interface PrimitiveDefinition {
    /** Unique identifier: 'sphere', 'cube', etc. */
    id: string;

    /** Display name for UI */
    name: string;

    /** Category for organization */
    category: PrimitiveCategory;

    /** Tweakable parameters */
    params: ParamDefinition[];

    /** Default parameter values */
    defaults: Record<string, number | boolean>;

    /** Pivot location */
    pivot: 'center' | 'bottom';

    /** Feature tags */
    tags: PrimitiveTag[];

    /** Which backend generates this primitive */
    generator: GeneratorBackend;

    /** Description for hover/tooltip */
    description?: string;

    /** Keyboard shortcut (optional) */
    hotkey?: string;
}

// ============================================================================
// TIER 1: CORE PRIMITIVES (Must-Have, Sculpt-Ready)
// ============================================================================

const CORE_PRIMITIVES: PrimitiveDefinition[] = [
    {
        id: 'sphere',
        name: 'Quad Sphere',
        category: 'core',
        params: [
            { name: 'subdivisions', type: 'int', min: 0, max: 6, default: 4, description: 'Subdivision level (0-6)' }
        ],
        defaults: { subdivisions: 4 },
        pivot: 'center',
        tags: ['sculpt_ready', 'quad', 'uv_ready', 'welded', 'center_pivot', 'organic'],
        generator: 'rust',
        description: 'Cube-sphere with all quads, no poles. Perfect for sculpting.',
        hotkey: 'S',
    },
    {
        id: 'cube',
        name: 'Quad Cube',
        category: 'core',
        params: [
            { name: 'subdivisions', type: 'int', min: 0, max: 6, default: 4, description: 'Subdivision level (0-6)' }
        ],
        defaults: { subdivisions: 4 },
        pivot: 'bottom',
        tags: ['sculpt_ready', 'quad', 'uv_ready', 'welded', 'hard_surface'],
        generator: 'rust',
        description: 'Subdivided box with all quads. Great for hard-surface.',
        hotkey: 'C',
    },
    {
        id: 'cylinder',
        name: 'Quad Cylinder',
        category: 'core',
        params: [
            { name: 'radialSegments', type: 'int', min: 4, max: 128, default: 32, description: 'Segments around circumference' },
            { name: 'heightSegments', type: 'int', min: 1, max: 64, default: 16, description: 'Segments along height' },
            { name: 'caps', type: 'bool', default: true, description: 'Include grid caps' }
        ],
        defaults: { radialSegments: 32, heightSegments: 16, caps: true },
        pivot: 'bottom',
        tags: ['sculpt_ready', 'quad', 'uv_ready', 'welded', 'hard_surface'],
        generator: 'rust',
        description: 'Cylinder with grid caps, no center pole.',
        hotkey: 'Y',
    },
    {
        id: 'plane',
        name: 'Quad Plane',
        category: 'core',
        params: [
            { name: 'subdivisions', type: 'int', min: 0, max: 8, default: 4, description: 'Subdivision level (0-8)' }
        ],
        defaults: { subdivisions: 4 },
        pivot: 'center',
        tags: ['sculpt_ready', 'quad', 'uv_ready', 'center_pivot'],
        generator: 'rust',
        description: 'Flat subdivided grid. Good for terrain, walls.',
        hotkey: 'P',
    },
    {
        id: 'cone',
        name: 'Cone',
        category: 'core',
        params: [
            { name: 'radialSegments', type: 'int', min: 3, max: 128, default: 32, description: 'Segments around base' },
            { name: 'heightSegments', type: 'int', min: 1, max: 64, default: 16, description: 'Segments along height' }
        ],
        defaults: { radialSegments: 32, heightSegments: 16 },
        pivot: 'bottom',
        tags: ['sculpt_ready', 'tri', 'uv_ready', 'welded'],
        generator: 'rust',
        description: 'Cone with single apex vertex. Triangles at tip.',
        hotkey: 'O',
    },
    {
        id: 'torus',
        name: 'Torus',
        category: 'core',
        params: [
            { name: 'radialSegments', type: 'int', min: 4, max: 128, default: 48, description: 'Segments around main ring' },
            { name: 'tubularSegments', type: 'int', min: 4, max: 128, default: 24, description: 'Segments around tube' },
            { name: 'tubeRadius', type: 'float', min: 0.05, max: 0.8, default: 0.3, description: 'Tube radius (0-0.8)' }
        ],
        defaults: { radialSegments: 48, tubularSegments: 24, tubeRadius: 0.3 },
        pivot: 'center',
        tags: ['sculpt_ready', 'quad', 'uv_ready', 'welded', 'center_pivot'],
        generator: 'rust',
        description: 'Donut shape. All quads, seamless.',
        hotkey: 'T',
    },
    {
        id: 'capsule',
        name: 'Capsule',
        category: 'core',
        params: [
            { name: 'subdivisions', type: 'int', min: 1, max: 6, default: 3, description: 'Hemisphere detail (1-6)' },
            { name: 'height', type: 'float', min: 0.5, max: 4, default: 1.5, description: 'Cylinder section height' }
        ],
        defaults: { subdivisions: 3, height: 1.5 },
        pivot: 'bottom',
        tags: ['sculpt_ready', 'quad', 'uv_ready', 'welded', 'organic'],
        generator: 'rust',
        description: 'Cylinder with hemisphere caps. Great for limbs.',
        hotkey: 'A',
    },
];

// ============================================================================
// TIER 2: EXTENDED PRIMITIVES (Common DCC Shapes)
// ============================================================================

const EXTENDED_PRIMITIVES: PrimitiveDefinition[] = [
    {
        id: 'icosphere',
        name: 'Icosphere',
        category: 'extended',
        params: [
            { name: 'subdivisions', type: 'int', min: 0, max: 5, default: 2, description: 'Subdivision level (0-5)' }
        ],
        defaults: { subdivisions: 2 },
        pivot: 'center',
        tags: ['tri', 'uv_ready', 'welded', 'center_pivot'],
        generator: 'rust',
        description: 'Icosahedron-based sphere. Triangles, good for low-poly.',
    },
    {
        id: 'uvsphere',
        name: 'UV Sphere',
        category: 'extended',
        params: [
            { name: 'rings', type: 'int', min: 4, max: 128, default: 32, description: 'Horizontal rings' },
            { name: 'segments', type: 'int', min: 4, max: 128, default: 32, description: 'Vertical segments' }
        ],
        defaults: { rings: 32, segments: 32 },
        pivot: 'center',
        tags: ['quad', 'uv_ready', 'center_pivot'],
        generator: 'rust',
        description: 'Traditional lat/long sphere. Has poles, good for texturing.',
    },
    {
        id: 'pyramid',
        name: 'Pyramid',
        category: 'extended',
        params: [
            { name: 'sides', type: 'int', min: 3, max: 8, default: 4, description: 'Number of sides (3-8)' },
            { name: 'heightSegments', type: 'int', min: 1, max: 32, default: 8, description: 'Vertical segments' }
        ],
        defaults: { sides: 4, heightSegments: 8 },
        pivot: 'bottom',
        tags: ['tri', 'uv_ready', 'welded', 'hard_surface'],
        generator: 'rust',
        description: 'Cone with flat sides. Classic pyramid shape.',
    },
    {
        id: 'ring',
        name: 'Ring/Annulus',
        category: 'extended',
        params: [
            { name: 'innerRadius', type: 'float', min: 0.1, max: 0.9, default: 0.5, description: 'Inner radius' },
            { name: 'outerRadius', type: 'float', min: 0.2, max: 1.0, default: 1.0, description: 'Outer radius' },
            { name: 'segments', type: 'int', min: 8, max: 128, default: 48, description: 'Radial segments' }
        ],
        defaults: { innerRadius: 0.5, outerRadius: 1.0, segments: 48 },
        pivot: 'center',
        tags: ['quad', 'uv_ready', 'welded', 'center_pivot', 'hard_surface'],
        generator: 'rust',
        description: 'Flat donut/washer shape.',
    },
    {
        id: 'tube',
        name: 'Tube/Pipe',
        category: 'extended',
        params: [
            { name: 'innerRadius', type: 'float', min: 0.1, max: 0.9, default: 0.4, description: 'Inner radius' },
            { name: 'outerRadius', type: 'float', min: 0.2, max: 1.0, default: 0.6, description: 'Outer radius' },
            { name: 'height', type: 'float', min: 0.5, max: 4, default: 2.0, description: 'Height' },
            { name: 'segments', type: 'int', min: 8, max: 128, default: 32, description: 'Radial segments' }
        ],
        defaults: { innerRadius: 0.4, outerRadius: 0.6, height: 2.0, segments: 32 },
        pivot: 'bottom',
        tags: ['quad', 'uv_ready', 'welded', 'hard_surface'],
        generator: 'rust',
        description: 'Hollow cylinder. Great for pipes, rings.',
    },
    {
        id: 'disc',
        name: 'Disc',
        category: 'extended',
        params: [
            { name: 'subdivisions', type: 'int', min: 1, max: 6, default: 3, description: 'Grid detail' },
            { name: 'segments', type: 'int', min: 8, max: 128, default: 32, description: 'Radial segments' }
        ],
        defaults: { subdivisions: 3, segments: 32 },
        pivot: 'center',
        tags: ['quad', 'uv_ready', 'welded', 'center_pivot'],
        generator: 'rust',
        description: 'Filled circle with grid (no center pole).',
    },
];

// ============================================================================
// TIER 3: ARCHITECTURAL (Hard-Surface)
// ============================================================================

const ARCHITECTURAL_PRIMITIVES: PrimitiveDefinition[] = [
    {
        id: 'wall',
        name: 'Wall',
        category: 'architectural',
        params: [
            { name: 'width', type: 'float', min: 0.5, max: 10, default: 2.0, description: 'Wall width' },
            { name: 'height', type: 'float', min: 0.5, max: 10, default: 1.0, description: 'Wall height' },
            { name: 'depth', type: 'float', min: 0.1, max: 2, default: 0.2, description: 'Wall thickness' }
        ],
        defaults: { width: 2.0, height: 1.0, depth: 0.2 },
        pivot: 'bottom',
        tags: ['quad', 'uv_ready', 'welded', 'hard_surface'],
        generator: 'rust',
        description: 'Flat wall panel.',
    },
    {
        id: 'platform',
        name: 'Platform',
        category: 'architectural',
        params: [
            { name: 'width', type: 'float', min: 0.5, max: 10, default: 2.0, description: 'Platform width' },
            { name: 'depth', type: 'float', min: 0.5, max: 10, default: 2.0, description: 'Platform depth' },
            { name: 'height', type: 'float', min: 0.1, max: 2, default: 0.2, description: 'Platform height' }
        ],
        defaults: { width: 2.0, depth: 2.0, height: 0.2 },
        pivot: 'bottom',
        tags: ['quad', 'uv_ready', 'welded', 'hard_surface'],
        generator: 'rust',
        description: 'Flat raised surface.',
    },
    {
        id: 'pillar',
        name: 'Pillar',
        category: 'architectural',
        params: [
            { name: 'radius', type: 'float', min: 0.1, max: 1, default: 0.2, description: 'Pillar radius' },
            { name: 'height', type: 'float', min: 0.5, max: 10, default: 2.0, description: 'Pillar height' },
            { name: 'segments', type: 'int', min: 8, max: 64, default: 16, description: 'Radial segments' }
        ],
        defaults: { radius: 0.2, height: 2.0, segments: 16 },
        pivot: 'bottom',
        tags: ['quad', 'uv_ready', 'welded', 'hard_surface'],
        generator: 'rust',
        description: 'Tall vertical cylinder.',
    },
    {
        id: 'arch',
        name: 'Arch',
        category: 'architectural',
        params: [
            { name: 'radius', type: 'float', min: 0.5, max: 5, default: 1.0, description: 'Arch radius' },
            { name: 'thickness', type: 'float', min: 0.1, max: 1, default: 0.2, description: 'Arch thickness' },
            { name: 'angle', type: 'float', min: 0.5, max: 3.14159, default: 3.14159, description: 'Arch angle (PI=semicircle)' }
        ],
        defaults: { radius: 1.0, thickness: 0.2, angle: Math.PI },
        pivot: 'bottom',
        tags: ['quad', 'uv_ready', 'welded', 'hard_surface'],
        generator: 'rust',
        description: 'Half-torus archway.',
    },
    {
        id: 'beam',
        name: 'I-Beam',
        category: 'architectural',
        params: [
            { name: 'width', type: 'float', min: 0.2, max: 2, default: 0.4, description: 'Beam width' },
            { name: 'height', type: 'float', min: 0.5, max: 5, default: 2.0, description: 'Beam height/length' },
            { name: 'flangeWidth', type: 'float', min: 0.3, max: 1, default: 0.6, description: 'Flange width' }
        ],
        defaults: { width: 0.4, height: 2.0, flangeWidth: 0.6 },
        pivot: 'bottom',
        tags: ['quad', 'uv_ready', 'welded', 'hard_surface'],
        generator: 'rust',
        description: 'Structural I-beam.',
    },
];

// ============================================================================
// TIER 4: ORGANIC (Sculpt Starters)
// ============================================================================

const ORGANIC_PRIMITIVES: PrimitiveDefinition[] = [
    {
        id: 'head',
        name: 'Head Base',
        category: 'organic',
        params: [
            { name: 'subdivisions', type: 'int', min: 2, max: 6, default: 4, description: 'Detail level' }
        ],
        defaults: { subdivisions: 4 },
        pivot: 'bottom',
        tags: ['sculpt_ready', 'quad', 'uv_ready', 'welded', 'organic'],
        generator: 'rust',
        description: 'Elongated sphere for portrait sculpting.',
    },
    {
        id: 'body',
        name: 'Body Base',
        category: 'organic',
        params: [
            { name: 'subdivisions', type: 'int', min: 2, max: 6, default: 4, description: 'Detail level' }
        ],
        defaults: { subdivisions: 4 },
        pivot: 'bottom',
        tags: ['sculpt_ready', 'quad', 'uv_ready', 'welded', 'organic'],
        generator: 'rust',
        description: 'Capsule-ish torso shape for figure sculpting.',
    },
    {
        id: 'limb',
        name: 'Limb Base',
        category: 'organic',
        params: [
            { name: 'subdivisions', type: 'int', min: 2, max: 6, default: 3, description: 'Detail level' },
            { name: 'taper', type: 'float', min: 0, max: 1, default: 0.3, description: 'Taper amount (0=cylinder, 1=cone)' }
        ],
        defaults: { subdivisions: 3, taper: 0.3 },
        pivot: 'bottom',
        tags: ['sculpt_ready', 'quad', 'uv_ready', 'welded', 'organic'],
        generator: 'rust',
        description: 'Tapered cylinder for arms/legs.',
    },
];

// ============================================================================
// TIER 5: PROCEDURAL (TS-Generated)
// ============================================================================

const PROCEDURAL_PRIMITIVES: PrimitiveDefinition[] = [
    {
        id: 'greeble',
        name: 'Greeble',
        category: 'procedural',
        params: [
            { name: 'seed', type: 'int', min: 0, max: 99999, default: 42, description: 'Random seed' },
            { name: 'density', type: 'float', min: 0.1, max: 1, default: 0.5, description: 'Module density' }
        ],
        defaults: { seed: 42, density: 0.5 },
        pivot: 'center',
        tags: ['hard_surface', 'center_pivot'],
        generator: 'ts_procedural',
        description: 'Random hard-surface modules (sci-fi detailing).',
    },
    {
        id: 'rock',
        name: 'Rock',
        category: 'procedural',
        params: [
            { name: 'seed', type: 'int', min: 0, max: 99999, default: 42, description: 'Random seed' },
            { name: 'subdivisions', type: 'int', min: 1, max: 4, default: 2, description: 'Base mesh detail' }
        ],
        defaults: { seed: 42, subdivisions: 2 },
        pivot: 'bottom',
        tags: ['organic'],
        generator: 'ts_procedural',
        description: 'Displaced sphere for natural rock shapes.',
    },
    {
        id: 'crystal',
        name: 'Crystal',
        category: 'procedural',
        params: [
            { name: 'facets', type: 'int', min: 4, max: 12, default: 6, description: 'Crystal faces' },
            { name: 'seed', type: 'int', min: 0, max: 99999, default: 42, description: 'Random seed' }
        ],
        defaults: { facets: 6, seed: 42 },
        pivot: 'bottom',
        tags: ['hard_surface'],
        generator: 'ts_procedural',
        description: 'Random crystal cluster.',
    },
];

// ============================================================================
// FULL REGISTRY
// ============================================================================

export const PRIMITIVES: PrimitiveDefinition[] = [
    ...CORE_PRIMITIVES,
    ...EXTENDED_PRIMITIVES,
    ...ARCHITECTURAL_PRIMITIVES,
    ...ORGANIC_PRIMITIVES,
    ...PROCEDURAL_PRIMITIVES,
];

// ============================================================================
// LOOKUP HELPERS
// ============================================================================

/** Get primitive by ID */
export const getPrimitiveById = (id: string): PrimitiveDefinition | undefined => {
    return PRIMITIVES.find(p => p.id === id);
};

/** Get all primitives in a category */
export const getPrimitivesByCategory = (category: PrimitiveCategory): PrimitiveDefinition[] => {
    return PRIMITIVES.filter(p => p.category === category);
};

/** Get all primitives with a specific tag */
export const getPrimitivesByTag = (tag: PrimitiveTag): PrimitiveDefinition[] => {
    return PRIMITIVES.filter(p => p.tags.includes(tag));
};

/** Get all Rust-generated primitives */
export const getRustPrimitives = (): PrimitiveDefinition[] => {
    return PRIMITIVES.filter(p => p.generator === 'rust');
};

/** Get all procedural (TS) primitives */
export const getProceduralPrimitives = (): PrimitiveDefinition[] => {
    return PRIMITIVES.filter(p => p.generator === 'ts_procedural');
};

/** Get default params for a primitive */
export const getDefaultParams = (id: string): Record<string, number | boolean> => {
    const primitive = getPrimitiveById(id);
    return primitive?.defaults ?? {};
};

/** Check if primitive is sculpt-ready */
export const isSculptReady = (id: string): boolean => {
    const primitive = getPrimitiveById(id);
    return primitive?.tags.includes('sculpt_ready') ?? false;
};

/** Get all primitive IDs */
export const getAllPrimitiveIds = (): string[] => {
    return PRIMITIVES.map(p => p.id);
};

// ============================================================================
// CATEGORIES FOR UI
// ============================================================================

export const PRIMITIVE_CATEGORIES: { id: PrimitiveCategory; label: string; icon?: string }[] = [
    { id: 'core', label: 'Core', icon: '🔷' },
    { id: 'extended', label: 'Extended', icon: '🔶' },
    { id: 'architectural', label: 'Architectural', icon: '🏛️' },
    { id: 'organic', label: 'Organic', icon: '🌿' },
    { id: 'procedural', label: 'Procedural', icon: '⚡' },
];

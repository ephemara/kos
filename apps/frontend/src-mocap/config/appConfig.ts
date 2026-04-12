/**
 * App Configuration
 * 
 * Central config for workflow groups and categories.
 * New modules should be registered in @/shared/config/modules.manifest.ts.
 */

// Re-export from new location
export { MODULES as ALL_MODULES } from '@mocap/shared/config/modules.manifest';

// Workflow config - organized by pipeline stage
export const WORKFLOW = [
  // GROUP 0: INGEST
  {
    label: 'INGEST',
    color: 'text-cyan-400',
    modules: [
      // Camera + AI pose estimation modules go here
    ],
  },
  // GROUP 1: COMPUTE
  {
    label: 'COMPUTE',
    color: 'text-purple-400',
    modules: [
      // GPU IK / physics pipeline modules go here
    ],
  },
  // GROUP 2: BROADCAST
  {
    label: 'BROADCAST',
    color: 'text-orange-400',
    modules: [
      // LiveLink / UDP broadcast modules go here
    ],
  },
  // GROUP 3: ANIMATION
  {
    label: 'ANIMATION',
    color: 'text-green-400',
    modules: [
      // DCC-side retargeting modules go here
    ],
  },
];

// Category config
export const CATEGORY_CONFIG = {
  '2d': {
    name: '2D Applications',
    description: 'Canvas, painting, and image editing tools',
  },
  '3d': {
    name: '3D Applications',
    description: '3D modeling, sculpting, and visualization tools',
  },
  shared: {
    name: 'Shared Systems',
    description: 'Universal components and utilities',
  },
  IMPORT: {
    name: 'Imported Assets',
    description: 'User-imported content',
  },
};

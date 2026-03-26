import { lazy, LazyExoticComponent, ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Camera } from 'lucide-react';

/**
 * Capability types that modules can require
 */
export type Capability =
  | 'tauri'           // Tauri desktop runtime
  | 'wgpu'            // GPU compute backend
  | 'three'           // Three.js 3D rendering
  | 'external-engine' // External engine tethering
  | 'python';         // Python sidecar

/**
 * Module category for organization
 */
export type ModuleCategory = '2d' | '3d' | 'shared';

/**
 * Rendering dimension requirement
 */
export type ModuleDimension = '2d' | '3d' | 'both';

/**
 * Module definition interface
 */
export interface ModuleDefinition {
  /** Unique module identifier */
  id: string;

  /** Display name */
  name: string;

  /** Module category */
  category: ModuleCategory;

  /** Rendering dimension */
  dimension: ModuleDimension;

  /** Lazy-loaded entry component */
  entryComponent: LazyExoticComponent<ComponentType<any>>;

  /** Required system capabilities */
  requiredCapabilities: Capability[];

  /** Optional icon component */
  icon?: LucideIcon;

  /** Optional description */
  description?: string;

  /** Whether this is an example module */
  isExample?: boolean;
}

/**
 * Registered modules
 * 
 * Add new modules here to make them available in the application.
 * Modules are lazy-loaded and only initialized when activated.
 */
export const MODULES: ModuleDefinition[] = [
  {
    id: 'zen-mocap',
    name: 'ZenMocap',
    category: '3d',
    dimension: 'both',
    description: 'Real-time AI body tracking → UE5 / Blender / Unity LiveLink',
    icon: Camera,
    requiredCapabilities: ['tauri', 'wgpu'],
    entryComponent: lazy(() =>
      import('../../features/ZenMocap/ZenMocap').then(m => ({ default: m.default }))
    ),
  },
];

/**
 * Get modules by category
 */
export function getModulesByCategory(category: ModuleCategory): ModuleDefinition[] {
  return MODULES.filter(m => m.category === category);
}

/**
 * Get modules by dimension
 */
export function getModulesByDimension(dimension: ModuleDimension): ModuleDefinition[] {
  return MODULES.filter(m => m.dimension === dimension || m.dimension === 'both');
}

/**
 * Get module by ID
 */
export function getModuleById(id: string): ModuleDefinition | undefined {
  return MODULES.find(m => m.id === id);
}

/**
 * Get example modules
 */
export function getExampleModules(): ModuleDefinition[] {
  return MODULES.filter(m => m.isExample === true);
}

/**
 * Get core template modules
 */
export function getCoreModules(): ModuleDefinition[] {
  return MODULES.filter(m => !m.isExample);
}

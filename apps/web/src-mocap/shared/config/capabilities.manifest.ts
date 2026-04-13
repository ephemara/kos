import type { Capability } from './modules.manifest';

/**
 * Capability check function
 */
export interface CapabilityCheck {
  /** The capability being checked */
  capability: Capability;
  
  /** Async function to check if capability is available */
  check: () => Promise<boolean>;
  
  /** Optional fallback message when capability is unavailable */
  fallback?: string;
}

/**
 * Capability checks
 * 
 * These functions determine which capabilities are available at runtime.
 * Modules requiring unavailable capabilities will be disabled.
 */
export const CAPABILITY_CHECKS: CapabilityCheck[] = [
  {
    capability: 'tauri',
    check: async () => {
      // Check if Tauri API is available
      return typeof window !== 'undefined' && '__TAURI__' in window;
    },
    fallback: 'Tauri desktop runtime not available. Running in web mode.'
  },
  
  {
    capability: 'wgpu',
    check: async () => {
      // Check if GPU compute is available
      try {
        if (typeof window === 'undefined' || !('__TAURI__' in window)) {
          return false;
        }
        
        // Try to invoke GPU check command
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('gpu_check_available');
        return true;
      } catch {
        return false;
      }
    },
    fallback: 'GPU compute features disabled. CPU fallback will be used.'
  },
  
  {
    capability: 'three',
    check: async () => {
      // Check if Three.js is available
      try {
        await import('three');
        return true;
      } catch {
        return false;
      }
    },
    fallback: '3D rendering not available.'
  },
  
  {
    capability: 'external-engine',
    check: async () => {
      // Check if external engine tethering is supported
      // This is typically only available in Tauri desktop mode
      return typeof window !== 'undefined' && '__TAURI__' in window;
    },
    fallback: 'External engine tethering not available.'
  },
  
  {
    capability: 'python',
    check: async () => {
      // Check if Python sidecar is available
      try {
        if (typeof window === 'undefined' || !('__TAURI__' in window)) {
          return false;
        }
        
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('python_check_available');
        return true;
      } catch {
        return false;
      }
    },
    fallback: 'Python integration not available.'
  }
];

/**
 * Cache for capability check results
 */
const capabilityCache = new Map<Capability, boolean>();

/**
 * Check if a capability is available
 */
export async function checkCapability(capability: Capability): Promise<boolean> {
  // Return cached result if available
  if (capabilityCache.has(capability)) {
    return capabilityCache.get(capability)!;
  }
  
  // Find the check function
  const check = CAPABILITY_CHECKS.find(c => c.capability === capability);
  if (!check) {
    console.warn(`No capability check defined for: ${capability}`);
    return false;
  }
  
  // Run the check
  try {
    const result = await check.check();
    capabilityCache.set(capability, result);
    
    if (!result && check.fallback) {
      console.info(`[Capability] ${check.fallback}`);
    }
    
    return result;
  } catch (error) {
    console.error(`[Capability] Error checking ${capability}:`, error);
    capabilityCache.set(capability, false);
    return false;
  }
}

/**
 * Check multiple capabilities
 */
export async function checkCapabilities(capabilities: Capability[]): Promise<Map<Capability, boolean>> {
  const results = new Map<Capability, boolean>();
  
  await Promise.all(
    capabilities.map(async (cap) => {
      const result = await checkCapability(cap);
      results.set(cap, result);
    })
  );
  
  return results;
}

/**
 * Check if all required capabilities are available
 */
export async function hasAllCapabilities(required: Capability[]): Promise<boolean> {
  const results = await checkCapabilities(required);
  return Array.from(results.values()).every(v => v === true);
}

/**
 * Get unavailable capabilities from a list
 */
export async function getUnavailableCapabilities(required: Capability[]): Promise<Capability[]> {
  const results = await checkCapabilities(required);
  return Array.from(results.entries())
    .filter(([_, available]) => !available)
    .map(([cap, _]) => cap);
}

/**
 * Clear capability cache (useful for testing or re-checking)
 */
export function clearCapabilityCache(): void {
  capabilityCache.clear();
}

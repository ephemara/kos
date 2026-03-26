/**
 * Asset path configuration
 * 
 * Centralized configuration for all asset paths in the application.
 * This prevents hardcoded paths and makes it easy to change asset locations.
 */

/**
 * Base asset paths
 */
export const ASSET_PATHS = {
  /** Matcap textures for sculpting/modeling */
  matcaps: '/matcaps',
  
  /** HDR environment maps */
  hdr: '/hdr',
  
  /** Primitive mesh assets */
  primitives: '/primitives',
  
  /** Brush alpha textures */
  alphas: '/alphas',
  
  /** Material presets */
  materials: '/materials',
  
  /** Icon assets */
  icons: '/icons',
  
  /** Font files */
  fonts: '/fonts',
  
  /** Audio files */
  audio: '/audio',
  
  /** Video files */
  video: '/video',
  
  /** Generic images */
  images: '/images',
  
  /** 3D models */
  models: '/models',
  
  /** Shader files (if loaded externally) */
  shaders: '/shaders',
  
  /** User projects */
  projects: '/projects',
  
  /** Temporary files */
  temp: '/temp',
} as const;

/**
 * Asset file extensions by type
 */
export const ASSET_EXTENSIONS = {
  images: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'],
  models: ['.obj', '.fbx', '.gltf', '.glb', '.stl', '.ply'],
  textures: ['.png', '.jpg', '.jpeg', '.exr', '.hdr'],
  audio: ['.mp3', '.wav', '.ogg', '.flac'],
  video: ['.mp4', '.webm', '.mov'],
  fonts: ['.ttf', '.otf', '.woff', '.woff2'],
  shaders: ['.glsl', '.wgsl', '.vert', '.frag', '.comp'],
} as const;

/**
 * Get full asset path
 */
export function getAssetPath(category: keyof typeof ASSET_PATHS, filename: string): string {
  const basePath = ASSET_PATHS[category];
  return `${basePath}/${filename}`;
}

/**
 * Check if file extension matches asset type
 */
export function isAssetType(filename: string, type: keyof typeof ASSET_EXTENSIONS): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return (ASSET_EXTENSIONS[type] as readonly string[]).includes(ext);
}

/**
 * Get asset type from filename
 */
export function getAssetType(filename: string): keyof typeof ASSET_EXTENSIONS | null {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  for (const [type, extensions] of Object.entries(ASSET_EXTENSIONS)) {
    if ((extensions as readonly string[]).includes(ext)) {
      return type as keyof typeof ASSET_EXTENSIONS;
    }
  }
  
  return null;
}

/**
 * Remote asset configuration
 */
export interface RemoteAssetConfig {
  /** Base URL for remote assets */
  baseUrl: string;
  
  /** API key for authenticated requests */
  apiKey?: string;
  
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Remote asset sources (can be configured at runtime)
 */
export const REMOTE_ASSETS: Record<string, RemoteAssetConfig> = {
  // Example: CDN configuration
  // cdn: {
  //   baseUrl: 'https://cdn.example.com/assets',
  //   headers: { 'X-API-Key': 'your-key' }
  // }
};

/**
 * Get remote asset URL
 */
export function getRemoteAssetUrl(
  source: string,
  path: string
): string | null {
  const config = REMOTE_ASSETS[source];
  if (!config) {
    console.warn(`Remote asset source not configured: ${source}`);
    return null;
  }
  
  return `${config.baseUrl}/${path}`;
}

/**
 * Load asset with fetch
 */
export async function loadAsset(
  path: string,
  options?: RequestInit
): Promise<Response> {
  try {
    const response = await fetch(path, options);
    
    if (!response.ok) {
      throw new Error(`Failed to load asset: ${path} (${response.status})`);
    }
    
    return response;
  } catch (error) {
    console.error(`Error loading asset: ${path}`, error);
    throw error;
  }
}

/**
 * Load remote asset with authentication
 */
export async function loadRemoteAsset(
  source: string,
  path: string
): Promise<Response> {
  const url = getRemoteAssetUrl(source, path);
  if (!url) {
    throw new Error(`Invalid remote asset source: ${source}`);
  }
  
  const config = REMOTE_ASSETS[source];
  const headers = new Headers(config.headers);
  
  if (config.apiKey) {
    headers.set('Authorization', `Bearer ${config.apiKey}`);
  }
  
  return loadAsset(url, { headers });
}

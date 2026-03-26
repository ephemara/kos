/**
 * Route definition interface
 */
export interface RouteDefinition {
  /** Route path */
  path: string;
  
  /** Route name/title */
  name: string;
  
  /** Module ID this route belongs to */
  moduleId: string;
  
  /** Whether this route requires authentication */
  requiresAuth?: boolean;
  
  /** Optional route metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Registered routes
 * 
 * Routes are automatically generated from module definitions.
 * This manifest can be extended with custom routes as needed.
 */
export const ROUTES: RouteDefinition[] = [
  // Routes will be dynamically generated from modules
  // Custom routes can be added here
];

/**
 * Get route by path
 */
export function getRouteByPath(path: string): RouteDefinition | undefined {
  return ROUTES.find(r => r.path === path);
}

/**
 * Get routes by module ID
 */
export function getRoutesByModule(moduleId: string): RouteDefinition[] {
  return ROUTES.filter(r => r.moduleId === moduleId);
}

/**
 * Register a new route
 */
export function registerRoute(route: RouteDefinition): void {
  // Check if route already exists
  const existing = ROUTES.find(r => r.path === route.path);
  if (existing) {
    console.warn(`Route already registered: ${route.path}`);
    return;
  }
  
  ROUTES.push(route);
}

/**
 * Unregister a route
 */
export function unregisterRoute(path: string): void {
  const index = ROUTES.findIndex(r => r.path === path);
  if (index !== -1) {
    ROUTES.splice(index, 1);
  }
}

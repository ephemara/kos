/**
 * TERRAIN SHADERS
 * 
 * Extracted from K_OS codebase
 * Category: terrain
 * Total shaders: 2
 */

// Source: three-d\examples\tecton\KTectonshaders.tsx
export const RENDER_VERTEX = `
  uniform sampler2D heightMap;
  uniform float heightScale;
  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vec4 heightData = texture2D(heightMap, uv);
    vHeight = heightData.r;
    
    vec3 newPosition = position;
    
    // CORRECTION: PlaneGeometry is rotated -90 on X to be flat.
    // The vertex attribute 'position' (local space) still has Z=0 and varies X,Y.
    // However, when we want to displace it 'up' in World Space (which is World Y),
    // we must displace along the LOCAL axis that corresponds to World Y.
    // 
    // If geometry.rotateX(-PI/2) was applied CPU side, vertices are:
    // (x, 0, -y). The Normal is (0, 1, 0).
    // So we must displace Y.
    
    newPosition.y += vHeight * heightScale;
    
    vec4 worldPosition = modelMatrix * vec4(newPosition, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    vec4 mvPosition = viewMatrix * worldPosition;
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Source: three-d\examples\tecton\KTectonshaders.tsx
export const CURSOR_VERTEX = `
  uniform sampler2D heightMap;
  uniform float heightScale;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 hData = texture2D(heightMap, uv);
    float h = hData.r;
    vec3 newPos = position;
    // Displace Y to match Terrain's Y displacement
    newPos.y += h * heightScale + 5.0; 
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`;


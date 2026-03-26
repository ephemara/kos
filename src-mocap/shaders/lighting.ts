/**
 * LIGHTING SHADERS
 * 
 * Extracted from K_OS codebase
 * Category: lighting
 * Total shaders: 1
 */

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const COPY_FRAG = `
  uniform sampler2D tDiffuse;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 tex = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(tex.rgb, tex.a * uOpacity);
  }
`;


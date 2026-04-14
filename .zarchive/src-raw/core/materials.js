import * as THREE from '../vendor/three.module.js';

/**
 * K_OS MATERIAL SYSTEM
 * Handles .kmat loading and real-time shader injection.
 */
export class MaterialLoader {
    constructor() {
        this.cache = new Map();
        this.chunkCache = new Map(); // For shader chunks
    }

    async load(url) {
        if (this.cache.has(url)) return this.cache.get(url);

        try {
            const response = await fetch(url);
            const data = await response.json();
            const material = this.create(data);

            this.cache.set(url, material);
            return material;
        } catch (e) {
            console.error(`Failed to load material: ${url}`, e);
            return new THREE.MeshBasicMaterial({ color: 0xff00ff }); // Error magenta
        }
    }

    create(data) {
        // 1. Custom Shader Material
        if (data.type === 'shader') {
            return new THREE.ShaderMaterial({
                uniforms: this.parseUniforms(data.uniforms || {}),
                vertexShader: data.vertexShader || this.defaultVertexShader(),
                fragmentShader: data.fragmentShader || this.defaultFragmentShader(),
                transparent: data.transparent || false,
                side: data.doubleSided ? THREE.DoubleSide : THREE.FrontSide
            });
        }

        // 2. Standard PBR Material
        const params = {
            color: new THREE.Color(data.color || 0xffffff),
            roughness: data.roughness !== undefined ? data.roughness : 0.5,
            metalness: data.metalness !== undefined ? data.metalness : 0.0,
            flatShading: data.flatShading || false,
            wireframe: data.wireframe || false
        };

        if (data.emissive) params.emissive = new THREE.Color(data.emissive);

        return new THREE.MeshStandardMaterial(params);
    }

    parseUniforms(uniformsDef) {
        const uniforms = {};
        for (const [key, val] of Object.entries(uniformsDef)) {
            if (val.type === 'color') {
                uniforms[key] = { value: new THREE.Color(val.value) };
            } else if (val.type === 'vec3') {
                uniforms[key] = { value: new THREE.Vector3(...val.value) };
            } else if (val.type === 'vec2') {
                uniforms[key] = { value: new THREE.Vector2(...val.value) };
            } else if (val.type === 'float') {
                uniforms[key] = { value: val.value };
            } else {
                // Fallback direct value
                uniforms[key] = { value: val };
            }
        }
        return uniforms;
    }

    defaultVertexShader() {
        return `
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
                vUv = uv;
                vNormal = normal;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
    }

    defaultFragmentShader() {
        return `
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
                gl_FragColor = vec4(vNormal * 0.5 + 0.5, 1.0);
            }
        `;
    }
}

export const materialLoader = new MaterialLoader();

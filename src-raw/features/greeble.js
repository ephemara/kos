import * as THREE from '../vendor/three.module.js';
import { materialLoader } from '../core/materials.js';
import { initRenderer, getScene, getCamera, getRenderer, onFrame } from '../core/renderer.js';

// Global State
let stopLoop = null;
let containerEl;
let greebleGroup;

export async function mount(container) {
    console.log('🏗️ GREEBLE: Mounting to Core Renderer...');
    containerEl = container;

    // 1. Setup Core Renderer
    initRenderer();
    const scene = getScene();

    greebleGroup = new THREE.Group();
    scene.add(greebleGroup);

    // 2. Initial Generation
    generateGreebles('pipes');

    // 3. UI
    injectUI();

    // 4. Loop
    stopLoop = onFrame(update);
}

export function unmount() {
    console.log('🏗️ GREEBLE: Unmounting...');
    if (stopLoop) stopLoop();

    const scene = getScene();
    if (greebleGroup) {
        scene.remove(greebleGroup);
        greebleGroup.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }

    const ui = document.getElementById('greeble-ui-panel');
    if (ui) ui.remove();
}

async function generateGreebles(type) {
    greebleGroup.clear();

    const matData = {
        type: 'shader',
        uniforms: {
            uTime: { type: 'float', value: 0 },
            uColor: { type: 'color', value: type === 'pipes' ? '#00ddff' : '#ffaa00' }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            uniform float uTime;
            void main() {
                vUv = uv;
                vNormal = normal;
                vec3 pos = position;
                pos += normal * sin(uTime * 2.0 + position.y * 5.0) * 0.05;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            uniform float uTime;
            uniform vec3 uColor;
            void main() {
                float pulse = sin(uTime * 3.0) * 0.5 + 0.5;
                vec3 base = uColor * (vNormal.y * 0.5 + 0.5);
                vec3 rim = vec3(1.0) * pow(1.0 - dot(vNormal, vec3(0,0,1)), 3.0);
                gl_FragColor = vec4(base + rim * pulse, 1.0);
            }
        `
    };

    const material = materialLoader.create(matData);

    if (type === 'pipes') {
        for (let i = 0; i < 20; i++) {
            const h = Math.random() * 5 + 1;
            const r = 0.05 + Math.random() * 0.1;
            const geo = new THREE.CylinderGeometry(r, r, h, 8);
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            greebleGroup.add(mesh);
        }
    } else {
        for (let i = 0; i < 30; i++) {
            const s = Math.random() * 0.8 + 0.2;
            const geo = new THREE.BoxGeometry(s, s, 0.1);
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            greebleGroup.add(mesh);
        }
    }
}

function update() {
    const time = performance.now() * 0.001;
    if (greebleGroup) {
        greebleGroup.rotation.y += 0.002;
        greebleGroup.traverse(obj => {
            if (obj.material && obj.material.uniforms && obj.material.uniforms.uTime) {
                obj.material.uniforms.uTime.value = time;
            }
        });
    }
}

function injectUI() {
    const panel = document.createElement('div');
    panel.id = 'greeble-ui-panel';
    panel.style.cssText = `
        position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.8); color: white; 
        backdrop-filter: blur(15px);
        padding: 5px; border-radius: 40px; font-family: 'Inter', sans-serif;
        display: flex; gap: 5px; border: 1px solid rgba(255,255,255,0.1);
    `;

    panel.innerHTML = `
        <button id="btn-pipes" style="padding:10px 20px; background:#111; border:none; border-radius:30px; color:white; cursor:pointer; font-size:11px;">PIPES</button>
        <button id="btn-panels" style="padding:10px 20px; background:#111; border:none; border-radius:30px; color:white; cursor:pointer; font-size:11px;">PANELS</button>
        <button id="btn-clear" style="padding:10px 20px; background:rgba(255,0,0,0.1); border:none; border-radius:30px; color:#ff4444; cursor:pointer; font-size:11px;">CLEAR</button>
    `;

    containerEl.appendChild(panel);
    document.getElementById('btn-pipes').onclick = () => generateGreebles('pipes');
    document.getElementById('btn-panels').onclick = () => generateGreebles('panels');
    document.getElementById('btn-clear').onclick = () => greebleGroup.clear();
}

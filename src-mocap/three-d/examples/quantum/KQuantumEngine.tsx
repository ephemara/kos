import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
    SIM_VERTEX, VELOCITY_TEMPLATE, POSITION_FRAGMENT, RENDER_VERT, RENDER_FRAG, FEEDBACK_FRAGMENT,
    FLUID_ADVECT, FLUID_DIV, FLUID_PRESS, FLUID_GRAD, FLUID_SPLAT,
    generatePaletteTexture, COLOR_PALETTES,
    isRustMode, RUST_MODE_CONFIG
} from './KQuantumPresets';
import { useQuantumRust, ParticleData } from './hooks/useQuantumRust';

export interface KQuantumEngineProps {
    simRes: number;
    mode: number;
    speed: number;
    chaos: number;
    damping: number;
    pointSize: number;
    opacity: number;
    colorHex: string;
    color2Hex: string;
    colorMode: number;
    gradientStrength: number;
    highFidelity: boolean;
    autoOrbit: boolean;

    // Optics
    aberration: number;
    distortion: number;
    decay: number;

    // Modifiers
    activeModifiers: string[];
    modParams: any;

    // Scripts
    userScript: string;
    isScriptActive: boolean;

    // Audio
    audioBass: number;
    audioHigh: number;
    audioLevel: number;

    // Fluid Sim Toggle (Navier-Stokes)
    fluidSimEnabled: boolean;

    // Particle Life System
    particleLifeEnabled: boolean;
    lifeDecayRate: number;
    respawnBounds: number;

    // Force Controls
    forceMultiplier: number;
    curlStrength: number;
    centerPull: number;
    maxVelocity: number;

    engineRef: React.MutableRefObject<any>;
}

export default function KQuantumEngine({
    simRes, mode, speed, chaos, damping,
    pointSize, opacity, colorHex, color2Hex, colorMode, gradientStrength,
    highFidelity, autoOrbit,
    aberration, distortion, decay,
    activeModifiers, modParams,
    userScript, isScriptActive,
    audioBass, audioHigh, audioLevel,
    fluidSimEnabled,
    particleLifeEnabled, lifeDecayRate, respawnBounds,
    forceMultiplier, curlStrength, centerPull, maxVelocity,
    engineRef
}: KQuantumEngineProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number>();

    // --- RUST MODE STATE ---
    const quantum = useQuantumRust();
    const [rustParticleData, setRustParticleData] = useState<ParticleData | null>(null);
    const rustSimActiveRef = useRef(false);
    const lastModeRef = useRef(mode);

    // --- RUST MODE MANAGEMENT ---
    // Initialize/dispose Rust sim when switching to/from Rust modes
    useEffect(() => {
        const wasRust = isRustMode(lastModeRef.current);
        const nowRust = isRustMode(mode);
        lastModeRef.current = mode;

        const initRustSim = async () => {
            const config = RUST_MODE_CONFIG[mode];
            if (!config) {
                console.warn(`[KQuantum] No Rust config for mode ${mode}`);
                return;
            }

            // Dispose old sim if exists
            if (quantum.isActive()) {
                await quantum.dispose();
            }

            console.log(`[KQuantum] 🦀 Initializing Rust mode ${mode} with ${config.particle_count || 100000} particles`);

            // Create new Rust simulation
            await quantum.create({
                particle_count: config.particle_count || 100000,
                substeps: 4,
                nbody_enabled: config.nbody?.enabled || false,
                nbody_g: config.nbody?.g || 1.0,
                gravity: [0, 0, 0],
                drag: 0.005,
                bounds_min: [-100, -100, -100],
                bounds_max: [100, 100, 100],
                bounds_mode: 'bounce',
            });

            // Add attractors from config
            for (const attr of config.attractors) {
                await quantum.addAttractor(attr.type as any, attr.params);
            }

            // Enable N-body if configured
            if (config.nbody) {
                await quantum.setNBody(config.nbody.enabled, config.nbody.g, config.nbody.softening);
            }

            rustSimActiveRef.current = true;
        };

        const disposeRustSim = async () => {
            if (quantum.isActive()) {
                console.log('[KQuantum] 🦀 Disposing Rust simulation');
                await quantum.dispose();
                rustSimActiveRef.current = false;
                setRustParticleData(null);
            }
        };

        if (nowRust && !wasRust) {
            // Switching TO Rust mode
            initRustSim();
        } else if (!nowRust && wasRust) {
            // Switching FROM Rust mode
            disposeRustSim();
        } else if (nowRust && wasRust && mode !== lastModeRef.current) {
            // Changing between different Rust modes - reinit
            initRustSim();
        }

        return () => {
            // Cleanup on unmount
            if (rustSimActiveRef.current) {
                quantum.dispose();
            }
        };
    }, [mode]);

    // --- INIT ENGINE ---
    useEffect(() => {
        if (!mountRef.current) return;

        // Cleanup
        if (engineRef.current) {
            cancelAnimationFrame(engineRef.current.frameId);
            try {
                engineRef.current.renderer.dispose();
                engineRef.current.controls.dispose();
            } catch (e) { }
            engineRef.current = null;
            if (mountRef.current) mountRef.current.innerHTML = '';
        }

        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;

        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
        renderer.setSize(w, h);
        renderer.setClearColor(0x000000, 1);
        mountRef.current.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 10000);
        camera.position.set(0, 30, 60);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.autoRotate = autoOrbit;
        controls.autoRotateSpeed = 0.5;

        // --- BUFFERS & SHADERS ---
        const type = (renderer.capabilities.isWebGL2) ? THREE.HalfFloatType : THREE.FloatType;
        const createTarget = (sz: number) => new THREE.WebGLRenderTarget(sz, sz, { type, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat });

        const fbo = {
            pos: { A: createTarget(simRes), B: createTarget(simRes) },
            vel: { A: createTarget(simRes), B: createTarget(simRes) },
            fluid: { A: createTarget(128), B: createTarget(128) },
            div: createTarget(128),
            press: { A: createTarget(128), B: createTarget(128) }
        };

        const pCount = simRes * simRes;
        const pData = new Float32Array(pCount * 4);
        const vData = new Float32Array(pCount * 4);
        const originData = new Float32Array(pCount * 4);

        for (let i = 0; i < pCount; i++) {
            const i4 = i * 4;
            // Sphere distro
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 30.0 + Math.random() * 5.0;
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            pData[i4] = x; pData[i4 + 1] = y; pData[i4 + 2] = z; pData[i4 + 3] = Math.random();
            vData[i4] = 0; vData[i4 + 1] = 0; vData[i4 + 2] = 0; vData[i4 + 3] = 1;
            originData[i4] = x; originData[i4 + 1] = y; originData[i4 + 2] = z; originData[i4 + 3] = 1;
        }

        const initPosTex = new THREE.DataTexture(pData, simRes, simRes, THREE.RGBAFormat, THREE.FloatType); initPosTex.needsUpdate = true;
        const initVelTex = new THREE.DataTexture(vData, simRes, simRes, THREE.RGBAFormat, THREE.FloatType); initVelTex.needsUpdate = true;
        const originTex = new THREE.DataTexture(originData, simRes, simRes, THREE.RGBAFormat, THREE.FloatType); originTex.needsUpdate = true;

        const paletteTex = generatePaletteTexture(COLOR_PALETTES['COSMIC']);

        const mats: any = {
            vel: new THREE.ShaderMaterial({
                uniforms: {
                    velocityTexture: { value: null }, positionTexture: { value: null }, fluidTexture: { value: null }, originTexture: { value: originTex },
                    time: { value: 0 }, speed: { value: speed }, chaos: { value: chaos }, mode: { value: mode }, mousePos: { value: new THREE.Vector3() },
                    uDamping: { value: damping },
                    audioLevel: { value: 0 }, audioBass: { value: 0 }, audioHigh: { value: 0 },
                    // Original modifiers
                    uHeartbeatActive: { value: 0 }, uHeartbeatBPM: { value: 60 }, uHeartbeatIntensity: { value: 1 },
                    uHelixActive: { value: 0 }, uHelixSpeed: { value: 1 }, uHelixTightness: { value: 0.1 },
                    uSeismicActive: { value: 0 }, uSeismicScale: { value: 1 }, uSeismicFreq: { value: 2 },
                    uGravityActive: { value: 0 }, uGravityForce: { value: 5 }, uGravityRadius: { value: 10 },
                    // NEW: Rhythmic modifiers
                    uPulseActive: { value: 0 }, uPulseFreq: { value: 1 }, uPulseAmplitude: { value: 5 },
                    uBreatheActive: { value: 0 }, uBreatheRate: { value: 0.5 }, uBreatheDepth: { value: 10 },
                    // NEW: Force modifiers
                    uRepulsorActive: { value: 0 }, uRepulsorForce: { value: 10 }, uRepulsorFalloff: { value: 2 },
                    uOrbitActive: { value: 0 }, uOrbitSpeed: { value: 2 }, uOrbitRadius: { value: 20 },
                    uVortexActive: { value: 0 }, uVortexStrength: { value: 5 }, uVortexLift: { value: 1 },
                    uMagnetActive: { value: 0 }, uMagnetDipole: { value: 50 }, uMagnetSeparation: { value: 20 },
                    uExplosionActive: { value: 0 }, uExplosionForce: { value: 30 }, uExplosionDecay: { value: 0.95 },
                    uSwarmActive: { value: 0 }, uSwarmCohesion: { value: 1 }, uSwarmSeparation: { value: 2 },
                    // Physics controls
                    uForceMultiplier: { value: forceMultiplier },
                    uCurlStrength: { value: curlStrength },
                    uCenterPull: { value: centerPull },
                    uMaxVelocity: { value: maxVelocity },
                },
                vertexShader: SIM_VERTEX, fragmentShader: VELOCITY_TEMPLATE.replace('//_USER_CODE_INJECTION_', '')
            }),
            pos: new THREE.ShaderMaterial({
                uniforms: {
                    positionTexture: { value: null }, velocityTexture: { value: null }, originTexture: { value: originTex },
                    dt: { value: 0.016 }, mode: { value: mode }, time: { value: 0 },
                    // Particle life controls
                    uParticleLifeEnabled: { value: particleLifeEnabled ? 1.0 : 0.0 },
                    uLifeDecayRate: { value: lifeDecayRate },
                    uRespawnBounds: { value: respawnBounds },
                },
                vertexShader: SIM_VERTEX, fragmentShader: POSITION_FRAGMENT
            }),
            render: new THREE.ShaderMaterial({
                uniforms: {
                    positionTexture: { value: null }, velocityTexture: { value: null }, imageTexture: { value: null },
                    color: { value: new THREE.Color(colorHex) }, pixelRatio: { value: window.devicePixelRatio }, sizeMult: { value: pointSize }, colorMode: { value: colorMode }, forceDoppler: { value: false }, audioLevel: { value: 0 }, useImageColor: { value: true },
                    paletteTexture: { value: paletteTex },
                    opacityFactor: { value: opacity }
                },
                vertexShader: RENDER_VERT, fragmentShader: RENDER_FRAG,
                transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
            }),
            fluid: {
                advect: new THREE.ShaderMaterial({ uniforms: { velocityTex: { value: null }, sourceTex: { value: null }, dt: { value: 0.016 }, dissipation: { value: 0.98 } }, vertexShader: SIM_VERTEX, fragmentShader: FLUID_ADVECT }),
                div: new THREE.ShaderMaterial({ uniforms: { velocityTex: { value: null } }, vertexShader: SIM_VERTEX, fragmentShader: FLUID_DIV }),
                press: new THREE.ShaderMaterial({ uniforms: { pressureTex: { value: null }, divergenceTex: { value: null } }, vertexShader: SIM_VERTEX, fragmentShader: FLUID_PRESS }),
                grad: new THREE.ShaderMaterial({ uniforms: { pressureTex: { value: null }, velocityTex: { value: null } }, vertexShader: SIM_VERTEX, fragmentShader: FLUID_GRAD }),
                splat: new THREE.ShaderMaterial({ uniforms: { targetTex: { value: null }, point: { value: new THREE.Vector2() }, color: { value: new THREE.Vector3() }, radius: { value: 0.002 } }, vertexShader: SIM_VERTEX, fragmentShader: FLUID_SPLAT }),
            }
        };

        // Screen Quads
        const simScene = new THREE.Scene();
        const simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mats.fluid.advect);
        simScene.add(quad);

        // Feedback / Fullscreen
        const fullScreenScene = new THREE.Scene();
        const fullScreenCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const screenA = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
        const screenB = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
        const feedbackMat = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null }, tPrev: { value: null },
                decay: { value: decay }, aberration: { value: aberration }, distortion: { value: distortion }
            },
            vertexShader: SIM_VERTEX, fragmentShader: FEEDBACK_FRAGMENT
        });
        const finalQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), feedbackMat);
        fullScreenScene.add(finalQuad);

        // Particles
        const geo = new THREE.BufferGeometry();
        const refs = new Float32Array(pCount * 2);
        for (let i = 0; i < pCount; i++) { refs[i * 2] = (i % simRes) / simRes; refs[i * 2 + 1] = Math.floor(i / simRes) / simRes; }
        geo.setAttribute('reference', new THREE.BufferAttribute(refs, 2));
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pCount * 3), 3));
        const points = new THREE.Points(geo, mats.render);
        points.frustumCulled = false;
        scene.add(points);

        // Seed
        renderer.setRenderTarget(fbo.pos.A); quad.material = mats.pos; mats.pos.uniforms.positionTexture.value = initPosTex; renderer.render(simScene, simCam);
        renderer.setRenderTarget(fbo.vel.A); quad.material = mats.vel; mats.vel.uniforms.velocityTexture.value = initVelTex; renderer.render(simScene, simCam);

        // Engine Object
        const engine = {
            renderer, scene, camera, controls, fbo, mats, simScene, simCam, quad, points,
            screenA, screenB, finalQuad, fullScreenScene, fullScreenCam,
            mouse: new THREE.Vector3(), lastMouse: new THREE.Vector2(), mouseDown: false,
            clock: new THREE.Clock(), frameId: 0,
            compileShader: (code: string) => {
                const newFrag = VELOCITY_TEMPLATE.replace('//_USER_CODE_INJECTION_', code);
                mats.vel.fragmentShader = newFrag;
                mats.vel.needsUpdate = true;
            }
        };
        engineRef.current = engine;

        const animate = () => {
            const r = engineRef.current;
            if (!r) return;
            r.frameId = requestAnimationFrame(animate);
            r.controls.update();

            const time = r.clock.getElapsedTime();

            // ═══════════════════════════════════════════════════════════
            // NAVIER-STOKES FLUID SIM (Optional - OFF by default)
            // When enabled, creates fluid velocity field that affects particles
            // ═══════════════════════════════════════════════════════════
            if (fluidSimEnabled) {
                r.quad.material = r.mats.fluid.advect;
                r.mats.fluid.advect.uniforms.velocityTex.value = r.fbo.fluid.A.texture;
                r.mats.fluid.advect.uniforms.sourceTex.value = r.fbo.fluid.A.texture;
                r.renderer.setRenderTarget(r.fbo.fluid.B); r.renderer.render(r.simScene, r.simCam);
                [r.fbo.fluid.A, r.fbo.fluid.B] = [r.fbo.fluid.B, r.fbo.fluid.A];

                if (r.mouseDown) {
                    r.quad.material = r.mats.fluid.splat;
                    r.mats.fluid.splat.uniforms.targetTex.value = r.fbo.fluid.A.texture;
                    r.mats.fluid.splat.uniforms.point.value.set(r.lastMouse.x, r.lastMouse.y);
                    r.mats.fluid.splat.uniforms.color.value.set(r.mouse.z * 5, r.mouse.z * 2, r.mouse.z * 5);
                    r.renderer.setRenderTarget(r.fbo.fluid.B); r.renderer.render(r.simScene, r.simCam);
                    [r.fbo.fluid.A, r.fbo.fluid.B] = [r.fbo.fluid.B, r.fbo.fluid.A];
                }

                r.quad.material = r.mats.fluid.div;
                r.mats.fluid.div.uniforms.velocityTex.value = r.fbo.fluid.A.texture;
                r.renderer.setRenderTarget(r.fbo.div); r.renderer.render(r.simScene, r.simCam);

                r.quad.material = r.mats.fluid.press;
                r.mats.fluid.press.uniforms.divergenceTex.value = r.fbo.div.texture;
                for (let i = 0; i < 8; i++) {
                    r.mats.fluid.press.uniforms.pressureTex.value = r.fbo.press.A.texture;
                    r.renderer.setRenderTarget(r.fbo.press.B); r.renderer.render(r.simScene, r.simCam);
                    [r.fbo.press.A, r.fbo.press.B] = [r.fbo.press.B, r.fbo.press.A];
                }

                r.quad.material = r.mats.fluid.grad;
                r.mats.fluid.grad.uniforms.pressureTex.value = r.fbo.press.A.texture;
                r.mats.fluid.grad.uniforms.velocityTex.value = r.fbo.fluid.A.texture;
                r.renderer.setRenderTarget(r.fbo.fluid.B); r.renderer.render(r.simScene, r.simCam);
                [r.fbo.fluid.A, r.fbo.fluid.B] = [r.fbo.fluid.B, r.fbo.fluid.A];
            }


            // MAIN PARTICLE SIM - Branch based on mode type
            const usingRust = isRustMode(mode) && rustSimActiveRef.current;

            // ═══════════════════════════════════════════════════════════
            // RUST MODE: Step Rust simulation and upload data to GPU
            // ═══════════════════════════════════════════════════════════
            if (usingRust) {
                quantum.step(1 / 60).then((data) => {
                    if (!data || !engineRef.current) {
                        if (Math.random() < 0.01) console.warn('[KQuantum] 🦀 Rust step returned no data');
                        return;
                    }

                    // Convert Rust positions to texture data
                    // Rust returns: positions = [x,y,z,age, x,y,z,age, ...]
                    const rustCount = data.count;
                    if (rustCount === 0 && Math.random() < 0.01) console.warn('[KQuantum] 🦀 Rust step returned 0 particles');

                    const sqrtCount = Math.ceil(Math.sqrt(rustCount));

                    // Create new texture from Rust data if particle count changed
                    if (!r.rustPosTex || r.rustPosTex.image.width !== sqrtCount) {
                        // console.log(`[KQuantum] 🦀 Creating new textures for ${rustCount} particles (${sqrtCount}x${sqrtCount})`);
                        const posArray = new Float32Array(sqrtCount * sqrtCount * 4);
                        const velArray = new Float32Array(sqrtCount * sqrtCount * 4);

                        // Copy Rust data
                        for (let i = 0; i < rustCount && i * 4 < data.positions.length; i++) {
                            posArray[i * 4] = data.positions[i * 4];
                            posArray[i * 4 + 1] = data.positions[i * 4 + 1];
                            posArray[i * 4 + 2] = data.positions[i * 4 + 2];
                            posArray[i * 4 + 3] = data.positions[i * 4 + 3]; // age

                            velArray[i * 4] = data.velocities[i * 4];
                            velArray[i * 4 + 1] = data.velocities[i * 4 + 1];
                            velArray[i * 4 + 2] = data.velocities[i * 4 + 2];
                            velArray[i * 4 + 3] = data.velocities[i * 4 + 3]; // mass
                        }

                        r.rustPosTex = new THREE.DataTexture(posArray, sqrtCount, sqrtCount, THREE.RGBAFormat, THREE.FloatType);
                        r.rustVelTex = new THREE.DataTexture(velArray, sqrtCount, sqrtCount, THREE.RGBAFormat, THREE.FloatType);
                        r.rustPosTex.needsUpdate = true;
                        r.rustVelTex.needsUpdate = true;
                    } else {
                        // Update existing texture data
                        const posArray = r.rustPosTex.image.data as Float32Array;
                        const velArray = r.rustVelTex.image.data as Float32Array;

                        for (let i = 0; i < rustCount && i * 4 < data.positions.length; i++) {
                            posArray[i * 4] = data.positions[i * 4];
                            posArray[i * 4 + 1] = data.positions[i * 4 + 1];
                            posArray[i * 4 + 2] = data.positions[i * 4 + 2];
                            posArray[i * 4 + 3] = data.positions[i * 4 + 3];

                            velArray[i * 4] = data.velocities[i * 4];
                            velArray[i * 4 + 1] = data.velocities[i * 4 + 1];
                            velArray[i * 4 + 2] = data.velocities[i * 4 + 2];
                            velArray[i * 4 + 3] = data.velocities[i * 4 + 3];
                        }

                        r.rustPosTex.needsUpdate = true;
                        r.rustVelTex.needsUpdate = true;
                    }

                    // Use Rust textures for rendering
                    r.mats.render.uniforms.positionTexture.value = r.rustPosTex;
                    r.mats.render.uniforms.velocityTexture.value = r.rustVelTex;
                }).catch(e => {
                    if (Math.random() < 0.01) console.error('[KQuantum] 🦀 Rust step error:', e);
                });
            } else {
                // ═══════════════════════════════════════════════════════════
                // JS MODE: Use GLSL shader physics (original behavior)
                // ═══════════════════════════════════════════════════════════
                r.mats.vel.uniforms.time.value = time;
                r.mats.pos.uniforms.time.value = time;
                r.mats.vel.uniforms.velocityTexture.value = r.fbo.vel.A.texture;
                r.mats.vel.uniforms.positionTexture.value = r.fbo.pos.A.texture;
                r.mats.vel.uniforms.fluidTexture.value = r.fbo.fluid.A.texture;
                r.mats.vel.uniforms.mousePos.value.copy(r.mouse);

                r.quad.material = r.mats.vel;
                r.renderer.setRenderTarget(r.fbo.vel.B); r.renderer.render(r.simScene, r.simCam);
                [r.fbo.vel.A, r.fbo.vel.B] = [r.fbo.vel.B, r.fbo.vel.A];

                r.quad.material = r.mats.pos;
                r.mats.pos.uniforms.velocityTexture.value = r.fbo.vel.A.texture;
                r.mats.pos.uniforms.positionTexture.value = r.fbo.pos.A.texture;
                r.renderer.setRenderTarget(r.fbo.pos.B); r.renderer.render(r.simScene, r.simCam);
                [r.fbo.pos.A, r.fbo.pos.B] = [r.fbo.pos.B, r.fbo.pos.A];

                // Use FBO textures for rendering
                r.mats.render.uniforms.positionTexture.value = r.fbo.pos.A.texture;
                r.mats.render.uniforms.velocityTexture.value = r.fbo.vel.A.texture;
            }

            // RENDER TO SCREEN A (textures already set in branch above)
            r.renderer.setRenderTarget(r.screenA);
            r.renderer.clear();
            r.renderer.render(r.scene, r.camera);

            // FEEDBACK TO SCREEN B
            r.finalQuad.material.uniforms.tDiffuse.value = r.screenA.texture;
            r.finalQuad.material.uniforms.tPrev.value = r.screenB.texture;

            r.renderer.setRenderTarget(null);
            r.renderer.render(r.fullScreenScene, r.fullScreenCam);

            // SAVE FOR NEXT FRAME
            r.renderer.setRenderTarget(r.screenB);
            r.renderer.render(r.fullScreenScene, r.fullScreenCam);
        };
        animate();

        const handleResize = () => {
            if (mountRef.current && engineRef.current) {
                const w = mountRef.current.clientWidth;
                const h = mountRef.current.clientHeight;
                engineRef.current.renderer.setSize(w, h);
                engineRef.current.camera.aspect = w / h;
                engineRef.current.camera.updateProjectionMatrix();

                engineRef.current.screenA.setSize(w, h);
                engineRef.current.screenB.setSize(w, h);
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (engineRef.current) cancelAnimationFrame(engineRef.current.frameId);
        };
    }, [simRes]); // Re-init on resolution change


    // --- UPDATE UNIFORMS (Prop Changes) ---
    useEffect(() => {
        if (!engineRef.current || !engineRef.current.mats) return;
        const r = engineRef.current;
        const m = r.mats;

        m.vel.uniforms.mode.value = mode;
        m.pos.uniforms.mode.value = mode;
        m.vel.uniforms.speed.value = speed;
        m.vel.uniforms.chaos.value = chaos;
        m.vel.uniforms.uDamping.value = damping;

        // Force controls (velocity shader)
        m.vel.uniforms.uForceMultiplier.value = forceMultiplier;
        m.vel.uniforms.uCurlStrength.value = curlStrength;
        m.vel.uniforms.uCenterPull.value = centerPull;
        m.vel.uniforms.uMaxVelocity.value = maxVelocity;

        // Particle life controls (position shader)
        m.pos.uniforms.uParticleLifeEnabled.value = particleLifeEnabled ? 1.0 : 0.0;
        m.pos.uniforms.uLifeDecayRate.value = lifeDecayRate;
        m.pos.uniforms.uRespawnBounds.value = respawnBounds;

        m.render.uniforms.color.value.set(colorHex);
        m.render.uniforms.sizeMult.value = pointSize;
        m.render.uniforms.colorMode.value = colorMode;
        m.render.uniforms.opacityFactor.value = opacity * (simRes >= 2048 ? 0.05 : 0.8);

        r.finalQuad.material.uniforms.decay.value = decay;
        r.finalQuad.material.uniforms.aberration.value = aberration;
        r.finalQuad.material.uniforms.distortion.value = distortion;

        if (r.controls) r.controls.autoRotate = autoOrbit;

        // Audio
        m.vel.uniforms.audioBass.value = audioBass;
        m.vel.uniforms.audioHigh.value = audioHigh;
        m.vel.uniforms.audioLevel.value = audioLevel;

        // Modifiers - Original
        const uv = m.vel.uniforms;
        uv.uHeartbeatActive.value = activeModifiers.includes('heartbeat') ? 1.0 : 0.0;
        uv.uHeartbeatBPM.value = modParams['heartbeat_bpm'] || 60;
        uv.uHeartbeatIntensity.value = modParams['heartbeat_intensity'] || 2.0;
        uv.uSeismicActive.value = activeModifiers.includes('seismic') ? 1.0 : 0.0;
        uv.uSeismicScale.value = modParams['seismic_scale'] || 1.0;
        uv.uSeismicFreq.value = modParams['seismic_freq'] || 2.0;
        uv.uHelixActive.value = activeModifiers.includes('helix') ? 1.0 : 0.0;
        uv.uHelixSpeed.value = modParams['helix_speed'] || 1.0;
        uv.uHelixTightness.value = modParams['helix_tightness'] || 0.1;
        uv.uGravityActive.value = activeModifiers.includes('gravity') ? 1.0 : 0.0;
        uv.uGravityForce.value = modParams['gravity_force'] || 5.0;
        uv.uGravityRadius.value = modParams['gravity_radius'] || 10.0;

        // NEW Modifiers - Rhythmic
        uv.uPulseActive.value = activeModifiers.includes('pulse') ? 1.0 : 0.0;
        uv.uPulseFreq.value = modParams['pulse_freq'] || 1.0;
        uv.uPulseAmplitude.value = modParams['pulse_amplitude'] || 5.0;
        uv.uBreatheActive.value = activeModifiers.includes('breathe') ? 1.0 : 0.0;
        uv.uBreatheRate.value = modParams['breathe_rate'] || 0.5;
        uv.uBreatheDepth.value = modParams['breathe_depth'] || 10.0;

        // NEW Modifiers - Forces
        uv.uRepulsorActive.value = activeModifiers.includes('repulsor') ? 1.0 : 0.0;
        uv.uRepulsorForce.value = modParams['repulsor_force'] || 10.0;
        uv.uRepulsorFalloff.value = modParams['repulsor_falloff'] || 2.0;
        uv.uOrbitActive.value = activeModifiers.includes('orbit') ? 1.0 : 0.0;
        uv.uOrbitSpeed.value = modParams['orbit_speed'] || 2.0;
        uv.uOrbitRadius.value = modParams['orbit_radius'] || 20.0;
        uv.uVortexActive.value = activeModifiers.includes('vortex') ? 1.0 : 0.0;
        uv.uVortexStrength.value = modParams['vortex_strength'] || 5.0;
        uv.uVortexLift.value = modParams['vortex_lift'] || 1.0;
        uv.uMagnetActive.value = activeModifiers.includes('magnet') ? 1.0 : 0.0;
        uv.uMagnetDipole.value = modParams['magnet_dipole'] || 50.0;
        uv.uMagnetSeparation.value = modParams['magnet_separation'] || 20.0;
        uv.uExplosionActive.value = activeModifiers.includes('explosion') ? 1.0 : 0.0;
        uv.uExplosionForce.value = modParams['explosion_force'] || 30.0;
        uv.uExplosionDecay.value = modParams['explosion_decay'] || 0.95;
        uv.uSwarmActive.value = activeModifiers.includes('swarm') ? 1.0 : 0.0;
        uv.uSwarmCohesion.value = modParams['swarm_cohesion'] || 1.0;
        uv.uSwarmSeparation.value = modParams['swarm_separation'] || 2.0;

    }, [mode, speed, chaos, damping, colorHex, pointSize, opacity, colorMode, highFidelity, autoOrbit, aberration, distortion, decay, activeModifiers, modParams, audioBass, audioHigh, audioLevel, simRes, forceMultiplier, curlStrength, centerPull, maxVelocity, particleLifeEnabled, lifeDecayRate, respawnBounds]);


    // --- INTERACTION ---
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!engineRef.current || !mountRef.current) return;
        const r = engineRef.current;
        const rect = mountRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = 1.0 - (e.clientY - rect.top) / rect.height;
        r.mouse.x = x * 2 - 1;
        r.mouse.y = y * 2 - 1;
        r.lastMouse.set(x, y);

        // Raycast for Z depth - MIDDLE MOUSE CLICK (button 4) to avoid accidental interaction
        // Left-click (1) is for UI, Middle-click (4) is for particle interaction
        r.mouse.z = (e.buttons === 4) ? 1.0 : 0.0;
        r.mouseDown = (e.buttons === 4);
    };

    return (
        <div
            ref={mountRef}
            className="w-full h-full relative overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseMove}
            onMouseUp={() => { if (engineRef.current) engineRef.current.mouseDown = false; }}
        />
    );
}

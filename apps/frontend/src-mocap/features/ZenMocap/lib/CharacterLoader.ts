/**
 * CharacterLoader
 *
 * Loads a GLB skinned mesh + its retarget JSON, then drives the character's
 * bones each frame from COCO JointFrame data.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * COORDINATE SPACE CONVERSION (critical)
 * ───────────────────────────────────────────────────────────────────────────
 * COCO x/y are NORMALISED IMAGE COORDS [0,1]:
 *   - origin top-left, x right, y DOWN
 *   - z is a depth estimate from the model, often near-zero and noisy
 *
 * Three.js is Y-UP, Z-towards-camera (right-hand):
 *   - we need to map COCO [0,1]×[0,1] → world space
 *
 * Strategy:
 *  - Re-centre X around 0 (subtract 0.5), scale to ≈ body width in metres
 *  - Flip Y (1 - y), then scale to ≈ body height in metres
 *  - Use a STABLE, model-independent body scale so poses look correct
 *    regardless of how far the person is from the camera.
 *
 * The scale is captured lazily from the first confident frame (hip-to-shoulder
 * distance informs absolute scale). After that everything is relative.
 *
 * Design:
 *  - One `CharacterLoader` per character in the scene
 *  - `retargetFrame(frame)` called from the existing rAF tick in SessionViewport
 *    — zero React, zero allocations in the hot path
 *  - Quaternion solving uses `setFromUnitVectors(restDir, liveDir)` — no gimbal
 *  - Handles Mixamo (Y-up/Z-forward/cm, T-pose) and UE5 Manny (Z-up/X-forward/m, A-pose)
 *    transparently via the retarget JSON
 *
 * Asset path convention:
 *  In dev:  assets served from /resources/ via Vite proxy
 *  In prod: resolved via Tauri `asset://` protocol using convertFileSrc()
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { convertFileSrc } from '@tauri-apps/api/core';
import { JOINT_NAMES, type Joint, type JointFrame, type JointName } from '../types';
import { getTrackingSettings } from '../trackingConfig';

// ─── Retarget Map Types ───────────────────────────────────────────────────────

export interface JointBinding {
    coco: JointName | 'mid_hip';
    bone: string;          // exact bone name as in the GLB
    mode: 'direction';     // only mode supported for now
}

export interface CharacterRetargetMap {
    id: string;
    label: string;
    file: string;
    scale: number;
    forward_axis: 'x' | '-x' | 'z' | '-z';
    up_axis: 'y' | 'z';
    joints: JointBinding[];
    root_bone: string;
    root_coco: 'mid_hip';
    spine_bones: string[];
    rest_pose: 'a_pose' | 't_pose';
    target_height?: number;
    yaw_offset_deg?: number;
}

// ─── Per-bone solved state ────────────────────────────────────────────────────

export interface CharacterState {
    loaded: boolean;
    model: THREE.Group | null;
    boneMap: Map<string, THREE.Bone>;
    restDirs: Map<string, THREE.Vector3>;  // canonical parent-local bone directions in rest pose
    retarget: CharacterRetargetMap | null;
    rootMotionScaleY: number;
    rootBaselineY: number;
    hipBaselineY: number | null;
    /** Scale factor: COCO normalised units → Three.js world metres */
    cocoToWorld: number | null;
    /** World-space Y offset so pelvis stays at correct height */
    worldYOffset: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const _va = new THREE.Vector3();
const _vb = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const MIN_TORSO_SPAN = 0.04;
const MAX_TORSO_SPAN = 0.7;
const ZERO_JOINT: Joint = { position: [0, 0, 0], confidence: 0 };

interface JointHistorySample {
    position: [number, number, number];
    confidence: number;
    timestampMs: number;
}

function normalizeBoneName(name: string): string {
    return name
        .toLowerCase()
        .replace(/^mixamorig:/, '')
        .replace(/[_\-\s]\d+$/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function isPlausibleJointSample(
    j: Joint | undefined,
    minConfidence: number,
): j is Joint {
    if (!j) return false;
    const [x, y, z] = j.position;
    return (
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(z) &&
        x >= 0 && x <= 1 &&
        y >= 0 && y <= 1 &&
        z >= -1 && z <= 1 &&
        j.confidence >= minConfidence
    );
}

/**
 * Convert a COCO normalised [0,1] coordinate to Three.js world space.
 *
 * @param cx   COCO x  (0=left, 1=right)
 * @param cy   COCO y  (0=top,  1=bottom)
 * @param cz   COCO z  (depth, often noisy — used as-is, scaled down)
 * @param scale  pixels→metres scale derived from observed body size
 */
function cocoToWorld3D(
    cx: number, cy: number, cz: number,
    scale: number,
    yOffset: number,
): THREE.Vector3 {
    // Re-centre X around 0 (image centre = character centre)
    const wx = (cx - 0.5) * scale;
    // Flip Y (image top=0 → world Y high), shift up to pelvis height
    const wy = (1.0 - cy) * scale + yOffset;
    // Z-depth: model output is noisy; attenuate heavily, use for slight 3D feel
    const wz = cz * scale * 0.3;
    return new THREE.Vector3(wx, wy, wz);
}

/** Compute COCO joint mid-hip as average of left_hip + right_hip */
function midHip(frame: JointFrame, minConfidence: number): THREE.Vector3 | null {
    const lh = frame.joints['left_hip'];
    const rh = frame.joints['right_hip'];
    if (!isPlausibleJointSample(lh, minConfidence) || !isPlausibleJointSample(rh, minConfidence)) return null;
    const scale = (frame as any)._cocoScale ?? 1;
    const yOff = (frame as any)._cocoYOffset ?? 0;
    return cocoToWorld3D(
        (lh.position[0] + rh.position[0]) / 2,
        (lh.position[1] + rh.position[1]) / 2,
        (lh.position[2] + rh.position[2]) / 2,
        scale, yOff,
    );
}

/** Compute midpoint of shoulders as a stable torso parent for upper body solves */
function midShoulder(frame: JointFrame, minConfidence: number): THREE.Vector3 | null {
    const ls = frame.joints['left_shoulder'];
    const rs = frame.joints['right_shoulder'];
    if (!isPlausibleJointSample(ls, minConfidence) || !isPlausibleJointSample(rs, minConfidence)) return null;
    const scale = (frame as any)._cocoScale ?? 1;
    const yOff = (frame as any)._cocoYOffset ?? 0;
    return cocoToWorld3D(
        (ls.position[0] + rs.position[0]) / 2,
        (ls.position[1] + rs.position[1]) / 2,
        (ls.position[2] + rs.position[2]) / 2,
        scale, yOff,
    );
}

type CocoAlias = JointName | 'mid_hip' | 'mid_shoulder';

function parentCoco(coco: JointBinding['coco']): CocoAlias | null {
    switch (coco) {
        case 'left_hip':
        case 'right_hip':
            return 'mid_hip';
        case 'left_knee':
            return 'left_hip';
        case 'right_knee':
            return 'right_hip';
        case 'left_ankle':
            return 'left_knee';
        case 'right_ankle':
            return 'right_knee';
        case 'left_elbow':
            return 'left_shoulder';
        case 'right_elbow':
            return 'right_shoulder';
        case 'left_wrist':
            return 'left_elbow';
        case 'right_wrist':
            return 'right_elbow';
        case 'left_shoulder':
        case 'right_shoulder':
        case 'nose':
            return 'mid_shoulder';
        default:
            return null;
    }
}

/** Get world position of a COCO joint from frame (or mid_hip) */
function getCocoPos(frame: JointFrame, cocoName: string, minConfidence: number): THREE.Vector3 | null {
    if (cocoName === 'mid_hip') return midHip(frame, minConfidence);
    if (cocoName === 'mid_shoulder') return midShoulder(frame, minConfidence);
    const j = frame.joints[cocoName as JointName];
    if (!isPlausibleJointSample(j, minConfidence)) return null;
    const scale = (frame as any)._cocoScale ?? 1;
    const yOff = (frame as any)._cocoYOffset ?? 0;
    return cocoToWorld3D(j.position[0], j.position[1], j.position[2], scale, yOff);
}

function getCocoConfidence(frame: JointFrame, cocoName: string): number {
    if (cocoName === 'mid_hip') {
        const lh = frame.joints['left_hip']?.confidence ?? 0;
        const rh = frame.joints['right_hip']?.confidence ?? 0;
        return (lh + rh) * 0.5;
    }
    if (cocoName === 'mid_shoulder') {
        const ls = frame.joints['left_shoulder']?.confidence ?? 0;
        const rs = frame.joints['right_shoulder']?.confidence ?? 0;
        return (ls + rs) * 0.5;
    }
    return frame.joints[cocoName as JointName]?.confidence ?? 0;
}

function getWorldHeight(object: THREE.Object3D): number {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return 0;
    const size = new THREE.Vector3();
    box.getSize(size);
    return size.y;
}

function groundToFloor(object: THREE.Object3D): void {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    object.position.y -= box.min.y;
    object.updateMatrixWorld(true);
}

function applyCoordinateCorrection(
    model: THREE.Object3D,
    retarget: Pick<CharacterRetargetMap, 'up_axis' | 'forward_axis'>,
): void {
    const { up_axis, forward_axis } = retarget;
    const baseRot = model.rotation.clone();

    if (up_axis === 'z') {
        const xCandidates = [0, -Math.PI / 2, Math.PI / 2];
        let bestX = 0;
        let bestHeight = -Infinity;
        for (const x of xCandidates) {
            model.rotation.set(baseRot.x + x, baseRot.y, baseRot.z);
            const h = getWorldHeight(model);
            if (h > bestHeight) { bestHeight = h; bestX = x; }
        }
        model.rotation.set(baseRot.x + bestX, baseRot.y, baseRot.z);
    } else {
        model.rotation.set(baseRot.x, baseRot.y, baseRot.z);
    }

    if (forward_axis === 'x') model.rotation.y += -Math.PI / 2;
    else if (forward_axis === '-x') model.rotation.y += Math.PI / 2;
    else if (forward_axis === '-z') model.rotation.y += Math.PI;
}

// ─── CharacterLoader ─────────────────────────────────────────────────────────

export class CharacterLoader {
    private jointHistory = new Map<JointName, JointHistorySample>();

    private state: CharacterState = {
        loaded: false,
        model: null,
        boneMap: new Map(),
        restDirs: new Map(),
        retarget: null,
        rootMotionScaleY: 1,
        rootBaselineY: 0,
        hipBaselineY: null,
        cocoToWorld: null,
        worldYOffset: null,
    };

    private loader = new GLTFLoader();

    private frameNow(frame: JointFrame): number {
        if (Number.isFinite(frame.timestamp_ms) && frame.timestamp_ms > 0) return frame.timestamp_ms;
        return Date.now();
    }

    private getStableJoint(frame: JointFrame, name: JointName): Joint {
        const tracking = getTrackingSettings();
        const nowMs = this.frameNow(frame);
        const current = frame.joints[name];

        if (isPlausibleJointSample(current, tracking.minRetargetConfidence)) {
            if (current.confidence >= tracking.historyMinConfidence) {
                this.jointHistory.set(name, {
                    position: [current.position[0], current.position[1], current.position[2]],
                    confidence: current.confidence,
                    timestampMs: nowMs,
                });
            }
            return current;
        }

        const history = this.jointHistory.get(name);
        if (!history) return current ?? ZERO_JOINT;

        const ageMs = nowMs - history.timestampMs;
        if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > tracking.historyHoldMs) {
            this.jointHistory.delete(name);
            return current ?? ZERO_JOINT;
        }

        const decay = Math.max(0, 1 - (ageMs / tracking.historyHoldMs));
        return {
            position: [history.position[0], history.position[1], history.position[2]],
            confidence: Math.max(tracking.historyConfidenceDecayFloor, history.confidence * decay),
        };
    }

    private buildStableFrame(frame: JointFrame): JointFrame {
        const joints = { ...frame.joints } as Record<JointName, Joint>;
        JOINT_NAMES.forEach((name) => {
            joints[name] = this.getStableJoint(frame, name);
        });
        return {
            ...frame,
            joints,
        };
    }

    /** Asset base URL — dev uses /resources/ via Vite proxy, prod uses Tauri asset:// */
    private assetUrl(file: string): string {
        if ((import.meta as any).env?.DEV) {
            return `/resources/assets/meshes/${file}`;
        }
        return convertFileSrc(`resources/assets/meshes/${file}`);
    }

    /**
     * Load a character GLB + its retarget JSON, add mesh to scene.
     * Returns when both are ready. Call once per character.
     */
    async load(
        retargetJsonPath: string,
        scene: THREE.Scene,
    ): Promise<void> {
        // 1. Fetch retarget map
        const mapRes = await fetch(retargetJsonPath);
        if (!mapRes.ok) throw new Error(`Failed to load retarget map: ${retargetJsonPath}`);
        const retarget: CharacterRetargetMap = await mapRes.json();

        // 2. Load GLB
        const glbUrl = this.assetUrl(retarget.file);
        const gltf = await this.loader.loadAsync(glbUrl);

        const model = gltf.scene;
        model.scale.setScalar(retarget.scale);

        applyCoordinateCorrection(model, retarget);

        if (retarget.yaw_offset_deg && Number.isFinite(retarget.yaw_offset_deg)) {
            model.rotation.y += (retarget.yaw_offset_deg * Math.PI) / 180.0;
        }

        // Normalize to a consistent visual height
        const targetHeight = retarget.target_height ?? 1.8;
        const currentHeight = getWorldHeight(model);
        if (currentHeight > 0.0001) {
            model.scale.multiplyScalar(targetHeight / currentHeight);
        }

        scene.add(model);
        model.updateMatrixWorld(true);

        // 3. Build bone map
        const boneMap = new Map<string, THREE.Bone>();
        model.traverse(obj => {
            if ((obj as THREE.Bone).isBone) {
                boneMap.set(obj.name, obj as THREE.Bone);
            }
        });

        // Resolve retarget bone names against the loaded GLB skeleton.
        // This makes retarget maps resilient to exporter renames/suffix drift.
        const normalizedLookup = new Map<string, string[]>();
        for (const boneName of boneMap.keys()) {
            const key = normalizeBoneName(boneName);
            const list = normalizedLookup.get(key) ?? [];
            list.push(boneName);
            normalizedLookup.set(key, list);
        }
        const allBoneNames = [...boneMap.keys()];
        const resolveBone = (requested: string): string | null => {
            if (boneMap.has(requested)) return requested;

            const reqNorm = normalizeBoneName(requested);
            const exactNorm = normalizedLookup.get(reqNorm);
            if (exactNorm && exactNorm.length > 0) return exactNorm[0];

            const startsWith = allBoneNames.find(n => normalizeBoneName(n).startsWith(reqNorm));
            if (startsWith) return startsWith;

            const contains = allBoneNames.find(n => normalizeBoneName(n).includes(reqNorm));
            if (contains) return contains;

            return null;
        };

        const resolvedJoints: JointBinding[] = retarget.joints.map(binding => {
            const resolvedBone = resolveBone(binding.bone);
            return {
                ...binding,
                bone: resolvedBone ?? binding.bone,
            };
        });
        const unresolved = resolvedJoints
            .filter(binding => !boneMap.has(binding.bone))
            .map(binding => binding.bone);
        if (unresolved.length > 0) {
            console.warn(
                `[CharacterLoader] Unresolved retarget bones (${unresolved.length}) for ${retarget.id}:`,
                unresolved,
            );
        }
        const resolvedRoot = resolveBone(retarget.root_bone) ?? retarget.root_bone;
        const resolvedSpine = retarget.spine_bones
            .map(name => resolveBone(name))
            .filter((name): name is string => Boolean(name));
        const resolvedRetarget: CharacterRetargetMap = {
            ...retarget,
            joints: resolvedJoints,
            root_bone: resolvedRoot,
            spine_bones: resolvedSpine.length > 0 ? resolvedSpine : retarget.spine_bones,
        };

        // Ground by mesh bounds
        groundToFloor(model);
        model.updateMatrixWorld(true);

        const rootMotionScaleY = Math.abs(model.scale.y) > 0.000001 ? model.scale.y : 1;

        // 4. Capture rest-pose bone directions in parent-local space.
        // Solving in local space avoids world-space accumulation drift.
        const restDirs = new Map<string, THREE.Vector3>();
        model.updateMatrixWorld(true);

        for (const binding of resolvedRetarget.joints) {
            const bone = boneMap.get(binding.bone);
            if (!bone) continue;
            const parent = bone.parent;
            if (!parent) continue;

            const dirLocal = bone.position.clone().normalize();
            if (dirLocal.lengthSq() > 0.0001) {
                restDirs.set(binding.bone, dirLocal);
            }
        }

        // Enable shadows
        model.traverse(obj => {
            if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
                (obj as THREE.SkinnedMesh).castShadow = true;
                (obj as THREE.SkinnedMesh).receiveShadow = true;
                (obj as THREE.SkinnedMesh).frustumCulled = false;
            }
        });

        const rootBaselineY = boneMap.get(resolvedRetarget.root_bone)?.position.y ?? 0;

        this.state = {
            loaded: true,
            model,
            boneMap,
            restDirs,
            retarget: resolvedRetarget,
            rootMotionScaleY,
            rootBaselineY,
            hipBaselineY: null,
            cocoToWorld: null,    // calibrated from first live frame
            worldYOffset: null,
        };
    }

    /**
     * Drive character bones from a JointFrame.
     *
     * COCO x/y coords are [0,1] IMAGE-space — we convert to world-space here.
     * Scale is auto-calibrated from the first confident frame using the
     * shoulder-hip distance as a reference (a reliable COCO pair).
     *
     * Call from the rAF tick — zero heap allocations after warm-up.
     */
    retargetFrame(frame: JointFrame): void {
        const { loaded, boneMap, restDirs, retarget } = this.state;
        if (!loaded || !retarget) return;
        const stableFrame = this.buildStableFrame(frame);
        const tracking = getTrackingSettings();

        // ── Step 1: Calibrate COCO → world scale on first reliable frame ────────
        const ls = stableFrame.joints['left_shoulder'];
        const rs = stableFrame.joints['right_shoulder'];
        const lh = stableFrame.joints['left_hip'];
        const rh = stableFrame.joints['right_hip'];

        if (isPlausibleJointSample(ls, tracking.minCalibrationConfidence)
            && isPlausibleJointSample(rs, tracking.minCalibrationConfidence)
            && isPlausibleJointSample(lh, tracking.minCalibrationConfidence)
            && isPlausibleJointSample(rh, tracking.minCalibrationConfidence)) {
            // Use torso diagonal as scale reference: shoulder-mid to hip-mid (COCO units)
            const shoulderMidY = (ls.position[1] + rs.position[1]) / 2;
            const hipMidY = (lh.position[1] + rh.position[1]) / 2;
            const torsoPixH = Math.abs(hipMidY - shoulderMidY); // in [0,1] units

            if (torsoPixH >= MIN_TORSO_SPAN && torsoPixH <= MAX_TORSO_SPAN) {
                // Torso is ~46% of adult height (~1.8m). If torsoPixH ≈ 0.3 of image height,
                // that's a full view. Scale so torso = 0.83m (46% of 1.8m).
                const TORSO_REAL_M = 0.83;
                const candidateScale = THREE.MathUtils.clamp(TORSO_REAL_M / torsoPixH, 1.0, 3.0);

                // Y-offset: place hip at correct world height (~0.95m)
                const hipMidYCoco = hipMidY;
                const hipWorldTarget = 0.95; // metres from ground
                const candidateYOffset = hipWorldTarget - (1.0 - hipMidYCoco) * candidateScale;

                if (this.state.cocoToWorld == null || this.state.worldYOffset == null) {
                    this.state.cocoToWorld = candidateScale;
                    this.state.worldYOffset = candidateYOffset;
                } else {
                    const prev = this.state.cocoToWorld;
                    const ratio = candidateScale / Math.max(prev, 0.0001);
                    // Ignore abrupt calibration spikes; blend only plausible drift.
                    if (ratio > 0.85 && ratio < 1.15) {
                        this.state.cocoToWorld = THREE.MathUtils.lerp(prev, candidateScale, 0.08);
                        this.state.worldYOffset = THREE.MathUtils.lerp(this.state.worldYOffset, candidateYOffset, 0.08);
                    }
                }
            }
        } else if (this.state.cocoToWorld === null) {
            // Fallback so sparse first frames still drive the mesh.
            this.state.cocoToWorld = 1.8;
            this.state.worldYOffset = 0.0;
        }

        const scale = this.state.cocoToWorld!;
        const yOff = this.state.worldYOffset!;

        // Attach calibration to frame so helpers can read it (zero-alloc trick)
        (stableFrame as any)._cocoScale = scale;
        (stableFrame as any)._cocoYOffset = yOff;

        // ── Step 2: Root (pelvis) position ────────────────────────────────────
        const rootBone = boneMap.get(retarget.root_bone);
        const hipPos = midHip(stableFrame, tracking.minRetargetConfidence);

        if (rootBone && hipPos) {
            // Drive root Y — keep X/Z at center (we only have 2D camera)
            rootBone.position.y = hipPos.y / this.state.rootMotionScaleY;
            // Optional small X offset mirrors left/right sway
            rootBone.position.x = hipPos.x * 0.5;
        }

        // ── Step 3: Per-bone direction solve ─────────────────────────────────
        for (const binding of retarget.joints) {
            const bone = boneMap.get(binding.bone);
            if (!bone) continue;

            const restDir = restDirs.get(binding.bone);
            if (!restDir) continue;

            const childPos = getCocoPos(stableFrame, binding.coco, tracking.minRetargetConfidence);
            if (!childPos) continue;

            const parentBone = bone.parent;
            if (!parentBone) continue;

            const parentJointName = parentCoco(binding.coco);
            const parentPos = parentJointName
                ? getCocoPos(stableFrame, parentJointName, tracking.minRetargetConfidence)
                : null;

            if (parentPos) {
                _vb.copy(childPos).sub(parentPos).normalize();
            } else {
                _va.setFromMatrixPosition(parentBone.matrixWorld);
                _vb.copy(childPos).sub(_va).normalize();
            }

            if (_vb.lengthSq() < 0.0001) continue;

            const parentWorldQuat = new THREE.Quaternion();
            parentBone.getWorldQuaternion(parentWorldQuat);
            const parentWorldQuatInv = parentWorldQuat.clone().invert();
            let liveDirLocal = _vb.clone().applyQuaternion(parentWorldQuatInv).normalize();
            if (liveDirLocal.lengthSq() < 0.0001) continue;

            // Clamp impossible flips that cause mesh wrapping/deformation spikes.
            const maxAngleRad = THREE.MathUtils.degToRad(tracking.maxBoneRotationDeg);
            const dot = THREE.MathUtils.clamp(restDir.dot(liveDirLocal), -1, 1);
            const angle = Math.acos(dot);
            if (Number.isFinite(angle) && angle > maxAngleRad && maxAngleRad > 0) {
                const t = THREE.MathUtils.clamp(maxAngleRad / angle, 0, 1);
                liveDirLocal = restDir.clone().lerp(liveDirLocal, t).normalize();
            }

            // Solve directly in parent-local space (restLocal -> liveLocal).
            _quat.setFromUnitVectors(restDir, liveDirLocal);
            const conf = THREE.MathUtils.clamp(getCocoConfidence(stableFrame, binding.coco), 0, 1);
            const solveAlpha = THREE.MathUtils.lerp(tracking.rotationSlerpMin, tracking.rotationSlerpMax, conf);
            bone.quaternion.slerp(_quat, solveAlpha);
        }

        // ── Step 4: Spine lean ───────────────────────────────────────────────
        if (retarget.spine_bones.length > 0) {
            const ls = stableFrame.joints['left_shoulder'];
            const rs = stableFrame.joints['right_shoulder'];
            const lh = stableFrame.joints['left_hip'];
            const rh = stableFrame.joints['right_hip'];

            if (ls && rs && lh && rh && ls.confidence > 0.3 && lh.confidence > 0.3) {
                const shoulderMid = cocoToWorld3D(
                    (ls.position[0] + rs.position[0]) / 2,
                    (ls.position[1] + rs.position[1]) / 2, 0, scale, yOff,
                );
                const hipMid = cocoToWorld3D(
                    (lh.position[0] + rh.position[0]) / 2,
                    (lh.position[1] + rh.position[1]) / 2, 0, scale, yOff,
                );

                const spineDir = shoulderMid.clone().sub(hipMid).normalize();
                const worldUp = new THREE.Vector3(0, 1, 0);
                const spineQ = new THREE.Quaternion().setFromUnitVectors(worldUp, spineDir);

                const perBone = 1 / retarget.spine_bones.length;
                const partialQ = new THREE.Quaternion().identity().slerp(spineQ, perBone * 0.6);

                for (const spineName of retarget.spine_bones) {
                    const sb = boneMap.get(spineName);
                    if (sb) sb.quaternion.slerp(partialQ, 0.3);
                }
            }
        }
    }

    /** Reposition character to a world position */
    setPosition(x: number, y: number, z: number): void {
        this.state.model?.position.set(x, y, z);
    }

    /** Toggle mesh visibility */
    setVisible(v: boolean): void {
        if (this.state.model) this.state.model.visible = v;
    }

    /** Remove from scene and clean up */
    dispose(scene: THREE.Scene): void {
        if (this.state.model) {
            scene.remove(this.state.model);
            this.state.model.traverse(obj => {
                if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
                const mat = (obj as THREE.Mesh).material;
                if (mat) Array.isArray(mat) ? mat.forEach(m => m.dispose()) : mat.dispose();
            });
        }
        this.state = {
            loaded: false,
            model: null,
            boneMap: new Map(),
            restDirs: new Map(),
            retarget: null,
            rootMotionScaleY: 1,
            rootBaselineY: 0,
            hipBaselineY: null,
            cocoToWorld: null,
            worldYOffset: null,
        };
        this.jointHistory.clear();
    }

    /** Reset calibration (call when a new session starts) */
    resetCalibration(): void {
        this.state.cocoToWorld = null;
        this.state.worldYOffset = null;
        this.state.hipBaselineY = null;
        this.jointHistory.clear();
    }

    get isLoaded(): boolean { return this.state.loaded; }
    get model(): THREE.Group | null { return this.state.model; }
}

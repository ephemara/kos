/**
 * SessionViewport
 *
 * Three.js viewport that renders:
 *   - A skinned GLB character driven by live COCO joint data
 *   - An optional skeleton wireframe overlay (dots + lines)
 *   - A floating glassmorphism HUD for in-viewport character switching
 *
 * The joint frame ref (updated at 30Hz) is read directly in the rAF loop —
 * zero React re-renders in the hot path.
 *
 * Character loading is data-driven via CharacterRetargetMap JSON files in
 * src-tauri/resources/assets/meshes/.
 * The active character is selected by a `characterId` prop.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { Eye, EyeOff, Scan } from 'lucide-react';
import { StudioStage } from '@mocap/three-d/systems/three/StudioStage';
import { CharacterLoader } from '../lib/CharacterLoader';
import { CHARACTER_OPTIONS, type CharacterId } from '../characterOptions';
import { SKELETON_BONES, JOINT_NAMES } from '../types';
import type { JointFrame, JointName } from '../types';
import { useTrackingSettings } from '../trackingConfig';

// ─── Constants ────────────────────────────────────────────────────────────────

const JOINT_RADIUS = 0.012;
const BONE_COLOR = new THREE.Color('#00ffcc');
const JOINT_COLOR = new THREE.Color('#ffffff');
const DIM_COLOR = new THREE.Color('#333333');
const EPOCH_MS_THRESHOLD = 1_000_000_000_000;

function isRenderableJoint(
  j: JointFrame['joints'][JointName] | undefined,
  minConfidence: number,
): j is JointFrame['joints'][JointName] {
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

function countRenderableJoints(frame: JointFrame, minConfidence: number): number {
  let count = 0;
  JOINT_NAMES.forEach((name) => {
    if (isRenderableJoint(frame.joints[name], minConfidence)) count += 1;
  });
  return count;
}

function countInvalidSegments(frame: JointFrame, minConfidence: number, maxDistance: number): number {
  let bad = 0;
  SKELETON_BONES.forEach(([a, b]) => {
    const ja = frame.joints[a];
    const jb = frame.joints[b];
    if (!isRenderableJoint(ja, minConfidence) || !isRenderableJoint(jb, minConfidence)) return;
    const dx = ja.position[0] - jb.position[0];
    const dy = ja.position[1] - jb.position[1];
    const dz = ja.position[2] - jb.position[2];
    const segLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (!Number.isFinite(segLen) || segLen > maxDistance) {
      bad += 1;
    }
  });
  return bad;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SessionViewportProps {
  latestFrame: RefObject<JointFrame | null>;
  active: boolean;
  characterId?: CharacterId;
  showSkeleton?: boolean;
  onCharacterChange?: (id: CharacterId) => void;
  onSkeletonToggle?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SessionViewport({
  latestFrame,
  active,
  characterId = 'mixamo_bot',
  showSkeleton = true,
  onCharacterChange,
  onSkeletonToggle,
}: SessionViewportProps) {
  const { settings: trackingSettings } = useTrackingSettings();
  const trackingSettingsRef = useRef(trackingSettings);

  // Use a container div, not a canvas — StudioStage creates its own canvas
  // inside this div and explicitly sets canvas CSS to 100%/100%.
  // Passing a canvas directly causes setSize(0,0) to lock CSS to 0px on init.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<StudioStage | null>(null);
  const charRef = useRef<CharacterLoader | null>(null);
  const jointMeshes = useRef<Map<JointName, THREE.Mesh>>(new Map());
  const boneLinesRef = useRef<THREE.LineSegments | null>(null);
  const rafRef = useRef<number>(0);

  const [charStatus, setCharStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [trackingHud, setTrackingHud] = useState<{ visible: number; total: number; stale: boolean; invalidSegments: number }>({
    visible: 0,
    total: JOINT_NAMES.length,
    stale: false,
    invalidSegments: 0,
  });

  const isStaleFrame = useCallback((frame: JointFrame): boolean => {
    if (!Number.isFinite(frame.timestamp_ms) || frame.timestamp_ms < EPOCH_MS_THRESHOLD) return false;
    return (Date.now() - frame.timestamp_ms) > trackingSettings.staleFrameMs;
  }, [trackingSettings.staleFrameMs]);

  useEffect(() => {
    trackingSettingsRef.current = trackingSettings;
  }, [trackingSettings]);

  useEffect(() => {
    const refreshHud = () => {
      const frame = latestFrame.current;
      if (!frame) {
        setTrackingHud({ visible: 0, total: JOINT_NAMES.length, stale: false, invalidSegments: 0 });
        return;
      }
      setTrackingHud({
        visible: countRenderableJoints(frame, trackingSettings.minRenderConfidence),
        total: JOINT_NAMES.length,
        stale: isStaleFrame(frame),
        invalidSegments: countInvalidSegments(
          frame,
          trackingSettings.minRenderConfidence,
          trackingSettings.maxBoneSegmentDistance3D,
        ),
      });
    };
    refreshHud();
    const id = window.setInterval(refreshHud, trackingSettings.statusRefreshMs);
    return () => window.clearInterval(id);
  }, [
    isStaleFrame,
    latestFrame,
    trackingSettings.maxBoneSegmentDistance3D,
    trackingSettings.minRenderConfidence,
    trackingSettings.statusRefreshMs,
  ]);

  // ── Load / swap character whenever characterId changes ────────────────────
  const loadCharacter = useCallback(async (stage: StudioStage, id: CharacterId) => {
    setCharStatus('loading');

    // Dispose old character
    if (charRef.current) {
      charRef.current.dispose(stage.scene);
      charRef.current = null;
    }

    const def = CHARACTER_OPTIONS.find(c => c.id === id);
    if (!def) { setCharStatus('error'); return; }

    const loader = new CharacterLoader();
    try {
      await loader.load(def.retargetUrl, stage.scene);
      charRef.current = loader;
      setCharStatus('ready');
    } catch (e) {
      console.error('[SessionViewport] Character load failed:', e);
      setCharStatus('error');
    }
  }, []);

  // Reset COCO calibration each time a new session starts
  useEffect(() => {
    if (active) {
      charRef.current?.resetCalibration();
    }
  }, [active]);

  // ── Mount scene once ──────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Pass the div — StudioStage will create its own <canvas> inside it and
    // set canvas.style.width/height = '100%' explicitly, so zero-size at init
    // is not a problem (the CSS is correct regardless of clientWidth at t=0).
    const stage = new StudioStage(container, {
      preset: 'default',
      controls: true,
      environment: true,
      grid: true,
      gridY: 0,
      shadows: true,
      autoStart: true,
      autoRender: true,
    });
    stageRef.current = stage;

    // Camera default: pull back to see full character
    stage.camera.position.set(0, 1.6, 4);
    stage.camera.lookAt(0, 1, 0);

    // ResizeObserver keeps the renderer in sync when the dock panel resizes.
    // AppShell dispatches window 'resize' on collapse — we listen to both.
    const doResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        stage.camera.aspect = w / h;
        stage.camera.updateProjectionMatrix();
        stage.renderer.setSize(w, h, false); // false = keep CSS as-is
      }
    };
    requestAnimationFrame(doResize); // first frame after layout resolves
    const ro = new ResizeObserver(doResize);
    ro.observe(container);
    window.addEventListener('resize', doResize);

    // ── Skeleton overlay ────────────────────────────────────────────────────
    const sphereGeo = new THREE.SphereGeometry(JOINT_RADIUS, 8, 8);
    JOINT_NAMES.forEach(name => {
      const mat = new THREE.MeshBasicMaterial({ color: JOINT_COLOR, transparent: true, depthTest: false });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 999; // draw on top of character
      stage.scene.add(mesh);
      jointMeshes.current.set(name, mesh);
    });

    const bonePositions = new Float32Array(SKELETON_BONES.length * 2 * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(bonePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: BONE_COLOR, transparent: true, opacity: 0.6, depthTest: false });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    lines.renderOrder = 998;
    stage.scene.add(lines);
    boneLinesRef.current = lines;

    // ── rAF tick ─────────────────────────────────────────────────────────
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const frame = latestFrame.current;
      if (!frame) return;
      const cfg = trackingSettingsRef.current;
      const stale = Number.isFinite(frame.timestamp_ms) && frame.timestamp_ms >= EPOCH_MS_THRESHOLD
        ? (Date.now() - frame.timestamp_ms) > cfg.staleFrameMs
        : false;

      // Drive character
      if (!stale) {
        charRef.current?.retargetFrame(frame);
      }

      // Update skeleton overlay
      const joints = frame.joints;
      const posAttr = boneLinesRef.current?.geometry.attributes.position as THREE.BufferAttribute;

      if (showSkeleton && !stale) {
        JOINT_NAMES.forEach(name => {
          const mesh = jointMeshes.current.get(name);
          if (!mesh) return;
          const j = joints[name];
          if (!isRenderableJoint(j, cfg.minRenderConfidence)) { mesh.visible = false; return; }
          mesh.visible = true;
          mesh.position.set(
            THREE.MathUtils.clamp(j.position[0], 0, 1),
            THREE.MathUtils.clamp(j.position[1], 0, 1),
            THREE.MathUtils.clamp(j.position[2], -1, 1)
          );
          (mesh.material as THREE.MeshBasicMaterial).color.lerpColors(
            DIM_COLOR, JOINT_COLOR, Math.min(j.confidence / 0.8, 1)
          );
        });

        if (posAttr) {
          SKELETON_BONES.forEach(([parentName, childName], i) => {
            const p = joints[parentName];
            const c = joints[childName];
            const base = i * 6;
            if (
              isRenderableJoint(p, cfg.minRenderConfidence)
              && isRenderableJoint(c, cfg.minRenderConfidence)
            ) {
              const dx = p.position[0] - c.position[0];
              const dy = p.position[1] - c.position[1];
              const dz = p.position[2] - c.position[2];
              const segLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
              if (!Number.isFinite(segLen) || segLen > cfg.maxBoneSegmentDistance3D) {
                for (let k = 0; k < 6; k++) posAttr.array[base + k] = 0;
              } else {
                posAttr.array[base + 0] = THREE.MathUtils.clamp(p.position[0], 0, 1);
                posAttr.array[base + 1] = THREE.MathUtils.clamp(p.position[1], 0, 1);
                posAttr.array[base + 2] = THREE.MathUtils.clamp(p.position[2], -1, 1);
                posAttr.array[base + 3] = THREE.MathUtils.clamp(c.position[0], 0, 1);
                posAttr.array[base + 4] = THREE.MathUtils.clamp(c.position[1], 0, 1);
                posAttr.array[base + 5] = THREE.MathUtils.clamp(c.position[2], -1, 1);
              }
            } else {
              for (let k = 0; k < 6; k++) posAttr.array[base + k] = 0;
            }
          });
          posAttr.needsUpdate = true;
        }
      } else {
        // Hide skeleton when overlay off
        JOINT_NAMES.forEach(n => { const m = jointMeshes.current.get(n); if (m) m.visible = false; });
        if (posAttr) { posAttr.array.fill(0); posAttr.needsUpdate = true; }
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    // NOTE: initial character load is handled by the characterId useEffect below.
    // Calling loadCharacter here too caused a double-load race where both models
    // landed in the scene but only one was stored in charRef (orphan leak).

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener('resize', doResize);
      charRef.current?.dispose(stage.scene);
      charRef.current = null;
      stage.dispose();
      stageRef.current = null;
      jointMeshes.current.clear();
      boneLinesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Swap character when characterId prop changes (after mount) ─────────────
  useEffect(() => {
    if (!stageRef.current) return;
    loadCharacter(stageRef.current, characterId);
  }, [characterId, loadCharacter]);

  // ── Skeleton overlay visibility ─────────────────────────────────────────────
  useEffect(() => {
    if (boneLinesRef.current) boneLinesRef.current.visible = showSkeleton;
  }, [showSkeleton]);

  return (
    <div className="relative w-full h-full bg-[color:var(--kos-surface-primary)]">
      {/* StudioStage mounts its own <canvas> inside this div with style 100%/100% */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        aria-label="ZenMocap character viewport"
      />

      {/* Character loading indicator */}
      {charStatus === 'loading' && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-[9px] font-black tracking-[0.2em] text-yellow-400/70">LOADING CHARACTER</span>
        </div>
      )}
      {charStatus === 'error' && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
          <span className="text-[9px] font-black tracking-[0.2em] text-red-400/70">CHARACTER LOAD FAILED</span>
        </div>
      )}

      {/* Offline status pill — small, non-blocking; scene is always visible */}
      {!active && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
          <span className="text-[9px] font-black tracking-[0.2em] text-white/30 uppercase">
            Session Offline
          </span>
        </div>
      )}

      {/* ── Floating HUD ─ bottom-left glassmorphism pill ─────────── */}
      {(onCharacterChange || onSkeletonToggle) && charStatus !== 'error' && (
        <div className="absolute bottom-3 left-3 flex flex-col gap-1.5" style={{ zIndex: 10 }}>

          {/* Skeleton toggle */}
          {onSkeletonToggle && (
            <button
              id="hud-skeleton-toggle"
              onClick={onSkeletonToggle}
              title={showSkeleton ? 'Hide skeleton overlay' : 'Show skeleton overlay'}
              className={[
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-[8px] font-black tracking-[0.15em] uppercase',
                'backdrop-blur-md border transition-all duration-150 select-none',
                showSkeleton
                  ? 'bg-[color:var(--kos-accent-primary)]/15 border-[color:var(--kos-accent-primary)]/40 text-[color:var(--kos-accent-primary)]'
                  : 'bg-black/40 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20',
              ].join(' ')}
            >
              {showSkeleton
                ? <Eye size={9} />
                : <EyeOff size={9} />}
              Skeleton
            </button>
          )}

          {/* Character switcher pills */}
          {onCharacterChange && (
            <div className="flex flex-col gap-0.5">
              {CHARACTER_OPTIONS.map(char => {
                const active = char.id === characterId;
                return (
                  <button
                    key={char.id}
                    id={`hud-char-${char.id}`}
                    onClick={() => onCharacterChange(char.id)}
                    className={[
                      'flex items-center gap-2 px-2 py-1 rounded-md text-[8px] font-black tracking-[0.12em] uppercase',
                      'backdrop-blur-md border transition-all duration-150 select-none',
                      active
                        ? 'bg-white/10 border-white/20 text-white shadow-sm'
                        : 'bg-black/30 border-white/5 text-white/30 hover:text-white/60 hover:border-white/15',
                    ].join(' ')}
                  >
                    {/* Active dot */}
                    <span className={[
                      'w-1 h-1 rounded-full flex-shrink-0 transition-all',
                      active
                        ? 'bg-[color:var(--kos-accent-primary)] shadow-[0_0_4px_var(--kos-accent-primary)]'
                        : 'bg-white/20',
                    ].join(' ')} />
                    <Scan size={8} className={active ? 'text-[color:var(--kos-accent-primary)]' : 'opacity-30'} />
                    {char.label}
                    {charStatus === 'loading' && active && (
                      <span className="ml-auto w-1 h-1 rounded-full bg-yellow-400 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LIVE indicator */}
      {active && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-none">
          <div
            className={[
              'w-1.5 h-1.5 rounded-full shadow-[0_0_6px_currentColor]',
              trackingHud.stale
                ? 'text-red-400'
                : trackingHud.visible >= trackingSettings.diagnosticsMinVisibleJoints && trackingHud.invalidSegments <= 2
                  ? 'text-[color:var(--kos-accent-primary)] animate-pulse'
                  : 'text-yellow-400 animate-pulse',
            ].join(' ')}
          />
          <span
            className={[
              'text-[9px] font-black tracking-[0.2em] opacity-80',
              trackingHud.stale
                ? 'text-red-400'
                : trackingHud.visible >= trackingSettings.diagnosticsMinVisibleJoints && trackingHud.invalidSegments <= 2
                  ? 'text-[color:var(--kos-accent-primary)]'
                  : 'text-yellow-400',
            ].join(' ')}
          >
            {trackingHud.stale
              ? 'STALE'
              : `TRACK ${trackingHud.visible}/${trackingHud.total} · BAD ${trackingHud.invalidSegments}`}
          </span>
        </div>
      )}
    </div>
  );
}

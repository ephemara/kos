/**
 * React hook for 3D brush engine
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import Brush3DEngine from './Brush3DEngine';
import type { Sculpt3DBrushParams, BrushStrokePoint } from '@mocap/shared/systems/brush/BrushTypes';

/**
 * Hook for managing 3D brush engine
 */
export function useBrush3D(geometry?: THREE.BufferGeometry) {
  const engineRef = useRef<Brush3DEngine | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [params, setParams] = useState<Sculpt3DBrushParams | null>(null);

  // Initialize engine
  useEffect(() => {
    const engine = new Brush3DEngine();
    engineRef.current = engine;

    if (geometry) {
      engine.init(geometry).then(() => {
        setIsReady(true);
        setParams(engine.getParams());
      });
    } else {
      engine.init().then(() => {
        setIsReady(true);
        setParams(engine.getParams());
      });
    }

    return () => {
      engine.dispose();
    };
  }, []);

  // Update geometry
  const setGeometry = useCallback(async (newGeometry: THREE.BufferGeometry) => {
    if (engineRef.current) {
      await engineRef.current.setGeometry(newGeometry);
      setIsReady(true);
    }
  }, []);

  // Update parameters
  const updateParams = useCallback((newParams: Partial<Sculpt3DBrushParams>) => {
    if (engineRef.current) {
      engineRef.current.setParams(newParams);
      setParams(engineRef.current.getParams());
    }
  }, []);

  // Start stroke
  const startStroke = useCallback((point: BrushStrokePoint) => {
    if (engineRef.current && params) {
      engineRef.current.startStroke(params, point);
    }
  }, [params]);

  // Continue stroke
  const continueStroke = useCallback((point: BrushStrokePoint) => {
    if (engineRef.current) {
      engineRef.current.continueStroke(point);
    }
  }, []);

  // End stroke
  const endStroke = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.endStroke();
    }
  }, []);

  // Apply dab
  const applyDab = useCallback(
    async (
      position: THREE.Vector3,
      normal: THREE.Vector3,
      pressure: number = 1.0,
      delta?: THREE.Vector3
    ) => {
      if (engineRef.current) {
        return await engineRef.current.applyDab(position, normal, pressure, delta);
      }
      return null;
    },
    []
  );

  return {
    engine: engineRef.current,
    isReady,
    params,
    setGeometry,
    updateParams,
    startStroke,
    continueStroke,
    endStroke,
    applyDab,
  };
}

export default useBrush3D;

export interface GraphosLayerKeyframe {
  frame: number;
  visible: boolean;
  opacity: number;
  blendMode: GlobalCompositeOperation;
}

export interface GraphosLayerAnimState {
  id: string;
  visible: boolean;
  opacity: number;
  blendMode?: GlobalCompositeOperation;
  keyframes?: GraphosLayerKeyframe[];
}

export function upsertLayerKeyframe(
  keyframes: GraphosLayerKeyframe[] | undefined,
  next: GraphosLayerKeyframe
): GraphosLayerKeyframe[] {
  const src = keyframes ? [...keyframes] : [];
  const idx = src.findIndex((k) => k.frame === next.frame);
  if (idx >= 0) src[idx] = next;
  else src.push(next);
  src.sort((a, b) => a.frame - b.frame);
  return src;
}

export function frameStateForLayer(
  layer: GraphosLayerAnimState,
  frame: number
): Pick<GraphosLayerAnimState, 'visible' | 'opacity' | 'blendMode'> {
  const keys = layer.keyframes ?? [];
  const at = keys.find((k) => k.frame === frame);
  if (at) {
    return { visible: at.visible, opacity: at.opacity, blendMode: at.blendMode };
  }
  return {
    visible: layer.visible,
    opacity: layer.opacity,
    blendMode: layer.blendMode ?? 'source-over',
  };
}

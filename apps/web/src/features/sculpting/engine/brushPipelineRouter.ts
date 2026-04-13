import type { KBrushAsset } from '@/services/brushClient';
import { isMetaphysicalBrush } from '@/services/kainMetaCompiler';

export type BrushPipeline = 'kain_meta' | 'kain_spirv' | 'wgsl';

export function isSpirvBrush(brush: KBrushAsset | null | undefined): boolean {
  if (!brush || typeof brush.kernel !== 'object' || brush.kernel === null) {
    return false;
  }
  return (brush.kernel as any).family === 'spirv';
}

export function resolveBrushPipeline(
  brush: KBrushAsset | null | undefined,
  useKainShaders: boolean
): BrushPipeline {
  if (useKainShaders && isSpirvBrush(brush) && isMetaphysicalBrush(brush)) {
    return 'kain_meta';
  }
  if (useKainShaders && isSpirvBrush(brush)) {
    return 'kain_spirv';
  }
  return 'wgsl';
}

export function resolveBrushShaderName(brush: KBrushAsset | null | undefined): string {
  if (!brush) return 'sculpt_clay';
  if (typeof brush.kernel === 'string') {
    return brush.kernel;
  }
  return brush.kernel?.shader ?? 'sculpt_clay';
}

export async function dispatchBrushPipeline(
  brush: KBrushAsset | null | undefined,
  useKainShaders: boolean,
  handlers: {
    onKainMeta?: () => Promise<void> | void;
    onKainSpirv: () => Promise<void> | void;
    onWgsl: () => Promise<void> | void;
  }
): Promise<BrushPipeline> {
  const pipeline = resolveBrushPipeline(brush, useKainShaders);
  if (pipeline === 'kain_meta') {
    if (handlers.onKainMeta) {
      await handlers.onKainMeta();
    } else {
      await handlers.onKainSpirv();
    }
  } else if (pipeline === 'kain_spirv') {
    await handlers.onKainSpirv();
  } else {
    await handlers.onWgsl();
  }
  return pipeline;
}

import { describe, expect, it } from 'vitest';
import { frameStateForLayer, upsertLayerKeyframe } from '../animationUtils';

describe('graphos animation utils', () => {
  it('upserts keyframes by frame and keeps order', () => {
    const a = upsertLayerKeyframe([], { frame: 12, visible: true, opacity: 0.5, blendMode: 'screen' });
    const b = upsertLayerKeyframe(a, { frame: 4, visible: false, opacity: 1, blendMode: 'multiply' });
    const c = upsertLayerKeyframe(b, { frame: 12, visible: true, opacity: 0.8, blendMode: 'overlay' });

    expect(c.map(k => k.frame)).toEqual([4, 12]);
    expect(c[1].opacity).toBeCloseTo(0.8, 6);
    expect(c[1].blendMode).toBe('overlay');
  });

  it('resolves frame state from exact keyframe or layer defaults', () => {
    const layer = {
      id: 'L1',
      visible: true,
      opacity: 1,
      blendMode: 'source-over' as GlobalCompositeOperation,
      keyframes: [{ frame: 24, visible: false, opacity: 0.4, blendMode: 'multiply' as GlobalCompositeOperation }],
    };

    expect(frameStateForLayer(layer, 24)).toEqual({
      visible: false,
      opacity: 0.4,
      blendMode: 'multiply',
    });
    expect(frameStateForLayer(layer, 10)).toEqual({
      visible: true,
      opacity: 1,
      blendMode: 'source-over',
    });
  });
});

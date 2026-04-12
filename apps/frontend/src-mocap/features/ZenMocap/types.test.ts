import { describe, expect, it } from 'vitest';
import { JOINT_NAMES, normalizeJointFrame } from './types';

describe('normalizeJointFrame', () => {
  it('maps raw array joints into COCO named record', () => {
    const raw = {
      seq: 12,
      timestamp_ms: 1234,
      joints: JOINT_NAMES.map((_, i) => ({
        position: [i / 100, i / 100, 0] as [number, number, number],
        confidence: 0.5 + i * 0.01,
      })),
      skeleton: null,
      model_id: 'yolov11s_pose',
    };

    const frame = normalizeJointFrame(raw);

    expect(frame.frame_id).toBe(12);
    expect(frame.model_id).toBe('yolov11s_pose');
    expect(frame.joints.left_shoulder.position[0]).toBeCloseTo(5 / 100, 5);
    expect(frame.joints.right_ankle.confidence).toBeCloseTo(0.66, 5);
  });
});


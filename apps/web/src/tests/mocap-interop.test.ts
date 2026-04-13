import { describe, expect, it, vi } from 'vitest';
import { listenMocapInterop } from '@/services/mocapInterop';
import { MOCAP_INTEROP_EVENT } from '@shared/protocol/mocapInterop';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_eventName: string, handler: (event: { payload: { topic: string; payload: unknown } }) => void) => {
    handler({
      payload: {
        topic: 'take-saved',
        payload: {
          source: 'zen-mocap',
          name: 'Take 01',
          path: 'C:/takes/take01.zenmocap',
          frameCount: 120,
          timestampMs: 1234,
        },
      },
    });

    handler({
      payload: {
        topic: 'session-state',
        payload: {
          source: 'zen-mocap',
          status: 'running',
          modelId: 'yolov11s_pose',
          dccTarget: 'ue5',
          error: null,
          timestampMs: 5678,
        },
      },
    });

    return () => {};
  }),
}));

describe('mocap interop listener', () => {
  it('subscribes to the shared Tauri event channel', async () => {
    const { listen } = await import('@tauri-apps/api/event');

    await listenMocapInterop('take-saved', () => {});

    expect(listen).toHaveBeenCalledWith(MOCAP_INTEROP_EVENT, expect.any(Function));
  });

  it('forwards only matching interop topics', async () => {
    const handler = vi.fn();

    await listenMocapInterop('take-saved', handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      source: 'zen-mocap',
      name: 'Take 01',
      path: 'C:/takes/take01.zenmocap',
      frameCount: 120,
      timestampMs: 1234,
    });
  });
});

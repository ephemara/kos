import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  MOCAP_INTEROP_EVENT,
  type MocapInteropEnvelope,
  type MocapInteropMessageMap,
  type MocapInteropTopic,
} from '@shared/protocol/mocapInterop';

export async function listenMocapInterop<T extends MocapInteropTopic>(
  topic: T,
  handler: (payload: MocapInteropMessageMap[T]) => void,
): Promise<UnlistenFn> {
  return listen<MocapInteropEnvelope>(MOCAP_INTEROP_EVENT, (event) => {
    if (event.payload.topic === topic) {
      handler(event.payload.payload as MocapInteropMessageMap[T]);
    }
  });
}

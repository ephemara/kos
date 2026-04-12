export const MOCAP_INTEROP_EVENT = 'kos:mocap:interop';

export const MOCAP_INTEROP_TOPICS = {
  sessionState: 'session-state',
  takeSaved: 'take-saved',
} as const;

export type MocapInteropTopic =
  typeof MOCAP_INTEROP_TOPICS[keyof typeof MOCAP_INTEROP_TOPICS];

export interface MocapSessionStatePayload {
  source: 'zen-mocap';
  status: 'idle' | 'initializing' | 'running' | 'paused' | 'recording' | 'error';
  modelId: string | null;
  dccTarget: string | null;
  error: string | null;
  timestampMs: number;
}

export interface MocapTakeSavedPayload {
  source: 'zen-mocap';
  id?: string;
  name: string;
  path: string;
  frameCount: number;
  modelId?: string | null;
  timestampMs: number;
}

export interface MocapInteropMessageMap {
  'session-state': MocapSessionStatePayload;
  'take-saved': MocapTakeSavedPayload;
}

export type MocapInteropEnvelope<T extends MocapInteropTopic = MocapInteropTopic> = {
  topic: T;
  payload: MocapInteropMessageMap[T];
};

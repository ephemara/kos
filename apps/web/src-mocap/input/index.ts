/**
 * Input System
 * 
 * Unified input handling for mouse, keyboard, and touch events.
 */

export { 
  UnifiedPassthroughProvider, 
  useUnifiedPassthrough,
  useInteractiveZone,
  usePassthroughLock,
  PassthroughBlocker,
  InteractiveZoneProvider,
  useInteractiveZoneContext,
  type InteractiveZone
} from './UnifiedPassthrough';

export { default as InteractiveZoneContext } from './InteractiveZoneContext';

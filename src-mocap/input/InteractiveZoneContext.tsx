/**
 * InteractiveZoneContext - Legacy re-export from UnifiedPassthrough
 * 
 * All code that imports from here now gets the unified system.
 */

export {
    UnifiedPassthroughProvider as InteractiveZoneProvider,
    useUnifiedPassthrough as useInteractiveZoneContext,
    useInteractiveZone,
    usePassthroughLock,
    PassthroughBlocker,
    type InteractiveZone,
} from './UnifiedPassthrough';

// For direct context access (rarely needed)
export { UnifiedPassthroughProvider } from './UnifiedPassthrough';

// Default export for import InteractiveZoneContext from '...'
import { UnifiedPassthroughProvider } from './UnifiedPassthrough';
export default UnifiedPassthroughProvider;

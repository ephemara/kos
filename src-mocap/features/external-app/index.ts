/**
 * External App Tether - Bootstrap ANY external application to React
 * 
 * The SECRET SAUCE of this template system!
 */

export { 
    AppTether, 
    useAppTether, 
    AppConnectionBadge,
    type AppTetherProps 
} from './AppTether';

// Legacy exports for backwards compatibility
export { 
    AppTether as BevyTether,
    useAppTether as useBevyTether,
    AppConnectionBadge as BevyConnectionBadge
} from './AppTether';

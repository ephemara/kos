/**
 * Shell Components
 * 
 * Universal shell components for application chrome, navigation, and window management.
 * These components work for both 2D and 3D applications.
 */

// Main shell component
export { AppShell, type AppShellProps } from './AppShell';

// Top bar components
export { AppTopBar, default as AppTopBarDefault } from './AppTopBar';
export { AppTopBarDirect } from './AppTopBarDirect';
export { AppMenuBar, type AppMenuBarProps } from './AppMenuBar';

// Quick menu
export { default as QuickMenu } from './QuickMenu';
export type { QuickMenuProps } from './QuickMenu';
export {
    registerQuickMenuCommands,
    unregisterQuickMenuCommands,
    getQuickMenuCommands,
    subscribeQuickMenuCommands,
    useQuickMenuCommands,
    useRegisterQuickMenuCommands,
    type QuickMenuCommand
} from './quickMenuRegistry';

// Dock panel
export { DockPanel, type DockPanelProps, type DockTab } from './DockPanel';

// Floating dock panel
export { FloatingDockPanel, type FloatingDockPanelProps } from './FloatingDockPanel';

// Sequencer
export { Sequencer, type SequencerProps, type SequencerTrack, type Keyframe } from './Sequencer';

// Transform panel
export { 
    TransformPanel, 
    type TransformPanelProps, 
    type GizmoMode, 
    type TransformSpace, 
    type TransformData 
} from './TransformPanel';

// Floating quick menu
export { 
    FloatingQuickMenu, 
    type FloatingQuickMenuProps, 
    type FloatingQuickMenuCommand,
    type FloatingQuickMenuSortMode
} from './FloatingQuickMenu';

// Split view
export { SplitView, type SplitViewProps } from './SplitView';

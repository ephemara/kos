/**
 * SplitView - Resizable split panel layout using react-resizable-panels
 * Perfect for 3D viewport / UV editor splits like KAtlas
 */

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { cn } from '@mocap/shared/primitives/cn';
import { GripVertical, GripHorizontal } from 'lucide-react';

export interface SplitViewProps {
    /** Direction of the split */
    direction?: 'horizontal' | 'vertical';
    /** First panel content */
    first: React.ReactNode;
    /** Second panel content */
    second: React.ReactNode;
    /** Default size of first panel (percentage) */
    defaultFirstSize?: number;
    /** Minimum size of first panel (percentage) */
    minFirstSize?: number;
    /** Minimum size of second panel (percentage) */
    minSecondSize?: number;
    /** Unique ID for persisting layout (localStorage) */
    persistId?: string;
    /** Additional class for container */
    className?: string;
    /** Handle width in pixels */
    handleSize?: number;
}

export function SplitView({
    direction = 'horizontal',
    first,
    second,
    defaultFirstSize = 50,
    minFirstSize = 20,
    minSecondSize = 20,
    persistId,
    className,
    handleSize = 6,
}: SplitViewProps) {
    const isHorizontal = direction === 'horizontal';
    const GripIcon = isHorizontal ? GripVertical : GripHorizontal;

    return (
        <PanelGroup
            direction={isHorizontal ? 'horizontal' : 'vertical'}
            autoSaveId={persistId}
            className={cn('h-full w-full', className)}
        >
            <Panel
                defaultSize={defaultFirstSize}
                minSize={minFirstSize}
                className="relative"
            >
                {first}
            </Panel>

            <PanelResizeHandle
                className={cn(
                    'group relative flex items-center justify-center transition-colors',
                    'bg-[#111] hover:bg-[#222] active:bg-teal-500/30',
                    isHorizontal ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize'
                )}
                style={isHorizontal ? { width: handleSize } : { height: handleSize }}
            >
                {/* Grip indicator */}
                <div className={cn(
                    'absolute flex items-center justify-center',
                    'rounded-full bg-[#333] group-hover:bg-teal-500 group-active:bg-teal-400 transition-colors',
                    isHorizontal ? 'w-4 h-8' : 'w-8 h-4'
                )}>
                    <GripIcon size={10} className="text-gray-500 group-hover:text-white" />
                </div>
            </PanelResizeHandle>

            <Panel
                minSize={minSecondSize}
                className="relative"
            >
                {second}
            </Panel>
        </PanelGroup>
    );
}

export default SplitView;

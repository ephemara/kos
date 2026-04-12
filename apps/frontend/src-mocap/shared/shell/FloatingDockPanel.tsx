import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { cn } from '@mocap/shared/primitives/cn';
import { X, Maximize2, Minimize2, GripVertical } from 'lucide-react';
import { Button } from '@mocap/shared/primitives/Button';

// ============================================================================
// Types & Constants
// ============================================================================

export type DockPosition = 'left' | 'right' | 'top' | 'bottom' | 'floating';

export type FloatingDockPanelProps = {
  title: string;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
  onClose?: () => void;
  className?: string;
  storageKey?: string;
};

type PanelState = {
  position: { x: number; y: number };
  size: { width: number; height: number };
  dockPosition: DockPosition;
  isMaximized: boolean;
};

type ResizeHandle = 
  | 'top' | 'right' | 'bottom' | 'left'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const DOCK_THRESHOLD = 50; // pixels from edge to trigger docking
const MIN_SIZE = { width: 200, height: 150 };
const MAX_SIZE = { width: window.innerWidth * 0.8, height: window.innerHeight * 0.8 };
const DEFAULT_SIZE = { width: 400, height: 300 };
const DEFAULT_POSITION = { x: 100, y: 100 };

// ============================================================================
// Utility Functions
// ============================================================================

const getHandleClasses = (position: ResizeHandle): string => {
  const base = 'absolute z-10 transition-colors';
  
  switch (position) {
    case 'top':
      return `${base} top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-[color:var(--kos-accent-primary)]/20`;
    case 'right':
      return `${base} top-0 right-0 bottom-0 w-2 cursor-ew-resize hover:bg-[color:var(--kos-accent-primary)]/20`;
    case 'bottom':
      return `${base} bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-[color:var(--kos-accent-primary)]/20`;
    case 'left':
      return `${base} top-0 left-0 bottom-0 w-2 cursor-ew-resize hover:bg-[color:var(--kos-accent-primary)]/20`;
    case 'top-left':
      return `${base} top-0 left-0 w-4 h-4 cursor-nwse-resize hover:bg-[color:var(--kos-accent-primary)]/40`;
    case 'top-right':
      return `${base} top-0 right-0 w-4 h-4 cursor-nesw-resize hover:bg-[color:var(--kos-accent-primary)]/40`;
    case 'bottom-left':
      return `${base} bottom-0 left-0 w-4 h-4 cursor-nesw-resize hover:bg-[color:var(--kos-accent-primary)]/40`;
    case 'bottom-right':
      return `${base} bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-[color:var(--kos-accent-primary)]/40`;
    default:
      return base;
  }
};

const getDockZone = (x: number, y: number, width: number, height: number): DockPosition => {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  
  if (centerX < DOCK_THRESHOLD) return 'left';
  if (centerX > window.innerWidth - DOCK_THRESHOLD) return 'right';
  if (centerY < DOCK_THRESHOLD) return 'top';
  if (centerY > window.innerHeight - DOCK_THRESHOLD) return 'bottom';
  
  return 'floating';
};

const getDockedPosition = (dockPosition: DockPosition): { x: number; y: number } => {
  switch (dockPosition) {
    case 'left':
      return { x: 0, y: 0 };
    case 'right':
      return { x: window.innerWidth - 400, y: 0 };
    case 'top':
      return { x: 0, y: 0 };
    case 'bottom':
      return { x: 0, y: window.innerHeight - 300 };
    default:
      return { x: 100, y: 100 };
  }
};

const getDockedSize = (dockPosition: DockPosition): { width: number; height: number } => {
  switch (dockPosition) {
    case 'left':
    case 'right':
      return { width: 400, height: window.innerHeight };
    case 'top':
    case 'bottom':
      return { width: window.innerWidth, height: 300 };
    default:
      return DEFAULT_SIZE;
  }
};

const constrainToViewport = (
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number } => {
  const maxX = window.innerWidth - width;
  const maxY = window.innerHeight - height;
  
  return {
    x: Math.max(0, Math.min(x, maxX)),
    y: Math.max(0, Math.min(y, maxY)),
  };
};

// ============================================================================
// Resize Handle Component
// ============================================================================

type ResizeHandleProps = {
  position: ResizeHandle;
  onResizeStart: (e: React.MouseEvent, position: ResizeHandle) => void;
};

const ResizeHandleComponent: React.FC<ResizeHandleProps> = ({ position, onResizeStart }) => (
  <div
    className={getHandleClasses(position)}
    onMouseDown={(e) => onResizeStart(e, position)}
  />
);

// ============================================================================
// Main Component
// ============================================================================

export const FloatingDockPanel: React.FC<FloatingDockPanelProps> = ({
  title,
  children,
  defaultPosition = DEFAULT_POSITION,
  defaultSize = DEFAULT_SIZE,
  minSize = MIN_SIZE,
  maxSize = MAX_SIZE,
  onClose,
  className,
  storageKey = 'floating-dock-panel-state',
}) => {
  // ============================================================================
  // State Management
  // ============================================================================
  
  const [state, setState] = useState<PanelState>(() => {
    // Load from localStorage if available
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.warn('Failed to parse saved panel state:', e);
        }
      }
    }
    
    return {
      position: defaultPosition,
      size: defaultSize,
      dockPosition: 'floating',
      isMaximized: false,
    };
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [showDockZone, setShowDockZone] = useState<DockPosition>('floating');
  
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  
  // Motion values for smooth animations
  const x = useMotionValue(state.position.x);
  const y = useMotionValue(state.position.y);
  
  // ============================================================================
  // Persistence
  // ============================================================================
  
  const saveState = useCallback((newState: PanelState) => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(newState));
    }
  }, [storageKey]);
  
  useEffect(() => {
    saveState(state);
  }, [state, saveState]);
  
  // ============================================================================
  // Drag Handlers
  // ============================================================================
  
  const handleDragStart = () => {
    setIsDragging(true);
  };
  
  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const newX = state.position.x + info.delta.x;
    const newY = state.position.y + info.delta.y;
    
    // Check for dock zones
    const dockZone = getDockZone(newX, newY, state.size.width, state.size.height);
    setShowDockZone(dockZone);
  };
  
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    
    const newX = state.position.x + info.offset.x;
    const newY = state.position.y + info.offset.y;
    
    // Check if we should dock
    const dockZone = getDockZone(newX, newY, state.size.width, state.size.height);
    
    if (dockZone !== 'floating') {
      // Dock the panel
      const dockedPos = getDockedPosition(dockZone);
      const dockedSize = getDockedSize(dockZone);
      
      setState(prev => ({
        ...prev,
        position: dockedPos,
        size: dockedSize,
        dockPosition: dockZone,
      }));
    } else {
      // Keep floating, constrain to viewport
      const constrained = constrainToViewport(newX, newY, state.size.width, state.size.height);
      
      setState(prev => ({
        ...prev,
        position: constrained,
        dockPosition: 'floating',
      }));
    }
    
    setShowDockZone('floating');
  };
  
  // ============================================================================
  // Resize Handlers
  // ============================================================================
  
  const handleResizeStart = (e: React.MouseEvent, handle: ResizeHandle) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeHandle(handle);
    
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: state.size.width,
      height: state.size.height,
    };
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };
  
  const handleResizeMove = (e: MouseEvent) => {
    if (!resizeStartRef.current || !resizeHandle) return;
    
    const deltaX = e.clientX - resizeStartRef.current.x;
    const deltaY = e.clientY - resizeStartRef.current.y;
    
    let newWidth = state.size.width;
    let newHeight = state.size.height;
    let newX = state.position.x;
    let newY = state.position.y;
    
    // Calculate new dimensions based on resize handle
    switch (resizeHandle) {
      case 'right':
      case 'bottom-right':
      case 'top-right':
        newWidth = Math.max(minSize.width, Math.min(maxSize.width, resizeStartRef.current.width + deltaX));
        break;
      case 'left':
      case 'bottom-left':
      case 'top-left':
        newWidth = Math.max(minSize.width, Math.min(maxSize.width, resizeStartRef.current.width - deltaX));
        newX = state.position.x + (state.size.width - newWidth);
        break;
    }
    
    switch (resizeHandle) {
      case 'bottom':
      case 'bottom-right':
      case 'bottom-left':
        newHeight = Math.max(minSize.height, Math.min(maxSize.height, resizeStartRef.current.height + deltaY));
        break;
      case 'top':
      case 'top-right':
      case 'top-left':
        newHeight = Math.max(minSize.height, Math.min(maxSize.height, resizeStartRef.current.height - deltaY));
        newY = state.position.y + (state.size.height - newHeight);
        break;
    }
    
    setState(prev => ({
      ...prev,
      position: { x: newX, y: newY },
      size: { width: newWidth, height: newHeight },
    }));
  };
  
  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizeHandle(null);
    resizeStartRef.current = null;
    
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };
  
  // ============================================================================
  // Maximize/Minimize
  // ============================================================================
  
  const handleToggleMaximize = () => {
    if (state.isMaximized) {
      // Restore previous state
      setState(prev => ({
        ...prev,
        isMaximized: false,
      }));
    } else {
      // Maximize
      setState(prev => ({
        ...prev,
        position: { x: 0, y: 0 },
        size: { width: window.innerWidth, height: window.innerHeight },
        isMaximized: true,
        dockPosition: 'floating',
      }));
    }
  };
  
  // ============================================================================
  // Animation Variants
  // ============================================================================
  
  const panelVariants = {
    floating: {
      scale: 1,
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
      transition: { type: 'spring' as const, damping: 25, stiffness: 300 },
    },
    docked: {
      scale: 1,
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
      transition: { type: 'spring' as const, damping: 30, stiffness: 400 },
    },
    dragging: {
      scale: 1.02,
      boxShadow: '0 30px 80px rgba(0, 0, 0, 0.6)',
      transition: { type: 'spring' as const, damping: 20, stiffness: 300 },
    },
  };
  
  const isDocked = state.dockPosition !== 'floating';
  const currentVariant = isDragging ? 'dragging' : isDocked ? 'docked' : 'floating';
  
  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <>
      {/* Dock Zone Indicators */}
      {showDockZone !== 'floating' && (
        <div className="fixed inset-0 pointer-events-none z-[9998]">
          {showDockZone === 'left' && (
            <div className="absolute left-0 top-0 bottom-0 w-[400px] bg-[color:var(--kos-accent-primary)]/10 border-2 border-[color:var(--kos-accent-primary)] animate-pulse" />
          )}
          {showDockZone === 'right' && (
            <div className="absolute right-0 top-0 bottom-0 w-[400px] bg-[color:var(--kos-accent-primary)]/10 border-2 border-[color:var(--kos-accent-primary)] animate-pulse" />
          )}
          {showDockZone === 'top' && (
            <div className="absolute left-0 right-0 top-0 h-[300px] bg-[color:var(--kos-accent-primary)]/10 border-2 border-[color:var(--kos-accent-primary)] animate-pulse" />
          )}
          {showDockZone === 'bottom' && (
            <div className="absolute left-0 right-0 bottom-0 h-[300px] bg-[color:var(--kos-accent-primary)]/10 border-2 border-[color:var(--kos-accent-primary)] animate-pulse" />
          )}
        </div>
      )}
      
      {/* Floating Panel */}
      <motion.div
        ref={panelRef}
        className={cn(
          'fixed z-[9999] flex flex-col overflow-hidden',
          'bg-[color:var(--kos-surface-primary)]/95 backdrop-blur-xl',
          'border border-[color:var(--kos-border-primary)]',
          'rounded-[var(--kos-radius-lg)]',
          isDocked && 'border-[color:var(--kos-accent-primary)] shadow-[0_0_20px_rgba(0,255,204,0.3)]',
          className
        )}
        style={{
          left: state.position.x,
          top: state.position.y,
          width: state.size.width,
          height: state.size.height,
        }}
        variants={panelVariants}
        animate={currentVariant}
        drag={!isDocked && !isResizing}
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={{
          left: 0,
          top: 0,
          right: window.innerWidth - state.size.width,
          bottom: window.innerHeight - state.size.height,
        }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
      >
        {/* Resize Handles */}
        {!isDocked && !state.isMaximized && (
          <>
            <ResizeHandleComponent position="top" onResizeStart={handleResizeStart} />
            <ResizeHandleComponent position="right" onResizeStart={handleResizeStart} />
            <ResizeHandleComponent position="bottom" onResizeStart={handleResizeStart} />
            <ResizeHandleComponent position="left" onResizeStart={handleResizeStart} />
            <ResizeHandleComponent position="top-left" onResizeStart={handleResizeStart} />
            <ResizeHandleComponent position="top-right" onResizeStart={handleResizeStart} />
            <ResizeHandleComponent position="bottom-left" onResizeStart={handleResizeStart} />
            <ResizeHandleComponent position="bottom-right" onResizeStart={handleResizeStart} />
          </>
        )}
        
        {/* Header */}
        <div
          className={cn(
            'flex items-center justify-between px-4 py-3 border-b border-[color:var(--kos-border-primary)]',
            'bg-[color:var(--kos-surface-secondary)]/50',
            !isDocked && 'cursor-move'
          )}
        >
          <div className="flex items-center gap-2">
            <GripVertical size={16} className="text-[color:var(--kos-text-muted)]" />
            <h3 className="text-sm font-bold text-[color:var(--kos-text-primary)] tracking-wide">
              {title}
            </h3>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleToggleMaximize}
              className="h-7 w-7"
            >
              {state.isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </Button>
            
            {onClose && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                className="h-7 w-7 hover:bg-red-500/20 hover:text-red-400"
              >
                <X size={14} />
              </Button>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {children}
        </div>
        
        {/* Docked Indicator */}
        {isDocked && (
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-[color:var(--kos-accent-primary)]/20 border border-[color:var(--kos-accent-primary)]">
            <span className="text-[10px] font-bold text-[color:var(--kos-accent-primary)] uppercase tracking-wider">
              Docked {state.dockPosition}
            </span>
          </div>
        )}
      </motion.div>
    </>
  );
};

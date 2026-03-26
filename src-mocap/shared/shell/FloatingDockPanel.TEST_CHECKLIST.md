# FloatingDockPanel Test Checklist

Use this checklist to verify all functionality works correctly.

## ✅ Basic Functionality

### Panel Display
- [ ] Panel renders correctly when opened
- [ ] Title displays in header
- [ ] Content renders inside panel
- [ ] Panel has glassmorphism effect (backdrop blur)
- [ ] Panel has proper border and shadow
- [ ] Close button appears (if onClose provided)
- [ ] Maximize button appears in header
- [ ] Grip icon appears in header

### Initial State
- [ ] Panel appears at default position (100, 100)
- [ ] Panel has default size (400x300)
- [ ] Panel is in floating state (not docked)
- [ ] Panel is not maximized

## ✅ Drag Functionality

### Basic Dragging
- [ ] Panel can be dragged by clicking header
- [ ] Cursor changes to move cursor on header
- [ ] Panel follows mouse smoothly during drag
- [ ] Panel scales slightly (1.02) while dragging
- [ ] Shadow increases while dragging

### Drag Constraints
- [ ] Panel cannot be dragged outside left edge
- [ ] Panel cannot be dragged outside right edge
- [ ] Panel cannot be dragged outside top edge
- [ ] Panel cannot be dragged outside bottom edge
- [ ] Panel stays fully visible during drag

### Drag States
- [ ] isDragging state activates on drag start
- [ ] isDragging state deactivates on drag end
- [ ] Panel returns to normal scale after drag
- [ ] Shadow returns to normal after drag

## ✅ Resize Functionality

### Edge Resizing
- [ ] Top edge shows resize cursor on hover
- [ ] Right edge shows resize cursor on hover
- [ ] Bottom edge shows resize cursor on hover
- [ ] Left edge shows resize cursor on hover
- [ ] Top edge resizes panel height (upward)
- [ ] Right edge resizes panel width (rightward)
- [ ] Bottom edge resizes panel height (downward)
- [ ] Left edge resizes panel width (leftward)

### Corner Resizing
- [ ] Top-left corner shows nwse-resize cursor
- [ ] Top-right corner shows nesw-resize cursor
- [ ] Bottom-left corner shows nesw-resize cursor
- [ ] Bottom-right corner shows nwse-resize cursor
- [ ] Top-left corner resizes both dimensions
- [ ] Top-right corner resizes both dimensions
- [ ] Bottom-left corner resizes both dimensions
- [ ] Bottom-right corner resizes both dimensions

### Resize Constraints
- [ ] Panel cannot be smaller than minSize.width (200px)
- [ ] Panel cannot be smaller than minSize.height (150px)
- [ ] Panel cannot be larger than maxSize.width (80vw)
- [ ] Panel cannot be larger than maxSize.height (80vh)
- [ ] Custom minSize is respected
- [ ] Custom maxSize is respected

### Resize Visual Feedback
- [ ] Resize handles highlight on hover (accent color)
- [ ] Cursor changes appropriately on hover
- [ ] Panel resizes smoothly without lag
- [ ] Content reflows during resize

### Resize States
- [ ] isResizing state activates on resize start
- [ ] isResizing state deactivates on resize end
- [ ] Dragging is disabled while resizing
- [ ] Resize handles disappear when docked
- [ ] Resize handles disappear when maximized

## ✅ Docking Functionality

### Dock Zones
- [ ] Dragging near left edge (< 50px) shows left dock zone
- [ ] Dragging near right edge (< 50px) shows right dock zone
- [ ] Dragging near top edge (< 50px) shows top dock zone
- [ ] Dragging near bottom edge (< 50px) shows bottom dock zone
- [ ] Dock zone indicator appears (animated border)
- [ ] Dock zone indicator has accent color (cyan)
- [ ] Dock zone indicator pulses (animate-pulse)

### Docking Behavior
- [ ] Releasing in left zone docks panel to left
- [ ] Releasing in right zone docks panel to right
- [ ] Releasing in top zone docks panel to top
- [ ] Releasing in bottom zone docks panel to bottom
- [ ] Docked panel snaps to edge position
- [ ] Docked panel resizes to appropriate size
- [ ] Left/right docked panels are full height
- [ ] Top/bottom docked panels are full width

### Docked State Visual
- [ ] Docked panel has accent border (cyan)
- [ ] Docked panel has glow effect (shadow)
- [ ] Docked panel shows "DOCKED [position]" badge
- [ ] Badge appears in bottom-right corner
- [ ] Badge has accent color styling

### Undocking
- [ ] Dragging docked panel away undocks it
- [ ] Undocked panel returns to floating state
- [ ] Accent border disappears when undocked
- [ ] Glow effect disappears when undocked
- [ ] Docked badge disappears when undocked
- [ ] Resize handles reappear when undocked

## ✅ Maximize/Minimize

### Maximize
- [ ] Clicking maximize button maximizes panel
- [ ] Maximized panel fills entire viewport
- [ ] Maximized panel position is (0, 0)
- [ ] Maximized panel size is (100vw, 100vh)
- [ ] Maximize button changes to minimize icon
- [ ] Resize handles disappear when maximized
- [ ] Panel cannot be dragged when maximized

### Minimize (Restore)
- [ ] Clicking minimize button restores panel
- [ ] Panel returns to previous size
- [ ] Panel returns to previous position
- [ ] Minimize button changes to maximize icon
- [ ] Resize handles reappear
- [ ] Panel can be dragged again

## ✅ State Persistence

### Save State
- [ ] Panel position is saved to localStorage
- [ ] Panel size is saved to localStorage
- [ ] Dock position is saved to localStorage
- [ ] Maximized state is saved to localStorage
- [ ] State is saved on drag end
- [ ] State is saved on resize end
- [ ] State is saved on dock/undock
- [ ] State is saved on maximize/minimize

### Load State
- [ ] Panel loads saved position on mount
- [ ] Panel loads saved size on mount
- [ ] Panel loads saved dock state on mount
- [ ] Panel loads saved maximized state on mount
- [ ] Default state is used if no saved state
- [ ] Corrupted state falls back to defaults

### Storage Keys
- [ ] Default storage key is used if not provided
- [ ] Custom storage key is respected
- [ ] Multiple panels with different keys work
- [ ] Clearing localStorage resets state

## ✅ Animations

### Drag Animations
- [ ] Panel scales to 1.02 while dragging
- [ ] Shadow increases while dragging
- [ ] Transition is smooth (spring animation)
- [ ] Animation duration is ~300ms

### Dock Animations
- [ ] Docking has smooth spring animation
- [ ] Docking animation duration is ~300ms
- [ ] Undocking has smooth spring animation
- [ ] Dock zone indicator pulses

### Resize Animations
- [ ] Resize is immediate (no animation lag)
- [ ] Content reflows smoothly

### Hover Animations
- [ ] Resize handles highlight on hover
- [ ] Buttons have hover states
- [ ] Transitions are smooth (150ms)

## ✅ Visual Polish

### Glassmorphism
- [ ] Panel has backdrop-blur-xl effect
- [ ] Background is semi-transparent (95% opacity)
- [ ] Panel blurs content behind it

### Colors
- [ ] Background uses --kos-surface-primary
- [ ] Border uses --kos-border-primary
- [ ] Accent uses --kos-accent-primary (cyan)
- [ ] Text uses --kos-text-primary
- [ ] Docked border is cyan (#00ffcc)

### Shadows
- [ ] Floating panel has 0 20px 60px shadow
- [ ] Docked panel has 0 10px 30px shadow
- [ ] Dragging panel has 0 30px 80px shadow
- [ ] Docked panel has cyan glow shadow

### Borders
- [ ] Panel has rounded corners (--kos-radius-lg)
- [ ] Border is 1px solid
- [ ] Docked panel has accent border
- [ ] Header has bottom border

## ✅ Edge Cases

### Viewport Changes
- [ ] Panel stays in bounds on window resize
- [ ] Docked panel adjusts to new viewport size
- [ ] Maximized panel adjusts to new viewport size

### Multiple Panels
- [ ] Multiple panels can be open simultaneously
- [ ] Each panel has independent state
- [ ] Panels don't interfere with each other
- [ ] Each panel has unique storage key

### Content Overflow
- [ ] Content scrolls if too large
- [ ] Scrollbar appears when needed
- [ ] Resize works with scrolling content

### Interaction Conflicts
- [ ] Dragging doesn't trigger resize
- [ ] Resizing doesn't trigger drag
- [ ] Clicking content doesn't trigger drag
- [ ] Clicking buttons doesn't trigger drag

## ✅ Accessibility

### Keyboard
- [ ] Close button is keyboard accessible
- [ ] Maximize button is keyboard accessible
- [ ] Tab order is logical

### ARIA
- [ ] Buttons have aria-label attributes
- [ ] Panel has semantic HTML structure

### Screen Readers
- [ ] Title is announced
- [ ] Buttons are announced
- [ ] State changes are announced (TODO)

## ✅ Performance

### Rendering
- [ ] No unnecessary re-renders during drag
- [ ] No unnecessary re-renders during resize
- [ ] Animations are smooth (60fps)
- [ ] No jank or stuttering

### Memory
- [ ] Event listeners are cleaned up
- [ ] No memory leaks on unmount
- [ ] localStorage doesn't grow unbounded

## ✅ Browser Compatibility

### Desktop
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge

### Mobile (if applicable)
- [ ] Touch drag works
- [ ] Touch resize works (may be difficult)
- [ ] Viewport constraints work on mobile

## ✅ Integration

### With Other Components
- [ ] Works inside AppShell
- [ ] Works with other shell components
- [ ] Z-index doesn't conflict with modals
- [ ] Doesn't break layout

### Props
- [ ] All required props work
- [ ] All optional props work
- [ ] Default values are correct
- [ ] Custom values are respected

## Test Results

**Date:** _____________

**Tester:** _____________

**Browser:** _____________

**OS:** _____________

### Summary
- Total tests: 200+
- Passed: ___
- Failed: ___
- Skipped: ___

### Issues Found
1. _____________________________________________
2. _____________________________________________
3. _____________________________________________

### Notes
_____________________________________________
_____________________________________________
_____________________________________________

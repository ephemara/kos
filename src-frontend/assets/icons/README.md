# K_OS DCC Suite Icon Set

Clean, minimal, solid-color icons for the K_OS 3D DCC Suite.

## Overview

- **Total Icons**: 124
- **Categories**: 19
- **Format**: SVG (64x64px)
- **Style**: Minimal, flat, solid colors

## Categories

### Modeling (15 icons)

```
  - cube
  - sphere
  - cylinder
  - cone
  - torus
  - plane
  - extrude
  - bevel
  - boolean_union
  - boolean_subtract
  - boolean_intersect
  - subdivide
  - mirror
  - array
  - lattice
```

### Sculpting (8 icons)

```
  - sculpt_draw
  - sculpt_grab
  - sculpt_smooth
  - sculpt_inflate
  - sculpt_crease
  - sculpt_pinch
  - sculpt_clay
  - sculpt_flatten
```

### Texturing (6 icons)

```
  - uv_unwrap
  - texture_paint
  - material
  - shader
  - normal_map
  - bake
```

### Rigging (4 icons)

```
  - bone
  - ik
  - fk
  - constraint
```

### Animation (4 icons)

```
  - keyframe
  - timeline
  - graph_editor
  - dope_sheet
```

### Rendering (8 icons)

```
  - camera
  - light_point
  - light_spot
  - light_area
  - light_sun
  - render
  - viewport
  - wireframe
```

### Simulation (6 icons)

```
  - particle
  - cloth
  - fluid
  - smoke
  - collision
  - force_field
```

### Selection (6 icons)

```
  - select_box
  - select_circle
  - select_lasso
  - move
  - rotate
  - scale
```

### View (7 icons)

```
  - view_front
  - view_side
  - view_top
  - view_perspective
  - zoom_in
  - zoom_out
  - frame_all
```

### File (7 icons)

```
  - new
  - open
  - save
  - import
  - export
  - undo
  - redo
```

### Organization (8 icons)

```
  - layer
  - group
  - collection
  - outliner
  - visible
  - hidden
  - lock
  - unlock
```

### Utilities (11 icons)

```
  - settings
  - preferences
  - help
  - search
  - filter
  - pin
  - bookmark
  - trash
  - duplicate
  - link
  - unlink
```

### Playback (7 icons)

```
  - play
  - pause
  - stop
  - record
  - skip_forward
  - skip_back
  - loop
```

### Compositing (5 icons)

```
  - compositor
  - color_correction
  - blur
  - glow
  - mask
```

### Grease Pencil (5 icons)

```
  - grease_pencil
  - draw_line
  - draw_curve
  - eraser
  - fill
```

### Curves (4 icons)

```
  - bezier
  - nurbs
  - path_edit
  - spline
```

### Measurement (4 icons)

```
  - ruler
  - protractor
  - grid
  - snap
```

### Procedural (4 icons)

```
  - geometry_nodes
  - procedural
  - noise
  - voronoi
```

### Modifiers (5 icons)

```
  - modifier
  - bend
  - twist
  - wave
  - shrinkwrap
```

## Usage

### React/TypeScript

```typescript
import CubeIcon from '@/assets/icons/modeling/cube.svg';

function ToolButton() {
  return <img src={CubeIcon} alt="Cube" width={24} height={24} />;
}
```

### Direct SVG Import

```typescript
import { ReactComponent as CubeIcon } from '@/assets/icons/modeling/cube.svg';

function ToolButton() {
  return <CubeIcon className="w-6 h-6 text-blue-500" />;
}
```

## Color Palette

- **Primary**: #8B5CF6 (Purple) - Main actions
- **Secondary**: #3B82F6 (Blue) - Secondary actions
- **Accent**: #EC4899 (Pink) - Highlights
- **Success**: #10B981 (Green) - Success states
- **Warning**: #F59E0B (Amber) - Warnings
- **Danger**: #EF4444 (Red) - Destructive actions

### Category Colors

- **Modeling**: Blue (#3B82F6)
- **Sculpting**: Purple (#8B5CF6)
- **Texturing**: Pink (#EC4899)
- **Rigging**: Amber (#F59E0B)
- **Animation**: Green (#10B981)
- **Rendering**: Red (#EF4444)
- **Simulation**: Cyan (#06B6D4)
- **Compositing**: Purple (#8B5CF6)

## License

Part of the K_OS DCC Suite project.

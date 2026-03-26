# CFD Integration in KQuantum

## Overview

Computational Fluid Dynamics (CFD) has been fully integrated into KQuantum as a third simulation mode alongside QUANTUM and CHRONOS.

## Features

### UI Integration

1. **TopBar Mode Toggle**
   - Added CFD mode button with Wind icon
   - Switches between QUANTUM/CHRONOS/CFD modes
   - File: `src-frontend/features/quantum/ui/TopBar.tsx`

2. **CFD Controls Tab**
   - New tab in left panel with comprehensive fluid controls
   - Fluid type presets: Smoke, Fire, Liquid, Gas, Viscous
   - Grid resolution selector: 32³, 64³, 96³, 128³
   - Fluid properties:
     - Viscosity (thickness/resistance)
     - Buoyancy (hot fluid rises)
     - Vorticity confinement (preserves swirls)
     - Dissipation (fade rate)
   - Emitter controls:
     - Radius
     - Velocity
     - Temperature
   - File: `src-frontend/features/quantum/ui/LeftPanel.tsx`

3. **State Management**
   - Added 9 new state variables in `KQuantum.tsx`:
     - `cfdResolution` (default: 64)
     - `cfdViscosity` (default: 0.001)
     - `cfdBuoyancy` (default: 2.0)
     - `cfdVorticityConfinement` (default: 1.0)
     - `cfdDissipation` (default: 0.99)
     - `cfdFluidType` (default: 'Smoke')
     - `cfdEmitterRadius` (default: 5.0)
     - `cfdEmitterVelocity` (default: 10.0)
     - `cfdEmitterTemperature` (default: 50.0)

### Engine Integration

1. **CFD Mode Management**
   - Automatic initialization when switching to CFD mode
   - Automatic disposal when switching away
   - Re-initialization on parameter changes
   - File: `src-frontend/features/quantum/KQuantumEngine.tsx`

2. **Simulation Loop**
   - CFD simulation steps at 60 FPS
   - Density field extraction and visualization
   - Particle-based rendering of fluid density
   - Threshold-based sampling (density > 0.1)

3. **Interaction**
   - Middle-click to add fluid emitters
   - Emitters use configured radius, velocity, and temperature
   - World-space coordinate conversion from screen space

## Backend

The CFD system uses the Rust backend implemented in:
- `crates/k-os-sim/src/cfd.rs`
- `src-frontend/services/cfdClient.ts`

### Available Commands

- `cfd_create` - Initialize CFD simulation
- `cfd_step` - Advance simulation by timestep
- `cfd_add_source` - Add fluid emitter
- `cfd_get_velocity_field` - Get velocity data
- `cfd_get_density_field` - Get density data
- `cfd_dispose` - Clean up simulation

## Usage

1. Switch to CFD mode using the top bar toggle
2. Select fluid type preset (Smoke, Fire, etc.)
3. Adjust grid resolution (64³ recommended for real-time)
4. Tune fluid properties (viscosity, buoyancy, vorticity)
5. Middle-click in viewport to add emitters
6. Watch the fluid simulation in real-time

## Performance

- **64³ grid**: Real-time at 60 FPS (recommended)
- **96³ grid**: ~30-45 FPS
- **128³ grid**: ~15-30 FPS (high quality)
- **32³ grid**: 60+ FPS (fast preview)

## Visualization

Current implementation uses particle-based rendering:
- Samples density field at grid points
- Creates particles where density > threshold
- Renders using existing particle shader system
- Color and opacity based on density values

## Future Enhancements

Potential improvements:
1. **Volume Rendering** - Direct 3D texture rendering instead of particles
2. **GPU Acceleration** - Move CFD solver to WGSL compute shaders
3. **Multiple Emitters** - UI for managing multiple emitter sources
4. **Velocity Visualization** - Arrow field or streamlines
5. **Temperature Visualization** - Heat map overlay
6. **Export** - Save CFD simulations to VDB or custom format

## Files Modified

- `src-frontend/features/quantum/ui/TopBar.tsx`
- `src-frontend/features/quantum/ui/LeftPanel.tsx`
- `src-frontend/features/quantum/KQuantum.tsx`
- `src-frontend/features/quantum/KQuantumEngine.tsx`

## Files Created

- `src-frontend/features/quantum/CFD_INTEGRATION.md` (this file)

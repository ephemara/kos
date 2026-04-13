# CFD Mode - Quick Start Guide

## 🌊 What is CFD Mode?

CFD (Computational Fluid Dynamics) mode brings real-time Navier-Stokes fluid simulation to KQuantum. Simulate smoke, fire, liquids, and gases with physically accurate dynamics.

## 🚀 Getting Started

### 1. Switch to CFD Mode
Click the **CFD** button in the top bar (next to QUANTUM and CHRONOS)

### 2. Choose Your Fluid
In the left panel CFD tab, select a preset:
- **Smoke** - Light, wispy, rises slowly
- **Fire** - Hot, fast-rising, high buoyancy
- **Liquid** - Dense, viscous, flows downward
- **Gas** - Light, disperses quickly
- **Viscous** - Thick, slow-moving fluid

### 3. Set Grid Resolution
Higher = more detail, but slower:
- **32³** - Fast preview (60+ FPS)
- **64³** - Recommended (60 FPS) ⭐
- **96³** - High quality (~30-45 FPS)
- **128³** - Maximum detail (~15-30 FPS)

### 4. Add Emitters
**Middle-click** anywhere in the viewport to spawn a fluid emitter at that location.

### 5. Tune Parameters

#### Fluid Properties
- **Viscosity** (0-0.1) - How thick/sticky the fluid is
  - Low = water-like, flows freely
  - High = honey-like, flows slowly
  
- **Buoyancy** (0-10) - How much hot fluid rises
  - 0 = no rising (like water)
  - High = rapid rising (like fire/smoke)
  
- **Vorticity** (0-5) - Preserves swirls and turbulence
  - 0 = smooth, laminar flow
  - High = chaotic, turbulent flow
  
- **Dissipation** (0.9-1.0) - How fast fluid fades
  - 0.9 = fades quickly
  - 1.0 = never fades

#### Emitter Controls
- **Radius** (1-20) - Size of emitter source
- **Velocity** (0-50) - How fast fluid is injected
- **Temperature** (0-100) - Heat (affects buoyancy)

## 🎨 Presets Explained

### Smoke
```
Viscosity: 0.001
Buoyancy: 2.0
Vorticity: 1.0
Dissipation: 0.99
```
Perfect for: Smoke plumes, fog, atmospheric effects

### Fire
```
Viscosity: 0.0005
Buoyancy: 5.0
Vorticity: 2.0
Dissipation: 0.95
```
Perfect for: Flames, explosions, heat distortion

### Liquid
```
Viscosity: 0.01
Buoyancy: 0.0
Vorticity: 0.5
Dissipation: 1.0
```
Perfect for: Water, oil, liquid simulations

### Gas
```
Viscosity: 0.0001
Buoyancy: 1.0
Vorticity: 1.5
Dissipation: 0.98
```
Perfect for: Steam, vapor, gas clouds

### Viscous
```
Viscosity: 0.05
Buoyancy: 0.5
Vorticity: 0.3
Dissipation: 1.0
```
Perfect for: Honey, lava, thick fluids

## 💡 Tips & Tricks

1. **Start with 64³ resolution** - Best balance of quality and performance
2. **Use middle-click** - Left-click is for UI, middle-click adds emitters
3. **Adjust buoyancy for fire** - High buoyancy + high temperature = realistic flames
4. **Lower dissipation for trails** - Creates persistent smoke trails
5. **High vorticity for chaos** - Makes fluid more turbulent and interesting
6. **Multiple emitters** - Click multiple times to create complex flows

## 🎯 Example Scenarios

### Campfire
1. Fluid Type: Fire
2. Resolution: 64³
3. Buoyancy: 5.0
4. Temperature: 80
5. Middle-click at bottom center

### Smoke Stack
1. Fluid Type: Smoke
2. Resolution: 64³
3. Buoyancy: 2.0
4. Velocity: 20
5. Middle-click to add continuous source

### Underwater Bubbles
1. Fluid Type: Gas
2. Resolution: 96³
3. Buoyancy: 3.0
4. Vorticity: 2.0
5. Multiple middle-clicks for bubble sources

### Lava Flow
1. Fluid Type: Viscous
2. Resolution: 64³
3. Viscosity: 0.05
4. Temperature: 100
5. Buoyancy: 0.5

## 🔧 Performance Optimization

If CFD is running slow:
1. Lower grid resolution (try 32³)
2. Reduce vorticity confinement
3. Increase dissipation (fluid fades faster)
4. Use fewer emitters

## 🐛 Troubleshooting

**No fluid appearing?**
- Make sure you're in CFD mode (top bar)
- Try middle-clicking (not left-click)
- Check that emitter velocity > 0

**Fluid disappears too fast?**
- Increase dissipation closer to 1.0
- Lower temperature if using high buoyancy

**Simulation is choppy?**
- Lower grid resolution
- Close other apps
- Reduce vorticity confinement

## 🚀 Next Steps

Once you're comfortable with CFD mode:
- Experiment with extreme parameters
- Combine multiple fluid types
- Create complex emitter patterns
- Export simulations (coming soon!)

---

**Pro Tip**: CFD mode is GPU-accelerated on the Rust backend. The grid-based Navier-Stokes solver runs at native speed with pressure projection and vorticity confinement for realistic fluid behavior.

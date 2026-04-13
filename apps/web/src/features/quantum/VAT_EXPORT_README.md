# KQuantum VAT Export

Vertex Animation Texture (VAT) export system for KQuantum particle simulations.

## What is VAT?

VAT (Vertex Animation Texture) is a technique for baking complex animations into textures that can be played back in real-time in game engines like Unreal Engine and Unity. Instead of storing animation data as keyframes, positions and normals are encoded into texture pixels.

## Features

- **Position Texture**: RGB channels store XYZ particle positions per frame
- **Normal Texture**: RGB channels store normalized velocity directions
- **Configurable Frame Count**: 10-500 frames (default: 120)
- **Configurable Frame Rate**: 15-120 FPS (default: 30)
- **Multiple Resolutions**: 256, 512, 1024, 2048, 4096 (default: 1024)
- **Bounds Normalization**: Optional 0-1 range normalization
- **Automatic Validation**: Checks particle count, texture size, memory usage

## Usage

1. Run your quantum simulation in KQuantum
2. Go to Export tab in right panel
3. Click "EXPORT VAT TEXTURES"
4. Configure settings:
   - Frame count (how many frames to capture)
   - Frame rate (FPS)
   - Texture resolution (higher = more particles/frames)
   - Enable/disable position and normal textures
5. Click "EXPORT VAT"
6. Files are saved:
   - `kquantum_vat_TIMESTAMP_position.png` - Position texture
   - `kquantum_vat_TIMESTAMP_normal.png` - Normal texture
   - `kquantum_vat_TIMESTAMP_metadata.json` - Animation metadata

## Texture Layout

Textures are laid out as:
- **X axis**: Particle index within frame
- **Y axis**: Frame index
- **Pixel (x, y)**: Data for particle `x` at frame `y`

For example, with 1000 particles and 100 frames:
- Texture needs at least 100,000 pixels (316x316 minimum)
- Pixel (0, 0) = Particle 0, Frame 0
- Pixel (999, 0) = Particle 999, Frame 0
- Pixel (0, 99) = Particle 0, Frame 99

## Unreal Engine Import

1. Import position and normal textures
2. Set texture compression to **VectorDisplacementmap** (HDR)
3. Disable sRGB
4. Create material with VAT shader:
   - Sample position texture using `(ParticleID, FrameIndex)`
   - Reconstruct world position from RGB
   - Apply to vertex shader
5. Use metadata.json for bounds and frame count

## Unity Import

1. Import textures as **HDR** format
2. Disable sRGB
3. Create shader graph:
   - Sample position texture
   - Decode RGB to world position
   - Apply in vertex stage
4. Use metadata.json for animation parameters

## Performance Tips

- **Lower frame count** = smaller files, less memory
- **Lower resolution** = faster export, smaller files
- **Disable normals** if not needed (saves 50% memory)
- **Normalize positions** for better precision in 0-1 range

## Validation

The system automatically validates:
- Particle count > 0
- Frame count between 2-1000
- Texture resolution is power of 2
- Texture has enough pixels for particles × frames
- Warns if export > 100MB
- Warns if particle count > 50,000

## Technical Details

- **Backend**: Rust (`crates/k-os-sim/src/quantum.rs`)
- **Frontend**: TypeScript (src-frontend/services/vatExportClient.ts)
- **Format**: PNG (RGBA, 8-bit per channel)
- **Encoding**: RGB = data, A = 255 (unused)
- **Position**: Raw XYZ or normalized 0-1
- **Normal**: Velocity direction, mapped from -1..1 to 0..255

## Limitations

- Maximum 1000 frames (to prevent huge files)
- Texture resolution limited by GPU (typically 8192x8192 max)
- 8-bit precision per channel (use HDR textures in engine for better quality)
- Normals computed from velocity (not true surface normals)

## Future Enhancements

- [ ] 16-bit or 32-bit float texture export
- [ ] EXR format support for HDR
- [ ] Velocity texture export
- [ ] Custom attribute baking (age, mass, charge)
- [ ] Compression options
- [ ] Direct UE5/Unity plugin integration

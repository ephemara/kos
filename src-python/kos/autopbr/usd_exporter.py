"""
USD Material Exporter for KAutoPBR

Exports materials to Pixar USD format with UsdPreviewSurface shading.
Supports all PBR map types and creates proper texture node connections.

Requirements: 10.1, 10.4
"""

import json
import base64
from pathlib import Path
from typing import Dict, List, Optional, Any
from io import BytesIO

try:
    from pxr import Usd, UsdShade, UsdGeom, Sdf, Gf
    USD_AVAILABLE = True
except ImportError:
    USD_AVAILABLE = False
    print("Warning: USD Python bindings (pxr) not available. Install with: pip install usd-core")


class USDExporter:
    """
    Exports KAutoPBR materials to USD format with UsdPreviewSurface.
    
    Creates a USD stage with:
    - Material definition
    - UsdPreviewSurface shader
    - Texture nodes for all PBR maps
    - Proper connections between nodes
    """
    
    def __init__(self):
        if not USD_AVAILABLE:
            raise ImportError("USD Python bindings (pxr) are required. Install with: pip install usd-core")
    
    def export_material(
        self,
        material_data: Dict[str, Any],
        output_path: str,
        texture_dir: Optional[str] = None
    ) -> bytes:
        """
        Export material to USD format.
        
        Args:
            material_data: Material data from KAutoPBR including:
                - id: Material UUID
                - metadata: Material metadata (name, description, etc.)
                - maps: PBR texture maps (albedo, normal, roughness, metallic, ao, height, emissive)
                - layers: Layer stack data
                - animation: Animation data (if present)
            output_path: Output USD file path
            texture_dir: Directory to save textures (relative to USD file)
        
        Returns:
            USD file bytes
        
        Requirements: 10.4
        """
        # Create USD stage
        stage = Usd.Stage.CreateInMemory()
        
        # Set up metadata
        stage.SetMetadata('upAxis', 'Y')
        stage.SetMetadata('metersPerUnit', 1.0)
        
        # Get material name
        material_name = material_data.get('metadata', {}).get('name', 'Material')
        material_name = self._sanitize_name(material_name)
        
        # Create material
        material_path = f'/Materials/{material_name}'
        material = UsdShade.Material.Define(stage, material_path)
        
        # Create UsdPreviewSurface shader
        shader_path = f'{material_path}/PreviewSurface'
        shader = UsdShade.Shader.Define(stage, shader_path)
        shader.CreateIdAttr('UsdPreviewSurface')
        
        # Get texture maps
        maps = material_data.get('maps', {})
        
        # Set up texture directory
        if texture_dir is None:
            texture_dir = 'textures'
        
        # Connect albedo/diffuse color
        if 'albedo' in maps and maps['albedo']:
            albedo_texture = self._create_texture_node(
                stage, material_path, 'albedo', maps['albedo'], texture_dir
            )
            if albedo_texture:
                shader.CreateInput('diffuseColor', Sdf.ValueTypeNames.Color3f).ConnectToSource(
                    albedo_texture.ConnectableAPI(), 'rgb'
                )
        else:
            # Default white
            shader.CreateInput('diffuseColor', Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(0.8, 0.8, 0.8))
        
        # Connect roughness
        if 'roughness' in maps and maps['roughness']:
            roughness_texture = self._create_texture_node(
                stage, material_path, 'roughness', maps['roughness'], texture_dir
            )
            if roughness_texture:
                shader.CreateInput('roughness', Sdf.ValueTypeNames.Float).ConnectToSource(
                    roughness_texture.ConnectableAPI(), 'r'
                )
        else:
            shader.CreateInput('roughness', Sdf.ValueTypeNames.Float).Set(0.5)
        
        # Connect metallic
        if 'metallic' in maps and maps['metallic']:
            metallic_texture = self._create_texture_node(
                stage, material_path, 'metallic', maps['metallic'], texture_dir
            )
            if metallic_texture:
                shader.CreateInput('metallic', Sdf.ValueTypeNames.Float).ConnectToSource(
                    metallic_texture.ConnectableAPI(), 'r'
                )
        else:
            shader.CreateInput('metallic', Sdf.ValueTypeNames.Float).Set(0.0)
        
        # Connect normal map
        if 'normal' in maps and maps['normal']:
            normal_texture = self._create_texture_node(
                stage, material_path, 'normal', maps['normal'], texture_dir
            )
            if normal_texture:
                shader.CreateInput('normal', Sdf.ValueTypeNames.Normal3f).ConnectToSource(
                    normal_texture.ConnectableAPI(), 'rgb'
                )
        
        # Connect ambient occlusion
        if 'ao' in maps and maps['ao']:
            ao_texture = self._create_texture_node(
                stage, material_path, 'occlusion', maps['ao'], texture_dir
            )
            if ao_texture:
                shader.CreateInput('occlusion', Sdf.ValueTypeNames.Float).ConnectToSource(
                    ao_texture.ConnectableAPI(), 'r'
                )
        
        # Connect emissive
        if 'emissive' in maps and maps['emissive']:
            emissive_texture = self._create_texture_node(
                stage, material_path, 'emissive', maps['emissive'], texture_dir
            )
            if emissive_texture:
                shader.CreateInput('emissiveColor', Sdf.ValueTypeNames.Color3f).ConnectToSource(
                    emissive_texture.ConnectableAPI(), 'rgb'
                )
        else:
            shader.CreateInput('emissiveColor', Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(0.0, 0.0, 0.0))
        
        # Connect displacement (height map)
        if 'height' in maps and maps['height']:
            height_texture = self._create_texture_node(
                stage, material_path, 'displacement', maps['height'], texture_dir
            )
            if height_texture:
                shader.CreateInput('displacement', Sdf.ValueTypeNames.Float).ConnectToSource(
                    height_texture.ConnectableAPI(), 'r'
                )
        
        # Connect shader to material surface output
        material.CreateSurfaceOutput().ConnectToSource(shader.ConnectableAPI(), 'surface')
        
        # Add custom metadata
        metadata = material_data.get('metadata', {})
        if metadata:
            material_prim = stage.GetPrimAtPath(material_path)
            if 'description' in metadata:
                material_prim.SetDocumentation(metadata['description'])
            if 'tags' in metadata:
                material_prim.SetMetadata('customData', {'tags': metadata['tags']})
            if 'author' in metadata:
                material_prim.SetMetadata('customData', {'author': metadata['author']})
        
        # Export to bytes
        stage.GetRootLayer().Export(output_path)
        
        # Read file bytes
        with open(output_path, 'rb') as f:
            usd_bytes = f.read()
        
        return usd_bytes
    
    def _create_texture_node(
        self,
        stage: Usd.Stage,
        material_path: str,
        map_name: str,
        texture_data: Dict[str, Any],
        texture_dir: str
    ) -> Optional[UsdShade.Shader]:
        """
        Create a UsdUVTexture node for a texture map.
        
        Args:
            stage: USD stage
            material_path: Path to material
            map_name: Name of the map (albedo, normal, etc.)
            texture_data: Texture data including path or bytes
            texture_dir: Directory for textures
        
        Returns:
            UsdShade.Shader for the texture node
        """
        # Create texture shader
        texture_path = f'{material_path}/Texture_{map_name}'
        texture_shader = UsdShade.Shader.Define(stage, texture_path)
        texture_shader.CreateIdAttr('UsdUVTexture')
        
        # Set texture file path
        if 'path' in texture_data:
            # Use relative path
            texture_file = f'{texture_dir}/{Path(texture_data["path"]).name}'
        elif 'bytes' in texture_data:
            # Generate filename from map name
            texture_file = f'{texture_dir}/{map_name}.png'
        else:
            return None
        
        texture_shader.CreateInput('file', Sdf.ValueTypeNames.Asset).Set(texture_file)
        
        # Set wrap mode (repeat by default)
        texture_shader.CreateInput('wrapS', Sdf.ValueTypeNames.Token).Set('repeat')
        texture_shader.CreateInput('wrapT', Sdf.ValueTypeNames.Token).Set('repeat')
        
        # Create primvar reader for UV coordinates
        primvar_path = f'{material_path}/PrimvarReader_{map_name}'
        primvar_reader = UsdShade.Shader.Define(stage, primvar_path)
        primvar_reader.CreateIdAttr('UsdPrimvarReader_float2')
        primvar_reader.CreateInput('varname', Sdf.ValueTypeNames.Token).Set('st')
        
        # Connect primvar reader to texture
        texture_shader.CreateInput('st', Sdf.ValueTypeNames.Float2).ConnectToSource(
            primvar_reader.ConnectableAPI(), 'result'
        )
        
        return texture_shader
    
    def _sanitize_name(self, name: str) -> str:
        """
        Sanitize name for USD (alphanumeric and underscores only).
        
        Args:
            name: Original name
        
        Returns:
            Sanitized name
        """
        # Replace spaces and special characters with underscores
        sanitized = ''.join(c if c.isalnum() or c == '_' else '_' for c in name)
        
        # Ensure it starts with a letter or underscore
        if sanitized and not (sanitized[0].isalpha() or sanitized[0] == '_'):
            sanitized = '_' + sanitized
        
        return sanitized or 'Material'
    
    def validate_usd_file(self, usd_path: str) -> Dict[str, Any]:
        """
        Validate USD file structure.
        
        Args:
            usd_path: Path to USD file
        
        Returns:
            Validation result with status and details
        
        Requirements: 10.4
        """
        try:
            stage = Usd.Stage.Open(usd_path)
            
            # Check for materials
            materials = []
            for prim in stage.Traverse():
                if prim.IsA(UsdShade.Material):
                    materials.append(str(prim.GetPath()))
            
            # Check for shaders
            shaders = []
            for prim in stage.Traverse():
                if prim.IsA(UsdShade.Shader):
                    shader = UsdShade.Shader(prim)
                    shader_id = shader.GetIdAttr().Get()
                    shaders.append({
                        'path': str(prim.GetPath()),
                        'id': shader_id
                    })
            
            return {
                'valid': True,
                'materials': materials,
                'shaders': shaders,
                'material_count': len(materials),
                'shader_count': len(shaders)
            }
        
        except Exception as e:
            return {
                'valid': False,
                'error': str(e)
            }


# Singleton instance
_exporter = None


def get_exporter() -> USDExporter:
    """Get or create USD exporter instance."""
    global _exporter
    if _exporter is None:
        _exporter = USDExporter()
    return _exporter

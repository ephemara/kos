"""
Unit Tests for USD Exporter

Tests USD material export functionality including:
- Material export with all map types
- USD file structure validation
- Batch export
- Error handling

Requirements: 10.4
"""

import unittest
import json
import base64
import tempfile
from pathlib import Path
from typing import Dict, Any

try:
    from pxr import Usd, UsdShade
    USD_AVAILABLE = True
except ImportError:
    USD_AVAILABLE = False

from kos.autopbr.usd_exporter import USDExporter, get_exporter
from kos.autopbr.usd_rpc import export_usd, validate_usd, export_usd_batch


class TestUSDExporter(unittest.TestCase):
    """Test USD exporter functionality"""
    
    def setUp(self):
        """Set up test fixtures"""
        if not USD_AVAILABLE:
            self.skipTest("USD Python bindings not available")
        
        self.exporter = USDExporter()
        self.temp_dir = Path(tempfile.mkdtemp())
        
        # Sample material data
        self.sample_material = {
            'id': 'test-material-001',
            'metadata': {
                'name': 'Test Material',
                'description': 'A test material for USD export',
                'tags': ['test', 'pbr', 'metal'],
                'author': 'Test Suite',
                'category': 'Metal'
            },
            'maps': {
                'albedo': {'path': 'textures/albedo.png'},
                'normal': {'path': 'textures/normal.png'},
                'roughness': {'path': 'textures/roughness.png'},
                'metallic': {'path': 'textures/metallic.png'},
                'ao': {'path': 'textures/ao.png'},
                'height': {'path': 'textures/height.png'},
                'emissive': {'path': 'textures/emissive.png'}
            }
        }
    
    def tearDown(self):
        """Clean up test files"""
        import shutil
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)
    
    def test_export_material_with_all_maps(self):
        """Test exporting material with all PBR map types"""
        output_path = self.temp_dir / 'test_material.usda'
        
        # Export material
        usd_bytes = self.exporter.export_material(
            material_data=self.sample_material,
            output_path=str(output_path)
        )
        
        # Verify file was created
        self.assertTrue(output_path.exists())
        self.assertGreater(len(usd_bytes), 0)
        
        # Verify USD structure
        stage = Usd.Stage.Open(str(output_path))
        self.assertIsNotNone(stage)
        
        # Check for material
        material_path = '/Materials/Test_Material'
        material_prim = stage.GetPrimAtPath(material_path)
        self.assertTrue(material_prim.IsValid())
        self.assertTrue(material_prim.IsA(UsdShade.Material))
        
        # Check for shader
        shader_path = f'{material_path}/PreviewSurface'
        shader_prim = stage.GetPrimAtPath(shader_path)
        self.assertTrue(shader_prim.IsValid())
        self.assertTrue(shader_prim.IsA(UsdShade.Shader))
        
        shader = UsdShade.Shader(shader_prim)
        shader_id = shader.GetIdAttr().Get()
        self.assertEqual(shader_id, 'UsdPreviewSurface')
    
    def test_export_material_minimal(self):
        """Test exporting material with minimal data"""
        minimal_material = {
            'id': 'minimal-001',
            'metadata': {'name': 'Minimal'},
            'maps': {}
        }
        
        output_path = self.temp_dir / 'minimal.usda'
        
        # Export should succeed even with no maps
        usd_bytes = self.exporter.export_material(
            material_data=minimal_material,
            output_path=str(output_path)
        )
        
        self.assertTrue(output_path.exists())
        self.assertGreater(len(usd_bytes), 0)
        
        # Verify default values are set
        stage = Usd.Stage.Open(str(output_path))
        shader_prim = stage.GetPrimAtPath('/Materials/Minimal/PreviewSurface')
        shader = UsdShade.Shader(shader_prim)
        
        # Check default diffuse color
        diffuse_input = shader.GetInput('diffuseColor')
        self.assertIsNotNone(diffuse_input)
    
    def test_texture_node_creation(self):
        """Test texture node creation for each map type"""
        output_path = self.temp_dir / 'texture_test.usda'
        
        usd_bytes = self.exporter.export_material(
            material_data=self.sample_material,
            output_path=str(output_path)
        )
        
        stage = Usd.Stage.Open(str(output_path))
        material_path = '/Materials/Test_Material'
        
        # Check for texture nodes
        texture_types = ['albedo', 'normal', 'roughness', 'metallic', 'occlusion', 'emissive', 'displacement']
        
        for tex_type in texture_types:
            texture_path = f'{material_path}/Texture_{tex_type}'
            texture_prim = stage.GetPrimAtPath(texture_path)
            
            if texture_prim.IsValid():
                texture_shader = UsdShade.Shader(texture_prim)
                shader_id = texture_shader.GetIdAttr().Get()
                self.assertEqual(shader_id, 'UsdUVTexture')
                
                # Check file input
                file_input = texture_shader.GetInput('file')
                self.assertIsNotNone(file_input)
    
    def test_validate_usd_file(self):
        """Test USD file validation"""
        output_path = self.temp_dir / 'validate_test.usda'
        
        # Export material
        self.exporter.export_material(
            material_data=self.sample_material,
            output_path=str(output_path)
        )
        
        # Validate
        result = self.exporter.validate_usd_file(str(output_path))
        
        self.assertTrue(result['valid'])
        self.assertGreater(result['material_count'], 0)
        self.assertGreater(result['shader_count'], 0)
        self.assertIn('materials', result)
        self.assertIn('shaders', result)
    
    def test_validate_invalid_file(self):
        """Test validation of invalid USD file"""
        invalid_path = self.temp_dir / 'nonexistent.usda'
        
        result = self.exporter.validate_usd_file(str(invalid_path))
        
        self.assertFalse(result['valid'])
        self.assertIn('error', result)
    
    def test_sanitize_name(self):
        """Test name sanitization for USD"""
        test_cases = [
            ('Simple Name', 'Simple_Name'),
            ('Name-With-Dashes', 'Name_With_Dashes'),
            ('Name With Spaces', 'Name_With_Spaces'),
            ('123StartWithNumber', '_123StartWithNumber'),
            ('Special!@#$%Chars', 'Special_____Chars'),
            ('', 'Material')
        ]
        
        for input_name, expected in test_cases:
            result = self.exporter._sanitize_name(input_name)
            self.assertEqual(result, expected)
    
    def test_metadata_preservation(self):
        """Test that material metadata is preserved in USD"""
        output_path = self.temp_dir / 'metadata_test.usda'
        
        self.exporter.export_material(
            material_data=self.sample_material,
            output_path=str(output_path)
        )
        
        stage = Usd.Stage.Open(str(output_path))
        material_prim = stage.GetPrimAtPath('/Materials/Test_Material')
        
        # Check documentation
        doc = material_prim.GetDocumentation()
        self.assertEqual(doc, 'A test material for USD export')


class TestUSDRPC(unittest.TestCase):
    """Test USD RPC functions"""
    
    def setUp(self):
        """Set up test fixtures"""
        if not USD_AVAILABLE:
            self.skipTest("USD Python bindings not available")
        
        self.temp_dir = Path(tempfile.mkdtemp())
        
        self.sample_material = {
            'id': 'rpc-test-001',
            'metadata': {'name': 'RPC Test'},
            'maps': {
                'albedo': {'path': 'textures/albedo.png'}
            }
        }
    
    def tearDown(self):
        """Clean up test files"""
        import shutil
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)
    
    def test_export_usd_rpc(self):
        """Test export_usd RPC function"""
        material_json = json.dumps(self.sample_material)
        output_path = str(self.temp_dir / 'rpc_test.usda')
        
        result = export_usd(material_json, output_path)
        
        self.assertTrue(result['success'])
        self.assertIn('usd_bytes', result)
        self.assertIn('path', result)
        self.assertGreater(result['size_bytes'], 0)
        
        # Verify base64 encoding
        usd_bytes = base64.b64decode(result['usd_bytes'])
        self.assertGreater(len(usd_bytes), 0)
    
    def test_export_usd_rpc_temp_file(self):
        """Test export_usd with automatic temp file creation"""
        material_json = json.dumps(self.sample_material)
        
        result = export_usd(material_json)
        
        self.assertTrue(result['success'])
        self.assertIn('path', result)
        
        # Verify temp file exists
        temp_path = Path(result['path'])
        self.assertTrue(temp_path.exists())
        
        # Clean up
        temp_path.unlink()
    
    def test_export_usd_rpc_error_handling(self):
        """Test error handling in export_usd RPC"""
        invalid_json = "not valid json"
        
        result = export_usd(invalid_json)
        
        self.assertFalse(result['success'])
        self.assertIn('error', result)
    
    def test_validate_usd_rpc(self):
        """Test validate_usd RPC function"""
        # First export a material
        material_json = json.dumps(self.sample_material)
        output_path = str(self.temp_dir / 'validate_rpc.usda')
        export_result = export_usd(material_json, output_path)
        
        # Then validate
        result = validate_usd(output_path)
        
        self.assertTrue(result['valid'])
        self.assertGreater(result['material_count'], 0)
    
    def test_export_usd_batch(self):
        """Test batch USD export"""
        materials = [
            {
                'id': 'batch-001',
                'metadata': {'name': 'Batch Material 1'},
                'maps': {}
            },
            {
                'id': 'batch-002',
                'metadata': {'name': 'Batch Material 2'},
                'maps': {}
            },
            {
                'id': 'batch-003',
                'metadata': {'name': 'Batch Material 3'},
                'maps': {}
            }
        ]
        
        materials_json = json.dumps(materials)
        output_dir = str(self.temp_dir / 'batch_output')
        
        result = export_usd_batch(materials_json, output_dir)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['total'], 3)
        self.assertEqual(result['success_count'], 3)
        self.assertEqual(result['failure_count'], 0)
        self.assertEqual(len(result['exported']), 3)
        
        # Verify files exist
        for file_path in result['exported']:
            self.assertTrue(Path(file_path).exists())
    
    def test_export_usd_batch_partial_failure(self):
        """Test batch export with some failures"""
        materials = [
            {
                'id': 'good-001',
                'metadata': {'name': 'Good Material'},
                'maps': {}
            },
            {
                # Missing required fields - should fail
                'id': 'bad-001'
            }
        ]
        
        materials_json = json.dumps(materials)
        output_dir = str(self.temp_dir / 'batch_partial')
        
        result = export_usd_batch(materials_json, output_dir)
        
        self.assertFalse(result['success'])  # Not all succeeded
        self.assertEqual(result['total'], 2)
        self.assertGreater(result['success_count'], 0)
        self.assertGreater(result['failure_count'], 0)
        self.assertGreater(len(result['failed']), 0)


class TestUSDExporterIntegration(unittest.TestCase):
    """Integration tests for USD export workflow"""
    
    def setUp(self):
        """Set up test fixtures"""
        if not USD_AVAILABLE:
            self.skipTest("USD Python bindings not available")
        
        self.temp_dir = Path(tempfile.mkdtemp())
    
    def tearDown(self):
        """Clean up test files"""
        import shutil
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)
    
    def test_full_export_workflow(self):
        """Test complete export workflow from material data to validated USD"""
        # Create material
        material = {
            'id': 'workflow-test-001',
            'metadata': {
                'name': 'Workflow Test Material',
                'description': 'Testing full workflow',
                'tags': ['test', 'workflow'],
                'author': 'Integration Test'
            },
            'maps': {
                'albedo': {'path': 'textures/albedo.png'},
                'roughness': {'path': 'textures/roughness.png'},
                'metallic': {'path': 'textures/metallic.png'}
            }
        }
        
        # Export via RPC
        material_json = json.dumps(material)
        output_path = str(self.temp_dir / 'workflow_test.usda')
        export_result = export_usd(material_json, output_path)
        
        # Verify export succeeded
        self.assertTrue(export_result['success'])
        
        # Validate via RPC
        validate_result = validate_usd(output_path)
        
        # Verify validation succeeded
        self.assertTrue(validate_result['valid'])
        self.assertEqual(validate_result['material_count'], 1)
        self.assertGreater(validate_result['shader_count'], 0)
        
        # Verify file structure
        stage = Usd.Stage.Open(output_path)
        self.assertIsNotNone(stage)
        
        # Check material exists
        materials = validate_result['materials']
        self.assertEqual(len(materials), 1)
        
        material_prim = stage.GetPrimAtPath(materials[0])
        self.assertTrue(material_prim.IsValid())


if __name__ == '__main__':
    unittest.main()

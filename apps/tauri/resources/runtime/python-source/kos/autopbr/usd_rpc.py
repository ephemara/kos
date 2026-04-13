"""
USD Export RPC Functions for KAutoPBR

JSON-RPC wrapper functions for USD material export.
These functions are registered in main.py for Rust/Tauri IPC.

Requirements: 10.4
"""

import json
import base64
import tempfile
from pathlib import Path
from typing import Dict, Any

from .usd_exporter import get_exporter


def export_usd(material_json: str, output_path: str = None) -> Dict[str, Any]:
    """
    Export material to USD format (JSON-RPC endpoint).
    
    Args:
        material_json: JSON string containing material data
        output_path: Optional output path (defaults to temp file)
    
    Returns:
        Dictionary with:
            - success: bool
            - usd_bytes: base64-encoded USD file bytes
            - path: output file path
            - error: error message (if failed)
    
    Requirements: 10.4
    """
    try:
        # Parse material data
        material_data = json.loads(material_json)
        
        # Create temp file if no output path provided
        if output_path is None:
            temp_file = tempfile.NamedTemporaryFile(
                mode='w',
                suffix='.usda',
                delete=False
            )
            output_path = temp_file.name
            temp_file.close()
        
        # Export material
        exporter = get_exporter()
        usd_bytes = exporter.export_material(
            material_data=material_data,
            output_path=output_path
        )
        
        # Encode bytes to base64
        usd_base64 = base64.b64encode(usd_bytes).decode('utf-8')
        
        return {
            'success': True,
            'usd_bytes': usd_base64,
            'path': output_path,
            'size_bytes': len(usd_bytes)
        }
    
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def validate_usd(usd_path: str) -> Dict[str, Any]:
    """
    Validate USD file structure (JSON-RPC endpoint).
    
    Args:
        usd_path: Path to USD file
    
    Returns:
        Validation result dictionary
    
    Requirements: 10.4
    """
    try:
        exporter = get_exporter()
        result = exporter.validate_usd_file(usd_path)
        return result
    
    except Exception as e:
        return {
            'valid': False,
            'error': str(e)
        }


def export_usd_batch(materials_json: str, output_dir: str) -> Dict[str, Any]:
    """
    Export multiple materials to USD format (JSON-RPC endpoint).
    
    Args:
        materials_json: JSON string containing array of material data
        output_dir: Output directory for USD files
    
    Returns:
        Dictionary with:
            - success: bool
            - exported: list of exported file paths
            - failed: list of failed materials with errors
    
    Requirements: 10.13
    """
    try:
        # Parse materials data
        materials = json.loads(materials_json)
        
        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        exporter = get_exporter()
        exported = []
        failed = []
        
        # Export each material
        for material_data in materials:
            try:
                material_name = material_data.get('metadata', {}).get('name', 'Material')
                material_id = material_data.get('id', 'unknown')
                
                # Sanitize filename
                safe_name = ''.join(c if c.isalnum() or c in '_-' else '_' for c in material_name)
                output_file = output_path / f'{safe_name}_{material_id[:8]}.usda'
                
                # Export
                exporter.export_material(
                    material_data=material_data,
                    output_path=str(output_file)
                )
                
                exported.append(str(output_file))
            
            except Exception as e:
                failed.append({
                    'material_id': material_data.get('id', 'unknown'),
                    'material_name': material_data.get('metadata', {}).get('name', 'Unknown'),
                    'error': str(e)
                })
        
        return {
            'success': len(failed) == 0,
            'exported': exported,
            'failed': failed,
            'total': len(materials),
            'success_count': len(exported),
            'failure_count': len(failed)
        }
    
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'exported': [],
            'failed': []
        }

"""
UI Forge Preview Manager

Manages the preview and approval workflow for generated assets.
Stages assets in timestamped directories, generates HTML preview galleries,
and handles batch approval/rejection with feedback notes.

Requirements: 4.1, 4.2, 4.7, 4.8
"""

import json
import shutil
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from dataclasses import dataclass, field, asdict

from models import AssetMetadata, GenerationResult


# Configure logging
logger = logging.getLogger(__name__)


# ============================================================================
# Preview Data Models
# ============================================================================

@dataclass
class PreviewEntry:
    """Entry for a staged preview asset"""
    preview_id: str
    asset_id: str
    template_name: str
    category: str
    timestamp: datetime
    output_paths: Dict[str, str]  # format -> file path
    metadata: AssetMetadata
    status: str = "pending"  # 'pending', 'approved', 'rejected'
    feedback: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        # Convert datetime to ISO format
        data['timestamp'] = self.timestamp.isoformat()
        if isinstance(data['metadata'], dict):
            if 'generation_timestamp' in data['metadata']:
                data['metadata']['generation_timestamp'] = data['metadata']['generation_timestamp'].isoformat() if isinstance(data['metadata']['generation_timestamp'], datetime) else data['metadata']['generation_timestamp']
            if 'last_used' in data['metadata'] and data['metadata']['last_used']:
                data['metadata']['last_used'] = data['metadata']['last_used'].isoformat() if isinstance(data['metadata']['last_used'], datetime) else data['metadata']['last_used']
        return data


@dataclass
class PreviewStatus:
    """Status of a preview batch"""
    preview_id: str
    total_assets: int
    pending: int
    approved: int
    rejected: int
    timestamp: datetime
    gallery_path: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data


# ============================================================================
# Preview Manager
# ============================================================================

class PreviewManager:
    """
    Manages preview and approval workflow for generated assets.
    
    Features:
    - Stage assets in timestamped preview directories
    - Generate HTML preview galleries with thumbnails
    - Display asset metadata and validation results
    - Support batch approval/rejection with feedback
    - Track preview status and history
    
    Directory structure:
        preview/
            [timestamp]/
                assets/
                    [category]/
                        [asset_name]/
                            [files]
                index.html
                preview_manifest.json
    """
    
    def __init__(self, preview_dir: Optional[Path] = None):
        """
        Initialize PreviewManager.
        
        Args:
            preview_dir: Base preview directory (defaults to ./preview/)
        """
        if preview_dir is None:
            preview_dir = Path(__file__).parent / "preview"
        self.preview_dir = Path(preview_dir)
        self.preview_dir.mkdir(parents=True, exist_ok=True)
        
        # Track active previews
        self._previews: Dict[str, Dict[str, PreviewEntry]] = {}  # preview_id -> {asset_id -> PreviewEntry}
        
        logger.info(f"PreviewManager initialized with preview_dir: {self.preview_dir}")
    
    def stage_asset(
        self,
        result: GenerationResult,
        preview_id: Optional[str] = None,
    ) -> PreviewEntry:
        """
        Stage a generated asset for preview.
        
        Creates a timestamped preview directory and copies the asset files.
        Generates a preview entry with metadata for gallery display.
        
        Args:
            result: GenerationResult from asset generation
            preview_id: Optional preview batch ID (auto-generated if None)
            
        Returns:
            PreviewEntry object
            
        Raises:
            ValueError: If result is not successful
            IOError: If file operations fail
        """
        if not result.success:
            raise ValueError(f"Cannot stage failed generation result: {result.error}")
        
        # Generate preview ID if not provided (timestamp-based)
        if preview_id is None:
            preview_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        logger.info(f"Staging asset '{result.template_name}' in preview '{preview_id}'")
        
        # Create preview directory structure
        preview_batch_dir = self.preview_dir / preview_id
        assets_dir = preview_batch_dir / "assets" / result.metadata.category / result.template_name
        assets_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy asset files to preview directory
        staged_paths = {}
        for format_name, source_path in result.output_paths.items():
            source = Path(source_path)
            if not source.exists():
                logger.warning(f"Source file not found: {source_path}")
                continue
            
            # Copy to preview directory
            dest = assets_dir / source.name
            shutil.copy2(source, dest)
            staged_paths[format_name] = str(dest)
            logger.debug(f"Copied {source.name} to preview")
        
        # Create preview entry
        entry = PreviewEntry(
            preview_id=preview_id,
            asset_id=result.asset_id,
            template_name=result.template_name,
            category=result.metadata.category,
            timestamp=datetime.now(),
            output_paths=staged_paths,
            metadata=result.metadata,
            status="pending",
            feedback=None,
        )
        
        # Track preview entry
        if preview_id not in self._previews:
            self._previews[preview_id] = {}
        self._previews[preview_id][result.asset_id] = entry
        
        # Save preview manifest
        self._save_preview_manifest(preview_id)
        
        logger.info(f"Asset '{result.template_name}' staged successfully")
        return entry

    def generate_gallery(self, preview_id: str) -> str:
        """
        Generate HTML preview gallery for visual inspection.
        
        Creates an interactive HTML gallery with:
        - Grid layout with thumbnails
        - Alpha channel visualization (checkerboard backgrounds)
        - Asset metadata display
        - Approve/reject buttons with keyboard shortcuts
        - Category and validation status filters
        
        Args:
            preview_id: Preview batch ID
            
        Returns:
            Path to generated index.html
            
        Raises:
            ValueError: If preview_id not found
        """
        if preview_id not in self._previews:
            raise ValueError(f"Preview batch not found: {preview_id}")
        
        logger.info(f"Generating HTML gallery for preview '{preview_id}'")
        
        preview_batch_dir = self.preview_dir / preview_id
        gallery_path = preview_batch_dir / "index.html"
        
        # Get all preview entries
        entries = list(self._previews[preview_id].values())
        
        # Generate HTML
        html = self._generate_gallery_html(preview_id, entries)
        
        # Write to file
        with open(gallery_path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        logger.info(f"Gallery generated: {gallery_path}")
        return str(gallery_path)
    
    def approve_assets(self, asset_ids: List[str], preview_id: Optional[str] = None) -> int:
        """
        Approve assets in batch for production library integration.
        
        Marks assets as approved and ready for library manager to move
        to production. Updates preview manifest with approval status.
        
        Args:
            asset_ids: List of asset IDs to approve
            preview_id: Optional preview batch ID (searches all if None)
            
        Returns:
            Number of assets approved
            
        Raises:
            ValueError: If assets not found
        """
        logger.info(f"Approving {len(asset_ids)} assets")
        
        approved_count = 0
        
        # Determine which previews to search
        preview_ids = [preview_id] if preview_id else list(self._previews.keys())
        
        for pid in preview_ids:
            if pid not in self._previews:
                continue
            
            for asset_id in asset_ids:
                if asset_id in self._previews[pid]:
                    entry = self._previews[pid][asset_id]
                    entry.status = "approved"
                    entry.feedback = None
                    approved_count += 1
                    logger.debug(f"Approved asset '{entry.template_name}' in preview '{pid}'")
        
        # Save updated manifests
        for pid in preview_ids:
            if pid in self._previews:
                self._save_preview_manifest(pid)
        
        logger.info(f"Approved {approved_count} assets")
        return approved_count
    
    def reject_assets(
        self,
        asset_ids: List[str],
        feedback: Optional[str] = None,
        preview_id: Optional[str] = None,
    ) -> int:
        """
        Reject assets with optional feedback notes.
        
        Marks assets as rejected and stores feedback for review.
        Rejected assets will not be moved to production library.
        
        Args:
            asset_ids: List of asset IDs to reject
            feedback: Optional feedback/reason for rejection
            preview_id: Optional preview batch ID (searches all if None)
            
        Returns:
            Number of assets rejected
            
        Raises:
            ValueError: If assets not found
        """
        logger.info(f"Rejecting {len(asset_ids)} assets")
        
        rejected_count = 0
        
        # Determine which previews to search
        preview_ids = [preview_id] if preview_id else list(self._previews.keys())
        
        for pid in preview_ids:
            if pid not in self._previews:
                continue
            
            for asset_id in asset_ids:
                if asset_id in self._previews[pid]:
                    entry = self._previews[pid][asset_id]
                    entry.status = "rejected"
                    entry.feedback = feedback
                    rejected_count += 1
                    logger.debug(f"Rejected asset '{entry.template_name}' in preview '{pid}'")
        
        # Save updated manifests
        for pid in preview_ids:
            if pid in self._previews:
                self._save_preview_manifest(pid)
        
        logger.info(f"Rejected {rejected_count} assets")
        return rejected_count
    
    def get_preview_status(self, preview_id: str) -> PreviewStatus:
        """
        Get status information for a preview batch.
        
        Returns statistics about pending, approved, and rejected assets
        in the preview batch.
        
        Args:
            preview_id: Preview batch ID
            
        Returns:
            PreviewStatus object
            
        Raises:
            ValueError: If preview_id not found
        """
        if preview_id not in self._previews:
            raise ValueError(f"Preview batch not found: {preview_id}")
        
        entries = self._previews[preview_id].values()
        
        total = len(entries)
        pending = sum(1 for e in entries if e.status == "pending")
        approved = sum(1 for e in entries if e.status == "approved")
        rejected = sum(1 for e in entries if e.status == "rejected")
        
        # Get timestamp from first entry
        timestamp = next(iter(entries)).timestamp if entries else datetime.now()
        
        # Check if gallery exists
        gallery_path = self.preview_dir / preview_id / "index.html"
        gallery_path_str = str(gallery_path) if gallery_path.exists() else None
        
        return PreviewStatus(
            preview_id=preview_id,
            total_assets=total,
            pending=pending,
            approved=approved,
            rejected=rejected,
            timestamp=timestamp,
            gallery_path=gallery_path_str,
        )

    def list_previews(self) -> List[PreviewStatus]:
        """
        List all preview batches with their status.
        
        Returns:
            List of PreviewStatus objects
        """
        return [self.get_preview_status(pid) for pid in self._previews.keys()]
    
    def get_approved_assets(self, preview_id: str) -> List[PreviewEntry]:
        """
        Get all approved assets from a preview batch.
        
        Args:
            preview_id: Preview batch ID
            
        Returns:
            List of approved PreviewEntry objects
        """
        if preview_id not in self._previews:
            return []
        
        return [
            entry for entry in self._previews[preview_id].values()
            if entry.status == "approved"
        ]
    
    def get_rejected_assets(self, preview_id: str) -> List[PreviewEntry]:
        """
        Get all rejected assets from a preview batch.
        
        Args:
            preview_id: Preview batch ID
            
        Returns:
            List of rejected PreviewEntry objects
        """
        if preview_id not in self._previews:
            return []
        
        return [
            entry for entry in self._previews[preview_id].values()
            if entry.status == "rejected"
        ]
    
    def clear_preview(self, preview_id: str, remove_files: bool = False) -> bool:
        """
        Clear a preview batch from tracking.
        
        Args:
            preview_id: Preview batch ID
            remove_files: If True, also delete preview files from disk
            
        Returns:
            True if cleared, False if not found
        """
        if preview_id not in self._previews:
            return False
        
        # Remove from tracking
        del self._previews[preview_id]
        
        # Optionally remove files
        if remove_files:
            preview_batch_dir = self.preview_dir / preview_id
            if preview_batch_dir.exists():
                shutil.rmtree(preview_batch_dir)
                logger.info(f"Removed preview files: {preview_batch_dir}")
        
        logger.info(f"Cleared preview batch: {preview_id}")
        return True
    
    # ========================================================================
    # Helper Methods
    # ========================================================================
    
    def _save_preview_manifest(self, preview_id: str) -> None:
        """
        Save preview manifest to JSON file.
        
        Args:
            preview_id: Preview batch ID
        """
        if preview_id not in self._previews:
            return
        
        preview_batch_dir = self.preview_dir / preview_id
        manifest_path = preview_batch_dir / "preview_manifest.json"
        
        # Convert entries to dict
        manifest = {
            "preview_id": preview_id,
            "timestamp": datetime.now().isoformat(),
            "entries": [entry.to_dict() for entry in self._previews[preview_id].values()],
        }
        
        # Save to JSON
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2)
        
        logger.debug(f"Saved preview manifest: {manifest_path}")
    
    def _load_preview_manifest(self, preview_id: str) -> bool:
        """
        Load preview manifest from JSON file.
        
        Args:
            preview_id: Preview batch ID
            
        Returns:
            True if loaded successfully, False otherwise
        """
        preview_batch_dir = self.preview_dir / preview_id
        manifest_path = preview_batch_dir / "preview_manifest.json"
        
        if not manifest_path.exists():
            return False
        
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
            
            # Reconstruct preview entries
            self._previews[preview_id] = {}
            for entry_data in manifest.get("entries", []):
                # Convert ISO strings back to datetime
                entry_data['timestamp'] = datetime.fromisoformat(entry_data['timestamp'])
                if 'metadata' in entry_data and isinstance(entry_data['metadata'], dict):
                    if 'generation_timestamp' in entry_data['metadata']:
                        entry_data['metadata']['generation_timestamp'] = datetime.fromisoformat(
                            entry_data['metadata']['generation_timestamp']
                        )
                    if 'last_used' in entry_data['metadata'] and entry_data['metadata']['last_used']:
                        entry_data['metadata']['last_used'] = datetime.fromisoformat(
                            entry_data['metadata']['last_used']
                        )
                    # Reconstruct AssetMetadata
                    entry_data['metadata'] = AssetMetadata(**entry_data['metadata'])
                
                entry = PreviewEntry(**entry_data)
                self._previews[preview_id][entry.asset_id] = entry
            
            logger.debug(f"Loaded preview manifest: {manifest_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load preview manifest {manifest_path}: {e}")
            return False
    
    def load_all_previews(self) -> int:
        """
        Load all preview manifests from disk.
        
        Scans preview directory for existing preview batches and loads
        their manifests into memory.
        
        Returns:
            Number of preview batches loaded
        """
        if not self.preview_dir.exists():
            return 0
        
        loaded_count = 0
        
        for preview_batch_dir in self.preview_dir.iterdir():
            if not preview_batch_dir.is_dir():
                continue
            
            preview_id = preview_batch_dir.name
            if self._load_preview_manifest(preview_id):
                loaded_count += 1
        
        logger.info(f"Loaded {loaded_count} preview batches from disk")
        return loaded_count

    def _generate_gallery_html(self, preview_id: str, entries: List[PreviewEntry]) -> str:
        """
        Generate HTML gallery content.
        
        Args:
            preview_id: Preview batch ID
            entries: List of PreviewEntry objects
            
        Returns:
            HTML string
        """
        # Group entries by category
        by_category: Dict[str, List[PreviewEntry]] = {}
        for entry in entries:
            if entry.category not in by_category:
                by_category[entry.category] = []
            by_category[entry.category].append(entry)
        
        # Generate HTML
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UI Forge Preview - {preview_id}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #0f172a;
            color: #f1f5f9;
            padding: 2rem;
        }}
        
        .header {{
            margin-bottom: 2rem;
            border-bottom: 2px solid #334155;
            padding-bottom: 1rem;
        }}
        
        .header h1 {{
            font-size: 2rem;
            margin-bottom: 0.5rem;
            color: #3b82f6;
        }}
        
        .header .meta {{
            color: #94a3b8;
            font-size: 0.9rem;
        }}
        
        .filters {{
            display: flex;
            gap: 1rem;
            margin-bottom: 2rem;
            flex-wrap: wrap;
        }}
        
        .filter-btn {{
            padding: 0.5rem 1rem;
            background: #1e293b;
            border: 1px solid #334155;
            color: #f1f5f9;
            border-radius: 0.375rem;
            cursor: pointer;
            transition: all 0.2s;
        }}
        
        .filter-btn:hover {{
            background: #334155;
            border-color: #3b82f6;
        }}
        
        .filter-btn.active {{
            background: #3b82f6;
            border-color: #3b82f6;
        }}
        
        .category-section {{
            margin-bottom: 3rem;
        }}
        
        .category-title {{
            font-size: 1.5rem;
            margin-bottom: 1rem;
            color: #60a5fa;
            text-transform: capitalize;
        }}
        
        .gallery-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1.5rem;
        }}
        
        .asset-card {{
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 0.5rem;
            overflow: hidden;
            transition: all 0.2s;
        }}
        
        .asset-card:hover {{
            border-color: #3b82f6;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }}
        
        .asset-card.approved {{
            border-color: #10b981;
        }}
        
        .asset-card.rejected {{
            border-color: #ef4444;
        }}
        
        .asset-preview {{
            position: relative;
            width: 100%;
            height: 200px;
            background: 
                linear-gradient(45deg, #334155 25%, transparent 25%),
                linear-gradient(-45deg, #334155 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #334155 75%),
                linear-gradient(-45deg, transparent 75%, #334155 75%);
            background-size: 20px 20px;
            background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
            background-color: #1e293b;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }}
        
        .asset-preview img {{
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }}
        
        .asset-info {{
            padding: 1rem;
        }}
        
        .asset-name {{
            font-weight: 600;
            font-size: 1rem;
            margin-bottom: 0.5rem;
            color: #f1f5f9;
        }}
        
        .asset-meta {{
            font-size: 0.85rem;
            color: #94a3b8;
            margin-bottom: 0.5rem;
        }}
        
        .asset-meta-item {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.25rem;
        }}
        
        .asset-tags {{
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
            margin-bottom: 0.75rem;
        }}
        
        .tag {{
            padding: 0.125rem 0.5rem;
            background: #334155;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            color: #94a3b8;
        }}
        
        .asset-actions {{
            display: flex;
            gap: 0.5rem;
        }}
        
        .btn {{
            flex: 1;
            padding: 0.5rem;
            border: none;
            border-radius: 0.375rem;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
        }}
        
        .btn-approve {{
            background: #10b981;
            color: white;
        }}
        
        .btn-approve:hover {{
            background: #059669;
        }}
        
        .btn-reject {{
            background: #ef4444;
            color: white;
        }}
        
        .btn-reject:hover {{
            background: #dc2626;
        }}
        
        .status-badge {{
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }}
        
        .status-pending {{
            background: #fbbf24;
            color: #78350f;
        }}
        
        .status-approved {{
            background: #10b981;
            color: white;
        }}
        
        .status-rejected {{
            background: #ef4444;
            color: white;
        }}
        
        .feedback {{
            margin-top: 0.5rem;
            padding: 0.5rem;
            background: #334155;
            border-radius: 0.25rem;
            font-size: 0.85rem;
            color: #f1f5f9;
        }}
        
        .stats {{
            display: flex;
            gap: 2rem;
            margin-bottom: 2rem;
            padding: 1rem;
            background: #1e293b;
            border-radius: 0.5rem;
        }}
        
        .stat {{
            text-align: center;
        }}
        
        .stat-value {{
            font-size: 2rem;
            font-weight: 700;
            color: #3b82f6;
        }}
        
        .stat-label {{
            font-size: 0.85rem;
            color: #94a3b8;
            text-transform: uppercase;
        }}
        
        .keyboard-shortcuts {{
            margin-top: 2rem;
            padding: 1rem;
            background: #1e293b;
            border-radius: 0.5rem;
            font-size: 0.85rem;
            color: #94a3b8;
        }}
        
        .keyboard-shortcuts h3 {{
            color: #f1f5f9;
            margin-bottom: 0.5rem;
        }}
        
        .shortcut {{
            display: inline-block;
            padding: 0.125rem 0.5rem;
            background: #334155;
            border-radius: 0.25rem;
            font-family: monospace;
            margin-right: 0.5rem;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>UI Forge Preview Gallery</h1>
        <div class="meta">
            <strong>Preview ID:</strong> {preview_id} | 
            <strong>Generated:</strong> {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} |
            <strong>Total Assets:</strong> {len(entries)}
        </div>
    </div>
    
    <div class="stats">
        <div class="stat">
            <div class="stat-value">{sum(1 for e in entries if e.status == 'pending')}</div>
            <div class="stat-label">Pending</div>
        </div>
        <div class="stat">
            <div class="stat-value">{sum(1 for e in entries if e.status == 'approved')}</div>
            <div class="stat-label">Approved</div>
        </div>
        <div class="stat">
            <div class="stat-value">{sum(1 for e in entries if e.status == 'rejected')}</div>
            <div class="stat-label">Rejected</div>
        </div>
    </div>
    
    <div class="filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="pending">Pending</button>
        <button class="filter-btn" data-filter="approved">Approved</button>
        <button class="filter-btn" data-filter="rejected">Rejected</button>
"""
        
        # Add category filters
        for category in by_category.keys():
            html += f'        <button class="filter-btn" data-filter="category-{category}">{category.title()}</button>\n'
        
        html += "    </div>\n\n"
        
        # Generate asset cards by category
        for category, category_entries in by_category.items():
            html += f'    <div class="category-section" data-category="{category}">\n'
            html += f'        <h2 class="category-title">{category}</h2>\n'
            html += '        <div class="gallery-grid">\n'
            
            for entry in category_entries:
                # Get primary image path (prefer PNG)
                image_path = None
                for fmt in ['png', 'webp', 'jpeg', 'svg']:
                    if fmt in entry.output_paths:
                        image_path = Path(entry.output_paths[fmt]).relative_to(self.preview_dir / preview_id)
                        break
                
                if not image_path:
                    continue
                
                # Format file size
                file_size_kb = entry.metadata.file_size / 1024
                file_size_str = f"{file_size_kb:.1f} KB" if file_size_kb < 1024 else f"{file_size_kb/1024:.1f} MB"
                
                html += f'''            <div class="asset-card {entry.status}" data-status="{entry.status}" data-category="{category}" data-asset-id="{entry.asset_id}">
                <div class="asset-preview">
                    <img src="{image_path}" alt="{entry.template_name}">
                </div>
                <div class="asset-info">
                    <div class="asset-name">{entry.template_name}</div>
                    <div class="asset-meta">
                        <div class="asset-meta-item">
                            <span>Dimensions:</span>
                            <span>{entry.metadata.dimensions[0]}x{entry.metadata.dimensions[1]}</span>
                        </div>
                        <div class="asset-meta-item">
                            <span>Format:</span>
                            <span>{entry.metadata.format.upper()}</span>
                        </div>
                        <div class="asset-meta-item">
                            <span>Size:</span>
                            <span>{file_size_str}</span>
                        </div>
                        <div class="asset-meta-item">
                            <span>Generator:</span>
                            <span>{entry.metadata.generator}</span>
                        </div>
                    </div>
                    <div class="asset-tags">
'''
                
                for tag in entry.metadata.tags:
                    html += f'                        <span class="tag">{tag}</span>\n'
                
                html += f'''                    </div>
                    <div class="asset-meta-item">
                        <span>Status:</span>
                        <span class="status-badge status-{entry.status}">{entry.status}</span>
                    </div>
'''
                
                if entry.feedback:
                    html += f'                    <div class="feedback"><strong>Feedback:</strong> {entry.feedback}</div>\n'
                
                html += '''                    <div class="asset-actions">
                        <button class="btn btn-approve" onclick="approveAsset(this)">Approve</button>
                        <button class="btn btn-reject" onclick="rejectAsset(this)">Reject</button>
                    </div>
                </div>
            </div>
'''
            
            html += '        </div>\n'
            html += '    </div>\n\n'
        
        # Add JavaScript for interactivity
        html += '''    <div class="keyboard-shortcuts">
        <h3>Keyboard Shortcuts</h3>
        <p>
            <span class="shortcut">A</span> Approve selected |
            <span class="shortcut">R</span> Reject selected |
            <span class="shortcut">1-4</span> Filter by status |
            <span class="shortcut">Esc</span> Clear filters
        </p>
    </div>
    
    <script>
        // Filter functionality
        const filterBtns = document.querySelectorAll('.filter-btn');
        const assetCards = document.querySelectorAll('.asset-card');
        
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const filter = btn.dataset.filter;
                
                assetCards.forEach(card => {
                    if (filter === 'all') {
                        card.style.display = 'block';
                    } else if (filter.startsWith('category-')) {
                        const category = filter.replace('category-', '');
                        card.style.display = card.dataset.category === category ? 'block' : 'none';
                    } else {
                        card.style.display = card.dataset.status === filter ? 'block' : 'none';
                    }
                });
            });
        });
        
        // Approve/Reject functionality
        function approveAsset(btn) {
            const card = btn.closest('.asset-card');
            const assetId = card.dataset.assetId;
            
            card.classList.remove('rejected');
            card.classList.add('approved');
            card.dataset.status = 'approved';
            
            const statusBadge = card.querySelector('.status-badge');
            statusBadge.className = 'status-badge status-approved';
            statusBadge.textContent = 'approved';
            
            // Remove feedback if exists
            const feedback = card.querySelector('.feedback');
            if (feedback) feedback.remove();
            
            console.log('Approved:', assetId);
            updateStats();
        }
        
        function rejectAsset(btn) {
            const card = btn.closest('.asset-card');
            const assetId = card.dataset.assetId;
            
            const feedback = prompt('Rejection reason (optional):');
            
            card.classList.remove('approved');
            card.classList.add('rejected');
            card.dataset.status = 'rejected';
            
            const statusBadge = card.querySelector('.status-badge');
            statusBadge.className = 'status-badge status-rejected';
            statusBadge.textContent = 'rejected';
            
            // Add feedback if provided
            if (feedback) {
                let feedbackDiv = card.querySelector('.feedback');
                if (!feedbackDiv) {
                    feedbackDiv = document.createElement('div');
                    feedbackDiv.className = 'feedback';
                    card.querySelector('.asset-actions').before(feedbackDiv);
                }
                feedbackDiv.innerHTML = '<strong>Feedback:</strong> ' + feedback;
            }
            
            console.log('Rejected:', assetId, feedback);
            updateStats();
        }
        
        function updateStats() {
            const pending = document.querySelectorAll('.asset-card[data-status="pending"]').length;
            const approved = document.querySelectorAll('.asset-card[data-status="approved"]').length;
            const rejected = document.querySelectorAll('.asset-card[data-status="rejected"]').length;
            
            document.querySelectorAll('.stat-value')[0].textContent = pending;
            document.querySelectorAll('.stat-value')[1].textContent = approved;
            document.querySelectorAll('.stat-value')[2].textContent = rejected;
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key) {
                case '1':
                    filterBtns[0].click(); // All
                    break;
                case '2':
                    filterBtns[1].click(); // Pending
                    break;
                case '3':
                    filterBtns[2].click(); // Approved
                    break;
                case '4':
                    filterBtns[3].click(); // Rejected
                    break;
                case 'Escape':
                    filterBtns[0].click(); // All
                    break;
            }
        });
    </script>
</body>
</html>
'''
        
        return html


# ============================================================================
# Convenience Functions
# ============================================================================

def create_preview_manager(preview_dir: Optional[Path] = None) -> PreviewManager:
    """
    Create and initialize a PreviewManager instance.
    
    Args:
        preview_dir: Base preview directory
        
    Returns:
        PreviewManager instance
    """
    manager = PreviewManager(preview_dir=preview_dir)
    manager.load_all_previews()
    return manager

"""
UI Forge Library Manager

Manages the production asset library for approved UI assets.
Organizes assets by category, resolution, and theme with proper metadata
and indexing. Receives approved assets from preview workflow.

Requirements: 5.1-5.8
"""

import json
import shutil
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from dataclasses import dataclass, field, asdict

from models import AssetMetadata
from preview_manager import PreviewEntry


# Configure logging
logger = logging.getLogger(__name__)


# ============================================================================
# Library Data Models
# ============================================================================

@dataclass
class LibraryIndex:
    """Library index structure"""
    version: str
    generated: datetime
    total_assets: int
    categories: Dict[str, Any]  # category -> stats
    assets: List[Dict[str, str]]  # asset entries
    theme_groups: Dict[str, List[str]]  # theme_group -> asset_ids
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['generated'] = self.generated.isoformat()
        return data


# ============================================================================
# Library Manager
# ============================================================================

class LibraryManager:
    """
    Manages production asset library for approved UI assets.
    
    Features:
    - Organize assets by category, resolution, theme
    - Generate asset metadata files
    - Maintain library index JSON
    - Support semantic naming conventions
    - Track usage statistics
    - Search and query library
    
    Directory structure:
        library/
            icons/
                toolbar/
                    sculpt-clay-64.png
                    sculpt-clay-64-dark.png
                menu/
                status/
            brushes/
                sculpt/
                paint/
            patterns/
            cursors/
            overlays/
            metadata/
                icon-sculpt-clay-64.json
                icon-sculpt-clay-64-dark.json
            index.json
    """
    
    def __init__(self, library_dir: Optional[Path] = None):
        """
        Initialize LibraryManager.
        
        Args:
            library_dir: Base library directory (defaults to ./library/)
        """
        if library_dir is None:
            library_dir = Path(__file__).parent / "library"
        self.library_dir = Path(library_dir)
        self.library_dir.mkdir(parents=True, exist_ok=True)
        
        # Create subdirectories
        self.metadata_dir = self.library_dir / "metadata"
        self.metadata_dir.mkdir(exist_ok=True)
        
        # Track library assets
        self._assets: Dict[str, AssetMetadata] = {}  # asset_id -> metadata
        self._theme_groups: Dict[str, List[str]] = {}  # theme_group -> asset_ids
        
        logger.info(f"LibraryManager initialized with library_dir: {self.library_dir}")
    
    def add_to_library(
        self,
        preview_entry: PreviewEntry,
        subcategory: Optional[str] = None,
    ) -> str:
        """
        Add approved asset to production library.
        
        Moves asset files from preview to library with proper organization.
        Generates metadata file and updates library index.
        
        Args:
            preview_entry: PreviewEntry from approved preview
            subcategory: Optional subcategory for organization (e.g., 'toolbar', 'sculpt')
            
        Returns:
            Asset ID in library
            
        Raises:
            ValueError: If preview entry is not approved
            IOError: If file operations fail
        """
        if preview_entry.status != "approved":
            raise ValueError(f"Cannot add non-approved asset: {preview_entry.status}")
        
        logger.info(f"Adding asset '{preview_entry.template_name}' to library")
        
        # Determine library path
        category_dir = self.library_dir / preview_entry.category
        if subcategory:
            category_dir = category_dir / subcategory
        category_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate semantic name
        semantic_name = self._generate_semantic_name(preview_entry)
        
        # Move asset files to library
        library_paths = {}
        for format_name, source_path in preview_entry.output_paths.items():
            source = Path(source_path)
            if not source.exists():
                logger.warning(f"Source file not found: {source_path}")
                continue
            
            # Generate library filename
            file_ext = source.suffix
            dest_filename = f"{semantic_name}{file_ext}"
            dest = category_dir / dest_filename
            
            # Copy to library (preserve preview)
            shutil.copy2(source, dest)
            library_paths[format_name] = str(dest)
            logger.debug(f"Copied {source.name} to library as {dest_filename}")
        
        # Update metadata with library paths
        metadata = preview_entry.metadata
        asset_id = f"{preview_entry.category}-{semantic_name}"
        
        # Save metadata file
        self._save_metadata(asset_id, metadata)
        
        # Track in memory
        self._assets[asset_id] = metadata
        
        # Track theme groups
        if metadata.theme_group:
            if metadata.theme_group not in self._theme_groups:
                self._theme_groups[metadata.theme_group] = []
            self._theme_groups[metadata.theme_group].append(asset_id)
        
        # Regenerate library index
        self.regenerate_index()
        
        logger.info(f"Asset '{preview_entry.template_name}' added to library as '{asset_id}'")
        return asset_id
    
    def add_batch_to_library(
        self,
        preview_entries: List[PreviewEntry],
        subcategory: Optional[str] = None,
    ) -> List[str]:
        """
        Add multiple approved assets to library in batch.
        
        Args:
            preview_entries: List of approved PreviewEntry objects
            subcategory: Optional subcategory for organization
            
        Returns:
            List of asset IDs added to library
        """
        logger.info(f"Adding {len(preview_entries)} assets to library in batch")
        
        asset_ids = []
        for entry in preview_entries:
            try:
                asset_id = self.add_to_library(entry, subcategory)
                asset_ids.append(asset_id)
            except Exception as e:
                logger.error(f"Failed to add asset '{entry.template_name}': {e}")
        
        logger.info(f"Added {len(asset_ids)} assets to library")
        return asset_ids
    
    def regenerate_index(self) -> str:
        """
        Regenerate library index JSON file.
        
        Scans library directory and generates comprehensive index with
        category statistics, asset listings, and theme groups.
        
        Returns:
            Path to generated index.json
        """
        logger.info("Regenerating library index")
        
        # Gather category statistics
        categories = {}
        for category_dir in self.library_dir.iterdir():
            if not category_dir.is_dir() or category_dir.name in ['metadata', '.thumbs']:
                continue
            
            category_name = category_dir.name
            
            # Count assets and gather subcategories
            subcategories = set()
            resolutions = set()
            asset_count = 0
            
            for item in category_dir.rglob('*'):
                if item.is_file() and item.suffix in ['.png', '.svg', '.webp', '.jpeg', '.jpg']:
                    asset_count += 1
                    
                    # Extract subcategory
                    if item.parent != category_dir:
                        subcategories.add(item.parent.name)
                    
                    # Extract resolution from filename (e.g., "icon-64.png" -> 64)
                    try:
                        parts = item.stem.split('-')
                        for part in parts:
                            if part.isdigit():
                                resolutions.add(int(part))
                    except:
                        pass
            
            categories[category_name] = {
                "count": asset_count,
                "subcategories": sorted(list(subcategories)),
                "resolutions": sorted(list(resolutions)),
            }
        
        # Build asset list
        assets = []
        for asset_id, metadata in self._assets.items():
            # Find asset files
            asset_files = list(self.library_dir.rglob(f"*{asset_id.split('-', 1)[1]}*"))
            if not asset_files:
                continue
            
            primary_file = asset_files[0]
            relative_path = primary_file.relative_to(self.library_dir)
            
            # Check for thumbnail
            thumb_dir = primary_file.parent / ".thumbs"
            thumb_path = thumb_dir / f"{primary_file.stem}_thumb.png"
            thumb_relative = thumb_path.relative_to(self.library_dir) if thumb_path.exists() else None
            
            assets.append({
                "id": asset_id,
                "path": str(relative_path),
                "metadata_path": f"metadata/{asset_id}.json",
                "thumbnail": str(thumb_relative) if thumb_relative else None,
                "name": metadata.name,
                "category": metadata.category,
                "tags": metadata.tags,
                "dimensions": f"{metadata.dimensions[0]}x{metadata.dimensions[1]}",
                "format": metadata.format,
            })
        
        # Create index
        index = LibraryIndex(
            version="1.0",
            generated=datetime.now(),
            total_assets=len(assets),
            categories=categories,
            assets=assets,
            theme_groups=self._theme_groups,
        )
        
        # Save to JSON
        index_path = self.library_dir / "index.json"
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(index.to_dict(), f, indent=2)
        
        logger.info(f"Library index regenerated: {index_path} ({len(assets)} assets)")
        return str(index_path)
    
    def get_index(self) -> Dict[str, Any]:
        """
        Get library index.
        
        Returns:
            Library index dictionary
        """
        index_path = self.library_dir / "index.json"
        if not index_path.exists():
            self.regenerate_index()
        
        with open(index_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def search_assets(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        theme_variant: Optional[str] = None,
        min_resolution: Optional[int] = None,
        max_resolution: Optional[int] = None,
    ) -> List[AssetMetadata]:
        """
        Search library assets with filters.
        
        Args:
            query: Text search in name/description
            category: Filter by category
            tags: Filter by tags (any match)
            theme_variant: Filter by theme variant
            min_resolution: Minimum resolution (width or height)
            max_resolution: Maximum resolution (width or height)
            
        Returns:
            List of matching AssetMetadata objects
        """
        results = []
        
        for asset_id, metadata in self._assets.items():
            # Apply filters
            if category and metadata.category != category:
                continue
            
            if tags and not any(tag in metadata.tags for tag in tags):
                continue
            
            if theme_variant and metadata.theme_variant != theme_variant:
                continue
            
            if min_resolution:
                max_dim = max(metadata.dimensions)
                if max_dim < min_resolution:
                    continue
            
            if max_resolution:
                max_dim = max(metadata.dimensions)
                if max_dim > max_resolution:
                    continue
            
            if query:
                query_lower = query.lower()
                if query_lower not in metadata.name.lower() and query_lower not in metadata.description.lower():
                    continue
            
            results.append(metadata)
        
        return results
    
    def get_asset_metadata(self, asset_id: str) -> Optional[AssetMetadata]:
        """
        Get metadata for specific asset.
        
        Args:
            asset_id: Asset ID
            
        Returns:
            AssetMetadata or None if not found
        """
        return self._assets.get(asset_id)
    
    def update_usage_stats(self, asset_id: str) -> bool:
        """
        Update usage statistics for an asset.
        
        Args:
            asset_id: Asset ID
            
        Returns:
            True if updated, False if not found
        """
        if asset_id not in self._assets:
            return False
        
        metadata = self._assets[asset_id]
        metadata.usage_count += 1
        metadata.last_used = datetime.now()
        
        # Save updated metadata
        self._save_metadata(asset_id, metadata)
        
        logger.debug(f"Updated usage stats for '{asset_id}': {metadata.usage_count} uses")
        return True
    
    def get_theme_group(self, theme_group: str) -> List[AssetMetadata]:
        """
        Get all assets in a theme group.
        
        Args:
            theme_group: Theme group name
            
        Returns:
            List of AssetMetadata objects in the group
        """
        if theme_group not in self._theme_groups:
            return []
        
        asset_ids = self._theme_groups[theme_group]
        return [self._assets[aid] for aid in asset_ids if aid in self._assets]
    
    def list_categories(self) -> List[str]:
        """
        List all asset categories in library.
        
        Returns:
            List of category names
        """
        categories = set()
        for asset_id in self._assets:
            categories.add(self._assets[asset_id].category)
        return sorted(list(categories))
    
    def list_tags(self) -> List[str]:
        """
        List all unique tags in library.
        
        Returns:
            List of tag names
        """
        tags = set()
        for metadata in self._assets.values():
            tags.update(metadata.tags)
        return sorted(list(tags))
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get library statistics.
        
        Returns:
            Dictionary with library statistics
        """
        total_assets = len(self._assets)
        
        # Count by category
        by_category = {}
        for metadata in self._assets.values():
            by_category[metadata.category] = by_category.get(metadata.category, 0) + 1
        
        # Count by theme
        by_theme = {}
        for metadata in self._assets.values():
            if metadata.theme_variant:
                by_theme[metadata.theme_variant] = by_theme.get(metadata.theme_variant, 0) + 1
        
        # Count animated
        animated_count = sum(1 for m in self._assets.values() if m.is_animated)
        
        # Total file size
        total_size = sum(m.file_size for m in self._assets.values())
        
        return {
            "total_assets": total_assets,
            "by_category": by_category,
            "by_theme": by_theme,
            "animated_count": animated_count,
            "total_size_bytes": total_size,
            "total_size_mb": total_size / (1024 * 1024),
            "theme_groups": len(self._theme_groups),
        }
    
    def load_library(self) -> int:
        """
        Load library metadata from disk.
        
        Scans metadata directory and loads all asset metadata into memory.
        
        Returns:
            Number of assets loaded
        """
        if not self.metadata_dir.exists():
            return 0
        
        loaded_count = 0
        
        for metadata_file in self.metadata_dir.glob("*.json"):
            try:
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Convert ISO strings back to datetime
                if 'generation_timestamp' in data:
                    data['generation_timestamp'] = datetime.fromisoformat(data['generation_timestamp'])
                if 'last_used' in data and data['last_used']:
                    data['last_used'] = datetime.fromisoformat(data['last_used'])
                
                # Reconstruct AssetMetadata
                metadata = AssetMetadata(**data)
                asset_id = metadata_file.stem
                
                self._assets[asset_id] = metadata
                
                # Track theme groups
                if metadata.theme_group:
                    if metadata.theme_group not in self._theme_groups:
                        self._theme_groups[metadata.theme_group] = []
                    self._theme_groups[metadata.theme_group].append(asset_id)
                
                loaded_count += 1
                
            except Exception as e:
                logger.error(f"Failed to load metadata {metadata_file}: {e}")
        
        logger.info(f"Loaded {loaded_count} assets from library")
        return loaded_count
    
    # ========================================================================
    # Helper Methods
    # ========================================================================
    
    def _generate_semantic_name(self, preview_entry: PreviewEntry) -> str:
        """
        Generate semantic filename for asset.
        
        Format: {category}-{descriptive-name}-{resolution}[-{theme}]
        Example: sculpt-clay-64-dark
        
        Args:
            preview_entry: PreviewEntry object
            
        Returns:
            Semantic name string
        """
        metadata = preview_entry.metadata
        
        # Start with template name (already descriptive)
        base_name = preview_entry.template_name.lower().replace(' ', '-')
        
        # Add resolution
        resolution = max(metadata.dimensions)
        name_parts = [base_name, str(resolution)]
        
        # Add theme variant if present
        if metadata.theme_variant and metadata.theme_variant != "default":
            name_parts.append(metadata.theme_variant)
        
        return '-'.join(name_parts)
    
    def _save_metadata(self, asset_id: str, metadata: AssetMetadata) -> None:
        """
        Save asset metadata to JSON file.
        
        Args:
            asset_id: Asset ID
            metadata: AssetMetadata object
        """
        metadata_path = self.metadata_dir / f"{asset_id}.json"
        
        # Convert to dict
        data = asdict(metadata)
        
        # Convert datetime to ISO format
        if isinstance(data['generation_timestamp'], datetime):
            data['generation_timestamp'] = data['generation_timestamp'].isoformat()
        if data.get('last_used') and isinstance(data['last_used'], datetime):
            data['last_used'] = data['last_used'].isoformat()
        
        # Save to JSON
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        
        logger.debug(f"Saved metadata: {metadata_path}")


# ============================================================================
# Convenience Functions
# ============================================================================

def create_library_manager(library_dir: Optional[Path] = None) -> LibraryManager:
    """
    Create and initialize a LibraryManager instance.
    
    Args:
        library_dir: Base library directory
        
    Returns:
        LibraryManager instance
    """
    manager = LibraryManager(library_dir=library_dir)
    manager.load_library()
    return manager

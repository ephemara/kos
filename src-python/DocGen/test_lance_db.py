"""
Test script for LanceDB Manager

This script tests the basic functionality of the LanceDBManager class:
- Database initialization
- Embedding upsert operations
- Similarity search
- Single file retrieval
- File deletion
- Database statistics

Run with: python test_lance_db.py
"""

import logging
import numpy as np
from pathlib import Path
import sys

# Direct import to avoid __init__.py dependencies
sys.path.insert(0, str(Path(__file__).parent))
from core.lance_db import LanceDBManager, CodeEmbedding

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def test_lance_db():
    """Test LanceDB Manager functionality."""
    
    logger.info("=" * 60)
    logger.info("Testing LanceDB Manager")
    logger.info("=" * 60)
    
    # Initialize database
    db_path = Path(".lancedb_test")
    logger.info(f"\n1. Initializing database at {db_path}")
    
    db_manager = LanceDBManager(db_path)
    
    # Create test embeddings
    logger.info("\n2. Creating test embeddings")
    
    test_embeddings = [
        CodeEmbedding(
            file_path="crates/k-os-engine/src/gpu/compute.rs",
            content_hash="abc123",
            last_modified=1705334400.0,
            embedding=np.random.rand(384).astype(np.float32),
            file_type="rust",
            module_name="compute",
            chunk_index=0,
            metadata={"imports": ["wgpu", "nalgebra"]}
        ),
        CodeEmbedding(
            file_path="src-frontend/features/sculpting/KSculpt.tsx",
            content_hash="def456",
            last_modified=1705334500.0,
            embedding=np.random.rand(384).astype(np.float32),
            file_type="typescript",
            module_name="KSculpt",
            chunk_index=0,
            metadata={"imports": ["react", "three"]}
        ),
        CodeEmbedding(
            file_path="src-python/DocGen/core/embedding_engine.py",
            content_hash="ghi789",
            last_modified=1705334600.0,
            embedding=np.random.rand(384).astype(np.float32),
            file_type="python",
            module_name="embedding_engine",
            chunk_index=0,
            metadata={"imports": ["numpy", "onnxruntime"]}
        )
    ]
    
    # Upsert embeddings
    logger.info("\n3. Upserting embeddings")
    db_manager.upsert_embeddings(test_embeddings)
    
    # Get database statistics
    logger.info("\n4. Getting database statistics")
    stats = db_manager.get_stats()
    logger.info(f"Total embeddings: {stats['total_embeddings']}")
    logger.info(f"Index size: {stats['index_size_mb']} MB")
    logger.info(f"File types: {stats['file_types']}")
    
    # Test single file retrieval
    logger.info("\n5. Testing single file retrieval")
    file_path = "crates/k-os-engine/src/gpu/compute.rs"
    embedding = db_manager.get_by_path(file_path)
    
    if embedding:
        logger.info(f"✓ Retrieved embedding for: {file_path}")
        logger.info(f"  - Content hash: {embedding.content_hash}")
        logger.info(f"  - File type: {embedding.file_type}")
        logger.info(f"  - Module name: {embedding.module_name}")
    else:
        logger.error(f"✗ Failed to retrieve embedding for: {file_path}")
    
    # Test similarity search
    logger.info("\n6. Testing similarity search")
    query_embedding = np.random.rand(384).astype(np.float32)
    results = db_manager.search_similar(query_embedding, k=3)
    
    logger.info(f"Found {len(results)} similar embeddings:")
    for i, result in enumerate(results, 1):
        logger.info(
            f"  {i}. {result.file_path} "
            f"(similarity: {result.similarity_score:.4f})"
        )
    
    # Test upsert (update existing)
    logger.info("\n7. Testing upsert (update existing)")
    updated_embedding = CodeEmbedding(
        file_path="crates/k-os-engine/src/gpu/compute.rs",
        content_hash="abc123_updated",
        last_modified=1705334700.0,
        embedding=np.random.rand(384).astype(np.float32),
        file_type="rust",
        module_name="compute",
        chunk_index=0,
        metadata={"imports": ["wgpu", "nalgebra", "rayon"]}
    )
    
    db_manager.upsert_embeddings([updated_embedding])
    
    # Verify update
    updated = db_manager.get_by_path("crates/k-os-engine/src/gpu/compute.rs")
    if updated and updated.content_hash == "abc123_updated":
        logger.info("✓ Upsert (update) successful")
    else:
        logger.error("✗ Upsert (update) failed")
    
    # Test deletion
    logger.info("\n8. Testing deletion")
    db_manager.delete_by_path("src-python/DocGen/core/embedding_engine.py")
    
    # Verify deletion
    deleted = db_manager.get_by_path("src-python/DocGen/core/embedding_engine.py")
    if deleted is None:
        logger.info("✓ Deletion successful")
    else:
        logger.error("✗ Deletion failed")
    
    # Final statistics
    logger.info("\n9. Final database statistics")
    final_stats = db_manager.get_stats()
    logger.info(f"Total embeddings: {final_stats['total_embeddings']}")
    logger.info(f"Index size: {final_stats['index_size_mb']} MB")
    
    # Close database
    logger.info("\n10. Closing database")
    db_manager.close()
    
    logger.info("\n" + "=" * 60)
    logger.info("✓ All tests completed successfully!")
    logger.info("=" * 60)
    
    # Cleanup test database
    logger.info("\nCleaning up test database...")
    import shutil
    if db_path.exists():
        shutil.rmtree(db_path)
        logger.info("✓ Test database removed")


if __name__ == "__main__":
    try:
        test_lance_db()
    except Exception as e:
        logger.error(f"Test failed with error: {e}", exc_info=True)
        exit(1)

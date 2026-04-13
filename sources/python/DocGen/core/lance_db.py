"""
LanceDB Manager for DocGen System

This module provides the vector database layer using LanceDB for storing code embeddings
and performing semantic similarity searches. It handles embedding storage, retrieval,
and similarity search operations with efficient indexing.

Features:
- LanceDB vector database integration
- Code embedding storage with metadata
- Cosine similarity search
- File-based upsert operations (file_path as key)
- Database statistics and health monitoring
- Efficient ANN (Approximate Nearest Neighbor) search

Schema:
- file_path: Relative path from K_OS root (primary key)
- content_hash: SHA-256 hash of file content
- last_modified: Unix timestamp of last modification
- embedding: Vector embedding (384 dimensions for all-MiniLM-L6-v2)
- file_type: File extension (rust, typescript, python, wgsl, etc.)
- module_name: Extracted module/component name
- chunk_index: For large files split into chunks
- metadata: Additional context (imports, exports, etc.)
"""

import logging
from typing import List, Optional, Dict, Any
from pathlib import Path
from dataclasses import dataclass
import numpy as np

try:
    import lancedb
    from lancedb.pydantic import LanceModel, Vector
    from pydantic import Field
except ImportError as e:
    raise ImportError(
        f"Required dependencies not installed: {e}. "
        "Install with: pip install lancedb"
    )

logger = logging.getLogger(__name__)


class CodeEmbedding(LanceModel):
    """
    Schema for code embeddings stored in LanceDB.
    
    Attributes:
        file_path: Relative path from K_OS root (primary key)
        content_hash: SHA-256 hash of file content
        last_modified: Unix timestamp of last modification
        embedding: Vector embedding (384 dimensions)
        file_type: File extension (rust, typescript, python, etc.)
        module_name: Extracted module/component name
        chunk_index: For large files split into chunks (0 for single-chunk files)
        metadata: Additional context as JSON (imports, exports, etc.)
    """
    file_path: str = Field(description="Relative path from K_OS root")
    content_hash: str = Field(description="SHA-256 hash of file content")
    last_modified: float = Field(description="Unix timestamp of last modification")
    embedding: Vector(384) = Field(description="Embedding vector (384 dimensions)")
    file_type: str = Field(description="File extension (rust, typescript, python, etc.)")
    module_name: str = Field(default="", description="Extracted module/component name")
    chunk_index: int = Field(default=0, description="Chunk index for large files")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context")


@dataclass
class SearchResult:
    """
    Result from a similarity search operation.
    
    Attributes:
        file_path: Relative path from K_OS root
        similarity_score: Cosine similarity score (0.0 to 1.0)
        content_hash: SHA-256 hash of file content
        module_name: Extracted module/component name
        metadata: Additional context
    """
    file_path: str
    similarity_score: float
    content_hash: str
    module_name: str
    metadata: Dict[str, Any]


class LanceDBManager:
    """
    Manager for LanceDB vector database operations.
    
    Handles connection management, embedding storage, similarity search,
    and database statistics for the DocGen system.
    
    Attributes:
        db_path: Path to LanceDB database directory
        db: LanceDB connection
        table_name: Name of the embeddings table
        table: LanceDB table instance
    """
    
    DEFAULT_TABLE_NAME = "code_embeddings"
    
    def __init__(self, db_path: Path):
        """
        Initialize LanceDB connection.
        
        Args:
            db_path: Path to LanceDB database directory (e.g., .lancedb/)
        
        Raises:
            RuntimeError: If database initialization fails
        """
        self.db_path = Path(db_path)
        self.db = None
        self.table_name = self.DEFAULT_TABLE_NAME
        self.table = None
        
        logger.info(f"Initializing LanceDBManager: db_path={db_path}")
        
        # Initialize database connection
        self._initialize_db()
        
        logger.info(f"LanceDBManager initialized: table={self.table_name}")
    
    def _initialize_db(self) -> None:
        """
        Initialize LanceDB connection and create table if needed.
        
        Raises:
            RuntimeError: If database initialization fails
        """
        try:
            # Create database directory if it doesn't exist
            self.db_path.mkdir(parents=True, exist_ok=True)
            
            # Connect to LanceDB
            logger.info(f"Connecting to LanceDB at {self.db_path}")
            self.db = lancedb.connect(str(self.db_path))
            
            # Check if table exists
            existing_tables = self.db.table_names()
            
            if self.table_name in existing_tables:
                # Open existing table
                self.table = self.db.open_table(self.table_name)
                logger.info(f"✓ Opened existing table: {self.table_name}")
            else:
                # Create new table with schema
                logger.info(f"Creating new table: {self.table_name}")
                # Create empty table with schema (will be populated on first upsert)
                self.table = None  # Will be created on first upsert
                logger.info(f"✓ Table will be created on first upsert: {self.table_name}")
        
        except Exception as e:
            logger.error(f"Failed to initialize LanceDB: {e}")
            raise RuntimeError(f"Database initialization failed: {e}")
    
    def upsert_embeddings(self, embeddings: List[CodeEmbedding]) -> None:
        """
        Insert or update embeddings in the database.
        
        Uses file_path as the key for upsert operations. If an embedding with
        the same file_path exists, it will be updated; otherwise, a new entry
        is created.
        
        Args:
            embeddings: List of CodeEmbedding objects to upsert
        
        Raises:
            ValueError: If embeddings list is empty
            RuntimeError: If upsert operation fails
        """
        if not embeddings:
            raise ValueError("Cannot upsert empty embeddings list")
        
        logger.info(f"Upserting {len(embeddings)} embeddings")
        
        try:
            # Convert CodeEmbedding objects to dictionaries
            data = []
            for emb in embeddings:
                data.append({
                    'file_path': emb.file_path,
                    'content_hash': emb.content_hash,
                    'last_modified': emb.last_modified,
                    'embedding': emb.embedding,
                    'file_type': emb.file_type,
                    'module_name': emb.module_name,
                    'chunk_index': emb.chunk_index,
                    'metadata': emb.metadata
                })
            
            if self.table is None:
                # Create table on first upsert
                logger.info(f"Creating table {self.table_name} with {len(data)} initial records")
                self.table = self.db.create_table(
                    self.table_name,
                    data=data,
                    mode="overwrite"
                )
                logger.info(f"✓ Table created with {len(data)} records")
            else:
                # Upsert into existing table
                # LanceDB doesn't have native upsert, so we delete existing and insert new
                file_paths = [emb.file_path for emb in embeddings]
                
                # Delete existing entries for these file paths
                for file_path in file_paths:
                    try:
                        self.table.delete(f"file_path = '{file_path}'")
                    except Exception:
                        pass  # Ignore if entry doesn't exist
                
                # Add new entries
                self.table.add(data)
                logger.info(f"✓ Upserted {len(data)} embeddings")
        
        except Exception as e:
            logger.error(f"Failed to upsert embeddings: {e}")
            raise RuntimeError(f"Upsert operation failed: {e}")
    
    def search_similar(
        self,
        query_embedding: np.ndarray,
        k: int = 10,
        filter_expr: Optional[str] = None
    ) -> List[SearchResult]:
        """
        Perform vector similarity search using cosine similarity.
        
        Args:
            query_embedding: Query embedding vector (384 dimensions)
            k: Number of top results to return (default: 10)
            filter_expr: Optional SQL-like filter expression (e.g., "file_type = 'rust'")
        
        Returns:
            List of SearchResult objects sorted by similarity score (highest first)
        
        Raises:
            ValueError: If query_embedding has wrong dimensions
            RuntimeError: If search operation fails
        """
        if self.table is None:
            logger.warning("Table not initialized, returning empty results")
            return []
        
        # Validate embedding dimensions
        if query_embedding.shape != (384,):
            raise ValueError(
                f"Query embedding must have shape (384,), got {query_embedding.shape}"
            )
        
        logger.info(f"Searching for top {k} similar embeddings")
        
        try:
            # Perform vector search with cosine distance metric
            query = self.table.search(query_embedding, vector_column_name="embedding")
            query = query.metric("cosine")  # Use cosine similarity
            
            # Apply filter if provided
            if filter_expr:
                query = query.where(filter_expr)
            
            # Get top k results
            results = query.limit(k).to_list()
            
            # Convert to SearchResult objects
            search_results = []
            for result in results:
                # LanceDB returns distance for cosine metric
                # For cosine: distance is already similarity (0 to 2, where 0 = identical)
                # Convert to 0-1 range: similarity = 1 - (distance / 2)
                distance = result.get('_distance', 0.0)
                similarity_score = max(0.0, 1.0 - (distance / 2.0))
                
                search_results.append(SearchResult(
                    file_path=result['file_path'],
                    similarity_score=similarity_score,
                    content_hash=result['content_hash'],
                    module_name=result.get('module_name', ''),
                    metadata=result.get('metadata', {})
                ))
            
            logger.info(f"Found {len(search_results)} similar embeddings")
            
            return search_results
        
        except Exception as e:
            logger.error(f"Failed to search embeddings: {e}")
            raise RuntimeError(f"Search operation failed: {e}")
    
    def get_by_path(self, file_path: str) -> Optional[CodeEmbedding]:
        """
        Retrieve embedding by file path.
        
        Args:
            file_path: Relative path from K_OS root
        
        Returns:
            CodeEmbedding object if found, None otherwise
        
        Raises:
            RuntimeError: If retrieval operation fails
        """
        if self.table is None:
            logger.warning("Table not initialized, returning None")
            return None
        
        logger.info(f"Retrieving embedding for: {file_path}")
        
        try:
            # Query by file_path
            results = self.table.search().where(f"file_path = '{file_path}'").limit(1).to_list()
            
            if not results:
                logger.info(f"No embedding found for: {file_path}")
                return None
            
            result = results[0]
            
            # Convert to CodeEmbedding object
            embedding = CodeEmbedding(
                file_path=result['file_path'],
                content_hash=result['content_hash'],
                last_modified=result['last_modified'],
                embedding=result['embedding'],
                file_type=result['file_type'],
                module_name=result.get('module_name', ''),
                chunk_index=result.get('chunk_index', 0),
                metadata=result.get('metadata', {})
            )
            
            logger.info(f"✓ Retrieved embedding for: {file_path}")
            
            return embedding
        
        except Exception as e:
            logger.error(f"Failed to retrieve embedding: {e}")
            raise RuntimeError(f"Retrieval operation failed: {e}")
    
    def delete_by_path(self, file_path: str) -> None:
        """
        Delete embedding by file path.
        
        Used when files are deleted from the codebase to keep the database
        in sync with the actual file system.
        
        Args:
            file_path: Relative path from K_OS root
        
        Raises:
            RuntimeError: If deletion operation fails
        """
        if self.table is None:
            logger.warning("Table not initialized, nothing to delete")
            return
        
        logger.info(f"Deleting embedding for: {file_path}")
        
        try:
            # Delete by file_path
            self.table.delete(f"file_path = '{file_path}'")
            
            logger.info(f"✓ Deleted embedding for: {file_path}")
        
        except Exception as e:
            logger.error(f"Failed to delete embedding: {e}")
            raise RuntimeError(f"Deletion operation failed: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get database statistics.
        
        Returns:
            Dictionary with database statistics:
                - total_embeddings: Total number of embeddings in database
                - table_name: Name of the embeddings table
                - db_path: Path to database directory
                - index_size_mb: Approximate size of database in MB
                - file_types: Count of embeddings by file type
        
        Raises:
            RuntimeError: If stats retrieval fails
        """
        if self.table is None:
            return {
                'total_embeddings': 0,
                'table_name': self.table_name,
                'db_path': str(self.db_path),
                'index_size_mb': 0.0,
                'file_types': {}
            }
        
        logger.info("Retrieving database statistics")
        
        try:
            # Get total count
            total_count = self.table.count_rows()
            
            # Get database size
            db_size_bytes = sum(
                f.stat().st_size
                for f in self.db_path.rglob('*')
                if f.is_file()
            )
            db_size_mb = db_size_bytes / (1024 * 1024)
            
            # Get file type distribution
            file_types = {}
            try:
                # Query all records to count by file_type
                all_records = self.table.to_pandas()
                if not all_records.empty:
                    file_types = all_records['file_type'].value_counts().to_dict()
            except Exception as e:
                logger.warning(f"Could not retrieve file type distribution: {e}")
            
            stats = {
                'total_embeddings': total_count,
                'table_name': self.table_name,
                'db_path': str(self.db_path),
                'index_size_mb': round(db_size_mb, 2),
                'file_types': file_types
            }
            
            logger.info(
                f"Database stats: {total_count} embeddings, "
                f"{db_size_mb:.2f} MB"
            )
            
            return stats
        
        except Exception as e:
            logger.error(f"Failed to retrieve database statistics: {e}")
            raise RuntimeError(f"Stats retrieval failed: {e}")
    
    def close(self) -> None:
        """
        Close database connection and release resources.
        
        Should be called when done with the database to ensure proper cleanup.
        """
        logger.info("Closing LanceDB connection")
        
        # LanceDB connections are automatically managed, but we can clear references
        self.table = None
        self.db = None
        
        logger.info("✓ LanceDB connection closed")
    
    def __del__(self):
        """Destructor to ensure database connection is closed."""
        try:
            self.close()
        except Exception:
            pass  # Ignore errors during cleanup

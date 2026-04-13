"""
DocGen Core Module

This module contains the core components for the Automated README Generation System.
"""

__version__ = "0.1.0"

from .file_access import SandboxedFileAccess, SecurityError
from .llm_client import LLMClient, LLMResponse
from .lance_db import LanceDBManager, CodeEmbedding, SearchResult
from .change_detector import ChangeDetector, ChangeReport, ChangeType
from .cost_tracker import CostTracker, CostEntry
from .quality_metrics import QualityMetrics, QualityMetricsCalculator, QualityReporter
from .readme_generator import READMEGenerator, DirectoryContext
from .repo_map_generator import RepoMapGenerator, SemanticCluster, EntryPoint

# Import EmbeddingEngine optionally (requires heavy dependencies)
try:
    from .embedding_engine import EmbeddingEngine
except ImportError:
    EmbeddingEngine = None

__all__ = [
    'SandboxedFileAccess',
    'SecurityError',
    'LLMClient',
    'LLMResponse',
    'EmbeddingEngine',
    'LanceDBManager',
    'CodeEmbedding',
    'SearchResult',
    'ChangeDetector',
    'ChangeReport',
    'ChangeType',
    'CostTracker',
    'CostEntry',
    'QualityMetrics',
    'QualityMetricsCalculator',
    'QualityReporter',
    'READMEGenerator',
    'DirectoryContext',
    'RepoMapGenerator',
    'SemanticCluster',
    'EntryPoint',
]

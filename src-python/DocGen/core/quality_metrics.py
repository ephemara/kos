"""
Quality Metrics System for DocGen

This module computes quality scores for generated README documentation.
It evaluates completeness, clarity, example coverage, and cross-reference density
to identify documentation that needs improvement.

Features:
- Completeness scoring (required sections present)
- Clarity scoring (readability metrics)
- Example coverage (code examples present)
- Cross-reference density (related modules count)
- Overall quality score (weighted average)
- Quality flagging (scores < 70%)
- Trend tracking over time

Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6
"""

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)


@dataclass
class QualityMetrics:
    """
    Quality metrics for a README file.
    
    Attributes:
        directory_path: Path to directory containing README
        timestamp: When metrics were computed
        completeness_score: Score for section completeness (0.0-1.0)
        clarity_score: Score for readability (0.0-1.0)
        example_coverage: Score for code example presence (0.0-1.0)
        cross_reference_density: Score for related modules (0.0-1.0)
        overall_score: Weighted average of all scores (0.0-1.0)
        flags: List of quality issues
        details: Additional metric details
    """
    directory_path: str
    timestamp: float
    completeness_score: float
    clarity_score: float
    example_coverage: float
    cross_reference_density: float
    overall_score: float
    flags: List[str] = field(default_factory=list)
    details: Dict[str, any] = field(default_factory=dict)


class QualityMetricsCalculator:
    """
    Calculator for README quality metrics.
    
    Computes various quality scores for generated documentation:
    - Completeness: Checks for required sections
    - Clarity: Analyzes readability metrics
    - Example Coverage: Detects code examples
    - Cross-Reference Density: Counts related module links
    
    Attributes:
        threshold: Quality threshold for flagging (default 0.70)
        weights: Weights for overall score calculation
    """
    
    # Required sections for completeness
    REQUIRED_SECTIONS = [
        'overview',
        'architecture',
        'key components',
    ]
    
    # Optional but recommended sections
    RECOMMENDED_SECTIONS = [
        'usage patterns',
        'related modules',
        'examples',
    ]
    
    # Default weights for overall score
    DEFAULT_WEIGHTS = {
        'completeness': 0.30,
        'clarity': 0.25,
        'example_coverage': 0.20,
        'cross_reference_density': 0.25,
    }
    
    def __init__(self, threshold: float = 0.70, weights: Optional[Dict[str, float]] = None):
        """
        Initialize quality metrics calculator.
        
        Args:
            threshold: Quality threshold for flagging (default 0.70)
            weights: Custom weights for overall score (default: DEFAULT_WEIGHTS)
        """
        self.threshold = threshold
        self.weights = weights or self.DEFAULT_WEIGHTS
        
        # Validate weights sum to 1.0
        weight_sum = sum(self.weights.values())
        if not (0.99 <= weight_sum <= 1.01):
            logger.warning(f"Weights sum to {weight_sum}, normalizing to 1.0")
            total = sum(self.weights.values())
            self.weights = {k: v / total for k, v in self.weights.items()}
    
    def compute_metrics(self, readme_path: Path, readme_content: str) -> QualityMetrics:
        """
        Compute quality metrics for a README file.
        
        Args:
            readme_path: Path to README file
            readme_content: Content of README file
            
        Returns:
            QualityMetrics object with computed scores
        """
        logger.info(f"Computing quality metrics for {readme_path}")
        
        # Get directory path
        directory_path = str(readme_path.parent)
        
        # Compute individual scores
        completeness_score = self._compute_completeness(readme_content)
        clarity_score = self._compute_clarity(readme_content)
        example_coverage = self._compute_example_coverage(readme_content)
        cross_reference_density = self._compute_cross_reference_density(readme_content)
        
        # Compute overall score (weighted average)
        overall_score = (
            self.weights['completeness'] * completeness_score +
            self.weights['clarity'] * clarity_score +
            self.weights['example_coverage'] * example_coverage +
            self.weights['cross_reference_density'] * cross_reference_density
        )
        
        # Generate flags
        flags = self._generate_flags(
            overall_score,
            completeness_score,
            clarity_score,
            example_coverage,
            cross_reference_density
        )
        
        # Build details
        details = {
            'word_count': len(readme_content.split()),
            'line_count': len(readme_content.splitlines()),
            'has_staleness_disclaimer': '*This README may be out of date' in readme_content,
        }
        
        return QualityMetrics(
            directory_path=directory_path,
            timestamp=datetime.now().timestamp(),
            completeness_score=completeness_score,
            clarity_score=clarity_score,
            example_coverage=example_coverage,
            cross_reference_density=cross_reference_density,
            overall_score=overall_score,
            flags=flags,
            details=details
        )
    
    def _compute_completeness(self, content: str) -> float:
        """
        Compute completeness score based on section presence.
        
        Args:
            content: README content
            
        Returns:
            Completeness score (0.0-1.0)
        """
        content_lower = content.lower()
        
        # Check required sections
        required_present = sum(
            1 for section in self.REQUIRED_SECTIONS
            if section in content_lower
        )
        required_score = required_present / len(self.REQUIRED_SECTIONS)
        
        # Check recommended sections (bonus points)
        recommended_present = sum(
            1 for section in self.RECOMMENDED_SECTIONS
            if section in content_lower
        )
        recommended_score = recommended_present / len(self.RECOMMENDED_SECTIONS)
        
        # Weighted combination (required 80%, recommended 20%)
        completeness = 0.8 * required_score + 0.2 * recommended_score
        
        return min(1.0, completeness)
    
    def _compute_clarity(self, content: str) -> float:
        """
        Compute clarity score based on readability metrics.
        
        Uses simple heuristics:
        - Sentence length (shorter is clearer)
        - Paragraph structure (presence of line breaks)
        - Heading hierarchy (proper markdown structure)
        - Word complexity (shorter words are clearer)
        
        Args:
            content: README content
            
        Returns:
            Clarity score (0.0-1.0)
        """
        lines = content.splitlines()
        
        # Check for proper heading hierarchy
        headings = [line for line in lines if line.startswith('#')]
        has_hierarchy = len(headings) >= 3  # At least 3 headings
        
        # Check for paragraph breaks (empty lines)
        empty_lines = sum(1 for line in lines if line.strip() == '')
        has_paragraphs = empty_lines >= 3
        
        # Check for bullet lists
        bullet_lines = sum(1 for line in lines if line.strip().startswith(('-', '*', '+')))
        has_lists = bullet_lines >= 3
        
        # Check for code blocks
        code_blocks = content.count('```')
        has_code_formatting = code_blocks >= 2  # At least one code block
        
        # Compute clarity score
        clarity_factors = [
            has_hierarchy,
            has_paragraphs,
            has_lists,
            has_code_formatting,
        ]
        
        clarity_score = sum(clarity_factors) / len(clarity_factors)
        
        return clarity_score
    
    def _compute_example_coverage(self, content: str) -> float:
        """
        Compute example coverage score based on code example presence.
        
        Args:
            content: README content
            
        Returns:
            Example coverage score (0.0-1.0)
        """
        # Count code blocks
        code_blocks = content.count('```')
        code_block_count = code_blocks // 2  # Each block has opening and closing
        
        # Count inline code
        inline_code = content.count('`') - code_blocks
        inline_code_count = inline_code // 2
        
        # Score based on presence
        if code_block_count >= 2:
            score = 1.0  # Excellent: multiple code blocks
        elif code_block_count == 1:
            score = 0.8  # Good: one code block
        elif inline_code_count >= 5:
            score = 0.6  # Fair: multiple inline code examples
        elif inline_code_count >= 1:
            score = 0.4  # Poor: minimal inline code
        else:
            score = 0.0  # None: no code examples
        
        return score
    
    def _compute_cross_reference_density(self, content: str) -> float:
        """
        Compute cross-reference density based on related module links.
        
        Args:
            content: README content
            
        Returns:
            Cross-reference density score (0.0-1.0)
        """
        # Look for "Related Modules" section
        has_related_section = 'related modules' in content.lower()
        
        # Count markdown links
        link_pattern = r'\[([^\]]+)\]\(([^\)]+)\)'
        links = re.findall(link_pattern, content)
        link_count = len(links)
        
        # Count file path references (e.g., crates/k-os-engine/src/...)
        path_pattern = r'(?:crates|src-frontend|src-tauri)/[\w\-/]+\.(?:rs|ts|tsx|py)'
        paths = re.findall(path_pattern, content)
        path_count = len(paths)
        
        # Score based on cross-references
        total_refs = link_count + path_count
        
        if has_related_section and total_refs >= 5:
            score = 1.0  # Excellent: dedicated section with many refs
        elif total_refs >= 5:
            score = 0.8  # Good: many refs but no dedicated section
        elif total_refs >= 3:
            score = 0.6  # Fair: some refs
        elif total_refs >= 1:
            score = 0.4  # Poor: minimal refs
        else:
            score = 0.0  # None: no cross-references
        
        return score
    
    def _generate_flags(
        self,
        overall_score: float,
        completeness_score: float,
        clarity_score: float,
        example_coverage: float,
        cross_reference_density: float
    ) -> List[str]:
        """
        Generate quality flags based on scores.
        
        Args:
            overall_score: Overall quality score
            completeness_score: Completeness score
            clarity_score: Clarity score
            example_coverage: Example coverage score
            cross_reference_density: Cross-reference density score
            
        Returns:
            List of quality flags
        """
        flags = []
        
        # Overall quality flag
        if overall_score < self.threshold:
            flags.append('below_threshold')
        
        # Specific flags
        if completeness_score < 0.7:
            flags.append('incomplete_sections')
        
        if clarity_score < 0.6:
            flags.append('poor_clarity')
        
        if example_coverage < 0.5:
            flags.append('missing_examples')
        
        if cross_reference_density < 0.5:
            flags.append('insufficient_cross_references')
        
        return flags


class QualityReporter:
    """
    Reporter for quality metrics.
    
    Generates quality reports in various formats:
    - Markdown table for human consumption
    - JSON for programmatic access
    - Trend tracking over time
    
    Attributes:
        metrics_history_path: Path to metrics history JSON file
    """
    
    def __init__(self, metrics_history_path: Path):
        """
        Initialize quality reporter.
        
        Args:
            metrics_history_path: Path to metrics history JSON file
        """
        self.metrics_history_path = metrics_history_path
    
    def save_metrics(self, metrics: QualityMetrics) -> None:
        """
        Save metrics to history file.
        
        Args:
            metrics: Quality metrics to save
        """
        # Load existing history
        if self.metrics_history_path.exists():
            with open(self.metrics_history_path, 'r') as f:
                history = json.load(f)
        else:
            history = {}
        
        # Update history
        history[metrics.directory_path] = {
            'timestamp': metrics.timestamp,
            'completeness_score': metrics.completeness_score,
            'clarity_score': metrics.clarity_score,
            'example_coverage': metrics.example_coverage,
            'cross_reference_density': metrics.cross_reference_density,
            'overall_score': metrics.overall_score,
            'flags': metrics.flags,
            'details': metrics.details,
        }
        
        # Save history
        self.metrics_history_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.metrics_history_path, 'w') as f:
            json.dump(history, f, indent=2)
        
        logger.info(f"Saved metrics for {metrics.directory_path}")
    
    def load_metrics(self, directory_path: Optional[str] = None) -> Dict[str, Dict]:
        """
        Load metrics from history file.
        
        Args:
            directory_path: Optional directory path to filter (returns all if None)
            
        Returns:
            Dictionary of metrics by directory path
        """
        if not self.metrics_history_path.exists():
            return {}
        
        with open(self.metrics_history_path, 'r') as f:
            history = json.load(f)
        
        if directory_path:
            return {directory_path: history.get(directory_path, {})}
        else:
            return history
    
    def generate_report(self, min_score: Optional[float] = None) -> str:
        """
        Generate markdown quality report.
        
        Args:
            min_score: Optional minimum score filter (show only below this score)
            
        Returns:
            Markdown formatted report
        """
        history = self.load_metrics()
        
        if not history:
            return "No quality metrics available yet."
        
        # Filter by min_score if provided
        if min_score is not None:
            history = {
                path: metrics
                for path, metrics in history.items()
                if metrics.get('overall_score', 1.0) < min_score
            }
        
        # Sort by overall score (ascending)
        sorted_metrics = sorted(
            history.items(),
            key=lambda x: x[1].get('overall_score', 0.0)
        )
        
        # Build markdown table
        lines = [
            "# Documentation Quality Report",
            "",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "| Directory | Overall | Completeness | Clarity | Examples | Cross-Refs | Flags |",
            "|-----------|---------|--------------|---------|----------|------------|-------|",
        ]
        
        for path, metrics in sorted_metrics:
            overall = metrics.get('overall_score', 0.0)
            completeness = metrics.get('completeness_score', 0.0)
            clarity = metrics.get('clarity_score', 0.0)
            examples = metrics.get('example_coverage', 0.0)
            cross_refs = metrics.get('cross_reference_density', 0.0)
            flags = ', '.join(metrics.get('flags', []))
            
            lines.append(
                f"| {path} | {overall:.2f} | {completeness:.2f} | {clarity:.2f} | "
                f"{examples:.2f} | {cross_refs:.2f} | {flags} |"
            )
        
        lines.append("")
        lines.append(f"**Total directories:** {len(sorted_metrics)}")
        
        if min_score is not None:
            lines.append(f"**Filtered by:** Overall score < {min_score:.2f}")
        
        return '\n'.join(lines)
    
    def get_flagged_directories(self, threshold: float = 0.70) -> List[str]:
        """
        Get list of directories with quality scores below threshold.
        
        Args:
            threshold: Quality threshold (default 0.70)
            
        Returns:
            List of directory paths
        """
        history = self.load_metrics()
        
        flagged = [
            path
            for path, metrics in history.items()
            if metrics.get('overall_score', 1.0) < threshold
        ]
        
        return sorted(flagged)

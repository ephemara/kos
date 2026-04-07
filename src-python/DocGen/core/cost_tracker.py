"""
Cost Tracking and Budget Management for DocGen System

This module provides cost tracking, budget enforcement, and cost logging functionality
for the README generation system. It tracks token usage and costs per request, displays
estimated costs, enforces budget limits, and logs all costs to cost_log.json.

Features:
- Real-time cost tracking during generation
- Budget limit enforcement (stops processing when limit reached)
- Cost estimation before starting batch operations
- Cost warnings when approaching limits
- Historical cost logging to cost_log.json
- Per-run and cumulative cost tracking

Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6
"""

import json
import logging
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


@dataclass
class CostEntry:
    """
    Single cost entry for a README generation run.
    
    Attributes:
        timestamp: ISO format timestamp of the run
        command: Command line used for the run
        provider: LLM provider (openrouter/gemini)
        model: Model identifier
        prompt_tokens: Total prompt tokens used
        completion_tokens: Total completion tokens used
        cost_usd: Total cost in USD
        directories_processed: Number of directories processed
        readmes_generated: Number of READMEs successfully generated
    """
    timestamp: str
    command: str
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    directories_processed: int
    readmes_generated: int


class CostTracker:
    """
    Tracks costs and enforces budget limits during README generation.
    
    This class provides real-time cost tracking, budget enforcement, and
    historical cost logging. It integrates with LLMClient to track token
    usage and costs, and can stop processing when budget limits are reached.
    
    Attributes:
        max_cost_usd: Maximum cost limit for this run (None = no limit)
        warn_threshold_usd: Cost threshold for warnings
        cost_log_path: Path to cost_log.json file
        current_cost: Current accumulated cost for this run
        start_time: Start time of the run
        provider: LLM provider being used
        model: Model being used
        command: Command line string
    """
    
    def __init__(
        self,
        cost_log_path: Path,
        max_cost_usd: Optional[float] = None,
        warn_threshold_usd: Optional[float] = None,
        provider: str = "openrouter",
        model: str = "unknown",
        command: str = ""
    ):
        """
        Initialize the cost tracker.
        
        Args:
            cost_log_path: Path to cost_log.json file
            max_cost_usd: Maximum cost limit (None = no limit)
            warn_threshold_usd: Warning threshold (None = no warnings)
            provider: LLM provider name
            model: Model identifier
            command: Command line string for logging
        """
        self.cost_log_path = cost_log_path
        self.max_cost_usd = max_cost_usd
        self.warn_threshold_usd = warn_threshold_usd
        self.provider = provider
        self.model = model
        self.command = command
        
        # Current run tracking
        self.current_cost = 0.0
        self.start_time = datetime.now()
        self.directories_processed = 0
        self.readmes_generated = 0
        self.warned = False  # Track if warning already shown
        
        logger.info(
            f"CostTracker initialized: max_cost=${max_cost_usd}, "
            f"warn_threshold=${warn_threshold_usd}"
        )
    
    def add_cost(self, cost_usd: float) -> bool:
        """
        Add cost from a single LLM request.
        
        Checks if adding this cost would exceed the budget limit.
        Issues warnings when approaching the threshold.
        
        Args:
            cost_usd: Cost of the request in USD
        
        Returns:
            True if cost was added and processing can continue,
            False if budget limit would be exceeded
        
        Requirements: 19.1, 19.4
        """
        # Check if adding this cost would exceed limit
        if self.max_cost_usd is not None:
            if self.current_cost + cost_usd > self.max_cost_usd:
                logger.warning(
                    f"⚠️  Budget limit reached! Current: ${self.current_cost:.4f}, "
                    f"Limit: ${self.max_cost_usd:.4f}"
                )
                return False
        
        # Add cost
        self.current_cost += cost_usd
        
        # Check warning threshold
        if (
            self.warn_threshold_usd is not None
            and not self.warned
            and self.current_cost >= self.warn_threshold_usd
        ):
            self.warned = True
            logger.warning(
                f"⚠️  Cost warning: ${self.current_cost:.4f} "
                f"(threshold: ${self.warn_threshold_usd:.4f})"
            )
            
            if self.max_cost_usd is not None:
                remaining = self.max_cost_usd - self.current_cost
                logger.warning(f"   Remaining budget: ${remaining:.4f}")
        
        return True
    
    def increment_directories(self):
        """Increment the count of directories processed."""
        self.directories_processed += 1
    
    def increment_readmes(self):
        """Increment the count of READMEs generated."""
        self.readmes_generated += 1
    
    def get_current_cost(self) -> float:
        """
        Get current accumulated cost.
        
        Returns:
            Current cost in USD
        """
        return self.current_cost
    
    def get_remaining_budget(self) -> Optional[float]:
        """
        Get remaining budget.
        
        Returns:
            Remaining budget in USD, or None if no limit set
        """
        if self.max_cost_usd is None:
            return None
        return max(0.0, self.max_cost_usd - self.current_cost)
    
    def estimate_cost(
        self,
        num_directories: int,
        avg_tokens_per_dir: int = 5000
    ) -> float:
        """
        Estimate total cost for processing directories.
        
        Uses a simple heuristic based on average tokens per directory.
        Actual costs may vary based on directory complexity.
        
        Args:
            num_directories: Number of directories to process
            avg_tokens_per_dir: Average total tokens per directory (default: 5000)
        
        Returns:
            Estimated cost in USD
        
        Requirements: 19.6
        """
        # Rough estimate: 60% prompt tokens, 40% completion tokens
        prompt_tokens = int(num_directories * avg_tokens_per_dir * 0.6)
        completion_tokens = int(num_directories * avg_tokens_per_dir * 0.4)
        
        # Use default pricing (can be overridden by LLMClient)
        # Default: ~$0.30 per 1M prompt tokens, ~$1.50 per 1M completion tokens
        prompt_cost = prompt_tokens / 3333333
        completion_cost = completion_tokens / 666666
        
        return prompt_cost + completion_cost
    
    def display_estimate(self, num_directories: int):
        """
        Display cost estimate before starting.
        
        Shows estimated cost and compares to budget limit if set.
        
        Args:
            num_directories: Number of directories to process
        
        Requirements: 19.6
        """
        estimated_cost = self.estimate_cost(num_directories)
        
        logger.info("=" * 60)
        logger.info("COST ESTIMATE")
        logger.info("=" * 60)
        logger.info(f"Directories to process: {num_directories}")
        logger.info(f"Estimated cost:         ${estimated_cost:.4f}")
        
        if self.max_cost_usd is not None:
            logger.info(f"Budget limit:           ${self.max_cost_usd:.4f}")
            
            if estimated_cost > self.max_cost_usd:
                logger.warning(
                    f"⚠️  WARNING: Estimated cost exceeds budget limit!"
                )
                logger.warning(
                    f"   Processing may stop before completion."
                )
            else:
                remaining = self.max_cost_usd - estimated_cost
                logger.info(f"Estimated remaining:    ${remaining:.4f}")
        
        if self.warn_threshold_usd is not None:
            logger.info(f"Warning threshold:      ${self.warn_threshold_usd:.4f}")
        
        logger.info("=" * 60 + "\n")
    
    def save_cost_log(self, prompt_tokens: int, completion_tokens: int):
        """
        Save cost entry to cost_log.json.
        
        Appends the current run's cost data to the log file and updates
        cumulative totals.
        
        Args:
            prompt_tokens: Total prompt tokens used in this run
            completion_tokens: Total completion tokens used in this run
        
        Requirements: 19.5
        """
        try:
            # Load existing log or create new one
            if self.cost_log_path.exists():
                with open(self.cost_log_path, 'r', encoding='utf-8') as f:
                    log_data = json.load(f)
            else:
                log_data = {
                    'runs': [],
                    'cumulative_cost_usd': 0.0,
                    'last_reset': datetime.now().isoformat()
                }
            
            # Create cost entry for this run
            entry = CostEntry(
                timestamp=self.start_time.isoformat(),
                command=self.command,
                provider=self.provider,
                model=self.model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                cost_usd=self.current_cost,
                directories_processed=self.directories_processed,
                readmes_generated=self.readmes_generated
            )
            
            # Add to runs list
            log_data['runs'].append(asdict(entry))
            
            # Update cumulative cost
            log_data['cumulative_cost_usd'] += self.current_cost
            
            # Save log file
            self.cost_log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cost_log_path, 'w', encoding='utf-8') as f:
                json.dump(log_data, f, indent=2)
            
            logger.info(f"Cost log saved to {self.cost_log_path}")
            logger.info(
                f"Cumulative cost: ${log_data['cumulative_cost_usd']:.4f}"
            )
        
        except Exception as e:
            logger.error(f"Failed to save cost log: {e}")
    
    def display_final_report(self):
        """
        Display final cost report at end of run.
        
        Shows total cost, directories processed, and budget status.
        """
        logger.info("\n" + "=" * 60)
        logger.info("COST REPORT")
        logger.info("=" * 60)
        logger.info(f"Total cost:             ${self.current_cost:.4f}")
        logger.info(f"Directories processed:  {self.directories_processed}")
        logger.info(f"READMEs generated:      {self.readmes_generated}")
        
        if self.max_cost_usd is not None:
            remaining = self.max_cost_usd - self.current_cost
            logger.info(f"Budget limit:           ${self.max_cost_usd:.4f}")
            logger.info(f"Remaining budget:       ${remaining:.4f}")
            
            if remaining < 0:
                logger.warning("⚠️  Budget limit exceeded!")
        
        logger.info("=" * 60 + "\n")
    
    @staticmethod
    def load_cost_history(cost_log_path: Path) -> Dict[str, Any]:
        """
        Load cost history from cost_log.json.
        
        Args:
            cost_log_path: Path to cost_log.json
        
        Returns:
            Dictionary with cost history data
        """
        if not cost_log_path.exists():
            return {
                'runs': [],
                'cumulative_cost_usd': 0.0,
                'last_reset': None
            }
        
        try:
            with open(cost_log_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load cost history: {e}")
            return {
                'runs': [],
                'cumulative_cost_usd': 0.0,
                'last_reset': None
            }
    
    @staticmethod
    def reset_cost_history(cost_log_path: Path):
        """
        Reset cost history (start fresh tracking).
        
        Args:
            cost_log_path: Path to cost_log.json
        """
        log_data = {
            'runs': [],
            'cumulative_cost_usd': 0.0,
            'last_reset': datetime.now().isoformat()
        }
        
        cost_log_path.parent.mkdir(parents=True, exist_ok=True)
        with open(cost_log_path, 'w', encoding='utf-8') as f:
            json.dump(log_data, f, indent=2)
        
        logger.info(f"Cost history reset: {cost_log_path}")

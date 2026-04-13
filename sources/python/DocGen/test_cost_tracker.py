#!/usr/bin/env python3
"""
Unit tests for CostTracker module

Tests cost tracking, budget enforcement, cost estimation, and logging functionality.
"""

import json
import tempfile
from pathlib import Path
from datetime import datetime

from core.cost_tracker import CostTracker, CostEntry


def test_cost_tracker_initialization():
    """Test CostTracker initialization."""
    with tempfile.TemporaryDirectory() as tmpdir:
        cost_log_path = Path(tmpdir) / "cost_log.json"
        
        tracker = CostTracker(
            cost_log_path=cost_log_path,
            max_cost_usd=5.0,
            warn_threshold_usd=3.0,
            provider="openrouter",
            model="claude-3.5-sonnet",
            command="generate.py --path crates/"
        )
        
        assert tracker.max_cost_usd == 5.0
        assert tracker.warn_threshold_usd == 3.0
        assert tracker.current_cost == 0.0
        assert tracker.directories_processed == 0
        assert tracker.readmes_generated == 0
        print("✓ Initialization test passed")


def test_add_cost_within_budget():
    """Test adding costs within budget limit."""
    with tempfile.TemporaryDirectory() as tmpdir:
        cost_log_path = Path(tmpdir) / "cost_log.json"
        
        tracker = CostTracker(
            cost_log_path=cost_log_path,
            max_cost_usd=5.0,
            warn_threshold_usd=3.0
        )
        
        # Add cost within budget
        result = tracker.add_cost(1.5)
        assert result is True
        assert tracker.current_cost == 1.5
        
        # Add another cost, still within budget
        result = tracker.add_cost(1.0)
        assert result is True
        assert tracker.current_cost == 2.5
        
        print("✓ Add cost within budget test passed")


def test_add_cost_exceeds_budget():
    """Test that adding cost exceeding budget returns False."""
    with tempfile.TemporaryDirectory() as tmpdir:
        cost_log_path = Path(tmpdir) / "cost_log.json"
        
        tracker = CostTracker(
            cost_log_path=cost_log_path,
            max_cost_usd=5.0,
            warn_threshold_usd=3.0
        )
        
        # Add cost that brings us close to limit
        tracker.add_cost(4.5)
        
        # Try to add cost that would exceed limit
        result = tracker.add_cost(1.0)
        assert result is False
        assert tracker.current_cost == 4.5  # Cost not added
        
        print("✓ Budget limit enforcement test passed")


def test_warning_threshold():
    """Test that warning is triggered at threshold."""
    with tempfile.TemporaryDirectory() as tmpdir:
        cost_log_path = Path(tmpdir) / "cost_log.json"
        
        tracker = CostTracker(
            cost_log_path=cost_log_path,
            max_cost_usd=5.0,
            warn_threshold_usd=3.0
        )
        
        # Add cost below threshold
        tracker.add_cost(2.0)
        assert tracker.warned is False
        
        # Add cost that crosses threshold
        tracker.add_cost(1.5)
        assert tracker.warned is True
        assert tracker.current_cost == 3.5
        
        print("✓ Warning threshold test passed")


def test_cost_estimation():
    """Test cost estimation for batch operations."""
    with tempfile.TemporaryDirectory() as tmpdir:
        cost_log_path = Path(tmpdir) / "cost_log.json"
        
        tracker = CostTracker(
            cost_log_path=cost_log_path,
            max_cost_usd=5.0
        )
        
        # Estimate cost for 10 directories
        estimated = tracker.estimate_cost(10)
        assert estimated > 0
        assert isinstance(estimated, float)
        
        # Estimate should scale with directory count
        estimated_20 = tracker.estimate_cost(20)
        assert estimated_20 > estimated
        assert abs(estimated_20 - (estimated * 2)) < 0.01  # Should be roughly 2x
        
        print("✓ Cost estimation test passed")


def test_remaining_budget():
    """Test remaining budget calculation."""
    with tempfile.TemporaryDirectory() as tmpdir:
        cost_log_path = Path(tmpdir) / "cost_log.json"
        
        tracker = CostTracker(
            cost_log_path=cost_log_path,
            max_cost_usd=5.0
        )
        
        # Initial remaining budget
        remaining = tracker.get_remaining_budget()
        assert remaining == 5.0
        
        # After adding cost
        tracker.add_cost(2.0)
        remaining = tracker.get_remaining_budget()
        assert remaining == 3.0
        
        # No budget limit
        tracker_no_limit = CostTracker(
            cost_log_path=cost_log_path,
            max_cost_usd=None
        )
        remaining = tracker_no_limit.get_remaining_budget()
        assert remaining is None
        
        print("✓ Remaining budget test passed")


def test_increment_counters():
    """Test directory and README counters."""
    with tempfile.TemporaryDirectory() as tmpdir:
        cost_log_path = Path(tmpdir) / "cost_log.json"
        
        tracker = CostTracker(cost_log_path=cost_log_path)
        
        assert tracker.directories_processed == 0
        assert tracker.readmes_generated == 0
        
        tracker.increment_directories()
        assert tracker.directories_processed == 1
        
        tracker.increment_readmes()
        assert tracker.readmes_generated == 1
        
        tracker.increment_directories()
        tracker.increment_readmes()
        assert tracker.directories_processed == 2
        assert tracker.readmes_generated == 2
        
        print("✓ Counter increment test passed")


def test_save_cost_log():
    """Test saving cost log to JSON file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        cost_log_path = Path(tmpdir) / "cost_log.json"
        
        tracker = CostTracker(
            cost_log_path=cost_log_path,
            provider="openrouter",
            model="claude-3.5-sonnet",
            command="generate.py --path crates/"
        )
        
        # Add some costs and counters
        tracker.add_cost(1.5)
        tracker.increment_directories()
        tracker.increment_readmes()
        
        # Save log
        tracker.save_cost_log(prompt_tokens=10000, completion_tokens=5000)
        
        # Verify file was created
        assert cost_log_path.exists()
        
        # Load and verify contents
        with open(cost_log_path, 'r') as f:
            log_data = json.load(f)
        
        assert 'runs' in log_data
        assert 'cumulative_cost_usd' in log_data
        assert len(log_data['runs']) == 1
        
        run = log_data['runs'][0]
        assert run['provider'] == 'openrouter'
        assert run['model'] == 'claude-3.5-sonnet'
        assert run['prompt_tokens'] == 10000
        assert run['completion_tokens'] == 5000
        assert run['cost_usd'] == 1.5
        assert run['directories_processed'] == 1
        assert run['readmes_generated'] == 1
        
        print("✓ Save cost log test passed")


def test_cumulative_cost_tracking():
    """Test cumulative cost tracking across multiple runs."""
    with tempfile.TemporaryDirectory() as tmpdir:
        cost_log_path = Path(tmpdir) / "cost_log.json"
        
        # First run
        tracker1 = CostTracker(
            cost_log_path=cost_log_path,
            command="run 1"
        )
        tracker1.add_cost(1.5)
        tracker1.save_cost_log(prompt_tokens=10000, completion_tokens=5000)
        
        # Second run
        tracker2 = CostTracker(
            cost_log_path=cost_log_path,
            command="run 2"
        )
        tracker2.add_cost(2.0)
        tracker2.save_cost_log(prompt_tokens=15000, completion_tokens=7000)
        
        # Load and verify cumulative cost
        with open(cost_log_path, 'r') as f:
            log_data = json.load(f)
        
        assert len(log_data['runs']) == 2
        assert log_data['cumulative_cost_usd'] == 3.5
        
        print("✓ Cumulative cost tracking test passed")


def test_load_cost_history():
    """Test loading cost history from file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        cost_log_path = Path(tmpdir) / "cost_log.json"
        
        # Create a log file
        tracker = CostTracker(cost_log_path=cost_log_path)
        tracker.add_cost(1.0)
        tracker.save_cost_log(prompt_tokens=5000, completion_tokens=2000)
        
        # Load history
        history = CostTracker.load_cost_history(cost_log_path)
        
        assert 'runs' in history
        assert 'cumulative_cost_usd' in history
        assert len(history['runs']) == 1
        assert history['cumulative_cost_usd'] == 1.0
        
        # Test loading non-existent file
        non_existent = Path(tmpdir) / "nonexistent.json"
        history = CostTracker.load_cost_history(non_existent)
        assert history['runs'] == []
        assert history['cumulative_cost_usd'] == 0.0
        
        print("✓ Load cost history test passed")


def test_reset_cost_history():
    """Test resetting cost history."""
    with tempfile.TemporaryDirectory() as tmpdir:
        cost_log_path = Path(tmpdir) / "cost_log.json"
        
        # Create a log with some data
        tracker = CostTracker(cost_log_path=cost_log_path)
        tracker.add_cost(5.0)
        tracker.save_cost_log(prompt_tokens=50000, completion_tokens=20000)
        
        # Reset history
        CostTracker.reset_cost_history(cost_log_path)
        
        # Load and verify reset
        with open(cost_log_path, 'r') as f:
            log_data = json.load(f)
        
        assert log_data['runs'] == []
        assert log_data['cumulative_cost_usd'] == 0.0
        assert 'last_reset' in log_data
        
        print("✓ Reset cost history test passed")


def run_all_tests():
    """Run all cost tracker tests."""
    print("\n" + "="*60)
    print("COST TRACKER TESTS")
    print("="*60 + "\n")
    
    test_cost_tracker_initialization()
    test_add_cost_within_budget()
    test_add_cost_exceeds_budget()
    test_warning_threshold()
    test_cost_estimation()
    test_remaining_budget()
    test_increment_counters()
    test_save_cost_log()
    test_cumulative_cost_tracking()
    test_load_cost_history()
    test_reset_cost_history()
    
    print("\n" + "="*60)
    print("ALL TESTS PASSED ✓")
    print("="*60 + "\n")


if __name__ == '__main__':
    run_all_tests()

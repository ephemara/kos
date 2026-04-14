"""
Example K_OS Script - Hello World
=================================
Drop any .py file in this folder and it will be auto-loaded!

To call from Rust/JS:
  python_call("run_script", {"script_name": "example", "function": "main"})
  
Or register functions directly for the registry:
  python_call("example.greet", {"name": "World"})
"""

import numpy as np
import sys
import os

# Get the register decorator
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from main import register

def main(**kwargs):
    """Default entry point when script is run"""
    return {
        "message": "Hello from K_OS Python!",
        "numpy_version": np.__version__,
        "kwargs": kwargs
    }

@register("example.greet")
def greet(name: str = "K_OS User") -> str:
    """Example registered function"""
    return f"Hello, {name}! Python is ready."

@register("example.generate_grid")
def generate_grid(width: int = 10, height: int = 10, value: float = 1.0) -> dict:
    """Generate a simple numpy grid"""
    grid = np.full((height, width), value)
    return {
        "data": grid.tolist(),
        "shape": list(grid.shape),
        "sum": float(grid.sum())
    }

@register("example.math_demo")
def math_demo(numbers: list) -> dict:
    """Demo numpy operations"""
    arr = np.array(numbers)
    return {
        "mean": float(arr.mean()),
        "std": float(arr.std()),
        "min": float(arr.min()),
        "max": float(arr.max()),
        "sorted": arr[np.argsort(arr)].tolist()
    }

# This runs when the script is loaded
print(f"[example.py] Loaded! NumPy {np.__version__}", file=sys.stderr)

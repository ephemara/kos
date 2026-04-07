"""
Dead simple Python test - just return a message
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from main import register

@register("hello.world")
def hello_world(name: str = "K_OS User") -> dict:
    """
    Simplest possible Python function - just return a message.
    """
    return {
        "message": f"🎉 Hello from Python, {name}!",
        "status": "success",
        "timestamp": "working!"
    }

@register("hello.test")
def test(**kwargs) -> dict:
    """
    Even simpler - no parameters.
    """
    return {
        "message": "Python is ALIVE! 🚀",
        "value": 42
    }

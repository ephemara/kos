from typing import Dict, Callable

# Add scripts folder to path for dynamic loading
# Not strictly needed here but good for context if moved

# Registry of available functions
_REGISTRY: Dict[str, Callable] = {}

def register(name: str = None):
    """Decorator to register a function as callable from Rust"""
    def decorator(fn: Callable):
        fn_name = name or fn.__name__
        _REGISTRY[fn_name] = fn
        return fn
    return decorator

#!/usr/bin/env python3
"""
K_OS Python Sidecar - Main Entry Point
======================================
JSON-RPC server over stdin/stdout for Rust/Tauri IPC.
Supports hot-reloading of user scripts from kos/scripts/
"""

import sys
import json
import importlib
import traceback
from pathlib import Path
from typing import Any, Dict, Callable
from datetime import datetime

# Add scripts folder to path for dynamic loading
SCRIPTS_DIR = Path(__file__).parent / "kos" / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

# Import shared registry
try:
    from kos.api import register, _REGISTRY
except ImportError:
    # If running directly from src-python, add the package root explicitly.
    sys.path.append(str(Path(__file__).parent))
    from kos.api import register, _REGISTRY

# Import AI/ML modules for registration
try:
    from kos.autopbr import ai_processor, inpainting, usd_rpc
    HAS_AUTOPBR = True
except ImportError:
    HAS_AUTOPBR = False
    print(
        "Warning: AutoPBR AI modules not available. Install requirements-autopbr.txt",
        file=sys.stderr,
    )

# --- BUILT-IN COMMANDS ---

@register("ping")
def ping() -> str:
    """Health check"""
    return "pong"

@register("list_functions")
def list_functions() -> list:
    """List all registered functions"""
    return list(_REGISTRY.keys())

@register("list_scripts")
def list_scripts() -> list:
    """List all scripts in the scripts folder"""
    if not SCRIPTS_DIR.exists():
        return []
    return [f.stem for f in SCRIPTS_DIR.glob("*.py") if not f.name.startswith("_")]

@register("reload_script")
def reload_script(script_name: str) -> str:
    """Hot-reload a script from the scripts folder"""
    try:
        if script_name in sys.modules:
            module = sys.modules[script_name]
            importlib.reload(module)
        else:
            importlib.import_module(script_name)
        return f"Reloaded: {script_name}"
    except Exception as e:
        return f"Error: {e}"

@register("run_script")
def run_script(script_name: str, function: str = "main", **kwargs) -> Any:
    """Run a function from a user script"""
    try:
        # Import or reload the script
        if script_name in sys.modules:
            module = importlib.reload(sys.modules[script_name])
        else:
            module = importlib.import_module(script_name)
        
        # Get and call the function
        fn = getattr(module, function)
        return fn(**kwargs)
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}

@register("exec_code")
def exec_code(code: str, context: dict = None) -> Any:
    """Execute arbitrary Python code (for REPL/scripting)"""
    ctx = context or {}
    ctx["__builtins__"] = __builtins__

    try:
        # Try as expression first (returns value)
        result = eval(code, ctx)
        return result
    except SyntaxError:
        # Fall back to exec (statements)
        exec(code, ctx)
        return ctx.get("result", None)

# --- AUTOPBR AI/ML FUNCTIONS ---
# These are registered if autopbr modules are available

if HAS_AUTOPBR:
    # Register AI processor functions
    register("upscale_texture")(ai_processor.upscale_texture)
    register("denoise_texture")(ai_processor.denoise_texture)
    register("identify_material")(ai_processor.identify_material)
    
    # Register inpainting functions
    register("make_seamless")(inpainting.make_seamless)
    register("correct_perspective")(inpainting.correct_perspective)
    register("remove_folds")(inpainting.remove_folds)
    
    # Register USD export functions
    register("export_usd")(usd_rpc.export_usd)
    register("validate_usd")(usd_rpc.validate_usd)
    register("export_usd_batch")(usd_rpc.export_usd_batch)

@register("get_info")
def get_info() -> dict:
    """Get Python environment info"""
    import platform
    return {
        "python_version": platform.python_version(),
        "platform": platform.system(),
        "registered_functions": len(_REGISTRY),
        "scripts_dir": str(SCRIPTS_DIR),
        "timestamp": datetime.now().isoformat()
    }

# --- JSON-RPC HANDLER ---

def handle_request(request: dict) -> dict:
    """Handle a JSON-RPC 2.0 request"""
    method = request.get("method")
    params = request.get("params", {})
    req_id = request.get("id")
    
    if method not in _REGISTRY:
        return {
            "jsonrpc": "2.0",
            "error": {"code": -32601, "message": f"Method not found: {method}"},
            "id": req_id
        }
    
    try:
        if isinstance(params, dict):
            result = _REGISTRY[method](**params)
        elif isinstance(params, list):
            result = _REGISTRY[method](*params)
        else:
            result = _REGISTRY[method]()
        
        return {
            "jsonrpc": "2.0",
            "result": result,
            "id": req_id
        }
    except Exception as e:
        return {
            "jsonrpc": "2.0",
            "error": {"code": -32000, "message": str(e), "data": traceback.format_exc()},
            "id": req_id
        }

def main():
    """Main loop - read JSON from stdin, write response to stdout"""
    # Load all scripts on startup
    if SCRIPTS_DIR.exists():
        for script in SCRIPTS_DIR.glob("*.py"):
            if not script.name.startswith("_"):
                try:
                    importlib.import_module(script.stem)
                except Exception as e:
                    print(json.dumps({"startup_error": f"{script.stem}: {e}"}), file=sys.stderr)
    
    # Signal ready
    # print(json.dumps({"jsonrpc": "2.0", "result": "ready", "id": 0}), flush=True)
    
    # Main loop
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        
        try:
            request = json.loads(line)
            response = handle_request(request)
            print(json.dumps(response), flush=True)
        except json.JSONDecodeError as e:
            print(json.dumps({
                "jsonrpc": "2.0",
                "error": {"code": -32700, "message": f"Parse error: {e}"},
                "id": None
            }), flush=True)

if __name__ == "__main__":
    main()

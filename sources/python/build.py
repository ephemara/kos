"""
K_OS Python Sidecar - PyInstaller Build Script
===============================================
Run this to create a standalone .exe for distribution.

Usage:
  python build.py

Output:
  dist/kos_python/kos_python.exe (or kos_python on Linux/Mac)
"""

import subprocess
import sys
import os
from pathlib import Path

def build():
    # Get the main.py path
    script_dir = Path(__file__).parent
    main_py = script_dir / "main.py"
    
    # PyInstaller command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--onedir",
        "--name", "kos_python",
        "--distpath", str(script_dir / "dist"),
        "--workpath", str(script_dir / "build"),
        "--specpath", str(script_dir),
        # Include the kos package
        "--add-data", f"{script_dir / 'kos'};kos",
        # Hidden imports for lazy-loaded modules
        "--hidden-import", "numpy",
        "--hidden-import", "scipy",
        "--hidden-import", "PIL",
        "--hidden-import", "cv2",
        str(main_py)
    ]
    
    print("Building K_OS Python sidecar...")
    print(f"Command: {' '.join(cmd)}")
    
    subprocess.run(cmd, check=True)
    
    print("\nBuild complete!")
    print(f"  Output: {script_dir / 'dist' / 'kos_python' / 'kos_python.exe'}")
    print("\nStage the dist/kos_python folder into the bundled resources directory.")

if __name__ == "__main__":
    build()

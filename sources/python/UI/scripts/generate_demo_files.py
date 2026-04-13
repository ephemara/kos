#!/usr/bin/env python3
"""
Generate demo files for every supported file type for screenshot purposes
"""

from pathlib import Path

# Output directory
output_dir = Path("../output/vscode-icon-theme/demo-files")
output_dir.mkdir(parents=True, exist_ok=True)

# All file types from icon-theme.json
demo_files = [
    # Programming Languages
    "rust.rs",
    "python.py",
    "javascript.js",
    "typescript.ts",
    "cpp.cpp",
    "c.c",
    "csharp.cs",
    "java.java",
    "go.go",
    "ruby.rb",
    "php.php",
    "swift.swift",
    "kotlin.kt",
    "dart.dart",
    "lua.lua",
    "zig.zig",
    "elixir.ex",
    "haskell.hs",
    "r.r",
    "scala.scala",
    "clojure.clj",
    "erlang.erl",
    "ocaml.ml",
    
    # Web
    "index.html",
    "styles.css",
    "styles.scss",
    "styles.sass",
    "styles.less",
    
    # Data/Config
    "config.json",
    "config.yaml",
    "config.toml",
    "data.xml",
    "README.md",
    
    # Shaders
    "shader.glsl",
    "shader.hlsl",
    "shader.wgsl",
    "shader.spv",
    "program.kain",
    
    # Build/Config
    "Dockerfile",
    "Makefile",
    ".gitattributes",
    ".gitignore",
    ".env",
    ".editorconfig",
    "package-lock.json",
    
    # Database
    "database.db",
    "query.sql",
    
    # 3D Models
    "model.obj",
    "model.fbx",
    "model.gltf",
    "model.blend",
    
    # Scripts
    "script.sh",
    "script.ps1",
    
    # Executables/Packages
    "program.exe",
    "installer.dmg",
    "application.app",
    "package.deb",
    "library.dll",
    
    # Config
    "settings.ini",
    "story.ink",
    "asset.uasset",
    "project.uproject",
    
    # Documents
    "document.pdf",
    "notes.txt",
    "debug.log",
    
    # Media
    "image.png",
    "video.mp4",
    "audio.mp3",
    "font.ttf",
    
    # Archives
    "archive.zip",
    "backup.tar",
    
    # Build Tools
    "CMakeLists.txt",
    "build.gradle",
    ".npmrc",
]

print("🎬 Generating demo files for screenshot...")
print("=" * 60)

for filename in demo_files:
    filepath = output_dir / filename
    
    # Create file with minimal content
    content = f"// Demo file: {filename}\n"
    
    try:
        filepath.write_text(content, encoding='utf-8')
        print(f"✅ Created: {filename}")
    except Exception as e:
        print(f"❌ Failed: {filename} - {e}")

print("\n" + "=" * 60)
print(f"🎉 Generated {len(demo_files)} demo files!")
print(f"📁 Location: {output_dir.absolute()}")
print("\n💡 Open this folder in VS Code to see all the icons!")

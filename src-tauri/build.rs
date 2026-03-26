use std::env;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

fn main() {
    // 1. Get Project Root (we are in src-tauri, so go up one level)
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let tauri_dir = Path::new(&manifest_dir);
    let root = tauri_dir.parent().expect("Failed to get parent dir");

    // 2. Trigger rebuilds if these files change
    println!("cargo:rerun-if-changed=Cargo.toml");
    println!("cargo:rerun-if-changed=../package.json");
    println!("cargo:rerun-if-changed=../docs/CARGO_ARSENAL.md");
    println!("cargo:rerun-if-changed=../docs/NPM_ARSENAL.md");
    println!("cargo:rerun-if-changed=../DIRECTORY.md");
    println!("cargo:rerun-if-env-changed=KAIN_BIN_PATH");

    // Sync local Kain compiler binary into bundled resources when available.
    sync_kain_binary(tauri_dir);

    // Default tauri build
    tauri_build::build();

    // 3. RUN THE SENTRY CHECKS
    check_rust_arsenal(tauri_dir, root);
    check_npm_arsenal(root);
    check_bevy_syntax(tauri_dir);
    check_directory_sync(root, tauri_dir);
}

fn sync_kain_binary(tauri_dir: &Path) {
    let mut source_candidates: Vec<String> = Vec::new();
    if let Ok(env_path) = env::var("KAIN_BIN_PATH") {
        if !env_path.trim().is_empty() {
            source_candidates.push(env_path);
        }
    }
    source_candidates.push("M:/code/target/release/kain.exe".to_string());
    source_candidates.push("M:/Code/target/release/kain.exe".to_string());
    source_candidates.push("M:/code/Kain/target/release/kain.exe".to_string());
    source_candidates.push("M:/Code/Kain/target/release/kain.exe".to_string());

    let source = source_candidates
        .iter()
        .map(Path::new)
        .find(|path| path.exists())
        .map(|path| path.to_path_buf());

    let Some(source_path) = source else {
        println!("cargo:warning=Kain binary not found. Set KAIN_BIN_PATH or place kain.exe in M:/Code/Kain/target/release");
        return;
    };

    let target_dir = tauri_dir.join("resources").join("bin");
    let target_path = target_dir.join("kain.exe");

    if let Err(err) = fs::create_dir_all(&target_dir) {
        println!(
            "cargo:warning=Failed to create Kain resource directory: {}",
            err
        );
        return;
    }

    let should_copy = match (fs::metadata(&source_path), fs::metadata(&target_path)) {
        (Ok(src), Ok(dst)) => src.len() != dst.len() || src.modified().ok() > dst.modified().ok(),
        (Ok(_), Err(_)) => true,
        (Err(_), _) => false,
    };

    if !should_copy {
        return;
    }

    match fs::copy(&source_path, &target_path) {
        Ok(_) => println!(
            "cargo:warning=Bundled Kain binary synced: {} -> {}",
            source_path.display(),
            target_path.display()
        ),
        Err(err) => println!(
            "cargo:warning=Failed to copy Kain binary ({} -> {}): {}",
            source_path.display(),
            target_path.display(),
            err
        ),
    }
}

fn check_rust_arsenal(tauri_dir: &Path, root: &Path) {
    let cargo_path = tauri_dir.join("Cargo.toml");
    let arsenal_path = root.join("docs").join("CARGO_ARSENAL.md");

    if !arsenal_path.exists() {
        panic!("CARGO_ARSENAL.md missing! Create it in the root to pass The Sentry.");
    }

    let cargo_content = fs::read_to_string(cargo_path).expect("Failed to read Cargo.toml");
    let arsenal_content =
        fs::read_to_string(arsenal_path).expect("Failed to read CARGO_ARSENAL.md");

    let cargo_toml: toml::Value =
        toml::from_str(&cargo_content).expect("Failed to parse Cargo.toml");

    let mut missing_crates = Vec::new();

    if let Some(deps) = cargo_toml.get("dependencies").and_then(|d| d.as_table()) {
        for (crate_name, _) in deps {
            if !arsenal_content.contains(crate_name) {
                missing_crates.push(crate_name.to_string());
            }
        }
    }

    if !missing_crates.is_empty() {
        panic!(
            "\n\n\
            \x1b[1;31m=============================================================\n\
            🛑 SENTRY PROTOCOL: BUILD BLOCKED BY UNDOCUMENTED CRATES 🛑\n\
            =============================================================\x1b[0m\n\
            \n\
            [ATTENTION AI AGENT / SCAVENGER KING]\n\
            You added the following Rust crates to Cargo.toml but did NOT\n\
            document them in 'CARGO_ARSENAL.md':\n\
            \n\
            {:#?}\n\
            \n\
            [INSTRUCTION FOR AGENT]\n\
            1. READ Cargo.toml\n\
            2. OPEN CARGO_ARSENAL.md in the root\n\
            3. ADD a row for these crates explaining their purpose.\n\
            4. RETRY THE BUILD.\n\
            \n\
            DO NOT IGNORE THIS. THE BUILD WILL FAIL UNTIL DOCS ARE SYNCED.\n\
            =============================================================\n\n",
            missing_crates
        );
    }
}

fn check_npm_arsenal(root: &Path) {
    let package_path = root.join("package.json");
    let arsenal_path = root.join("docs").join("NPM_ARSENAL.md");

    if !package_path.exists() {
        return;
    }
    if !arsenal_path.exists() {
        panic!("NPM_ARSENAL.md missing! Create it in the root to pass The Sentry.");
    }

    let package_content = fs::read_to_string(package_path).expect("Failed to read package.json");
    let arsenal_content = fs::read_to_string(arsenal_path).unwrap_or_default();

    let package_json: serde_json::Value =
        serde_json::from_str(&package_content).expect("Failed to parse package.json");

    let mut missing_packages = Vec::new();

    if let Some(deps) = package_json.get("dependencies").and_then(|d| d.as_object()) {
        for (pkg_name, _) in deps {
            if !arsenal_content.contains(pkg_name) {
                missing_packages.push(pkg_name.to_string());
            }
        }
    }

    if !missing_packages.is_empty() {
        panic!(
            "\n\n\
            \x1b[1;31m=============================================================\n\
            🛑 SENTRY PROTOCOL: BUILD BLOCKED BY UNDOCUMENTED NPM PACKAGES 🛑\n\
            =============================================================\x1b[0m\n\
            \n\
            [ATTENTION AI AGENT]\n\
            You installed new NPM packages but ignored 'NPM_ARSENAL.md'.\n\
            \n\
            MISSING PACKAGES:\n\
            {:#?}\n\
            \n\
            [ACTION REQUIRED]\n\
            UPDATE NPM_ARSENAL.md IMMEDIATELY OR THE BUILD WILL NOT PASS.\n\
            =============================================================\n\n",
            missing_packages
        );
    }
}

/// Check for deprecated Bevy 0.14/0.15/0.16 syntax patterns
fn check_bevy_syntax(tauri_dir: &Path) {
    let forbidden_patterns: Vec<(&str, &str)> = vec![
        // Bundles (deprecated in 0.15)
        (
            "PbrBundle",
            "Use (Mesh3d, MeshMaterial3d, Transform) tuple instead",
        ),
        (
            "MaterialMeshBundle",
            "Use (Mesh3d, MeshMaterial3d, Transform) tuple instead",
        ),
        (
            "MaterialMesh2dBundle",
            "Use (Mesh2d, MeshMaterial2d, Transform) tuple instead",
        ),
        (
            "SpriteBundle",
            "Use Sprite component directly (auto-inserts required components)",
        ),
        ("SpriteSheetBundle", "Use Sprite component directly"),
        ("NodeBundle", "Use Node component directly"),
        ("TextBundle", "Use Text component directly"),
        ("Text2dBundle", "Use Text2d component directly"),
        ("ButtonBundle", "Use Button component directly"),
        ("ImageBundle", "Use ImageNode component directly"),
        ("Camera2dBundle", "Use Camera2d component directly"),
        ("Camera3dBundle", "Use Camera3d component directly"),
        ("PointLightBundle", "Use PointLight component directly"),
        (
            "DirectionalLightBundle",
            "Use DirectionalLight component directly",
        ),
        ("SpotLightBundle", "Use SpotLight component directly"),
        (
            "SpatialBundle",
            "Use Transform component directly (deprecated)",
        ),
        ("VisibilityBundle", "Use Visibility component directly"),
        // Events -> Messages (0.17)
        ("EventReader<", "Use MessageReader<T> instead (Bevy 0.17)"),
        ("EventWriter<", "Use MessageWriter<T> instead (Bevy 0.17)"),
        ("Events<", "Use Messages<T> instead (Bevy 0.17)"),
        ("add_event::<", "Use add_message::<T>() instead (Bevy 0.17)"),
        ("send_event(", "Use write_message() instead (Bevy 0.17)"),
        // Observers (0.17)
        ("Trigger<", "Use On<T> instead (Bevy 0.17)"),
        ("OnAdd", "Use Add instead (Bevy 0.17 - On prefix removed)"),
        ("OnInsert", "Use Insert instead (Bevy 0.17)"),
        ("OnRemove", "Use Remove instead (Bevy 0.17)"),
        ("OnDespawn", "Use Despawn instead (Bevy 0.17)"),
        ("trigger_targets(", "Use trigger() instead (Bevy 0.17)"),
        // Asset handles
        ("Handle::Weak", "Use Handle::Uuid instead (Bevy 0.17)"),
        ("weak_handle!", "Use uuid_handle! instead (Bevy 0.17)"),
    ];

    let src_dir = tauri_dir.join("src");
    let mut violations: Vec<(String, String, String)> = Vec::new();

    for entry in WalkDir::new(&src_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "rs"))
    {
        let content = match fs::read_to_string(entry.path()) {
            Ok(c) => c,
            Err(_) => continue,
        };

        for (pattern, fix) in &forbidden_patterns {
            if content.contains(pattern) {
                // Skip if it's in a comment (basic check)
                let in_comment = content.lines().any(|line| {
                    let trimmed = line.trim();
                    (trimmed.starts_with("//")
                        || trimmed.starts_with("*")
                        || trimmed.starts_with("/*"))
                        && line.contains(pattern)
                });

                if !in_comment {
                    violations.push((
                        entry
                            .path()
                            .strip_prefix(tauri_dir)
                            .unwrap_or(entry.path())
                            .display()
                            .to_string(),
                        pattern.to_string(),
                        fix.to_string(),
                    ));
                }
            }
        }
    }

    if !violations.is_empty() {
        let mut msg = String::new();
        for (file, pattern, fix) in &violations {
            msg.push_str(&format!(
                "  {} -> '{}'\n    FIX: {}\n\n",
                file, pattern, fix
            ));
        }

        panic!(
            "\n\n\
            \x1b[1;31m=============================================================\n\
            🛑 SENTRY PROTOCOL: DEPRECATED BEVY SYNTAX DETECTED 🛑\n\
            =============================================================\x1b[0m\n\
            \n\
            [ATTENTION AI AGENT]\n\
            You are using OUTDATED Bevy patterns. This project uses Bevy 0.17!\n\
            \n\
            VIOLATIONS FOUND:\n\
            {}\n\
            [CRITICAL]\n\
            DO NOT use Bevy 0.14/0.15/0.16 patterns. Check CARGO_ARSENAL.md\n\
            for correct Bevy 0.17 syntax.\n\
            =============================================================\n\n",
            msg
        );
    }
}

/// Check for new files not documented in DIRECTORY.md (warning only, doesn't block)
fn check_directory_sync(root: &Path, tauri_dir: &Path) {
    let directory_path = root.join("DIRECTORY.md");

    if !directory_path.exists() {
        println!("cargo:warning=DIRECTORY.md missing! Create it for The Sentry to track files.");
        return;
    }

    let directory_content = fs::read_to_string(&directory_path).unwrap_or_default();
    let mut undocumented: Vec<String> = Vec::new();

    // Check Rust modules in src-tauri/src/
    let rust_src = tauri_dir.join("src");
    for entry in WalkDir::new(&rust_src)
        .max_depth(2) // Only top-level modules
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "rs"))
    {
        let filename = entry.path().file_name().unwrap().to_string_lossy();
        // Skip mod.rs and main.rs, they're implicit
        if filename == "mod.rs" || filename == "main.rs" || filename == "lib.rs" {
            continue;
        }
        let module_name = filename.trim_end_matches(".rs");
        if !directory_content.contains(module_name) {
            let rel_path = entry.path().strip_prefix(root).unwrap_or(entry.path());
            undocumented.push(format!("  [RUST] {}", rel_path.display()));
        }
    }

    // Check React apps in src-frontend/apps/
    let apps_dir = root.join("src-frontend").join("apps");
    if apps_dir.exists() {
        for entry in WalkDir::new(&apps_dir)
            .max_depth(3)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path().is_dir()
                    && e.path()
                        .file_name()
                        .map_or(false, |n| n.to_string_lossy().starts_with("K"))
            })
        {
            let dir_name = entry.path().file_name().unwrap().to_string_lossy();
            if !directory_content.contains(&*dir_name) {
                let rel_path = entry.path().strip_prefix(root).unwrap_or(entry.path());
                undocumented.push(format!("  [APP]  {}", rel_path.display()));
            }
        }
    }

    // Check Python scripts in src-python/
    let python_dir = root.join("src-python");
    if python_dir.exists() {
        for entry in WalkDir::new(&python_dir)
            .max_depth(3)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map_or(false, |ext| ext == "py"))
        {
            let filename = entry.path().file_name().unwrap().to_string_lossy();
            // Skip __init__.py and common utility names
            if filename == "__init__.py" || filename == "__main__.py" {
                continue;
            }
            let script_name = filename.trim_end_matches(".py");
            if !directory_content.contains(script_name) {
                let rel_path = entry.path().strip_prefix(root).unwrap_or(entry.path());
                undocumented.push(format!("  [PY]   {}", rel_path.display()));
            }
        }
    }

    // Print warning if undocumented files found
    if !undocumented.is_empty() {
        println!("cargo:warning=");
        println!(
            "cargo:warning=📁 SENTRY: {} files not documented in DIRECTORY.md:",
            undocumented.len()
        );
        for item in &undocumented {
            println!("cargo:warning={}", item);
        }
        println!("cargo:warning=");
        println!("cargo:warning=Consider adding these to DIRECTORY.md for AI agent clarity.");
        println!("cargo:warning=");
    }
}

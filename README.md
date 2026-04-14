# Zender Workspace

Private multi-runtime creative tooling workspace for the K_OS / Zen stack.

## Main Surfaces

- `apps/web`: primary React/Vite application shell
- `apps/tauri`: desktop backend and Tauri packaging boundary
- `apps/bevy`: experimental viewport host
- `apps/zen`: native Zen host
- `apps/README.md`: placement guide for deciding which app surface owns new work
- `crates`: Rust workspace packages for rendering, scene, config, IO, gameplay, mocap, and host integration
- `apps/web/src-mocap`: mocap-focused frontend surface
- `sources/kain`: in-repo Kain source workspace and authored runtime assets
- `sources/python`: Python sidecar and tooling
- `sources/game`: authored game assets, manifests, and product-layer docs
- `sources/README.md`: placement guide for non-crate source workspaces and content trees

## Root Layout Rules

- Keep root-level build contracts in place: `package.json`, `Cargo.toml`, `ARCHITECTURE.md`, `memory.md`, `DIRECTORY.md`, `RECENT_CHANGES.md`, Vite configs, and the HTML entrypoints.
- Put repo maps and generated flow docs under `docs/repo-maps`.
- Put ad hoc helper scripts under `scripts/*` instead of leaving them at the root.
- Treat `sources/*` as authored source workspaces and content trees that do not belong in `apps/*` or `crates/*`.
- Treat `output/`, `automation/`, and `Swarm/` as artifact or orchestration areas, not core app entrypoints.

## Linux Build Path

- `npm ci --no-audit --no-fund`
- `npm run build:web`
- `cargo check -p k-os-backend`
- `cargo check -p zen`
- `npm run build`

## Notes

- The workspace expects a sibling Kain checkout at `/home/ephemara/Dev/Kain` on this Linux machine, or an explicit `KAIN_BIN_PATH` / `KAIN_REPO_ROOT`.
- Fresh checkouts may not include generated Kain SPIR-V blobs yet; the mocap GPU pipeline now compiles with placeholders until those assets are regenerated.

# Sources Folder Guide

Use `sources/` for authored source workspaces, sidecar code, and content trees that are not Rust crates and not runnable host shells.

## Current Source Trees

- `sources/kain`: authored Kain apps, domains, omni pipelines, kernels, hybrid modules, and related changelog/docs.
- `sources/python`: Python sidecar, auto-loaded KOS scripts, DocGen, UI tooling, and Python packaging assets.
- `sources/game`: authored game assets, pipeline manifests, product docs, and build-output staging owned by the game pipeline.

## Placement Rules

- Put reusable compiled logic in `crates/`.
- Put runnable hosts, native shells, and packaging boundaries in `apps/`.
- Put authored runtime content, sidecar workspaces, and non-crate source trees in `sources/`.
- If a feature spans shared logic and authored source content, split it: shared code in `crates/`, source assets or sidecar code in `sources/`, host wiring in `apps/`.

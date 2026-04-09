# Zen DCC Fabric Workspace

This workspace is the embedded Fabric pipeline for the native Zen host.

Current scope:

- `project.bootstrap`: Python plus Kain bootstrap for the native session summary
- `asset.ingest`: Python plus Kain ingest projection for Zen-facing asset reports
- `material.bake_preview`: Python plus Kain plus GPU compute preview baking
- `topology.rebuild`: Python plus Kain plus Rust graph analysis
- `publish.package`: Python plus Kain plus GPU plus Rust plus Node summary packaging

The native Zen shell now reads the intent registry in `config/fabric_intents.json`, exposes these lanes in the `workspace.fabric` panel, and can auto-run selected intents on scene-dirty transitions.

The C ABI lane is still intentionally deferred here until ZenDCC has a concrete local native DLL owner to point at. The host embedding is ready for that lane without more shell glue.

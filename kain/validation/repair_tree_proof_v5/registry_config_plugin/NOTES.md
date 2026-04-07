# Notes

## Repair rules used here
- Prefer small, explicit domain seams over one imported monolith.
- Keep data documents near the lookup helpers that consume them.
- Mark host-only responsibilities as stubs instead of pretending they are portable Kain logic.
- Preserve field names from the imported scaffold where they still carry signal.

## Remaining boundary stubs
- `ConfigWatcher` is still a platform edge.
- `PluginManager::load_plugin` and `load_all_plugins` depend on host dynamic loading.
- Schema generation and validation hooks are still thin and may need a follow-up pass if the real schema source becomes available.
- The workspace registry still needs a future pass to separate authored metadata from import-derived reports.

## Next good step
Split the registry into:
- workspace inventory
- public API inventory
- integration pressure reports

Then tighten config and plugin modules around those seams.
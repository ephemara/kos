# Asset Pipeline Repair Subtree

This subtree is a cleaned Kain migration lane for `k-os-asset-pipeline`.

## What was repaired

- Core asset types and constructors
- Cache hashing / path selection / disk round-trip flow
- Pipeline import / export / processor orchestration
- Format lookup helpers and cache stats flow

## What remains skeletal

- Backend-heavy format-specific importers/exporters are kept as reference stubs where the real Rust implementation depends on host libraries and file codecs.
- Thumbnail generation and some metadata extraction paths are still treated as integration points, not fully inlined behavior.

## Notes

This is not a raw import dump. It is a smaller repair surface meant to preserve public contracts while making the hottest hollow bodies readable and reusable for the next pass.

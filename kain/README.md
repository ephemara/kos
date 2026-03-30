# Kain migration tree

This directory is the working scaffold for importing and repairing Kain modules out of `M:\K_OS`.

## Layout

- `raw/`
  - Reserved for untouched imports and source snapshots when a raw copy is needed.
  - Keep this side conservative. Do not edit raw inputs in place unless the work is explicitly about the raw artifact.
- `full_pass/`
  - Large end-to-end import passes and heavyweight generated outputs.
  - These are reference artifacts, not the place to do surgical repairs.
- `repair/`
  - The active migration lane for cleaned-up or corrected Kain modules.
  - Put repaired `.kn` files, patch notes, and narrow follow-up experiments here.
- `reports/`
  - Import summaries, pass summaries, comparison notes, and other small metadata.
  - This is the first place to look when you need to know what was imported and where it landed.
- `validation/`
  - Validation-oriented outputs, especially targeted import probes and their diagnostics.
  - Use these to study failures, narrowing losses, or semantic drift.
- `notes/`
  - Human-readable working notes, migration decisions, and context that should survive the next session.
- Module folders such as `animation/`, `renderer/`, `scene/`, `zen/`, etc.
  - These are the current imported module roots.
  - Treat them as the live scaffold for the migration, not as polished final code.
- `_validation/`
  - Legacy validation outputs kept in place for now so nothing gets lost.
  - New validation should prefer `validation/`.

## How to work here

1. Start from `reports/` to understand what was imported and where gaps remain.
2. Use `_validation/` and `validation/` to inspect semantic loss and repair hints.
3. Put repaired or cleaned modules in `repair/` until they are ready to replace or supersede scaffold code.
4. Leave raw imports alone unless you are intentionally preserving a snapshot or documenting a migration step.

## Rules of the road

- Preserve raw artifacts.
- Prefer additive organization over destructive reshaping.
- Keep large generated passes out of the repair lane.
- When in doubt, write a note before moving something.

## Current state

The tree still contains the imported module folders directly under `kain/`. That is intentional for now: it keeps the scaffold usable while the migration tree is being tightened around it.

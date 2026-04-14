# Review Mode - Usage Guide

## Overview

Review mode is an interactive feature that allows you to review and approve generated README content before it's written to disk. This gives you full control over what documentation gets committed to your codebase.

## Features

When `--review-mode` is enabled, the system will:

1. **Display generated content** - Shows the complete README that would be written
2. **Prompt for approval** - Asks you to approve, reject, or edit the content
3. **Skip writing if rejected** - Rejected READMEs are not written to disk
4. **Allow inline editing** - You can modify the content before writing
5. **Sequential processing** - Forces sequential (non-parallel) processing for interactive prompts

## Usage

### Basic Usage

```bash
# Review all generated READMEs
python src-python/DocGen/scripts/generate.py --review-mode

# Review READMEs for a specific directory
python src-python/DocGen/scripts/generate.py --path crates/k-os-engine --review-mode

# Combine with other flags
python src-python/DocGen/scripts/generate.py --review-mode --force --provider gemini
```

### Interactive Prompts

When review mode is active, you'll see prompts like this:

```
================================================================================
REVIEW MODE: crates/k-os-engine/src/gpu
================================================================================

Generated README content:
--------------------------------------------------------------------------------
# GPU Module

*This README may be out of date...*

## Overview
...
--------------------------------------------------------------------------------

README will be written to: M:\K_OS\crates\k-os-engine\src\gpu\README.md

Options:
  [a] approve  - Write README as shown
  [r] reject   - Skip writing this README
  [e] edit     - Edit content before writing

Your choice [a/r/e]:
```

### Options Explained

#### Approve (`a`)
- Writes the README exactly as generated
- Continues to next directory
- **Use when**: Content looks good and accurate

#### Reject (`r`)
- Skips writing this README
- Continues to next directory
- **Use when**: Content is inaccurate or not needed

#### Edit (`e`)
- Opens inline editing mode
- Enter your modified content
- Press `Ctrl+D` (Unix/Mac) or `Ctrl+Z` (Windows) when done
- Confirms before writing
- **Use when**: Content is mostly good but needs tweaks

### Edit Mode Example

```
Your choice [a/r/e]: e

Enter edited content (press Ctrl+D or Ctrl+Z when done):
(Original content is shown above for reference)
--------------------------------------------------------------------------------
# GPU Module

*This README may be out of date...*

## Overview
This module provides GPU compute capabilities...
[Ctrl+D]

--------------------------------------------------------------------------------
Edited content:
--------------------------------------------------------------------------------
# GPU Module
...
--------------------------------------------------------------------------------

Write this content? [y/n]: y
```

## Behavior Notes

### Sequential Processing
- Review mode automatically forces sequential processing (concurrency=1)
- This ensures prompts appear one at a time
- Parallel processing would cause overlapping prompts

### Cost Tracking
- API costs are still tracked even if you reject the README
- The LLM has already generated the content before you review it
- Use `--dry-run` first to see what would be processed without API costs

### Interruption Handling
- Press `Ctrl+C` during a prompt to treat it as "reject"
- The system will continue to the next directory
- Press `Ctrl+C` again to stop the entire process

### Change Detection
- Review mode works with change detection
- Only changed directories are processed (unless `--force` is used)
- Rejected READMEs don't update the cache

## Workflow Recommendations

### Initial Generation
```bash
# First, see what would be generated (no API cost)
python scripts/generate.py --dry-run

# Then generate with review for quality control
python scripts/generate.py --review-mode
```

### Targeted Updates
```bash
# Review only a specific module
python scripts/generate.py --path crates/k-os-engine --review-mode

# Force regeneration with review
python scripts/generate.py --path apps/web/src/features --review-mode --force
```

### Batch with Auto-Approve
```bash
# For trusted directories, skip review mode
python scripts/generate.py --path crates/

# Or use review mode only for critical directories
python scripts/generate.py --path apps/tauri --review-mode
```

## Requirements Satisfied

This implementation satisfies the following requirements:

- **20.1**: Display generated README content before writing
- **20.2**: Prompt for approval (approve/reject/edit)
- **20.3**: Skip writing if rejected
- **20.4**: Allow inline edits before writing
- **20.5**: Edit functionality with confirmation
- **20.6**: Integration with existing pipeline (change detection, cost tracking, parallel processing)

## Technical Details

### Function: `review_readme_content()`

Located in: `src-python/DocGen/scripts/generate.py`

**Parameters:**
- `dir_path`: Directory being documented
- `readme_content`: Generated README content
- `readme_path`: Path where README will be written

**Returns:**
- `(should_write, final_content)` tuple
  - `should_write`: `True` if README should be written, `False` if rejected
  - `final_content`: Final content to write (may be edited), or `None` if rejected

**Error Handling:**
- `KeyboardInterrupt`: Treats as reject, continues processing
- Other exceptions: Treats as reject for safety

### Integration Points

1. **process_directory()**: Calls review function before writing
2. **process_directories_parallel()**: Forces sequential processing in review mode
3. **main()**: Passes `args.review_mode` flag through the pipeline

## Examples

### Example 1: Approve All
```bash
$ python scripts/generate.py --path crates/k-os-engine/src/gpu --review-mode

Processing: crates/k-os-engine/src/gpu
[Content displayed]
Your choice [a/r/e]: a
✓ Generated README: crates/k-os-engine/src/gpu/README.md
```

### Example 2: Reject One, Approve Next
```bash
$ python scripts/generate.py --path crates/ --review-mode

Processing: crates/k-os-engine
[Content displayed]
Your choice [a/r/e]: r
⊘ Skipped crates/k-os-engine: User rejected in review mode

Processing: crates/k-os-wasm
[Content displayed]
Your choice [a/r/e]: a
✓ Generated README: crates/k-os-wasm/README.md
```

### Example 3: Edit Content
```bash
$ python scripts/generate.py --path apps/web/src/features/sculpting --review-mode

Processing: apps/web/src/features/sculpting
[Content displayed]
Your choice [a/r/e]: e

Enter edited content (press Ctrl+D when done):
# KSculpt - 3D Sculpting Tool

*This README may be out of date...*

## Overview
KSculpt is the primary 3D sculpting application...
[Ctrl+D]

Write this content? [y/n]: y
✓ Generated README: apps/web/src/features/sculpting/README.md
```

## Troubleshooting

### Issue: Prompts not appearing
- **Cause**: Running in non-interactive environment
- **Solution**: Ensure you're running in a terminal with stdin/stdout

### Issue: Edit mode not working
- **Cause**: Terminal doesn't support multi-line input
- **Solution**: Use approve/reject, then manually edit the file

### Issue: Ctrl+D not working
- **Cause**: Windows uses Ctrl+Z instead
- **Solution**: Press `Ctrl+Z` then `Enter` on Windows

### Issue: Review mode too slow
- **Cause**: Sequential processing required for interactive prompts
- **Solution**: Use `--review-mode` only for critical directories, batch process others

## See Also

- [README Generator Documentation](../README.md)
- [Change Detection](../core/change_detector.py)
- [Cost Tracking](../core/cost_tracker.py)

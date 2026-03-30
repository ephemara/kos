# Kain repair lane validation report

Date: 2026-03-29
Scope: `M:\K_OS\kain\repair`

## Commands run

1. `Set-Location M:\Code\Kain; cargo run -q -p cli -- doctor`
2. `Set-Location M:\Code\Kain; cargo run -q -p cli -- build M:\K_OS\kain\repair\asset_pipeline\asset_core.kn -t ks -o M:\K_OS\kain\validation\asset_core.ks`
3. `Set-Location M:\Code\Kain; $files = Get-ChildItem M:\K_OS\kain\repair -Recurse -Filter *.kn | Sort-Object FullName; foreach($f in $files){ Write-Host "=== $($f.FullName) ==="; cargo run -q -p cli -- build $f.FullName -t ks -o (Join-Path M:\K_OS\kain\validation ($f.BaseName + '.ks')); if($LASTEXITCODE -ne 0){ Write-Host "[exit=$LASTEXITCODE]" } }`

## Files validated

Repaired `.kn` files present at start:
- `M:\K_OS\kain\repair\asset_pipeline\asset_core.kn`
- `M:\K_OS\kain\repair\asset_pipeline\cache.kn`
- `M:\K_OS\kain\repair\asset_pipeline\pipeline.kn`
- `M:\K_OS\kain\repair\animation\animation.kn`

Additional repaired modules discovered under repair tree:
- `M:\K_OS\kain\repair\material\texture.kn`
- `M:\K_OS\kain\repair\registry_config_plugin\config.kn`
- `M:\K_OS\kain\repair\registry_config_plugin\plugin.kn`
- `M:\K_OS\kain\repair\registry_config_plugin\registry.kn`
- `M:\K_OS\kain\repair\scene\scene.kn`

## Result summary

- `cargo doctor`: passed; local Kain CLI is present and runnable.
- Every repaired `.kn` file I tried failed Kain parse validation.
- No `.ks` outputs were produced in `M:\K_OS\kain\validation` because the builds did not reach codegen.

## Representative blockers

### `asset_pipeline`
- `asset_core.kn`: parser rejected constructor-style blocks such as `Self:` and top-level dedentation around helper functions.
- `cache.kn` / `pipeline.kn`: similar `Expected indentation` / `Unexpected token ':'` failures.

### `animation`
- `animation.kn`: failed on constructor-style `Self:` initialization; this lane is still not accepted by the local Kain parser as written.

### Other discovered repaired lanes
- `material\texture.kn`: parser says struct initialization with named arguments is not supported; `TextureInfo(...)` must become field-by-field assignment.
- `registry_config_plugin\*.kn`: widespread indentation/dedentation parse failures across the module trio.
- `scene\scene.kn`: multiple parser failures, including reserved identifiers (`new`, `spawn`), unsupported `Self:` blocks, and `::` / inline initialization syntax the parser rejects.

## Notes

- Validation was intentionally narrow and Kain-specific.
- I did not mutate source to chase green. The errors appear structural, not flaky.
- For newly added repaired domains, the same loop is enough: include any new `.kn` files under `M:\K_OS\kain\repair` and rerun the full `cargo run -q -p cli -- build <file> -t ks` sweep.

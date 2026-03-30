# KAIN Repair Patterns for Hollow Imported Bodies

This note captures the recurring repair shapes seen in the imported Kain scaffold and the matching Rust sources in `M:\K_OS\crates\k-os-kain` and nearby examples.

The importer usually preserves:
- file layout
- type names
- enum shapes
- manifest-driven lookup structure

It often hollows out:
- constructor bodies
- cache initializers
- serializer / deserializer helpers
- chain-heavy combinator logic
- small utility functions that should have been one obvious expression

Use these patterns to restore behavior without overfitting the import artifact.

---

## 1) Constructor / builder reconstruction

### Symptom
A constructor exists, but the body is empty, returns a placeholder, or no longer wires the obvious fields.

### Repair shape
Rebuild the constructor from the struct fields and the surrounding call sites, not from the hollow body.

### Recipe
1. Identify the owned data.
2. Recreate the canonical defaults.
3. Move cheap normalization into the constructor.
4. Leave expensive IO / discovery out of the constructor unless the source clearly did it there.

### Before
```rust
pub fn new() -> Self {
    Self {
        // hollow
    }
}
```

### After
```rust
pub fn new() -> Self {
    Self {
        registry: OnceCell::new(),
        cache: HashMap::new(),
        workspace_root: discover_workspace_root(),
        enabled: true,
    }
}
```

### Practical rule
If the struct is a pure data holder, rebuild it directly.
If the constructor would need filesystem probing, prefer a `try_new` or lazy `OnceCell` pattern instead of hiding failure in `new`.

---

## 2) Cache / registry helper reconstruction

### Symptom
The file keeps the cache shape, but the body collapses to a stub and the registry no longer sorts, deduplicates, or merges.

Observed in this workspace:
- `OnceCell`-backed manifest registries in `crates/k-os-kain/src/lib.rs`
- manifest loaders that convert JSON arrays into lookup maps
- generated registries that merge curated manifest entries with discovered artifacts

### Repair shape
Rebuild the cache helper as a single-responsibility loader:
- read source of truth
- parse leniently
- normalize defaults
- sort deterministically
- cache once

### Before
```rust
fn load_registry() -> Vec<Item> {
    vec![]
}
```

### After
```rust
fn load_registry() -> Vec<Item> {
    let mut items = read_manifest()
        .into_iter()
        .filter_map(normalize_item)
        .collect::<Vec<_>>();

    items.sort_by(|a, b| a.namespace.cmp(&b.namespace).then_with(|| a.id.cmp(&b.id)));
    items
}
```

### Practical rule
For registry helpers, defaulting should happen at the edge, not in the callers.
If the helper is responsible for lookup, it should also be responsible for stable ordering and deduplication.

### Good marker for a clean repair
A repaired cache helper should answer these questions in one place:
- Where does data come from?
- What is the fallback if the source is missing?
- How are partial records normalized?
- What makes ordering stable across runs?

---

## 3) Serialization / deserialization helper repair

### Symptom
The importer preserves the derive but hollows the parsing logic, or the reverse: the parsing logic survives but no longer applies the manifest defaults.

Observed in this workspace:
- JSON manifest loaders in `crates/k-os-kain/build.rs`
- serde-backed asset structs in `crates/k-os-kain/src/lib.rs`
- frontend-facing DTO paths elsewhere in K_OS that want explicit payload conversion instead of raw internal types

### Repair shape
Restore the parse boundary as a strict-but-forgiving converter:
- accept missing optional fields
- derive obvious labels from ids
- reject structurally invalid records early
- preserve the canonical source path / compiled path contract

### Before
```rust
let item: Item = serde_json::from_str(contents)?;
```

### After
```rust
let value: Value = serde_json::from_str(contents)?;
let items = value
    .as_array()
    .into_iter()
    .flatten()
    .filter_map(|entry| {
        let id = entry.get("id")?.as_str()?;
        let label = entry
            .get("label")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| title_case(id));

        Some(Item {
            id: id.to_string(),
            label,
            ..Default::default()
        })
    })
    .collect::<Vec<_>>();
```

### Practical rule
When the imported body is hollow, prefer explicit field-by-field reconstruction over magical deserialization.
The more this repo leans on manifests, the less tolerant it should be of silent schema drift.

### Strong signal that the helper is repaired correctly
- missing label falls back to `title_case(id)` or equivalent
- missing source/compiled path falls back to the canonical repository layout
- invalid records are skipped or surfaced explicitly, not half-parsed

---

## 4) Method-chain / combinator repair

### Symptom
The source used fluent chains, but the import flattened the chain into noise, duplicated branches, or dropped one link.

Observed in this workspace:
- `.iter().filter(...).collect()` inventory helpers
- `.and_then(...).map(...).unwrap_or_else(...)` manifest normalization
- path helpers built from repeated `join()` chains

### Repair shape
Reconstruct the chain in the simplest readable form that preserves intent.
Do not translate a short fluent pipeline into imperative ceremony unless the branch complexity actually needs it.

### Before
```rust
let outputs = items
    .iter()
    .map(|item| item.outputs.clone())
    .flatten()
    .collect::<Vec<_>>();
```

### After
```rust
let outputs = items
    .iter()
    .flat_map(|item| item.outputs.iter().cloned())
    .collect::<Vec<_>>();
```

### Recipe for repair
- If the logic is a straight transform, keep the chain.
- If the logic has one small fallback, use `map(...).unwrap_or_else(...)`.
- If the logic has multiple structural branches, expand only the branching part and keep the linear section chained.

### Practical rule
A chain is not broken just because the importer made it ugly.
If the behavior is obvious from the chain, preserve the chain.
If the chain hides one real decision point, split only that decision point.

---

## 5) Path helper repair

### Symptom
Imported path helpers collapse to generic strings or lose workspace-relative normalization.

Observed in `crates/k-os-kain/src/lib.rs`:
- workspace root resolution
- manifest path resolution
- generated directory helpers
- domain-specific path composition

### Repair shape
Rebuild path helpers around one invariant: every derived path should be rooted in a single workspace anchor.

### Before
```rust
fn manifest_path() -> PathBuf {
    PathBuf::from("manifest.json")
}
```

### After
```rust
fn manifest_path() -> PathBuf {
    workspace_root().join("crates").join("k-os-kain").join("manifests").join("sources.json")
}
```

### Practical rule
Use helper functions for semantic roots, not for decorative indirection.
If a helper only returns a constant string, it is usually not worth keeping unless it stabilizes a contract.

---

## 6) When to keep a stub

Keep the stub only when one of these is true:
- the source behavior is genuinely unknown
- the imported scaffold is an intentional placeholder for later generated output
- the function is a boundary hook with no local logic yet
- the repair would require guessing at missing domain semantics

### Good stubs
```rust
pub fn generated_registry_path() -> PathBuf {
    workspace_root().join("generated").join("registry.json")
}
```

```rust
pub fn run_external_tool() -> Result<()> {
    Err(Error::Unsupported("tooling not wired yet".into()))
}
```

### Bad stubs
- stubs hiding inside code that clearly needs deterministic behavior
- `todo!()` in a path normalization or registry loader
- placeholder returns where the surrounding module already proves the intended contract

### Rule of thumb
If the function owns a boundary, a stub is acceptable.
If the function owns a rule, a stub is a lie.

---

## 7) When to rewrite cleanly in Kain

Rewrite cleanly when:
- the imported body is mostly noise
- the original control flow is lost
- the source logic depends on application-specific semantics that are easier to restate than to patch
- the function is short enough that a clean rewrite is cheaper than archaeology

### Good candidates for clean rewrite
- manifest loaders
- registry lookups
- output path builders
- small validators
- `validate_*` helpers with one obvious parse/guard flow

### Clean rewrite principle
Prefer one clear function over a half-restored imitation of the original.
A repair that is easy to read is easier to keep alive.

---

## 8) Concrete shape used repeatedly in this repo

### Loader + cache + deterministic order
```rust
static REGISTRY: OnceCell<Vec<Item>> = OnceCell::new();

pub fn list_items() -> &'static [Item] {
    REGISTRY.get_or_init(load_items).as_slice()
}

fn load_items() -> Vec<Item> {
    let mut items = read_items_from_manifest();
    items.sort_by(|a, b| a.id.cmp(&b.id));
    items
}
```

### Parse + normalize + fallback
```rust
let label = raw
    .get("label")
    .and_then(Value::as_str)
    .map(str::to_string)
    .unwrap_or_else(|| title_case(id));
```

### Chain + stable filter
```rust
let spv_files = fs::read_dir(root)
    .into_iter()
    .flatten()
    .flatten()
    .map(|entry| entry.path())
    .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("spv"))
    .collect::<Vec<_>>();
```

### Explicit error boundary
```rust
let contents = fs::read_to_string(&path).unwrap_or_else(|err| {
    panic!("failed to read manifest {}: {}", path.display(), err)
});
```

Use `panic!` only when the file is a build-time invariant and failure should abort generation.
Use `Result` when the caller can still recover.

---

## 9) What the importer seems to damage most

The imported scaffold tends to destroy:
- small helper bodies with one real branch
- registry merges that should have been sort/dedup logic
- constructors that should have obvious defaults
- serialize/deserialize helpers that should have field normalization
- narrow validators that should have one parse / one check / one return path

It tends to preserve:
- enum tags
- file-level structure
- obvious type names
- manifest schemas

So the repair workflow should follow the preserved structure, not the hollow body.

---

## 10) Minimal repair order

When opening a hollow utility body, repair in this order:

1. Identify the contract from the surrounding types and call sites.
2. Rebuild the data path.
3. Restore normalization and ordering.
4. Restore error behavior.
5. Collapse the result into the simplest readable form.

If you cannot recover step 1, keep the stub and mark the boundary honestly.

---

## Short version

- Constructors: restore defaults and ownership.
- Caches: load once, normalize, sort, and cache.
- Serialization helpers: parse leniently, normalize strictly.
- Method chains: keep them if they are still the clearest expression.
- Stubs: only for unknown or boundary-only behavior.
- Clean rewrites: better than pretending a hollow body is repaired.

This is not about preserving the importer. It is about restoring the contract without inventing new lies.

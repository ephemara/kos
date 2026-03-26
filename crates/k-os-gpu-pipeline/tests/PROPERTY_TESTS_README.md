# Property-Based Tests for k-os-gpu-pipeline

This document describes the property-based tests for the k-os-gpu-pipeline crate, which validate correctness properties across arbitrary inputs using the `proptest` framework.

## Overview

Property-based testing validates that certain properties hold true for all valid inputs, rather than testing specific examples. This provides stronger correctness guarantees than traditional unit tests.

## Test Properties

### Property 1: Pipeline Caching Consistency
**Validates: Requirements 1.1, 1.2**

**Property Statement:** For any shader name, calling `get_or_create_pipeline` multiple times returns the same cached pipeline instance.

**Sub-Properties:**
1. Cache count increases by at most 1 on first access
2. Cache count remains constant on subsequent accesses
3. Multiple accesses to the same shader name return the same pipeline reference

**Test Functions:**
- `prop_pipeline_caching_returns_same_instance` - Verifies cache reuse across multiple accesses
- `prop_pipeline_cache_count_increases_once` - Verifies cache count behavior

**Strategy:**
- Generates random shader names from a predefined set
- Tests with 2-10 accesses per shader
- Verifies cache count invariants

### Property 2: Buffer Pool Size Guarantee
**Validates: Requirement 1.3**

**Property Statement:** For any buffer request, the returned buffer has size greater than or equal to the requested size and is aligned to bucket granularity.

**Sub-Properties:**
1. `actual_size >= requested_size` for all allocations
2. `actual_size % granularity == 0` (alignment guarantee)
3. `size_to_bucket(S) * granularity >= S` (bucket calculation correctness)
4. Buffer usage flags are preserved

**Test Functions:**
- `prop_buffer_size_guarantee` - Verifies size >= requested size
- `prop_buffer_size_aligned_to_granularity` - Verifies alignment and bucket calculation
- `prop_buffer_usage_flags_preserved` - Verifies usage flags are preserved

**Strategy:**
- Generates random buffer sizes from 1 byte to 1 MB
- Generates various buffer usage flag combinations
- Tests 50 cases per property

### Property 3: Buffer Pool Reuse
**Validates: Requirement 1.4**

**Property Statement:** For any buffer, returning it to the pool makes it available for subsequent allocation requests with the same size and usage.

**Sub-Properties:**
1. Pool count increases when buffers are returned
2. Pool count decreases when buffers are reused
3. Reused buffers have the same size as the original
4. Buffers with different usage flags are not reused incorrectly
5. Total allocations - deallocations ≈ pool count (within limits)

**Test Functions:**
- `prop_buffer_pool_reuse` - Verifies basic reuse behavior
- `prop_buffer_pool_memory_tracking` - Verifies pool count changes correctly
- `prop_buffer_pool_allocation_balance` - Verifies allocation/deallocation balance
- `prop_buffer_pool_usage_isolation` - Verifies usage flag isolation

**Strategy:**
- Generates sequences of allocations and deallocations
- Tests with 1-10 operations per test case
- Verifies pool count invariants at each step

### Additional Edge Case Properties

**Property: Buffer Pool Respects Bucket Limit**
- Verifies `max_buffers_per_bucket` is enforced
- Tests with custom config limiting buckets to 3 buffers
- Allocates and returns 5-20 buffers

**Property: Buffer Pool Respects Memory Limit**
- Verifies `max_pool_memory` is enforced
- Tests with 16 KB memory limit
- Allocates and returns multiple buffers

## Running the Tests

### Basic Execution

```bash
# Run all property tests
cargo test --test property_tests --package k-os-gpu-pipeline

# Run with verbose output
cargo test --test property_tests --package k-os-gpu-pipeline -- --nocapture

# Run specific property test
cargo test --test property_tests prop_buffer_size_guarantee -- --nocapture
```

### Adjusting Test Cases

By default, proptest runs 100 test cases per property. You can adjust this:

```bash
# Run with more cases (recommended for CI)
PROPTEST_CASES=1000 cargo test --test property_tests --package k-os-gpu-pipeline

# Run with fewer cases (faster iteration during development)
PROPTEST_CASES=20 cargo test --test property_tests --package k-os-gpu-pipeline
```

### GPU Requirements

These tests require GPU access via wgpu. If no GPU is available:
- Tests will print "Skipping test: No GPU available"
- Tests will pass (not fail) when GPU is unavailable
- This allows tests to run in CI environments without GPU

## Test Strategies

### Buffer Size Strategy
```rust
fn buffer_size_strategy() -> impl Strategy<Value = u64> {
    1u64..1_000_000u64  // 1 byte to 1 MB
}
```

Generates random buffer sizes in a reasonable range for testing.

### Buffer Usage Strategy
```rust
fn buffer_usage_strategy() -> impl Strategy<Value = BufferUsages> {
    prop_oneof![
        Just(BufferUsages::STORAGE),
        Just(BufferUsages::UNIFORM),
        Just(BufferUsages::STORAGE | BufferUsages::COPY_DST),
        // ... more combinations
    ]
}
```

Generates common buffer usage flag combinations.

### Shader Name Strategy
```rust
fn shader_name_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("test_shader".to_string()),
        Just("compute_shader".to_string()),
        // ... more shader names
    ]
}
```

Generates shader names from a predefined set.

## Interpreting Results

### Successful Test
```
test prop_buffer_size_guarantee ... ok
```

All generated test cases passed the property.

### Failed Test
```
test prop_buffer_size_guarantee ... FAILED

thread 'prop_buffer_size_guarantee' panicked at 'Test failed: actual_size (2048) < requested_size (3000)'

minimal failing input: size = 3000, usage = STORAGE
```

Proptest will:
1. Show the failing assertion
2. Provide the minimal input that causes failure (shrinking)
3. Save the failing case for regression testing

### Shrinking

When a test fails, proptest automatically "shrinks" the input to find the minimal failing case:
- Starts with the failing input
- Tries smaller/simpler inputs
- Reports the simplest input that still fails

This makes debugging much easier.

## Configuration

Tests are configured with:
```rust
#![proptest_config(ProptestConfig::with_cases(50))]
```

This sets the number of test cases per property. Different properties use different case counts:
- Simple properties: 50 cases
- Complex properties: 20-30 cases
- Edge case tests: 20 cases

## Integration with CI

Recommended CI configuration:

```yaml
- name: Run Property Tests
  run: PROPTEST_CASES=1000 cargo test --test property_tests --package k-os-gpu-pipeline
  env:
    RUST_BACKTRACE: 1
```

This runs more iterations in CI for better coverage.

## Debugging Failed Tests

If a property test fails:

1. **Check the minimal failing input** - Proptest provides this automatically
2. **Run with verbose output** - Use `-- --nocapture` flag
3. **Add logging** - Tests use `env_logger`, set `RUST_LOG=debug`
4. **Reproduce the failure** - Proptest saves failing cases in `proptest-regressions/`
5. **Simplify the property** - Break complex properties into smaller ones

Example debugging session:
```bash
# Run with full logging
RUST_LOG=debug cargo test --test property_tests prop_buffer_size_guarantee -- --nocapture

# Check saved regression tests
cat proptest-regressions/property_tests.txt
```

## Coverage

These property tests provide coverage for:
- ✅ Pipeline caching behavior (Requirements 1.1, 1.2)
- ✅ Buffer size guarantees (Requirement 1.3)
- ✅ Buffer pool reuse (Requirement 1.4)
- ✅ Buffer pool memory limits
- ✅ Buffer pool bucket limits
- ✅ Usage flag isolation
- ✅ Allocation/deallocation balance

## Future Enhancements

Potential additional properties to test:
- Pipeline hot-reloading behavior
- Performance monitoring accuracy
- Concurrent access patterns (multi-threaded tests)
- GPU memory exhaustion handling
- Pipeline compilation error handling

## References

- [proptest documentation](https://docs.rs/proptest/)
- [Property-Based Testing Guide](https://hypothesis.works/articles/what-is-property-based-testing/)
- K_OS Design Document: `.kiro/specs/dcc-suite-comprehensive-enhancement/design.md`
- K_OS Requirements: `.kiro/specs/dcc-suite-comprehensive-enhancement/requirements.md`

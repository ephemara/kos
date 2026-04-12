# Property-Based Testing for K_OS Frontend

This directory contains property-based tests for the K_OS frontend using `fast-check` and `vitest`.

## Overview

Property-based testing verifies that universal properties hold across all inputs by generating random test cases. This complements traditional unit tests by finding edge cases that humans might miss.

## Configuration

### Test Case Count

All property tests run with `numRuns: 100` by default. Use the provided configurations:

- `PROPERTY_TEST_CONFIG` - Standard (100 runs)
- `FAST_PROPERTY_TEST_CONFIG` - Quick feedback (10 runs)
- `THOROUGH_PROPERTY_TEST_CONFIG` - CI/thorough testing (1000 runs)

```typescript
import { PROPERTY_TEST_CONFIG } from '@/tests/utils';

fc.assert(
  fc.property(arbitraryMesh(), (mesh) => {
    // Test implementation
  }),
  PROPERTY_TEST_CONFIG
);
```

## Available Generators

The `tests/utils/index.ts` module provides reusable arbitrary generators:

### Mesh Generators

- `arbitraryMesh()` - General mesh with positions and indices
- `arbitrarySmallMesh()` - Small mesh for fast tests
- `simpleTestMesh()` - Known-good meshes (triangle, quad, cube)

### Material Generators

- `arbitraryMaterial()` - PBR material parameters
- `arbitraryColor()` - RGBA color [0, 1]

### Brush Stroke Generators

- `arbitraryBrushStroke()` - Brush stroke parameters
- `arbitraryPosition3D()` - 3D position

### UV Coordinate Generators

- `arbitraryUVCoords()` - UV coordinates in [0, 1] range
- `arbitraryUVCoordsForVertices(vertexCount)` - UVs for specific vertex count

### Scene Generators

- `arbitraryScene()` - Complete scene with meshes and materials

### App State Generators

- `arbitraryAppName()` - Valid app name (ksculpt, kpainter, etc.)
- `arbitraryAppState()` - App state with name and data
- `arbitraryAppSwitchSequence()` - Sequence of app switches

### Configuration Generators

- `arbitraryConfigJSON()` - Configuration JSON (valid and invalid)
- `arbitraryBrushConfig()` - Brush configuration
- `arbitraryViewportPreset()` - Viewport preset configuration

## Helper Functions

### Comparison Helpers

- `floatsEqual(a, b, epsilon)` - Compare float arrays with tolerance
- `positionsEqual(a, b, epsilon)` - Compare 3D positions
- `uvsEqual(a, b, epsilon)` - Compare UV coordinates
- `topologyEquivalent(indicesA, indicesB)` - Check topology equivalence

### Validation Helpers

- `isValidMesh(positions, indices)` - Basic mesh validation
- `isValidUV(uvs, vertexCount)` - UV coordinate validation

## Writing Property Tests

### Basic Structure

```typescript
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbitraryMesh, PROPERTY_TEST_CONFIG } from '@/tests/utils';

/**
 * Feature: dcc-suite-production-readiness, Property X: Property Name
 * 
 * Description of what this property verifies.
 * 
 * Validates: Requirements X.Y
 */
describe('My Feature', () => {
  it('property test description', () => {
    fc.assert(
      fc.property(arbitraryMesh(), (mesh) => {
        // Test implementation
        const result = myFunction(mesh.positions, mesh.indices);
        expect(result).toBeTruthy();
      }),
      PROPERTY_TEST_CONFIG
    );
  });
});
```

### Using Multiple Generators

```typescript
it('test with multiple inputs', () => {
  fc.assert(
    fc.property(
      arbitraryMesh(),
      arbitraryMaterial(),
      arbitraryBrushStroke(),
      (mesh, material, stroke) => {
        // Test implementation
      }
    ),
    PROPERTY_TEST_CONFIG
  );
});
```

### Using Simple Test Meshes

```typescript
it('test with known meshes', () => {
  fc.assert(
    fc.property(simpleTestMesh(), (mesh) => {
      // Test with triangle, quad, or cube
      expect(isValidMesh(mesh.positions, mesh.indices)).toBe(true);
    }),
    PROPERTY_TEST_CONFIG
  );
});
```

## Example Tests

See `example.property.test.ts` for complete examples of property-based tests.

## Best Practices

1. **Tag with Feature and Property**: Always include feature name and property number in test documentation
2. **Validate Requirements**: Reference which requirements the property validates
3. **Use Appropriate Generators**: Choose mesh size based on test needs
4. **Set Epsilon Appropriately**: Use appropriate tolerance for float comparisons
5. **Mock External Dependencies**: Mock Tauri IPC and Three.js for unit tests
6. **Test Both Success and Failure**: Verify both correct behavior and error handling

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- example.property.test.ts

# Run tests matching pattern
npm test -- --grep "App State"
```

## Test Organization

```
src-frontend/tests/
├── README.md                    # This file
├── setup.ts                     # Test setup (mocks, globals)
├── utils/
│   └── index.ts                 # Arbitrary generators and helpers
├── example.property.test.ts     # Example property tests
└── [feature]/
    └── [feature].property.test.ts  # Feature-specific property tests
```

## Debugging Failed Tests

When a property test fails, fast-check will:

1. Show the failing input that caused the failure
2. Attempt to shrink the input to find the minimal failing case
3. Display the counterexample in the test output

To debug a failure:

```typescript
// Add the failing case as a unit test
it('reproduces specific failure', () => {
  const failingInput = { /* copy from test output */ };
  const result = myFunction(failingInput);
  expect(result).toBe(expectedValue);
});
```

## Mocking

### Tauri IPC

Tauri IPC is automatically mocked in `setup.ts`:

```typescript
// Already available in tests
window.__TAURI__.invoke('command_name', args);
```

### Three.js

WebGL context is mocked in `setup.ts` for Three.js tests.

### Custom Mocks

Add custom mocks in your test files:

```typescript
import { vi } from 'vitest';

vi.mock('@/services/sculptClient', () => ({
  sculptClient: {
    getMesh: vi.fn().mockResolvedValue({ /* mock data */ }),
  },
}));
```

## Integration with CI

Add to your CI pipeline:

```yaml
test:
  script:
    - npm test
    - npm run test:coverage
  coverage:
    target: 80%
```

## Coverage Goals

- **Property test coverage**: 100% of correctness properties from design document
- **Unit test coverage**: 80% of code
- **Integration test coverage**: All critical workflows

## Resources

- [fast-check documentation](https://fast-check.dev/)
- [Vitest documentation](https://vitest.dev/)
- [Property-Based Testing Guide](https://hypothesis.works/articles/what-is-property-based-testing/)
- Design document: `.kiro/specs/dcc-suite-production-readiness/design.md`

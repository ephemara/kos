# Implementation Plan: OptiMatrix Storage System

## Overview

OptiMatrix is a GPU-accelerated, matrix-based storage system for K_OS providing sub-millisecond asset access through intelligent caching and content-addressable deduplication. This implementation plan follows a phased approach over 10-12 weeks, building from core storage operations through GPU acceleration, versioning, transactions, and Python integration.

**Key Technologies:**
- Rust backend with RocksDB for persistence
- wgpu compute pipelines for GPU compression/decompression
- TypeScript client for Tauri IPC integration
- Python client for asset processing
- BLAKE3 content hashing for deduplication
- Multi-tier caching (GPU → RAM → Disk)

**Performance Targets:**
- <1ms retrieval from Flux Cache (GPU)
- <10ms store latency for assets <100MB
- <50ms cold retrieval from disk
- >500 MB/s compression throughput
- >80% cache hit rate

## Tasks

### Phase 1: Core Storage Engine (Week 1-2)

- [x] 1. Set up module structure and dependencies
  - Create `crates/k-os-engine/src/modules/storage/` directory structure
  - Add required crates to Cargo.toml: rocksdb, bincode, blake3, tokio, dashmap, thiserror, anyhow
  - Create mod.rs with public API exports
  - Set up test directory structure
  - _Requirements: 1.1, 6.1_

- [x] 2. Implement core asset types and handles
  - [x] 2.1 Create types.rs with AssetHandle, AssetType, AssetMetadata
    - Define AssetHandle as newtype wrapper around u64
    - Implement AssetType enum (Mesh, Animation, Texture, Material, SceneGraph, BinaryBlob)
    - Define MeshAsset, AnimationAsset, TextureAsset, MaterialAsset, SceneGraphAsset structs
    - Implement Serialize/Deserialize for all types
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 2.2 Write unit tests for asset type serialization
    - Test round-trip serialization for all asset types
    - Test edge cases (empty meshes, large textures)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. Implement RocksDB storage backend
  - [x] 3.1 Create backends/rocksdb.rs with RocksDbBackend
    - Implement StorageBackend trait with put/get/delete/exists methods
    - Set up RocksDB with column families (AssetData, Metadata, ContentStore, etc.)
    - Configure RocksDB options (compression, write buffer, cache size)
    - Implement key encoding schemes for efficient lookups
    - _Requirements: 1.1, 6.2_

  - [ ]* 3.2 Write unit tests for RocksDB backend
    - Test basic CRUD operations
    - Test concurrent access from multiple threads
    - Test recovery after simulated crash
    - _Requirements: 1.4, 9.5_

- [ ] 4. Implement StorageEngine core
  - [ ] 4.1 Create engine.rs with StorageEngine struct
    - Initialize with StorageConfig and GpuComputeDevice
    - Implement store() method with handle generation
    - Implement retrieve() method with error handling
    - Implement update() method (creates new version)
    - Implement delete() method with dependency checks
    - Add basic metrics tracking (operation counts, latency)
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [ ]* 4.2 Write property test for storage round-trip
    - **Property 1: Storage Round-Trip Preservation**
    - **Validates: Requirements 1.5**
    - Generate arbitrary assets, store and retrieve, verify equality
    - Run with minimum 100 iterations

  - [ ]* 4.3 Write unit tests for concurrent operations
    - Test multiple threads storing different assets simultaneously
    - Test concurrent store and retrieve operations
    - Verify no data corruption under concurrent load
    - _Requirements: 1.4_

- [ ] 5. Add Tauri IPC commands for basic operations
  - [ ] 5.1 Register storage commands in src-tauri/src/main.rs
    - Implement storage_store command
    - Implement storage_retrieve command
    - Implement storage_delete command
    - Add error serialization for Tauri IPC
    - Initialize global STORAGE_ENGINE instance
    - _Requirements: 8.1, 8.3, 8.6_

  - [ ] 5.2 Create TypeScript client in src-frontend/services/storageClient.ts
    - Implement store() method with binary serialization
    - Implement retrieve() method with deserialization
    - Implement delete() method
    - Add TypeScript types for AssetHandle, AssetMetadata
    - _Requirements: 8.2, 8.3_

  - [ ]* 5.3 Write integration tests for Tauri IPC
    - Test store/retrieve round-trip via IPC
    - Test error handling and propagation
    - Test large asset streaming
    - _Requirements: 8.4, 8.6_

- [ ] 6. Checkpoint - Core storage operational
  - Ensure all tests pass, ask the user if questions arise.

### Phase 2: Matrix Database (Week 3)

- [ ] 7. Implement multi-dimensional indexing
  - [ ] 7.1 Create matrix_db.rs with MatrixDatabase struct
    - Implement MatrixIndex with HashMap indices (by_handle, by_type, by_project, by_tag, by_time)
    - Implement dependency graph tracking (dependencies, dependents)
    - Add insert() method with index updates
    - Add get() method with index lookups
    - Add update_metadata() method
    - Add delete() method with dependency checks
    - _Requirements: 2.1, 2.4_

  - [ ]* 7.2 Write property test for referential integrity
    - **Property 3: Referential Integrity Preservation**
    - **Validates: Requirements 2.4**
    - Generate asset graphs with dependencies, verify all references exist
    - Run with minimum 100 iterations

  - [ ]* 7.3 Write unit tests for dependency tracking
    - Test adding assets with dependencies
    - Test querying dependents of an asset
    - Test circular dependency detection
    - _Requirements: 2.4_

- [ ] 8. Implement query system
  - [ ] 8.1 Create AssetQuery builder in matrix_db.rs
    - Implement query() method with filter support (type, project, tags, time_range)
    - Add pagination support (limit, offset)
    - Optimize queries using appropriate indices
    - Implement query result caching for repeated queries
    - _Requirements: 2.2, 2.3_

  - [ ]* 8.2 Write unit tests for query operations
    - Test query by type, project, tags, time range
    - Test complex queries with multiple filters
    - Test empty result sets
    - Test large result sets with pagination
    - Benchmark query performance with 10k assets
    - _Requirements: 2.2, 2.3_

- [ ] 9. Implement deletion policies
  - [ ] 9.1 Add deletion policy enforcement in matrix_db.rs
    - Implement check_dependencies() method
    - Add cascade deletion support
    - Add prevent deletion if dependents exist
    - Add orphan policy (remove references but keep asset)
    - Load deletion policy from Storage_Registry
    - _Requirements: 2.5_

  - [ ]* 9.2 Write property test for deletion policy enforcement
    - **Property 4: Dependency Deletion Policy Enforcement**
    - **Validates: Requirements 2.5**
    - Generate asset graphs, test each deletion policy
    - Run with minimum 100 iterations

- [ ] 10. Add query commands to Tauri IPC
  - [ ] 10.1 Implement storage_query command in src-tauri/src/main.rs
    - Add storage_query Tauri command
    - Add storage_get_metadata command
    - Serialize query results efficiently
    - _Requirements: 8.1_

  - [ ] 10.2 Add query methods to TypeScript client
    - Implement query() method in storageClient.ts
    - Implement getMetadata() method
    - Add TypeScript types for AssetQuery
    - _Requirements: 8.2_

  - [ ]* 10.3 Write integration tests for query IPC
    - Test query operations via Tauri IPC
    - Test metadata retrieval
    - Test query performance with large datasets
    - _Requirements: 8.1, 8.2_

- [ ] 11. Checkpoint - Matrix database operational
  - Ensure all tests pass, ask the user if questions arise.

### Phase 3: GPU Compression Pipeline (Week 4)

- [ ] 12. Create WGSL compression shaders
  - [ ] 12.1 Create compression.wgsl in crates/k-os-engine/src/gpu/pipelines/
    - Implement quantize_positions compute shader (16-bit quantization)
    - Implement encode_normals compute shader (octahedral encoding)
    - Ensure 16-byte alignment for all uniform buffers (use vec4<f32>)
    - Add workgroup size optimization (@workgroup_size(256))
    - _Requirements: 3.1, 3.5_

  - [ ] 12.2 Create decompression.wgsl shader
    - Implement dequantize_positions compute shader
    - Implement decode_normals compute shader
    - Match alignment with compression shader
    - _Requirements: 3.2, 3.7_

- [ ] 13. Implement Rust compression pipeline wrapper
  - [ ] 13.1 Create compression.rs in crates/k-os-engine/src/gpu/pipelines/
    - Implement CompressionPipeline struct with wgpu device
    - Implement MeshCompressor with compute pipeline setup
    - Add compress_mesh() method using GPU compute
    - Add decompress_mesh() method using GPU compute
    - Implement buffer pooling for zero-copy operations
    - Add CPU fallback for when GPU unavailable
    - _Requirements: 3.1, 3.2, 3.6_

  - [ ]* 13.2 Write property test for compression round-trip
    - **Property 7: Compression Round-Trip Equivalence**
    - **Validates: Requirements 3.7**
    - Generate arbitrary meshes, compress and decompress, verify equivalence
    - Test both lossless and lossy compression with tolerance
    - Run with minimum 100 iterations

  - [ ]* 13.3 Write unit tests for compression pipeline
    - Test GPU compression vs CPU fallback
    - Test compression ratio validation (>3:1 for meshes)
    - Test edge cases (empty mesh, single triangle)
    - Benchmark compression throughput (target: 500 MB/s)
    - _Requirements: 3.5, 3.6_

- [ ] 14. Integrate compression with storage engine
  - [ ] 14.1 Add compression to StorageEngine in engine.rs
    - Initialize CompressionPipeline with GPU device
    - Compress assets before storing to backend
    - Decompress assets after retrieving from backend
    - Load compression policies from Storage_Registry
    - Add compression metrics tracking
    - _Requirements: 6.4_

  - [ ]* 14.2 Write integration tests for compressed storage
    - Test store/retrieve with compression enabled
    - Test compression policy per asset type
    - Test GPU fallback to CPU compression
    - _Requirements: 3.1, 3.2, 6.4_

- [ ] 15. Add texture compression support
  - [ ] 15.1 Implement texture compression in compression.rs
    - Add TextureCompressor struct
    - Implement BC7 compression using wgpu compute
    - Add compress_texture() and decompress_texture() methods
    - Support multiple texture formats (2D, cubemap, 3D)
    - _Requirements: 5.3_

  - [ ]* 15.2 Write unit tests for texture compression
    - Test various texture formats and sizes
    - Test compression quality settings
    - Benchmark texture compression throughput
    - _Requirements: 5.3_

- [ ] 16. Checkpoint - GPU compression operational
  - Ensure all tests pass, ask the user if questions arise.

### Phase 4: Flux Cache (Week 5)

- [ ] 17. Implement GPU buffer pool
  - [ ] 17.1 Create cache.rs with FluxCache struct
    - Implement BufferPool for wgpu buffer management
    - Add buffer allocation and deallocation
    - Implement zero-copy buffer staging
    - Add buffer reuse to minimize allocations
    - Configure max GPU memory usage from Storage_Registry
    - _Requirements: 3.3, 6.3_

  - [ ]* 17.2 Write unit tests for buffer pool
    - Test buffer allocation and reuse
    - Test memory limit enforcement
    - Test concurrent buffer access
    - _Requirements: 3.3_

- [ ] 18. Implement Flux Cache with LRU eviction
  - [ ] 18.1 Add FluxCache implementation in cache.rs
    - Implement FluxCacheEntry with wgpu::Buffer
    - Add LRU tracking with access timestamps
    - Implement get() method with <1ms target latency
    - Implement put() method with GPU buffer upload
    - Implement evict_lru() method for memory management
    - Add cache statistics tracking (hits, misses, evictions)
    - _Requirements: 3.3, 3.4, 7.3_

  - [ ]* 18.2 Write unit tests for Flux Cache
    - Test cache hit and miss scenarios
    - Test LRU eviction behavior
    - Test cache size limit enforcement
    - Benchmark cache access latency (target: <1ms)
    - _Requirements: 3.4, 7.3_

- [ ] 19. Implement multi-tier cache manager
  - [ ] 19.1 Create CacheManager in cache.rs
    - Implement MemoryCache for RAM tier (using DashMap)
    - Add CacheManager coordinating Flux Cache and Memory Cache
    - Implement get() with tier fallback (GPU → RAM → disk)
    - Implement put() with cache admission policy
    - Add prefetch() method for predictive loading
    - Implement invalidate() for cache coherence
    - _Requirements: 6.3, 7.3_

  - [ ]* 19.2 Write unit tests for cache manager
    - Test multi-tier cache fallback
    - Test cache admission policy
    - Test prefetching behavior
    - Test cache invalidation
    - _Requirements: 6.3, 7.3_

- [ ] 20. Integrate cache with storage engine
  - [ ] 20.1 Add CacheManager to StorageEngine in engine.rs
    - Initialize CacheManager with Flux Cache and Memory Cache
    - Route retrieve() through cache layers
    - Update cache on store() operations
    - Invalidate cache on delete() operations
    - Add cache metrics to StorageMetrics
    - _Requirements: 1.2, 1.3, 7.3_

  - [ ]* 20.2 Write integration tests for cached storage
    - Test cache hit rate with realistic workload
    - Test cache performance improvement
    - Test cache coherence after updates
    - Benchmark end-to-end latency with cache
    - _Requirements: 3.4, 7.3_

- [ ] 21. Add cache control to Tauri IPC
  - [ ] 21.1 Implement cache commands in src-tauri/src/main.rs
    - Add storage_prefetch command
    - Add storage_invalidate_cache command
    - Add storage_get_cache_stats command
    - _Requirements: 8.1_

  - [ ] 21.2 Add cache methods to TypeScript client
    - Implement prefetch() in storageClient.ts
    - Implement getCacheStats() method
    - Add cache priority hints to store() method
    - _Requirements: 8.2_

- [ ] 22. Checkpoint - Flux Cache operational
  - Ensure all tests pass, ask the user if questions arise.

### Phase 5: Entanglement Layer (Week 6)

- [ ] 23. Implement content-addressable storage
  - [ ] 23.1 Create entanglement.rs with EntanglementLayer
    - Implement ContentIndex with hash-to-location mapping
    - Add BLAKE3 content hashing (use blake3 crate)
    - Implement store_content() with deduplication check
    - Implement get_content() by content hash
    - Add reference counting for shared content
    - _Requirements: 4.1, 4.2_

  - [ ]* 23.2 Write property test for content deduplication
    - **Property 8: Content Deduplication Uniqueness**
    - **Validates: Requirements 4.2**
    - Store identical assets in multiple projects, verify single physical copy
    - Run with minimum 100 iterations

  - [ ]* 23.3 Write unit tests for content-addressable storage
    - Test content hashing consistency
    - Test deduplication across projects
    - Test reference counting
    - _Requirements: 4.1, 4.2_

- [ ] 24. Implement quantum link management
  - [ ] 24.1 Add LinkRegistry to entanglement.rs
    - Implement handle-to-hash and hash-to-handles mappings
    - Add create_link() method
    - Add remove_link() method with ref count update
    - Implement get_linked_handles() for shared asset queries
    - _Requirements: 4.3, 4.5_

  - [ ]* 24.2 Write unit tests for quantum links
    - Test link creation and removal
    - Test querying linked handles
    - Test reference counting updates
    - _Requirements: 4.3, 4.5_

- [ ] 25. Implement copy-on-write for shared assets
  - [ ] 25.1 Add copy-on-write logic to StorageEngine
    - Detect when modifying shared asset (ref_count > 1)
    - Create new content copy on modification
    - Update quantum link to new content hash
    - Decrement ref count on original content
    - _Requirements: 4.4_

  - [ ]* 25.2 Write property test for copy-on-write isolation
    - **Property 9: Copy-On-Write Isolation**
    - **Validates: Requirements 4.4**
    - Modify shared assets, verify isolation between projects
    - Run with minimum 100 iterations

- [ ] 26. Implement garbage collection
  - [ ] 26.1 Add garbage collection to entanglement.rs
    - Implement find_orphans() to identify ref_count == 0 content
    - Add gc_orphans() to delete orphaned content
    - Implement scheduled GC based on Storage_Registry interval
    - Add GC metrics tracking (orphans found, bytes freed)
    - _Requirements: 4.6, 6.5_

  - [ ]* 26.2 Write property test for garbage collection correctness
    - **Property 10: Garbage Collection Correctness**
    - **Validates: Requirements 4.6**
    - Remove all references to content, verify GC removes it
    - Run with minimum 100 iterations

  - [ ]* 26.3 Write unit tests for garbage collection
    - Test orphan detection
    - Test GC execution
    - Test GC scheduling
    - Test GC metrics
    - _Requirements: 4.6, 6.5_

- [ ] 27. Integrate entanglement with storage engine
  - [ ] 27.1 Add EntanglementLayer to StorageEngine
    - Initialize EntanglementLayer in StorageEngine
    - Route store() through entanglement for deduplication
    - Route retrieve() through entanglement for shared assets
    - Update delete() to handle quantum link removal
    - Load entanglement policies from Storage_Registry
    - _Requirements: 4.1, 4.2, 6.5_

  - [ ]* 27.2 Write integration tests for entangled storage
    - Test cross-project asset sharing
    - Test deduplication space savings
    - Test copy-on-write behavior
    - Test garbage collection integration
    - _Requirements: 4.1, 4.2, 4.4, 4.6_

- [ ] 28. Checkpoint - Entanglement layer operational
  - Ensure all tests pass, ask the user if questions arise.

### Phase 6: Version Manager (Week 7)

- [ ] 29. Implement version chain storage
  - [ ] 29.1 Create version.rs with VersionManager
    - Implement VersionChain struct with version history
    - Add VersionEntry with timestamp, content hash, delta
    - Implement create_version() method
    - Store version chains in RocksDB Versions column family
    - Add version metadata tracking
    - _Requirements: 10.1, 10.2_

  - [ ]* 29.2 Write property test for version chain preservation
    - **Property 13: Version Chain Preservation**
    - **Validates: Requirements 10.1**
    - Modify assets multiple times, verify all versions preserved
    - Run with minimum 100 iterations

  - [ ]* 29.3 Write unit tests for version storage
    - Test version creation
    - Test version history queries
    - Test version metadata
    - _Requirements: 10.1, 10.2_

- [ ] 30. Implement delta compression
  - [ ] 30.1 Add DeltaCompressor to version.rs
    - Implement binary diff algorithm (use similar crate or custom)
    - Add compute_delta() method
    - Add apply_delta() method
    - Optimize delta storage for version chains
    - _Requirements: 10.6_

  - [ ]* 30.2 Write unit tests for delta compression
    - Test delta computation
    - Test delta application
    - Test delta compression ratio
    - Test delta chain reconstruction
    - _Requirements: 10.6_

- [ ] 31. Implement version queries
  - [ ] 31.1 Add version query methods to version.rs
    - Implement get_version() by version number
    - Implement get_at_time() by timestamp
    - Implement list_versions() for version history
    - Optimize version reconstruction from deltas
    - _Requirements: 10.3_

  - [ ]* 31.2 Write unit tests for version queries
    - Test querying specific versions
    - Test temporal queries
    - Test version listing
    - Test version reconstruction performance
    - _Requirements: 10.3_

- [ ] 32. Implement version revert and pruning
  - [ ] 32.1 Add revert() and prune() to version.rs
    - Implement revert() to restore previous version
    - Implement prune() with retention policies (keep_all, keep_last_n, keep_since, keep_major)
    - Load retention policies from Storage_Registry
    - Add pruning metrics tracking
    - _Requirements: 10.4, 10.5, 6.6_

  - [ ]* 32.2 Write property test for version revert consistency
    - **Property 14: Version Revert Consistency**
    - **Validates: Requirements 10.4**
    - Revert to previous versions, verify exact state restoration
    - Run with minimum 100 iterations

  - [ ]* 32.3 Write property test for retention policy compliance
    - **Property 15: Version Retention Policy Compliance**
    - **Validates: Requirements 10.5**
    - Apply retention policies, verify correct versions kept/removed
    - Run with minimum 100 iterations

  - [ ]* 32.4 Write unit tests for version operations
    - Test version revert
    - Test version pruning with different policies
    - Test pruning metrics
    - _Requirements: 10.4, 10.5_

- [ ] 33. Integrate versioning with storage engine
  - [ ] 33.1 Add VersionManager to StorageEngine
    - Initialize VersionManager in StorageEngine
    - Modify update() to create versions automatically
    - Add version query methods to StorageEngine API
    - Add version revert and pruning commands
    - _Requirements: 10.1, 10.3, 10.4, 10.5_

  - [ ]* 33.2 Write integration tests for versioned storage
    - Test automatic version creation on updates
    - Test version queries through StorageEngine
    - Test version revert workflow
    - Test version pruning integration
    - _Requirements: 10.1, 10.3, 10.4, 10.5_

- [ ] 34. Add version commands to Tauri IPC
  - [ ] 34.1 Implement version commands in src-tauri/src/main.rs
    - Add storage_list_versions command
    - Add storage_get_version command
    - Add storage_revert_version command
    - Add storage_prune_versions command
    - _Requirements: 8.1_

  - [ ] 34.2 Add version methods to TypeScript client
    - Implement listVersions() in storageClient.ts
    - Implement getVersion() method
    - Implement revertVersion() method
    - Add TypeScript types for version data
    - _Requirements: 8.2_

- [ ] 35. Checkpoint - Version manager operational
  - Ensure all tests pass, ask the user if questions arise.

### Phase 7: Transaction Manager (Week 8)

- [ ] 36. Implement write-ahead log
  - [ ] 36.1 Create transaction.rs with WriteAheadLog
    - Implement WAL file management
    - Add append() method for logging operations
    - Add commit() method for marking transactions complete
    - Implement replay() for crash recovery
    - Add checkpoint() for log truncation
    - Configure checkpoint interval from Storage_Registry
    - _Requirements: 9.4, 9.5_

  - [ ]* 36.2 Write unit tests for write-ahead log
    - Test WAL append and commit
    - Test WAL replay after simulated crash
    - Test checkpoint and truncation
    - _Requirements: 9.4, 9.5_

- [ ] 37. Implement transaction management
  - [ ] 37.1 Add TransactionManager to transaction.rs
    - Implement Transaction struct with operation list
    - Add begin() method to start transactions
    - Add add_operation() to queue operations
    - Implement commit() with atomic application
    - Implement rollback() with state restoration
    - Add transaction timeout handling
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 37.2 Write property test for transaction atomicity
    - **Property 5: Transaction Atomicity**
    - **Validates: Requirements 9.2**
    - Execute transactions with multiple operations, verify all-or-nothing
    - Run with minimum 100 iterations

  - [ ]* 37.3 Write property test for rollback completeness
    - **Property 6: Transaction Rollback Completeness**
    - **Validates: Requirements 9.3**
    - Rollback transactions, verify complete state restoration
    - Run with minimum 100 iterations

  - [ ]* 37.4 Write unit tests for transaction manager
    - Test transaction commit
    - Test transaction rollback
    - Test concurrent transactions
    - Test transaction timeout
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 38. Implement lock manager for concurrent transactions
  - [ ] 38.1 Add LockManager to transaction.rs
    - Implement lock acquisition for asset handles
    - Add deadlock detection
    - Implement lock timeout handling
    - Add lock release on transaction completion
    - _Requirements: 9.1_

  - [ ]* 38.2 Write unit tests for lock manager
    - Test lock acquisition and release
    - Test deadlock detection
    - Test concurrent transaction isolation
    - _Requirements: 9.1_

- [ ] 39. Implement crash recovery
  - [ ] 39.1 Add recovery logic to TransactionManager
    - Implement recover() method using WAL replay
    - Add incomplete transaction detection
    - Implement automatic rollback of incomplete transactions
    - Add recovery metrics tracking
    - Ensure recovery completes within 5 seconds for <100GB databases
    - _Requirements: 9.5, 9.6_

  - [ ]* 39.2 Write unit tests for crash recovery
    - Test recovery from simulated crashes
    - Test incomplete transaction rollback
    - Test recovery performance
    - _Requirements: 9.5, 9.6_

- [ ] 40. Integrate transactions with storage engine
  - [ ] 40.1 Add TransactionManager to StorageEngine
    - Initialize TransactionManager in StorageEngine
    - Add begin_transaction() method to StorageEngine API
    - Route multi-asset operations through transactions
    - Add transaction recovery on engine initialization
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [ ]* 40.2 Write integration tests for transactional storage
    - Test multi-asset atomic operations
    - Test transaction commit and rollback
    - Test crash recovery integration
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

- [ ] 41. Add transaction commands to Tauri IPC
  - [ ] 41.1 Implement transaction commands in src-tauri/src/main.rs
    - Add storage_begin_transaction command
    - Add storage_commit_transaction command
    - Add storage_rollback_transaction command
    - _Requirements: 8.1_

  - [ ] 41.2 Add transaction methods to TypeScript client
    - Implement beginTransaction() in storageClient.ts
    - Add transaction builder pattern for chaining operations
    - Add TypeScript types for transaction operations
    - _Requirements: 8.2_

- [ ] 42. Checkpoint - Transaction manager operational
  - Ensure all tests pass, ask the user if questions arise.

### Phase 8: Import/Export (Week 9)

- [ ] 43. Implement glTF export
  - [ ] 43.1 Create import_export.rs with glTF exporter
    - Add gltf crate dependency to Cargo.toml
    - Implement export_gltf() for mesh assets
    - Convert MeshAsset to glTF format
    - Preserve material references and metadata
    - Support batch export of multiple assets
    - _Requirements: 11.1, 11.3, 11.4_

  - [ ]* 43.2 Write unit tests for glTF export
    - Test mesh export to glTF
    - Test metadata preservation
    - Test batch export
    - _Requirements: 11.1, 11.3, 11.4_

- [x] 44. Implement glTF, FBX, USD, OBJ , PBR, SUBSTANCE MATERIAL, AND OTHER import
  - [x] 44.1 Add glTF, glTF, FBX, USD, OBJ , PBR, SUBSTANCE MATERIAL importer to import_export.rs
    - Implement import_(FILE) method
    - Parse glTF, FBX, USD, OBJ , PBR, SUBSTANCE MATERIAL and extract mesh data
    - Detect and create appropriate asset types
    - Preserve metadata from glTF, FBX, USD, OBJ , PBR, SUBSTANCE MATERIAL extras
    - Support batch import with automatic type detection
    - _Requirements: 11.2, 11.3, 11.5_

  - [ ]* 44.2 Write property test for glTF round-trip
    - **Property 17: Export-Import Data Round-Trip**
    - **Validates: Requirements 11.6**
    - Export assets to glTF, import back, verify functional equivalence
    - Run with minimum 100 iterations

  - [ ]* 44.3 Write unit tests for glTF import
    - Test glTF parsing and import
    - Test automatic type detection
    - Test batch import
    - _Requirements: 11.2, 11.5_

- [ ] 45. Implement texture export/import
  - [ ] 45.1 Add PNG/EXR exporters to import_export.rs
    - Add image crate dependency for PNG support
    - Add openexr crate dependency for EXR support
    - Implement export_png() for 8-bit textures
    - Implement export_exr() for HDR textures
    - Convert TextureAsset to image formats
    - _Requirements: 11.1_

  - [ ] 45.2 Add PNG/EXR importers to import_export.rs
    - Implement import_png() method
    - Implement import_exr() method
    - Detect texture format and dimensions
    - Create TextureAsset from imported data
    - _Requirements: 11.2_

  - [ ]* 45.3 Write property test for texture export-import metadata preservation
    - **Property 16: Export-Import Metadata Preservation**
    - **Validates: Requirements 11.3**
    - Export assets with metadata, import back, verify metadata preserved
    - Run with minimum 100 iterations

  - [ ]* 45.4 Write unit tests for texture import/export
    - Test PNG export and import
    - Test EXR export and import
    - Test various texture formats
    - _Requirements: 11.1, 11.2_

- [ ] 46. Integrate import/export with storage engine
  - [ ] 46.1 Add import/export methods to StorageEngine
    - Add export() method with format selection
    - Add import() method with automatic type detection
    - Add batch_export() for project export
    - Add batch_import() for project import
    - _Requirements: 11.1, 11.2, 11.4, 11.5_

  - [ ]* 46.2 Write integration tests for import/export
    - Test export/import workflow
    - Test batch operations
    - Test format conversion
    - _Requirements: 11.1, 11.2, 11.4, 11.5_

- [ ] 47. Add import/export commands to Tauri IPC
  - [ ] 47.1 Implement import/export commands in src-tauri/src/main.rs
    - Add storage_export command with format parameter
    - Add storage_import command with format detection
    - Add storage_batch_export command
    - Add storage_batch_import command
    - Add progress events for long operations
    - _Requirements: 8.1, 8.5_

  - [ ] 47.2 Add import/export methods to TypeScript client
    - Implement export() in storageClient.ts
    - Implement import() method
    - Add progress callback support
    - Add file download/upload helpers
    - _Requirements: 8.2, 8.5_

  - [ ]* 47.3 Write integration tests for import/export IPC
    - Test export via Tauri IPC
    - Test import via Tauri IPC
    - Test progress callbacks
    - _Requirements: 8.1, 8.5_

- [ ] 48. Checkpoint - Import/export operational
  - Ensure all tests pass, ask the user if questions arise.

### Phase 9: Python Integration (Week 10)

- [ ] 49. Create Python client library
  - [ ] 49.1 Create src-python/kos/storage.py with StorageClient
    - Implement StorageClient class with async methods
    - Add store_mesh() method with NumPy array support
    - Add retrieve_mesh() method returning NumPy arrays
    - Add query() method with filter support
    - Add export_gltf() and import_gltf() methods
    - Add dataclasses for AssetMetadata, MeshAsset
    - _Requirements: 12.2, 12.3_

  - [ ]* 49.2 Write unit tests for Python client
    - Test store and retrieve operations
    - Test NumPy array conversion
    - Test query operations
    - _Requirements: 12.2, 12.3_

- [ ] 50. Implement JSON-RPC bindings
  - [ ] 50.1 Add storage functions to src-tauri/src/python_bridge.rs
    - Register storage.store_mesh function
    - Register storage.retrieve_mesh function
    - Register storage.query function
    - Register storage.export function
    - Register storage.import function
    - Handle NumPy array serialization efficiently
    - _Requirements: 12.1_

  - [ ]* 50.2 Write integration tests for Python JSON-RPC
    - Test Python-to-Rust storage operations
    - Test data serialization
    - Test error handling
    - _Requirements: 12.1_

- [ ] 51. Implement asset processor framework
  - [ ] 51.1 Add processor registration to storage.py
    - Create @register decorator for asset processors
    - Implement example processors (smooth, decimate, subdivide)
    - Add processor discovery and registration
    - Implement laplacian_smooth() example processor
    - _Requirements: 12.5_

  - [ ] 51.2 Add processor invocation to StorageEngine
    - Load Python processors from Storage_Registry
    - Add invoke_processor() method to StorageEngine
    - Route import/export through processors when configured
    - Add processor error handling
    - _Requirements: 12.5, 12.6_

  - [ ]* 51.3 Write unit tests for asset processors
    - Test processor registration
    - Test processor invocation
    - Test example processors
    - _Requirements: 12.5, 12.6_

- [ ] 52. Implement streaming for large assets
  - [ ] 52.1 Add streaming support to Python client
    - Implement chunked data transfer for large assets
    - Add streaming methods to avoid full memory load
    - Implement progress callbacks for Python
    - _Requirements: 12.4_

  - [ ]* 52.2 Write unit tests for streaming
    - Test large asset streaming
    - Test memory usage during streaming
    - Test progress callbacks
    - _Requirements: 12.4_

- [ ] 53. Create Python examples and documentation
  - [ ] 53.1 Create example Python scripts
    - Create example_mesh_processing.py demonstrating mesh operations
    - Create example_batch_import.py for batch operations
    - Create example_custom_processor.py for custom processors
    - Add docstrings to all Python API methods
    - _Requirements: 12.2, 12.5_

  - [ ] 53.2 Write Python API documentation
    - Document StorageClient API
    - Document asset processor framework
    - Add usage examples
    - Document NumPy integration
    - _Requirements: 12.2, 12.5_

- [ ] 54. Checkpoint - Python integration operational
  - Ensure all tests pass, ask the user if questions arise.

### Phase 10: Configuration & Schema System (Week 10 continued)

- [ ] 55. Implement Storage_Registry configuration
  - [ ] 55.1 Create config.rs with StorageConfig
    - Define StorageConfig struct matching JSON schema
    - Implement backend configuration (RocksDB, memory, remote)
    - Add cache policy configuration
    - Add compression policy configuration
    - Add entanglement policy configuration
    - Add version policy configuration
    - Add performance thresholds configuration
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ] 55.2 Implement configuration loading
    - Load Storage_Registry from config/storage_registry.json
    - Implement JSON schema validation
    - Add configuration error handling with safe defaults
    - Implement hot-reload support
    - _Requirements: 6.1, 6.6, 6.7_

  - [ ]* 55.3 Write property test for invalid configuration fallback
    - **Property 12: Invalid Configuration Fallback**
    - **Validates: Requirements 6.7**
    - Generate invalid configurations, verify safe defaults used
    - Run with minimum 100 iterations

  - [ ]* 55.4 Write unit tests for configuration
    - Test configuration loading
    - Test schema validation
    - Test hot-reload
    - Test error handling
    - _Requirements: 6.1, 6.6, 6.7_

- [ ] 56. Implement schema registry for custom asset types
  - [ ] 56.1 Create schema.rs with SchemaRegistry
    - Implement SchemaRegistry for custom asset types
    - Add schema validation using JSON schema
    - Load custom schemas from Storage_Registry
    - Add schema validation on asset store
    - _Requirements: 5.7_

  - [ ]* 56.2 Write property test for schema validation enforcement
    - **Property 11: Schema Validation Enforcement**
    - **Validates: Requirements 5.7**
    - Generate invalid assets, verify validation rejection
    - Run with minimum 100 iterations

  - [ ]* 56.3 Write unit tests for schema registry
    - Test schema registration
    - Test schema validation
    - Test custom asset types
    - _Requirements: 5.7_

- [ ] 57. Create default Storage_Registry configuration
  - [ ] 57.1 Create config/storage_registry.json
    - Define default backend configuration (RocksDB primary)
    - Set default cache policies (512MB Flux, 2GB Memory)
    - Configure compression policies per asset type
    - Set entanglement policies (auto-dedupe enabled)
    - Configure version retention (keep_last_n: 10)
    - Set performance thresholds
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 58. Checkpoint - Configuration system operational
  - Ensure all tests pass, ask the user if questions arise.

### Phase 11: Performance Monitoring & Metrics (Week 11)

- [ ] 59. Implement metrics collection
  - [ ] 59.1 Create metrics.rs with StorageMetrics
    - Define StorageMetrics, LatencyStats, ThroughputStats, CacheStats structs
    - Implement metrics collection for all operations
    - Add histogram tracking for latency (min, max, avg, p50, p95, p99)
    - Track throughput (ops/sec, bytes/sec)
    - Track cache hit rates per tier
    - Track storage utilization per backend
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 59.2 Write unit tests for metrics collection
    - Test latency tracking
    - Test throughput calculation
    - Test cache statistics
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 60. Implement performance threshold monitoring
  - [ ] 60.1 Add threshold checking to metrics.rs
    - Load performance thresholds from Storage_Registry
    - Implement threshold violation detection
    - Add warning logging for threshold violations
    - Track violation frequency
    - _Requirements: 7.6_

  - [ ]* 60.2 Write unit tests for threshold monitoring
    - Test threshold violation detection
    - Test warning logging
    - _Requirements: 7.6_

- [ ] 61. Add metrics commands to Tauri IPC
  - [ ] 61.1 Implement metrics commands in src-tauri/src/main.rs
    - Add storage_get_metrics command (already partially implemented)
    - Add storage_get_cache_stats command
    - Add storage_get_backend_stats command
    - Add real-time metrics streaming via events
    - _Requirements: 7.5, 8.1_

  - [ ] 61.2 Add metrics methods to TypeScript client
    - Implement getMetrics() in storageClient.ts (already partially implemented)
    - Add real-time metrics subscription
    - Add TypeScript types for all metrics
    - _Requirements: 7.5, 8.2_

  - [ ]* 61.3 Write integration tests for metrics IPC
    - Test metrics retrieval via IPC
    - Test real-time metrics streaming
    - _Requirements: 7.5, 8.1_

- [ ] 62. Create metrics visualization UI (optional)
  - [ ] 62.1 Create StorageMetrics.tsx in src-frontend/features/system/storage/
    - Display real-time cache hit rate
    - Show operation latency graphs
    - Display throughput metrics
    - Show storage utilization per backend
    - Add performance threshold indicators
    - _Requirements: 7.5_

  - [ ] 62.2 Integrate metrics UI with K_OS
    - Register metrics panel in app configuration
    - Add metrics dashboard to system tools
    - _Requirements: 7.5_

- [ ] 63. Checkpoint - Metrics system operational
  - Ensure all tests pass, ask the user if questions arise.

### Phase 12: Optimization & Polish (Week 11-12)

- [ ] 64. Run extended property tests
  - [ ]* 64.1 Execute all property tests with 10,000 iterations
    - Run Property 1: Storage Round-Trip (10k iterations)
    - Run Property 2: Concurrent Operation Safety (10k iterations)
    - Run Property 3: Referential Integrity (10k iterations)
    - Run Property 4: Deletion Policy Enforcement (10k iterations)
    - Run Property 5: Transaction Atomicity (10k iterations)
    - Run Property 6: Rollback Completeness (10k iterations)
    - Run Property 7: Compression Round-Trip (10k iterations)
    - Run Property 8: Content Deduplication (10k iterations)
    - Run Property 9: Copy-On-Write Isolation (10k iterations)
    - Run Property 10: Garbage Collection (10k iterations)
    - Run Property 11: Schema Validation (10k iterations)
    - Run Property 12: Invalid Configuration Fallback (10k iterations)
    - Run Property 13: Version Chain Preservation (10k iterations)
    - Run Property 14: Version Revert Consistency (10k iterations)
    - Run Property 15: Retention Policy Compliance (10k iterations)
    - Run Property 16: Export-Import Metadata Preservation (10k iterations)
    - Run Property 17: Export-Import Data Round-Trip (10k iterations)
    - Document any failures and fix issues

- [ ] 65. Performance profiling and optimization
  - [ ] 65.1 Profile hot paths with cargo flamegraph
    - Profile store operations
    - Profile retrieve operations
    - Profile query operations
    - Profile compression pipeline
    - Identify bottlenecks
    - _Requirements: 1.2, 1.3, 2.3, 3.6_

  - [ ] 65.2 Optimize identified bottlenecks
    - Optimize RocksDB configuration for workload
    - Tune cache admission policies
    - Optimize GPU buffer management
    - Reduce memory allocations
    - Parallelize independent operations with Rayon
    - _Requirements: 1.2, 1.3, 3.4, 3.6_

  - [ ]* 65.3 Run performance benchmarks
    - Benchmark store latency (target: <10ms for <100MB)
    - Benchmark retrieve latency (Flux: <1ms, Memory: <5ms, Disk: <50ms)
    - Benchmark query performance (target: <100ms for 10k assets)
    - Benchmark compression throughput (target: >500 MB/s)
    - Benchmark concurrent operations
    - Document performance results
    - _Requirements: 1.2, 1.3, 2.3, 3.4, 3.6_

- [ ] 66. Implement additional backend support
  - [ ] 66.1 Create backends/memory.rs with MemoryBackend
    - Implement in-memory backend using DashMap
    - Add for testing and temporary storage
    - _Requirements: 6.2_

  - [ ] 66.2 Create backends/remote.rs with RemoteBackend (optional)
    - Implement HTTP/S3 remote backend
    - Add connection pooling with reqwest
    - Implement local caching for remote assets
    - Add retry logic with exponential backoff
    - _Requirements: 6.2_

  - [ ]* 66.3 Write unit tests for additional backends
    - Test memory backend operations
    - Test remote backend operations (if implemented)
    - Test backend fallback behavior
    - _Requirements: 6.2_

- [ ] 67. Error handling improvements
  - [ ] 67.1 Review and enhance error handling
    - Ensure all errors have descriptive messages
    - Add error context for debugging
    - Implement error recovery strategies
    - Add error logging with appropriate levels
    - Test error propagation through IPC
    - _Requirements: 8.6_

  - [ ]* 67.2 Write error handling tests
    - Test error scenarios for all operations
    - Test error message clarity
    - Test error recovery
    - _Requirements: 8.6_

- [ ] 68. Documentation and examples
  - [ ] 68.1 Write comprehensive API documentation
    - Document all Rust public APIs with rustdoc
    - Document TypeScript client API with TSDoc
    - Document Python client API with docstrings
    - Add usage examples for common workflows
    - Document configuration options
    - _Requirements: All_

  - [ ] 68.2 Create example applications
    - Create example Rust application using StorageEngine
    - Create example TypeScript app using storageClient
    - Create example Python script using storage.py
    - Add examples to documentation
    - _Requirements: All_

  - [ ] 68.3 Update K_OS documentation
    - Update CARGO_ARSENAL.md with new crates
    - Update NPM_ARSENAL.md if new packages added
    - Update PYTHON_ARSENAL.md with new packages
    - Update DIRECTORY.md with new module structure
    - Add entries to RECENT_CHANGES.md
    - _Requirements: All_

- [ ] 69. Load testing and stress testing
  - [ ]* 69.1 Create load test suite
    - Test with 100k+ assets
    - Test concurrent access from 100+ threads
    - Test sustained high throughput
    - Test memory usage under load
    - Test crash recovery with large databases
    - _Requirements: 1.4, 9.5, 9.6_

  - [ ]* 69.2 Analyze and fix load test issues
    - Fix any crashes or deadlocks
    - Optimize memory usage
    - Tune for high concurrency
    - _Requirements: 1.4_

- [ ] 70. Final integration testing
  - [ ]* 70.1 Run end-to-end integration tests
    - Test complete workflows (store → query → retrieve → export)
    - Test multi-project scenarios
    - Test version management workflows
    - Test transaction workflows
    - Test Python integration workflows
    - _Requirements: All_

  - [ ]* 70.2 Fix integration issues
    - Address any integration bugs
    - Ensure all components work together
    - Verify performance targets met
    - _Requirements: All_

- [ ] 71. Final checkpoint - OptiMatrix complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all performance targets met
  - Confirm all requirements satisfied

## Notes

### Task Marking Convention
- Tasks marked with `*` are optional testing/validation tasks that can be skipped for faster MVP delivery
- All non-marked tasks are required for core functionality
- Property tests validate universal correctness properties (minimum 100 iterations, extended tests run 10k iterations)
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests validate end-to-end workflows and component interactions

### Requirements Traceability
Each task explicitly references the requirements it implements, ensuring complete coverage:
- Requirement 1: Core Storage Engine (Tasks 1-6)
- Requirement 2: Matrix Database (Tasks 7-11)
- Requirement 3: GPU Acceleration (Tasks 12-16, 17-22)
- Requirement 4: Entanglement Layer (Tasks 23-28)
- Requirement 5: Asset Types (Tasks 2, 15, 56)
- Requirement 6: Configuration (Tasks 55-58)
- Requirement 7: Metrics (Tasks 59-63)
- Requirement 8: Tauri Integration (Tasks 5, 10, 21, 34, 41, 47, 61)
- Requirement 9: Transactions (Tasks 36-42)
- Requirement 10: Versioning (Tasks 29-35)
- Requirement 11: Import/Export (Tasks 43-48)
- Requirement 12: Python Integration (Tasks 49-54)

### Property-Based Testing
All 17 correctness properties from the design document are implemented as property tests:
- Property 1: Storage Round-Trip (Task 4.2)
- Property 2: Concurrent Safety (Task 4.3 as unit test, validated throughout)
- Property 3: Referential Integrity (Task 7.2)
- Property 4: Deletion Policy (Task 9.2)
- Property 5: Transaction Atomicity (Task 37.2)
- Property 6: Rollback Completeness (Task 37.3)
- Property 7: Compression Round-Trip (Task 13.2)
- Property 8: Content Deduplication (Task 23.2)
- Property 9: Copy-On-Write (Task 25.2)
- Property 10: Garbage Collection (Task 26.2)
- Property 11: Schema Validation (Task 56.2)
- Property 12: Invalid Config Fallback (Task 55.3)
- Property 13: Version Preservation (Task 29.2)
- Property 14: Version Revert (Task 32.2)
- Property 15: Retention Policy (Task 32.3)
- Property 16: Export-Import Metadata (Task 45.3)
- Property 17: Export-Import Data (Task 44.2)

### Checkpoint Strategy
Checkpoints are placed at the end of each major phase to ensure:
- All tests pass before proceeding
- User can provide feedback or ask questions
- Incremental validation of functionality
- Early detection of integration issues

### Library Recommendations
Key libraries to add (following library-first philosophy):
- **rocksdb** (0.21): High-performance embedded database
- **blake3** (1.5): Fast cryptographic hashing for content addressing
- **bincode** (1.3): Fast binary serialization
- **dashmap** (5.5): Concurrent hash map for caching
- **rayon** (1.8): Data parallelism for CPU operations
- **proptest** (1.4): Property-based testing framework
- **gltf** (1.4): glTF import/export
- **image** (0.24): PNG/JPEG texture support
- **openexr** (1.0): HDR texture support
- **meshopt** (0.1): Mesh optimization and compression
- **zstd** (0.13): High-performance compression
- **tokio** (1.35): Async runtime (already in K_OS)
- **wgpu** (0.18): GPU compute (already in K_OS)

### Performance Targets Summary
- Store latency: <10ms for assets <100MB
- Flux Cache retrieval: <1ms
- Memory Cache retrieval: <5ms
- Disk retrieval: <50ms
- Query performance: <100ms for 10k assets
- Compression throughput: >500 MB/s
- Cache hit rate: >80%
- Transaction commit: <20ms
- Crash recovery: <5 seconds for <100GB databases

### Implementation Timeline
- **Week 1-2**: Core storage engine with RocksDB (Phase 1)
- **Week 3**: Matrix database and queries (Phase 2)
- **Week 4**: GPU compression pipeline (Phase 3)
- **Week 5**: Flux Cache implementation (Phase 4)
- **Week 6**: Entanglement layer and deduplication (Phase 5)
- **Week 7**: Version management (Phase 6)
- **Week 8**: Transaction manager and ACID guarantees (Phase 7)
- **Week 9**: Import/export capabilities (Phase 8)
- **Week 10**: Python integration and configuration (Phases 9-10)
- **Week 11**: Performance monitoring and metrics (Phase 11)
- **Week 12**: Optimization, testing, and polish (Phase 12)

### Data-Driven Architecture
Following K_OS philosophy, OptiMatrix is fully data-driven:
- All policies configured via Storage_Registry JSON
- Backend selection and priorities configurable
- Cache policies (size, eviction) configurable
- Compression policies per asset type
- Version retention policies configurable
- Performance thresholds configurable
- Custom asset schemas registered in config
- Python processors registered in config
- Hot-reload support for configuration changes

### GPU-First Design
Leveraging K_OS GPU capabilities:
- Flux Cache in GPU memory for <1ms access
- wgpu compute pipelines for compression/decompression
- WGSL shaders with proper 16-byte alignment
- Zero-copy buffer management
- Automatic CPU fallback when GPU unavailable
- Target: 500+ MB/s compression throughput

### Solo-Dev Optimizations
Time-saving strategies for solo development:
- Library-first approach (rocksdb, blake3, gltf, etc.)
- Property-based testing catches edge cases automatically
- Data-driven configuration eliminates hardcoding
- Modular architecture allows incremental development
- Comprehensive type system reduces runtime errors
- Clear checkpoint strategy for validation
- Reuse existing K_OS infrastructure (wgpu, Tauri, Python bridge)

## Workflow Completion

This task list represents the complete implementation plan for OptiMatrix storage system. To begin execution:

1. Open this tasks.md file in your IDE
2. Click "Start task" next to any task item to begin implementation
3. Kiro will execute tasks incrementally, running tests and validating at checkpoints
4. Optional tasks (marked with `*`) can be skipped for faster MVP delivery
5. All tasks reference specific requirements for traceability

The implementation follows the phased approach from the design document, building from core storage through GPU acceleration, versioning, transactions, and Python integration, culminating in a production-ready, high-performance storage system for K_OS.

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use glam::{Vec2, Vec3};
use k_os_baking::{BakeMesh, BakeSettings, BakingSystem, Bvh, CpuRayTracer, NormalSpace};

fn create_test_mesh(subdivisions: u32) -> BakeMesh {
    let mut vertices = Vec::new();
    let mut normals = Vec::new();
    let mut tangents = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    let step = 1.0 / subdivisions as f32;

    for y in 0..=subdivisions {
        for x in 0..=subdivisions {
            let u = x as f32 * step;
            let v = y as f32 * step;

            vertices.push(Vec3::new(u, v, 0.0));
            normals.push(Vec3::Z);
            tangents.push(Vec3::X);
            uvs.push(Vec2::new(u, v));
        }
    }

    for y in 0..subdivisions {
        for x in 0..subdivisions {
            let i0 = y * (subdivisions + 1) + x;
            let i1 = i0 + 1;
            let i2 = i0 + subdivisions + 1;
            let i3 = i2 + 1;

            indices.extend_from_slice(&[i0, i1, i2]);
            indices.extend_from_slice(&[i1, i3, i2]);
        }
    }

    BakeMesh::new(vertices, normals, tangents, uvs, indices).unwrap()
}

fn bench_bvh_construction(c: &mut Criterion) {
    let mut group = c.benchmark_group("bvh_construction");

    for size in [100, 1000, 10000].iter() {
        let mesh = create_test_mesh(*size);

        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}k_tris", mesh.triangle_count() / 1000)),
            size,
            |b, _| {
                b.iter(|| {
                    let bvh = Bvh::from_mesh(black_box(&mesh.vertices), black_box(&mesh.indices))
                        .unwrap();
                    black_box(bvh);
                });
            },
        );
    }

    group.finish();
}

fn bench_raycast(c: &mut Criterion) {
    let mut group = c.benchmark_group("raycast");

    for size in [100, 1000, 10000].iter() {
        let mesh = create_test_mesh(*size);
        let bvh = Bvh::from_mesh(&mesh.vertices, &mesh.indices).unwrap();
        let tracer = CpuRayTracer::new(bvh);

        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}k_tris", mesh.triangle_count() / 1000)),
            size,
            |b, _| {
                b.iter(|| {
                    let hit =
                        tracer.raycast(black_box(Vec3::new(0.5, 0.5, -1.0)), black_box(Vec3::Z));
                    black_box(hit);
                });
            },
        );
    }

    group.finish();
}

fn bench_bake_normal_map(c: &mut Criterion) {
    let mut group = c.benchmark_group("bake_normal_map");
    group.sample_size(10); // Reduce sample size for slow benchmarks

    for resolution in [256, 512, 1024].iter() {
        let high_poly = create_test_mesh(50);
        let low_poly = create_test_mesh(10);
        let system = BakingSystem::new();

        let settings = BakeSettings {
            resolution: *resolution,
            samples: 1,
            dilation_iterations: 0,
            ..Default::default()
        };

        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}x{}", resolution, resolution)),
            resolution,
            |b, _| {
                b.iter(|| {
                    let image = system
                        .bake_normal_map(
                            black_box(&high_poly),
                            black_box(&low_poly),
                            black_box(&settings),
                        )
                        .unwrap();
                    black_box(image);
                });
            },
        );
    }

    group.finish();
}

fn bench_bake_ao_map(c: &mut Criterion) {
    let mut group = c.benchmark_group("bake_ao_map");
    group.sample_size(10);

    for resolution in [256, 512].iter() {
        let mesh = create_test_mesh(10);
        let system = BakingSystem::new();

        let settings = BakeSettings {
            resolution: *resolution,
            samples: 16,
            dilation_iterations: 0,
            ..Default::default()
        };

        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}x{}", resolution, resolution)),
            resolution,
            |b, _| {
                b.iter(|| {
                    let image = system
                        .bake_ao_map(black_box(&mesh), black_box(&settings))
                        .unwrap();
                    black_box(image);
                });
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_bvh_construction,
    bench_raycast,
    bench_bake_normal_map,
    bench_bake_ao_map
);
criterion_main!(benches);

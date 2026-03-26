use criterion::{black_box, criterion_group, criterion_main, Criterion};
use glam::Vec3;
use k_os_mesh_processing::{decimation, smoothing, subdivision, Mesh};

fn create_sphere_mesh(subdivisions: usize) -> Mesh {
    // Create icosahedron
    let t = (1.0 + 5.0_f32.sqrt()) / 2.0;

    let vertices = vec![
        Vec3::new(-1.0, t, 0.0).normalize(),
        Vec3::new(1.0, t, 0.0).normalize(),
        Vec3::new(-1.0, -t, 0.0).normalize(),
        Vec3::new(1.0, -t, 0.0).normalize(),
        Vec3::new(0.0, -1.0, t).normalize(),
        Vec3::new(0.0, 1.0, t).normalize(),
        Vec3::new(0.0, -1.0, -t).normalize(),
        Vec3::new(0.0, 1.0, -t).normalize(),
        Vec3::new(t, 0.0, -1.0).normalize(),
        Vec3::new(t, 0.0, 1.0).normalize(),
        Vec3::new(-t, 0.0, -1.0).normalize(),
        Vec3::new(-t, 0.0, 1.0).normalize(),
    ];

    #[rustfmt::skip]
    let indices = vec![
        0, 11, 5,  0, 5, 1,   0, 1, 7,   0, 7, 10,  0, 10, 11,
        1, 5, 9,   5, 11, 4,  11, 10, 2, 10, 7, 6,  7, 1, 8,
        3, 9, 4,   3, 4, 2,   3, 2, 6,   3, 6, 8,   3, 8, 9,
        4, 9, 5,   2, 4, 11,  6, 2, 10,  8, 6, 7,   9, 8, 1,
    ];

    let mut mesh = Mesh::from_vertices_indices(vertices, indices);

    // Subdivide to create denser mesh
    for _ in 0..subdivisions {
        mesh = subdivision::simple(&mesh, 1).unwrap();
    }

    mesh
}

fn bench_decimation(c: &mut Criterion) {
    let mesh = create_sphere_mesh(3); // ~5K triangles

    c.bench_function("decimate_50_percent", |b| {
        b.iter(|| decimation::decimate(black_box(&mesh), black_box(0.5)))
    });
}

fn bench_smoothing(c: &mut Criterion) {
    let mesh = create_sphere_mesh(2); // ~1K triangles

    c.bench_function("laplacian_smoothing", |b| {
        b.iter(|| smoothing::laplacian(black_box(&mesh), black_box(5), black_box(0.5)))
    });

    c.bench_function("taubin_smoothing", |b| {
        b.iter(|| {
            smoothing::taubin(
                black_box(&mesh),
                black_box(10),
                black_box(0.5),
                black_box(-0.53),
            )
        })
    });
}

fn bench_subdivision(c: &mut Criterion) {
    let mesh = create_sphere_mesh(1); // ~80 triangles

    c.bench_function("simple_subdivision", |b| {
        b.iter(|| subdivision::simple(black_box(&mesh), black_box(2)))
    });

    c.bench_function("loop_subdivision", |b| {
        b.iter(|| subdivision::loop_subdivision(black_box(&mesh), black_box(2)))
    });
}

criterion_group!(
    benches,
    bench_decimation,
    bench_smoothing,
    bench_subdivision
);
criterion_main!(benches);

//! Material export adapters owned by the IO domain.
//!
//! `k-os-material` owns material data structures and export contracts.
//! `k-os-io` owns the concrete file-format adapters and default exporter registration.

use k_os_material::autopbr::export::ExportPipeline;

pub mod exporters;

pub use exporters::{GltfExporter, GodotExporter, SBSARExporter, UnityExporter, UnrealExporter};

pub fn register_default_material_exporters(pipeline: &mut ExportPipeline) {
    for factory in DEFAULT_EXPORTER_FACTORIES {
        pipeline.register_exporter(factory());
    }
}

type ExporterFactory = fn() -> Box<dyn k_os_material::autopbr::export::MaterialExporter>;

const DEFAULT_EXPORTER_FACTORIES: &[ExporterFactory] = &[
    || Box::new(GltfExporter::new()),
    || Box::new(UnrealExporter::new()),
    || Box::new(UnityExporter::new()),
    || Box::new(GodotExporter::new()),
    || Box::new(SBSARExporter::new()),
];

//! K_OS brush asset and kernel ownership boundary.
//!
//! During migration this crate is the canonical public surface for brush assets,
//! curves, registries, and the brush library.

pub mod asset;
pub mod curve;
pub mod gpu_params;
pub mod gpu_params_v2;
pub mod library;
pub mod paint_wasm;
pub mod registry;

pub use asset::{BrushKernel, BrushParams, BrushTextures, KBrushAsset};
pub use curve::{BrushCurve, CurveLut, CurvePoint};
pub use gpu_params::BrushParamsGpu;
pub use gpu_params_v2::{get_entry_point_name, AlphaSlot, BrushParamsGpuV2};
pub use library::{KBrushLibrary, BRUSH_LIBRARY};
pub use registry::{KernelInfo, KernelRegistry, KERNEL_REGISTRY};

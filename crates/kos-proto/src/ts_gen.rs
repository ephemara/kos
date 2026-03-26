//! TypeScript Binding Generation
//!
//! Run with: cargo test -p kos-proto generate_typescript_bindings -- --nocapture
//!
//! This generates TypeScript types to: crates/kos-proto/bindings/

#[cfg(test)]
mod tests {
    /// Generates TypeScript bindings for all exported types
    #[test]
    fn generate_typescript_bindings() {
        use ts_rs::TS;
        use std::path::Path;
        use std::fs;
        
        // Ensure bindings directory exists
        let bindings_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("bindings");
        fs::create_dir_all(&bindings_dir).unwrap();
        
        // Also create krue subdirectory
        let krue_dir = bindings_dir.join("krue");
        fs::create_dir_all(&krue_dir).unwrap();
        
        // Export state types
        crate::state::SculptState::export_all().unwrap();
        crate::state::SymmetryState::export_all().unwrap();
        crate::state::MeshStats::export_all().unwrap();
        crate::state::BrushAsset::export_all().unwrap();
        crate::state::BrushLibrary::export_all().unwrap();
        crate::state::ActiveTool::export_all().unwrap();
        crate::state::ViewportState::export_all().unwrap();
        crate::state::LayerInfo::export_all().unwrap();
        crate::state::ObjectType::export_all().unwrap();
        crate::state::LayerHierarchy::export_all().unwrap();
        crate::state::KosState::export_all().unwrap();
        
        // Export message types
        crate::messages::KosMessage::export_all().unwrap();
        crate::messages::KosResponse::export_all().unwrap();
        crate::messages::PrimitiveType::export_all().unwrap();
        
        // Export KRUE types
        crate::krue::UiNode::export_all().unwrap();
        crate::krue::UiCommand::export_all().unwrap();
        crate::krue::UiPatch::export_all().unwrap();
        crate::krue::UiPatchBatch::export_all().unwrap();
        crate::krue::UiAck::export_all().unwrap();
        crate::krue::CommandBinding::export_all().unwrap();
        crate::krue::SlotDefinition::export_all().unwrap();
        crate::krue::LayoutStyle::export_all().unwrap();
        crate::krue::FocusConfig::export_all().unwrap();
        crate::krue::PortalConfig::export_all().unwrap();
        crate::krue::AsyncConfig::export_all().unwrap();
        crate::krue::AnimationBinding::export_all().unwrap();
        crate::krue::VirtualListConfig::export_all().unwrap();
        
        println!("✅ TypeScript bindings generated to: {:?}", bindings_dir);
    }
}

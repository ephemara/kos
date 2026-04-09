pub struct GeneratedSpirvLookupEntry {
    pub id: &'static str,
    pub asset: &'static crate::GeneratedSpirvAsset,
}

pub static ASSETS: &[&crate::GeneratedSpirvAsset] = &[
];

pub fn assets() -> &'static [&'static crate::GeneratedSpirvAsset] { ASSETS }

pub static ALL: &[GeneratedSpirvLookupEntry] = &[
];

pub fn all() -> &'static [GeneratedSpirvLookupEntry] { ALL }

pub fn by_id(id: &str) -> Option<&'static crate::GeneratedSpirvAsset> {
    match id {
        _ => None,
    }
}

use serde::{Deserialize, Serialize};

macro_rules! define_handle {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
        pub struct $name(pub u64);

        impl $name {
            pub fn raw(self) -> u64 {
                self.0
            }
        }
    };
}

define_handle!(SceneHandle);
define_handle!(MeshHandle);
define_handle!(MaterialHandle);
define_handle!(RigHandle);
define_handle!(TakeHandle);
define_handle!(AnimationHandle);

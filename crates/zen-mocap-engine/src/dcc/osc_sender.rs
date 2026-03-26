//! OSC (Open Sound Control) encoder for Blender, Maya, and C4D.
//!
//! Blender's official animation retargeting addon (BVH Retarget, Animation
//! Nodes) can receive OSC to drive armature bones, making this the most
//! practical integration path.
//!
//! ## OSC Address Pattern (per bone)
//! `/mocap/bone/<name>/pos  f f f`   — world position x, y, z
//! `/mocap/bone/<name>/rot  f f f f` — quaternion x, y, z, w

use rosc::{OscBundle, OscMessage, OscPacket, OscTime, OscType};
use crate::types::BoneTransform;

/// Encode all bones as an OSC bundle.
/// Bundle timestamp is set to the current time (OscTime::now()).
pub fn encode_body(bones: &[BoneTransform], seq: u64) -> Vec<u8> {
    let messages: Vec<OscPacket> = bones.iter().flat_map(|bone| {
        let name = &bone.name;

        let pos_msg = OscPacket::Message(OscMessage {
            addr: format!("/mocap/bone/{}/pos", name),
            args: vec![
                OscType::Float(bone.position[0]),
                OscType::Float(bone.position[1]),
                OscType::Float(bone.position[2]),
            ],
        });

        let rot_msg = OscPacket::Message(OscMessage {
            addr: format!("/mocap/bone/{}/rot", name),
            args: vec![
                OscType::Float(bone.rotation[0]),
                OscType::Float(bone.rotation[1]),
                OscType::Float(bone.rotation[2]),
                OscType::Float(bone.rotation[3]),
            ],
        });

        [pos_msg, rot_msg]
    }).collect();

    // Sequence number as a top-level bundle message
    let seq_msg = OscPacket::Message(OscMessage {
        addr: "/mocap/seq".into(),
        args: vec![OscType::Long(seq as i64)],
    });

    let mut content = vec![seq_msg];
    content.extend(messages);

    let bundle = OscPacket::Bundle(OscBundle {
        timetag: OscTime::try_from(std::time::SystemTime::now())
            .unwrap_or(OscTime { seconds: 0, fractional: 1 }),
        content,
    });

    rosc::encoder::encode(&bundle).unwrap_or_default()
}

/// Encode raw COCO 2D joint positions as OSC (useful for Blender custom scripts).
pub fn encode_joints_2d(joints: &[[f32; 2]], names: &[&str], _seq: u64) -> Vec<u8> {
    let messages: Vec<OscPacket> = joints.iter().zip(names.iter()).map(|(pos, name)| {
        OscPacket::Message(OscMessage {
            addr: format!("/mocap/joint/{}", name),
            args: vec![
                OscType::Float(pos[0]),
                OscType::Float(pos[1]),
            ],
        })
    }).collect();

    let bundle = OscPacket::Bundle(OscBundle {
        timetag: OscTime::try_from(std::time::SystemTime::now())
            .unwrap_or(OscTime { seconds: 0, fractional: 1 }),
        content: messages,
    });

    rosc::encoder::encode(&bundle).unwrap_or_default()
}

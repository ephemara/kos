//! UE5 LiveLink binary packet encoder.
//!
//! Implements the LiveLink UDP body (transform) protocol.
//!
//! ## UE5 LiveLink Generic Data Format (0xF2)
//!
//! The simplest path to UE5 compatibility is the `0xF2` generic data format,
//! which lets a custom LiveLink Source in UE5 receive arbitrary float streams.
//! A UE5 Live Link plugin on the receiving end maps bone indices to skeleton.
//!
//! Packet layout (all little-endian):
//! ```text
//! [0x00]: u8  — 0xF2 (packet type marker)
//! [0x01]: u8  — packet version (0x01)
//! [0x02..0x05]: u32 — frame sequence number
//! [0x06..0x09]: u32 — number of floats following
//! [0x0A..]: f32[N] — bone data: pos[3] + quat[4] per bone = 7 floats
//! ```
//!
//! ## Full LiveLink Message Bus (future)
//!
//! For production-quality UE5 integration, implement the Message Bus protocol
//! which is considerably more complex (Unreal's coroutine-based messaging).
//! The 0xF2 format is sufficient for proof-of-concept and supports all bones.

use bytemuck::cast_slice;
use crate::types::BoneTransform;

const PACKET_MAGIC: u8 = 0xF2;
const PACKET_VERSION: u8 = 0x01;

/// Encode solved biped bones as a UE5 LiveLink 0xF2 UDP packet.
pub fn encode_body(bones: &[BoneTransform], seq: u64) -> Vec<u8> {
    // 7 floats per bone: position[3] + quaternion[4]
    let num_floats = bones.len() * 7;

    let mut packet = Vec::with_capacity(10 + num_floats * 4);

    // Header
    packet.push(PACKET_MAGIC);
    packet.push(PACKET_VERSION);
    packet.extend_from_slice(&(seq as u32).to_le_bytes());
    packet.extend_from_slice(&(num_floats as u32).to_le_bytes());

    // Bone data: position xyz + rotation xyzw
    for bone in bones {
        // position
        for &v in &bone.position {
            packet.extend_from_slice(&v.to_le_bytes());
        }
        // rotation quaternion
        for &v in &bone.rotation {
            packet.extend_from_slice(&v.to_le_bytes());
        }
    }

    packet
}

/// Encode a UE5 Live Link Face Capture packet (ARKit blend shapes, 61 values).
/// Useful for face mocap via camera when wearing expression tracking rig.
///
/// Packet format (matches UE5 AppleARKitLiveLinkSource):
/// - u8: packet version (6)
/// - u32: device id length + chars
/// - u32: subject name length + chars  
/// - u32: frame, u32: subframe, u32: fps_num, u32: fps_den
/// - u8: num blend shapes (must be 61)
/// - f32[61]: blend shape weights
pub fn encode_face(
    device_id: &str,
    subject_name: &str,
    frame: u32,
    fps: u32,
    blend_shapes: &[f32; 61],
) -> Vec<u8> {
    let mut packet = Vec::new();

    // Packet version 6
    packet.push(6u8);

    // Device ID
    write_length_prefixed_string(&mut packet, device_id);

    // Subject name
    write_length_prefixed_string(&mut packet, subject_name);

    // Timecode
    packet.extend_from_slice(&frame.to_le_bytes());
    packet.extend_from_slice(&0u32.to_le_bytes()); // subframe
    packet.extend_from_slice(&fps.to_le_bytes());   // fps numerator
    packet.extend_from_slice(&1u32.to_le_bytes());  // fps denominator

    // Blend shapes
    packet.push(61u8);
    for &bs in blend_shapes {
        packet.extend_from_slice(&bs.to_le_bytes());
    }

    packet
}

fn write_length_prefixed_string(buf: &mut Vec<u8>, s: &str) {
    let bytes = s.as_bytes();
    buf.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
    buf.extend_from_slice(bytes);
}

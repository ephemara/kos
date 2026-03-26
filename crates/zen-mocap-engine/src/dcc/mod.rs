//! DCC broadcast module — sends solved skeleton data to target DCC applications.
//!
//! Protocol dispatch is data-driven via the `DCC_PROTOCOLS` table in types.
//! Each protocol has its own encoder:
//!   - `livelink`: UE5 LiveLink binary UDP (body + face)
//!   - `osc`:      OSC over UDP (Blender, Maya, C4D)
//!   - `json`:     JSON over UDP (Unity LiveCapture)
//!   - `bvh`:      BVH stream over TCP (DaVinci Resolve)

pub mod livelink;
pub mod osc_sender;

use std::net::UdpSocket;
use crate::types::{BoneTransform, JointFrame};

// ─── Protocol Table (data-driven) ────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WireFormat { LiveLink, Osc, Json, BvhStream }

#[derive(Debug, Clone)]
pub struct DccProtocol {
    pub id: &'static str,
    pub name: &'static str,
    pub default_port: u16,
    pub format: WireFormat,
}

/// All supported DCC targets — add new ones here only.
/// Matches the frontend `DCC_TARGET_CONFIG` exactly.
pub static DCC_PROTOCOLS: &[DccProtocol] = &[
    DccProtocol { id: "ue5",     name: "Unreal Engine 5", default_port: 11111, format: WireFormat::LiveLink },
    DccProtocol { id: "unity",   name: "Unity",            default_port: 9000,  format: WireFormat::Json     },
    DccProtocol { id: "blender", name: "Blender",          default_port: 8000,  format: WireFormat::Osc      },
    DccProtocol { id: "maya",    name: "Maya",             default_port: 7000,  format: WireFormat::Osc      },
    DccProtocol { id: "c4d",     name: "Cinema 4D",        default_port: 6000,  format: WireFormat::Json     },
    DccProtocol { id: "resolve", name: "DaVinci Resolve",  default_port: 5000,  format: WireFormat::BvhStream},
];

pub fn get_protocol(id: &str) -> Option<&'static DccProtocol> {
    DCC_PROTOCOLS.iter().find(|p| p.id == id)
}

// ─── Broadcaster ─────────────────────────────────────────────────────────────

pub struct Broadcaster {
    socket: UdpSocket,
    target_addr: String,
    protocol: &'static DccProtocol,
    tx_count: u32,
}

impl Broadcaster {
    pub fn connect(target_id: &str, host: &str, port: u16) -> Result<Self, String> {
        let protocol = get_protocol(target_id)
            .ok_or_else(|| format!("Unknown DCC target: {}", target_id))?;

        let socket = UdpSocket::bind("0.0.0.0:0")
            .map_err(|e| format!("UDP bind failed: {}", e))?;

        let addr = format!("{}:{}", host, port);

        // Set non-blocking so the pipeline never stalls waiting for ACK
        socket.set_nonblocking(true).ok();

        log::info!("[zen-mocap] DCC broadcaster → {} ({}) at {}", protocol.name, protocol.id, addr);

        Ok(Self { socket, target_addr: addr, protocol, tx_count: 0 })
    }

    /// Send one frame to the DCC target.
    pub fn send_frame(&mut self, frame: &JointFrame) -> Result<(), String> {
        let bones = match &frame.skeleton {
            Some(b) => b,
            None => return Ok(()), // No solved skeleton yet — skip
        };

        let packet = match self.protocol.format {
            WireFormat::LiveLink  => livelink::encode_body(bones, frame.seq),
            WireFormat::Osc       => osc_sender::encode_body(bones, frame.seq),
            WireFormat::Json      => encode_json(frame),
            WireFormat::BvhStream => encode_bvh_frame(bones),
        };

        self.socket
            .send_to(&packet, &self.target_addr)
            .map_err(|e| format!("UDP send failed: {}", e))?;

        self.tx_count += 1;
        Ok(())
    }

    pub fn tx_count(&self) -> u32 { self.tx_count }
    pub fn is_connected(&self) -> bool { true } // UDP is connectionless; always "connected"
}

// ─── JSON encoder (Unity) ────────────────────────────────────────────────────

fn encode_json(frame: &JointFrame) -> Vec<u8> {
    // Unity LiveCapture uses JSON over UDP with a thin header
    // Format: `{"seq":N,"bones":[{"name":"...","pos":[x,y,z],"rot":[x,y,z,w]},...]}`
    let json = serde_json::json!({
        "seq": frame.seq,
        "ts":  frame.timestamp_ms,
        "bones": frame.skeleton.as_deref().unwrap_or(&[]).iter().map(|b| serde_json::json!({
            "name": b.name,
            "pos":  b.position,
            "rot":  b.rotation,
        })).collect::<Vec<_>>(),
    });
    json.to_string().into_bytes()
}

// ─── BVH frame encoder (Resolve) ─────────────────────────────────────────────

fn encode_bvh_frame(bones: &[BoneTransform]) -> Vec<u8> {
    // Minimal per-frame BVH motion data (Euler angles, space-separated)
    // DaVinci Resolve reads this to drive camera rigs from body rotation
    let channels: Vec<String> = bones.iter().flat_map(|b| {
        // Convert quaternion → Euler ZXY (BVH convention)
        let q = glam::Quat::from_array(b.rotation);
        let (z, x, y) = q.to_euler(glam::EulerRot::ZXY);
        vec![
            format!("{:.4}", x.to_degrees()),
            format!("{:.4}", y.to_degrees()),
            format!("{:.4}", z.to_degrees()),
        ]
    }).collect();

    // BVH motion line: space separated Euler angles
    let line = channels.join(" ") + "\n";
    line.into_bytes()
}

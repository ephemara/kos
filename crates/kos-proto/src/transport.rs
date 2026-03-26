//! Transport Layer
//!
//! Handles the low-level communication between processes.
//! Both Bevy and Tauri use this same code.

use std::net::UdpSocket;
use std::io::{self, ErrorKind};

use crate::KosMessage;

/// The default port for Bevy to listen on
pub const BEVY_PORT: u16 = 42069;
/// The default port for Tauri to listen on  
pub const TAURI_PORT: u16 = 42070;

// =============================================================================
// SENDER (Used by Tauri to send to Bevy)
// =============================================================================

/// Sender for Tauri -> Bevy communication
pub struct KosSender {
    socket: UdpSocket,
    target: String,
}

impl KosSender {
    /// Create a new sender that sends to Bevy
    pub fn new() -> io::Result<Self> {
        let socket = UdpSocket::bind(format!("127.0.0.1:{}", TAURI_PORT))?;
        socket.set_nonblocking(true)?;
        // REMOVED: connectivity requirement. We want to be able to see where packets come from.
        // socket.connect(format!("127.0.0.1:{}", BEVY_PORT))?;
        
        Ok(Self {
            socket,
            target: format!("127.0.0.1:{}", BEVY_PORT),
        })
    }

    /// Send a message to Bevy
    pub fn send(&self, msg: &KosMessage) -> io::Result<usize> {
        let bytes = msg.to_bytes();
        self.socket.send_to(&bytes, &self.target)
    }

    /// Try to receive a response (non-blocking)
    pub fn try_recv(&self) -> Option<KosMessage> {
        let mut buf = [0u8; 65536];
        match self.socket.recv(&mut buf) {
            Ok(len) => KosMessage::from_bytes(&buf[..len]),
            Err(_) => None,
        }
    }

    /// Clone the socket for use in a listener thread
    pub fn try_clone_socket(&self) -> io::Result<UdpSocket> {
        self.socket.try_clone()
    }
}

// =============================================================================
// RECEIVER (Used by Bevy to receive from Tauri)
// =============================================================================

/// Receiver for Bevy to receive from Tauri
pub struct KosReceiver {
    socket: UdpSocket,
    buffer: Vec<KosMessage>,
}

impl KosReceiver {
    /// Create a new receiver that listens for Tauri messages
    pub fn new() -> io::Result<Self> {
        let socket = UdpSocket::bind(format!("127.0.0.1:{}", BEVY_PORT))?;
        socket.set_nonblocking(true)?;
        
        Ok(Self {
            socket,
            buffer: Vec::new(),
        })
    }

    /// Poll for new messages (call this every frame)
    pub fn poll(&mut self) {
        let mut buf = [0u8; 65536];
        loop {
            match self.socket.recv(&mut buf) {
                Ok(len) => {
                    if let Some(msg) = KosMessage::from_bytes(&buf[..len]) {
                        self.buffer.push(msg);
                    }
                }
                Err(e) if e.kind() == ErrorKind::WouldBlock => break,
                Err(_) => break,
            }
        }
    }

    /// Drain all buffered messages
    pub fn drain(&mut self) -> impl Iterator<Item = KosMessage> + '_ {
        self.buffer.drain(..)
    }

    /// Send a response back to Tauri
    pub fn send(&self, msg: &KosMessage) -> io::Result<usize> {
        let bytes = msg.to_bytes();
        self.socket.send_to(&bytes, format!("127.0.0.1:{}", TAURI_PORT))
    }

    /// Clone the socket for the response channel
    pub fn try_clone_socket(&self) -> io::Result<UdpSocket> {
        self.socket.try_clone()
    }
}

// =============================================================================
// MESSAGE QUEUE (For batching)
// =============================================================================

/// A queue for batching multiple messages
#[derive(Default)]
pub struct MessageQueue {
    messages: Vec<KosMessage>,
}

impl MessageQueue {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, msg: KosMessage) {
        self.messages.push(msg);
    }

    pub fn drain(&mut self) -> impl Iterator<Item = KosMessage> + '_ {
        self.messages.drain(..)
    }

    pub fn is_empty(&self) -> bool {
        self.messages.is_empty()
    }
}

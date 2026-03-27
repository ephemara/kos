pub fn graph_checksum(bytes: Vec<i64>) -> i64 {
    let mut total = 0i64;
    for (index, value) in bytes.iter().enumerate() {
        let weight = ((index as i64) % 23) + 5;
        total = (total + value * weight + index as i64 * 7) % 1_000_003;
    }
    total
}

pub fn build_topology_report(
    byte_length: i64,
    checksum: i64,
    scene_graph_document: String,
    preview_session_report: String,
) -> String {
    format!(
        "topology-report:{}:checksum={}:{}:{}",
        byte_length, checksum, scene_graph_document, preview_session_report
    )
}

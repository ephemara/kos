function readFloat32Values(sharedBufferContract) {
  const bytes = sharedBufferContract.bytes;
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(`expected Uint8Array bytes, got ${typeof bytes}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = [];
  for (let offset = 0; offset < bytes.byteLength; offset += 4) {
    values.push(view.getFloat32(offset, true));
  }
  return values;
}

export function run(fabricInputs) {
  const settings = fabricInputs.python_seed.project_settings;
  const previewReport = fabricInputs.zen_dcc_seed.preview_session_report;
  const topologyReport = fabricInputs.topology_analyzer.topology_report;
  const gpuOutput = fabricInputs.gpu_material_preview.preview_dst;
  const previewValues = readFloat32Values(gpuOutput).slice(0, 4);
  return [
    `publish:${settings.project_name}`,
    `channel=${settings.publish_channel}`,
    `mode=${settings.workspace_mode}`,
    previewReport,
    topologyReport,
    `gpu=${previewValues.join(",")}`,
    `bytes=${gpuOutput.byte_length}`,
  ].join("|");
}

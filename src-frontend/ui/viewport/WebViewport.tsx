import React from 'react'
import * as THREE from 'three'
import { StudioStage } from '@/systems/three/StudioStage'
import { getEngineProvider } from '@/engine/providerFactory'
import type { EngineProvider } from '@/engine/EngineProvider'
import { sharedMeshBridge } from '@/services/raycastClient'

export function WebViewport() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const stageRef = React.useRef<StudioStage | null>(null)
  const providerRef = React.useRef<EngineProvider | null>(null)
  const meshRef = React.useRef<THREE.Mesh | null>(null)
  const rayHandleRef = React.useRef<number | null>(null)
  const sculptHandleRef = React.useRef<number | null>(null)
  const [bridgeStatus, setBridgeStatus] = React.useState<{
    meshes: number
    ready: number
    positionBytes: number
    normalBytes: number
    indexBytes: number
  } | null>(null)

  const applyViewportPayload = React.useCallback((payload: {
    positions: Float32Array
    normals: Float32Array
    indices: Uint32Array
  }) => {
    const mesh = meshRef.current
    if (!mesh) return

    let geometry = mesh.geometry as THREE.BufferGeometry
    if (!geometry) {
      geometry = new THREE.BufferGeometry()
      mesh.geometry = geometry
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(payload.positions, 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(payload.normals, 3))
    geometry.setIndex(new THREE.BufferAttribute(payload.indices, 1))
    geometry.computeBoundingSphere()
    geometry.computeBoundingBox()
  }, [])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    stageRef.current = new StudioStage(canvas, { preset: 'minimal', controls: true, environment: true })
    const provider = getEngineProvider()
    providerRef.current = provider
    ;(async () => {
      await provider.init(canvas)
      const prim = await provider.spawnPrimitive('icosphere', { subdivisions: 3 })
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(prim.vertices, 3))
      geo.setAttribute('normal', new THREE.BufferAttribute(prim.normals, 3))
      geo.setAttribute('uv', new THREE.BufferAttribute(prim.uvs, 2))
      geo.setIndex(new THREE.BufferAttribute(prim.indices, 1))
      const mat = new THREE.MeshStandardMaterial({ color: 0x88aaff, metalness: 0.1, roughness: 0.8 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      mesh.receiveShadow = true
      meshRef.current = mesh
      stageRef.current!.scene.add(mesh)
      rayHandleRef.current = await provider.raycastInit(prim.vertices, prim.indices, prim.uvs)
      sculptHandleRef.current = await provider.sculptInit(prim.vertices, prim.indices)

      if (sculptHandleRef.current != null) {
        const payload = await provider.sculptGetViewportPayload(sculptHandleRef.current)
        if (payload) {
          applyViewportPayload(payload)
        }
      }
    })()

    const onPointerMove = async (e: PointerEvent) => {
      const stage = stageRef.current
      const provider = providerRef.current
      const rayHandle = rayHandleRef.current
      if (!stage || !provider || rayHandle == null) return
      const rect = (canvas as HTMLCanvasElement).getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      const ndc = new THREE.Vector2(x, y)
      const origin = new THREE.Vector3()
      const dir = new THREE.Vector3()
      origin.copy(stage.camera.position)
      const ray = new THREE.Raycaster()
      ray.setFromCamera(ndc, stage.camera)
      dir.copy(ray.ray.direction).normalize()
      const res = await provider.raycast(rayHandle, [origin.x, origin.y, origin.z], [dir.x, dir.y, dir.z])
      if (res.hit) {
        // simple visual feedback by changing color slightly
        const m = meshRef.current?.material as THREE.MeshStandardMaterial
        if (m) m.color.setHex(0x99bbff)
      }
    }
    const onPointerDown = async (e: PointerEvent) => {
      const stage = stageRef.current
      const provider = providerRef.current
      const rayHandle = rayHandleRef.current
      const sculptHandle = sculptHandleRef.current
      const mesh = meshRef.current
      if (!stage || !provider || rayHandle == null || sculptHandle == null || !mesh) return
      const rect = (canvas as HTMLCanvasElement).getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      const ndc = new THREE.Vector2(x, y)
      const origin = new THREE.Vector3()
      const dir = new THREE.Vector3()
      origin.copy(stage.camera.position)
      const ray = new THREE.Raycaster()
      ray.setFromCamera(ndc, stage.camera)
      dir.copy(ray.ray.direction).normalize()
      const res = await provider.raycast(rayHandle, [origin.x, origin.y, origin.z], [dir.x, dir.y, dir.z])
      if (!res.hit) return
      const point = res.point
      const normal = res.normal
      const apply = await provider.sculptApply(
        sculptHandle,
        point,
        normal,
        'sculpt_inflate',
        0.3,
        0.5,
        true
      )
      const payload = await provider.sculptGetViewportPayload(sculptHandle)
      if (payload) {
        applyViewportPayload(payload)
      } else {
        const posAttr = (mesh.geometry.getAttribute('position') as THREE.BufferAttribute)
        posAttr.array.set(apply.new_positions)
        posAttr.needsUpdate = true
        mesh.geometry.computeVertexNormals()
      }
    }
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    return () => {
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
    }
  }, [applyViewportPayload])

  React.useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      const info = await sharedMeshBridge.getInfo()
      if (cancelled) return
      setBridgeStatus({
        meshes: info.length,
        ready: info.filter((item) => item.bridge_ready).length,
        positionBytes: info.reduce((sum, item) => sum + item.bridge_position_bytes, 0),
        normalBytes: info.reduce((sum, item) => sum + item.bridge_normal_bytes, 0),
        indexBytes: info.reduce((sum, item) => sum + item.bridge_index_bytes, 0),
      })
    }

    void refresh()
    const interval = window.setInterval(() => {
      void refresh()
    }, 1500)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      {bridgeStatus && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(5, 10, 16, 0.72)',
            border: '1px solid rgba(96, 165, 250, 0.22)',
            color: '#dbeafe',
            fontFamily: 'IBM Plex Mono, Consolas, monospace',
            fontSize: 11,
            lineHeight: 1.45,
            backdropFilter: 'blur(10px)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ color: '#7dd3fc', fontWeight: 700, marginBottom: 4 }}>EVAL BRIDGE</div>
          <div>meshes: {bridgeStatus.meshes}</div>
          <div>ready: {bridgeStatus.ready}</div>
          <div>pos: {bridgeStatus.positionBytes} B</div>
          <div>nrm: {bridgeStatus.normalBytes} B</div>
          <div>idx: {bridgeStatus.indexBytes} B</div>
        </div>
      )}
    </div>
  )
}

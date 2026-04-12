import React from 'react'
import * as THREE from 'three'
import { StudioStage } from '@mocap/three-d/systems/three/StudioStage'
import { getEngineProvider } from '@mocap/engine/providerFactory'
import type { EngineProvider } from '@mocap/engine/EngineProvider'

export function WebViewport() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const stageRef = React.useRef<StudioStage | null>(null)
  const providerRef = React.useRef<EngineProvider | null>(null)
  const meshRef = React.useRef<THREE.Mesh | null>(null)
  const rayHandleRef = React.useRef<number | null>(null)
  const sculptHandleRef = React.useRef<number | null>(null)

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
      const posAttr = (mesh.geometry.getAttribute('position') as THREE.BufferAttribute)
      posAttr.array.set(apply.new_positions)
      posAttr.needsUpdate = true
      mesh.geometry.computeVertexNormals()
    }
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    return () => {
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

import type { EngineProvider } from './EngineProvider'
import { WasmEngineProvider } from './WasmEngineProvider'
import { TauriEngineProvider } from './TauriEngineProvider'

let instance: EngineProvider | null = null

export function getEngineProvider(): EngineProvider {
  if (instance) return instance

  const isTauri = typeof (window as any).__TAURI__ !== 'undefined'
  if (isTauri && !('__KOS_WEB__' in globalThis)) {
    instance = new TauriEngineProvider()
  } else {
    instance = new WasmEngineProvider()
  }
  return instance
}

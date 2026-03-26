/* tslint:disable */
/* eslint-disable */

export class NoiseGenerator {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    fill_noise_buffer(positions: Float32Array, output: Float32Array, scale: number, time: number): void;
    static new(): NoiseGenerator;
}

export function deform_mesh_wasm(positions: Float32Array, cx: number, cy: number, cz: number, size_y: number, taper: number, twist: number, bend: number, noise: number): void;

export function ensure_symmetry_wasm(positions_in: Float32Array, indices_in: Uint32Array, params: any): any;

export function generate_pbr_maps_wasm(rgba_data: Uint8Array, width: number, height: number, params: any): any;

export function greeble_generate(_level: number, positions: Float32Array, indices: Uint32Array, normals: Float32Array, params: any): any;

export function subdivide_geometry_wasm(positions_in: Float32Array, indices_in: Uint32Array, params: any): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_noisegenerator_free: (a: number, b: number) => void;
    readonly deform_mesh_wasm: (a: number, b: number, c: any, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly ensure_symmetry_wasm: (a: number, b: number, c: number, d: number, e: any) => [number, number, number];
    readonly generate_pbr_maps_wasm: (a: number, b: number, c: number, d: number, e: any) => [number, number, number];
    readonly greeble_generate: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any) => [number, number, number];
    readonly noisegenerator_fill_noise_buffer: (a: number, b: number, c: number, d: number, e: number, f: any, g: number, h: number) => void;
    readonly noisegenerator_new: () => number;
    readonly subdivide_geometry_wasm: (a: number, b: number, c: number, d: number, e: any) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

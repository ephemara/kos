import JSZip from 'jszip';
import * as THREE from 'three';
import { KernelArtifact, KernelMaterial, KernelAlpha } from '@/types/kernel';
import { ThumbnailGen } from '@/services/thumbnailGenerator';
import { loadModel } from '@/systems/three/threeImport';
import { exportScene } from '@/systems/three/threeExport';

/**
 * Convert data URL to Blob
 */
export const dataURLToBlob = async (dataURL: string): Promise<Blob | null> => {
    if (!dataURL) return null;
    try {
        const res = await fetch(dataURL);
        return await res.blob();
    } catch (e) {
        return null;
    }
};

/**
 * Save project to .kipp file
 */
export const saveProject = async (
    artifacts: KernelArtifact[],
    materials: KernelMaterial[],
    alphas: KernelAlpha[],
    setStatus: (status: string) => void
): Promise<void> => {
    setStatus("ARCHIVING PROJECT...");
    try {
        const zip = new JSZip();

        // 1. Prepare Materials
        const materialsMeta: any[] = [];

        const saveTex = async (id: string, type: string, url: string, folder: string) => {
            if (!url) return null;
            const blob = await dataURLToBlob(url);
            if (blob) {
                const filename = `${folder}/${id}/${type}.png`;
                zip.file(filename, blob);
                return filename;
            }
            return null;
        };

        for (const mat of materials) {
            const baked = mat.baked?.maps || {};

            const base = baked.baseColor ?? mat.base ?? '';
            const normal = baked.normal ?? mat.normal ?? '';
            const roughness = baked.roughness ?? mat.roughness ?? '';
            const metallic = baked.metallic ?? mat.metallic ?? '';
            const ao = baked.ao ?? mat.ao ?? '';
            const height = baked.height ?? mat.height ?? '';
            const emissive = baked.emissive ?? mat.emissive ?? '';

            const meta: any = {
                id: mat.id,
                name: mat.name,
                schemaVersion: mat.schemaVersion ?? 1,
                workflow: mat.workflow ?? 'metalRough',
                params: mat.params ?? undefined,
                maps: {},
            };
            meta.maps.baseColor = await saveTex(mat.id, 'baseColor', base, 'materials');
            meta.maps.normal = await saveTex(mat.id, 'normal', normal, 'materials');
            meta.maps.roughness = await saveTex(mat.id, 'roughness', roughness, 'materials');
            meta.maps.metallic = await saveTex(mat.id, 'metallic', metallic, 'materials');
            meta.maps.ao = await saveTex(mat.id, 'ao', ao, 'materials');
            meta.maps.height = await saveTex(mat.id, 'height', height, 'materials');
            meta.maps.emissive = await saveTex(mat.id, 'emissive', emissive, 'materials');

            meta.preview = meta.maps.baseColor;
            materialsMeta.push(meta);
        }

        // 2. Prepare Alphas
        const alphasMeta: any[] = [];
        for (const alpha of alphas) {
            const path = await saveTex(alpha.id, 'alpha', alpha.url, 'alphas');
            if (path) {
                alphasMeta.push({ id: alpha.id, name: alpha.name, path });
            }
        }

        const manifest = {
            timestamp: Date.now(),
            version: "0.9.1",
            artifacts: artifacts.map(a => ({
                id: a.id,
                name: a.name,
                source: a.source,
                size: a.size,
                type: a.blob.type,
                isWelded: a.isWelded,
                artifactType: a.artifactType ?? 'mesh',
                fileExtension: a.fileExtension ?? 'glb',
                canMount: a.canMount ?? true,
                linkedArtifactId: a.linkedArtifactId ?? null,
                metadata: a.metadata ?? null,
            })),
            materials: materialsMeta,
            alphas: alphasMeta
        };

        zip.file("manifest.json", JSON.stringify(manifest));

        // 3. Add Artifacts
        artifacts.forEach(a => {
            zip.file(`artifacts/${a.id}`, a.blob);
            if (a.isWelded && a.weldedBlob) {
                zip.file(`artifacts/${a.id}_welded`, a.weldedBlob);
            }
        });

        const content = await zip.generateAsync({ type: 'blob' });
        const filename = `KIPP_PROJECT_${new Date().toISOString().split('T')[0]}.kipp`;
        const { saveBlobToFile } = await import('@/lib/utils/tauriSave');
        const saved = await saveBlobToFile(content, filename);
        setStatus(saved ? 'PROJECT SAVED' : 'SAVE CANCELLED');
    } catch (e) {
        console.error(e);
        setStatus("ARCHIVE ERROR");
    }
};

/**
 * Load project from .kipp file
 */
export const loadProject = async (
    file: File,
    setStatus: (status: string) => void
): Promise<{
    artifacts: KernelArtifact[];
    materials: KernelMaterial[];
    alphas: KernelAlpha[];
}> => {
    setStatus("READING ARCHIVE...");
    try {
        const zip = await JSZip.loadAsync(file);
        const manifestStr = await zip.file("manifest.json")?.async("string");
        if (!manifestStr) throw new Error("Invalid KIPP Project File");

        const manifest = JSON.parse(manifestStr);
        const newArtifacts: KernelArtifact[] = [];
        const newMaterials: KernelMaterial[] = [];
        const newAlphas: KernelAlpha[] = [];

        // 1. Load Artifacts
        for (const artMeta of manifest.artifacts) {
            const blobData = await zip.file(`artifacts/${artMeta.id}`)?.async("blob");
            if (blobData) {
                const thumb = await ThumbnailGen.generate(blobData);
                let weldedBlob = undefined;
                if (artMeta.isWelded) {
                    weldedBlob = await zip.file(`artifacts/${artMeta.id}_welded`)?.async("blob");
                }
                newArtifacts.push({
                    ...artMeta,
                    blob: blobData,
                    thumbnail: thumb,
                    weldedBlob: weldedBlob
                });
            }
        }

        const loadTex = async (path: string): Promise<string> => {
            if (!path) return '';
            const b = await zip.file(path)?.async("blob");
            return b ? URL.createObjectURL(b) : '';
        };

        // 2. Load Materials
        if (manifest.materials) {
            for (const matMeta of manifest.materials) {
                const maps: any = {};

                // New schema (preferred)
                if (matMeta.maps?.baseColor || matMeta.maps?.normal || matMeta.maps?.roughness) {
                    maps.baseColor = await loadTex(matMeta.maps.baseColor);
                    maps.normal = await loadTex(matMeta.maps.normal);
                    maps.roughness = await loadTex(matMeta.maps.roughness);
                    maps.metallic = await loadTex(matMeta.maps.metallic);
                    maps.ao = await loadTex(matMeta.maps.ao);
                    maps.height = await loadTex(matMeta.maps.height);
                    maps.emissive = await loadTex(matMeta.maps.emissive);

                    if (maps.baseColor) {
                        newMaterials.push({
                            id: matMeta.id,
                            name: matMeta.name,
                            schemaVersion: matMeta.schemaVersion ?? 1,
                            workflow: matMeta.workflow ?? 'metalRough',
                            params: matMeta.params ?? undefined,
                            baked: { maps: { ...maps } },
                            // Back-compat fields
                            base: maps.baseColor,
                            normal: maps.normal,
                            roughness: maps.roughness,
                            metallic: maps.metallic,
                            ao: maps.ao,
                            height: maps.height,
                            emissive: maps.emissive,
                            preview: maps.baseColor,
                        });
                    }
                    continue;
                }

                // Legacy schema (older .kipp)
                maps.base = await loadTex(matMeta.maps.base);
                maps.normal = await loadTex(matMeta.maps.normal);
                maps.roughness = await loadTex(matMeta.maps.roughness);
                maps.metallic = await loadTex(matMeta.maps.metallic);
                maps.ao = await loadTex(matMeta.maps.ao);
                maps.height = await loadTex(matMeta.maps.height);
                maps.emissive = await loadTex(matMeta.maps.emissive);

                if (maps.base) {
                    newMaterials.push({
                        id: matMeta.id,
                        name: matMeta.name,
                        schemaVersion: 1,
                        workflow: 'metalRough',
                        baked: {
                            maps: {
                                baseColor: maps.base,
                                normal: maps.normal,
                                roughness: maps.roughness,
                                metallic: maps.metallic,
                                ao: maps.ao,
                                height: maps.height,
                                emissive: maps.emissive,
                            },
                        },
                        // Back-compat fields
                        ...maps,
                        preview: maps.base,
                    });
                }
            }
        }

        // 3. Load Alphas
        if (manifest.alphas) {
            for (const alphaMeta of manifest.alphas) {
                const url = await loadTex(alphaMeta.path);
                if (url) {
                    const tex = new THREE.TextureLoader().load(url);
                    newAlphas.push({
                        id: alphaMeta.id,
                        name: alphaMeta.name,
                        url: url,
                        preview: url,
                        texture: tex
                    });
                }
            }
        }

        setStatus("SESSION RESTORED");
        return {
            artifacts: newArtifacts,
            materials: newMaterials,
            alphas: newAlphas
        };
    } catch (e) {
        console.error(e);
        setStatus("FILE CORRUPTED");
        throw e;
    }
};

/**
 * Process file import
 */
export const processImport = async (
    file: File,
    onCommit: (blob: Blob, source: string) => Promise<void>,
    setStatus: (status: string) => void
): Promise<void> => {
    setStatus(`ANALYZING ${file.name.toUpperCase()}...`);

    try {
        const { scene, animations } = await loadModel(file, {
            normalize: true,
            targetSize: 4.0,
            center: true
        });

        setStatus("CONVERTING TO KIPP BINARY...");
        await new Promise<void>(resolve => setTimeout(resolve, 100));

        const sceneToExport: THREE.Scene = scene instanceof THREE.Scene ? scene : (() => {
            const s = new THREE.Scene();
            s.add(scene);
            return s;
        })();

        const blob = await exportScene(
            { scene: sceneToExport, animations },
            {
                format: 'GLB',
                binary: true,
                normalize: false
            }
        );

        await onCommit(blob, "IMPORT_EXTERNAL");
        setStatus("IMPORT SUCCESSFUL");
    } catch (e) {
        console.error(e);
        setStatus("IMPORT FAILED");
        throw e;
    }
};


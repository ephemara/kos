import React, { useState, useCallback, useEffect } from 'react';
import { KernelArtifact, KernelMaterial, KernelAlpha } from '@mocap/types/kernel';
import { commitToKernel, mergeArtifacts, weldArtifact, createMaterial, createAlpha } from '@mocap/shared/services/kernelServices'
import { processImport, loadProject, saveProject } from '@mocap/shared/services/projectServices'
import { CATEGORY_CONFIG } from '@mocap/config/appConfig';

export const useKernelApp = () => {
    const [kernelArtifacts, setKernelArtifacts] = useState<KernelArtifact[]>([]);
    const [kernelMaterials, setKernelMaterials] = useState<KernelMaterial[]>([]);
    const [kernelAlphas, setKernelAlphas] = useState<KernelAlpha[]>([]);
    const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
    const [previewArtifactId, setPreviewArtifactId] = useState<string | null>(null);
    const [selectedArtifactIds, setSelectedArtifactIds] = useState<string[]>([]);
    const [isMerging, setIsMerging] = useState(false);
    const [kernelStatus, setKernelStatus] = useState("IDLE");
    const [isImporting, setIsImporting] = useState(false);
    const [isAssetBrowserOpen, setIsAssetBrowserOpen] = useState(false);
    const [browserTab, setBrowserTab] = useState<'ARTIFACTS' | 'MATERIALS' | 'ALPHAS' | 'SKETCHFAB'>('ARTIFACTS');
    const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
    const [tempImage, setTempImage] = useState<string | null>(null);
    const [sketchfabToken, setSketchfabToken] = useState<string | null>(null);

    // Initialize Sketchfab Token from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('kos-sketchfab-token');
        if (stored) setSketchfabToken(stored);
    }, []);

    const updateSketchfabToken = useCallback((newToken: string | null) => {
        setSketchfabToken(newToken);
        if (newToken) {
            localStorage.setItem('kos-sketchfab-token', newToken);
        } else {
            localStorage.removeItem('kos-sketchfab-token');
        }
    }, []);

    // Initialize folders open state
    useEffect(() => {
        const initial: Record<string, boolean> = {};
        Object.keys(CATEGORY_CONFIG).forEach(k => initial[k] = true);
        setOpenFolders(prev => ({ ...initial, ...prev }));
    }, []);

    const handleCommitToKernel = useCallback(async (blob: Blob, source: string) => {
        const newArtifact = await commitToKernel(
            blob,
            source,
            kernelArtifacts.length,
            setKernelStatus
        );
        setKernelArtifacts(prev => [newArtifact, ...prev]);
    }, [kernelArtifacts.length]);

    const handleMergeArtifacts = useCallback(async () => {
        if (selectedArtifactIds.length < 2) return;
        setIsMerging(true);
        await mergeArtifacts(
            selectedArtifactIds,
            kernelArtifacts,
            handleCommitToKernel,
            setKernelStatus
        );
        setSelectedArtifactIds([]);
        setIsMerging(false);
    }, [selectedArtifactIds, kernelArtifacts, handleCommitToKernel]);

    const toggleArtifactWeld = useCallback(async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const art = kernelArtifacts.find(a => a.id === id);
        if (!art || art.isProcessing) return;

        if (art.isWelded) {
            setKernelArtifacts(prev => prev.map(a => a.id === id ? { ...a, isWelded: false } : a));
            setKernelStatus("WELD REVERTED");
            return;
        }

        if (art.weldedBlob) {
            setKernelArtifacts(prev => prev.map(a => a.id === id ? { ...a, isWelded: true } : a));
            setKernelStatus("RESTORED MONOLITH");
            return;
        }

        setKernelArtifacts(prev => prev.map(a => a.id === id ? { ...a, isProcessing: true } : a));

        try {
            const weldedBlob = await weldArtifact(art, setKernelStatus);
            setKernelArtifacts(prev => prev.map(a =>
                a.id === id ? { ...a, isWelded: true, weldedBlob, isProcessing: false } : a
            ));
        } catch (err) {
            console.error(err);
            setKernelArtifacts(prev => prev.map(a => a.id === id ? { ...a, isProcessing: false } : a));
        }
    }, [kernelArtifacts]);

    const toggleArtifactSelection = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedArtifactIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    }, []);

    const handleDeleteArtifact = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setKernelArtifacts(prev => prev.filter(a => a.id !== id));
        setSelectedArtifactIds(prev => prev.filter(mid => mid !== id));
        if (activeArtifactId === id) setActiveArtifactId(null);
        if (previewArtifactId === id) setPreviewArtifactId(null);
    }, [activeArtifactId, previewArtifactId]);

    const handleDownloadArtifact = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const art = kernelArtifacts.find(a => a.id === id);
        if (art) {
            const blobToDL = (art.isWelded && art.weldedBlob) ? art.weldedBlob : art.blob;
            const url = URL.createObjectURL(blobToDL);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${art.name}${art.isWelded ? '_Monolith' : ''}.glb`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }, [kernelArtifacts]);

    const handleMaterialCommit = useCallback((materialOrMaps: any) => {
        const isMaterialAsset = !!materialOrMaps
            && typeof materialOrMaps === 'object'
            && typeof materialOrMaps.id === 'string'
            && typeof materialOrMaps.schemaVersion === 'number'
            && typeof materialOrMaps.workflow === 'string';

        const newMat = isMaterialAsset
            ? (materialOrMaps as KernelMaterial)
            : createMaterial(materialOrMaps, kernelMaterials.length);
        setKernelMaterials(prev => [...prev, newMat]);
        setKernelStatus("MATERIAL STORED");
    }, [kernelMaterials.length]);

    const handleAlphaCommit = useCallback((alphaData: { name: string, url: string }) => {
        const newAlpha = createAlpha(alphaData, kernelAlphas.length);
        setKernelAlphas(prev => [...prev, newAlpha]);
        setKernelStatus("ALPHA STORED");
    }, [kernelAlphas.length]);

    const handleDeleteMaterial = useCallback((id: string) => {
        setKernelMaterials(prev => prev.filter(m => m.id !== id));
    }, []);

    const handleDeleteAlpha = useCallback((id: string) => {
        setKernelAlphas(prev => prev.filter(a => a.id !== id));
    }, []);

    const getActiveArtifactBlob = useCallback(() => {
        const art = kernelArtifacts.find(a => a.id === activeArtifactId);
        if (!art) return null;
        return (art.isWelded && art.weldedBlob) ? art.weldedBlob : art.blob;
    }, [kernelArtifacts, activeArtifactId]);

    const processFileImport = useCallback(async (file: File) => {
        setIsImporting(true);
        try {
            await processImport(file, handleCommitToKernel, setKernelStatus);
        } finally {
            setIsImporting(false);
        }
    }, [handleCommitToKernel]);

    const handleSketchfabImport = useCallback(async (downloadUrl: string, name: string) => {
        setIsImporting(true);
        setKernelStatus(`DOWNLOADING: ${name.toUpperCase()}...`);
        try {
            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error("Failed to download model from Sketchfab");

            const blob = await response.blob();
            // Wrap in a file object to maintain naming if needed, though commitToKernel handles name
            const artifact = await commitToKernel(blob, `SKETCHFAB_${name}`, kernelArtifacts.length, setKernelStatus);
            setKernelArtifacts(prev => [artifact, ...prev]);
            setKernelStatus(`IMPORTED: ${name}`);
        } catch (err: any) {
            console.error(err);
            setKernelStatus(`IMPORT FAILED: ${err.message}`);
        } finally {
            setIsImporting(false);
        }
    }, [handleCommitToKernel, kernelArtifacts.length]);

    const processAlphaImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach((file: File) => {
            const url = URL.createObjectURL(file);
            handleAlphaCommit({ name: file.name, url: url });
        });
    }, [handleAlphaCommit]);

    const handleNewProject = useCallback(() => {
        setKernelArtifacts([]);
        setKernelMaterials([]);
        setKernelAlphas([]);
        setKernelStatus("SESSION INITIALIZED");
    }, []);

    const handleLoadProject = useCallback(async (file: File) => {
        try {
            const result = await loadProject(file, setKernelStatus);
            setKernelArtifacts(result.artifacts);
            setKernelMaterials(result.materials);
            setKernelAlphas(result.alphas);
            return true;
        } catch (e) {
            return false;
        }
    }, []);

    const handleSaveProject = useCallback(async () => {
        await saveProject(kernelArtifacts, kernelMaterials, kernelAlphas, setKernelStatus);
    }, [kernelArtifacts, kernelMaterials, kernelAlphas]);

    const openAssetBrowser = useCallback(() => {
        setIsAssetBrowserOpen(true);
        if (activeArtifactId) setPreviewArtifactId(activeArtifactId);
    }, [activeArtifactId]);

    return {
        // State
        kernelArtifacts,
        kernelMaterials,
        kernelAlphas,
        activeArtifactId,
        previewArtifactId,
        selectedArtifactIds,
        isMerging,
        kernelStatus,
        isImporting,
        isAssetBrowserOpen,
        browserTab,
        openFolders,
        // Setters
        setKernelArtifacts,
        setKernelMaterials,
        setKernelAlphas,
        setActiveArtifactId,
        setPreviewArtifactId,
        setSelectedArtifactIds,
        setKernelStatus,
        setIsAssetBrowserOpen,
        setBrowserTab,
        setOpenFolders,
        updateSketchfabToken,
        // Actions
        handleCommitToKernel,
        handleMergeArtifacts,
        toggleArtifactWeld,
        toggleArtifactSelection,
        handleDeleteArtifact,
        handleDownloadArtifact,
        handleMaterialCommit,
        handleAlphaCommit,
        handleDeleteMaterial,
        handleDeleteAlpha,
        getActiveArtifactBlob,
        processFileImport,
        processAlphaImport,
        handleSketchfabImport,
        handleNewProject,
        handleLoadProject,
        handleSaveProject,
        openAssetBrowser,
        // Inter-App Communication
        tempImage,
        setTempImage,
        sketchfabToken
    };
};
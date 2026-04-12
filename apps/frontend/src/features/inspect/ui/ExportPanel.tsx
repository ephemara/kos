/**
 * ExportPanel.tsx
 *
 * Fully data-driven export panel for KInspect.
 * Format list and preset list are both driven by config — no hardcoded strings.
 */

import React from 'react';
import { Sliders, FileOutput, UploadCloud, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { EXPORT_PRESETS } from '@/lib/utils/ExchangeSystem';
import { EXPORT_FORMATS, DEFAULT_EXPORT_FORMAT } from '@/lib/utils/exportConfig';
import type { ExportStatus } from '@/hooks/useKInspectExport';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ExportPanelProps {
    targetPreset: string;
    setTargetPreset: (v: string) => void;
    targetFormat: string;
    setTargetFormat: (v: string) => void;
    isExporting: boolean;
    exportStatus: ExportStatus;
    exportError: string | null;
    lastExportPath: string | null;
    onExport: () => void;
    onClearError: () => void;
    hasModel: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExportPanel({
    targetPreset,
    setTargetPreset,
    targetFormat,
    setTargetFormat,
    isExporting,
    exportStatus,
    exportError,
    lastExportPath,
    onExport,
    onClearError,
    hasModel,
}: ExportPanelProps) {

    // Status label
    const statusLabel: Record<ExportStatus, string> = {
        IDLE: hasModel ? 'READY TO EXPORT' : 'LOAD A MODEL FIRST',
        PACKING: 'PACKING ASSET…',
        SAVING: 'OPENING SAVE DIALOG…',
        WRITING: 'WRITING TO DISK…',
        DONE: 'EXPORT COMPLETE',
        CANCELLED: 'CANCELLED',
        ERROR: exportError ?? 'EXPORT FAILED',
    };

    const statusColor: Record<ExportStatus, string> = {
        IDLE: hasModel ? '#555' : '#3a3a3a',
        PACKING: '#f97316',
        SAVING: '#f97316',
        WRITING: '#f97316',
        DONE: '#22c55e',
        CANCELLED: '#555',
        ERROR: '#ef4444',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 10 }}>

            {/* ── TARGET PRESET ── */}
            <div style={{ background: '#111', borderRadius: 7, border: '1px solid #1e1e1e', padding: 10 }}>
                <div style={{ fontSize: 8, fontWeight: 900, color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <Sliders size={9} /> Target Preset
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                    {Object.entries(EXPORT_PRESETS).map(([k, v]: [string, any]) => {
                        const active = targetPreset === k;
                        const Icon = v.icon;
                        return (
                            <button
                                key={k}
                                onClick={() => setTargetPreset(k)}
                                title={v.desc}
                                style={{
                                    padding: '7px 8px',
                                    borderRadius: 6,
                                    border: '1px solid',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'all 100ms',
                                    fontFamily: 'inherit',
                                    background: active ? 'rgba(0,255,204,0.08)' : '#0a0a0a',
                                    borderColor: active ? 'rgba(0,255,204,0.35)' : '#1e1e1e',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                                    <Icon size={10} style={{ color: active ? '#00ffcc' : '#555' }} />
                                    <span style={{ fontSize: 8, fontWeight: 800, color: active ? '#00ffcc' : '#666', letterSpacing: '0.06em' }}>{k}</span>
                                </div>
                                <div style={{ fontSize: 7, color: active ? '#00ccaa' : '#3a3a3a', lineHeight: 1.3 }}>{v.desc}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── FORMAT PICKER — driven by exportConfig ── */}
            <div style={{ background: '#111', borderRadius: 7, border: '1px solid #1e1e1e', padding: 10 }}>
                <div style={{ fontSize: 8, fontWeight: 900, color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Output Format
                </div>
                <div style={{ display: 'flex', gap: 3, background: '#080808', borderRadius: 5, padding: 3, border: '1px solid #1a1a1a' }}>
                    {EXPORT_FORMATS.filter(f => f.supportsMeshes).map(f => {
                        const active = targetFormat === f.id;
                        return (
                            <button
                                key={f.id}
                                onClick={() => setTargetFormat(f.id)}
                                title={f.desc}
                                style={{
                                    flex: 1,
                                    padding: '5px 4px',
                                    borderRadius: 4,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 8,
                                    fontWeight: 800,
                                    letterSpacing: '0.05em',
                                    transition: 'all 100ms',
                                    fontFamily: 'inherit',
                                    background: active ? '#00ffcc' : 'transparent',
                                    color: active ? '#000' : '#555',
                                }}
                            >
                                {f.label}
                            </button>
                        );
                    })}
                </div>
                {/* Format description */}
                <div style={{ marginTop: 6, fontSize: 8, color: '#3a3a3a', lineHeight: 1.4 }}>
                    {EXPORT_FORMATS.find(f => f.id === targetFormat)?.desc ?? ''}
                </div>
            </div>

            {/* ── STATUS ── */}
            <div style={{
                padding: '6px 10px',
                borderRadius: 6,
                background: '#080808',
                border: '1px solid #1a1a1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    {exportStatus === 'DONE' && <CheckCircle2 size={10} style={{ color: '#22c55e', flexShrink: 0 }} />}
                    {exportStatus === 'ERROR' && <AlertTriangle size={10} style={{ color: '#ef4444', flexShrink: 0 }} />}
                    {isExporting && (
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            border: '1.5px solid rgba(249,115,22,0.3)',
                            borderTopColor: 'rgb(249,115,22)',
                            display: 'inline-block',
                            animation: 'spin 0.8s linear infinite',
                            flexShrink: 0,
                        }} />
                    )}
                    <span style={{
                        fontSize: 8, fontWeight: 800,
                        color: statusColor[exportStatus],
                        letterSpacing: '0.08em',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {statusLabel[exportStatus]}
                    </span>
                </div>
                {(exportStatus === 'ERROR' || exportStatus === 'CANCELLED') && (
                    <button onClick={onClearError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, flexShrink: 0 }}>
                        <X size={10} />
                    </button>
                )}
            </div>

            {/* Last export path */}
            {exportStatus === 'DONE' && lastExportPath && (
                <div style={{ fontSize: 7, color: '#3a3a3a', wordBreak: 'break-all', lineHeight: 1.4 }}>
                    → {lastExportPath}
                </div>
            )}

            {/* ── EXPORT BUTTON ── */}
            <button
                onClick={onExport}
                disabled={isExporting || !hasModel}
                style={{
                    width: '100%',
                    padding: '11px 0',
                    borderRadius: 7,
                    border: 'none',
                    cursor: isExporting || !hasModel ? 'not-allowed' : 'pointer',
                    background: isExporting || !hasModel
                        ? 'rgba(0,255,204,0.05)'
                        : 'linear-gradient(135deg, #00ffcc 0%, #00d4aa 100%)',
                    color: isExporting || !hasModel ? '#2a2a2a' : '#000',
                    fontSize: 10, fontWeight: 900,
                    letterSpacing: '0.12em',
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    boxShadow: !isExporting && hasModel ? '0 0 20px rgba(0,255,204,0.2)' : 'none',
                    transition: 'all 150ms',
                }}
            >
                {isExporting
                    ? <UploadCloud size={13} style={{ animation: 'bounce 1s infinite' }} />
                    : <FileOutput size={13} />
                }
                {isExporting ? 'PROCESSING…' : hasModel ? `EXPORT  ${targetFormat}` : 'NO MODEL LOADED'}
            </button>
        </div>
    );
}

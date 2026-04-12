import React from 'react';
import { 
  MousePointer2, 
  Move, 
  Pencil, 
  ArrowUpFromLine, 
  Circle,
  Download,
  ScanLine
} from 'lucide-react';
import type { RetopoMode } from '../KRetopo';
import {
  AppTopBar,
  AppTopBarGroup,
  AppTopBarSeparator,
  AppTopBarButton,
  AppTopBarToggleGroup,
  AppTopBarToggleItem,
} from '@/ui/shell/AppTopBar';

interface TopBarProps {
  mode: RetopoMode;
  onModeChange: (mode: RetopoMode) => void;
  onExport: () => void;
  status: string;
}

export default function TopBar({
  mode,
  onModeChange,
  onExport,
  status,
}: TopBarProps) {
  const modes: { id: RetopoMode; icon: React.ReactNode; label: string; tooltip: string }[] = [
    { id: 'draw', icon: <Pencil size={12} />, label: 'Draw', tooltip: 'Quad drawing mode' },
    { id: 'select', icon: <MousePointer2 size={12} />, label: 'Select', tooltip: 'Select components' },
    { id: 'move', icon: <Move size={12} />, label: 'Move', tooltip: 'Move vertices and edges' },
    { id: 'extrude', icon: <ArrowUpFromLine size={12} />, label: 'Extrude', tooltip: 'Extrude region' },
    { id: 'loop', icon: <Circle size={12} />, label: 'Loop', tooltip: 'Loop cut mode' },
  ];

  return (
    <AppTopBar>
      <AppTopBarGroup align="start">
        <div className="flex items-center gap-2">
          <ScanLine size={14} className="text-orange-400" />
          <span className="text-[11px] font-black tracking-wide text-zinc-200">K-RETOPO</span>
        </div>

        <AppTopBarSeparator />

        <AppTopBarToggleGroup
          type="single"
          value={mode}
          onValueChange={(value) => value && onModeChange(value as RetopoMode)}
        >
          {modes.map((m) => (
            <AppTopBarToggleItem
              key={m.id}
              value={m.id}
              tooltip={m.tooltip}
              icon={m.icon}
              label={m.label.toUpperCase()}
            />
          ))}
        </AppTopBarToggleGroup>
      </AppTopBarGroup>

      <AppTopBarGroup align="center">
        <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[320px]">{status}</span>
      </AppTopBarGroup>

      <AppTopBarGroup align="end">
        <AppTopBarButton
          tooltip="Export retopologized mesh"
          shortcut="Ctrl+S"
          label="EXPORT"
          icon={<Download size={12} />}
          onClick={onExport}
          variant="outline"
          className="border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15"
        />
      </AppTopBarGroup>
    </AppTopBar>
  );
}

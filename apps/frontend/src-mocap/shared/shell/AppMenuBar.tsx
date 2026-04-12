import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Video, Eye, LayoutTemplate, Maximize, HelpCircle } from 'lucide-react';
import { cn } from '@mocap/shared/primitives/cn';

// ─── Menu item config (data-driven) ───────────────────────────────────────────

const ITEM_CLS = 'flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-gray-300 hover:bg-[#1a1a1a] hover:text-white cursor-pointer outline-none rounded-md transition-colors select-none';
const CONTENT_CLS = 'min-w-[200px] bg-[#0c0c0c]/98 border border-[#222] rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.7)] backdrop-blur-xl py-1.5 px-1 z-[200]';
const SEP_CLS = 'h-px bg-[#1a1a1a] my-1 mx-1';
const TRIGGER_CLS = 'px-2.5 py-1 text-[11px] font-bold text-gray-500 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-all select-none';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AppMenuBarProps {
  /** Called when View → Camera Preview is toggled */
  onToggleCameraPreview?: () => void;
  /** Whether camera preview is currently visible */
  cameraPreviewOpen?: boolean;
  /** Other custom menus optionally injected */
  customMenus?: React.ReactNode;
  className?: string;
}

/**
 * Application menu bar — File, Edit, View (+ Camera Preview toggle), Help.
 * Data-driven: items for each menu defined as arrays above the JSX.
 */
export const AppMenuBar: React.FC<AppMenuBarProps> = ({
  onToggleCameraPreview,
  cameraPreviewOpen = false,
  customMenus,
  className,
}) => {
  const handleToggleCameraPreview = React.useCallback(() => {
    onToggleCameraPreview?.();
  }, [onToggleCameraPreview]);

  return (
    <div className={cn('flex items-center gap-0.5', className)} data-no-drag>

      {/* ── File ─────────────────────────────────────────────────────────── */}
      <MenuRoot label="File">
        <MenuGroup>
          <MenuItem label="New Take" shortcut="Ctrl+N" />
          <MenuItem label="Open Take…" shortcut="Ctrl+O" />
          <MenuItem label="Save Take" shortcut="Ctrl+S" />
        </MenuGroup>
        <Sep />
        <MenuItem label="Exit" />
      </MenuRoot>

      {/* ── Edit ─────────────────────────────────────────────────────────── */}
      <MenuRoot label="Edit">
        <MenuGroup>
          <MenuItem label="Undo" shortcut="Ctrl+Z" />
          <MenuItem label="Redo" shortcut="Ctrl+Y" />
        </MenuGroup>
        <Sep />
        <MenuGroup>
          <MenuItem label="Cut" shortcut="Ctrl+X" />
          <MenuItem label="Copy" shortcut="Ctrl+C" />
          <MenuItem label="Paste" shortcut="Ctrl+V" />
        </MenuGroup>
      </MenuRoot>

      {/* ── View ─────────────────────────────────────────────────────────── */}
      <MenuRoot label="View">
        <MenuGroup>
          {/* Camera Preview toggle — the main new item */}
          <DropdownMenu.Item
            className={cn(ITEM_CLS, cameraPreviewOpen && 'text-[color:var(--kos-accent-primary)]')}
            onSelect={(event) => {
              event.preventDefault();
              handleToggleCameraPreview();
            }}
            onClick={handleToggleCameraPreview}
          >
            <Video size={11} className={cameraPreviewOpen ? 'text-[color:var(--kos-accent-primary)]' : 'opacity-50'} />
            Camera Preview
            {cameraPreviewOpen && (
              <span className="ml-auto text-[8px] font-mono bg-[color:var(--kos-accent-primary)]/15 text-[color:var(--kos-accent-primary)] px-1.5 py-0.5 rounded">
                ON
              </span>
            )}
          </DropdownMenu.Item>
        </MenuGroup>
        <Sep />
        <MenuGroup>
          <MenuItem label="Fullscreen" shortcut="F11" />
          <MenuItem label="Reset Layout" />
        </MenuGroup>
      </MenuRoot>

      {/* ── Help ─────────────────────────────────────────────────────────── */}
      <MenuRoot label="Help">
        <MenuItem label="Documentation" />
        <MenuItem label="About ZenMocap" />
      </MenuRoot>

      {customMenus}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function MenuRoot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={TRIGGER_CLS}>{label}</button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={CONTENT_CLS} sideOffset={4} align="start">
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MenuItem({ label, shortcut, onSelect }: { label: string; shortcut?: string; onSelect?: () => void }) {
  return (
    <DropdownMenu.Item className={ITEM_CLS} onSelect={onSelect}>
      {label}
      {shortcut && (
        <span className="ml-auto text-[8px] font-mono text-gray-600">{shortcut}</span>
      )}
    </DropdownMenu.Item>
  );
}

function Sep() {
  return <DropdownMenu.Separator className={SEP_CLS} />;
}

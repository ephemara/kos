
import React, { useEffect, useRef, useState } from 'react';

interface KGraphosCursorProps {
    brush: {
        size: number;
        color: string;
        erase: boolean;
        hardness: number;
        alphaMap?: any;
        angle?: number;
    };
    zoomRef: React.MutableRefObject<number>;
    viewportRef: React.RefObject<HTMLDivElement>;
    show: boolean;
}

export default function KGraphosCursor({ brush, zoomRef, viewportRef, show }: KGraphosCursorProps) {
    const cursorRef = useRef<HTMLDivElement>(null);
    const outerRingRef = useRef<HTMLDivElement>(null);
    const [forceRender, setForceRender] = useState(0); // Only for brush prop changes

    // Update cursor position and visibility directly
    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            if (!cursorRef.current) return;
            const cursor = cursorRef.current;

            // Check bounds
            let inBounds = true;
            if (viewportRef.current) {
                const rect = viewportRef.current.getBoundingClientRect();
                inBounds =
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom;
            }

            // Sync Position
            cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;

            // Sync Visibility
            // We use opacity instead of conditional rendering to avoid React cycles
            cursor.style.opacity = (show && inBounds) ? '1' : '0';
        };

        window.addEventListener('mousemove', handleMove);
        return () => window.removeEventListener('mousemove', handleMove);
    }, [viewportRef, show]);

    // Update Loop for Smooth Size Interpolation
    useEffect(() => {
        let rafId: number;
        const updateSize = () => {
            if (outerRingRef.current) {
                // Determine target pixel size
                const pixelSize = Math.max(4, brush.size * zoomRef.current);

                // Direct DOM update
                outerRingRef.current.style.width = `${pixelSize}px`;
                outerRingRef.current.style.height = `${pixelSize}px`;

                // Centering
                if (cursorRef.current) {
                    cursorRef.current.style.marginTop = `${-pixelSize / 2}px`;
                    cursorRef.current.style.marginLeft = `${-pixelSize / 2}px`;
                }
            }
            rafId = requestAnimationFrame(updateSize);
        };
        rafId = requestAnimationFrame(updateSize);
        return () => cancelAnimationFrame(rafId);
    }, [brush.size, zoomRef]); // Re-bind if refs change (rare)

    // Re-render only when brush properties affecting APPEARANCE change
    // We use a key-based approach for the visual props

    const borderColor = brush.erase ? '#f43f5e' : '#ffffff';
    const alphaSrc = brush.alphaMap?.image?.src || (brush.alphaMap?.image instanceof HTMLCanvasElement ? brush.alphaMap.image.toDataURL() : null);

    return (
        <div
            ref={cursorRef}
            className="fixed top-0 left-0 pointer-events-none z-[9999] transition-opacity duration-75"
            style={{
                willChange: 'transform, opacity',
                opacity: 0 // Start hidden
            }}
        >
            <div
                ref={outerRingRef}
                className="rounded-full border flex items-center justify-center relative overflow-hidden"
                style={{
                    // Initial styles, updated by RAF
                    width: 10, height: 10,
                    borderColor: borderColor,
                    borderWidth: '1px',
                    borderStyle: brush.erase ? 'dashed' : 'solid',
                    backgroundColor: brush.erase ? 'rgba(244, 63, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                    transform: `rotate(${brush.angle || 0}rad)`
                }}
            >
                {/* ALPHA PREVIEW */}
                {alphaSrc && !brush.erase && (
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                        <img src={alphaSrc} className="w-full h-full object-cover" style={{ mixBlendMode: 'difference', opacity: 1.0 }} alt="" />
                    </div>
                )}

                {/* CROSSHAIR */}
                {(!alphaSrc || brush.erase) && (
                    <>
                        <div className="absolute w-[4px] h-[4px] bg-white rounded-full mix-blend-difference" />
                        <div className="absolute w-[1px] h-[10px] bg-white mix-blend-difference" />
                        <div className="absolute w-[10px] h-[1px] bg-white mix-blend-difference" />
                    </>
                )}
            </div>
        </div>
    );
}

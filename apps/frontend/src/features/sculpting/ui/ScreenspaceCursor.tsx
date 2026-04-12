/**
 * ScreenspaceCursor.tsx
 * 
 * A simple 2D screenspace brush cursor (optional mode).
 * - Follows mouse position directly (no raycast dependency)
 * - Lightweight, no heavy animations
 */

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface ScreenspaceCursorProps {
    radius: number;
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera | null;
    visible: boolean;
    color?: string;
    isActive?: boolean;
    symmetry?: 'NONE' | 'X';
    mountRef?: React.RefObject<HTMLDivElement>;
}

export const ScreenspaceCursor: React.FC<ScreenspaceCursorProps> = ({
    radius,
    camera,
    visible,
    color = '#ff8c00',
    isActive = false,
    symmetry = 'NONE',
    mountRef
}) => {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [screenRadius, setScreenRadius] = useState(50);
    const rafRef = useRef<number>(0);

    // Track mouse position
    useEffect(() => {
        let currentX = 0;
        let currentY = 0;
        let targetX = 0;
        let targetY = 0;

        const handleMouseMove = (e: MouseEvent) => {
            if (mountRef?.current) {
                const rect = mountRef.current.getBoundingClientRect();
                targetX = e.clientX - rect.left;
                targetY = e.clientY - rect.top;
            } else {
                targetX = e.clientX;
                targetY = e.clientY;
            }
        };

        const animate = () => {
            currentX += (targetX - currentX) * 0.8;
            currentY += (targetY - currentY) * 0.8;
            setMousePos({ x: currentX, y: currentY });
            rafRef.current = requestAnimationFrame(animate);
        };

        window.addEventListener('mousemove', handleMouseMove);
        rafRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(rafRef.current);
        };
    }, [mountRef]);

    // Update screen radius
    useEffect(() => {
        if (camera && mountRef?.current) {
            const rect = mountRef.current.getBoundingClientRect();
            const fov = (camera as THREE.PerspectiveCamera).fov || 60;
            const fovRad = (fov / 2) * (Math.PI / 180);
            const cameraDistance = camera.position.length();
            const screenHeight = rect.height;
            const projectedRadius = (radius / cameraDistance) * (screenHeight / 2) / Math.tan(fovRad);
            setScreenRadius(Math.max(10, Math.min(projectedRadius, 500)));
        } else {
            setScreenRadius(radius * 100);
        }
    }, [radius, camera, mountRef]);

    if (!visible) return null;

    const style: React.CSSProperties = {
        position: 'absolute',
        left: mousePos.x - screenRadius,
        top: mousePos.y - screenRadius,
        width: screenRadius * 2,
        height: screenRadius * 2,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        boxShadow: isActive ? `0 0 15px ${color}` : `0 0 8px ${color}80`,
        pointerEvents: 'none',
        zIndex: 1000,
    };

    // Symmetry
    const showSymmetry = symmetry === 'X' && mountRef?.current;
    let symX = 0;
    if (showSymmetry && mountRef?.current) {
        const rect = mountRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        symX = centerX + (centerX - mousePos.x);
    }

    return (
        <>
            <div style={style} />
            {showSymmetry && (
                <div style={{
                    ...style,
                    left: symX - screenRadius,
                    opacity: 0.5,
                    borderStyle: 'dashed',
                }} />
            )}
        </>
    );
};

export default ScreenspaceCursor;

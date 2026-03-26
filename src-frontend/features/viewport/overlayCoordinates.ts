import * as React from 'react';

export interface ViewportOverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  pixelsPerPoint: number;
}

export interface ViewportOverlayPoint {
  x: number;
  y: number;
}

export interface ViewportNdcPoint {
  x: number;
  y: number;
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function toOverlayRect(rect: DOMRect): ViewportOverlayRect {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom,
    pixelsPerPoint: window.devicePixelRatio || 1,
  };
}

export function clientToOverlayPoint(
  rect: ViewportOverlayRect,
  clientX: number,
  clientY: number,
): ViewportOverlayPoint {
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export function overlayPointToNdc(
  rect: ViewportOverlayRect,
  point: ViewportOverlayPoint,
): ViewportNdcPoint {
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const u = clamp01(point.x / width);
  const v = clamp01(point.y / height);

  return {
    x: u * 2 - 1,
    y: -(v * 2 - 1),
  };
}

export function clientToNdc(
  rect: ViewportOverlayRect,
  clientX: number,
  clientY: number,
): ViewportNdcPoint {
  return overlayPointToNdc(rect, clientToOverlayPoint(rect, clientX, clientY));
}

export function ndcToOverlayPoint(
  rect: ViewportOverlayRect,
  ndc: ViewportNdcPoint,
): ViewportOverlayPoint {
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const u = clamp01((ndc.x + 1) * 0.5);
  const v = clamp01(1 - (ndc.y + 1) * 0.5);

  return {
    x: u * width,
    y: v * height,
  };
}

export function useViewportOverlayCoordinates(
  viewportRef: React.RefObject<HTMLDivElement>,
): ViewportOverlayRect | null {
  const [overlayRect, setOverlayRect] = React.useState<ViewportOverlayRect | null>(null);

  React.useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      setOverlayRect(null);
      return;
    }

    const updateRect = () => {
      const next = toOverlayRect(element.getBoundingClientRect());
      setOverlayRect((prev) => {
        if (
          prev &&
          prev.left === next.left &&
          prev.top === next.top &&
          prev.width === next.width &&
          prev.height === next.height &&
          prev.pixelsPerPoint === next.pixelsPerPoint
        ) {
          return prev;
        }
        return next;
      });
    };

    updateRect();

    const resizeObserver = new ResizeObserver(() => updateRect());
    resizeObserver.observe(element);

    const handleScroll = () => updateRect();
    const handleResize = () => updateRect();

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [viewportRef]);

  return overlayRect;
}

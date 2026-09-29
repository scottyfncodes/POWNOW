import { useCallback, useEffect, useRef, useState } from 'react';
import type { Mountain } from '@/domain/mountain';
import type { TrailMap } from '@/domain/mountainProfile';
import {
  MIN_SCALE,
  clampScale,
  clampTranslate,
  distanceBetween,
  midpoint,
  toggleDoubleTapScale,
  zoomAroundPoint,
  type Transform,
} from '@/lib/pinchZoom';

export interface TrailMapViewerProps {
  mountain: Mountain;
  trailMap: TrailMap;
  onClose: () => void;
}

const DOUBLE_TAP_WINDOW_MS = 320;

/**
 * Full-screen trail-map viewer: pinch/drag/zoom for an image, the browser's
 * own PDF viewer (which already has its own zoom/pan) for a PDF. Opened as
 * an overlay rather than a route, so closing it never loses the caller's
 * scroll position in the mountain profile underneath — nothing about the
 * page it was opened from ever unmounts.
 */
export function TrailMapViewer({ mountain, trailMap, onClose }: TrailMapViewerProps) {
  const [transform, setTransform] = useState<Transform>({ scale: MIN_SCALE, x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ distance: number; scale: number } | null>(null);
  const lastTapAt = useRef(0);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const viewportCenter = useCallback(() => {
    const rect = stageRef.current?.getBoundingClientRect();
    return rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: 0, y: 0 };
  }, []);

  const applyZoom = useCallback(
    (nextScale: number, focalPoint: { x: number; y: number }) => {
      setTransform((current) => {
        const zoomed = zoomAroundPoint(current, nextScale, focalPoint, viewportCenter());
        const rect = stageRef.current?.getBoundingClientRect();
        const bounded = clampTranslate(zoomed, rect?.width ?? 0, rect?.height ?? 0);
        return { scale: zoomed.scale, x: bounded.x, y: bounded.y };
      });
    },
    [viewportCenter],
  );

  const handlePointerDown = (event: React.PointerEvent) => {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { distance: distanceBetween(a!, b!), scale: transform.scale };
    } else if (pointers.current.size === 1) {
      const now = Date.now();
      if (now - lastTapAt.current < DOUBLE_TAP_WINDOW_MS) {
        applyZoom(toggleDoubleTapScale(transform.scale), { x: event.clientX, y: event.clientY });
      }
      lastTapAt.current = now;
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    const previous = pointers.current.get(event.pointerId)!;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const newDistance = distanceBetween(a!, b!);
      const nextScale = clampScale((gesture.current.scale * newDistance) / gesture.current.distance);
      applyZoom(nextScale, midpoint(a!, b!));
      return;
    }

    if (pointers.current.size === 1 && transform.scale > MIN_SCALE) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      setTransform((current) => {
        const rect = stageRef.current?.getBoundingClientRect();
        const bounded = clampTranslate(
          { scale: current.scale, x: current.x + dx, y: current.y + dy },
          rect?.width ?? 0,
          rect?.height ?? 0,
        );
        return { ...current, ...bounded };
      });
    }
  };

  const endPointer = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    applyZoom(transform.scale + direction * 0.35, { x: event.clientX, y: event.clientY });
  };

  const resetZoom = () => setTransform({ scale: MIN_SCALE, x: 0, y: 0 });

  return (
    <div
      className="trailmapviewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${mountain.name} trail map`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="trailmapviewer-head">
        <div className="trailmapviewer-title">
          <span className="trailmapviewer-mountain">{mountain.name}</span>
          {trailMap.season && <span className="chip trailmapviewer-season">{trailMap.season} season</span>}
        </div>
        <div className="trailmapviewer-actions">
          <a href={trailMap.officialUrl} target="_blank" rel="noreferrer" className="trailmapviewer-official">
            Official Trail Map ↗
          </a>
          <button type="button" ref={closeButtonRef} className="trailmapviewer-close" onClick={onClose}>
            <span aria-hidden="true">✕</span>
            <span className="visually-hidden">Close trail map</span>
          </button>
        </div>
      </header>

      {trailMap.imageUrl ? (
        <div
          ref={stageRef}
          className="trailmapviewer-stage"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onPointerLeave={endPointer}
          onWheel={handleWheel}
        >
          <img
            src={trailMap.imageUrl}
            alt={`${mountain.name} official trail map${trailMap.season ? `, ${trailMap.season} season` : ''}`}
            className="trailmapviewer-image"
            draggable={false}
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            }}
          />
        </div>
      ) : trailMap.pdfUrl ? (
        <div className="trailmapviewer-stage trailmapviewer-stage-pdf">
          <iframe title={`${mountain.name} trail map PDF`} src={trailMap.pdfUrl} className="trailmapviewer-pdf" />
        </div>
      ) : null}

      <footer className="trailmapviewer-foot">
        {trailMap.imageUrl && (
          <button type="button" className="linkbutton trailmapviewer-reset" onClick={resetZoom}>
            Reset zoom
          </button>
        )}
        {trailMap.pdfUrl && (
          <a href={trailMap.pdfUrl} target="_blank" rel="noreferrer" className="trailmapviewer-pdf-fallback">
            Open PDF in a new tab ↗
          </a>
        )}
      </footer>
    </div>
  );
}

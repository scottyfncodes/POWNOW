import { useState } from 'react';
import type { Mountain } from '@/domain/mountain';
import type { TrailMap } from '@/domain/mountainProfile';
import { TrailMapViewer } from './TrailMapViewer';

export interface TrailMapPanelProps {
  mountain: Mountain;
  trailMap: TrailMap | null;
}

/**
 * "Where am I going to ski when I get there?" — its own prominent section,
 * not a link buried in a reference list. Shows a real preview the moment an
 * official asset is confirmed; otherwise an honest unavailable state with a
 * link to the resort's own trail-map page. Never a fabricated layout,
 * never a stand-in from a different resort.
 */
export function TrailMapPanel({ mountain, trailMap }: TrailMapPanelProps) {
  const [open, setOpen] = useState(false);
  const hasAsset = Boolean(trailMap?.imageUrl || trailMap?.pdfUrl);

  return (
    <section className="panel trailmappanel" aria-labelledby="trailmap-heading">
      <header className="panel-head">
        <h2 id="trailmap-heading" className="section-title">
          🗺️ Trail map
        </h2>
        {trailMap?.season && <span className="chip trailmappanel-season">{trailMap.season}</span>}
      </header>

      {hasAsset && trailMap ? (
        <>
          <button type="button" className="trailmappanel-preview" onClick={() => setOpen(true)}>
            {trailMap.imageUrl ? (
              <img
                src={trailMap.imageUrl}
                alt={`${mountain.name} trail map preview`}
                className="trailmappanel-preview-image"
              />
            ) : (
              <span className="trailmappanel-preview-pdf">
                <span aria-hidden="true" className="trailmappanel-preview-pdf-icon">
                  📄
                </span>
                <span>{mountain.name} official trail map (PDF)</span>
              </span>
            )}
            <span className="trailmappanel-preview-cta">Tap to view full map — pinch to zoom ↗</span>
          </button>
          {open && (
            <TrailMapViewer mountain={mountain} trailMap={trailMap} onClose={() => setOpen(false)} />
          )}
        </>
      ) : (
        <p className="trailmappanel-unavailable">
          {trailMap
            ? `Trail map unavailable to preview here for ${mountain.shortName}.`
            : `We don't have researched trail-map information for ${mountain.shortName} yet.`}
        </p>
      )}

      {trailMap?.officialUrl && (
        <a href={trailMap.officialUrl} target="_blank" rel="noreferrer" className="trailmappanel-official">
          Official Trail Map ↗
        </a>
      )}
    </section>
  );
}

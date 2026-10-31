import { useEffect } from 'react';
import { DataCredits } from './DataCredits';

/** Where the data comes from, as a sheet over the screen: one tap away, never in front of the mountains. */
export function SourcesSheet({ usingDemoData, onClose }: { usingDemoData: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="home-sheet-backdrop" onClick={onClose}>
      <div
        className="home-sheet shell"
        role="dialog"
        aria-modal="true"
        aria-label="Where the data comes from"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="home-sheet-close" onClick={onClose} autoFocus>
          Close
        </button>
        <DataCredits usingDemoData={usingDemoData} />
      </div>
    </div>
  );
}

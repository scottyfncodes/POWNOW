import { useEffect, useMemo, useState } from 'react';
import { cardBlob, drawShareCard, type ShareCardData, shareText, shareUrl } from './shareCard';

export interface ShareSheetProps {
  data: ShareCardData;
  onClose: () => void;
}

type Drawn = { status: 'drawing' } | { status: 'ready'; file: File; previewUrl: string } | { status: 'failed' };

/**
 * The share card, previewed before it goes anywhere: you see exactly what
 * the group chat will see. Send hands the image (and the link, in the text)
 * to the phone's own share sheet; where a browser can't share files it
 * shares the link instead, and where it can't share at all it copies the
 * line and the link. Save image is always there for a screenshot-style send.
 */
export function ShareSheet({ data, onClose }: ShareSheetProps) {
  const [drawn, setDrawn] = useState<Drawn>({ status: 'drawing' });
  const [note, setNote] = useState<string | null>(null);
  const text = shareText(data);
  const url = shareUrl(data.mountain.id);
  const fileName = useMemo(() => `pownow-${data.mountain.id}-${data.today}.png`, [data.mountain.id, data.today]);

  useEffect(() => {
    let cancelled = false;
    let previewUrl: string | null = null;
    const canvas = document.createElement('canvas');
    (async () => {
      if (!drawShareCard(canvas, data)) {
        if (!cancelled) setDrawn({ status: 'failed' });
        return;
      }
      const blob = await cardBlob(canvas);
      if (cancelled) return;
      if (!blob) {
        setDrawn({ status: 'failed' });
        return;
      }
      previewUrl = URL.createObjectURL(blob);
      setDrawn({ status: 'ready', file: new File([blob], fileName, { type: 'image/png' }), previewUrl });
    })();
    return () => {
      cancelled = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [data, fileName]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setNote('Copied. Paste it in the group chat.');
    } catch {
      setNote(`Copy this link: ${url}`);
    }
  };

  const send = async () => {
    const withFile = drawn.status === 'ready' ? { files: [drawn.file], text: `${text} ${url}` } : null;
    try {
      if (withFile && navigator.canShare?.(withFile)) {
        await navigator.share(withFile);
        return;
      }
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `${data.mountain.name} on POW NOW`, text, url });
        return;
      }
    } catch (error) {
      // Closing the phone's share sheet is a choice, not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
    await copyLink();
  };

  return (
    <div className="home-sheet-backdrop" onClick={onClose}>
      <div
        className="home-sheet shell sharesheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${data.mountain.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="home-sheet-close" onClick={onClose}>
          Close
        </button>

        <div className="sharesheet-preview">
          {drawn.status === 'ready' ? (
            <img src={drawn.previewUrl} alt={`Share card: ${text}`} width={1080} height={1350} />
          ) : (
            <p className="sharesheet-placeholder" role={drawn.status === 'failed' ? 'alert' : 'status'}>
              {drawn.status === 'failed' ? "This browser can't draw the card. You can still send the link." : 'Drawing the card'}
            </p>
          )}
        </div>

        <p className="sharesheet-line">{text}</p>

        <div className="sharesheet-actions">
          <button type="button" className="button" onClick={send} autoFocus>
            Send
          </button>
          {drawn.status === 'ready' && (
            <a className="button button-quiet" href={drawn.previewUrl} download={fileName}>
              Save image
            </a>
          )}
          <button type="button" className="button button-quiet" onClick={copyLink}>
            Copy link
          </button>
        </div>
        {note && (
          <p className="sharesheet-note" role="status">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MOUNTAINS } from '@/data/mountains';
import type { TrailMap } from '@/domain/mountainProfile';
import { TrailMapViewer } from './TrailMapViewer';

const mountain = MOUNTAINS.find((m) => m.id === 'winter-park')!;
const user = () => userEvent.setup();

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

const imageTrailMap: TrailMap = {
  officialUrl: 'https://example.test/official-trail-map',
  source: 'official',
  imageUrl: 'https://example.test/trail-map.jpg',
  pdfUrl: null,
  season: '2025-26',
};

const pdfTrailMap: TrailMap = {
  officialUrl: 'https://example.test/official-trail-map',
  source: 'official',
  imageUrl: null,
  pdfUrl: 'https://example.test/trail-map.pdf',
  season: '2025-26',
};

describe('TrailMapViewer', () => {
  it('identifies the mountain and the map season, and links the official source', () => {
    render(<TrailMapViewer mountain={mountain} trailMap={imageTrailMap} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: new RegExp(mountain.name, 'i') })).toBeInTheDocument();
    expect(screen.getByText(mountain.name)).toBeInTheDocument();
    expect(screen.getByText(/2025-26 season/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /official trail map/i })).toHaveAttribute(
      'href',
      'https://example.test/official-trail-map',
    );
  });

  it('renders the real official image with an honest alt text, never a placeholder', () => {
    render(<TrailMapViewer mountain={mountain} trailMap={imageTrailMap} onClose={vi.fn()} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.test/trail-map.jpg');
    expect(img.getAttribute('alt')).toContain(mountain.name);
  });

  it('embeds the PDF in an iframe (the browser handles its own zoom/pan) and offers a new-tab fallback', () => {
    render(<TrailMapViewer mountain={mountain} trailMap={pdfTrailMap} onClose={vi.fn()} />);
    const frame = screen.getByTitle(new RegExp(`${mountain.name} trail map`, 'i'));
    expect(frame).toHaveAttribute('src', 'https://example.test/trail-map.pdf');
    expect(screen.getByRole('link', { name: /open pdf in a new tab/i })).toHaveAttribute(
      'href',
      'https://example.test/trail-map.pdf',
    );
  });

  it('closes on the close button', async () => {
    const onClose = vi.fn();
    render(<TrailMapViewer mountain={mountain} trailMap={imageTrailMap} onClose={onClose} />);
    await user().click(screen.getByRole('button', { name: /close trail map/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<TrailMapViewer mountain={mountain} trailMap={imageTrailMap} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop (outside the map itself) is clicked', async () => {
    const onClose = vi.fn();
    render(<TrailMapViewer mountain={mountain} trailMap={imageTrailMap} onClose={onClose} />);
    await user().click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('zooms in on wheel and reflects it in the image transform, and "Reset zoom" returns to fit', () => {
    render(<TrailMapViewer mountain={mountain} trailMap={imageTrailMap} onClose={vi.fn()} />);
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.style.transform).toContain('scale(1)');

    const stage = img.parentElement!;
    fireEvent.wheel(stage, { deltaY: -100, clientX: 195, clientY: 400 });
    const scaleMatch = img.style.transform.match(/scale\(([\d.]+)\)/);
    expect(scaleMatch).not.toBeNull();
    expect(Number(scaleMatch![1])).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('button', { name: /reset zoom/i }));
    expect(img.style.transform).toContain('scale(1)');
  });

  it('never lets the scale exceed the maximum however far the wheel is scrolled', () => {
    render(<TrailMapViewer mountain={mountain} trailMap={imageTrailMap} onClose={vi.fn()} />);
    const img = screen.getByRole('img') as HTMLImageElement;
    const stage = img.parentElement!;
    for (let i = 0; i < 40; i += 1) {
      fireEvent.wheel(stage, { deltaY: -100, clientX: 195, clientY: 400 });
    }
    const scaleMatch = img.style.transform.match(/scale\(([\d.]+)\)/);
    expect(Number(scaleMatch![1])).toBeLessThanOrEqual(5);
  });

  it('locks page scroll while open and restores it on close, so the profile underneath keeps its place', () => {
    document.body.style.overflow = '';
    const { unmount } = render(<TrailMapViewer mountain={mountain} trailMap={imageTrailMap} onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

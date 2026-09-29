import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MOUNTAINS } from '@/data/mountains';
import type { TrailMap } from '@/domain/mountainProfile';
import { TrailMapPanel } from './TrailMapPanel';

const mountain = MOUNTAINS.find((m) => m.id === 'keystone')!;
const user = () => userEvent.setup();

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('TrailMapPanel', () => {
  it('shows a real image preview and opens the full-screen viewer on tap', async () => {
    const trailMap: TrailMap = {
      officialUrl: 'https://example.test/trail-map',
      source: 'official',
      imageUrl: 'https://example.test/trail-map.jpg',
      pdfUrl: null,
      season: '2025-26',
    };
    render(<TrailMapPanel mountain={mountain} trailMap={trailMap} />);

    expect(screen.getByRole('img', { name: /trail map preview/i })).toHaveAttribute(
      'src',
      'https://example.test/trail-map.jpg',
    );
    expect(screen.getByText('2025-26')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user().click(screen.getByRole('button', { name: /tap to view full map/i }));
    expect(screen.getByRole('dialog', { name: new RegExp(mountain.name, 'i') })).toBeInTheDocument();
  });

  it('shows a PDF tile, never a fabricated image, when only a PDF asset is confirmed', () => {
    const trailMap: TrailMap = {
      officialUrl: 'https://example.test/trail-map',
      source: 'official',
      imageUrl: null,
      pdfUrl: 'https://example.test/trail-map.pdf',
      season: '2025-26',
    };
    render(<TrailMapPanel mountain={mountain} trailMap={trailMap} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/official trail map \(pdf\)/i)).toBeInTheDocument();
  });

  it('shows an honest unavailable state and the official link — never a placeholder map — when no asset is confirmed', () => {
    const trailMap: TrailMap = {
      officialUrl: 'https://example.test/trail-map',
      source: 'official',
      imageUrl: null,
      pdfUrl: null,
      season: null,
    };
    render(<TrailMapPanel mountain={mountain} trailMap={trailMap} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tap to view/i })).not.toBeInTheDocument();
    expect(screen.getByText(/trail map unavailable to preview/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /official trail map/i })).toHaveAttribute(
      'href',
      'https://example.test/trail-map',
    );
  });

  it('says so honestly when there is no researched trail-map data at all for this mountain', () => {
    render(<TrailMapPanel mountain={mountain} trailMap={null} />);
    expect(screen.getByText(/don't have researched trail-map information/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /official trail map/i })).not.toBeInTheDocument();
  });

  it('never lets a preview image render for a resort other than the one it belongs to', () => {
    // Sanity check against copy/paste bugs: the alt text and preview must
    // name the mountain the panel was actually given.
    const trailMap: TrailMap = {
      officialUrl: 'https://example.test/trail-map',
      source: 'official',
      imageUrl: 'https://example.test/trail-map.jpg',
      pdfUrl: null,
      season: '2025-26',
    };
    render(<TrailMapPanel mountain={mountain} trailMap={trailMap} />);
    const img = screen.getByRole('img', { name: /trail map preview/i });
    expect(img.getAttribute('alt')).toContain(mountain.name);
  });
});

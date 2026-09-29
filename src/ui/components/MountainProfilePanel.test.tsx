import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MountainProfile } from '@/domain/mountainProfile';
import { TBD_DATE } from '@/domain/mountainProfile';
import { testMountain } from '@/test/fixtures';
import { MountainProfilePanel } from './MountainProfilePanel';

const baseProfile: MountainProfile = {
  officialWebsite: 'https://example.test',
  snowReportUrl: null,
  webcamUrl: null,
  trailMap: { officialUrl: 'https://example.test/trail-map', source: 'official' },
  ticketUrl: null,
  passInfoUrl: null,
  phone: null,
  address: null,
  openingDate: TBD_DATE,
  closingDate: TBD_DATE,
};

describe('MountainProfilePanel — Grub', () => {
  it('lists researched restaurant picks by name', () => {
    const mountain = testMountain();
    const profile: MountainProfile = {
      ...baseProfile,
      grub: {
        picks: [
          { name: "Garfinkel's", note: 'Base-area sports bar.' },
          { name: 'Sweet Basil', note: 'Elevated seasonal American.' },
        ],
      },
    };
    render(<MountainProfilePanel mountain={mountain} profile={profile} />);
    expect(screen.getByText("Garfinkel's")).toBeInTheDocument();
    expect(screen.getByText('Sweet Basil')).toBeInTheDocument();
  });

  it('calls out the best quick breakfast separately from the general picks', () => {
    const mountain = testMountain();
    const profile: MountainProfile = {
      ...baseProfile,
      grub: {
        picks: [{ name: 'Sweet Basil', note: 'Elevated seasonal American.' }],
        quickBreakfast: { name: "Loaded Joe's Coffeehouse", note: 'Breakfast sandwiches, steps from Gondola One.' },
      },
    };
    render(<MountainProfilePanel mountain={mountain} profile={profile} />);
    expect(screen.getByText(/best quick breakfast/i)).toBeInTheDocument();
    expect(screen.getByText(/Loaded Joe's Coffeehouse/)).toBeInTheDocument();
  });

  it('names the real nearby town instead of pretending the mountain has its own scene', () => {
    const mountain = testMountain();
    const profile: MountainProfile = {
      ...baseProfile,
      grub: {
        town: 'Pagosa Springs, about 25 miles west',
        picks: [{ name: "Kip's", note: 'Baja-style tacos downtown.' }],
      },
    };
    render(<MountainProfilePanel mountain={mountain} profile={profile} />);
    expect(screen.getByText(/most people eat in Pagosa Springs/)).toBeInTheDocument();
  });

  it('says restaurants have not been researched yet rather than showing an empty list', () => {
    const mountain = testMountain();
    render(<MountainProfilePanel mountain={mountain} profile={baseProfile} />);
    expect(screen.getByText(/haven't researched restaurants/)).toBeInTheDocument();
  });
});

describe('MountainProfilePanel — Brews', () => {
  it('lists researched brewery picks by name', () => {
    const mountain = testMountain();
    const profile: MountainProfile = {
      ...baseProfile,
      brews: {
        picks: [{ name: 'Breckenridge Brewery', note: "The town's own brewery." }],
      },
    };
    render(<MountainProfilePanel mountain={mountain} profile={profile} />);
    expect(screen.getByText('Breckenridge Brewery')).toBeInTheDocument();
  });

  it('lists a bonus distillery only when one was actually found', () => {
    const mountain = testMountain();
    const profile: MountainProfile = {
      ...baseProfile,
      brews: {
        picks: [{ name: 'Breckenridge Brewery', note: "The town's own brewery." }],
        distilleries: [{ name: 'Breckenridge Distillery', note: 'Award-winning bourbon.' }],
      },
    };
    render(<MountainProfilePanel mountain={mountain} profile={profile} />);
    expect(screen.getByText(/bonus.*distilleries/i)).toBeInTheDocument();
    expect(screen.getByText('Breckenridge Distillery')).toBeInTheDocument();
  });

  it('says breweries have not been researched yet rather than showing an empty list', () => {
    const mountain = testMountain();
    render(<MountainProfilePanel mountain={mountain} profile={baseProfile} />);
    expect(screen.getByText(/haven't researched breweries/)).toBeInTheDocument();
  });
});

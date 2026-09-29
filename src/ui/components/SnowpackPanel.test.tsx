import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { testSnowpack } from '@/test/fixtures';
import { SnowpackPanel } from './SnowpackPanel';

describe('SnowpackPanel — the two kinds of depth never wear the same label', () => {
  it('labels a station reading MEASURED in live mode and DEMO in demo mode', () => {
    const { unmount } = render(<SnowpackPanel snowpack={testSnowpack()} modelSnowDepthIn={40} />);
    expect(screen.getByText('MEASURED')).toBeInTheDocument();
    expect(screen.queryByText('MODELED')).not.toBeInTheDocument();
    unmount();
    render(<SnowpackPanel snowpack={testSnowpack()} modelSnowDepthIn={40} demo />);
    expect(screen.getByText('DEMO')).toBeInTheDocument();
  });

  it('labels a model depth MODELED and says plainly what it is', () => {
    render(<SnowpackPanel snowpack={null} modelSnowDepthIn={38.4} />);
    expect(screen.getByText('MODELED')).toBeInTheDocument();
    expect(screen.getByText('~38"')).toBeInTheDocument();
    expect(screen.getByText(/not a measurement/)).toBeInTheDocument();
  });

  it('renders nothing when there is neither a reading nor a model value', () => {
    const { container } = render(<SnowpackPanel snowpack={null} modelSnowDepthIn={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows each metric honestly as a dash when the sensor did not report it', () => {
    render(<SnowpackPanel snowpack={testSnowpack({ sweIn: null, packDensity: null, depthChange24hIn: null, newSnow5dIn: null })} modelSnowDepthIn={null} />);
    expect(screen.getAllByText('—').length).toBe(3);
    expect(screen.getByText('48"')).toBeInTheDocument();
  });

  it('marks new snow as a floor, because a settling pack undercounts what fell', () => {
    render(<SnowpackPanel snowpack={testSnowpack({ newSnow5dIn: 9 })} modelSnowDepthIn={null} />);
    expect(screen.getByText('9.0"+')).toBeInTheDocument();
    expect(screen.getByText(/undercount new snow/)).toBeInTheDocument();
  });
});

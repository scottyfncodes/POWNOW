import { useMemo } from 'react';
import type { Origin } from '@/domain/mountain';
import { addDays, type DateKey, formatDateLabel, nextWeekday, relativeDateLabel } from '@/domain/dates';
import { OriginPicker } from '@/ui/components/OriginPicker';
import { RiderSettingsPanel } from '@/ui/components/RiderSettings';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import type { ClockState } from '@/ui/hooks/useClock';
import type { RiderSettings } from '@/ui/hooks/usePreferences';

export interface SetupScreenProps {
  clock: ClockState;
  origin: Origin;
  onOriginChange: (origin: Origin) => void;
  settings: RiderSettings;
  onSettingsChange: (patch: Partial<RiderSettings>) => void;
  onSettingsReset: () => void;
  /** The day being planned. Today by default; any day up to two months out. */
  date: DateKey;
  onDateChange: (date: DateKey) => void;
  onBack: () => void;
  /** Rank the mountains for these settings. */
  onShow: () => void;
  /** Hand off to the range planner for people comparing many days. */
  onCompareRange: () => void;
}

interface DayPreset {
  date: DateKey;
  label: string;
}

function presetsFor(today: DateKey): DayPreset[] {
  const saturday = nextWeekday(today, 6, true);
  const sunday = nextWeekday(today, 0, true);
  const presets: DayPreset[] = [
    { date: today, label: 'Today' },
    { date: addDays(today, 1), label: 'Tomorrow' },
    { date: saturday, label: 'Saturday' },
    { date: sunday, label: 'Sunday' },
  ];
  // A weekend day that is today or tomorrow already has a chip.
  const seen = new Set<DateKey>();
  return presets.filter((preset) => (seen.has(preset.date) ? false : (seen.add(preset.date), true)));
}

/**
 * The one step between "POW NOW" and the answer. Where you're starting,
 * which day, and how you ride — the three things the ranking is built
 * around and the only things it will ever ask. Everything here is
 * remembered (except a GPS fix), so the second visit is one tap.
 */
export function SetupScreen({
  clock,
  origin,
  onOriginChange,
  settings,
  onSettingsChange,
  onSettingsReset,
  date,
  onDateChange,
  onBack,
  onShow,
  onCompareRange,
}: SetupScreenProps) {
  const presets = useMemo(() => presetsFor(clock.today), [clock.today]);
  const isPreset = presets.some((preset) => preset.date === date);
  const dayLabel = relativeDateLabel(date, clock.today);

  return (
    <div className="screen">
      <ScreenHeader onBack={onBack} title="YOUR RIDE" />
      <div className="screen-body shell setup">
        <p className="setup-intro">
          Where you're starting, which day, and how you ride. Every mountain gets ranked around these — change
          any of them and the ranking changes with you.
        </p>

        <OriginPicker origin={origin} onChange={onOriginChange} />

        <section className="setup-when panel" aria-labelledby="setup-when-heading">
          <h2 id="setup-when-heading" className="section-title">
            Which day
          </h2>
          <div className="chiprow scroll-x" role="group" aria-label="Which day">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`pickchip${preset.date === date ? ' is-active' : ''}`}
                onClick={() => onDateChange(preset.date)}
                aria-pressed={preset.date === date}
              >
                {preset.label}
                {preset.label !== 'Today' && <span className="pickchip-sub">{formatDateLabel(preset.date)}</span>}
              </button>
            ))}
          </div>
          <label className="datepicker-exact">
            <span>Or pick a date</span>
            <input
              type="date"
              min={clock.today}
              max={addDays(clock.today, 60)}
              value={isPreset ? '' : date}
              onChange={(event) => {
                const value = event.target.value;
                if (value) onDateChange(value);
              }}
            />
          </label>
          <p className="setup-hint">
            {date === clock.today
              ? 'Today is the real call — live snow, live roads, when to leave.'
              : `${dayLabel} is a projection: the forecast does the work, and the plan says how sure it is.`}
          </p>
        </section>

        <RiderSettingsPanel settings={settings} onChange={onSettingsChange} onReset={onSettingsReset} alwaysOpen />

        <button type="button" className="bigbutton bigbutton-now setup-cta" onClick={onShow}>
          <span className="bigbutton-word">SHOW ME</span>
          <span className="bigbutton-sub">
            Every mountain from {origin.id === 'gps' ? 'your location' : origin.shortName}, ranked for{' '}
            {dayLabel.toLowerCase()}.
          </span>
        </button>

        <button type="button" className="linkbutton setup-range" onClick={onCompareRange}>
          Weighing several days? Compare a whole range →
        </button>
      </div>
    </div>
  );
}

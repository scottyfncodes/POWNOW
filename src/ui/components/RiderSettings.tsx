import { useState } from 'react';
import { HOLDABLE_PASSES, PASS_LABELS, type PassAffiliation } from '@/domain/mountain';
import { at, formatClock } from '@/domain/time';
import { DEFAULT_SETTINGS, type RiderSettings } from '@/ui/hooks/usePreferences';

export interface RiderSettingsPanelProps {
  settings: RiderSettings;
  onChange: (patch: Partial<RiderSettings>) => void;
  onReset: () => void;
  /**
   * `true` on the Your ride step, where the knobs *are* the screen: no
   * collapsed summary, no toggle, every control showing. Default `false`
   * keeps the compact disclosure for places the settings are a sidebar.
   */
  alwaysOpen?: boolean;
}

const DRIVE_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 120, label: 'Under 2 hours' },
  { minutes: 180, label: 'Up to 3 hours' },
  { minutes: 240, label: 'Up to 4 hours' },
  { minutes: 300, label: 'Up to 5 hours' },
  { minutes: 600, label: 'Anywhere in the state' },
];

const HOME_BY_OPTIONS = [at(16), at(17), at(18), at(19), at(20), at(21), at(22)];

/** The sleep-vs-send dial in words, for the summary line and the slider's spoken value. */
export function describeSleepVsSend(value: number): string {
  if (value < 0.25) return 'Protect my sleep';
  if (value < 0.5) return 'Sleep-leaning';
  if (value < 0.75) return 'Balanced';
  return 'First chair or bust';
}

export function describePowder(value: number): string {
  if (value < 0.8) return 'Groomers first';
  if (value <= 1.2) return 'Snow first';
  return 'Powder hunter';
}

export function describeCrowds(value: number): string {
  if (value < 0.3) return 'Hate lines';
  if (value < 0.7) return 'Tolerate lines';
  return "Don't mind lines";
}

/** One line for the collapsed state: what the engine currently believes about you. */
export function summarizeSettings(settings: RiderSettings): string {
  const passes = settings.passes.length > 0 ? settings.passes.map((pass) => PASS_LABELS[pass]).join(' + ') : 'No pass';
  const drive = DRIVE_OPTIONS.find((option) => option.minutes === settings.maxDriveMinutes)?.label.toLowerCase() ?? `≤${Math.round(settings.maxDriveMinutes / 60)}h drive`;
  return `${passes} · ${describeSleepVsSend(settings.sleepVsSend).toLowerCase()} · ${drive} · home by ${formatClock(settings.latestHomeArrival)}`;
}

/**
 * The rider's own knobs. The engine has always modeled a person — how much
 * they value sleep, powder, quiet, an early night — but until now the only
 * person it modeled was the default one. These few controls are the whole
 * personal layer: nothing here changes what a ski day means, only whose
 * day they are optimising.
 */
export function RiderSettingsPanel({ settings, onChange, onReset, alwaysOpen = false }: RiderSettingsPanelProps) {
  const [toggled, setToggled] = useState(false);
  const open = alwaysOpen || toggled;
  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT_SETTINGS);

  const togglePass = (pass: PassAffiliation) => {
    const has = settings.passes.includes(pass);
    onChange({ passes: has ? settings.passes.filter((p) => p !== pass) : [...settings.passes, pass] });
  };

  return (
    <section className={`ridersettings${alwaysOpen ? ' is-page' : ''}`} aria-labelledby="ridersettings-heading">
      {alwaysOpen ? (
        <header className="ridersettings-head">
          <h2 id="ridersettings-heading" className="ridersettings-title">
            How you ride
          </h2>
          <p className="ridersettings-summary">{summarizeSettings(settings)}</p>
        </header>
      ) : (
        <button
          type="button"
          className="ridersettings-toggle"
          onClick={() => setToggled((value) => !value)}
          aria-expanded={open}
          aria-controls="ridersettings-body"
        >
          <span className="ridersettings-toggle-text">
            <span id="ridersettings-heading" className="ridersettings-title">
              Your ride
            </span>
            <span className="ridersettings-summary">{summarizeSettings(settings)}</span>
          </span>
          <span aria-hidden="true" className="ridersettings-caret">
            {open ? '−' : '+'}
          </span>
        </button>
      )}

      {open && (
        <div id="ridersettings-body" className="ridersettings-body">
          <fieldset className="ridersettings-field">
            <legend>Passes you hold</legend>
            <div className="chiprow">
              {HOLDABLE_PASSES.map((pass) => {
                const active = settings.passes.includes(pass);
                return (
                  <button
                    key={pass}
                    type="button"
                    className={`pickchip${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => togglePass(pass)}
                  >
                    {PASS_LABELS[pass]}
                  </button>
                );
              })}
            </div>
            {settings.passes.length > 0 && (
              <label className="ridersettings-check">
                <input
                  type="checkbox"
                  checked={settings.onlyMyPasses}
                  onChange={(event) => onChange({ onlyMyPasses: event.target.checked })}
                />
                <span>Only show mountains on my pass</span>
              </label>
            )}
            <p className="ridersettings-hint">
              A mountain on your pass scores as if the ticket were free — because for you it is. Ones that aren't still show
              up, with the price.
            </p>
          </fieldset>

          <Slider
            label="Sleep or send"
            value={settings.sleepVsSend}
            min={0}
            max={1}
            step={0.05}
            low="Sleep in"
            high="First chair"
            describe={describeSleepVsSend}
            onChange={(sleepVsSend) => onChange({ sleepVsSend })}
          />

          <Slider
            label="What you're chasing"
            value={settings.powderPreference}
            min={0.5}
            max={1.5}
            step={0.05}
            low="Corduroy"
            high="Powder"
            describe={describePowder}
            onChange={(powderPreference) => onChange({ powderPreference })}
          />

          <Slider
            label="Crowds"
            value={settings.crowdTolerance}
            min={0}
            max={1}
            step={0.05}
            low="Hate lines"
            high="Don't care"
            describe={describeCrowds}
            onChange={(crowdTolerance) => onChange({ crowdTolerance })}
          />

          <label className="ridersettings-select">
            <span>How far you'll drive</span>
            <select
              value={String(settings.maxDriveMinutes)}
              onChange={(event) => onChange({ maxDriveMinutes: Number(event.target.value) })}
            >
              {DRIVE_OPTIONS.map((option) => (
                <option key={option.minutes} value={option.minutes}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ridersettings-select">
            <span>Home by</span>
            <select
              value={String(settings.latestHomeArrival)}
              onChange={(event) => onChange({ latestHomeArrival: Number(event.target.value) })}
            >
              {HOME_BY_OPTIONS.map((minute) => (
                <option key={minute} value={minute}>
                  {formatClock(minute)}
                </option>
              ))}
            </select>
          </label>

          {!isDefault && (
            <button type="button" className="linkbutton" onClick={onReset}>
              Reset to defaults
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  low,
  high,
  describe,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  low: string;
  high: string;
  describe: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="ridersettings-slider">
      <span className="ridersettings-slider-head">
        <span>{label}</span>
        <span className="ridersettings-slider-value">{describe(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={describe(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="ridersettings-slider-ends" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </span>
    </label>
  );
}

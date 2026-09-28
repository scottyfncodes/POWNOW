import { useEffect, useState } from 'react';
import { Snowfall } from '@/ui/components/Snowfall';

const STEPS = [
  'CHECKING THE MOUNTAIN…',
  'CHECKING THE SNOW…',
  'CHECKING THE ROADS…',
  'TIMING THE DRIVE…',
  'MAKING THE CALL…',
];

/** Loading is allowed to have a personality — and to say what it is doing for you. */
export function LoadingScreen({ label = 'Working on it' }: { label?: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setStep((value) => (value + 1) % STEPS.length), 620);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="loading" aria-busy="true">
      <Snowfall density={26} />
      <div className="loading-inner shell">
        <p className="loading-step" aria-hidden="true">
          {STEPS[step]}
        </p>
        <ol className="loading-track" aria-hidden="true">
          {STEPS.map((text, index) => (
            <li key={text} className={index <= step ? 'is-done' : ''} />
          ))}
        </ol>
        <p className="visually-hidden" role="status">
          {label}
        </p>
      </div>
    </main>
  );
}

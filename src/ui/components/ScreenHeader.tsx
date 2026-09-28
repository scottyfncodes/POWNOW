import type { ReactNode } from 'react';
import { Wordmark } from './Wordmark';

export interface ScreenHeaderProps {
  onBack: () => void;
  title: string;
  right?: ReactNode;
}

export function ScreenHeader({ onBack, title, right }: ScreenHeaderProps) {
  return (
    <header className="screenhead">
      <div className="shell screenhead-inner">
        <button type="button" className="backbutton" onClick={onBack}>
          <span aria-hidden="true">←</span>
          <span className="visually-hidden">Back to start</span>
        </button>
        <span className="screenhead-title">
          <Wordmark size="sm" />
          <span className="screenhead-mode">{title}</span>
        </span>
        <span className="screenhead-right">{right}</span>
      </div>
    </header>
  );
}

import { MOUNTAINS } from '@/data/mountains';
import { MountainList } from '@/ui/components/MountainList';
import { ScreenHeader } from '@/ui/components/ScreenHeader';

export interface ListScreenProps {
  onBack: () => void;
  onOpenMountain: (mountainId: string) => void;
}

/** Every supported mountain by name. Tap one for its whole day. */
export function ListScreen({ onBack, onOpenMountain }: ListScreenProps) {
  return (
    <div className="screen">
      <ScreenHeader onBack={onBack} title="ALL MOUNTAINS" />
      <div className="screen-body shell">
        <p className="listscreen-intro">
          Every mountain POW NOW knows, A to Z. Tap one for today's call — the verdict, the snow, the drive and
          when to leave.
        </p>
        <MountainList mountains={MOUNTAINS} onSelectMountain={onOpenMountain} />
      </div>
    </div>
  );
}

import { MOUNTAINS } from '@/data/mountains';
import { BrowseBar } from '@/ui/components/BrowseBar';
import { MountainList } from '@/ui/components/MountainList';
import { ScreenHeader } from '@/ui/components/ScreenHeader';

export interface ListScreenProps {
  onBack: () => void;
  onOpenMountain: (mountainId: string) => void;
  onShowMap: () => void;
  onRank: () => void;
}

/** Every supported mountain by name — the map's other tab. Tap one for its whole day. */
export function ListScreen({ onBack, onOpenMountain, onShowMap, onRank }: ListScreenProps) {
  return (
    <div className="screen">
      <ScreenHeader onBack={onBack} title="LIST" />
      <div className="screen-body shell">
        <BrowseBar view="list" onShowMap={onShowMap} onShowList={() => {}} onRank={onRank} />
        <p className="listscreen-intro">
          Every mountain POW NOW knows, A to Z. Tap one for today's call — the verdict, the snow, the drive and
          when to leave.
        </p>
        <MountainList mountains={MOUNTAINS} onSelectMountain={onOpenMountain} />
      </div>
    </div>
  );
}

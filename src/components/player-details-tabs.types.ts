export type PlayerDetailsTab = 'queue' | 'lyrics' | 'related';

export type PlayerDetailsTabsProps = {
  onChange: (tab: PlayerDetailsTab) => void;
  value: PlayerDetailsTab;
};

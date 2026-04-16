import { Icon, Text } from '@wordpress/ui';
import { home, archive } from '@wordpress/icons';

type Props = {
  isHome: boolean;
  isSaved: boolean;
  onGoHome: () => void;
  onGoSaved: () => void;
};

export default function SidebarNav({ isHome, isSaved, onGoHome, onGoSaved }: Props) {
  return (
    <nav className="sidebar-nav">
      <button
        className={`sidebar-nav-item${isHome ? ' is-active' : ''}`}
        onClick={onGoHome}
      >
        <Icon icon={home} size={20} />
        <Text variant="body-md">Home</Text>
      </button>
      <button
        className={`sidebar-nav-item${isSaved ? ' is-active' : ''}`}
        onClick={onGoSaved}
      >
        <Icon icon={archive} size={20} />
        <Text variant="body-md">Saved</Text>
      </button>
    </nav>
  );
}

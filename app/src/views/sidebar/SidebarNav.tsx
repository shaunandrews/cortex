import { Icon } from '@wordpress/ui';
import { home, archive } from '@wordpress/icons';
import { MenuItem } from '../../components';

type Props = {
  isHome: boolean;
  isSaved: boolean;
  onGoHome: () => void;
  onGoSaved: () => void;
};

export default function SidebarNav({ isHome, isSaved, onGoHome, onGoSaved }: Props) {
  return (
    <nav className="sidebar-nav">
      <MenuItem
        icon={<Icon icon={home} size={20} />}
        label="Home"
        isSelected={isHome}
        onClick={onGoHome}
      />
      <MenuItem
        icon={<Icon icon={archive} size={20} />}
        label="Saved"
        isSelected={isSaved}
        onClick={onGoSaved}
      />
    </nav>
  );
}

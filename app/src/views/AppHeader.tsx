import { Link } from 'react-router-dom';
import { Button, Icon, Text } from '@wordpress/ui';
import { useAuth } from '../auth/AuthContext';
import { automattic } from '../icons/automattic';
import { AvatarButton, TabNav } from '../components';

const TABS = [{ to: '/components', label: 'Components' }];

export default function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="header-brand">
          <Icon icon={automattic} size={20} />
          <Text variant="heading-lg" className="header-wordmark">
            Cortex
          </Text>
        </Link>
        <TabNav tabs={TABS} />
      </div>

      {user && (
        <AvatarButton
          src={user.avatar_URL}
          alt={user.display_name}
          menuTitle="Account menu"
          menu={
            <>
              <Text variant="body-sm" className="avatar-menu-name">
                {user.display_name}
              </Text>
              <Button
                variant="minimal"
                tone="neutral"
                size="compact"
                onClick={logout}
                className="avatar-menu-action"
              >
                Sign out
              </Button>
            </>
          }
        />
      )}
    </header>
  );
}

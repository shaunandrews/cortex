import { Link, NavLink } from 'react-router-dom';
import { Button, Icon, Popover, Text, VisuallyHidden } from '@wordpress/ui';
import { useAuth } from '../auth/AuthContext';
import { automattic } from '../icons/automattic';

const TABS = [{ to: '/components', label: 'Components' }] as const;

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
        <nav className="header-tabs" aria-label="Primary">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => `header-tab${isActive ? ' is-active' : ''}`}
            >
              <Text variant="body-md">{tab.label}</Text>
            </NavLink>
          ))}
        </nav>
      </div>

      {user && (
        <Popover.Root>
          <Popover.Trigger render={<button className="avatar-trigger" />}>
            <img src={user.avatar_URL} alt={user.display_name} className="avatar" />
          </Popover.Trigger>
          <Popover.Popup align="end" sideOffset={4} className="avatar-menu">
            <VisuallyHidden>
              <Popover.Title>Account menu</Popover.Title>
            </VisuallyHidden>
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
          </Popover.Popup>
        </Popover.Root>
      )}
    </header>
  );
}

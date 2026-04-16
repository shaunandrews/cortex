import { forwardRef, type HTMLAttributes } from 'react';
import { NavLink } from 'react-router-dom';
import { Text } from '@wordpress/ui';
import './TabNav.css';

export type TabNavItem = {
  to: string;
  label: string;
  /** Optional `end` flag for react-router: only match exact path. */
  end?: boolean;
};

export type TabNavProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  tabs: TabNavItem[];
  /** Accessible label for the nav landmark. */
  ariaLabel?: string;
};

const TabNav = forwardRef<HTMLElement, TabNavProps>(function TabNav(
  { tabs, ariaLabel = 'Primary', className, ...rest },
  ref,
) {
  const classes = ['tab-nav'];
  if (className) classes.push(className);

  return (
    <nav ref={ref} className={classes.join(' ')} aria-label={ariaLabel} {...rest}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `tab-nav-item${isActive ? ' is-active' : ''}`}
        >
          <Text variant="body-md">{tab.label}</Text>
        </NavLink>
      ))}
    </nav>
  );
});

export default TabNav;

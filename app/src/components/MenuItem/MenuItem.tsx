import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Text } from '@wordpress/ui';
import './MenuItem.css';

export type MenuItemProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  /** Left slot. Any node — an Icon, img, letter, etc. Rendered inside a 24×24 slot. */
  icon?: ReactNode;
  /** Main label. Strings get wrapped in a body-md Text; nodes render as-is. */
  label: ReactNode;
  /** Badge overlaid on the icon slot. Only rendered when greater than 0 and an icon is present. */
  count?: number;
  /** Persistent current/chosen state (e.g. the active route or selected site). */
  isSelected?: boolean;
  /** Controlled highlight, separate from browser focus (e.g. keyboard-nav cursor). */
  isFocused?: boolean;
};

const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(function MenuItem(
  { icon, label, count, isSelected, isFocused, className, ...rest },
  ref,
) {
  const classes = ['menu-item'];
  if (isSelected) classes.push('is-selected');
  if (isFocused) classes.push('is-focused');
  if (className) classes.push(className);

  return (
    <button ref={ref} type="button" className={classes.join(' ')} {...rest}>
      {icon !== undefined && (
        <span className="menu-item-icon">
          {icon}
          {typeof count === 'number' && count > 0 && (
            <span className="menu-item-count">{count}</span>
          )}
        </span>
      )}
      {typeof label === 'string' ? (
        <Text variant="body-md" className="menu-item-label">
          {label}
        </Text>
      ) : (
        <span className="menu-item-label">{label}</span>
      )}
    </button>
  );
});

export default MenuItem;

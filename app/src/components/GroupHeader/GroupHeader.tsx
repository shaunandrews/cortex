import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, Text } from '@wordpress/ui';
import { chevronRight } from '@wordpress/icons';
import './GroupHeader.css';

export type GroupHeaderProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  /** Visible label. Strings get wrapped in a body-sm Text; nodes render as-is. */
  label: ReactNode;
  /** Whether the section below is open. Drives caret rotation (90° when open). */
  isOpen?: boolean;
  /** Visual state while being dragged in a sortable list. */
  isDragging?: boolean;
};

const GroupHeader = forwardRef<HTMLButtonElement, GroupHeaderProps>(function GroupHeader(
  { label, isOpen, isDragging, className, ...rest },
  ref,
) {
  const classes = ['group-header'];
  if (isOpen) classes.push('is-open');
  if (isDragging) classes.push('is-dragging');
  if (className) classes.push(className);

  return (
    <button ref={ref} type="button" className={classes.join(' ')} aria-expanded={isOpen} {...rest}>
      {typeof label === 'string' ? (
        <Text variant="body-sm" className="group-header-label">
          {label}
        </Text>
      ) : (
        <span className="group-header-label">{label}</span>
      )}
      <span className="group-header-caret" aria-hidden="true">
        <Icon icon={chevronRight} size={16} />
      </span>
    </button>
  );
});

export default GroupHeader;

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Button, Text } from '@wordpress/ui';
import './EmptyState.css';

export type EmptyStateProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> & {
  /** Optional icon above the title. */
  icon?: ReactNode;
  /** Short heading. Skip for terse inline empties. */
  title?: string;
  /** Body message. */
  message: ReactNode;
  /** Optional call-to-action button. */
  action?: {
    label: string;
    onClick: () => void;
  };
};

const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { icon, title, message, action, className, ...rest },
  ref,
) {
  const classes = ['empty-state'];
  if (className) classes.push(className);

  return (
    <div ref={ref} className={classes.join(' ')} {...rest}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      {title && (
        <Text variant="heading-md" className="empty-state-title">
          {title}
        </Text>
      )}
      <Text variant="body-md" className="empty-state-message">
        {message}
      </Text>
      {action && (
        <div className="empty-state-action">
          <Button variant="solid" tone="brand" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
});

export default EmptyState;

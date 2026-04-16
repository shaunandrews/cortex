import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import './ActionButton.css';

export type ActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  /** Icon shown at the start of the button. */
  icon: ReactNode;
  /** Optional label/count rendered after the icon. */
  children?: ReactNode;
  /** Persistent "on" state — e.g. liked, saved. */
  isActive?: boolean;
  /**
   * Visual tone.
   * - `neutral` (default) — grey when inactive, neutral strong when active
   * - `danger` — red when active (for like)
   */
  variant?: 'neutral' | 'danger';
};

const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  { icon, children, isActive, variant = 'neutral', className, ...rest },
  ref,
) {
  const classes = ['action-button', `action-button--${variant}`];
  if (isActive) classes.push('is-active');
  if (className) classes.push(className);

  return (
    <button ref={ref} type="button" className={classes.join(' ')} {...rest}>
      <span className="action-button-icon">{icon}</span>
      {children !== undefined && <span className="action-button-label">{children}</span>}
    </button>
  );
});

export default ActionButton;

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import './PanelHeader.css';

export type PanelHeaderProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  /** Left content — typically an icon + title, or just a title. */
  start?: ReactNode;
  /** Right content — typically action buttons (close, toggle, etc.). */
  end?: ReactNode;
};

const PanelHeader = forwardRef<HTMLElement, PanelHeaderProps>(function PanelHeader(
  { start, end, className, ...rest },
  ref,
) {
  const classes = ['panel-header'];
  if (className) classes.push(className);

  return (
    <header ref={ref} className={classes.join(' ')} {...rest}>
      {start !== undefined && <div className="panel-header-start">{start}</div>}
      {end !== undefined && <div className="panel-header-end">{end}</div>}
    </header>
  );
});

export default PanelHeader;

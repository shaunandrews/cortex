import { forwardRef, type HTMLAttributes } from 'react';
import './SiteIcon.css';

export type SiteIconProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /** Site name; used for the letter fallback when no image is provided. */
  name: string;
  /** Optional image URL. If omitted, the component renders the first letter of `name`. */
  src?: string;
};

const SiteIcon = forwardRef<HTMLSpanElement, SiteIconProps>(function SiteIcon(
  { name, src, className, ...rest },
  ref,
) {
  const classes = ['site-icon'];
  if (className) classes.push(className);

  return (
    <span ref={ref} className={classes.join(' ')} aria-hidden="true" {...rest}>
      {src ? <img src={src} alt="" /> : <span>{name.charAt(0).toUpperCase()}</span>}
    </span>
  );
});

export default SiteIcon;

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Popover, VisuallyHidden } from '@wordpress/ui';
import './AvatarButton.css';

type BaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children'> & {
  /** Image URL of the user's avatar. */
  src: string;
  /** Accessible label for the image (e.g. user name). */
  alt: string;
  /** Avatar diameter in pixels. Defaults to 28. */
  size?: number;
};

export type AvatarButtonProps = BaseProps & {
  /**
   * If provided, the button opens a Popover with this content.
   * If omitted, the button is a plain clickable avatar (use `onClick`).
   */
  menu?: ReactNode;
  /** Accessible title for the Popover. Required when `menu` is provided. */
  menuTitle?: string;
};

const AvatarButton = forwardRef<HTMLButtonElement, AvatarButtonProps>(function AvatarButton(
  { src, alt, size = 28, menu, menuTitle, className, style, ...rest },
  ref,
) {
  const classes = ['avatar-trigger'];
  if (className) classes.push(className);

  const mergedStyle = { ...style, width: size, height: size };

  const triggerButton = (
    <button ref={ref} type="button" className={classes.join(' ')} style={mergedStyle} {...rest}>
      <img src={src} alt={alt} className="avatar-trigger-img" />
    </button>
  );

  if (!menu) return triggerButton;

  return (
    <Popover.Root>
      <Popover.Trigger render={triggerButton} />
      <Popover.Popup align="end" sideOffset={4} className="avatar-menu">
        {menuTitle && (
          <VisuallyHidden>
            <Popover.Title>{menuTitle}</Popover.Title>
          </VisuallyHidden>
        )}
        {menu}
      </Popover.Popup>
    </Popover.Root>
  );
});

export default AvatarButton;

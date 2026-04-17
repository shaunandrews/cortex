/* eslint-disable react-refresh/only-export-components */
/**
 * Mock @wordpress/ui components for testing.
 *
 * @wordpress/ui bundles React 18 internally which conflicts with React 19.
 * These mocks render simple HTML equivalents so we can test our component
 * logic without the React version conflict.
 */
import type { ReactNode } from 'react';

export function Stack({
  children,
  style,
}: {
  children: ReactNode;
  direction?: string;
  align?: string;
  justify?: string;
  gap?: string;
  style?: React.CSSProperties;
}) {
  return <div style={style}>{children}</div>;
}

export function Text({
  children,
  render,
  style,
  className,
}: {
  children: ReactNode;
  variant?: string;
  render?: React.ReactElement<Record<string, unknown>>;
  style?: React.CSSProperties;
  className?: string;
}) {
  if (render) {
    const Tag = render.type as React.ElementType;
    const renderProps = render.props as Record<string, unknown>;
    return (
      <Tag
        {...renderProps}
        style={{ ...(renderProps.style as object), ...style }}
        className={className}
      >
        {children}
      </Tag>
    );
  }
  return (
    <span style={style} className={className}>
      {children}
    </span>
  );
}

function ButtonIcon(props: { icon: unknown }) {
  return <span data-testid="button-icon" data-icon={String(props.icon)} />;
}

function ButtonBase({
  children,
  onClick,
  style,
  className,
  title,
  disabled,
  loading,
  type,
}: {
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  variant?: string;
  tone?: string;
  size?: string;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
}) {
  return (
    <button
      onClick={onClick}
      style={style}
      className={className}
      title={title}
      disabled={disabled || loading}
      type={type}
      aria-busy={loading || undefined}
    >
      {children}
    </button>
  );
}

export const Button = Object.assign(ButtonBase, { Icon: ButtonIcon });

export function Icon({ size }: { icon: unknown; size?: number }) {
  return <span data-testid="icon" style={{ fontSize: size }} />;
}

export function IconButton({
  onClick,
  label,
  disabled,
  className,
}: {
  onClick?: () => void;
  icon?: unknown;
  label: string;
  variant?: string;
  tone?: string;
  size?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button onClick={onClick} aria-label={label} className={className} disabled={disabled}>
      <span data-testid="icon" />
    </button>
  );
}

export function Link({ children, href }: { children: ReactNode; href: string; tone?: string }) {
  return <a href={href}>{children}</a>;
}

function NoticeRoot({
  children,
  style,
}: {
  children: ReactNode;
  intent?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div role="alert" style={style}>
      {children}
    </div>
  );
}

function NoticeTitle({ children }: { children: ReactNode }) {
  return <strong>{children}</strong>;
}

function NoticeDescription({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export const Notice = {
  Root: NoticeRoot,
  Title: NoticeTitle,
  Description: NoticeDescription,
};

function DialogRoot({
  children,
  open,
}: {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  if (!open) return null;
  return <div role="dialog">{children}</div>;
}

function DialogPopup({ children }: { children: ReactNode; size?: string }) {
  return <div className="dialog-popup">{children}</div>;
}

function DialogHeader({ children }: { children: ReactNode }) {
  return <header>{children}</header>;
}

function DialogTitle({ children }: { children: ReactNode }) {
  return <h2>{children}</h2>;
}

function DialogFooter({ children }: { children: ReactNode }) {
  return <footer>{children}</footer>;
}

function DialogAction({
  children,
  onClick,
  type,
  disabled,
}: {
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  variant?: string;
  tone?: string;
}) {
  return (
    <button onClick={onClick} type={type} disabled={disabled}>
      {children}
    </button>
  );
}

function DialogCloseIcon({ label }: { label?: string }) {
  return <button aria-label={label ?? 'Close'} />;
}

export const Dialog = {
  Root: DialogRoot,
  Popup: DialogPopup,
  Header: DialogHeader,
  Title: DialogTitle,
  Footer: DialogFooter,
  Action: DialogAction,
  CloseIcon: DialogCloseIcon,
};

interface InputControlProps {
  label: ReactNode;
  description?: ReactNode;
  details?: ReactNode;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  suffix?: ReactNode;
  prefix?: ReactNode;
  autoComplete?: string;
  autoCorrect?: string;
  spellCheck?: boolean;
  type?: string;
  disabled?: boolean;
}

import { forwardRef } from 'react';

export const InputControl = forwardRef<HTMLInputElement, InputControlProps>(function InputControl(
  { label, description, details, suffix, prefix, ...rest },
  ref,
) {
  const labelText = typeof label === 'string' ? label : 'field';
  return (
    <label>
      <span>{label}</span>
      {description && <span className="field-description">{description}</span>}
      {prefix && <span className="field-prefix">{prefix}</span>}
      <input ref={ref} aria-label={labelText} {...rest} />
      {suffix && <span className="field-suffix">{suffix}</span>}
      {details && <span className="field-details">{details}</span>}
    </label>
  );
});

import { createContext, useContext, useState, cloneElement, isValidElement } from 'react';

type PopoverCtx = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const PopoverContext = createContext<PopoverCtx | null>(null);

function PopoverRoot({
  children,
  open,
  onOpenChange,
  defaultOpen,
}: {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  modal?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  const isControlled = open !== undefined;
  const currentOpen = isControlled ? open : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <PopoverContext.Provider value={{ open: currentOpen, setOpen }}>
      {children}
    </PopoverContext.Provider>
  );
}

function PopoverTrigger({
  children,
  render,
  onClick,
  ...rest
}: {
  children?: ReactNode;
  render?: React.ReactElement<Record<string, unknown>>;
  onClick?: (e: React.MouseEvent) => void;
} & Record<string, unknown>) {
  const ctx = useContext(PopoverContext);
  const handleClick = (e: React.MouseEvent) => {
    ctx?.setOpen(!ctx.open);
    onClick?.(e);
  };
  if (render && isValidElement(render)) {
    const existing = render.props as Record<string, unknown>;
    return cloneElement(render, {
      ...existing,
      ...rest,
      onClick: handleClick,
      children,
    });
  }
  return (
    <button onClick={handleClick} {...(rest as Record<string, unknown>)}>
      {children}
    </button>
  );
}

function PopoverPopup({ children }: { children: ReactNode } & Record<string, unknown>) {
  const ctx = useContext(PopoverContext);
  if (!ctx?.open) return null;
  return <div role="dialog">{children}</div>;
}

function PopoverTitle({ children }: { children: ReactNode }) {
  return <h2>{children}</h2>;
}

function PopoverDescription({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

function PopoverClose({
  children,
  onClick,
  ...rest
}: { children?: ReactNode; onClick?: (e: React.MouseEvent) => void } & Record<string, unknown>) {
  const ctx = useContext(PopoverContext);
  return (
    <button
      onClick={(e) => {
        ctx?.setOpen(false);
        onClick?.(e);
      }}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </button>
  );
}

export const Popover = {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Popup: PopoverPopup,
  Title: PopoverTitle,
  Description: PopoverDescription,
  Close: PopoverClose,
};

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span style={{ position: 'absolute', left: '-9999px' }}>{children}</span>;
}

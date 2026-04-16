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
}: {
  children: ReactNode;
  variant?: string;
  render?: React.ReactElement;
  style?: React.CSSProperties;
}) {
  if (render) {
    const Tag = (render as React.ReactElement).type as React.ElementType;
    return <Tag style={style}>{children}</Tag>;
  }
  return <span style={style}>{children}</span>;
}

export function Button({
  children,
  onClick,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} style={style}>
      {children}
    </button>
  );
}

export function Icon({ size }: { icon: unknown; size?: number }) {
  return <span data-testid="icon" style={{ fontSize: size }} />;
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

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MenuItem from './MenuItem';

describe('MenuItem', () => {
  it('renders the label', () => {
    render(<MenuItem label="Home" />);
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
  });

  it('renders the icon slot when provided', () => {
    render(<MenuItem icon={<span data-testid="icon">★</span>} label="Favorites" />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders the count badge on the icon only when greater than zero', () => {
    const icon = <span data-testid="icon">★</span>;
    const { rerender } = render(<MenuItem icon={icon} label="Inbox" count={0} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();

    rerender(<MenuItem icon={icon} label="Inbox" count={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('applies state classes for selected and focused', () => {
    const { rerender, container } = render(<MenuItem label="Home" />);
    const button = container.querySelector('.menu-item')!;
    expect(button.className).not.toContain('is-selected');
    expect(button.className).not.toContain('is-focused');

    rerender(<MenuItem label="Home" isSelected />);
    expect(button.className).toContain('is-selected');

    rerender(<MenuItem label="Home" isFocused />);
    expect(button.className).toContain('is-focused');
  });

  it('forwards onClick', () => {
    const onClick = vi.fn();
    render(<MenuItem label="Home" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('spreads arbitrary button attributes and data-* props', () => {
    render(<MenuItem label="Home" aria-label="Go home" data-testid="menu-home" />);
    const button = screen.getByTestId('menu-home');
    expect(button).toHaveAttribute('aria-label', 'Go home');
  });

  it('forwards a ref to the underlying button', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<MenuItem ref={ref} label="Home" />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

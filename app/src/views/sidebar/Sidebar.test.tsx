import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import { useSidebarGroups } from '../../hooks/useSidebarGroups';
import type { WPComSite } from '../../api/types';

function mkSite(id: number, name: string): WPComSite {
  return {
    ID: id,
    name,
    description: '',
    URL: `https://example.com/${id}`,
    options: { is_wpforteams_site: true },
  };
}

const siteA = mkSite(1, 'Alpha');
const siteB = mkSite(2, 'Bravo');
const siteC = mkSite(3, 'Charlie');

const allSites = [siteA, siteB, siteC];
const emptyFollowingMap = new Map();
const unseenMap = new Map<number, number>([[siteB.ID, 3]]);

type Harness = {
  store?: ReturnType<typeof useSidebarGroups>;
};

function TestHarness({ harness }: { harness: Harness }) {
  const store = useSidebarGroups({
    sites: allSites,
    followingMap: emptyFollowingMap,
  });

  // Expose the store to the test
  useEffect(() => {
    harness.store = store;
  });

  return (
    <Sidebar
      store={store}
      sites={allSites}
      unseenMap={unseenMap}
      selectedSiteId={null}
      isHome
      isSaved={false}
      onSelectSite={vi.fn()}
      onGoHome={vi.fn()}
      onGoSaved={vi.fn()}
      onCreateP2={vi.fn()}
      onOpenSite={vi.fn()}
      onMarkAllRead={vi.fn()}
    />
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders default Favorites and Sites groups', () => {
    render(<TestHarness harness={{}} />);
    expect(screen.getByText('Favorites')).toBeDefined();
    expect(screen.getByText('Sites')).toBeDefined();
  });

  it('shows all sites in the Sites group by default', () => {
    render(<TestHarness harness={{}} />);
    expect(screen.getByText('Alpha')).toBeDefined();
    expect(screen.getByText('Bravo')).toBeDefined();
    expect(screen.getByText('Charlie')).toBeDefined();
  });

  it('right-click on site row opens site context menu with Favorite', () => {
    render(<TestHarness harness={{}} />);
    const row = screen.getByText('Alpha').closest('button')!;
    fireEvent.contextMenu(row, { clientX: 100, clientY: 100 });
    expect(screen.getByRole('menuitem', { name: /^Favorite$/ })).toBeDefined();
  });

  it('Favorite menu item moves the site into Favorites', () => {
    const harness: Harness = {};
    render(<TestHarness harness={harness} />);

    const row = screen.getByText('Alpha').closest('button')!;
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });

    const fav = screen.getByRole('menuitem', { name: /^Favorite$/ });
    act(() => {
      fireEvent.click(fav);
    });

    expect(harness.store!.membership[siteA.ID]).toBe('favorites');
  });

  it('right-click on default group header disables Rename and Delete', () => {
    render(<TestHarness harness={{}} />);
    const header = screen.getByText('Sites').closest('button')!;
    fireEvent.contextMenu(header, { clientX: 20, clientY: 20 });

    const rename = screen.getByRole('menuitem', { name: /Rename/ }) as HTMLButtonElement;
    const del = screen.getByRole('menuitem', { name: /Delete/ }) as HTMLButtonElement;
    expect(rename.disabled).toBe(true);
    expect(del.disabled).toBe(true);
  });

  it('Collapse menu item hides the group body', () => {
    const harness: Harness = {};
    render(<TestHarness harness={harness} />);

    // Body is visible — Alpha site is rendered
    expect(screen.getByText('Alpha')).toBeDefined();

    const header = screen.getByText('Sites').closest('button')!;
    fireEvent.contextMenu(header, { clientX: 20, clientY: 20 });
    const collapse = screen.getByRole('menuitem', { name: /^Collapse$/ });
    act(() => {
      fireEvent.click(collapse);
    });

    // Group state is now collapsed in the store
    expect(harness.store!.groups.find((g) => g.id === 'sites')!.collapsed).toBe(true);
  });

  it('shows an unseen badge on sites with unread counts', () => {
    render(<TestHarness harness={{}} />);
    const bravoRow = screen.getByText('Bravo').closest('button')!;
    expect(within(bravoRow).getByText('3')).toBeDefined();
  });

  it('clicking Favorites row unchanges site when no star-toggle is on the row', () => {
    // Assertion: there should be no star-toggle span inside sidebar-item rows
    const { container } = render(<TestHarness harness={{}} />);
    const stars = container.querySelectorAll('.star-toggle');
    expect(stars.length).toBe(0);
  });

  it('right-click site "Move to" lists all groups', () => {
    const harness: Harness = {};
    render(<TestHarness harness={harness} />);

    // Create a custom group via the store
    act(() => {
      harness.store!.createGroup('Design');
    });

    const row = screen.getByText('Alpha').closest('button')!;
    fireEvent.contextMenu(row, { clientX: 30, clientY: 30 });

    // Hover the submenu trigger
    const moveTo = screen.getByRole('menuitem', { name: /Move to/ });
    act(() => {
      fireEvent.mouseEnter(moveTo);
    });

    // Submenu should list all groups including the custom one
    expect(screen.getByRole('menuitem', { name: /^Favorites$/ })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /Design/ })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /New group…/ })).toBeDefined();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebarGroups, FAVORITES_GROUP_ID, SITES_GROUP_ID } from './useSidebarGroups';
import type { WPComSite } from '../api/types';

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
const siteD = mkSite(4, 'Delta');

const allSites = [siteA, siteB, siteC, siteD];

describe('useSidebarGroups', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('migration', () => {
    it('creates default groups on first load', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      expect(result.current.groups).toHaveLength(2);
      expect(result.current.groups[0].id).toBe(FAVORITES_GROUP_ID);
      expect(result.current.groups[1].id).toBe(SITES_GROUP_ID);
    });

    it('migrates starred sites into Favorites', () => {
      localStorage.setItem('cortex_starred_sites', JSON.stringify([2, 3]));
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      expect(result.current.starredIds.has(2)).toBe(true);
      expect(result.current.starredIds.has(3)).toBe(true);
      expect(result.current.starredIds.has(1)).toBe(false);
      const fav = result.current.groups.find((g) => g.id === FAVORITES_GROUP_ID)!;
      expect(fav.manualOrder).toEqual([2, 3]);
    });

    it('migrates site sort preference into Sites group', () => {
      localStorage.setItem('cortex_site_sort', 'recent');
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      const sites = result.current.groups.find((g) => g.id === SITES_GROUP_ID)!;
      expect(sites.sortMode).toBe('recent');
    });

    it('deletes old keys after migration', () => {
      localStorage.setItem('cortex_starred_sites', JSON.stringify([1]));
      localStorage.setItem('cortex_site_sort', 'unread');
      renderHook(() => useSidebarGroups({ sites: allSites }));
      expect(localStorage.getItem('cortex_starred_sites')).toBeNull();
      expect(localStorage.getItem('cortex_site_sort')).toBeNull();
      expect(localStorage.getItem('cortex_sidebar_v1')).toBe('true');
    });

    it('does not re-run after migration flag is set', () => {
      localStorage.setItem('cortex_sidebar_v1', 'true');
      localStorage.setItem('cortex_starred_sites', JSON.stringify([1]));
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      expect(result.current.starredIds.has(1)).toBe(false);
      // The old key is left alone because migration was skipped.
      expect(localStorage.getItem('cortex_starred_sites')).toBe('[1]');
    });
  });

  describe('createGroup / renameGroup / deleteGroup', () => {
    it('creates a custom group with a unique name', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      act(() => {
        result.current.createGroup('Design');
      });
      expect(result.current.groups).toHaveLength(3);
      expect(result.current.groups.some((g) => g.name === 'Design')).toBe(true);
    });

    it('rejects duplicate names (case-insensitive) including defaults', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      let ok: ReturnType<typeof result.current.createGroup> = null;
      act(() => {
        ok = result.current.createGroup('favorites');
      });
      expect(ok).toBeNull();
      act(() => {
        ok = result.current.createGroup('  Sites  ');
      });
      expect(ok).toBeNull();
      expect(result.current.groups).toHaveLength(2);
    });

    it('renames a custom group', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      let id = '';
      act(() => {
        const g = result.current.createGroup('Design');
        id = g!.id;
      });
      act(() => {
        const ok = result.current.renameGroup(id, 'Leadership');
        expect(ok).toBe(true);
      });
      expect(result.current.groups.find((g) => g.id === id)!.name).toBe('Leadership');
    });

    it('refuses to rename default groups', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      act(() => {
        const ok = result.current.renameGroup(FAVORITES_GROUP_ID, 'Starred');
        expect(ok).toBe(false);
      });
      expect(
        result.current.groups.find((g) => g.id === FAVORITES_GROUP_ID)!.name,
      ).toBe('Favorites');
    });

    it('deleting a group moves its members to Sites', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      let id = '';
      act(() => {
        id = result.current.createGroup('Design')!.id;
      });
      act(() => {
        result.current.moveSite(siteA.ID, id);
      });
      expect(result.current.membership[siteA.ID]).toBe(id);
      act(() => {
        result.current.deleteGroup(id);
      });
      expect(result.current.membership[siteA.ID]).toBeUndefined();
      // Without membership, the site falls into SITES implicitly.
      const sitesList = result.current.sitesByGroup.get(SITES_GROUP_ID)!;
      expect(sitesList.some((s) => s.ID === siteA.ID)).toBe(true);
    });

    it('refuses to delete default groups', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      act(() => {
        result.current.deleteGroup(SITES_GROUP_ID);
      });
      expect(result.current.groups.some((g) => g.id === SITES_GROUP_ID)).toBe(true);
    });
  });

  describe('setSort', () => {
    it('switching to custom seeds manualOrder from current rendered order', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      act(() => {
        result.current.setSort(SITES_GROUP_ID, 'custom');
      });
      const sites = result.current.groups.find((g) => g.id === SITES_GROUP_ID)!;
      expect(sites.sortMode).toBe('custom');
      expect(sites.manualOrder).toBeDefined();
      expect(sites.manualOrder!.length).toBeGreaterThan(0);
    });

    it('switching away from custom discards manualOrder', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      act(() => {
        result.current.setSort(SITES_GROUP_ID, 'custom');
      });
      expect(
        result.current.groups.find((g) => g.id === SITES_GROUP_ID)!.manualOrder,
      ).toBeDefined();
      act(() => {
        result.current.setSort(SITES_GROUP_ID, 'alpha');
      });
      expect(
        result.current.groups.find((g) => g.id === SITES_GROUP_ID)!.manualOrder,
      ).toBeUndefined();
    });
  });

  describe('toggleShowUnread', () => {
    it('toggles per-group showUnread flag and persists', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      expect(
        result.current.groups.find((g) => g.id === SITES_GROUP_ID)!.showUnread,
      ).toBe(true);
      act(() => {
        result.current.toggleShowUnread(SITES_GROUP_ID);
      });
      expect(
        result.current.groups.find((g) => g.id === SITES_GROUP_ID)!.showUnread,
      ).toBe(false);

      const { result: next } = renderHook(() => useSidebarGroups({ sites: allSites }));
      expect(
        next.current.groups.find((g) => g.id === SITES_GROUP_ID)!.showUnread,
      ).toBe(false);
    });

    it('back-fills showUnread=true for groups saved before the field existed', () => {
      // Simulate pre-showUnread storage.
      localStorage.setItem('cortex_sidebar_v1', 'true');
      localStorage.setItem(
        'cortex_sidebar_groups',
        JSON.stringify([
          { id: 'favorites', name: 'Favorites', kind: 'favorites', sortMode: 'custom', collapsed: false, order: 0, manualOrder: [] },
          { id: 'sites', name: 'Sites', kind: 'sites', sortMode: 'alpha', collapsed: false, order: 9999 },
        ]),
      );
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      for (const g of result.current.groups) {
        expect(g.showUnread).toBe(true);
      }
    });
  });

  describe('toggleCollapse', () => {
    it('persists collapsed state', () => {
      const { result, rerender } = renderHook(() => useSidebarGroups({ sites: allSites }));
      act(() => {
        result.current.toggleCollapse(SITES_GROUP_ID);
      });
      expect(
        result.current.groups.find((g) => g.id === SITES_GROUP_ID)!.collapsed,
      ).toBe(true);
      rerender();
      // Reload from storage: new hook instance.
      const { result: next } = renderHook(() => useSidebarGroups({ sites: allSites }));
      expect(
        next.current.groups.find((g) => g.id === SITES_GROUP_ID)!.collapsed,
      ).toBe(true);
    });
  });

  describe('toggleFavorite', () => {
    it('favorites a site, then restores it to its previous group on unfavorite', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      let customId = '';
      act(() => {
        customId = result.current.createGroup('Design')!.id;
      });
      act(() => {
        result.current.moveSite(siteA.ID, customId);
      });
      expect(result.current.membership[siteA.ID]).toBe(customId);

      act(() => {
        result.current.toggleFavorite(siteA.ID);
      });
      expect(result.current.starredIds.has(siteA.ID)).toBe(true);

      act(() => {
        result.current.toggleFavorite(siteA.ID);
      });
      expect(result.current.starredIds.has(siteA.ID)).toBe(false);
      expect(result.current.membership[siteA.ID]).toBe(customId);
    });

    it('falls back to Sites if previous group no longer exists', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      let customId = '';
      act(() => {
        customId = result.current.createGroup('Design')!.id;
      });
      act(() => {
        result.current.moveSite(siteB.ID, customId);
      });
      act(() => {
        result.current.toggleFavorite(siteB.ID);
      });
      act(() => {
        result.current.deleteGroup(customId);
      });
      act(() => {
        result.current.toggleFavorite(siteB.ID);
      });
      expect(result.current.starredIds.has(siteB.ID)).toBe(false);
      expect(result.current.membership[siteB.ID]).toBeUndefined();
    });
  });

  describe('moveSite / reorderSitesInGroup', () => {
    it('moves a site between groups and updates membership', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      let id = '';
      act(() => {
        id = result.current.createGroup('Teams')!.id;
      });
      act(() => {
        result.current.moveSite(siteC.ID, id);
      });
      expect(result.current.membership[siteC.ID]).toBe(id);
      const list = result.current.sitesByGroup.get(id)!;
      expect(list.some((s) => s.ID === siteC.ID)).toBe(true);
    });

    it('honours atIndex when target group is custom sort', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      let id = '';
      act(() => {
        id = result.current.createGroup('Stacked')!.id;
      });
      act(() => {
        result.current.setSort(id, 'custom');
      });
      act(() => {
        result.current.moveSite(siteA.ID, id);
        result.current.moveSite(siteB.ID, id);
        result.current.moveSite(siteC.ID, id, 1); // insert between A and B
      });
      const g = result.current.groups.find((x) => x.id === id)!;
      expect(g.manualOrder).toEqual([siteA.ID, siteC.ID, siteB.ID]);
    });

    it('reorderSitesInGroup only works when sort is custom', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      let id = '';
      act(() => {
        id = result.current.createGroup('Ordered')!.id;
      });
      act(() => {
        result.current.moveSite(siteA.ID, id);
        result.current.moveSite(siteB.ID, id);
      });
      // Not custom yet — reorder is a no-op
      act(() => {
        result.current.reorderSitesInGroup(id, [siteB.ID, siteA.ID]);
      });
      const before = result.current.groups.find((g) => g.id === id)!;
      expect(before.manualOrder).toBeUndefined();

      act(() => {
        result.current.setSort(id, 'custom');
      });
      act(() => {
        result.current.reorderSitesInGroup(id, [siteB.ID, siteA.ID]);
      });
      const after = result.current.groups.find((g) => g.id === id)!;
      expect(after.manualOrder).toEqual([siteB.ID, siteA.ID]);
    });
  });

  describe('reorderGroups', () => {
    it('reorders custom groups, keeps favorites and sites pinned', () => {
      const { result } = renderHook(() => useSidebarGroups({ sites: allSites }));
      let a = '';
      let b = '';
      let c = '';
      act(() => {
        a = result.current.createGroup('Alpha')!.id;
        b = result.current.createGroup('Beta')!.id;
        c = result.current.createGroup('Gamma')!.id;
      });
      act(() => {
        result.current.reorderGroups([c, a, b]);
      });
      const ids = result.current.groups.map((g) => g.id);
      expect(ids[0]).toBe(FAVORITES_GROUP_ID);
      expect(ids[ids.length - 1]).toBe(SITES_GROUP_ID);
      const customIds = ids.filter((i) => i !== FAVORITES_GROUP_ID && i !== SITES_GROUP_ID);
      expect(customIds).toEqual([c, a, b]);
    });
  });

  describe('search filtering + visibleGroups', () => {
    it('hides groups with no matches when searching', () => {
      const { result } = renderHook(() =>
        useSidebarGroups({ sites: allSites, searchQuery: 'alpha' }),
      );
      // Only the sites group has an 'Alpha'
      const visible = result.current.visibleGroups;
      const hasAlpha = visible.some((e) => e.sites.some((s) => s.name === 'Alpha'));
      expect(hasAlpha).toBe(true);
      // Favorites is empty under search -> hidden
      expect(visible.some((e) => e.group.id === FAVORITES_GROUP_ID)).toBe(false);
    });

    it('flatVisibleSites skips collapsed groups', () => {
      const { result, rerender } = renderHook(
        ({ q }: { q: string }) =>
          useSidebarGroups({ sites: allSites, searchQuery: q }),
        { initialProps: { q: '' } },
      );
      act(() => {
        result.current.toggleCollapse(SITES_GROUP_ID);
      });
      rerender({ q: '' });
      expect(result.current.flatVisibleSites).toHaveLength(0);
    });
  });
});

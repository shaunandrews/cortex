import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WPComSite } from '../api/types';

export type SortMode = 'alpha' | 'recent' | 'unread' | 'custom';

export type GroupKind = 'favorites' | 'sites' | 'custom';

export type Group = {
  id: string;
  name: string;
  kind: GroupKind;
  sortMode: SortMode;
  collapsed: boolean;
  order: number;
  manualOrder?: number[];
  showUnread: boolean;
};

type Membership = Record<number, string>;
type LastGroup = Record<number, string>;

const GROUPS_KEY = 'cortex_sidebar_groups';
const MEMBERSHIP_KEY = 'cortex_sidebar_membership';
const LAST_GROUP_KEY = 'cortex_sidebar_last_group';
const MIGRATION_FLAG = 'cortex_sidebar_v1';

const OLD_STARRED_KEY = 'cortex_starred_sites';
const OLD_SORT_KEY = 'cortex_site_sort';

const FAVORITES_ID = 'favorites';
const SITES_ID = 'sites';

const FAVORITES_ORDER = 0;
const SITES_ORDER = 9999;

function defaultGroups(): Group[] {
  return [
    {
      id: FAVORITES_ID,
      name: 'Favorites',
      kind: 'favorites',
      sortMode: 'custom',
      collapsed: false,
      order: FAVORITES_ORDER,
      manualOrder: [],
      showUnread: true,
    },
    {
      id: SITES_ID,
      name: 'Sites',
      kind: 'sites',
      sortMode: 'alpha',
      collapsed: false,
      order: SITES_ORDER,
      showUnread: true,
    },
  ];
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / disabled storage
  }
}

function runMigration(): { groups: Group[]; membership: Membership } {
  if (localStorage.getItem(MIGRATION_FLAG) === 'true') {
    const groups = readJSON<Group[]>(GROUPS_KEY, defaultGroups());
    const membership = readJSON<Membership>(MEMBERSHIP_KEY, {});
    return { groups: ensureDefaults(groups), membership };
  }

  const groups = defaultGroups();
  const membership: Membership = {};

  const starred = readJSON<number[]>(OLD_STARRED_KEY, []);
  if (Array.isArray(starred) && starred.length > 0) {
    const fav = groups.find((g) => g.id === FAVORITES_ID)!;
    fav.manualOrder = [...starred];
    for (const id of starred) {
      membership[id] = FAVORITES_ID;
    }
  }

  const oldSort = localStorage.getItem(OLD_SORT_KEY);
  if (oldSort === 'alpha' || oldSort === 'recent' || oldSort === 'unread') {
    const sites = groups.find((g) => g.id === SITES_ID)!;
    sites.sortMode = oldSort;
  }

  writeJSON(GROUPS_KEY, groups);
  writeJSON(MEMBERSHIP_KEY, membership);
  localStorage.setItem(MIGRATION_FLAG, 'true');
  localStorage.removeItem(OLD_STARRED_KEY);
  localStorage.removeItem(OLD_SORT_KEY);

  return { groups, membership };
}

function ensureDefaults(groups: Group[]): Group[] {
  const withDefaults = groups.map(
    (g) => ({ ...g, showUnread: g.showUnread ?? true }) as Group,
  );
  const hasFav = withDefaults.some((g) => g.id === FAVORITES_ID);
  const hasSites = withDefaults.some((g) => g.id === SITES_ID);
  if (hasFav && hasSites) return withDefaults;
  const defaults = defaultGroups();
  const next = [...withDefaults];
  if (!hasFav) next.unshift(defaults[0]);
  if (!hasSites) next.push(defaults[1]);
  return next;
}

function newId(): string {
  return `grp_${Math.random().toString(36).slice(2, 9)}`;
}

function nameExists(groups: Group[], name: string, excludeId?: string): boolean {
  const norm = name.trim().toLowerCase();
  return groups.some((g) => g.id !== excludeId && g.name.trim().toLowerCase() === norm);
}

function sortGroupsByOrder(groups: Group[]): Group[] {
  return [...groups].sort((a, b) => a.order - b.order);
}

export function useSidebarGroups(opts?: {
  sites?: WPComSite[];
  followingMap?: Map<number, { unseen_count: number; last_updated: number }>;
  searchQuery?: string;
}) {
  const sites = opts?.sites;
  const followingMap = opts?.followingMap;
  const searchQuery = opts?.searchQuery ?? '';

  const [groups, setGroups] = useState<Group[]>(() => {
    const { groups } = runMigration();
    return sortGroupsByOrder(groups);
  });
  const [membership, setMembership] = useState<Membership>(() => {
    const { membership } = runMigration();
    return membership;
  });

  // Refs track the latest state so batched mutations see each other's writes
  // even when React hasn't re-rendered yet.
  const groupsRef = useRef(groups);
  const membershipRef = useRef(membership);
  groupsRef.current = groups;
  membershipRef.current = membership;

  const persistGroups = useCallback((updater: (prev: Group[]) => Group[]) => {
    const next = sortGroupsByOrder(updater(groupsRef.current));
    groupsRef.current = next;
    writeJSON(GROUPS_KEY, next);
    setGroups(next);
  }, []);

  const persistMembership = useCallback(
    (updater: (prev: Membership) => Membership) => {
      const next = updater(membershipRef.current);
      membershipRef.current = next;
      writeJSON(MEMBERSHIP_KEY, next);
      setMembership(next);
    },
    [],
  );

  const recordLastGroup = useCallback((siteId: number, fromGroupId: string) => {
    const map = readJSON<LastGroup>(LAST_GROUP_KEY, {});
    map[siteId] = fromGroupId;
    writeJSON(LAST_GROUP_KEY, map);
  }, []);

  const clearLastGroup = useCallback((siteId: number) => {
    const map = readJSON<LastGroup>(LAST_GROUP_KEY, {});
    delete map[siteId];
    writeJSON(LAST_GROUP_KEY, map);
  }, []);

  const readLastGroup = useCallback((siteId: number): string | undefined => {
    const map = readJSON<LastGroup>(LAST_GROUP_KEY, {});
    return map[siteId];
  }, []);

  // ── Derived state ──────────────────────────────────────────────────

  const starredIds = useMemo(() => {
    const ids = new Set<number>();
    for (const [idStr, groupId] of Object.entries(membership)) {
      if (groupId === FAVORITES_ID) ids.add(Number(idStr));
    }
    return ids;
  }, [membership]);

  const sitesByGroup = useMemo(() => {
    const result = new Map<string, WPComSite[]>();
    for (const g of groups) result.set(g.id, []);
    if (!sites) return result;

    for (const site of sites) {
      const groupId = membership[site.ID] ?? SITES_ID;
      const list = result.get(groupId) ?? result.get(SITES_ID)!;
      list.push(site);
    }

    // Apply sort
    for (const g of groups) {
      const list = result.get(g.id);
      if (!list) continue;
      if (g.sortMode === 'custom' && g.manualOrder) {
        const order = new Map(g.manualOrder.map((id, i) => [id, i]));
        list.sort((a, b) => {
          const ai = order.has(a.ID) ? order.get(a.ID)! : Number.MAX_SAFE_INTEGER;
          const bi = order.has(b.ID) ? order.get(b.ID)! : Number.MAX_SAFE_INTEGER;
          if (ai !== bi) return ai - bi;
          return a.name.localeCompare(b.name);
        });
      } else if (g.sortMode === 'recent' && followingMap) {
        list.sort((a, b) => {
          const at = followingMap.get(a.ID)?.last_updated ?? 0;
          const bt = followingMap.get(b.ID)?.last_updated ?? 0;
          if (bt !== at) return bt - at;
          return a.name.localeCompare(b.name);
        });
      } else if (g.sortMode === 'unread' && followingMap) {
        list.sort((a, b) => {
          const au = followingMap.get(a.ID)?.unseen_count ?? 0;
          const bu = followingMap.get(b.ID)?.unseen_count ?? 0;
          if (bu !== au) return bu - au;
          return a.name.localeCompare(b.name);
        });
      } else {
        list.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    return result;
  }, [groups, sites, membership, followingMap]);

  const visibleGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return groups.map((g) => ({
        group: g,
        sites: sitesByGroup.get(g.id) ?? [],
      }));
    }
    const result: { group: Group; sites: WPComSite[] }[] = [];
    for (const g of groups) {
      const list = (sitesByGroup.get(g.id) ?? []).filter((s) =>
        s.name.toLowerCase().includes(q),
      );
      if (list.length > 0) result.push({ group: g, sites: list });
    }
    return result;
  }, [groups, sitesByGroup, searchQuery]);

  const flatVisibleSites = useMemo(() => {
    const flat: WPComSite[] = [];
    for (const entry of visibleGroups) {
      if (entry.group.collapsed) continue;
      flat.push(...entry.sites);
    }
    return flat;
  }, [visibleGroups]);

  // ── Mutations ──────────────────────────────────────────────────────

  const createGroup = useCallback(
    (name: string): Group | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const current = groupsRef.current;
      if (nameExists(current, trimmed)) return null;
      const customs = current.filter((g) => g.kind === 'custom');
      const order =
        customs.length === 0
          ? 100
          : Math.max(...customs.map((g) => g.order)) + 10;
      const group: Group = {
        id: newId(),
        name: trimmed,
        kind: 'custom',
        sortMode: 'alpha',
        collapsed: false,
        order,
        showUnread: true,
      };
      persistGroups((prev) => [...prev, group]);
      return group;
    },
    [persistGroups],
  );

  const renameGroup = useCallback(
    (id: string, name: string): boolean => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      const current = groupsRef.current;
      const target = current.find((g) => g.id === id);
      if (!target || target.kind !== 'custom') return false;
      if (nameExists(current, trimmed, id)) return false;
      persistGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name: trimmed } : g)));
      return true;
    },
    [persistGroups],
  );

  const deleteGroup = useCallback(
    (id: string) => {
      const target = groupsRef.current.find((g) => g.id === id);
      if (!target || target.kind !== 'custom') return;
      persistGroups((prev) => prev.filter((g) => g.id !== id));
      persistMembership((prev) => {
        const next: Membership = {};
        for (const [siteId, gId] of Object.entries(prev)) {
          if (gId !== id) next[Number(siteId)] = gId;
        }
        return next;
      });
    },
    [persistGroups, persistMembership],
  );

  const setSort = useCallback(
    (id: string, sortMode: SortMode) => {
      const target = groupsRef.current.find((g) => g.id === id);
      if (!target) return;
      // Seed manualOrder from current rendered order when switching TO custom.
      // `sitesByGroup` is a closure capture of the latest render; batched
      // setSort calls during tests may not see the newest list, but the
      // sort-by-name fallback inside the memo keeps the result stable.
      const currentSites = sitesByGroup.get(id) ?? [];
      persistGroups((prev) =>
        prev.map((g) => {
          if (g.id !== id) return g;
          if (sortMode === 'custom') {
            return { ...g, sortMode, manualOrder: currentSites.map((s) => s.ID) };
          }
          const { manualOrder, ...rest } = g;
          void manualOrder;
          return { ...rest, sortMode };
        }),
      );
    },
    [persistGroups, sitesByGroup],
  );

  const toggleCollapse = useCallback(
    (id: string) => {
      persistGroups((prev) =>
        prev.map((g) => (g.id === id ? { ...g, collapsed: !g.collapsed } : g)),
      );
    },
    [persistGroups],
  );

  const toggleShowUnread = useCallback(
    (id: string) => {
      persistGroups((prev) =>
        prev.map((g) => (g.id === id ? { ...g, showUnread: !g.showUnread } : g)),
      );
    },
    [persistGroups],
  );

  const toggleAllCollapsed = useCallback(() => {
    persistGroups((prev) => {
      const anyOpen = prev.some((g) => !g.collapsed);
      return prev.map((g) => ({ ...g, collapsed: anyOpen }));
    });
  }, [persistGroups]);

  const moveSite = useCallback(
    (siteId: number, toGroupId: string, atIndex?: number) => {
      const currentGroups = groupsRef.current;
      if (!currentGroups.some((g) => g.id === toGroupId)) return;

      const currentMembership = membershipRef.current;
      const fromGroupId = currentMembership[siteId] ?? SITES_ID;
      if (fromGroupId === toGroupId && atIndex === undefined) return;

      if (toGroupId === FAVORITES_ID && fromGroupId !== FAVORITES_ID) {
        recordLastGroup(siteId, fromGroupId);
      } else if (fromGroupId === FAVORITES_ID && toGroupId !== FAVORITES_ID) {
        clearLastGroup(siteId);
      }

      persistMembership((prev) => {
        const next = { ...prev };
        if (toGroupId === SITES_ID) {
          delete next[siteId];
        } else {
          next[siteId] = toGroupId;
        }
        return next;
      });

      persistGroups((prev) =>
        prev.map((g) => {
          if (g.id === fromGroupId && g.sortMode === 'custom' && g.manualOrder) {
            return { ...g, manualOrder: g.manualOrder.filter((id) => id !== siteId) };
          }
          if (g.id === toGroupId && g.sortMode === 'custom') {
            const base = (g.manualOrder ?? []).filter((id) => id !== siteId);
            const insertAt =
              atIndex !== undefined
                ? Math.max(0, Math.min(atIndex, base.length))
                : base.length;
            const nextOrder = [...base.slice(0, insertAt), siteId, ...base.slice(insertAt)];
            return { ...g, manualOrder: nextOrder };
          }
          return g;
        }),
      );
    },
    [persistGroups, persistMembership, recordLastGroup, clearLastGroup],
  );

  const reorderSitesInGroup = useCallback(
    (groupId: string, orderedIds: number[]) => {
      const target = groupsRef.current.find((g) => g.id === groupId);
      if (!target || target.sortMode !== 'custom') return;
      persistGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, manualOrder: [...orderedIds] } : g)),
      );
    },
    [persistGroups],
  );

  const reorderGroups = useCallback(
    (orderedCustomIds: string[]) => {
      const base = 100;
      const step = 10;
      const orderMap = new Map<string, number>();
      orderedCustomIds.forEach((id, i) => orderMap.set(id, base + i * step));
      persistGroups((prev) =>
        prev.map((g) => {
          if (g.kind !== 'custom') return g;
          const o = orderMap.get(g.id);
          return o !== undefined ? { ...g, order: o } : g;
        }),
      );
    },
    [persistGroups],
  );

  const toggleFavorite = useCallback(
    (siteId: number) => {
      const currentMembership = membershipRef.current;
      const currentGroups = groupsRef.current;
      const current = currentMembership[siteId] ?? SITES_ID;
      if (current === FAVORITES_ID) {
        const last = readLastGroup(siteId);
        const target =
          last && currentGroups.some((g) => g.id === last) ? last : SITES_ID;
        moveSite(siteId, target);
      } else {
        moveSite(siteId, FAVORITES_ID);
      }
    },
    [moveSite, readLastGroup],
  );

  // Persist an initial valid state if migration produced defaults without members.
  useEffect(() => {
    if (!localStorage.getItem(GROUPS_KEY)) {
      writeJSON(GROUPS_KEY, groups);
    }
  }, [groups]);

  return {
    groups,
    membership,
    starredIds,
    sitesByGroup,
    visibleGroups,
    flatVisibleSites,
    createGroup,
    renameGroup,
    deleteGroup,
    setSort,
    toggleCollapse,
    toggleShowUnread,
    toggleAllCollapsed,
    moveSite,
    reorderSitesInGroup,
    reorderGroups,
    toggleFavorite,
  };
}

export const FAVORITES_GROUP_ID = FAVORITES_ID;
export const SITES_GROUP_ID = SITES_ID;

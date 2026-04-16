import { useEffect, useState } from 'react';

/**
 * Read starredIds — the set of sites in the Favorites group.
 *
 * The source of truth is the sidebar-groups membership record written by
 * `useSidebarGroups`. This hook subscribes via `storage` events so cross-
 * tab updates (or any other part of the app that writes membership)
 * propagate back here — primarily used by the sync engine to decide which
 * sites to prioritise.
 */

const MEMBERSHIP_KEY = 'cortex_sidebar_membership';
const OLD_STARRED_KEY = 'cortex_starred_sites';
const FAVORITES_ID = 'favorites';

function read(): Set<number> {
  try {
    const raw = localStorage.getItem(MEMBERSHIP_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, string>;
      const ids = new Set<number>();
      for (const [id, group] of Object.entries(map)) {
        if (group === FAVORITES_ID) ids.add(Number(id));
      }
      return ids;
    }
    // Fallback: if the new storage isn't populated yet, read the legacy key.
    const legacy = localStorage.getItem(OLD_STARRED_KEY);
    return legacy ? new Set(JSON.parse(legacy)) : new Set();
  } catch {
    return new Set();
  }
}

export function useStarredSites() {
  const [ids, setIds] = useState<Set<number>>(read);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === MEMBERSHIP_KEY || e.key === OLD_STARRED_KEY || e.key === null) {
        setIds(read());
      }
    }
    window.addEventListener('storage', onStorage);
    // `storage` events only fire across tabs; poll once on focus for same-tab
    // updates initiated by `useSidebarGroups`.
    function onFocus() {
      setIds(read());
    }
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return { starredIds: ids };
}

import { useState, useCallback } from 'react';

const KEY = 'cortex_starred_sites';

function read(): Set<number> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function useStarredSites() {
  const [ids, setIds] = useState<Set<number>>(read);

  const toggleStar = useCallback((id: number) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { starredIds: ids, toggleStar };
}

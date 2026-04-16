import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useRouteState } from './useRouteState';

function wrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

describe('useRouteState', () => {
  describe('URL parsing', () => {
    it('parses / as empty state', () => {
      const { result } = renderHook(() => useRouteState(), {
        wrapper: wrapper(['/']),
      });
      expect(result.current.selectedSiteId).toBeNull();
      expect(result.current.detailSiteId).toBeNull();
      expect(result.current.detailPostId).toBeNull();
      expect(result.current.hasDetail).toBe(false);
    });

    it('parses /site/:siteId', () => {
      const { result } = renderHook(() => useRouteState(), {
        wrapper: wrapper(['/site/123']),
      });
      expect(result.current.selectedSiteId).toBe(123);
      expect(result.current.detailSiteId).toBeNull();
      expect(result.current.detailPostId).toBeNull();
      expect(result.current.hasDetail).toBe(false);
    });

    it('parses /site/:siteId/post/:postId', () => {
      const { result } = renderHook(() => useRouteState(), {
        wrapper: wrapper(['/site/123/post/456']),
      });
      expect(result.current.selectedSiteId).toBe(123);
      expect(result.current.detailSiteId).toBe(123);
      expect(result.current.detailPostId).toBe(456);
      expect(result.current.hasDetail).toBe(true);
    });

    it('returns null for invalid site ID', () => {
      const { result } = renderHook(() => useRouteState(), {
        wrapper: wrapper(['/site/abc']),
      });
      expect(result.current.selectedSiteId).toBeNull();
    });

    it('returns null for zero site ID', () => {
      const { result } = renderHook(() => useRouteState(), {
        wrapper: wrapper(['/site/0']),
      });
      expect(result.current.selectedSiteId).toBeNull();
    });

    it('returns null for negative site ID', () => {
      const { result } = renderHook(() => useRouteState(), {
        wrapper: wrapper(['/site/-5']),
      });
      expect(result.current.selectedSiteId).toBeNull();
    });
  });

  describe('navigation functions', () => {
    it('selectSite navigates to /site/:id', () => {
      const { result } = renderHook(() => useRouteState(), {
        wrapper: wrapper(['/']),
      });
      act(() => result.current.selectSite(42));
      expect(result.current.selectedSiteId).toBe(42);
    });

    it('selectPost from site context navigates to /site/:siteId/post/:postId', () => {
      const { result } = renderHook(() => useRouteState(), {
        wrapper: wrapper(['/site/10']),
      });
      act(() => result.current.selectPost(10, 99));
      expect(result.current.selectedSiteId).toBe(10);
      expect(result.current.detailSiteId).toBe(10);
      expect(result.current.detailPostId).toBe(99);
      expect(result.current.hasDetail).toBe(true);
    });

    it('selectPost for x-post keeps current site selected', () => {
      const { result } = renderHook(() => useRouteState(), {
        wrapper: wrapper(['/site/100']),
      });
      // x-post: viewing site 100, clicking x-post that originates on site 200
      act(() => result.current.selectPost(200, 999));
      expect(result.current.selectedSiteId).toBe(100);
      expect(result.current.detailSiteId).toBe(200);
      expect(result.current.detailPostId).toBe(999);
    });

    it('closeDetail from site+post goes to site', () => {
      const { result } = renderHook(() => useRouteState(), {
        wrapper: wrapper(['/site/123/post/456']),
      });
      act(() => result.current.closeDetail());
      expect(result.current.selectedSiteId).toBe(123);
      expect(result.current.hasDetail).toBe(false);
    });

    it('goHome navigates to /', () => {
      const { result } = renderHook(() => useRouteState(), {
        wrapper: wrapper(['/site/123/post/456']),
      });
      act(() => result.current.goHome());
      expect(result.current.selectedSiteId).toBeNull();
      expect(result.current.hasDetail).toBe(false);
    });
  });
});

import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type SpecialView = 'unread' | 'liked';

interface RouteState {
  selectedSiteId: number | null;
  detailSiteId: number | null;
  detailPostId: number | null;
  specialView: SpecialView | null;
  hasDetail: boolean;

  selectSite: (siteId: number) => void;
  selectPost: (siteId: number, postId: number) => void;
  selectSpecialView: (view: SpecialView) => void;
  closeDetail: () => void;
  goHome: () => void;
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function useRouteState(): RouteState {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const state = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    // parts examples:
    //   /                        → []
    //   /site/123                → ['site', '123']
    //   /site/123/post/456      → ['site', '123', 'post', '456']
    //   /unread                  → ['unread']
    //   /unread/post/789/456    → ['unread', 'post', '789', '456']
    //   /liked                   → ['liked']
    //   /liked/post/789/456     → ['liked', 'post', '789', '456']

    let selectedSiteId: number | null = null;
    let detailSiteId: number | null = null;
    let detailPostId: number | null = null;
    let specialView: SpecialView | null = null;

    if (parts[0] === 'site') {
      selectedSiteId = parsePositiveInt(parts[1]);
      if (parts[2] === 'post') {
        detailSiteId = selectedSiteId;
        detailPostId = parsePositiveInt(parts[3]);
      }
    } else if (parts[0] === 'unread') {
      specialView = 'unread';
      if (parts[1] === 'post') {
        detailSiteId = parsePositiveInt(parts[2]);
        detailPostId = parsePositiveInt(parts[3]);
      }
    } else if (parts[0] === 'liked') {
      specialView = 'liked';
      if (parts[1] === 'post') {
        detailSiteId = parsePositiveInt(parts[2]);
        detailPostId = parsePositiveInt(parts[3]);
      }
    }

    return {
      selectedSiteId,
      detailSiteId,
      detailPostId,
      specialView,
      hasDetail: detailPostId !== null,
    };
  }, [pathname]);

  const selectSite = useCallback((siteId: number) => navigate(`/site/${siteId}`), [navigate]);

  const selectPost = useCallback(
    (siteId: number, postId: number) => {
      if (state.specialView) {
        navigate(`/${state.specialView}/post/${siteId}/${postId}`);
      } else {
        navigate(`/site/${siteId}/post/${postId}`);
      }
    },
    [navigate, state.specialView],
  );

  const selectSpecialView = useCallback((view: SpecialView) => navigate(`/${view}`), [navigate]);

  const closeDetail = useCallback(() => {
    if (state.specialView) {
      navigate(`/${state.specialView}`);
    } else if (state.selectedSiteId) {
      navigate(`/site/${state.selectedSiteId}`);
    } else {
      navigate('/');
    }
  }, [navigate, state.specialView, state.selectedSiteId]);

  const goHome = useCallback(() => navigate('/'), [navigate]);

  return {
    ...state,
    selectSite,
    selectPost,
    selectSpecialView,
    closeDetail,
    goHome,
  };
}

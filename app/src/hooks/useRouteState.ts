import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface RouteState {
  selectedSiteId: number | null;
  detailSiteId: number | null;
  detailPostId: number | null;
  hasDetail: boolean;
  isHome: boolean;
  isSavedView: boolean;

  selectSite: (siteId: number) => void;
  selectPost: (siteId: number, postId: number) => void;
  closeDetail: () => void;
  goHome: () => void;
  goSaved: () => void;
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
    //   /post/10/99              → ['post', '10', '99']
    //   /site/123                → ['site', '123']
    //   /site/123/post/456      → ['site', '123', 'post', '456']

    let selectedSiteId: number | null = null;
    let detailSiteId: number | null = null;
    let detailPostId: number | null = null;
    let isSavedView = false;

    if (parts[0] === 'saved') {
      isSavedView = true;
      // /saved/post/{siteId}/{postId} — viewing a saved item's detail
      if (parts[1] === 'post' && parts.length >= 4) {
        detailSiteId = parsePositiveInt(parts[2]);
        detailPostId = parsePositiveInt(parts[3]);
      }
    } else if (parts[0] === 'post' && parts.length >= 3) {
      // /post/{siteId}/{postId} — home-context detail
      detailSiteId = parsePositiveInt(parts[1]);
      detailPostId = parsePositiveInt(parts[2]);
    } else if (parts[0] === 'site') {
      selectedSiteId = parsePositiveInt(parts[1]);
      if (parts[2] === 'post') {
        if (parts.length >= 5) {
          // /site/{selected}/post/{detailSite}/{detailPost} — x-post or cross-site detail
          detailSiteId = parsePositiveInt(parts[3]);
          detailPostId = parsePositiveInt(parts[4]);
        } else {
          // /site/{selected}/post/{postId} — same-site detail
          detailSiteId = selectedSiteId;
          detailPostId = parsePositiveInt(parts[3]);
        }
      }
    }

    const isHome = selectedSiteId === null && !isSavedView;

    return {
      selectedSiteId,
      detailSiteId,
      detailPostId,
      hasDetail: detailPostId !== null,
      isHome,
      isSavedView,
    };
  }, [pathname]);

  const selectSite = useCallback((siteId: number) => navigate(`/site/${siteId}`), [navigate]);

  const selectPost = useCallback(
    (siteId: number, postId: number) => {
      if (state.isSavedView) {
        navigate(`/saved/post/${siteId}/${postId}`);
      } else if (state.isHome) {
        navigate(`/post/${siteId}/${postId}`);
      } else if (state.selectedSiteId && siteId !== state.selectedSiteId) {
        // Cross-site detail (e.g. x-post): keep current site selected
        navigate(`/site/${state.selectedSiteId}/post/${siteId}/${postId}`);
      } else {
        navigate(`/site/${siteId}/post/${postId}`);
      }
    },
    [navigate, state.selectedSiteId, state.isSavedView, state.isHome],
  );

  const closeDetail = useCallback(() => {
    if (state.isSavedView) {
      navigate('/saved');
    } else if (state.selectedSiteId) {
      navigate(`/site/${state.selectedSiteId}`);
    } else {
      navigate('/');
    }
  }, [navigate, state.selectedSiteId, state.isSavedView]);

  const goHome = useCallback(() => navigate('/'), [navigate]);
  const goSaved = useCallback(() => navigate('/saved'), [navigate]);

  return {
    ...state,
    selectSite,
    selectPost,
    closeDetail,
    goHome,
    goSaved,
  };
}

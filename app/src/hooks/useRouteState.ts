import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface RouteState {
  selectedSiteId: number | null;
  detailSiteId: number | null;
  detailPostId: number | null;
  hasDetail: boolean;

  selectSite: (siteId: number) => void;
  selectPost: (siteId: number, postId: number) => void;
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

    let selectedSiteId: number | null = null;
    let detailSiteId: number | null = null;
    let detailPostId: number | null = null;

    if (parts[0] === 'site') {
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

    return {
      selectedSiteId,
      detailSiteId,
      detailPostId,
      hasDetail: detailPostId !== null,
    };
  }, [pathname]);

  const selectSite = useCallback((siteId: number) => navigate(`/site/${siteId}`), [navigate]);

  const selectPost = useCallback(
    (siteId: number, postId: number) => {
      if (state.selectedSiteId && siteId !== state.selectedSiteId) {
        // Cross-site detail (e.g. x-post): keep current site selected
        navigate(`/site/${state.selectedSiteId}/post/${siteId}/${postId}`);
      } else {
        navigate(`/site/${siteId}/post/${postId}`);
      }
    },
    [navigate, state.selectedSiteId],
  );

  const closeDetail = useCallback(() => {
    if (state.selectedSiteId) {
      navigate(`/site/${state.selectedSiteId}`);
    } else {
      navigate('/');
    }
  }, [navigate, state.selectedSiteId]);

  const goHome = useCallback(() => navigate('/'), [navigate]);

  return {
    ...state,
    selectSite,
    selectPost,
    closeDetail,
    goHome,
  };
}

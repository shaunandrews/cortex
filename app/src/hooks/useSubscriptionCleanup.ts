import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useP2Sites } from './useP2Sites';
import { useFollowing } from './useFollowing';
import { useStarredSites } from './useStarredSites';
import { getSharedStore } from '../sync/store';
import { getAISiteSuggestions, unfollowSite, type SiteSuggestion } from '../api/wpcom';
import type { WPComSite, WPComSubscription } from '../api/types';
import type { LightweightPost } from '../sync/protocol';

function decodeEntities(text: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

function buildSiteProfile(
  site: WPComSite,
  sub: WPComSubscription | undefined,
  posts: LightweightPost[],
  seenKeys: Set<string>,
  isFavorited: boolean,
): string {
  const name = decodeEntities(site.name);
  const recentPosts = posts
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  const newestDate = recentPosts[0]?.date ?? 'unknown';
  const daysSincePost = recentPosts[0]
    ? Math.floor((Date.now() - new Date(recentPosts[0].date).getTime()) / 86400000)
    : 'unknown';
  const seenCount = posts.filter((p) => seenKeys.has(`${site.ID}-${p.ID}`)).length;
  const likedCount = posts.filter((p) => p.i_like).length;
  const titles = recentPosts.map((p) => decodeEntities(p.title)).join(' | ');

  return [
    `SITE: ${name} (ID: ${site.ID})`,
    `  subscribers: ${site.subscribers_count ?? '?'}, total posts: ${site.post_count ?? '?'}`,
    `  last post: ${newestDate} (${daysSincePost} days ago)`,
    `  unseen: ${sub?.unseen_count ?? 0}, user read: ${seenCount}/${posts.length}, liked: ${likedCount}`,
    `  favorited: ${isFavorited}, deleted: ${site.is_deleted ?? false}, private: ${site.is_private ?? false}`,
    `  recent titles: ${titles || 'none'}`,
  ].join('\n');
}

const SYSTEM_PROMPT = `You analyze a user's P2 site subscriptions and identify sites they should consider unfollowing. Consider these signals:
- Site has been deleted or is inactive (no posts in months)
- Low subscriber count suggesting the site was abandoned
- User never reads or engages with the site's posts
- Content topics don't seem relevant based on recent post titles
- Site is private and may no longer be accessible

Return a JSON array of suggestions. Each item must have:
- "siteId": number (the site ID)
- "siteName": string
- "reason": string (1-2 sentences explaining why, be specific)
- "confidence": "high" | "medium" | "low"

Order by confidence (high first). Only include sites worth suggesting — if everything looks healthy, return an empty array. Output ONLY the JSON array, no other text.`;

export function useSubscriptionCleanup() {
  const { token } = useAuth();
  const { data: sites } = useP2Sites();
  const { data: following } = useFollowing();
  const { starredIds } = useStarredSites();
  const queryClient = useQueryClient();
  const controllerRef = useRef<AbortController | null>(null);

  const [suggestions, setSuggestions] = useState<SiteSuggestion[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (!token || !sites?.length || !following?.length) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    setError(null);
    setSuggestions(null);

    try {
      const store = getSharedStore();
      const seenKeys = await store.getSeenPostIds();

      // Build a subscription lookup
      const subMap = new Map<number, WPComSubscription>();
      for (const sub of following) {
        subMap.set(Number(sub.blog_ID), sub);
      }

      // Only analyze sites the user is following
      const followedSites = sites.filter((s) => subMap.has(s.ID));

      // Gather posts from IDB for each site
      const profiles: string[] = [];
      for (const site of followedSites) {
        const posts = await store.getPostsBySite(site.ID);
        const sub = subMap.get(site.ID);
        const profile = buildSiteProfile(site, sub, posts, seenKeys, starredIds.has(site.ID));
        profiles.push(profile);
      }

      const userContent = `I follow ${followedSites.length} P2 sites. Here is data for each:\n\n${profiles.join('\n\n')}`;

      const results = await getAISiteSuggestions(
        token,
        SYSTEM_PROMPT,
        userContent,
        controller.signal,
      );

      setSuggestions(results);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError('Failed to analyze subscriptions.');
    } finally {
      setIsLoading(false);
    }
  }, [token, sites, following, starredIds]);

  const unfollow = useCallback(
    async (siteId: number) => {
      if (!token) return;
      try {
        await unfollowSite(token, siteId);
        // Remove from suggestions list
        setSuggestions((prev) => prev?.filter((s) => s.siteId !== siteId) ?? null);
        // Invalidate following data so the sidebar updates
        queryClient.invalidateQueries({ queryKey: ['following'] });
        queryClient.invalidateQueries({ queryKey: ['p2-sites'] });
      } catch {
        // Silently fail — the button can be retried
      }
    },
    [token, queryClient],
  );

  const dismiss = useCallback((siteId: number) => {
    setSuggestions((prev) => prev?.filter((s) => s.siteId !== siteId) ?? null);
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setSuggestions(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return { suggestions, isLoading, error, analyze, unfollow, dismiss, reset };
}

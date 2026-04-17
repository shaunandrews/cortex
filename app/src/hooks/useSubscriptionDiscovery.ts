import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useP2Sites } from './useP2Sites';
import { useFollowing } from './useFollowing';
import { getSharedStore } from '../sync/store';
import { getAISiteSuggestions, followSite, type SiteSuggestion } from '../api/wpcom';
import type { WPComSite } from '../api/types';
import type { LightweightPost } from '../sync/protocol';

function decodeEntities(text: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

function buildUnfollowedSiteProfile(site: WPComSite, posts: LightweightPost[]): string {
  const name = decodeEntities(site.name);
  const recentPosts = posts
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  const newestDate = recentPosts[0]?.date ?? 'unknown';
  const daysSincePost = recentPosts[0]
    ? Math.floor((Date.now() - new Date(recentPosts[0].date).getTime()) / 86400000)
    : 'unknown';
  const titles = recentPosts.map((p) => decodeEntities(p.title)).join(' | ');

  return [
    `SITE: ${name} (ID: ${site.ID})`,
    `  description: ${decodeEntities(site.description || 'none')}`,
    `  subscribers: ${site.subscribers_count ?? '?'}, total posts: ${site.post_count ?? '?'}`,
    `  last post: ${newestDate} (${daysSincePost} days ago)`,
    `  deleted: ${site.is_deleted ?? false}, private: ${site.is_private ?? false}`,
    `  recent titles: ${titles || 'none'}`,
  ].join('\n');
}

function buildFollowedSiteSummary(sites: WPComSite[]): string {
  return sites
    .slice(0, 30)
    .map((s) => decodeEntities(s.name))
    .join(', ');
}

const SYSTEM_PROMPT = `You analyze P2 sites that a user is a member of but doesn't currently follow, and recommend which ones they should subscribe to. Consider:
- Is the site actively posting? (recent posts, reasonable frequency)
- Does it have enough subscribers to suggest it's useful?
- Does the content seem relevant based on post titles and the sites the user already follows?
- Is it deleted or private? (skip these)

Return a JSON array of recommendations. Each item must have:
- "siteId": number (the site ID)
- "siteName": string
- "reason": string (1-2 sentences explaining why this site is worth following, be specific about the content)
- "confidence": "high" | "medium" | "low"

Order by confidence (high first). Only include sites genuinely worth following — active, relevant, and accessible. Output ONLY the JSON array, no other text.`;

export function useSubscriptionDiscovery() {
  const { token } = useAuth();
  const { data: sites } = useP2Sites();
  const { data: following } = useFollowing();
  const queryClient = useQueryClient();
  const controllerRef = useRef<AbortController | null>(null);

  const [suggestions, setSuggestions] = useState<SiteSuggestion[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (!token || !sites?.length) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    setError(null);
    setSuggestions(null);

    try {
      // Build a set of followed site IDs
      const followedIds = new Set<number>();
      if (following) {
        for (const sub of following) {
          followedIds.add(Number(sub.blog_ID));
        }
      }

      // Find P2 sites the user is a member of but doesn't follow
      const unfollowedSites = sites.filter((s) => !followedIds.has(s.ID) && !s.is_deleted);

      if (unfollowedSites.length === 0) {
        setSuggestions([]);
        setIsLoading(false);
        return;
      }

      // Try to get cached posts for these sites (may be sparse since we don't sync unfollowed sites)
      const store = getSharedStore();
      const profiles: string[] = [];
      for (const site of unfollowedSites) {
        const posts = await store.getPostsBySite(site.ID);
        profiles.push(buildUnfollowedSiteProfile(site, posts));
      }

      // Include what the user already follows for context
      const followedSites = sites.filter((s) => followedIds.has(s.ID));
      const followedContext = buildFollowedSiteSummary(followedSites);

      const userContent = [
        `The user currently follows these P2 sites: ${followedContext}`,
        '',
        `Here are ${unfollowedSites.length} P2 sites they are a member of but DON'T follow:`,
        '',
        profiles.join('\n\n'),
      ].join('\n');

      const results = await getAISiteSuggestions(
        token,
        SYSTEM_PROMPT,
        userContent,
        controller.signal,
      );

      setSuggestions(results);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError('Failed to find suggestions.');
    } finally {
      setIsLoading(false);
    }
  }, [token, sites, following]);

  const follow = useCallback(
    async (siteId: number) => {
      if (!token) return;
      try {
        await followSite(token, siteId);
        setSuggestions((prev) => prev?.filter((s) => s.siteId !== siteId) ?? null);
        queryClient.invalidateQueries({ queryKey: ['following'] });
        queryClient.invalidateQueries({ queryKey: ['p2-sites'] });
      } catch {
        // Silently fail — can retry
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

  return { suggestions, isLoading, error, analyze, follow, dismiss, reset };
}

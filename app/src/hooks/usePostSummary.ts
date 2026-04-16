/* eslint-disable react-hooks/set-state-in-effect -- streaming AI summary needs to reset + accumulate state from within the effect */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { streamAISummary } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.trim() || '';
}

export function usePostSummary(siteId: number, postId: number, content: string | undefined) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [streamedSummary, setStreamedSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const activeRef = useRef('');

  const cacheKey = useMemo(() => ['post-summary', siteId, postId], [siteId, postId]);
  const cached = queryClient.getQueryData<string>(cacheKey);

  useEffect(() => {
    if (!token || !content || postId <= 0 || siteId <= 0) return;
    if (cached) return; // Already have a summary

    const key = `${siteId}-${postId}`;
    if (activeRef.current === key) return;

    activeRef.current = key;
    setStreamedSummary('');
    setIsLoading(true);

    const controller = new AbortController();

    streamAISummary(
      token,
      stripHtml(content),
      (chunk) => setStreamedSummary((prev) => prev + chunk),
      controller.signal,
    )
      .then((full) => {
        queryClient.setQueryData(cacheKey, full);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [token, siteId, postId, content, cached, cacheKey, queryClient]);

  const regenerate = useCallback(() => {
    if (!token || !content || postId <= 0 || siteId <= 0) return;
    queryClient.removeQueries({ queryKey: cacheKey });
    activeRef.current = '';
    setStreamedSummary('');
    setIsLoading(true);

    const controller = new AbortController();
    streamAISummary(
      token,
      stripHtml(content),
      (chunk) => setStreamedSummary((prev) => prev + chunk),
      controller.signal,
    )
      .then((full) => {
        queryClient.setQueryData(cacheKey, full);
        activeRef.current = `${siteId}-${postId}`;
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setIsLoading(false);
        }
      });
  }, [token, siteId, postId, content, cacheKey, queryClient]);

  return { summary: cached ?? streamedSummary, isLoading, regenerate };
}

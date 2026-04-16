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
  const [error, setError] = useState<string | null>(null);

  // Generation counter prevents stale chunks from updating state.
  // Each new request (effect or regenerate) increments this; chunk callbacks
  // only write if their captured generation still matches current.
  const generationRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const cacheKey = useMemo(() => ['post-summary', siteId, postId], [siteId, postId]);
  const cached = queryClient.getQueryData<string>(cacheKey);

  useEffect(() => {
    if (!token || !content || postId <= 0 || siteId <= 0) return;
    if (cached) return;

    // Abort any in-flight request (effect or regenerate)
    controllerRef.current?.abort();

    const gen = ++generationRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;

    setStreamedSummary('');
    setError(null);
    setIsLoading(true);

    streamAISummary(
      token,
      stripHtml(content),
      (chunk) => {
        if (generationRef.current !== gen) return;
        setStreamedSummary((prev) => prev + chunk);
      },
      controller.signal,
    )
      .then((full) => {
        if (generationRef.current !== gen) return;
        queryClient.setQueryData(cacheKey, full);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (generationRef.current !== gen) return;
        setError('Summary failed to generate.');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [token, siteId, postId, content, cached, cacheKey, queryClient]);

  const regenerate = useCallback(() => {
    if (!token || !content || postId <= 0 || siteId <= 0) return;

    // Abort any in-flight request
    controllerRef.current?.abort();

    const gen = ++generationRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;

    queryClient.removeQueries({ queryKey: cacheKey });
    setStreamedSummary('');
    setError(null);
    setIsLoading(true);

    streamAISummary(
      token,
      stripHtml(content),
      (chunk) => {
        if (generationRef.current !== gen) return;
        setStreamedSummary((prev) => prev + chunk);
      },
      controller.signal,
    )
      .then((full) => {
        if (generationRef.current !== gen) return;
        queryClient.setQueryData(cacheKey, full);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (generationRef.current !== gen) return;
        setError('Summary failed to generate.');
        setIsLoading(false);
      });
  }, [token, siteId, postId, content, cacheKey, queryClient]);

  return { summary: cached ?? streamedSummary, isLoading, error, regenerate };
}

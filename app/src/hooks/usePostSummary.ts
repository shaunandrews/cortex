import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { streamAISummary } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';
import { getSharedStore } from '../sync/store';

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.trim() || '';
}

// Minimum plaintext length (chars) before generating a summary.
// Posts shorter than this are quick enough to read without one.
const MIN_CONTENT_LENGTH = 500;

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

  const strippedContent = useMemo(() => (content ? stripHtml(content) : ''), [content]);
  const isTooShort = strippedContent.length < MIN_CONTENT_LENGTH;

  // Check IDB for a persisted summary, then generate if none exists.
  // Single effect avoids the race between async IDB hydration and streaming.
  useEffect(() => {
    if (!token || !content || postId <= 0 || siteId <= 0) return;
    if (cached || isTooShort) return;

    const gen = ++generationRef.current;

    // Check IndexedDB first — may already have a cached summary from a previous session.
    // If IDB fails, fall through to generation.
    const generate = () => {
      if (generationRef.current !== gen) return;

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setStreamedSummary('');
      setError(null);
      setIsLoading(true);

      streamAISummary(
        token,
        strippedContent,
        (chunk) => {
          if (generationRef.current !== gen) return;
          setStreamedSummary((prev) => prev + chunk);
        },
        controller.signal,
      )
        .then((full) => {
          if (generationRef.current !== gen) return;
          queryClient.setQueryData(cacheKey, full);
          getSharedStore()
            .putSummary(siteId, postId, full)
            .catch(() => {});
          setIsLoading(false);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          if (generationRef.current !== gen) return;
          setError('Summary failed to generate.');
          setIsLoading(false);
        });
    };

    getSharedStore()
      .getSummary(siteId, postId)
      .then((persisted) => {
        if (generationRef.current !== gen) return;
        if (persisted) {
          queryClient.setQueryData(cacheKey, persisted);
        } else {
          generate();
        }
      })
      .catch(() => {
        // IDB unavailable — generate anyway
        generate();
      });

    return () => {
      controllerRef.current?.abort();
    };
  }, [token, siteId, postId, content, cached, isTooShort, strippedContent, cacheKey, queryClient]);

  const regenerate = useCallback(() => {
    if (!token || !content || postId <= 0 || siteId <= 0 || isTooShort) return;

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
      strippedContent,
      (chunk) => {
        if (generationRef.current !== gen) return;
        setStreamedSummary((prev) => prev + chunk);
      },
      controller.signal,
    )
      .then((full) => {
        if (generationRef.current !== gen) return;
        queryClient.setQueryData(cacheKey, full);
        getSharedStore().putSummary(siteId, postId, full);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (generationRef.current !== gen) return;
        setError('Summary failed to generate.');
        setIsLoading(false);
      });
  }, [token, siteId, postId, content, isTooShort, strippedContent, cacheKey, queryClient]);

  return { summary: cached ?? streamedSummary, isLoading, error, regenerate };
}

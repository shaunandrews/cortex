import { useEffect, useState } from 'react';
import { checkSlugAvailable } from '../api/wpcom';
import { validateSlugShape } from '../lib/slug';
import { useAuth } from '../auth/AuthContext';

export type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export interface SlugAvailability {
  status: SlugStatus;
  message?: string;
}

interface AsyncResult {
  slug: string;
  status: 'available' | 'taken';
  message?: string;
}

const DEBOUNCE_MS = 400;

/**
 * Debounced WP.com subdomain availability check.
 *
 * Shape validation runs synchronously on every keystroke; the network
 * probe (`/rest/v1.1/sites/<slug>.wordpress.com`) runs 400ms after the
 * user stops typing. Network failures fall through to "available" so
 * the user can still submit — submit-time validation catches any real
 * conflict.
 */
export function useSlugAvailability(slug: string): SlugAvailability {
  const { token } = useAuth();
  const [async, setAsync] = useState<AsyncResult | null>(null);

  useEffect(() => {
    if (!token || slug.length === 0) return;
    const shape = validateSlugShape(slug);
    if (!shape.ok) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await checkSlugAvailable(token, slug);
        if (cancelled) return;
        if (result === 'taken') {
          setAsync({ slug, status: 'taken', message: 'That address is already taken.' });
        } else {
          setAsync({ slug, status: 'available' });
        }
      } catch {
        if (cancelled) return;
        setAsync({ slug, status: 'available' });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, token]);

  if (slug.length === 0) return { status: 'idle' };
  const shape = validateSlugShape(slug);
  if (!shape.ok) return { status: 'invalid', message: shape.message };
  if (!async || async.slug !== slug) return { status: 'checking' };
  return { status: async.status, message: async.message };
}

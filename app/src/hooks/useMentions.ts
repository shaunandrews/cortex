import { useMemo } from 'react';
import { useNotifications } from './useNotifications';
import type { WPComNotification } from '../api/types';

/**
 * Returns notifications where the user was @-mentioned,
 * sorted by timestamp descending (newest first).
 */
export function useMentions() {
  const { data: notifications, ...rest } = useNotifications();

  const mentions = useMemo(() => {
    if (!notifications) return [];
    return notifications
      .filter((n: WPComNotification) => n.type === 'mention' || n.type === 'automattcher')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notifications]);

  return { data: mentions, ...rest };
}

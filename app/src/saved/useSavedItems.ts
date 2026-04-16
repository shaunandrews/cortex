import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllSavedItems,
  getAllSavedGroups,
  addSavedItem,
  deleteSavedItem,
  findSavedItem,
  updateSavedItemGroup,
  addSavedGroup,
  updateSavedGroup,
  deleteSavedGroup,
} from './store';
import type { SavedGroup, PostSnapshot, CommentSnapshot } from './types';
import type { WPComPost, WPComComment } from '../api/types';

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useSavedItems() {
  return useQuery({
    queryKey: ['saved-items'],
    queryFn: getAllSavedItems,
  });
}

export function useSavedGroups() {
  return useQuery({
    queryKey: ['saved-groups'],
    queryFn: getAllSavedGroups,
  });
}

/**
 * Returns a Set of keys like "post:123:456" or "comment:123:456:789"
 * for quick lookup of whether an item is already saved.
 */
export function useSavedLookup() {
  const { data: items } = useSavedItems();
  const lookup = new Map<string, number>();
  if (items) {
    for (const item of items) {
      const key =
        item.type === 'post'
          ? `post:${item.siteId}:${item.postId}`
          : `comment:${item.siteId}:${item.postId}:${item.commentId}`;
      if (item.id != null) lookup.set(key, item.id);
    }
  }
  return lookup;
}

// ---------------------------------------------------------------------------
// Save / unsave mutations
// ---------------------------------------------------------------------------

function extractTags(post: WPComPost): string[] {
  const tags: string[] = [];
  if (post.tags) {
    for (const t of Object.values(post.tags)) tags.push(t.name);
  }
  if (post.categories) {
    for (const c of Object.values(post.categories)) tags.push(c.name);
  }
  return tags;
}

export function useSavePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      post,
      siteName,
      siteURL,
    }: {
      post: WPComPost;
      siteName: string;
      siteURL: string;
    }) => {
      const existing = await findSavedItem('post', post.site_ID, post.ID, null);
      if (existing) return existing.id!;
      const snapshot: PostSnapshot = {
        title: post.title,
        content: post.content ?? '',
        excerpt: post.excerpt ?? '',
        authorName: post.author.name,
        authorAvatar: post.author.avatar_URL,
        siteName,
        siteURL,
        postURL: post.URL,
        date: post.date,
      };
      return addSavedItem({
        type: 'post',
        siteId: post.site_ID,
        postId: post.ID,
        commentId: null,
        groupId: null,
        savedAt: Date.now(),
        snapshot,
        tags: extractTags(post),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-items'] }),
    onError: (err) => console.error('[useSavePost] mutation failed:', err),
  });
}

export function useSaveComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      comment,
      post,
      siteName,
      siteURL,
    }: {
      comment: WPComComment;
      post: WPComPost;
      siteName: string;
      siteURL: string;
    }) => {
      const existing = await findSavedItem('comment', post.site_ID, post.ID, comment.ID);
      if (existing) return existing.id!;
      const snapshot: CommentSnapshot = {
        content: comment.content,
        authorName: comment.author.name,
        authorAvatar: comment.author.avatar_URL,
        postTitle: post.title,
        siteName,
        siteURL,
        postURL: post.URL,
        date: comment.date,
      };
      return addSavedItem({
        type: 'comment',
        siteId: post.site_ID,
        postId: post.ID,
        commentId: comment.ID,
        groupId: null,
        savedAt: Date.now(),
        snapshot,
        tags: extractTags(post),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-items'] }),
  });
}

export function useUnsaveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSavedItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-items'] }),
  });
}

// ---------------------------------------------------------------------------
// Group mutations
// ---------------------------------------------------------------------------

export function useMoveToGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, groupId }: { itemId: number; groupId: number | null }) =>
      updateSavedItemGroup(itemId, groupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-items'] }),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const groups = await getAllSavedGroups();
      const maxPos = groups.reduce((max, g) => Math.max(max, g.position), 0);
      return addSavedGroup({
        name,
        createdAt: Date.now(),
        position: maxPos + 1,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-groups'] }),
  });
}

export function useRenameGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ group, name }: { group: SavedGroup; name: string }) => {
      await updateSavedGroup({ ...group, name });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-groups'] }),
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSavedGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-groups'] });
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },
  });
}

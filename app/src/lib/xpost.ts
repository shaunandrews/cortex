import type { WPComPost } from '../api/types';

export interface XPostOrigin {
  blogId: number;
  postId: number;
  permalink: string;
}

export function isXPost(post: WPComPost): boolean {
  return !!post.tags?.['p2-xpost'];
}

export function getXPostOrigin(post: WPComPost): XPostOrigin | null {
  if (!isXPost(post) || !post.metadata) return null;

  let blogId = 0;
  let postId = 0;
  let permalink = '';

  for (const meta of post.metadata) {
    if (meta.key === 'xpost_origin') {
      const parts = meta.value.split(':');
      blogId = Number(parts[0]);
      postId = Number(parts[1]);
    }
    if (meta.key === '_xpost_original_permalink') {
      permalink = meta.value;
    }
  }

  if (blogId > 0 && postId > 0) return { blogId, postId, permalink };
  return null;
}

export function cleanXPostTitle(title: string): string {
  return title.replace(/^X-(?:post|comment):\s*/i, '');
}

export function parseXPostSource(excerpt: string): string | null {
  const match = excerpt.match(/from \+(\S+?):/);
  return match ? match[1] : null;
}

export interface PostSnapshot {
  title: string;
  content: string;
  excerpt: string;
  authorName: string;
  authorAvatar: string;
  siteName: string;
  siteURL: string;
  postURL: string;
  date: string;
}

export interface CommentSnapshot {
  content: string;
  authorName: string;
  authorAvatar: string;
  postTitle: string;
  siteName: string;
  siteURL: string;
  postURL: string;
  date: string;
}

export type SavedItemSnapshot = PostSnapshot | CommentSnapshot;

export interface SavedItem {
  id?: number; // auto-increment, undefined before insert
  type: 'post' | 'comment';
  siteId: number;
  postId: number;
  commentId: number | null;
  groupId: number | null;
  savedAt: number;
  snapshot: SavedItemSnapshot;
  tags: string[];
  x?: number; // canvas position
  y?: number;
}

export interface SavedGroup {
  id?: number; // auto-increment, undefined before insert
  name: string;
  createdAt: number;
  position: number;
}

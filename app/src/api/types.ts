export interface WPComUser {
  ID: number;
  display_name: string;
  username: string;
  email: string;
  avatar_URL: string;
  profile_URL: string;
  site_count: number;
}

export interface WPComSite {
  ID: number;
  name: string;
  description: string;
  URL: string;
  icon?: {
    img: string;
  };
  options?: {
    is_wpforteams_site?: boolean;
  };
  meta?: {
    links?: {
      site: string;
    };
  };
}

export interface WPComSitesResponse {
  sites: WPComSite[];
}

export interface WPComPostAuthor {
  name: string;
  avatar_URL: string;
}

export interface WPComPostMeta {
  id: string;
  key: string;
  value: string;
}

export interface WPComPost {
  ID: number;
  site_ID: number;
  title: string;
  content?: string;
  excerpt: string;
  date: string;
  URL: string;
  author: WPComPostAuthor;
  like_count?: number;
  i_like?: boolean;
  tags?: Record<string, { name: string; slug: string }>;
  metadata?: WPComPostMeta[];
  site_name?: string;
  site_URL?: string;
}

export interface WPComReaderResponse {
  posts: WPComPost[];
  next_page_handle?: string;
}

export interface WPComPostsResponse {
  found: number;
  posts: WPComPost[];
}

export interface WPComComment {
  ID: number;
  author: WPComPostAuthor;
  date: string;
  content: string;
  parent: { ID: number } | false;
}

export interface WPComCommentsResponse {
  found: number;
  comments: WPComComment[];
}

export interface WPComLikeResponse {
  success: boolean;
  i_like: boolean;
  like_count: number;
}

export interface WPComSubscription {
  ID: number;
  blog_ID: number;
  feed_ID: number;
  URL: string;
  feed_URL: string;
  name: string | null;
  unseen_count: number;
  site_icon: string | null;
  organization_id: number;
  last_updated: number;
  is_owner: boolean;
  is_wpforteams_site?: boolean;
}

export interface WPComFollowingResponse {
  subscriptions: WPComSubscription[];
  page: number;
  number: number;
  total_subscriptions: number;
}

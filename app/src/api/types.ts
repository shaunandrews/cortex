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
  is_seen?: boolean;
  tags?: Record<string, { name: string; slug: string }>;
  categories?: Record<string, { name: string; slug: string }>;
  metadata?: WPComPostMeta[];
  site_name?: string;
  site_URL?: string;
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

export interface WPComNotificationSubject {
  text: string;
  ranges?: { type?: string; url?: string; id?: number; indices?: number[] }[];
}

export interface WPComNotification {
  id: number;
  type: string;
  read: number; // 0 = unread, 1 = read
  timestamp: string;
  subject: WPComNotificationSubject[];
  body: WPComNotificationSubject[];
  meta: {
    ids: {
      site?: number;
      post?: number;
      comment?: number;
    };
  };
  title?: string;
  url?: string;
  noticon?: string;
  icon?: string;
}

export interface WPComNotificationsResponse {
  notes: WPComNotification[];
  last_seen_time?: number;
  number?: number;
}

export interface CreateP2Params {
  blog_name: string;
  blog_title: string;
  lang_id?: number;
}

export interface CreateP2Response {
  success: boolean;
  blog_details: {
    blogid: string | number;
    blogname: string;
    url: string;
    site_slug?: string;
  };
}

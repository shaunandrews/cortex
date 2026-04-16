import type {
  WPComUser,
  WPComSitesResponse,
  WPComPostsResponse,
  WPComPost,
  WPComCommentsResponse,
  WPComLikeResponse,
  WPComSubscription,
  WPComFollowingResponse,
  WPComReaderResponse,
} from './types';

const API_BASE = 'https://public-api.wordpress.com/rest/v1.1';
const API_BASE_V12 = 'https://public-api.wordpress.com/rest/v1.2';
const API_BASE_V2 = 'https://public-api.wordpress.com/wpcom/v2';

async function apiFetch<T>(
  endpoint: string,
  token: string,
  method: 'GET' | 'POST' = 'GET',
  options?: { base?: string; body?: unknown },
): Promise<T> {
  const base = options?.base ?? API_BASE;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const init: RequestInit = { method, headers };
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${base}${endpoint}`, init);

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export async function getMe(token: string): Promise<WPComUser> {
  return apiFetch<WPComUser>('/me', token);
}

export async function getMySites(token: string): Promise<WPComSitesResponse> {
  return apiFetch<WPComSitesResponse>(
    '/me/sites?fields=ID,name,description,URL,icon,options',
    token,
  );
}

export async function getPost(token: string, siteId: number, postId: number): Promise<WPComPost> {
  return apiFetch<WPComPost>(
    `/sites/${siteId}/posts/${postId}?fields=ID,site_ID,title,content,date,URL,author,like_count,i_like`,
    token,
  );
}

export async function getPostComments(
  token: string,
  siteId: number,
  postId: number,
): Promise<WPComCommentsResponse> {
  return apiFetch<WPComCommentsResponse>(
    `/sites/${siteId}/posts/${postId}/replies/?fields=ID,author,date,content,parent&order=ASC&number=100`,
    token,
  );
}

export async function likePost(
  token: string,
  siteId: number,
  postId: number,
): Promise<WPComLikeResponse> {
  return apiFetch<WPComLikeResponse>(`/sites/${siteId}/posts/${postId}/likes/new`, token, 'POST');
}

export async function unlikePost(
  token: string,
  siteId: number,
  postId: number,
): Promise<WPComLikeResponse> {
  return apiFetch<WPComLikeResponse>(
    `/sites/${siteId}/posts/${postId}/likes/mine/delete`,
    token,
    'POST',
  );
}

export async function getReaderStream(
  token: string,
  pageHandle?: string,
): Promise<WPComReaderResponse> {
  const params = new URLSearchParams({ number: '20' });
  if (pageHandle) params.set('page_handle', pageHandle);
  return apiFetch<WPComReaderResponse>(`/read/following?${params}`, token, 'GET', {
    base: API_BASE_V12,
  });
}

export async function getLikedPosts(
  token: string,
  pageHandle?: string,
): Promise<WPComReaderResponse> {
  const params = new URLSearchParams({ number: '20' });
  if (pageHandle) params.set('page_handle', pageHandle);
  return apiFetch<WPComReaderResponse>(`/read/liked?${params}`, token, 'GET', {
    base: API_BASE_V12,
  });
}

export async function createPost(
  token: string,
  siteId: number,
  content: string,
): Promise<WPComPost> {
  return apiFetch<WPComPost>(`/sites/${siteId}/posts/new`, token, 'POST', {
    body: { content, status: 'publish' },
  });
}

export async function getSitePosts(
  token: string,
  siteId: number,
  page: number = 1,
): Promise<WPComPostsResponse> {
  return apiFetch<WPComPostsResponse>(
    `/sites/${siteId}/posts?fields=ID,title,content,excerpt,date,URL,author,tags,metadata&order_by=date&order=DESC&number=20&page=${page}`,
    token,
  );
}

/** Lightweight post fetch for background sync — skips full content to reduce payload. */
export async function getSitePostsLightweight(
  token: string,
  siteId: number,
  page: number = 1,
  modifiedAfter?: string,
): Promise<WPComPostsResponse> {
  const params = new URLSearchParams({
    fields:
      'ID,site_ID,title,excerpt,date,modified,URL,author,tags,metadata,post_thumbnail,like_count,i_like',
    order_by: 'date',
    order: 'DESC',
    number: '20',
    page: String(page),
  });
  if (modifiedAfter) params.set('modified_after', modifiedAfter);
  return apiFetch<WPComPostsResponse>(`/sites/${siteId}/posts?${params}`, token);
}

/** Fetch just page 1 of following — used by sync engine for lightweight change detection. */
export async function getFollowingPage1(token: string): Promise<WPComFollowingResponse> {
  return apiFetch<WPComFollowingResponse>(`/read/following/mine?page=1&number=200`, token, 'GET', {
    base: API_BASE_V12,
  });
}

export async function getFollowing(token: string): Promise<WPComSubscription[]> {
  const all: WPComSubscription[] = [];
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const res = await apiFetch<WPComFollowingResponse>(
      `/read/following/mine?page=${page}&number=${perPage}`,
      token,
      'GET',
      { base: API_BASE_V12 },
    );

    if (!res.subscriptions || res.subscriptions.length === 0) break;
    all.push(...res.subscriptions);
    if (all.length >= res.total_subscriptions) break;
    page++;
  }

  return all;
}

export async function streamAISummary(
  token: string,
  content: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const aiToken = import.meta.env.VITE_AI_SERVICE_KEY || token;

  const res = await fetch(`${API_BASE_V2}/ai-api-proxy/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${aiToken}`,
      'Content-Type': 'application/json',
      'X-WPCOM-AI-Feature': 'cortex',
    },
    body: JSON.stringify({
      model: 'gpt-oss-120b',
      messages: [
        {
          role: 'user',
          content: `Summarize the following P2 post concisely in 2-3 bullet points. Focus on key decisions, action items, and important context. Be brief — each point should be one sentence.\n\n${content}`,
        },
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 300,
    }),
    signal,
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(`API error: ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const chunk = parsed.choices?.[0]?.delta?.content;
        if (chunk) {
          full += chunk;
          onChunk(chunk);
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  return full;
}

export async function markAllAsSeen(
  token: string,
  feedIds: number[],
): Promise<{ status: boolean }> {
  const body = new URLSearchParams();
  body.append('source', 'reader-web');
  for (const id of feedIds) {
    body.append('feed_ids[]', String(id));
  }

  const res = await fetch(`${API_BASE_V2}/seen-posts/seen/all/new`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export async function markPostsAsSeen(
  token: string,
  blogId: number,
  postIds: number[],
): Promise<{ status: boolean }> {
  const body = new URLSearchParams();
  body.append('blog_id', String(blogId));
  body.append('source', 'reader-web');
  for (const id of postIds) {
    body.append('post_ids[]', String(id));
  }

  const res = await fetch(`${API_BASE_V2}/seen-posts/seen/blog/new`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

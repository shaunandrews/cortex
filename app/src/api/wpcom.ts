import type { WPComUser, WPComSitesResponse } from './types';

const API_BASE = 'https://public-api.wordpress.com/rest/v1.1';

async function apiFetch<T>(endpoint: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMe, getMySites } from './wpcom';

const mockUser = {
  ID: 1,
  display_name: 'Test User',
  username: 'test',
  email: 'test@example.com',
  avatar_URL: 'https://gravatar.com/test',
  profile_URL: 'https://gravatar.com/test',
  site_count: 3,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('getMe', () => {
  it('fetches the current user with bearer token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockUser), { status: 200 }),
    );

    const user = await getMe('test-token');

    expect(fetch).toHaveBeenCalledWith('https://public-api.wordpress.com/rest/v1.1/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(user.display_name).toBe('Test User');
  });

  it('throws UNAUTHORIZED on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));

    await expect(getMe('bad-token')).rejects.toThrow('UNAUTHORIZED');
  });

  it('throws on other error statuses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

    await expect(getMe('token')).rejects.toThrow('API error: 500');
  });
});

describe('getMySites', () => {
  it('fetches sites with field filtering', async () => {
    const mockResponse = { sites: [] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    await getMySites('test-token');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/me/sites?fields='),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' },
      }),
    );
  });
});

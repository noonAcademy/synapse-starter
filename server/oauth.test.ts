import { describe, expect, it } from 'vitest';
import {
  type CitadelOAuthConfig,
  OAuthError,
  oauthLogin,
  oauthRefresh,
  oauthToken,
} from './oauth.js';

interface Captured {
  url: string;
  init: RequestInit | undefined;
}

function stubFetch(response: { status: number; body: unknown }): {
  fetchImpl: typeof fetch;
  calls: Captured[];
} {
  const calls: Captured[] = [];
  const fetchImpl = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const baseConfig: Omit<CitadelOAuthConfig, 'fetchImpl'> = {
  baseUrl: 'https://citadel.example',
  appId: 'app_test',
  appSecret: 'app-secret',
  redirectUri: 'https://app.example/oauth/callback',
};

function headerNames(init: RequestInit | undefined): string[] {
  return Object.keys((init?.headers ?? {}) as Record<string, string>).map((k) => k.toLowerCase());
}

describe('oauth client', () => {
  it('logs in with a bare (unsigned) POST carrying credential, appId, redirectUri', async () => {
    const { fetchImpl, calls } = stubFetch({
      status: 200,
      body: {
        code: 'code_abc',
        sessionToken: 'st_1',
        profiles: [{ id: 7, name: 'Dana', email: 'dana@noonacademy.com', type: 'ADMIN' }],
        selectedProfileId: 7,
      },
    });

    const result = await oauthLogin({ ...baseConfig, fetchImpl }, { credential: 'goog-cred' });

    expect(calls[0]?.url).toBe('https://citadel.example/api/oauth/login');
    expect(headerNames(calls[0]?.init)).not.toContain('x-citadel-signature');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      credential: 'goog-cred',
      appId: 'app_test',
      redirectUri: 'https://app.example/oauth/callback',
    });
    expect(result.code).toBe('code_abc');
    expect(result.selectedProfileId).toBe(7);
    expect(result.profiles).toHaveLength(1);
  });

  it('throws an OAuthError carrying the 403 status for external-only accounts', async () => {
    const { fetchImpl } = stubFetch({ status: 403, body: { error: 'EXTERNAL_USER only' } });
    await expect(
      oauthLogin({ ...baseConfig, fetchImpl }, { credential: 'x' }),
    ).rejects.toMatchObject({ name: 'OAuthError', status: 403 });
  });

  it('exchanges a code with an HMAC-signed POST and returns the token pair', async () => {
    const { fetchImpl, calls } = stubFetch({
      status: 200,
      body: {
        token: { accessToken: 'at1', refreshToken: 'rt1', type: 'Bearer', expiresIn: 600 },
        profile: { data: { id: 7 } },
      },
    });

    const result = await oauthToken({ ...baseConfig, fetchImpl }, { code: 'code_abc' });

    expect(calls[0]?.url).toBe('https://citadel.example/api/oauth/token');
    const names = headerNames(calls[0]?.init);
    expect(names).toContain('x-citadel-signature');
    expect(names).toContain('x-replit-app-id');
    expect(result.token).toEqual({
      accessToken: 'at1',
      refreshToken: 'rt1',
      type: 'Bearer',
      expiresIn: 600,
    });
  });

  it('refreshes with a flat (not token-wrapped) response shape', async () => {
    const { fetchImpl, calls } = stubFetch({
      status: 200,
      body: { accessToken: 'at2', refreshToken: 'rt2', type: 'Bearer', expiresIn: 600 },
    });

    const result = await oauthRefresh({ ...baseConfig, fetchImpl }, { refreshToken: 'rt1' });

    expect(calls[0]?.url).toBe('https://citadel.example/api/oauth/refresh');
    expect(headerNames(calls[0]?.init)).toContain('x-citadel-signature');
    expect(result).toEqual({
      accessToken: 'at2',
      refreshToken: 'rt2',
      type: 'Bearer',
      expiresIn: 600,
    });
  });

  it('surfaces a 401 from refresh as an OAuthError', async () => {
    const { fetchImpl } = stubFetch({ status: 401, body: { error: 'expired' } });
    await expect(
      oauthRefresh({ ...baseConfig, fetchImpl }, { refreshToken: 'stale' }),
    ).rejects.toBeInstanceOf(OAuthError);
  });
});

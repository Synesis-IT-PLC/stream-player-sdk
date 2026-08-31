import type { HlsConfig } from 'hls.js';
import { needsRefresh } from './access';
import type { TokenRefreshFn, TokenRefreshResult } from './types';

type TokenState = TokenRefreshResult;

function buildQueryString(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export function appendAuthParams(
  url: string,
  playbackUrl: string,
  tokenState: Pick<TokenState, 'segmentToken' | 'segmentExpiry'>,
  extraParams: Record<string, string> = {},
): string | null {

  const { segmentToken, segmentExpiry } = tokenState;

  if (!segmentToken || !segmentExpiry) {
    return null;
  }

  const params: Record<string, string> = {
    token: segmentToken,
    exp: String(segmentExpiry),
    ...extraParams,
  };

  try {
    const baseUrl = url.startsWith('http') ? undefined : playbackUrl;
    const parsed = new URL(url, baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== '') {
        parsed.searchParams.set(key, value);
      }
    });
    return parsed.toString();
  } catch (error) {
    console.error('Error setting up xhr:', error);
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${buildQueryString(params)}`;
  }
}

async function refreshTokensIfNeeded(
  tokenState: TokenState,
  tokenRefresh: TokenRefreshFn,
  threshold: number,
): Promise<void> {

  if (tokenState.segmentToken && !needsRefresh(tokenState.segmentExpiry, threshold)) {
    return;
  }

  const result = await tokenRefresh();
  tokenState.segmentToken = result.segmentToken;
  tokenState.segmentExpiry = result.segmentExpiry;
  tokenState.segmentAuthParams = result.segmentAuthParams || tokenState.segmentAuthParams;

  if (!tokenState.segmentToken) {
    throw new Error('Could not verify stream access. Please try again.');
  }
}

export function createSegmentXhrSetup(options: {
  playbackUrl: string;
  tokenRefresh: TokenRefreshFn;
  refreshThreshold?: number;
}): NonNullable<HlsConfig['xhrSetup']> {

  const tokenState: TokenState = {
    segmentToken: null,
    segmentExpiry: 0,
    segmentAuthParams: {
      stream_id: '',
      client_id: '',
      viewer_id: '',
    },
  };

  const threshold = options.refreshThreshold ?? 15;

  return async function xhrSetup(xhr, url) {
    if (!url.includes('.m3u8') && !url.includes('.ts')) return;

    await refreshTokensIfNeeded(tokenState, options.tokenRefresh, threshold);

    if (!url.includes('.ts')) return;

    const authenticatedUrl = appendAuthParams(
      url,
      options.playbackUrl,
      tokenState,
      tokenState.segmentAuthParams,
    );

    if (authenticatedUrl) {
      xhr.open('GET', authenticatedUrl, true);
    }
  };
}

export function createHlsConfig(options: {
  playbackUrl: string;
  tokenRefresh: TokenRefreshFn;
  refreshThreshold?: number;
}): Partial<HlsConfig> {

  return {
    enableWorker: true,
    lowLatencyMode: true,
    backBufferLength: 90,
    xhrSetup: createSegmentXhrSetup(options),
  };
}

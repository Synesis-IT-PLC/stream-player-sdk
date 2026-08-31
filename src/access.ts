import { TYPES } from './types';
import type { CallbackTokenRefreshOptions, TokenRefreshFn } from './types';

function refreshThresholdWithJitter(): number {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    return 15;
  }
  const rnd = crypto.getRandomValues(new Uint32Array(1))[0]! / 0x100000000;
  return 15 + rnd * 6 - 3;
}

export function needsRefresh(expiry: number, threshold: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return expiry - now <= threshold;
}

export function createTokenRefreshFunction(options: CallbackTokenRefreshOptions): TokenRefreshFn {
  const { type, streamId, clientId, viewerId, getAccessToken, extraParams = {} } = options;

  if (type !== TYPES.LIVE && type !== TYPES.VOD) {
    throw new TypeError(`Unsupported playback type: ${type}`);
  }

  if (!streamId || !clientId || !viewerId) {
    throw new Error('streamId, clientId, and viewerId are required');
  }

  if (typeof getAccessToken !== 'function') {
    throw new TypeError('getAccessToken is required');
  }

  const segmentAuthParams = {
    stream_id: streamId,
    client_id: clientId,
    viewer_id: viewerId,
    ...Object.fromEntries(
      Object.entries(extraParams)
        .filter(([, value]) => value != null && value !== '')
        .map(([key, value]) => [key, String(value)]),
    ),
  };

  const segmentRefreshThreshold = refreshThresholdWithJitter();

  let segmentToken: string | null = null;
  let segmentExpiry = 0;
  let inFlight: Promise<void> | null = null;

  async function fetchToken(): Promise<void> {
    const previousToken = segmentToken;
    const previousExpiry = segmentExpiry;
    try {
      const res = await getAccessToken({ type, streamId, clientId, viewerId });
      if (!res?.token || res.expiration == null || !Number.isFinite(res.expiration)) {
        throw new Error('Invalid access response: token and expiration are required');
      }
      segmentToken = res.token;
      segmentExpiry = res.expiration;
    } catch (error) {
      // Don't wipe a token that another concurrent call already replaced.
      if (segmentToken === previousToken && segmentExpiry === previousExpiry) {
        segmentToken = null;
        segmentExpiry = 0;
      }
      throw error;
    }
  }

  function refreshShared(): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = fetchToken().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  return async () => {
    if (!segmentToken || needsRefresh(segmentExpiry, segmentRefreshThreshold)) {
      await refreshShared();
    }

    return {
      segmentToken,
      segmentExpiry,
      segmentAuthParams,
    };
  };
}

import { TYPES } from './types';
import type { CallbackTokenRefreshOptions, TokenRefreshFn } from './types';

function refreshThresholdWithJitter(): number {
  const jitterBytes = new Uint32Array(1);
  crypto.getRandomValues(jitterBytes);
  return 15 + (jitterBytes[0]! / 0x100000000) * 6 - 3;
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

  return async () => {
    if (!segmentToken || needsRefresh(segmentExpiry, segmentRefreshThreshold)) {
      try {
        const res = await getAccessToken({ type, streamId, clientId, viewerId });
        if (!res?.token || res.expiration == null) {
          throw new Error('Invalid access response: token and expiration are required');
        }
        segmentToken = res.token;
        segmentExpiry = res.expiration;
      } catch (error) {
        segmentToken = null;
        segmentExpiry = 0;
        throw error;
      }
    }

    return {
      segmentToken,
      segmentExpiry,
      segmentAuthParams,
    };
  };
}

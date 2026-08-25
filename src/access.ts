import { CastApiError, requestJson } from './http';
import { getClientIdFromToken } from './jwt';
import type { AccessTokenDetails, TokenRefreshOptions, TokenRefreshFn } from './types';
import { getOrCreateViewerId } from './viewer';

function accessFailureMessage(status: number, message?: string): string {
  if (message) return message;
  if (status === 401) return 'Session expired or unauthorized. Please sign in again.';
  if (status === 403) return 'You are not allowed to access this stream.';
  if (status === 404) return 'Stream not found.';
  if (status === 429) return 'Too many requests. Please try again later.';
  return 'Could not verify stream access. Please try again.';
}

export async function requestStreamAccess(options: {
  accessUrl: string;
  streamId: string;
  authToken: string;
  viewerId?: string;
  viewerStorageKey?: string;
}): Promise<AccessTokenDetails> {
  const { streamId, authToken } = options;
  if (!streamId || !authToken) {
    throw new Error('streamId and authToken are required');
  }

  const viewerId = options.viewerId || getOrCreateViewerId(options.viewerStorageKey);

  try {
    const data = await requestJson<AccessTokenDetails>(options.accessUrl, {
      token: authToken,
      body: { stream_id: streamId, viewer_id: viewerId },
      fallbackMessage: 'Could not verify stream access. Please try again.',
    });
    if (!data.token || data.expiration == null) {
      throw new Error('Access granted but no segment token was returned');
    }
    return data;
  } catch (error) {
    if (error instanceof CastApiError) {
      throw new CastApiError(accessFailureMessage(error.status, error.message), error.status);
    }
    throw error;
  }
}

export function createTokenRefreshFunction(options: TokenRefreshOptions & {
  accessUrl: string;
  authToken: string;
  viewerStorageKey?: string;
}): TokenRefreshFn {
  const jitterBytes = new Uint32Array(1);
  crypto.getRandomValues(jitterBytes);
  const segmentRefreshThreshold = 15 + (jitterBytes[0]! / 0x100000000) * 6 - 3;

  const { streamId, authToken, extraParams = {} } = options;
  if (!streamId || !authToken) {
    throw new Error('streamId and authToken are required');
  }

  const viewerId = options.viewerId || getOrCreateViewerId(options.viewerStorageKey);
  const clientId = getClientIdFromToken(authToken);
  if (!clientId) {
    throw new Error('client_id missing from auth token');
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

  let segmentToken: string | null = null;
  let segmentExpiry = 0;

  const needsRefresh = (expiry: number, threshold: number) => {
    const now = Math.floor(Date.now() / 1000);
    return expiry - now < threshold;
  };

  return async () => {
    if (!segmentToken || needsRefresh(segmentExpiry, segmentRefreshThreshold)) {
      try {
        const res = await requestStreamAccess({
          accessUrl: options.accessUrl,
          streamId,
          authToken,
          viewerId,
          viewerStorageKey: options.viewerStorageKey,
        });
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

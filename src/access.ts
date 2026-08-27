import { CastApiError, requestJson } from './http';
import { getClientIdFromToken } from './jwt';
import { TYPES } from './types';
import type {
  AccessTokenDetails,
  CallbackTokenRefreshOptions,
  TokenRefreshOptions,
  TokenRefreshFn,
} from './types';
import { getOrCreateViewerId } from './viewer';

function accessFailureMessage(status: number, message?: string): string {
  if (message) return message;
  if (status === 401) return 'Session expired or unauthorized. Please sign in again.';
  if (status === 403) return 'You are not allowed to access this stream.';
  if (status === 404) return 'Stream not found.';
  if (status === 429) return 'Too many requests. Please try again later.';
  return 'Could not verify stream access. Please try again.';
}

function refreshThresholdWithJitter(): number {
  const jitterBytes = new Uint32Array(1);
  crypto.getRandomValues(jitterBytes);
  return 15 + (jitterBytes[0]! / 0x100000000) * 6 - 3;
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

export function createTokenRefreshFunction(options: CallbackTokenRefreshOptions): TokenRefreshFn {
  const { type, resourceId, clientId, viewerId, getAccessToken, extraParams = {} } = options;
  if (type === TYPES.VOD) {
    throw new Error('VOD playback is not supported yet');
  }
  if (type !== TYPES.LIVE) {
    throw new TypeError(`Unsupported playback type: ${type}`);
  }
  if (!resourceId || !clientId || !viewerId) {
    throw new Error('resourceId, clientId, and viewerId are required');
  }
  if (typeof getAccessToken !== 'function') {
    throw new TypeError('getAccessToken is required');
  }

  const segmentAuthParams = {
    stream_id: resourceId,
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

  const needsRefresh = (expiry: number, threshold: number) => {
    const now = Math.floor(Date.now() / 1000);
    return expiry - now < threshold;
  };

  return async () => {
    if (!segmentToken || needsRefresh(segmentExpiry, segmentRefreshThreshold)) {
      try {
        const res = await getAccessToken({ type, resourceId, clientId, viewerId });
        if (!res?.token || res.expiration == null) {
          throw new Error('Access granted but no segment token was returned');
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

export function createJwtTokenRefreshFunction(
  options: TokenRefreshOptions & {
    accessUrl: string;
    authToken: string;
    viewerStorageKey?: string;
  },
): TokenRefreshFn {
  const { streamId, authToken, extraParams } = options;
  if (!streamId || !authToken) {
    throw new Error('streamId and authToken are required');
  }

  const viewerId = options.viewerId || getOrCreateViewerId(options.viewerStorageKey);
  const clientId = getClientIdFromToken(authToken);
  if (!clientId) {
    throw new Error('client_id missing from auth token');
  }

  return createTokenRefreshFunction({
    type: TYPES.LIVE,
    resourceId: streamId,
    clientId,
    viewerId,
    extraParams,
    getAccessToken: ({ resourceId, viewerId: vid }) =>
      requestStreamAccess({
        accessUrl: options.accessUrl,
        streamId: resourceId,
        authToken,
        viewerId: vid,
        viewerStorageKey: options.viewerStorageKey,
      }),
  });
}

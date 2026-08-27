import Hls from 'hls.js';
import { createTokenRefreshFunction } from './access';
import { createHlsConfig } from './hls';
import { TYPES } from './types';
import type { GetAccessToken, PlaybackType } from './types';
import { getOrCreateViewerId } from './viewer';

export type CastPlayerOptions = {
  type: PlaybackType;
  streamId: string;
  clientId: string;
  playbackUrl: string;
  getAccessToken: GetAccessToken;
  viewerId?: string;
  onError?: (error: Error) => void;
  onReady?: () => void;
};

export type CastPlayerHandle = {
  destroy(): void;
};

export function createCastPlayer(
  video: HTMLVideoElement,
  options: CastPlayerOptions,
): CastPlayerHandle {
  const {
    type,
    streamId,
    clientId,
    playbackUrl,
    getAccessToken,
    viewerId: viewerIdOption,
    onError,
    onReady,
  } = options;

  const reportError = (error: Error) => {
    onError?.(error);
  };

  if (type === TYPES.VOD) {
    reportError(new Error('VOD playback is not supported yet'));
    return { destroy() {} };
  }
  if (type !== TYPES.LIVE) {
    reportError(new Error(`Unsupported playback type: ${type}`));
    return { destroy() {} };
  }

  if (!streamId || !clientId || !playbackUrl) {
    reportError(new Error('streamId, clientId, and playbackUrl are required'));
    return { destroy() {} };
  }

  if (typeof getAccessToken !== 'function') {
    reportError(new Error('getAccessToken is required'));
    return { destroy() {} };
  }

  if (!Hls.isSupported()) {
    reportError(new Error('hls.js is not supported in this browser'));
    return { destroy() {} };
  }

  const viewerId = viewerIdOption || getOrCreateViewerId();
  let hls: Hls;

  try {
    const tokenRefresh = createTokenRefreshFunction({
      type,
      streamId,
      clientId,
      viewerId,
      getAccessToken,
    });
    hls = new Hls(createHlsConfig({ playbackUrl, tokenRefresh }));
  } catch (error) {
    reportError(error instanceof Error ? error : new Error('Could not start playback'));
    return { destroy() {} };
  }

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    onReady?.();
  });

  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data?.fatal) return;
    const message =
      (data.error instanceof Error && data.error.message) ||
      data.reason ||
      'Playback failed';
    reportError(new Error(message));
  });

  hls.loadSource(playbackUrl);
  hls.attachMedia(video);

  let destroyed = false;
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      hls.destroy();
    },
  };
}

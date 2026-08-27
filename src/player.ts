import Hls from 'hls.js';
import { createTokenRefreshFunction } from './access';
import { createHlsConfig } from './hls';
import { TYPES } from './types';
import type { GetAccessToken, PlaybackType } from './types';
import { getOrCreateViewerId } from './viewer';

export type QualityLevel = {
  index: number;
  height?: number;
  width?: number;
  bitrate?: number;
  name: string;
};

export type CastPlayerOptions = {
  type: PlaybackType;
  streamId: string;
  clientId: string;
  playbackUrl: string;
  getAccessToken: GetAccessToken;
  viewerId?: string;
  onError?: (error: Error) => void;
  onReady?: () => void;
  onLevels?: (levels: QualityLevel[]) => void;
  onLevelChange?: (level: number) => void;
};

export type CastPlayerHandle = {
  destroy(): void;
  getLevels(): QualityLevel[];
  getCurrentLevel(): number;
  setLevel(level: number): void;
  syncToLive(): void;
  isLive(): boolean;
};

function emptyHandle(): CastPlayerHandle {
  return {
    destroy() {},
    getLevels: () => [],
    getCurrentLevel: () => -1,
    setLevel() {},
    syncToLive() {},
    isLive: () => false,
  };
}

function mapLevelToQualityOption(
  level: { height?: number; width?: number; bitrate?: number; name?: string; codecSet?: string },
  index: number,
): QualityLevel {
  const bitrateKbps = level.bitrate ? (level.bitrate / 1000).toFixed(0) : null;
  const nameSuffix = bitrateKbps ? ` @ ${bitrateKbps}kbps` : '';
  const heightLabel = level.height ? `${level.height}p` : 'Unknown';
  return {
    index,
    height: level.height,
    width: level.width,
    bitrate: level.bitrate,
    name: level.name || `${heightLabel}${nameSuffix}`,
  };
}

function getLiveEdge(hls: Hls, video: HTMLVideoElement): number | null {
  if (hls.liveSyncPosition != null && Number.isFinite(hls.liveSyncPosition)) {
    return hls.liveSyncPosition;
  }
  if (video.seekable.length > 0) {
    return video.seekable.end(video.seekable.length - 1);
  }
  return null;
}

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
    onLevels,
    onLevelChange,
  } = options;

  const reportError = (error: Error) => {
    onError?.(error);
  };

  if (type !== TYPES.LIVE && type !== TYPES.VOD) {
    reportError(new Error(`Unsupported playback type: ${type}`));
    return emptyHandle();
  }

  if (!streamId || !clientId || !playbackUrl) {
    reportError(new Error('streamId, clientId, and playbackUrl are required'));
    return emptyHandle();
  }

  if (typeof getAccessToken !== 'function') {
    reportError(new Error('getAccessToken is required'));
    return emptyHandle();
  }

  if (!Hls.isSupported()) {
    reportError(new Error('hls.js is not supported in this browser'));
    return emptyHandle();
  }

  const isLive = type === TYPES.LIVE;
  const viewerId = viewerIdOption || getOrCreateViewerId();
  let hls: Hls;
  let levels: QualityLevel[] = [];
  let currentLevel = -1;
  let destroyed = false;

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
    return emptyHandle();
  }

  const clampLiveSeek = () => {
    if (!isLive || destroyed) return;
    const edge = getLiveEdge(hls, video);
    if (edge == null) return;
    if (video.currentTime > edge) {
      video.currentTime = edge;
    }
  };

  const onSeeking = () => clampLiveSeek();
  const onSeeked = () => clampLiveSeek();

  if (isLive) {
    video.addEventListener('seeking', onSeeking);
    video.addEventListener('seeked', onSeeked);
  }

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    levels = hls.levels.map((level, index) => mapLevelToQualityOption(level, index));

    currentLevel = -1;
    hls.currentLevel = -1;
    onLevels?.(levels);
    onLevelChange?.(currentLevel);
    onReady?.();
  });

  hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
    if (hls.autoLevelEnabled) {
      currentLevel = -1;
    } else {
      currentLevel = data.level;
    }
    onLevelChange?.(currentLevel);
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

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (isLive) {
        video.removeEventListener('seeking', onSeeking);
        video.removeEventListener('seeked', onSeeked);
      }
      hls.destroy();
      levels = [];
      currentLevel = -1;
    },
    getLevels() {
      return levels;
    },
    getCurrentLevel() {
      return currentLevel;
    },
    setLevel(level: number) {
      if (destroyed) return;
      currentLevel = level;
      hls.currentLevel = level;
      onLevelChange?.(currentLevel);
    },
    syncToLive() {
      if (!isLive || destroyed) return;
      const edge = getLiveEdge(hls, video);
      if (edge == null) return;
      video.currentTime = edge;
      void video.play().catch(() => {});
    },
    isLive() {
      return isLive;
    },
  };
}

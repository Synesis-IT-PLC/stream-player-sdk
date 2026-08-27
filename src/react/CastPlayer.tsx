import { useEffect, useMemo, useRef } from 'react';
import Hls from 'hls.js';
import { createTokenRefreshFunction } from '../access';
import { createHlsConfig } from '../hls';
import { TYPES } from '../types';
import type { GetAccessToken, PlaybackType } from '../types';
import { getOrCreateViewerId } from '../viewer';

export type CastPlayerProps = {
  type: PlaybackType;
  resourceId: string;
  clientId: string;
  playbackUrl: string;
  getAccessToken: GetAccessToken;
  viewerId?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  className?: string;
  poster?: string;
  onError?: (error: Error) => void;
  onReady?: () => void;
};

export function CastPlayer({
  type,
  resourceId,
  clientId,
  playbackUrl,
  getAccessToken,
  viewerId: viewerIdProp,
  autoPlay,
  muted,
  controls = true,
  className,
  poster,
  onError,
  onReady,
}: Readonly<CastPlayerProps>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const viewerId = useMemo(
    () => viewerIdProp || getOrCreateViewerId(),
    [viewerIdProp],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reportError = (error: Error) => {
      onErrorRef.current?.(error);
    };

    if (type === TYPES.VOD) {
      reportError(new Error('VOD playback is not supported yet'));
      return;
    }
    if (type !== TYPES.LIVE) {
      reportError(new Error(`Unsupported playback type: ${type}`));
      return;
    }

    if (!resourceId || !clientId || !playbackUrl) {
      reportError(new Error('resourceId, clientId, and playbackUrl are required'));
      return;
    }

    if (!Hls.isSupported()) {
      reportError(new Error('hls.js is not supported in this browser'));
      return;
    }

    let hls: Hls;
    try {
      const tokenRefresh = createTokenRefreshFunction({
        type,
        resourceId,
        clientId,
        viewerId,
        getAccessToken: (ctx) => getAccessTokenRef.current(ctx),
      });
      hls = new Hls(createHlsConfig({ playbackUrl, tokenRefresh }));
    } catch (error) {
      reportError(error instanceof Error ? error : new Error('Could not start playback'));
      return;
    }

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      onReadyRef.current?.();
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

    return () => {
      hls.destroy();
    };
  }, [type, resourceId, clientId, playbackUrl, viewerId]);

  return (
    <video
      ref={videoRef}
      className={className}
      controls={controls}
      muted={muted}
      autoPlay={autoPlay}
      poster={poster}
      playsInline
    >
      <track kind="captions" srcLang="en" label="Captions" />
    </video>
  );
}

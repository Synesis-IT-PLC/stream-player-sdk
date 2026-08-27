import { useEffect, useRef } from 'react';
import { createCastPlayer } from '../player';
import type { GetAccessToken, PlaybackType } from '../types';

export type CastPlayerProps = {
  type: PlaybackType;
  streamId: string;
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
  streamId,
  clientId,
  playbackUrl,
  getAccessToken,
  viewerId,
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handle = createCastPlayer(video, {
      type,
      streamId,
      clientId,
      playbackUrl,
      viewerId,
      getAccessToken: (ctx) => getAccessTokenRef.current(ctx),
      onError: (error) => onErrorRef.current?.(error),
      onReady: () => onReadyRef.current?.(),
    });

    return () => {
      handle.destroy();
    };
  }, [type, streamId, clientId, playbackUrl, viewerId]);

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

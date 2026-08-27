import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createCastPlayer } from '../player';
import type { CastPlayerHandle, QualityLevel } from '../player';
import { TYPES } from '../types';
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

const containerStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: '100%',
  backgroundColor: '#000',
  borderRadius: '8px',
  overflow: 'hidden',
};

const videoStyle: CSSProperties = {
  width: '100%',
  height: 'auto',
  display: 'block',
  minHeight: '200px',
};

const chromeStyle: CSSProperties = {
  position: 'absolute',
  top: '10px',
  right: '10px',
  zIndex: 20,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  padding: '8px 12px',
  borderRadius: '6px',
  backdropFilter: 'blur(4px)',
};

const labelStyle: CSSProperties = {
  color: '#fff',
  fontSize: '14px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const selectStyle: CSSProperties = {
  backgroundColor: '#1f1f1f',
  color: '#fff',
  border: '1px solid rgba(255, 255, 255, 0.35)',
  borderRadius: '4px',
  padding: '6px 10px',
  fontSize: '14px',
  cursor: 'pointer',
  outline: 'none',
  minWidth: '120px',
  colorScheme: 'dark',
};

const optionStyle: CSSProperties = {
  backgroundColor: '#fff',
  color: '#111',
};

const syncButtonStyle: CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  color: '#fff',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '4px',
  padding: '6px 12px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
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
  const handleRef = useRef<CastPlayerHandle | null>(null);
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);

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
      onLevels: (nextLevels) => setLevels(nextLevels),
      onLevelChange: (level) => setCurrentLevel(level),
    });
    handleRef.current = handle;

    return () => {
      handle.destroy();
      handleRef.current = null;
      setLevels([]);
      setCurrentLevel(-1);
    };
  }, [type, streamId, clientId, playbackUrl, viewerId]);

  const showLiveSync = type === TYPES.LIVE;
  const showChrome = levels.length > 0 || showLiveSync;

  return (
    <div style={containerStyle} className={className}>
      {showChrome && (
        <div style={chromeStyle}>
          {levels.length > 0 && (
            <>
              <label htmlFor="cast-quality-select" style={labelStyle}>
                Quality
              </label>
              <select
                id="cast-quality-select"
                value={currentLevel}
                onChange={(e) => {
                  const level = Number.parseInt(e.target.value, 10);
                  handleRef.current?.setLevel(level);
                  setCurrentLevel(level);
                }}
                style={selectStyle}
                aria-label="Playback quality"
              >
                <option value={-1} style={optionStyle}>
                  Auto
                </option>
                {levels.map((level) => (
                  <option key={level.index} value={level.index} style={optionStyle}>
                    {level.name}
                  </option>
                ))}
              </select>
            </>
          )}
          {showLiveSync && (
            <button
              type="button"
              style={syncButtonStyle}
              onClick={() => handleRef.current?.syncToLive()}
            >
              Sync to live
            </button>
          )}
        </div>
      )}
      <video
        ref={videoRef}
        style={videoStyle}
        controls={controls}
        muted={muted}
        autoPlay={autoPlay}
        poster={poster}
        playsInline
      >
        <track kind="captions" srcLang="en" label="Captions" />
      </video>
    </div>
  );
}

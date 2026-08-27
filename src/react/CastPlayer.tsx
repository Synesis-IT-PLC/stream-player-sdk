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
  backgroundColor: '#0a0a0a',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 8px 28px rgba(0, 0, 0, 0.35)',
};

const videoStyle: CSSProperties = {
  width: '100%',
  height: 'auto',
  display: 'block',
  minHeight: '240px',
  backgroundColor: '#000',
};

const overlayStyle: CSSProperties = {
  position: 'absolute',
  top: '12px',
  left: '12px',
  right: '12px',
  zIndex: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  pointerEvents: 'none',
};

const typeBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 10px',
  borderRadius: '999px',
  backgroundColor: 'rgba(0, 0, 0, 0.72)',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.02em',
  backdropFilter: 'blur(8px)',
  pointerEvents: 'none',
};

const liveDotStyle: CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: '#ef4444',
  boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.25)',
};

const overlayControlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 8px',
  borderRadius: '10px',
  backgroundColor: 'rgba(0, 0, 0, 0.72)',
  backdropFilter: 'blur(8px)',
  pointerEvents: 'auto',
};

const qualityLabelStyle: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.75)',
  fontSize: '12px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  paddingLeft: '4px',
};

const qualitySelectStyle: CSSProperties = {
  appearance: 'none' as CSSProperties['appearance'],
  WebkitAppearance: 'none' as CSSProperties['WebkitAppearance'],
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  color: '#fff',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  borderRadius: '8px',
  padding: '7px 28px 7px 10px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  outline: 'none',
  minWidth: '132px',
  colorScheme: 'dark',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M3 4.5L6 8l3-3.5'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
};

const qualityOptionStyle: CSSProperties = {
  backgroundColor: '#fff',
  color: '#111',
};

const goLiveButtonStyle: CSSProperties = {
  backgroundColor: 'rgba(47, 158, 136, 0.95)',
  color: '#fff',
  border: '0',
  borderRadius: '8px',
  padding: '7px 12px',
  fontSize: '13px',
  fontWeight: 600,
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

  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsReady(false);
    const handle = createCastPlayer(video, {
      type,
      streamId,
      clientId,
      playbackUrl,
      viewerId,
      getAccessToken: (ctx) => getAccessTokenRef.current(ctx),
      onError: (error) => onErrorRef.current?.(error),
      onReady: () => {
        setIsReady(true);
        onReadyRef.current?.();
      },
      onLevels: (nextLevels) => setQualityLevels(nextLevels),
      onLevelChange: (level) => setSelectedQuality(level),
    });
    handleRef.current = handle;

    return () => {
      handle.destroy();
      handleRef.current = null;
      setQualityLevels([]);
      setSelectedQuality(-1);
      setIsReady(false);
    };
  }, [type, streamId, clientId, playbackUrl, viewerId]);

  const isLive = type === TYPES.LIVE;
  const showOverlay = qualityLevels.length > 0 || isLive;

  return (
    <div style={containerStyle} className={className}>
      {showOverlay && (
        <div style={overlayStyle}>
          <span style={typeBadgeStyle}>
            {isLive ? (
              <>
                <span style={liveDotStyle} aria-hidden />
                <span>LIVE</span>
              </>
            ) : (
              <span>VOD</span>
            )}
            {!isReady && <span style={{ opacity: 0.7, fontWeight: 500 }}>· loading</span>}
          </span>
          <div style={overlayControlsStyle}>
            {qualityLevels.length > 0 && (
              <>
                <label htmlFor="cast-quality-select" style={qualityLabelStyle}>
                  Quality
                </label>
                <select
                  id="cast-quality-select"
                  value={selectedQuality}
                  onChange={(e) => {
                    const level = Number.parseInt(e.target.value, 10);
                    handleRef.current?.setLevel(level);
                    setSelectedQuality(level);
                  }}
                  style={qualitySelectStyle}
                  aria-label="Playback quality"
                >
                  <option value={-1} style={qualityOptionStyle}>
                    Auto
                  </option>
                  {qualityLevels.map((level) => (
                    <option key={level.index} value={level.index} style={qualityOptionStyle}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {isLive && (
              <button
                type="button"
                style={goLiveButtonStyle}
                onClick={() => handleRef.current?.syncToLive()}
              >
                Go live
              </button>
            )}
          </div>
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

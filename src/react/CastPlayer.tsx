import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createCastPlayer } from '../player';
import type { CastPlayerHandle, QualityLevel } from '../player';
import { TYPES } from '../types';
import type { GetAccessToken, PlaybackType } from '../types';
import { logoBoxStyle, resolveLogo } from '../branding';
import type { CastLogoOptions } from '../branding';

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
  logo?: CastLogoOptions;
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

const posterLayerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#000',
  cursor: 'pointer',
};

const posterImageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const posterPlayStyle: CSSProperties = {
  position: 'absolute',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  border: '1px solid rgba(255, 255, 255, 0.28)',
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  backdropFilter: 'blur(8px)',
  color: '#fff',
  cursor: 'pointer',
  padding: 0,
};

const goLiveButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '30px',
  padding: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  color: '#fff',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  borderRadius: '8px',
  cursor: 'pointer',
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
  logo,
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
  const [posterVisible, setPosterVisible] = useState(true);
  const qualitySelectIdRef = useRef(`cast-quality-select-${crypto.randomUUID()}`);
  const qualitySelectId = qualitySelectIdRef.current;

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
      onError: (error) => {
        setPosterVisible(true);
        onErrorRef.current?.(error);
      },
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
      setPosterVisible(true);
    };
  }, [type, streamId, clientId, playbackUrl, viewerId]);

  // Kept separate from player creation so poster/logo changes never restart HLS.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const hide = () => setPosterVisible(false);
    const show = () => setPosterVisible(true);

    video.addEventListener('playing', hide);
    video.addEventListener('ended', show);
    video.addEventListener('emptied', show);

    if (!video.paused && video.currentTime > 0) {
      setPosterVisible(false);
    }

    return () => {
      video.removeEventListener('playing', hide);
      video.removeEventListener('ended', show);
      video.removeEventListener('emptied', show);
    };
  }, []);

  const isLive = type === TYPES.LIVE;
  const showOverlay = qualityLevels.length > 0 || isLive;
  const resolvedLogo = resolveLogo(logo);
  const showPoster = Boolean(poster) && posterVisible;

  const playFromPoster = () => {
    videoRef.current?.play().catch(() => {
      /* autoplay/gesture rejections are surfaced by the video element itself */
    });
  };

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
                <label htmlFor={qualitySelectId} style={qualityLabelStyle}>
                  Quality
                </label>
                <select
                  id={qualitySelectId}
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
                title="Seek to live"
                aria-label="Seek to live"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
                  <path d="M2 2.5v9l6.5-4.5L2 2.5Z" />
                  <rect x="10" y="2.5" width="2" height="9" rx="0.5" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
      {showPoster && (
        <div
          style={posterLayerStyle}
          onClick={playFromPoster}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              playFromPoster();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Play"
        >
          <img src={poster} alt="" style={posterImageStyle} />
          <span style={posterPlayStyle} aria-hidden>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13l11-6.5L8 5.5Z" />
            </svg>
          </span>
        </div>
      )}
      {resolvedLogo && (
        <img
          src={resolvedLogo.src}
          alt=""
          style={logoBoxStyle(resolvedLogo) as CSSProperties}
        />
      )}
      <video
        ref={videoRef}
        style={videoStyle}
        controls={controls}
        muted={muted}
        autoPlay={autoPlay}
        poster={poster}
        playsInline
      />
    </div>
  );
}

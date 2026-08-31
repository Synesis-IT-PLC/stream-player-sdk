export type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type CastLogoOptions = {
  src: string;
  position?: LogoPosition;
  opacity?: number;
};

export type ResolvedLogo = {
  src: string;
  position: LogoPosition;
  opacity: number;
};

export const LOGO_DEFAULTS = {
  position: 'top-right' as LogoPosition,
  opacity: 0.85,
  /** Height relative to the player box, so the logo scales with the video. */
  size: '9%',
  margin: '12px',
} as const;

const POSITIONS: ReadonlySet<LogoPosition> = new Set<LogoPosition>([
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]);

function clampOpacity(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return LOGO_DEFAULTS.opacity;
  return Math.min(1, Math.max(0, value));
}

export function resolveLogo(logo: CastLogoOptions | null | undefined): ResolvedLogo | null {
  if (!logo?.src) return null;
  const position = POSITIONS.has(logo.position as LogoPosition)
    ? (logo.position as LogoPosition)
    : LOGO_DEFAULTS.position;
  return {
    src: logo.src,
    position,
    opacity: clampOpacity(logo.opacity),
  };
}

export function logoBoxStyle(logo: ResolvedLogo): Record<string, string> {
  const { margin } = LOGO_DEFAULTS;
  const isTop = logo.position.startsWith('top');
  const isLeft = logo.position.endsWith('left');
  return {
    position: 'absolute',
    top: isTop ? margin : 'auto',
    bottom: isTop ? 'auto' : margin,
    left: isLeft ? margin : 'auto',
    right: isLeft ? 'auto' : margin,
    zIndex: '15',
    height: LOGO_DEFAULTS.size,
    width: 'auto',
    maxWidth: '40%',
    minHeight: '20px',
    objectFit: 'contain',
    opacity: String(logo.opacity),
    pointerEvents: 'none',
    userSelect: 'none',
    filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45))',
  };
}

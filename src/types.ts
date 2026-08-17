export const DEFAULT_BASE_URL = 'https://dev-cast.convay.com/cast';

export type CastClientOptions = {
  /** CastAPI origin, including any path prefix (e.g. https://dev-cast.convay.com/cast). */
  baseUrl?: string;
  /** Restore a previously issued JWT. */
  token?: string;
  /** Persist JWT to localStorage. Default true in browsers. */
  persistSession?: boolean;
  /** Override localStorage key for the auth session. */
  sessionStorageKey?: string;
  /** Override localStorage key for viewer_id. */
  viewerStorageKey?: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type CreateStreamRequest = {
  title: string;
};

export type StreamDetails = {
  streamId: string;
  ingestUrl: string;
  streamKey: string;
  playbackUrl: string;
};

export type StreamListItem = {
  streamId: string;
  title: string;
  serverId: number | null;
  updatedAt: string | null;
};

export type StreamStatus = {
  streamId: string;
  isLive: boolean;
};

export type AccessTokenDetails = {
  token: string;
  expiration: number;
  viewerId: string;
};

export type SegmentAuthParams = {
  stream_id: string;
  client_id: string;
  viewer_id: string;
  [key: string]: string;
};

export type TokenRefreshResult = {
  segmentToken: string | null;
  segmentExpiry: number;
  segmentAuthParams: SegmentAuthParams;
};

export type TokenRefreshFn = () => Promise<TokenRefreshResult>;

export type CreateTokenRefreshOptions = {
  streamId: string;
  authToken?: string;
  viewerId?: string;
  extraParams?: Record<string, string | number | null | undefined>;
};

export type CreateHlsConfigOptions = CreateTokenRefreshOptions & {
  playbackUrl: string;
  refreshThreshold?: number;
};

export type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

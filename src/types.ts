export const DEFAULT_BASE_URL = 'https://dev-cast.convay.com/cast';

export type CastClientOptions = {
  /** CastAPI origin, including any path prefix (e.g. https://dev-cast.convay.com/cast). */
  baseUrl?: string;
  /** Restore a previously issued JWT. */
  token?: string;
  /** Persist JWT to localStorage. Default true in browsers. */
  persistSession?: boolean;
  sessionStorageKey?: string;
  viewerStorageKey?: string;
};

/** `ApiResponse` envelope used by /api/auth/token, /api/stream/key, /access, /end */
export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T;
};

/** `AuthRequest` for POST /api/auth/token */
export type LoginRequest = {
  email: string;
  password: string;
};

/** `StreamKeyRequest` for POST /api/stream/key */
export type StreamKeyRequest = {
  title: string;
};

/** `StreamKeyResponse` — data of POST /api/stream/key (and body of /force-key) */
export type StreamKeyResponse = {
  stream_id: string;
  stream_url: string;
  stream_key: string;
  view_url: string;
};

/** `AccessRequest` for POST /api/stream/access */
export type AccessRequest = {
  stream_id: string;
  viewer_id: string;
};

/** `AccessTokenDetails` — data of POST /api/stream/access (segment token + expiration) */
export type AccessTokenDetails = {
  token: string;
  expiration: number;
};

/** `DisconnectRequest` for POST /api/stream/status and /end */
export type DisconnectRequest = {
  stream_id: string;
};

/**
 * `StatusResponse` — body of POST /api/stream/status (not wrapped in ApiResponse).
 * JSON field is `is_live`.
 */
export type StatusResponse = {
  stream_id: string;
  is_live: boolean;
};

/** `StreamListItem` — element of GET /api/stream/list (raw array, not ApiResponse) */
export type StreamListItem = {
  stream_id: string;
  title: string;
  server_id: number;
  updated_at: string;
};

/** `StreamTitleResponse` — GET /api/streams/{streamId}/title */
export type StreamTitleResponse = {
  stream_title: string;
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

/**
 * Paths (or full URLs) the SDK hits.
 * Relative paths are joined with `baseUrl`. Absolute `https://…` values are used as-is.
 */
export type CastClientPaths = {
  token: string;
  streamKey: string;
  access: string;
  end: string;
  status: string;
};

export type CastClientOptions = {
  /**
   * Client backend (their API). Required unless every `paths` value is an absolute URL.
   */
  baseUrl?: string;
  /** Every endpoint the SDK can call. All keys are required; there are no default paths. */
  paths: CastClientPaths;
  /** Restore a previously issued JWT. */
  token?: string;
  /** Persist JWT to localStorage. Default true in browsers. */
  persistSession?: boolean;
  sessionStorageKey?: string;
  viewerStorageKey?: string;
};

/** Envelope used by `token`, `streamKey`, `access`, and `end`. */
export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T;
};

/** Body for the `token` (login) path. */
export type LoginRequest = {
  email: string;
  password: string;
};

/** Body for the `streamKey` path. */
export type StreamKeyRequest = {
  title: string;
};

/** `data` from the `streamKey` path. */
export type StreamKeyResponse = {
  stream_id: string;
  stream_url: string;
  stream_key: string;
  view_url: string;
};

/** Body for the `access` path. */
export type AccessRequest = {
  stream_id: string;
  viewer_id: string;
};

/** `data` from the `access` path (segment token + expiration). */
export type AccessTokenDetails = {
  token: string;
  expiration: number;
};

/** Body for `end` and `status`. */
export type DisconnectRequest = {
  stream_id: string;
};

/**
 * Body of the `status` path (not wrapped in an envelope).
 * JSON field is `is_live`.
 */
export type StatusResponse = {
  stream_id: string;
  is_live: boolean;
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

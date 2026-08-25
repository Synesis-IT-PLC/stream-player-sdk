/**
 * Endpoint URLs the SDK hits.
 */
export type Endpoints = {
  token: string;
  streamKey: string;
  access: string;
  end: string;
  status: string;
};


export type ClientConfig = {
  baseUrl?: string;
  endpoints: Endpoints;
  token?: string;
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
export type StreamIdRequest = {
  stream_id: string;
};

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

export type TokenRefreshOptions = {
  streamId: string;
  authToken?: string;
  viewerId?: string;
  extraParams?: Record<string, string | number | null | undefined>;
};

export type HlsConfigOptions = TokenRefreshOptions & {
  playbackUrl: string;
  refreshThreshold?: number;
};

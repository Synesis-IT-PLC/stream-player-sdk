export const TYPES = {
  LIVE: 'live',
  VOD: 'vod',
} as const;

export type PlaybackType = (typeof TYPES)[keyof typeof TYPES];

/** Segment token + expiration (unix seconds). */
export type AccessTokenDetails = {
  token: string;
  expiration: number;
};

export type AccessTokenRequest = {
  type: PlaybackType;
  resourceId: string;
  clientId: string;
  viewerId: string;
};

export type AccessTokenResponse = AccessTokenDetails;

export type GetAccessToken = (ctx: AccessTokenRequest) => Promise<AccessTokenResponse>;

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

export type CallbackTokenRefreshOptions = {
  type: PlaybackType;
  resourceId: string;
  clientId: string;
  viewerId: string;
  getAccessToken: GetAccessToken;
  extraParams?: Record<string, string | number | null | undefined>;
};

import { createJwtTokenRefreshFunction, requestStreamAccess } from './access';
import { createHlsConfig as buildHlsConfig } from './hls';
import { CastApiError, readJson, requestJson, requestSuccess } from './http';
import { getClientIdFromToken, getEmailFromToken, isJwtExpired } from './jwt';
import { joinUrl, requireBaseUrl, requireEndpoints } from './endpoints';
import {
  type ApiResponse,
  type ClientConfig,
  type Endpoints,
  type HlsConfigOptions,
  type TokenRefreshOptions,
  type LoginRequest,
  type AccessTokenDetails,
  type StatusResponse,
  type StreamKeyRequest,
  type StreamKeyResponse,
  type TokenRefreshFn,
} from './types';
import { getOrCreateViewerId } from './viewer';

export class CastClient {
  readonly baseUrl: string | undefined;
  readonly endpoints: Endpoints;
  private token: string | null;
  private readonly viewerStorageKey?: string;

  constructor(config: ClientConfig) {
    this.endpoints = requireEndpoints(config.endpoints);
    this.baseUrl = requireBaseUrl(config.baseUrl, this.endpoints);
    this.viewerStorageKey = config.viewerStorageKey;
    this.token = config.token || null;
  }

  private url(name: keyof Endpoints): string {
    return joinUrl(this.baseUrl, this.endpoints[name]);
  }

  get authToken(): string | null {
    return this.token;
  }

  get clientId(): string | null {
    return this.token ? getClientIdFromToken(this.token) : null;
  }

  get email(): string | null {
    return this.token ? getEmailFromToken(this.token) : null;
  }

  get isAuthenticated(): boolean {
    return Boolean(this.token) && !isJwtExpired(this.token!);
  }

  setAuthToken(token: string | null): void {
    this.token = token;
  }

  async login({ email, password }: LoginRequest): Promise<string> {
    if (!email?.trim() || !password) {
      throw new Error('email and password are required');
    }

    const token = await requestJson<string>(this.url('token'), {
      body: { email: email.trim(), password },
      fallbackMessage: 'Login failed',
    });

    if (!token || typeof token !== 'string') {
      throw new Error('Login succeeded but no token was returned');
    }

    this.setAuthToken(token);
    return token;
  }

  logout(): void {
    this.setAuthToken(null);
  }

  async createStream({ title }: StreamKeyRequest): Promise<StreamKeyResponse> {
    if (!title?.trim()) {
      throw new Error('title is required');
    }

    const data = await requestJson<StreamKeyResponse>(this.url('streamKey'), {
      token: this.requireToken(),
      body: { title: title.trim() },
      fallbackMessage: 'Could not create stream',
    });

    if (!data.stream_id || !data.view_url || !data.stream_url || !data.stream_key) {
      throw new Error('Stream created but response was incomplete');
    }

    return data;
  }

  async endStream(streamId: string): Promise<ApiResponse> {
    return requestSuccess(this.url('end'), {
      token: this.requireToken(),
      body: { stream_id: streamId },
      fallbackMessage: 'Could not end stream',
    });
  }

  async getStatus(streamId: string): Promise<StatusResponse> {
    const response = await fetch(this.url('status'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.requireToken()}`,
      },
      body: JSON.stringify({ stream_id: streamId }),
    });

    const body = (await readJson(response)) as StatusResponse | null;

    if (!response.ok || !body?.stream_id) {
      throw new CastApiError('Could not read stream status', response.status);
    }

    return body;
  }

  async requestAccess(streamId: string, viewerId?: string): Promise<AccessTokenDetails> {
    return requestStreamAccess({
      accessUrl: this.url('access'),
      streamId,
      authToken: this.requireToken(),
      viewerId,
      viewerStorageKey: this.viewerStorageKey,
    });
  }

  createTokenRefreshFunction(options: TokenRefreshOptions): TokenRefreshFn {
    return createJwtTokenRefreshFunction({
      ...options,
      accessUrl: this.url('access'),
      authToken: options.authToken || this.requireToken(),
      viewerStorageKey: this.viewerStorageKey,
    });
  }

  createHlsConfig(options: HlsConfigOptions) {
    return buildHlsConfig({
      playbackUrl: options.playbackUrl,
      refreshThreshold: options.refreshThreshold,
      tokenRefresh: this.createTokenRefreshFunction(options),
    });
  }

  getViewerId(): string {
    return getOrCreateViewerId(this.viewerStorageKey);
  }

  private requireToken(): string {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first or pass token in ClientConfig.');
    }
    if (isJwtExpired(this.token)) {
      this.logout();
      throw new Error('Session expired. Please sign in again.');
    }
    return this.token;
  }
}

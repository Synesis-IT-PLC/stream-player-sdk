import { createTokenRefreshFunction, requestStreamAccess } from './access';
import { createHlsConfig as buildHlsConfig } from './hls';
import { CastApiError, readJson, requestJson, requestSuccess } from './http';
import { getClientIdFromToken, getEmailFromToken, isJwtExpired } from './jwt';
import { joinUrl, requireBaseUrl, requirePaths } from './endpoints';
import {
  type ApiResponse,
  type CastClientOptions,
  type CastClientPaths,
  type CreateHlsConfigOptions,
  type CreateTokenRefreshOptions,
  type LoginRequest,
  type AccessTokenDetails,
  type StatusResponse,
  type StreamKeyRequest,
  type StreamKeyResponse,
  type TokenRefreshFn,
} from './types';
import { getOrCreateViewerId } from './viewer';

const DEFAULT_SESSION_STORAGE_KEY = 'cast_sdk:auth_session';
const AUTH_SESSION_MAX_AGE_MS = 60 * 60 * 1000;

type StoredSession = {
  token: string;
  email: string;
  savedAt: number;
};

export class CastClient {
  readonly baseUrl: string | undefined;
  readonly paths: CastClientPaths;
  private token: string | null;
  private readonly persistSession: boolean;
  private readonly sessionStorageKey: string;
  private readonly viewerStorageKey?: string;

  constructor(options: CastClientOptions) {
    this.paths = requirePaths(options.paths);
    this.baseUrl = requireBaseUrl(options.baseUrl, this.paths);
    this.persistSession = options.persistSession ?? true;
    this.sessionStorageKey = options.sessionStorageKey || DEFAULT_SESSION_STORAGE_KEY;
    this.viewerStorageKey = options.viewerStorageKey;
    this.token = options.token || (this.persistSession ? loadStoredToken(this.sessionStorageKey) : null);
  }

  private url(name: keyof CastClientPaths): string {
    return joinUrl(this.baseUrl, this.paths[name]);
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
    if (!this.persistSession) return;
    if (!token) {
      clearStoredSession(this.sessionStorageKey);
      return;
    }
    saveStoredSession(this.sessionStorageKey, token);
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

  createTokenRefreshFunction(options: CreateTokenRefreshOptions): TokenRefreshFn {
    return createTokenRefreshFunction({
      ...options,
      accessUrl: this.url('access'),
      authToken: options.authToken || this.requireToken(),
      viewerStorageKey: this.viewerStorageKey,
    });
  }

  createHlsConfig(options: CreateHlsConfigOptions) {
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
      throw new Error('Not authenticated. Call login() first.');
    }
    if (isJwtExpired(this.token)) {
      this.logout();
      throw new Error('Session expired. Please sign in again.');
    }
    return this.token;
  }
}

function loadStoredToken(storageKey: string): string | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    if (!session?.token || !session?.email || typeof session.savedAt !== 'number') {
      clearStoredSession(storageKey);
      return null;
    }
    if (Date.now() - session.savedAt >= AUTH_SESSION_MAX_AGE_MS || isJwtExpired(session.token)) {
      clearStoredSession(storageKey);
      return null;
    }
    return session.token;
  } catch {
    clearStoredSession(storageKey);
    return null;
  }
}

function saveStoredSession(storageKey: string, token: string): void {
  const email = getEmailFromToken(token);
  if (!email) return;
  try {
    const session: StoredSession = { token, email, savedAt: Date.now() };
    localStorage.setItem(storageKey, JSON.stringify(session));
  } catch {
    // ignore storage failures
  }
}

function clearStoredSession(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

export { DEFAULT_SESSION_STORAGE_KEY };

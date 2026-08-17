import { createTokenRefreshFunction, requestStreamAccess } from './access';
import { createHlsConfig as buildHlsConfig } from './hls';
import { CastApiError, readJson, requestJson, requestSuccess } from './http';
import { getClientIdFromToken, getEmailFromToken, isJwtExpired } from './jwt';
import {
  DEFAULT_BASE_URL,
  type AccessTokenDetails,
  type CastClientOptions,
  type CreateHlsConfigOptions,
  type CreateStreamRequest,
  type CreateTokenRefreshOptions,
  type LoginRequest,
  type StreamDetails,
  type StreamListItem,
  type StreamStatus,
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

type StreamKeyPayload = {
  stream_id?: string;
  stream_url?: string;
  stream_key?: string;
  view_url?: string;
};

export class CastClient {
  readonly baseUrl: string;
  private token: string | null;
  private readonly persistSession: boolean;
  private readonly sessionStorageKey: string;
  private readonly viewerStorageKey?: string;

  constructor(options: CastClientOptions = {}) {
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.persistSession = options.persistSession ?? true;
    this.sessionStorageKey = options.sessionStorageKey || DEFAULT_SESSION_STORAGE_KEY;
    this.viewerStorageKey = options.viewerStorageKey;
    this.token = options.token || (this.persistSession ? loadStoredToken(this.sessionStorageKey) : null);
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

    const token = await requestJson<string>(`${this.baseUrl}/api/auth/token`, {
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

  async createStream({ title }: CreateStreamRequest): Promise<StreamDetails> {
    if (!title?.trim()) {
      throw new Error('title is required');
    }

    const data = await requestJson<StreamKeyPayload>(`${this.baseUrl}/api/stream/key`, {
      token: this.requireToken(),
      body: { title: title.trim() },
      fallbackMessage: 'Could not create stream',
    });

    if (!data.stream_id || !data.view_url || !data.stream_url || !data.stream_key) {
      throw new Error('Stream created but response was incomplete');
    }

    return {
      streamId: data.stream_id,
      ingestUrl: data.stream_url,
      streamKey: data.stream_key,
      playbackUrl: data.view_url,
    };
  }

  async endStream(streamId: string): Promise<void> {
    await requestSuccess(`${this.baseUrl}/api/stream/end`, {
      token: this.requireToken(),
      body: { stream_id: streamId },
      fallbackMessage: 'Could not end stream',
    });
  }

  async getStatus(streamId: string): Promise<StreamStatus> {
    const response = await fetch(`${this.baseUrl}/api/stream/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.requireToken()}`,
      },
      body: JSON.stringify({ stream_id: streamId }),
    });

    const body = (await readJson(response)) as {
      stream_id?: string;
      is_live?: boolean;
      is_streaming?: boolean;
    } | null;

    if (!response.ok || !body) {
      throw new CastApiError('Could not read stream status', response.status);
    }

    return {
      streamId: body.stream_id || streamId,
      isLive: Boolean(body.is_live ?? body.is_streaming),
    };
  }

  async listStreams(): Promise<StreamListItem[]> {
    const response = await fetch(`${this.baseUrl}/api/stream/list`, {
      headers: {
        Authorization: `Bearer ${this.requireToken()}`,
      },
    });

    const body = await readJson(response);
    if (!response.ok || !Array.isArray(body)) {
      throw new CastApiError('Could not list streams', response.status);
    }

    return body.map((item: {
      stream_id?: string;
      title?: string;
      server_id?: number;
      updated_at?: string;
    }) => ({
      streamId: item.stream_id || '',
      title: item.title || '',
      serverId: item.server_id ?? null,
      updatedAt: item.updated_at ?? null,
    }));
  }

  async requestAccess(streamId: string, viewerId?: string): Promise<AccessTokenDetails> {
    return requestStreamAccess({
      accessUrl: `${this.baseUrl}/api/stream/access`,
      streamId,
      authToken: this.requireToken(),
      viewerId,
      viewerStorageKey: this.viewerStorageKey,
    });
  }

  createTokenRefreshFunction(options: CreateTokenRefreshOptions): TokenRefreshFn {
    return createTokenRefreshFunction({
      ...options,
      accessUrl: `${this.baseUrl}/api/stream/access`,
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

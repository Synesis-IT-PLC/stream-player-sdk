import type { ApiResponse } from './types';

export class CastApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CastApiError';
    this.status = status;
  }
}

export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function unwrapEnvelope<T>(
  body: ApiResponse<T> | null,
  response: Response,
  fallbackMessage: string,
): T {
  if (!response.ok || !body?.success) {
    throw new CastApiError(body?.message || fallbackMessage, response.status);
  }
  if (body.data === undefined || body.data === null) {
    throw new CastApiError('Response succeeded but data was empty', response.status);
  }
  return body.data;
}

async function sendJson(
  url: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
  },
): Promise<{ response: Response; body: ApiResponse | null }> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: options.method ?? 'POST',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const body = (await readJson(response)) as ApiResponse | null;
  return { response, body };
}

export async function requestJson<T>(
  url: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
    fallbackMessage: string;
  },
): Promise<T> {
  const { response, body } = await sendJson(url, options);
  return unwrapEnvelope(body as ApiResponse<T> | null, response, options.fallbackMessage);
}

export async function requestSuccess(
  url: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
    fallbackMessage: string;
  },
): Promise<ApiResponse> {
  const { response, body } = await sendJson(url, options);
  if (!response.ok || !body?.success) {
    throw new CastApiError(body?.message || options.fallbackMessage, response.status);
  }
  return body;
}

import type { Endpoints } from './types';

const ABSOLUTE_URL = /^https?:\/\//i;

const ENDPOINT_KEYS: (keyof Endpoints)[] = ['token', 'streamKey', 'access', 'end', 'status'];

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function isAbsoluteUrl(value: string): boolean {
  return ABSOLUTE_URL.test(value);
}

export function joinUrl(baseUrl: string | undefined, path: string): string {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    throw new Error('Endpoint path must be a non-empty string');
  }
  if (isAbsoluteUrl(trimmedPath)) {
    return trimTrailingSlash(trimmedPath);
  }
  if (!baseUrl?.trim()) {
    throw new Error('baseUrl is required when a path is not an absolute URL');
  }
  const base = trimTrailingSlash(baseUrl.trim());
  const suffix = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
  return `${base}${suffix}`;
}

export function requireEndpoints(endpoints: Endpoints | undefined): Endpoints {
  if (!endpoints) {
    throw new Error('endpoints is required. Configure every API URL; the SDK has no defaults.');
  }
  for (const key of ENDPOINT_KEYS) {
    const value = endpoints[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`endpoints.${key} is required`);
    }
  }
  return endpoints;
}

export function requireBaseUrl(baseUrl: string | undefined, endpoints: Endpoints): string | undefined {
  const hasRelative = ENDPOINT_KEYS.some((key) => !isAbsoluteUrl(endpoints[key].trim()));
  if (!hasRelative) {
    return baseUrl ? trimTrailingSlash(baseUrl) : undefined;
  }
  if (!baseUrl?.trim()) {
    throw new Error('baseUrl is required when any endpoint is a relative path');
  }
  return trimTrailingSlash(baseUrl.trim());
}

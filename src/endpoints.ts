import type { CastClientPaths } from './types';

const ABSOLUTE_URL = /^https?:\/\//i;

const PATH_KEYS: (keyof CastClientPaths)[] = ['token', 'streamKey', 'access', 'end', 'status'];

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

export function requirePaths(paths: CastClientPaths | undefined): CastClientPaths {
  if (!paths) {
    throw new Error('paths is required. Configure every API path; the SDK has no defaults.');
  }
  for (const key of PATH_KEYS) {
    const value = paths[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`paths.${key} is required`);
    }
  }
  return paths;
}

export function requireBaseUrl(baseUrl: string | undefined, paths: CastClientPaths): string | undefined {
  const hasRelative = PATH_KEYS.some((key) => !isAbsoluteUrl(paths[key].trim()));
  if (!hasRelative) {
    return baseUrl ? trimTrailingSlash(baseUrl) : undefined;
  }
  if (!baseUrl?.trim()) {
    throw new Error('baseUrl is required when any path is relative');
  }
  return trimTrailingSlash(baseUrl.trim());
}

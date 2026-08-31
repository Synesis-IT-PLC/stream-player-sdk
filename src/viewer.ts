const DEFAULT_VIEWER_STORAGE_KEY = 'cast_sdk:viewer_id';

// crypto.randomUUID is secure-context only, so it is missing over plain HTTP.
export function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateViewerId(storageKey = DEFAULT_VIEWER_STORAGE_KEY): string {
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;

    const viewerId = randomId();
    localStorage.setItem(storageKey, viewerId);
    return viewerId;
  } catch {
    return randomId();
  }
}

export { DEFAULT_VIEWER_STORAGE_KEY };

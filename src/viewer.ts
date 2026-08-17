const DEFAULT_VIEWER_STORAGE_KEY = 'cast_sdk:viewer_id';

export function getOrCreateViewerId(storageKey = DEFAULT_VIEWER_STORAGE_KEY): string {
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;

    const viewerId = crypto.randomUUID();
    localStorage.setItem(storageKey, viewerId);
    return viewerId;
  } catch {
    return crypto.randomUUID();
  }
}

export { DEFAULT_VIEWER_STORAGE_KEY };

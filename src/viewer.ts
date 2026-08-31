const DEFAULT_VIEWER_STORAGE_KEY = 'cast_sdk:viewer_id';

// crypto.randomUUID is secure-context only, so it is missing over plain HTTP.
export function randomId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
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

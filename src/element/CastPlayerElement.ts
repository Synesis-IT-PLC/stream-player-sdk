import { createCastPlayer } from '../player';
import type { CastPlayerHandle, QualityLevel } from '../player';
import { TYPES } from '../types';
import type { GetAccessToken, PlaybackType } from '../types';

export const CAST_PLAYER_TAG = 'cast-player';

const OBSERVED_ATTRIBUTES = [
  'type',
  'stream-id',
  'client-id',
  'playback-url',
  'viewer-id',
  'autoplay',
  'muted',
  'controls',
  'poster',
] as const;

const CHROME_STYLES = `
:host {
  display: block;
  position: relative;
  width: 100%;
  max-width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}
video {
  width: 100%;
  height: auto;
  display: block;
  min-height: 200px;
}
.chrome {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 20;
  display: none;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.7);
  padding: 8px 12px;
  border-radius: 6px;
  backdrop-filter: blur(4px);
}
.chrome.visible {
  display: flex;
}
.chrome label {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}
.chrome select {
  background: #1f1f1f;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 14px;
  cursor: pointer;
  outline: none;
  min-width: 120px;
  color-scheme: dark;
}
.chrome select option {
  color: #111;
  background: #fff;
}
.chrome button {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}
.quality-wrap {
  display: none;
  align-items: center;
  gap: 8px;
}
.quality-wrap.visible {
  display: flex;
}
.sync-btn {
  display: none;
}
.sync-btn.visible {
  display: inline-block;
}
`;

export class CastPlayerElement extends HTMLElement {
  static readonly observedAttributes: string[] = [...OBSERVED_ATTRIBUTES];

  readonly #video: HTMLVideoElement;
  readonly #chrome: HTMLDivElement;
  readonly #qualityWrap: HTMLDivElement;
  readonly #qualitySelect: HTMLSelectElement;
  readonly #syncButton: HTMLButtonElement;
  #handle: CastPlayerHandle | null = null;
  #getAccessToken: GetAccessToken | null = null;
  #restartScheduled = false;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CHROME_STYLES;
    shadow.appendChild(style);

    this.#chrome = document.createElement('div');
    this.#chrome.className = 'chrome';

    this.#qualityWrap = document.createElement('div');
    this.#qualityWrap.className = 'quality-wrap';
    const qualityLabel = document.createElement('label');
    qualityLabel.htmlFor = 'cast-quality-select';
    qualityLabel.textContent = 'Quality';
    this.#qualitySelect = document.createElement('select');
    this.#qualitySelect.id = 'cast-quality-select';
    this.#qualitySelect.setAttribute('aria-label', 'Playback quality');
    this.#qualitySelect.addEventListener('change', () => {
      const level = Number.parseInt(this.#qualitySelect.value, 10);
      this.#handle?.setLevel(level);
    });
    this.#qualityWrap.append(qualityLabel, this.#qualitySelect);

    this.#syncButton = document.createElement('button');
    this.#syncButton.type = 'button';
    this.#syncButton.className = 'sync-btn';
    this.#syncButton.textContent = 'Sync to live';
    this.#syncButton.addEventListener('click', () => {
      this.#handle?.syncToLive();
    });

    this.#chrome.append(this.#qualityWrap, this.#syncButton);

    this.#video = document.createElement('video');
    this.#video.playsInline = true;
    this.#video.controls = true;
    const track = document.createElement('track');
    track.kind = 'captions';
    track.srclang = 'en';
    track.label = 'Captions';
    this.#video.appendChild(track);

    shadow.append(this.#chrome, this.#video);
  }

  get getAccessToken(): GetAccessToken | null {
    return this.#getAccessToken;
  }

  set getAccessToken(fn: GetAccessToken | null) {
    this.#getAccessToken = fn;
    this.#scheduleRestart();
  }

  syncToLive(): void {
    this.#handle?.syncToLive();
  }

  setLevel(level: number): void {
    this.#handle?.setLevel(level);
    this.#qualitySelect.value = String(level);
  }

  getLevels(): QualityLevel[] {
    return this.#handle?.getLevels() ?? [];
  }

  getCurrentLevel(): number {
    return this.#handle?.getCurrentLevel() ?? -1;
  }

  connectedCallback(): void {
    this.#applyVideoAttrs();
    this.#scheduleRestart();
  }

  disconnectedCallback(): void {
    this.#destroyPlayer();
  }

  attributeChangedCallback(): void {
    this.#applyVideoAttrs();
    this.#scheduleRestart();
  }

  #applyVideoAttrs(): void {
    this.#video.autoplay = this.hasAttribute('autoplay');
    this.#video.muted = this.hasAttribute('muted');
    const controlsAttr = this.getAttribute('controls');
    this.#video.controls = controlsAttr === null ? true : controlsAttr !== 'false';
    const poster = this.getAttribute('poster');
    if (poster) {
      this.#video.poster = poster;
    } else {
      this.#video.removeAttribute('poster');
    }
  }

  #scheduleRestart(): void {
    if (this.#restartScheduled) return;
    this.#restartScheduled = true;
    queueMicrotask(() => {
      this.#restartScheduled = false;
      if (!this.isConnected) return;
      this.#restart();
    });
  }

  #destroyPlayer(): void {
    this.#handle?.destroy();
    this.#handle = null;
    this.#resetChrome();
  }

  #resetChrome(): void {
    this.#qualitySelect.innerHTML = '';
    this.#qualityWrap.classList.remove('visible');
    this.#syncButton.classList.remove('visible');
    this.#chrome.classList.remove('visible');
  }

  #updateQualityOptions(levels: QualityLevel[], currentLevel: number): void {
    this.#qualitySelect.innerHTML = '';
    const autoOption = document.createElement('option');
    autoOption.value = '-1';
    autoOption.textContent = 'Auto';
    this.#qualitySelect.appendChild(autoOption);

    for (const level of levels) {
      const option = document.createElement('option');
      option.value = String(level.index);
      option.textContent = level.name;
      this.#qualitySelect.appendChild(option);
    }

    this.#qualitySelect.value = String(currentLevel);
    this.#qualityWrap.classList.toggle('visible', levels.length > 0);
    this.#updateChromeVisibility();
  }

  #updateChromeVisibility(): void {
    const showSync = this.getAttribute('type') === TYPES.LIVE;
    this.#syncButton.classList.toggle('visible', showSync);
    const showChrome =
      this.#qualityWrap.classList.contains('visible') || showSync;
    this.#chrome.classList.toggle('visible', showChrome);
  }

  #restart(): void {
    this.#destroyPlayer();

    const type = this.getAttribute('type') as PlaybackType | null;
    const streamId = this.getAttribute('stream-id');
    const clientId = this.getAttribute('client-id');
    const playbackUrl = this.getAttribute('playback-url');
    const viewerId = this.getAttribute('viewer-id') || undefined;
    const getAccessToken = this.#getAccessToken;

    if (!type || !streamId || !clientId || !playbackUrl || !getAccessToken) {
      return;
    }

    if (type !== TYPES.LIVE && type !== TYPES.VOD) {
      this.#dispatchError(new Error(`Unsupported playback type: ${type}`));
      return;
    }

    this.#updateChromeVisibility();

    this.#handle = createCastPlayer(this.#video, {
      type,
      streamId,
      clientId,
      playbackUrl,
      viewerId,
      getAccessToken,
      onError: (error) => this.#dispatchError(error),
      onReady: () => {
        this.dispatchEvent(new CustomEvent('ready', { bubbles: true, composed: true }));
      },
      onLevels: (levels) => {
        this.#updateQualityOptions(levels, this.#handle?.getCurrentLevel() ?? -1);
        this.dispatchEvent(
          new CustomEvent('levels', {
            detail: levels,
            bubbles: true,
            composed: true,
          }),
        );
      },
      onLevelChange: (level) => {
        this.#qualitySelect.value = String(level);
      },
    });
  }

  #dispatchError(error: Error): void {
    this.dispatchEvent(
      new CustomEvent('error', {
        detail: error,
        bubbles: true,
        composed: true,
      }),
    );
  }
}

export function defineCastPlayer(tagName = CAST_PLAYER_TAG): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tagName)) {
    customElements.define(tagName, CastPlayerElement);
  }
}

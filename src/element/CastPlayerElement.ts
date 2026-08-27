import { createCastPlayer } from '../player';
import type { CastPlayerHandle, QualityLevel } from '../player';
import { TYPES } from '../types';
import type { GetAccessToken, PlaybackType } from '../types';

export const CAST_PLAYER_TAG = 'cast-player';

// Changing these restarts HLS playback. 
const PLAYBACK_ATTRIBUTES = [
  'type',
  'stream-id',
  'client-id',
  'playback-url',
  'viewer-id',
] as const;

// Changing these only updates the underlying <video>, not HLS playback.
const VIDEO_ATTRIBUTES = ['autoplay', 'muted', 'controls', 'poster'] as const;

const OBSERVED_ATTRIBUTES = [...PLAYBACK_ATTRIBUTES, ...VIDEO_ATTRIBUTES] as const;

const OVERLAY_STYLES = `
:host {
  display: block;
  position: relative;
  width: 100%;
  max-width: 100%;
  background: #0a0a0a;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
}
video {
  width: 100%;
  height: auto;
  display: block;
  min-height: 240px;
  background: #000;
}
.overlay {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 20;
  display: none;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  pointer-events: none;
}
.overlay.visible {
  display: flex;
}
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  backdrop-filter: blur(8px);
}
.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25);
}
.overlay-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(8px);
  pointer-events: auto;
}
.overlay label {
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  padding-left: 4px;
}
.overlay select {
  appearance: none;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  padding: 7px 28px 7px 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  min-width: 132px;
  color-scheme: dark;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M3 4.5L6 8l3-3.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
.overlay select option {
  color: #111;
  background: #fff;
}
.overlay button {
  background: rgba(47, 158, 136, 0.95);
  color: #fff;
  border: 0;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.quality-menu {
  display: none;
  align-items: center;
  gap: 8px;
}
.quality-menu.visible {
  display: flex;
}
.go-live-btn {
  display: none;
}
.go-live-btn.visible {
  display: inline-block;
}
`;

export class CastPlayerElement extends HTMLElement {
  static readonly observedAttributes: string[] = [...OBSERVED_ATTRIBUTES];

  readonly #video: HTMLVideoElement;
  readonly #overlay: HTMLDivElement;
  readonly #typeBadge: HTMLSpanElement;
  readonly #qualityMenu: HTMLDivElement;
  readonly #qualitySelect: HTMLSelectElement;
  readonly #goLiveButton: HTMLButtonElement;
  #handle: CastPlayerHandle | null = null;
  #getAccessToken: GetAccessToken | null = null;
  #restartScheduled = false;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = OVERLAY_STYLES;
    shadow.appendChild(style);

    this.#overlay = document.createElement('div');
    this.#overlay.className = 'overlay';

    this.#typeBadge = document.createElement('span');
    this.#typeBadge.className = 'type-badge';
    this.#typeBadge.textContent = 'VOD';

    const overlayControls = document.createElement('div');
    overlayControls.className = 'overlay-controls';

    this.#qualityMenu = document.createElement('div');
    this.#qualityMenu.className = 'quality-menu';
    const qualitySelectId = `cast-quality-select-${crypto.randomUUID()}`;
    const qualityLabel = document.createElement('label');
    qualityLabel.htmlFor = qualitySelectId;
    qualityLabel.textContent = 'Quality';
    this.#qualitySelect = document.createElement('select');
    this.#qualitySelect.id = qualitySelectId;
    this.#qualitySelect.setAttribute('aria-label', 'Playback quality');
    this.#qualitySelect.addEventListener('change', () => {
      const level = Number.parseInt(this.#qualitySelect.value, 10);
      this.#handle?.setLevel(level);
    });
    this.#qualityMenu.append(qualityLabel, this.#qualitySelect);

    this.#goLiveButton = document.createElement('button');
    this.#goLiveButton.type = 'button';
    this.#goLiveButton.className = 'go-live-btn';
    this.#goLiveButton.textContent = 'Go live';
    this.#goLiveButton.addEventListener('click', () => {
      this.#handle?.syncToLive();
    });

    overlayControls.append(this.#qualityMenu, this.#goLiveButton);
    this.#overlay.append(this.#typeBadge, overlayControls);

    this.#video = document.createElement('video');
    this.#video.playsInline = true;
    this.#video.controls = true;

    shadow.append(this.#overlay, this.#video);
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

  attributeChangedCallback(name: string): void {
    if ((VIDEO_ATTRIBUTES as readonly string[]).includes(name)) {
      this.#applyVideoAttrs();
      return;
    }
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
    this.#resetOverlay();
  }

  #resetOverlay(): void {
    this.#qualitySelect.innerHTML = '';
    this.#qualityMenu.classList.remove('visible');
    this.#goLiveButton.classList.remove('visible');
    this.#overlay.classList.remove('visible');
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
    this.#qualityMenu.classList.toggle('visible', levels.length > 0);
    this.#updateOverlayVisibility();
  }

  #updateOverlayVisibility(): void {
    const isLive = this.getAttribute('type') === TYPES.LIVE;
    this.#goLiveButton.classList.toggle('visible', isLive);
    this.#typeBadge.replaceChildren();
    if (isLive) {
      const dot = document.createElement('span');
      dot.className = 'live-dot';
      this.#typeBadge.append(dot, document.createTextNode('LIVE'));
    } else {
      this.#typeBadge.textContent = 'VOD';
    }
    const showOverlay =
      this.#qualityMenu.classList.contains('visible') || isLive;
    this.#overlay.classList.toggle('visible', showOverlay);
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

    this.#updateOverlayVisibility();

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

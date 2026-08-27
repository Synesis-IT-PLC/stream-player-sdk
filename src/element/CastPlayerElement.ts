import { createCastPlayer } from '../player';
import type { CastPlayerHandle } from '../player';
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

export class CastPlayerElement extends HTMLElement {
  static readonly observedAttributes: string[] = [...OBSERVED_ATTRIBUTES];

  readonly #video: HTMLVideoElement;
  #handle: CastPlayerHandle | null = null;
  #getAccessToken: GetAccessToken | null = null;
  #restartScheduled = false;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    this.#video = document.createElement('video');
    this.#video.playsInline = true;
    this.#video.controls = true;
    this.#video.style.width = '100%';
    this.#video.style.height = 'auto';
    this.#video.style.display = 'block';
    const track = document.createElement('track');
    track.kind = 'captions';
    track.srclang = 'en';
    track.label = 'Captions';
    this.#video.appendChild(track);
    shadow.appendChild(this.#video);
  }

  get getAccessToken(): GetAccessToken | null {
    return this.#getAccessToken;
  }

  set getAccessToken(fn: GetAccessToken | null) {
    this.#getAccessToken = fn;
    this.#scheduleRestart();
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

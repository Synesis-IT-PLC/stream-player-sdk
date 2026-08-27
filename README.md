# stream-web-sdk (`@convay/cast-sdk`)

JavaScript/TypeScript SDK for gated HLS **playback**.

Partners render `CastPlayer` in the browser. The player never talks to CastAPI. Your app calls **your** backend; your backend calls CastAPI for short-lived segment tokens.

Stream create, status, and end are **not** part of this SDK — handle those in your own backend.

VOD (`TYPES.VOD`) is reserved for a later release. This version only plays live streams.

## Playback with `CastPlayer`

```tsx
import { CastPlayer, TYPES } from '@convay/cast-sdk/react';

<CastPlayer
  type={TYPES.LIVE}
  resourceId={streamId}
  clientId={clientId}
  playbackUrl={viewUrl}
  getAccessToken={async ({ resourceId, viewerId }) => {
    const res = await fetch('/api/cast/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamId: resourceId, viewerId }),
    });
    if (!res.ok) throw new Error('Access failed');
    return res.json(); // { token, expiration }
  }}
/>
```

`viewerId` is optional. If omitted, the SDK stores a UUID in `localStorage` (`cast_sdk:viewer_id`).

`getAccessToken` is called on the first `.ts` request and again about 15 seconds before the token expires. The playlist URL (`playbackUrl`) is loaded without auth. Segment URLs get `token`, `exp`, `stream_id`, `client_id`, and `viewer_id`.

### Props

| Prop | Required | Notes |
|------|----------|--------|
| `type` | yes | `TYPES.LIVE` (only implemented path) |
| `resourceId` | yes | Live `stream_id` |
| `clientId` | yes | Partner account id; attached to `.ts` URLs |
| `playbackUrl` | yes | HLS `view_url` (`https://host/hls/stream.m3u8`) |
| `getAccessToken` | yes | Returns `{ token, expiration }` (unix seconds) |
| `viewerId` | no | Override the SDK-managed viewer id |
| `autoPlay` / `muted` / `controls` / `className` / `poster` | no | Passed through to `<video>` |
| `onError` / `onReady` | no | Fatal HLS errors; manifest parsed |

How you obtain `resourceId`, `clientId`, and `playbackUrl` is up to you (your API, a share link, etc.).

### Access token contract

`getAccessToken` receives:

```ts
{ type, resourceId, clientId, viewerId }
```

Your backend should call CastAPI `POST /api/stream/access` with a partner JWT and body `{ stream_id, viewer_id }`, then return `{ token, expiration }` to the browser. Keep the CastAPI JWT on the server.

## Identifiers

| Name | Where it comes from | Role |
|------|---------------------|------|
| `clientId` | You pass it into `CastPlayer` | Account that owns the stream; query param on `.ts` |
| `resourceId` | Your app (e.g. `stream_id`) | Stream record; bound into the segment token |
| `viewerId` | SDK (`localStorage` UUID) unless you pass one | Viewer fingerprint for token signing |
| `playbackUrl` | Your app (e.g. `view_url`) | HLS playlist; no auth on manifest |

## Install

```bash
npm install @convay/cast-sdk hls.js react
```

Until the package is published:

```bash
npm install ../stream-web-sdk
npm install hls.js
```

`hls.js` and `react` are peer dependencies of the React player.

## Custom / non-React player

```js
import Hls from 'hls.js';
import { createTokenRefreshFunction, createHlsConfig, TYPES } from '@convay/cast-sdk';

const refresh = createTokenRefreshFunction({
  type: TYPES.LIVE,
  resourceId: streamId,
  clientId,
  viewerId,
  getAccessToken,
});

const hls = new Hls(createHlsConfig({ playbackUrl, tokenRefresh: refresh }));
hls.loadSource(playbackUrl);
hls.attachMedia(videoElement);
```

## Build

```bash
cd stream-web-sdk
npm install
npm run build
```

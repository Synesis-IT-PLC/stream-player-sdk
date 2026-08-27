# stream-web-sdk (`@convay/cast-sdk`)

JavaScript/TypeScript SDK for gated HLS playback.

Partners render `CastPlayer` in the browser. The player never talks to CastAPI. Your app calls **your** backend; your backend calls CastAPI for short-lived segment tokens.

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
| `resourceId` | Live `stream_id` from stream-key | Stream record; bound into the segment token |
| `viewerId` | SDK (`localStorage` UUID) unless you pass one | Viewer fingerprint for token signing |
| `playbackUrl` | Stream-key `view_url` | HLS playlist; no `stream_id` in the path |

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

## Create a stream (`CastClient`)

Use `CastClient` from your app or backend tooling to allocate ingest keys. The JWT from `login()` must stay on a trusted surface in production; the demo app talks to CastAPI directly for convenience.

```js
import { CastClient } from '@convay/cast-sdk';

const client = new CastClient({
  baseUrl: 'https://your-backend.example.com',
  endpoints: {
    token: '/auth/token',
    streamKey: '/stream/key',
    access: '/stream/access',
    end: '/stream/end',
    status: '/stream/status',
  },
});

await client.login({ email: 'user@example.com', password: 'secret' });
const stream = await client.createStream({ title: 'My live' });
// stream.stream_id, stream.view_url, stream.stream_url, stream.stream_key
```

Relative paths are joined with `baseUrl`. Absolute URLs skip `baseUrl`.

The SDK does **not** persist the JWT. After `login()`, keep `client.authToken` yourself if you need it across reloads, then pass it back as `token` when you construct `CastClient`.

Point OBS at `stream_url` with `stream_key`. Give viewers `stream_id`, `view_url`, and `clientId`.

### Endpoints `CastClient` can call

| Config key | Method | Typical job | Request body | Response |
|------------|--------|-------------|--------------|----------|
| `token` | `POST` | Sign in | `{ email, password }` | Envelope; `data` is a JWT string |
| `streamKey` | `POST` | Create / allocate a stream | `{ title }` | Envelope; `data` is `{ stream_id, stream_url, stream_key, view_url }` |
| `access` | `POST` | Segment token for playback | `{ stream_id, viewer_id }` | Envelope; `data` is `{ token, expiration }` |
| `end` | `POST` | Disconnect / end a stream | `{ stream_id }` | Envelope; success + message, no `data` |
| `status` | `POST` | Live or not | `{ stream_id }` | `{ stream_id, is_live }` (no envelope) |

Envelope used by `token`, `streamKey`, `access`, and `end`:

```json
{ "success": true, "message": "...", "data": {} }
```

```js
await client.getStatus(stream.stream_id);
await client.endStream(stream.stream_id);
client.logout();
```

### Custom / non-React player

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

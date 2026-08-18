# stream-web-sdk (`@convay/cast-sdk`)

Standalone JavaScript/TypeScript client for gated HLS playback.

It hides three things partners should not have to wire by hand:

1. Login and the JWT `client_id` claim
2. Stream creation, which returns `stream_id` and the real playback URL
3. Segment auth: short-lived tokens plus `stream_id`, `client_id`, and `viewer_id` on `.ts` requests

The SDK does **not** know your host or your routes. You must pass `baseUrl` and every path (or full URLs). There are no CastAPI defaults.

Playback URLs look like `https://example.com/hls/stream.m3u8`. Do **not** put `stream_id` in the path. The SDK keeps `stream_id` next to the JWT `client_id` and attaches both as query params on media segments.

## Identifiers

| Name | Where it comes from | Role |
|------|---------------------|------|
| `client_id` | JWT after login | Account that owns the stream |
| `stream_id` | stream-key response | Stream record; required for access tokens |
| `viewer_id` | SDK (`localStorage` UUID) | Stable viewer fingerprint for token signing |
| `view_url` | stream-key field | Real HLS playlist URL (`https://host/hls/stream.m3u8`) |
| `stream_url` / `stream_key` | stream-key fields | OBS / encoder ingest |

## Endpoints the SDK calls

You map each of these to **your** backend (a BFF/proxy in front of CastAPI). The SDK only concatenates `baseUrl` + path, or uses an absolute URL as-is.

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

## Install

```bash
npm install @convay/cast-sdk hls.js
```

Until the package is published:

```bash
npm install ../stream-web-sdk
npm install hls.js
```

## Usage

```js
import Hls from 'hls.js';
import { CastClient } from '@convay/cast-sdk';

const client = new CastClient({
  baseUrl: 'https://your-backend.example.com',
  paths: {
    token: '/auth/token',
    streamKey: '/stream/key',
    access: '/stream/access',
    end: '/stream/end',
    status: '/stream/status',
  },
});

await client.login({ email: 'user@example.com', password: 'secret' });
// client.clientId  <- from the JWT, never from the HLS URL

const stream = await client.createStream({ title: 'My live' });
// stream.stream_id
// stream.view_url   -> https://host/hls/stream.m3u8
// stream.stream_url + stream.stream_key  -> encoder

const hls = new Hls(
  client.createHlsConfig({
    streamId: stream.stream_id,
    playbackUrl: stream.view_url,
  }),
);
hls.loadSource(stream.view_url);
hls.attachMedia(videoElement);
```

Relative paths are joined with `baseUrl`. Absolute URLs skip `baseUrl`:

```js
new CastClient({
  paths: {
    token: 'https://auth.example.com/login',
    streamKey: 'https://api.example.com/streams/key',
    access: 'https://api.example.com/streams/access',
    end: 'https://api.example.com/streams/end',
    status: 'https://api.example.com/streams/status',
  },
});
```

Point OBS at `stream_url` with `stream_key`. The player loads `view_url` unchanged. The SDK calls your `access` URL and refreshes the segment token about 15 seconds before expiry.

### Play a stream you already created

If you already have `stream_id` and `view_url` from an earlier stream-key call:

```js
await client.login({ email, password });

const hls = new Hls(
  client.createHlsConfig({
    streamId: '0abc...',
    playbackUrl: 'https://example.com/hls/stream.m3u8',
  }),
);
```

### React / custom player

Use the token refresh callback instead of `createHlsConfig`:

```js
const refresh = client.createTokenRefreshFunction({ streamId: stream.stream_id });
const { segmentToken, segmentExpiry, segmentAuthParams } = await refresh();
```

`segmentAuthParams` is `{ stream_id, client_id, viewer_id }`. Append those plus `token` and `exp` to `.ts` URLs only (leave `.m3u8` playlists unauthenticated).

To check live status, disconnect a stream, fetch a segment token once, or sign out:

```js
await client.getStatus(stream.stream_id);
await client.endStream(stream.stream_id);
await client.requestAccess(stream.stream_id);
client.logout();
```

## Configuration

```js
new CastClient({
  baseUrl: 'https://your-backend.example.com',
  paths: {
    token: '/auth/token',
    streamKey: '/stream/key',
    access: '/stream/access',
    end: '/stream/end',
    status: '/stream/status',
  },
  token: existingJwt,          // optional restore
  persistSession: true,        // JWT in localStorage (1 hour)
});
```

## Build

```bash
cd stream-web-sdk
npm install
npm run build
```

# stream-web-sdk (`@convay/cast-sdk`)

Standalone JavaScript/TypeScript client for CastAPI gated HLS playback.

It hides three things partners should not have to wire by hand:

1. Login (`POST /api/auth/token`) and the JWT `client_id` claim
2. Stream creation (`POST /api/stream/key`) which returns `stream_id` and the real playback URL
3. Segment auth: short-lived tokens plus `stream_id`, `client_id`, and `viewer_id` on `.ts` requests

Playback URLs look like `https://example.com/hls/stream.m3u8`. Do **not** put `stream_id` in the path. The SDK keeps `stream_id` next to the JWT `client_id` and attaches both as query params on media segments.

## Identifiers

| Name | Where it comes from | Role |
|------|---------------------|------|
| `client_id` | JWT after login | Account that owns the stream |
| `stream_id` | `/api/stream/key` response | CastAPI stream record; required for access tokens |
| `viewer_id` | SDK (`localStorage` UUID) | Stable viewer fingerprint for token signing |
| `view_url` | `/key` field | Real HLS playlist URL (`https://host/hls/stream.m3u8`) |
| `stream_url` / `stream_key` | `/key` fields | OBS / encoder ingest |

## Install

Until this package is published:

```bash
# from this directory after `npm run build`, or from a sibling app:
npm install ../stream-web-sdk
```

Also install `hls.js` in the app that plays video:

```bash
npm install hls.js
```

## Usage

```js
import Hls from 'hls.js';
import { CastClient } from '@convay/cast-sdk';

const client = new CastClient({
  baseUrl: 'https://dev-cast.convay.com/cast',
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

Point OBS at `stream_url` with `stream_key`. The player loads `view_url` unchanged. The SDK calls `/api/stream/access` and refreshes the segment token about 15 seconds before expiry.

## API payloads (as returned by CastAPI)

Envelope (`ApiResponse`) for `/api/auth/token`, `/api/stream/key`, `/api/stream/access`, `/api/stream/end`:

```json
{ "success": true, "message": "...", "data": {} }
```

| Endpoint | `data` / body |
|----------|----------------|
| `POST /api/auth/token` | JWT string |
| `POST /api/stream/key` | `{ stream_id, stream_url, stream_key, view_url }` |
| `POST /api/stream/access` | `{ token, expiration }` |
| `POST /api/stream/end` | no `data` (success + message only) |
| `POST /api/stream/status` | `{ stream_id, is_live }` (no envelope) |
| `GET /api/stream/list` | `[{ stream_id, title, server_id, updated_at }]` (no envelope) |
| `GET /api/streams/{id}/title` | `{ stream_title }` (no envelope) |

### Play a stream you already created

If you already have `stream_id` and `view_url` from an earlier `/key` call:

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

### Other stream APIs

```js
await client.getStatus(stream.stream_id);
await client.listStreams();
await client.endStream(stream.stream_id);
await client.requestAccess(stream.stream_id);
await client.getStreamTitle(stream.stream_id);
client.logout();
```

## Configuration

```js
new CastClient({
  baseUrl: 'https://dev-cast.convay.com/cast',
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

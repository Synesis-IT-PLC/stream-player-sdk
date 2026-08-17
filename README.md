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
| `playbackUrl` | `/key` field `view_url` | Real HLS playlist URL |
| `ingestUrl` / `streamKey` | `/key` fields `stream_url` / `stream_key` | OBS / encoder ingest |

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
// stream.streamId
// stream.playbackUrl  -> https://host/hls/stream.m3u8
// stream.ingestUrl + stream.streamKey  -> encoder

const hls = new Hls(
  client.createHlsConfig({
    streamId: stream.streamId,
    playbackUrl: stream.playbackUrl,
  }),
);
hls.loadSource(stream.playbackUrl);
hls.attachMedia(videoElement);
```

Point OBS at `ingestUrl` with `streamKey`. The player loads `playbackUrl` unchanged. The SDK calls `/api/stream/access` and refreshes the segment token about 15 seconds before expiry.

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
const refresh = client.createTokenRefreshFunction({ streamId: stream.streamId });
const { segmentToken, segmentExpiry, segmentAuthParams } = await refresh();
```

`segmentAuthParams` is `{ stream_id, client_id, viewer_id }`. Append those plus `token` and `exp` to `.ts` URLs only (leave `.m3u8` playlists unauthenticated).

### Other stream APIs

```js
await client.getStatus(stream.streamId);
await client.listStreams();
await client.endStream(stream.streamId);
await client.requestAccess(stream.streamId);
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

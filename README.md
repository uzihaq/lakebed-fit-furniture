# Fit — multiplayer furniture planner (on Lakebed)

A real-time, multiplayer furniture-arranging tool. Paste a screenshot of your
floor plan, set the scale with a two-point measurement, then drag furniture onto
it — everyone in the same room sees changes live.

It's a from-scratch port of the **fit.furniture** app onto the
[Lakebed](https://lakebed.dev) capsule runtime (Preact client + server +
WebSocket transport), built to look as good as the original within Lakebed's
constraints.

**Live:** https://fit.lakebed.app — open `#<any-room-name>` to make/join a room
(the URL is the share link; anyone with it can view and edit as a guest).

## How it works

- **Client** (`client/index.tsx`) — Preact UI: the catalog, the canvas, drag /
  rotate / recolor, the paste-to-floor-plan flow, two-point scale calibration,
  and a responsive layout (catalog rail on desktop, slide-in drawer on mobile).
  Furniture is drawn top-down with layered CSS (no image assets).
- **Server** (`server/index.ts`) — one Lakebed capsule with a single `rooms`
  table; furniture lives as a JSON array on the room row. Mutations are
  per-item so two people editing different pieces don't clobber each other.
  Reactivity comes from the `rooms` query re-running on every write.

## Constraints this was built around (Lakebed)

- No LLM calls. No file/blob storage → the floor plan is grayscaled and
  downscaled to a base64 data-URI stored in the DB.
- No server-side loops → mutations use `map` / `filter` / `find` only.
- ~1 MB total state per capsule; 5 s per-request cap.

## Deploy

The claimed/anonymous auto-decision is flaky, so force the dev token:

```sh
LAKEBED_TOKEN="$(python3 -c "import json;print(json.load(open('$HOME/.lakebed/developer-auth.json'))['profiles']['https://api.lakebed.dev']['token'])")" \
  npx -y lakebed@0.0.25 deploy --json
```

`lakebed.json` pins the deploy id so redeploys update the same capsule (and the
`fit.lakebed.app` subdomain).

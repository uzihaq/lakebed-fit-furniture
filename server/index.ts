import { capsule, mutation, query, string, table } from "lakebed/server";

// Fit — multiplayer furniture arranger. One capsule store, partitioned by room.
// Furniture lives as a JSON array on the room row (simple, well under 1MB at
// demo scale). Per-item mutations update only the touched item so two people
// editing different pieces don't clobber each other. No loops — only find/map/
// filter/push (array methods), which the build-time analyzer allows.
export default capsule({
  name: "Fit",
  schema: {
    rooms: table({
      ownerId: string(),
      name: string(),
      slug: string(),
      floorPlan: string(), // grayscale base64 data URI, or ""
      ppi: string(),       // pixels-per-inch from manual calibration, or ""
      items: string(),     // JSON array of furniture
    }),
  },
  queries: {
    // queries take no args in Lakebed; everyone gets all rooms and the client
    // selects the one matching the URL slug.
    rooms: query((ctx) => ctx.db.rooms.all()),
  },
  mutations: {
    ensureRoom: mutation((ctx, slug: string) => {
      const s = (slug || "").trim();
      if (!s) return;
      if (ctx.db.rooms.all().some((r) => r.slug === s)) return;
      ctx.db.rooms.insert({ ownerId: ctx.auth.userId, name: "Untitled room", slug: s, floorPlan: "", ppi: "", items: "[]" });
    }),
    rename: mutation((ctx, payload: string) => {
      const { slug, name } = JSON.parse(payload || "{}");
      const room = ctx.db.rooms.all().find((r) => r.slug === slug);
      if (room && typeof name === "string") ctx.db.rooms.update(room.id, { name: name.slice(0, 80) || "Untitled room" });
    }),
    setFloorPlan: mutation((ctx, payload: string) => {
      const { slug, floorPlan, ppi } = JSON.parse(payload || "{}");
      const room = ctx.db.rooms.all().find((r) => r.slug === slug);
      if (!room) return;
      ctx.db.rooms.update(room.id, {
        floorPlan: typeof floorPlan === "string" ? floorPlan : room.floorPlan,
        ppi: ppi != null ? String(ppi) : room.ppi,
      });
    }),
    setPpi: mutation((ctx, payload: string) => {
      const { slug, ppi } = JSON.parse(payload || "{}");
      const room = ctx.db.rooms.all().find((r) => r.slug === slug);
      if (room) ctx.db.rooms.update(room.id, { ppi: String(ppi) });
    }),
    addItem: mutation((ctx, payload: string) => {
      const { slug, item } = JSON.parse(payload || "{}");
      const room = ctx.db.rooms.all().find((r) => r.slug === slug);
      if (!room || !item || !item.id) return;
      const items = JSON.parse(room.items || "[]");
      items.push(item);
      ctx.db.rooms.update(room.id, { items: JSON.stringify(items) });
    }),
    moveItem: mutation((ctx, payload: string) => {
      const { slug, id, x, y, rotation } = JSON.parse(payload || "{}");
      const room = ctx.db.rooms.all().find((r) => r.slug === slug);
      if (!room) return;
      const items = JSON.parse(room.items || "[]").map((it: any) =>
        it.id === id ? { ...it, x, y, rotation: rotation != null ? rotation : it.rotation } : it
      );
      ctx.db.rooms.update(room.id, { items: JSON.stringify(items) });
    }),
    patchItem: mutation((ctx, payload: string) => {
      const { slug, id, patch } = JSON.parse(payload || "{}");
      const room = ctx.db.rooms.all().find((r) => r.slug === slug);
      if (!room || !patch) return;
      const items = JSON.parse(room.items || "[]").map((it: any) => (it.id === id ? { ...it, ...patch } : it));
      ctx.db.rooms.update(room.id, { items: JSON.stringify(items) });
    }),
    removeItem: mutation((ctx, payload: string) => {
      const { slug, id } = JSON.parse(payload || "{}");
      const room = ctx.db.rooms.all().find((r) => r.slug === slug);
      if (!room) return;
      const items = JSON.parse(room.items || "[]").filter((it: any) => it.id !== id);
      ctx.db.rooms.update(room.id, { items: JSON.stringify(items) });
    }),
  },
});

// Trade account applications from /wholesale.
// POST /api/trade {name, business, email, type, town, web, interest} -> {ok:true}
// Stored in D1 table trade_applications; read by Claude's daily check and passed to John.

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "unavailable" }, 503);
  const origin = request.headers.get("Origin") || "";
  if (origin && !/^https:\/\/([a-z0-9-]+\.)*(saffronstill\.com|saffronstill-site\.pages\.dev)$/.test(origin)) {
    return json({ error: "Not allowed." }, 403);
  }
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: "Please try again." }, 400); }
  if (clip(b.hp, 50)) return json({ ok: true }); // bot trap
  const r = {
    name: clip(b.name, 120), business: clip(b.business, 160), email: clip(b.email, 200),
    type: clip(b.type, 80), town: clip(b.town, 120), web: clip(b.web, 300), interest: clip(b.interest, 2000),
  };
  if (!r.name || !r.business || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) {
    return json({ error: "Please fill in your name, business name and a valid email." }, 400);
  }
  await env.DB.prepare(
    "INSERT INTO trade_applications (created, name, business, email, type, town, web, interest) VALUES (datetime('now'),?1,?2,?3,?4,?5,?6,?7)"
  ).bind(r.name, r.business, r.email, r.type, r.town, r.web, r.interest).run();
  return json({ ok: true });
}

// Scent scorecard: visitors rate a perfume 1-5 on four things.
// GET  /api/scorecard?p=<product-slug>  -> { n, avg: {longevity, projection, sweetness, compliments} }
// POST /api/scorecard {p, longevity, projection, sweetness, compliments} -> same summary
// One score per perfume, per visitor, per day (visitor is a salted hash, never stored raw).

const FIELDS = ["longevity", "projection", "sweetness", "compliments"];
const SLUG = /^[a-z0-9][a-z0-9-]{2,119}$/;

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

async function summary(db, p) {
  const r = await db
    .prepare(
      "SELECT COUNT(*) AS n, AVG(longevity) AS longevity, AVG(projection) AS projection, AVG(sweetness) AS sweetness, AVG(compliments) AS compliments FROM scores WHERE product = ?1"
    )
    .bind(p)
    .first();
  const avg = {};
  FIELDS.forEach((f) => (avg[f] = r && r[f] ? Math.round(r[f] * 10) / 10 : 0));
  return { p, n: (r && r.n) || 0, avg };
}

async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet({ request, env }) {
  const p = new URL(request.url).searchParams.get("p") || "";
  if (!SLUG.test(p)) return json({ error: "Unknown perfume." }, 400);
  if (!env.DB) return json({ p, n: 0, avg: {} });
  return json(await summary(env.DB, p));
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Scores are not available right now." }, 503);
  const origin = request.headers.get("Origin") || "";
  if (origin && !/^https:\/\/([a-z0-9-]+\.)*(saffronstill\.com|saffronstill-site\.pages\.dev)$/.test(origin)) {
    return json({ error: "Not allowed." }, 403);
  }
  let b;
  try {
    b = await request.json();
  } catch (e) {
    return json({ error: "Please try again." }, 400);
  }
  const p = String((b && b.p) || "");
  if (!SLUG.test(p)) return json({ error: "Unknown perfume." }, 400);
  const v = {};
  for (const f of FIELDS) {
    const n = Number(b[f]);
    if (!Number.isInteger(n) || n < 1 || n > 5) return json({ error: "Please give every score from 1 to 5." }, 400);
    v[f] = n;
  }
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const ua = request.headers.get("User-Agent") || "";
  const day = new Date().toISOString().slice(0, 10);
  const voter = await sha(["ss-scorecard", ip, ua, p, day].join("|"));
  try {
    await env.DB
      .prepare("INSERT INTO scores (product, longevity, projection, sweetness, compliments, voter) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
      .bind(p, v.longevity, v.projection, v.sweetness, v.compliments, voter)
      .run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) {
      return json({ error: "You have already scored this perfume today. Thank you!" }, 429);
    }
    return json({ error: "Sorry, that did not send. Please try again." }, 500);
  }
  return json(await summary(env.DB, p));
}

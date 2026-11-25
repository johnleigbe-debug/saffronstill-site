// Serves Staribee product photos for the wholesale range from our own domain.
// /sb/792.webp -> Staribee product image 792, cached at the edge for a week.
export async function onRequest({ params }) {
  const id = String(params.id || "").replace(/\.webp$/, "");
  if (!/^\d{1,6}$/.test(id)) return new Response("Not found", { status: 404 });
  const src = `https://trade.staribee.co.uk/web/image/product.template/${id}/image_1024`;
  const r = await fetch(src, { cf: { cacheTtl: 604800, cacheEverything: true } });
  if (!r.ok) return new Response("Not found", { status: 404 });
  return new Response(r.body, {
    headers: {
      "content-type": r.headers.get("content-type") || "image/webp",
      "cache-control": "public, max-age=604800",
    },
  });
}

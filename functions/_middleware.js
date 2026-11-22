// Send www.saffronstill.com to saffronstill.com with a permanent redirect,
// so Google indexes one copy of each page.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === "www.saffronstill.com") {
    url.hostname = "saffronstill.com";
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}

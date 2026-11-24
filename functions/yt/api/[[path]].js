// Same-origin proxy to the download server on brach. Without it the browser would have to call
// brach directly, which on tailnet devices resolves to a private address and hangs on Chrome's
// local-network permission prompt.
const upstream = "https://brach.taild3399f.ts.net:10000";

export function onRequest({ request, params }) {
  const path = [].concat(params.path || []).join("/");
  return fetch(new Request(`${upstream}/${path}`, request));
}

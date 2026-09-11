const mem = {};
async function splash(id) {
  if (mem[id] && Date.now() - mem[id].t < 6 * 60 * 60 * 1000) return mem[id].u;
  try {
    const r = await fetch("https://streamtape.com/e/" + id + "/", { headers: { "user-agent": "Mozilla/5.0", accept: "text/html" } });
    const html = await r.text();
    const m = html.match(/https:\/\/thumb\.tapecontent\.net\/thumb\/[^"'\s]+/);
    if (m) {
      mem[id] = { t: Date.now(), u: m[0] };
      return mem[id].u;
    }
  } catch (_) {}
  return "";
}
module.exports = async function handler(req, res) {
  const id = String((req.query && req.query.id) || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!id) { res.status(400).end(); return; }
  try {
    const url = await splash(id);
    if (url) { res.writeHead(302, { Location: url, "Cache-Control": "public, s-maxage=86400" }); res.end(); return; }
  } catch (_) {}
  res.writeHead(302, { Location: "/api/thumb?h=x&id=" + encodeURIComponent(id) });
  res.end();
};

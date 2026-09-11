const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#141414"/><circle cx="320" cy="180" r="34" fill="#ff9000"/><polygon points="310,164 342,180 310,196" fill="#111"/></svg>');
module.exports = async (req, res) => {
  const id = String(req.query.id || "").replace(/[^A-Za-z0-9_-]/g, "");
  const h = String(req.query.h || "").toLowerCase();
  res.setHeader("cache-control", "public, max-age=604800");
  if (!id) { res.setHeader("content-type", "image/svg+xml"); return res.status(200).send(SVG); }
  const pages = [];
  if (h === "indoav") pages.push("https://tv1.indoav.app/e/" + id);
  else if (h === "userbokep") pages.push("https://tv1.userbokep.com/e/" + id);
  else if (h === "lulu") pages.push("https://luluvdo.com/e/" + id);
  else { pages.push("https://tv1.indoav.app/e/" + id); pages.push("https://tv1.userbokep.com/e/" + id); }
  for (const page of pages) {
    try {
      const r = await fetch(page, { headers: { "user-agent": "Mozilla/5.0" } });
      if (!r.ok) continue;
      const html = await r.text();
      const m = html.match(/poster="(https:\/\/[^"\s]+)"/i) || html.match(/og:image[^>]+content="(https:\/\/[^"]+)"/i);
      const img = m && (m[1] || m[0]);
      if (!img || /logo\.png|embedan/i.test(img)) continue;
      const ir = await fetch(img, { headers: { "user-agent": "Mozilla/5.0", accept: "image/*" } });
      if (!ir.ok) continue;
      const buf = Buffer.from(await ir.arrayBuffer());
      if (buf.length < 200) continue;
      res.setHeader("content-type", ir.headers.get("content-type") || "image/jpeg");
      return res.status(200).send(buf);
    } catch (_) {}
  }
  res.setHeader("content-type", "image/svg+xml");
  return res.status(200).send(SVG);
};

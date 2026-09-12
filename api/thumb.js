let cache = { t: 0, map: {} };

async function loadMaps() {
  if (cache.map && Object.keys(cache.map).length && Date.now() - cache.t < 3 * 60 * 1000) {
    return cache.map;
  }
  const base = "https://raw.githubusercontent.com/fashfdhgacd/koleksi-dr-pinguin/main/data/";
  const map = {};
  const files = ["latest-posters.json", "posters.json"];
  for (let i = 0; i < files.length; i++) {
    try {
      const r = await fetch(base + files[i], { cache: "no-store" });
      if (!r.ok) continue;
      const d = await r.json();
      if (d && typeof d === "object" && !Array.isArray(d)) Object.assign(map, d);
    } catch (_) {}
  }
  cache = { t: Date.now(), map: map };
  return map;
}

function isLulu(host) {
  return /^(lulu|luluvdo|lulustream|ll|x|cdn)$/i.test(String(host || ""));
}

async function fetchText(url, ms) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (_) {} }, ms || 7000) : null;
  try {
    const r = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml"
      },
      signal: ctrl ? ctrl.signal : undefined,
      redirect: "follow"
    });
    if (!r.ok) return "";
    return await r.text();
  } catch (_) {
    return "";
  } finally {
    if (t) clearTimeout(t);
  }
}

function extractPoster(html) {
  if (!html) return "";
  const patterns = [
    /poster=["'](https?:\/\/[^"'\s]+)["']/i,
    /property=["']og:image["']\s+content=["'](https?:\/\/[^"']+)["']/i,
    /content=["'](https?:\/\/[^"']+)["']\s+property=["']og:image["']/i,
    /https:\/\/(?:i|a)\.embedan\.com\/image\/[^\s"'<>]+/i,
    /https:\/\/img\.lulucdn\.com\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)/i,
    /https:\/\/thumb\.tapecontent\.net\/thumb\/[^\s"'<>]+/i,
    /https:\/\/[^"'<>\s]+\/(?:poster|thumb|splash|cover)[^"'<>\s]*\.(?:jpg|jpeg|png|webp)/i
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = html.match(patterns[i]);
    if (m) {
      const u = (m[1] || m[0] || "").replace(/&/g, "&").trim();
      if (u && /^https?:\/\//i.test(u) && !/logo\.png$/i.test(u)) return u;
    }
  }
  return "";
}

async function scrape(host, id) {
  const allow = {
    indoav: ["https://tv1.indoav.app/e/", "https://tv1.indoav.app/d/"],
    userbokep: ["https://tv1.userbokep.com/e/", "https://tv1.userbokep.com/d/"],
    lulu: ["https://luluvdo.com/e/"],
    luluvdo: ["https://luluvdo.com/e/"],
    lulustream: ["https://luluvdo.com/e/"],
    ll: ["https://luluvdo.com/e/"],
    x: ["https://luluvdo.com/e/"],
    cdn: ["https://luluvdo.com/e/"]
  };
  const bases = allow[String(host || "").toLowerCase()] || [];
  if (!bases.length || !id) return "";
  for (let i = 0; i < bases.length; i++) {
    const html = await fetchText(bases[i] + id, 7000);
    const url = extractPoster(html);
    if (url) return url;
  }
  return "";
}

async function sendImage(res, url, referer) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (_) {} }, 8000) : null;
  try {
    const r = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        referer: referer || "https://tv1.userbokep.com/"
      },
      signal: ctrl ? ctrl.signal : undefined,
      redirect: "follow"
    });
    if (!r.ok) return false;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 80) return false;
    let ct = r.headers.get("content-type") || "";
    if (!/^image\//i.test(ct)) {
      if (buf[0] === 0xff && buf[1] === 0xd8) ct = "image/jpeg";
      else if (buf[0] === 0x89 && buf[1] === 0x50) ct = "image/png";
      else if (buf[0] === 0x52 && buf[1] === 0x49) ct = "image/webp";
      else return false;
    }
    res.setHeader("Content-Type", ct.split(";")[0]);
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.status(200).end(buf);
    return true;
  } catch (_) {
    return false;
  } finally {
    if (t) clearTimeout(t);
  }
}

function placeholder(res) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#141414"/><circle cx="320" cy="180" r="34" fill="#ff9000"/><polygon points="310,164 342,180 310,196" fill="#111"/></svg>';
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=30");
  res.status(200).send(svg);
}

module.exports = async function handler(req, res) {
  try {
    const q = req.query || {};
    const id = String(q.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    const host = String(q.h || "").toLowerCase();
    if (!id) {
      placeholder(res);
      return;
    }

    try {
      const map = await loadMaps();
      const mapped = map[id];
      if (mapped && (await sendImage(res, mapped, "https://tv1.userbokep.com/"))) return;
    } catch (_) {}

    if (isLulu(host) || host === "x") {
      const guessed = [
        "https://img.lulucdn.com/" + id + "_xt.jpg",
        "https://img.lulucdn.com/" + id + ".jpg"
      ];
      for (let i = 0; i < guessed.length; i++) {
        if (await sendImage(res, guessed[i], "https://luluvdo.com/")) return;
      }
    }

    if (host) {
      try {
        const scraped = await scrape(host, id);
        if (scraped && (await sendImage(res, scraped, isLulu(host) ? "https://luluvdo.com/" : "https://tv1.userbokep.com/"))) {
          return;
        }
      } catch (_) {}
    }

    if (!host || host === "x") {
      for (const h of ["userbokep", "indoav"]) {
        try {
          const scraped = await scrape(h, id);
          if (scraped && (await sendImage(res, scraped, "https://tv1.userbokep.com/"))) return;
        } catch (_) {}
      }
    }
  } catch (_) {}
  placeholder(res);
};

/**
 * Scrape poster URLs for uploaded items and merge into data/latest-posters.json
 * Never throws — always returns number of posters saved (0 on failure).
 */
function keyOf(u) {
  const s = String(u || "");
  const m =
    s.match(/[?&]id=([A-Za-z0-9_-]+)/) ||
    s.match(/\/(?:e|v|d)\/([A-Za-z0-9_-]+)/) ||
    s.match(/lulu(?:vdo|stream|vid)\.com\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : "";
}

function hostOf(url) {
  const u = String(url || "").toLowerCase();
  if (/userbokep/.test(u)) return "userbokep";
  if (/indoav/.test(u)) return "indoav";
  if (/lulu/.test(u)) return "lulu";
  if (/streamtape|strcloud/.test(u)) return "streamtape";
  if (/videy/.test(u)) return "videy";
  if (/putarin|puterin/.test(u)) return "putarin";
  return "";
}

function embedPage(host, id) {
  const map = {
    userbokep: "https://tv1.userbokep.com/e/" + id,
    indoav: "https://tv1.indoav.app/e/" + id,
    lulu: "https://luluvdo.com/e/" + id,
    streamtape: "https://streamtape.com/e/" + id
  };
  return map[host] || "";
}

async function fetchText(url, ms) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (_) {} }, ms || 8000) : null;
  try {
    const r = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

async function scrapeOne(it) {
  const id = keyOf(it.embed || it.direct);
  if (!id) return null;
  const host = hostOf(it.embed || it.direct);
  const existing = String(it.poster || it.thumb || it.thumbnail || "").trim();
  if (existing && /^https?:\/\//i.test(existing) && !/logo\.png$/i.test(existing)) {
    return { id: id, url: existing };
  }
  const page = embedPage(host, id);
  if (!page) return null;
  const html = await fetchText(page, 8000);
  const url = extractPoster(html);
  if (!url) return null;
  return { id: id, url: url };
}

async function ghGetJson(env, path) {
  const url =
    "https://api.github.com/repos/" +
    env.GH_OWNER +
    "/" +
    env.GH_REPO +
    "/contents/" +
    path +
    "?ref=" +
    (env.GH_BRANCH || "main");
  const r = await fetch(url, {
    headers: {
      authorization: "Bearer " + env.GH_TOKEN,
      accept: "application/vnd.github+json",
      "user-agent": "kdp-bot"
    }
  });
  if (r.status === 404) return { data: {}, sha: null };
  if (!r.ok) throw new Error("GH read " + r.status);
  const file = await r.json();
  const text = Buffer.from(file.content, "base64").toString("utf8");
  let data = {};
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = {};
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
  return { data: data, sha: file.sha };
}

async function ghPutJson(env, path, data, sha, message) {
  const body = {
    message: message || "bot: posters",
    content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
    branch: env.GH_BRANCH || "main"
  };
  if (sha) body.sha = sha;
  const r = await fetch(
    "https://api.github.com/repos/" + env.GH_OWNER + "/" + env.GH_REPO + "/contents/" + path,
    {
      method: "PUT",
      headers: {
        authorization: "Bearer " + env.GH_TOKEN,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "kdp-bot"
      },
      body: JSON.stringify(body)
    }
  );
  if (!r.ok) throw new Error("GH write " + r.status + " " + (await r.text()).slice(0, 120));
  return true;
}

module.exports = async function hookPoster(env, items) {
  try {
    if (!env || !env.GH_TOKEN || !Array.isArray(items) || !items.length) return 0;
    const batch = items.slice(0, 12);
    const found = {};
    for (let i = 0; i < batch.length; i++) {
      try {
        const r = await scrapeOne(batch[i]);
        if (r && r.id && r.url) found[r.id] = r.url;
      } catch (_) {}
    }
    const ids = Object.keys(found);
    if (!ids.length) return 0;
    const path = "data/latest-posters.json";
    const file = await ghGetJson(env, path);
    let added = 0;
    ids.forEach(function (id) {
      if (file.data[id] !== found[id]) {
        file.data[id] = found[id];
        added++;
      }
    });
    const keys = Object.keys(file.data);
    if (keys.length > 500) {
      keys.slice(0, keys.length - 500).forEach(function (k) {
        delete file.data[k];
      });
    }
    if (!added) return 0;
    await ghPutJson(env, path, file.data, file.sha, "bot: +" + added + " posters");
    return added;
  } catch (_) {
    return 0;
  }
};

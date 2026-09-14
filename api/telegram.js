const hookPoster = require("./poster-hook");
function pickEnv(keys) {
  for (const key of keys) {
    const val = process.env[key];
    if (val && String(val).trim()) return String(val).trim();
  }
  return "";
}
function getEnv() {
  return {
    BOT_TOKEN: pickEnv(["BOT_TOKEN", "BOT_TOKENN", "TELEGRAM_BOT_TOKEN"]),
    GH_TOKEN: pickEnv(["GH_TOKEN", "GH_TOKENN", "GITHUB_TOKEN"]),
    GH_OWNER: pickEnv(["GH_OWNER", "GH_OWNERR", "GITHUB_OWNER"]) || "fashfdhgacd",
    GH_REPO: pickEnv(["GH_REPO", "GH_REPOO", "GITHUB_REPO"]) || "koleksi-dr-pinguin",
    GH_PATH: pickEnv(["GH_PATH", "GH_PATHH"]) || "data/videos.json",
    GH_BRANCH: pickEnv(["GH_BRANCH", "GH_BRANCHH"]) || "main",
    TELEGRAM_USER_ID: pickEnv(["TELEGRAM_USER_ID", "TELEGRAM_ADMIN_ID"]) || "7747474006",
    PUBLIC_HOST: pickEnv(["PUBLIC_HOST"]) || "https://koleksidrpinguin.site"
  };
}
const MENU = { keyboard: [[{ text: "Terbaru" }, { text: "Minta 10" }, { text: "Minta 25" }], [{ text: "Semua" }, { text: "Amatir" }, { text: "Umum" }], [{ text: "Videy" }, { text: "Lulu" }, { text: "Putarin" }], [{ text: "Campur" }, { text: "AI" }, { text: "Lagi" }], [{ text: "Menu" }]], resize_keyboard: true, persistent: true };
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const env = getEnv();
  if (req.method === "GET") return res.status(200).json({ ok: true, service: "telegram-webhook", ready: Boolean(env.BOT_TOKEN), hasBot: Boolean(env.BOT_TOKEN), hasGh: Boolean(env.GH_TOKEN), host: env.PUBLIC_HOST, hosts: ["https://www.koleksidrpinguin.com", "https://www.koleksidrpinguin.site"] });
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const update = typeof req.body === "string" ? (function () { try { return JSON.parse(req.body); } catch (e) { return {}; } }()) : (req.body || {});
  try {
    await handleUpdate(update, env);
  } catch (e) {
    try {
      const msg = update.message || update.channel_post;
      const chatId = msg && msg.chat && msg.chat.id;
      if (chatId && env.BOT_TOKEN) {
        await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: "Error: " + String((e && e.message) || e).slice(0, 300) })
        });
      }
    } catch (_) {}
  }
  return res.status(200).json({ ok: true });
};
function allowed(u) { return /videy\.co|indoav\.|userbokep\.com|putarin\.(com|biz|xyz)|puterin\.(com|biz|xyz)|luluvdo\.com|lulustream\.com|luluvid\.com|lulu\.st|streamtape\.com|strcloud/i.test(String(u || "")); }
function blocked(u) { return /vicek\.id|exastream|mumu\.watch|mumustream/i.test(String(u || "")); }
async function reply(env, chatId, text, keyboard) {
  await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text, reply_markup: keyboard || MENU })
  });
}
function keyOf(u) {
  const s = String(u || "");
  const m = s.match(/[?&]id=([A-Za-z0-9_-]+)/) || s.match(/\/(?:e|v|d)\/([A-Za-z0-9_-]+)/) || s.match(/lulu(?:vdo|stream|vid)\.com\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : "";
}
function toItem(url, titleHint) {
  const low = url.toLowerCase();
  let category = "Amatir", source = "Telegram", embed = url, direct = url;
  const id = keyOf(url);
  if (low.includes("videy.co")) {
    category = "Videy"; source = "Videy";
    const ext = (id.length === 9 && id.endsWith("2")) ? ".mov" : ".mp4";
    direct = id ? ("https://cdn.videy.co/" + id + ext) : url;
    embed = id ? ("https://videy.co/v/?id=" + id) : url;
  } else if (/putarin|puterin/.test(low)) {
    category = "Putarin"; source = "Putarin";
    embed = "https://puterin.biz/e/" + id; direct = "https://puterin.biz/v/" + id;
  } else if (/lulu/.test(low)) {
    category = "Campur"; source = "Lulustream";
    embed = "https://luluvdo.com/e/" + id; direct = embed;
  } else if (/streamtape|strcloud/.test(low)) {
    category = "Campur"; source = "Streamtape";
    embed = "https://streamtape.com/e/" + id; direct = embed;
  } else if (/indoav/.test(low)) {
    category = "Umum"; source = "IndoAV";
    embed = "https://tv1.indoav.app/e/" + id; direct = embed;
  } else if (/userbokep/.test(low)) {
    category = "Amatir"; source = "Userbokep";
    embed = "https://tv1.userbokep.com/e/" + id; direct = embed;
  }
  let title = String(titleHint || "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  if (/\bai\b/i.test(title)) category = "AI";
  if (!title) title = category + " " + id;
  return { title: title, direct: direct, embed: embed, source: source, category: category, tags: ["telegram"].concat(/\bai\b/i.test(title) ? ["ai"] : []), date: new Date().toISOString().slice(0, 10) };
}
function parseItems(text) {
  const items = [];
  const lines = String(text).split(/\r?\n/);
  let pending = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const m = line.match(/https?:\/\/[^\s<>"']+/i);
    if (m) {
      const url = m[0].replace(/[).,]+$/, "");
      if (blocked(url) || !allowed(url)) continue;
      const same = line.replace(m[0], " ").trim();
      const it = toItem(url, same || pending);
      items.push(it); pending = "";
    } else if (!line.startsWith("/")) pending = line;
  }
  return items;
}
function pathOf(it) {
  const u = String(it.embed || "") + " " + String(it.category || "");
  if (/puterin|putarin/.test(u)) return "data/putarin.json";
  if (/lulu|streamtape|strcloud/.test(u)) return "data/campur.json";
  if (/videy/.test(u)) return "data/videy.json";
  if (/userbokep|amatir/i.test(u)) return "data/amatir.json";
  return "data/umum.json";
}
async function ghGet(env, path) {
  const url = "https://api.github.com/repos/" + env.GH_OWNER + "/" + env.GH_REPO + "/contents/" + path + "?ref=" + (env.GH_BRANCH || "main");
  const r = await fetch(url, { headers: { authorization: "Bearer " + env.GH_TOKEN, accept: "application/vnd.github+json", "user-agent": "kdp-bot" } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("GH read " + r.status);
  return r.json();
}
async function mergeAndPush(env, path, add) {
  const file = await ghGet(env, path);
  const list = file ? JSON.parse(Buffer.from(file.content, "base64").toString("utf8")) : [];
  const seen = {};
  list.forEach(function (v, i) { const k = keyOf(v.embed || v.direct); if (k) seen[k] = i; });
  let added = 0, updated = 0, skipped = 0;
  add.forEach(function (it) {
    const k = keyOf(it.embed || it.direct);
    if (!k) { skipped++; return; }
    if (seen[k] !== undefined) {
      const old = list[seen[k]];
      if (it.title && it.title !== old.title) { old.title = it.title; updated++; }
      if (it.category) old.category = it.category;
      old.date = it.date || old.date;
      return;
    }
    seen[k] = 0; list.unshift(it); added++;
  });
  if (!added && !updated) return { added: 0, skipped: skipped, updated: 0 };
  const body = {
    message: "bot: +" + added + " upd " + updated + " " + path,
    content: Buffer.from(JSON.stringify(list, null, 2)).toString("base64"),
    branch: env.GH_BRANCH || "main"
  };
  if (file && file.sha) body.sha = file.sha;
  const r = await fetch("https://api.github.com/repos/" + env.GH_OWNER + "/" + env.GH_REPO + "/contents/" + path, {
    method: "PUT",
    headers: { authorization: "Bearer " + env.GH_TOKEN, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "kdp-bot" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error("GH write " + r.status + " " + (await r.text()).slice(0, 180));
  return { added: added, skipped: skipped, updated: updated };
}
async function handleShare(env, chatId, n, cat) {
  n = Math.max(1, Math.min(30, n || 10));
  const base = "https://raw.githubusercontent.com/" + env.GH_OWNER + "/" + env.GH_REPO + "/" + (env.GH_BRANCH || "main") + "/";
  const ALL_FILES = ["data/videos.json", "data/putarin.json", "data/campur.json", "data/videy.json", "data/amatir.json", "data/umum.json"];
  let files = ALL_FILES;
  if (cat === "putarin") files = ["data/putarin.json"];
  else if (cat === "videy") files = ["data/videy.json"];
  else if (cat === "lulu" || cat === "campur") files = ["data/campur.json"];
  else if (cat === "amatir") files = ["data/amatir.json", "data/videos.json"];
  else if (cat === "umum") files = ["data/umum.json", "data/videos.json"];
  else if (cat === "terbaru" || cat === "baru") files = ALL_FILES;

  let pool = [];
  for (let i = 0; i < files.length; i++) {
    try {
      const r = await fetch(base + files[i] + "?t=" + Date.now());
      const d = await r.json();
      if (Array.isArray(d)) pool = pool.concat(d);
    } catch (_) {}
  }

  pool = pool.filter(function (v) {
    const u = String(v.embed || v.direct || "");
    if (blocked(u)) return false;
    const catv = String(v.category || "").toLowerCase();
    const blob = (u + " " + catv + " " + String(v.title || "")).toLowerCase();
    if (cat === "amatir") return catv === "amatir" || /userbokep/.test(u);
    if (cat === "umum") return catv === "umum" || /indoav/.test(u);
    if (cat === "ai") return /\bai\b/i.test(String(v.title || "") + " " + catv);
    if (cat === "videy") return /videy/i.test(u) || catv === "videy";
    if (cat === "putarin") return /putarin|puterin/i.test(u) || catv === "putarin";
    if (cat === "lulu") return /lulu/i.test(u);
    if (cat === "campur") return /streamtape|strcloud|lulu/i.test(u) || catv === "campur";
    if (cat === "terbaru" || cat === "baru") return true;
    if (cat && cat !== "all") return blob.indexOf(cat) >= 0;
    return true;
  });

  if (cat === "terbaru" || cat === "baru") {
    pool.sort(function (a, b) {
      const da = Date.parse(String(a.date || "")) || 0;
      const db = Date.parse(String(b.date || "")) || 0;
      return db - da;
    });
  } else {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
    }
  }

  const take = pool.slice(0, n).map(function (v) {
    const id = keyOf(v.embed || v.direct);
    return "\u25b6 " + String(v.title || "Video") + "\nhttps://www.koleksidrpinguin.com/v/" + id + "\nhttps://www.koleksidrpinguin.site/#/v/" + id;
  });
  await reply(env, chatId, take.length ? take.join("\n\n") : "Kosong.");
}
async function handleUpdate(update, env) {
  const msg = update.message || update.channel_post;
  if (!msg || !msg.text || !env.BOT_TOKEN) return;
  const text = String(msg.text).trim();
  const chatId = msg.chat.id;
  const allowedId = String(env.TELEGRAM_USER_ID || "").trim();
  const fromId = String((msg.from && msg.from.id) || "");
  if (allowedId && fromId && fromId !== allowedId && String(chatId) !== allowedId) { await reply(env, chatId, "Akses ditolak."); return; }
  const t = text.toLowerCase();
  if (t.startsWith("/start") || t === "menu" || t === "/menu") {
    await reply(env, chatId, "Bot hidup.\n\nKirim link untuk upload.\nAtau pilih kategori:\nTerbaru / Semua / Amatir / Umum / Videy / Lulu / Putarin / Campur / AI\nMinta 10 / Minta 25 / Lagi");
    return;
  }
  var minta = t.match(/^minta\s*(\d{1,2})\s*(.*)$/);
  if (minta) {
    var nn = parseInt(minta[1], 10) || 10;
    var cc = String(minta[2] || "").trim() || "all";
    if (cc === "baru") cc = "terbaru";
    await handleShare(env, chatId, nn, cc);
    return;
  }
  if (t === "10") { await handleShare(env, chatId, 10, "all"); return; }
  if (t === "25" || t === "lagi") { await handleShare(env, chatId, 25, "all"); return; }
  if (t === "semua") { await handleShare(env, chatId, 10, "all"); return; }
  if (t === "terbaru" || t === "baru") { await handleShare(env, chatId, 15, "terbaru"); return; }
  if (t === "amatir" || t === "umum" || t === "videy" || t === "lulu" || t === "putarin" || t === "campur" || t === "ai") {
    await handleShare(env, chatId, 10, t);
    return;
  }
  const items = parseItems(text);
  if (!items.length) { await reply(env, chatId, "Kirim link IndoAV / UserBokep / Videy / Lulu / Putarin / Streamtape."); return; }
  if (!env.GH_TOKEN) { await reply(env, chatId, "Upload butuh GH_TOKEN di Vercel."); return; }
  const groups = {};
  items.forEach(function (it) { const p = pathOf(it); (groups[p] = groups[p] || []).push(it); });
  const lines = ["Selesai. Link: " + items.length];
  const keys = Object.keys(groups);
  for (let i = 0; i < keys.length; i++) {
    try {
      const r = await mergeAndPush(env, keys[i], groups[keys[i]]);
      lines.push(keys[i] + ": +" + r.added + " upd " + (r.updated || 0) + " skip " + r.skipped);
    } catch (e) {
      lines.push(keys[i] + ": GAGAL " + String((e && e.message) || e).slice(0, 120));
    }
  }
  try { lines.push("poster +" + await hookPoster(env, items)); } catch (e) { lines.push("poster: " + String(e.message || e)); }
  await reply(env, chatId, lines.join("\n"));
}

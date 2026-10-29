// Kino plugin: Eporner v1.2.2
// API v2 oficial. Thumbs 16:9 (big 640x360). Secciones filtradas por keywords.
// Ver más / búsqueda: hasta 100 ítems (tope Kino). Títulos con entidades HTML.

const API = "https://www.eporner.com/api/v2/video/search/";
const XHR = "https://www.eporner.com/xhr/video/";
const BASE = "https://www.eporner.com";

// Tope de ítems por página que Kino acepta
const PAGE_MAX = 100;
// Home muestra un poco menos por fila
const HOME_ROW = 40;

/**
 * Secciones: query API + order + términos para filtrar que el vídeo pertenezca a la categoría.
 * filter: null = sin filtro extra (recientes / rankings globales)
 */
const SECTIONS = [
  { id: "recientes", title: "Recientes", query: "all", order: "latest", filter: null },
  { id: "top-semanal", title: "Top semanal", query: "all", order: "top-weekly", filter: null },
  { id: "top-mensual", title: "Top mensual", query: "all", order: "top-monthly", filter: null },
  { id: "mas-vistos", title: "Más vistos", query: "all", order: "most-popular", filter: null },
  {
    id: "cosplay",
    title: "Cosplay",
    query: "cosplay",
    order: "latest",
    filter: ["cosplay", "costume", "roleplay", "anime", "hentai"],
  },
  {
    id: "asian",
    title: "Asian",
    query: "asian",
    order: "latest",
    filter: ["asian", "japanese", "korean", "chinese", "thai", "jav"],
  },
  {
    id: "jav",
    title: "JAV",
    query: "jav",
    order: "latest",
    filter: ["jav", "japanese", "uncensored", "censored"],
  },
  {
    id: "big-tits",
    title: "Big tits",
    query: "big tits",
    order: "latest",
    filter: ["big tits", "big boobs", "busty", "huge tits", "large tits"],
  },
  {
    id: "latina",
    title: "Latina",
    query: "latina",
    order: "latest",
    filter: ["latina", "latin", "spanish", "brasil", "mexican", "colombian"],
  },
  {
    id: "hentai",
    title: "Hentai",
    query: "hentai",
    order: "latest",
    filter: ["hentai", "anime", "cartoon", "2d", "3d"],
  },
  {
    id: "milf",
    title: "MILF",
    query: "milf",
    order: "latest",
    filter: ["milf", "mature", "mom", "mother"],
  },
  {
    id: "homemade",
    title: "Homemade",
    query: "homemade",
    order: "latest",
    filter: ["homemade", "amateur", "webcam", "real", "couple"],
  },
];

function log(...a) {
  try {
    kino.log(...a);
  } catch (_) {}
}

function preferredQuality() {
  try {
    const q = kino.config.get("quality");
    if (q && typeof q === "string") return q;
  } catch (_) {}
  return "auto";
}

/** Decodifica entidades HTML y deja tildes/símbolos legibles */
function decodeTitle(s) {
  if (!s) return "";
  let t = String(s);
  t = t
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
  // &#123; decimal
  t = t.replace(/&#(\d+);/g, (_, n) => {
    try {
      return String.fromCharCode(parseInt(n, 10));
    } catch (e) {
      return _;
    }
  });
  // &#x1F; hex
  t = t.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
    try {
      return String.fromCharCode(parseInt(h, 16));
    } catch (e) {
      return _;
    }
  });
  // Named latin entities comunes
  const named = {
    ntilde: "ñ",
    Ntilde: "Ñ",
    aacute: "á",
    eacute: "é",
    iacute: "í",
    oacute: "ó",
    uacute: "ú",
    Aacute: "Á",
    Eacute: "É",
    Iacute: "Í",
    Oacute: "Ó",
    Uacute: "Ú",
    uuml: "ü",
    Uuml: "Ü",
    ccedil: "ç",
    Ccedil: "Ç",
    ndash: "–",
    mdash: "—",
    hellip: "…",
    laquo: "«",
    raquo: "»",
    copy: "©",
    reg: "®",
    trade: "™",
  };
  t = t.replace(/&([a-zA-Z]+);/g, (m, name) =>
    named[name] != null ? named[name] : m
  );
  // Normalizar espacios
  t = t.replace(/\s+/g, " ").trim();
  return t.slice(0, 200);
}

function encodeBaseN(num, n) {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  if (num === 0) return alphabet[0];
  let s = "";
  while (num > 0) {
    s = alphabet[num % n] + s;
    num = Math.floor(num / n);
  }
  return s;
}

function calcHash(hex32) {
  let out = "";
  for (let i = 0; i < 32; i += 8) {
    out += encodeBaseN(parseInt(hex32.slice(i, i + 8), 16), 36);
  }
  return out;
}

async function apiSearch(query, page, order, perPage) {
  const params =
    "query=" +
    encodeURIComponent(query || "all") +
    "&per_page=" +
    Math.min(Math.max(perPage || 30, 1), 1000) +
    "&page=" +
    page +
    "&thumbsize=big" +
    "&order=" +
    encodeURIComponent(order || "latest") +
    "&gay=0&lq=1&format=json";
  const r = await kino.fetch(API + "?" + params, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    },
    timeoutMs: 25000,
  });
  if (!r.ok) throw new Error("API Eporner " + r.status);
  const text = r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error("JSON inválido de Eporner");
  }
  return data;
}

/**
 * Miniatura horizontal 16:9.
 * API thumbsize=big → 640×360 (o a veces 480×360). Preferimos siempre width > height.
 * Las URLs *_360.jpg son el set landscape de Eporner.
 */
function pickThumb(v) {
  const candidates = [];
  if (v.default_thumb && v.default_thumb.src) candidates.push(v.default_thumb);
  if (v.thumbs && v.thumbs.length) {
    for (const t of v.thumbs) if (t && t.src) candidates.push(t);
  }
  // 1) Exacto 640×360
  for (const t of candidates) {
    if (t.width === 640 && t.height === 360) return t.src;
  }
  // 2) Landscape width >= height * 1.4 (≈16:9)
  for (const t of candidates) {
    if (t.width && t.height && t.width / t.height >= 1.4) return t.src;
  }
  // 3) Cualquier landscape
  for (const t of candidates) {
    if (t.width && t.height && t.width > t.height) return t.src;
  }
  // 4) Forzar variante _360 en la URL si viene otra
  for (const t of candidates) {
    if (!t.src) continue;
    const forced = String(t.src).replace(/_\d+\.jpg/i, "_360.jpg");
    if (forced !== t.src) return forced;
    return t.src;
  }
  return undefined;
}

function videoToItem(v) {
  if (!v || !v.id) return null;
  const id = String(v.id).replace(/[^A-Za-z0-9._~-]/g, "");
  if (!id) return null;
  const title = decodeTitle(v.title || id);
  if (!title) return null;

  // Misma imagen 16:9 en poster y backdrop (Kino usa poster en la fila del Home)
  const thumb = pickThumb(v);
  const runtimeMinutes =
    typeof v.length_sec === "number" && v.length_sec > 0
      ? Math.max(1, Math.round(v.length_sec / 60))
      : undefined;

  let rating;
  if (v.rate != null) {
    const n = parseFloat(v.rate);
    if (!isNaN(n) && n >= 0 && n <= 10) rating = n;
  }

  const item = {
    id: id,
    ref: id,
    title: title,
    kind: "movie",
    adult: true,
  };
  if (thumb) {
    item.poster = thumb;
    item.backdrop = thumb;
  }
  if (runtimeMinutes) item.runtimeMinutes = runtimeMinutes;
  if (rating != null) item.rating = rating;
  if (v.keywords) {
    const genres = String(v.keywords)
      .split(/[,|]/)
      .map((s) => decodeTitle(s.trim()))
      .filter(Boolean)
      .slice(0, 6);
    if (genres.length) item.genres = genres.map((g) => g.slice(0, 40));
  }
  const blob = (title + " " + (v.keywords || "")).toLowerCase();
  if (/4k|2160/.test(blob)) item.quality = "2160p";
  else if (/1080|fhd/.test(blob)) item.quality = "1080p";
  else if (/720/.test(blob)) item.quality = "720p";

  return item;
}

/** ¿El vídeo pertenece a la categoría (keywords o título)? */
function matchesFilter(v, filterTerms) {
  if (!filterTerms || !filterTerms.length) return true;
  const blob = (
    (v.title || "") +
    " " +
    (v.keywords || "")
  ).toLowerCase();
  for (const term of filterTerms) {
    if (blob.indexOf(String(term).toLowerCase()) >= 0) return true;
  }
  return false;
}

function mapVideos(data, filterTerms) {
  const list = (data && data.videos) || [];
  const items = [];
  const seen = new Set();
  for (const v of list) {
    if (filterTerms && !matchesFilter(v, filterTerms)) continue;
    const it = videoToItem(v);
    if (!it || seen.has(it.id)) continue;
    seen.add(it.id);
    items.push(it);
  }
  return items;
}

/** Búsqueda precisa: no sustituye por "all"; orden latest */
export async function search(query) {
  const q = (query.q || "").trim();
  if (!q) return [];
  const page = query.cursor ? parseInt(String(query.cursor), 10) || 1 : 1;
  // Pedimos más a la API y devolvemos hasta PAGE_MAX
  const data = await apiSearch(q, page, "latest", PAGE_MAX);
  const items = mapVideos(data, null);
  const totalPages = data.total_pages || 1;
  log("search", q, items.length, "page", page);
  if (page < totalPages && items.length > 0) {
    return { items: items.slice(0, PAGE_MAX), next: String(page + 1) };
  }
  return items.slice(0, PAGE_MAX);
}

export async function home() {
  const rows = [];
  for (const sec of SECTIONS) {
    try {
      // Pedir más de HOME_ROW para compensar el filtro de categoría
      const need = sec.filter ? Math.min(PAGE_MAX, HOME_ROW * 3) : HOME_ROW;
      const data = await apiSearch(sec.query, 1, sec.order, need);
      const items = mapVideos(data, sec.filter);
      log("home", sec.id, items.length);
      if (items.length) {
        rows.push({
          id: sec.id,
          title: sec.title,
          items: items.slice(0, HOME_ROW),
          ref:
            "q:" +
            encodeURIComponent(sec.query) +
            "|o:" +
            sec.order +
            (sec.filter ? "|f:" + encodeURIComponent(sec.filter.join(",")) : ""),
          genre: "otros",
        });
      }
    } catch (e) {
      log("home", sec.id, "ERROR", e && e.message);
    }
  }
  return rows;
}

export async function browse(ref, cursor) {
  let query = "all";
  let order = "latest";
  let filterTerms = null;
  if (typeof ref === "string") {
    const qm = ref.match(/q:([^|]+)/);
    const om = ref.match(/o:([a-z0-9-]+)/i);
    const fm = ref.match(/f:([^|]+)/);
    if (qm) {
      try {
        query = decodeURIComponent(qm[1]);
      } catch (_) {
        query = qm[1];
      }
    }
    if (om) order = om[1];
    if (fm) {
      try {
        filterTerms = decodeURIComponent(fm[1])
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } catch (_) {
        filterTerms = fm[1].split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
  }
  const page = cursor ? parseInt(String(cursor), 10) || 1 : 1;
  // Máximo permitido por página en Kino
  const fetchSize = filterTerms ? Math.min(1000, PAGE_MAX * 2) : PAGE_MAX;
  const data = await apiSearch(query, page, order, fetchSize);
  const items = mapVideos(data, filterTerms);
  const totalPages = data.total_pages || 1;
  const next =
    page < totalPages && items.length ? String(page + 1) : undefined;
  log("browse", query, order, items.length, "page", page);
  return { items: items.slice(0, PAGE_MAX), next: next };
}

async function getPageHash(videoId) {
  const urls = [
    BASE + "/embed/" + videoId + "/",
    BASE + "/hd-porn/" + videoId + "/",
    BASE + "/video-" + videoId + "/",
  ];
  for (const url of urls) {
    try {
      const r = await kino.fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
          Accept: "text/html",
          Referer: BASE + "/",
        },
        timeoutMs: 15000,
      });
      if (!r.ok) continue;
      const html = r.text();
      const m =
        html.match(/EP\.video\.player\.hash\s*=\s*['"]([a-f0-9]{32})['"]/i) ||
        html.match(/player\.hash\s*=\s*['"]([a-f0-9]{32})['"]/i);
      if (m) return m[1];
    } catch (e) {
      log("getPageHash", url, e && e.message);
    }
  }
  return null;
}

function qualityHeight(label) {
  const s = String(label || "").toLowerCase();
  if (/2160|4k/.test(s)) return 2160;
  if (/1440/.test(s)) return 1440;
  if (/1080/.test(s)) return 1080;
  if (/720/.test(s)) return 720;
  if (/480/.test(s)) return 480;
  if (/360/.test(s)) return 360;
  if (/240/.test(s)) return 240;
  return 0;
}

function rankQuality(label) {
  const h = qualityHeight(label);
  return h > 0 ? -h : 9;
}

function pickPreferred(streams, pref) {
  if (!pref || pref === "auto") return streams;
  const want = parseInt(pref, 10);
  if (!want) return streams;
  const exact = streams.find((s) => qualityHeight(s.label) === want);
  if (exact) return [exact].concat(streams.filter((s) => s !== exact));
  const below = streams
    .filter((s) => {
      const h = qualityHeight(s.label);
      return h > 0 && h <= want;
    })
    .sort((a, b) => qualityHeight(b.label) - qualityHeight(a.label));
  if (below.length) {
    const best = below[0];
    return [best].concat(streams.filter((s) => s !== best));
  }
  return streams;
}

export async function resolve(ref) {
  if (!ref || typeof ref !== "string") throw new Error("ref inválido");
  let videoId = ref.trim();
  const um = videoId.match(
    /eporner\.com\/(?:hd-porn\/|video-|embed\/)?([A-Za-z0-9]{6,20})/i
  );
  if (um) videoId = um[1];
  videoId = videoId.replace(/[^A-Za-z0-9]/g, "");
  if (!videoId) throw new Error("id de vídeo inválido");

  const hex = await getPageHash(videoId);
  if (!hex) throw new Error("no se pudo obtener hash del vídeo");

  const hash = calcHash(hex);
  const xhrUrl =
    XHR +
    videoId +
    "?hash=" +
    encodeURIComponent(hash) +
    "&device=generic&domain=www.eporner.com&fallback=false";

  const r = await kino.fetch(xhrUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      Referer: BASE + "/embed/" + videoId + "/",
      "X-Requested-With": "XMLHttpRequest",
    },
    timeoutMs: 15000,
  });
  if (!r.ok) throw new Error("xhr/video " + r.status);
  let data;
  try {
    data = JSON.parse(r.text());
  } catch (e) {
    throw new Error("JSON xhr inválido");
  }
  if (data.available === false) {
    throw new Error(data.message || "vídeo no disponible");
  }

  let streams = [];
  const sources = data.sources || {};
  const mp4 = sources.mp4 || {};
  for (const key of Object.keys(mp4)) {
    const entry = mp4[key];
    if (!entry || !entry.src) continue;
    if (/na\.mp4/i.test(entry.src)) continue;
    const label = entry.labelShort || key || "MP4";
    streams.push({
      url: entry.src,
      mime: "video/mp4",
      label: String(label).replace(/\s+HD$/i, ""),
    });
  }
  const hls = sources.hls || {};
  for (const key of Object.keys(hls)) {
    const entry = hls[key];
    if (!entry || !entry.src) continue;
    streams.push({
      url: entry.src,
      mime: "application/x-mpegURL",
      label: (entry.labelShort || key || "HLS") + " (HLS)",
    });
  }

  if (!streams.length) throw new Error("sin fuentes de vídeo");

  streams.sort((a, b) => rankQuality(a.label) - rankQuality(b.label));
  streams = pickPreferred(streams, preferredQuality());

  const headers = {
    Referer: BASE + "/",
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  };

  const primary = streams[0];
  const result = {
    url: primary.url,
    mime: primary.mime || "video/mp4",
    headers: headers,
    label: primary.label,
  };
  if (streams.length > 1) {
    result.alternatives = streams.slice(1, 8).map((s) => ({
      url: s.url,
      mime: s.mime || "video/mp4",
      label: s.label,
      headers: headers,
    }));
  }
  return result;
}

// Leaderboard for TankOS's Block Puzzle, and who is on the site right now.
//   GET  /scores                 -> {top}
//   POST /scores {name, score}   -> {top, me}   keeps the higher of the new and stored score for that name
//   POST /presence {sid, app}    -> {me, total, online}   heartbeat, every 30 s while the page is visible
//   POST /presence/leave {sid}   -> 204   the tab is closing; drop it now instead of after the timeout
//   GET  /trace                  -> where this request went and how long each leg took (Life of a Request)
// Names are not authenticated: typing the same name counts as the same player.
// Presence bodies arrive as text/plain, so neither call needs a CORS preflight (sendBeacon cannot send one).

const TOP = 10;
const MAX_NAME = 12;
const MAX_SCORE = 10_000_000;

const ONLINE_MS = 60_000;     // a heartbeat this recent counts as online
const STALE_MS = 5 * 60_000;  // rows older than this are deleted on the next heartbeat
const MAX_ONLINE = 30;        // rows returned; `total` still counts everyone
const SID = /^[0-9a-f]{32}$/;
const APP = /^[a-z]{1,20}$/;  // an app id, "desktop" or "lock"; the page only ever shows names it knows

const ORIGINS = [
  "https://tankfinal.github.io",
  "https://portfolio.xarenvich.workers.dev",
  "http://localhost:4321",
  "http://127.0.0.1:4321",
];

const TOP_SQL = "SELECT name, score FROM scores ORDER BY score DESC, set_at LIMIT " + TOP;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const cors = ORIGINS.includes(origin)
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          // Without this a cross-origin response reports DNS / connect / TLS / TTFB as 0 to the page. Life of a
          // Request reads it on /trace, and on whichever earlier request opened the connection it reuses.
          "Timing-Allow-Origin": origin,
          // Lets the page read every response header (Life of a Request shows them raw). "*" covers all but
          // Set-Cookie for requests sent without credentials, which all of these are.
          "Access-Control-Expose-Headers": "*",
          Vary: "Origin",
        }
      : { Vary: "Origin" };

    const path = new URL(request.url).pathname;
    if (!["/scores", "/presence", "/presence/leave", "/trace"].includes(path)) return json({ error: "not found" }, 404, cors);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (path === "/scores" && request.method === "GET") {
      const { results } = await env.DB.prepare(TOP_SQL).all();
      return json({ top: results }, 200, cors);
    }
    if (path === "/trace") {
      return request.method === "GET" ? trace(request, env, cors) : json({ error: "method not allowed" }, 405, cors);
    }
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405, cors);
    if (path === "/scores") return submit(request, env, cors);
    if (path === "/presence") return heartbeat(request, env, cors);
    return leave(request, env, cors);
  },
};

async function submit(request, env, cors) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400, cors);
  }
  const name = cleanName(body && body.name);
  const score = body && body.score;
  if (!name || !Number.isSafeInteger(score) || score < 1 || score > MAX_SCORE) {
    return json({ error: "invalid name or score" }, 400, cors);
  }

  const [, me, top] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO scores (name, score, set_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (name) DO UPDATE SET score = excluded.score, set_at = excluded.set_at
       WHERE excluded.score > scores.score`
    ).bind(name, score, Date.now()),
    env.DB.prepare(
      `SELECT s.name, s.score,
              (SELECT COUNT(*) FROM scores o
                WHERE o.score > s.score OR (o.score = s.score AND o.set_at < s.set_at)) + 1 AS rank
         FROM scores s WHERE s.name = ?1`
    ).bind(name),
    env.DB.prepare(TOP_SQL),
  ]);
  return json({ top: top.results, me: me.results[0] }, 200, cors);
}

// One row per browser tab. Only the city and country Cloudflare derives from the IP are kept, never the IP.
async function heartbeat(request, env, cors) {
  const body = await readJson(request);
  const sid = body && body.sid;
  const app = body && body.app;
  if (typeof sid !== "string" || !SID.test(sid) || typeof app !== "string" || !APP.test(app)) {
    return json({ error: "invalid sid or app" }, 400, cors);
  }
  const cf = request.cf || {};
  const now = Date.now();
  const tag = await tagOf(sid);
  const [, , count, online] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO presence (sid, tag, city, country, app, since, seen_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
       ON CONFLICT (sid) DO UPDATE SET city = excluded.city, country = excluded.country,
                                       app = excluded.app, seen_at = excluded.seen_at`
    ).bind(sid, tag, cleanPlace(cf.city), cleanPlace(cf.country), app, now),
    env.DB.prepare("DELETE FROM presence WHERE seen_at < ?1").bind(now - STALE_MS),
    env.DB.prepare("SELECT COUNT(*) AS n FROM presence WHERE seen_at >= ?1").bind(now - ONLINE_MS),
    env.DB.prepare(
      "SELECT tag, city, country, app, since FROM presence WHERE seen_at >= ?1 ORDER BY since LIMIT " + MAX_ONLINE
    ).bind(now - ONLINE_MS),
  ]);
  return json({ me: tag, total: count.results[0].n, online: online.results }, 200, cors);
}

async function leave(request, env, cors) {
  const body = await readJson(request);
  const sid = body && body.sid;
  if (typeof sid !== "string" || !SID.test(sid)) return json({ error: "invalid sid" }, 400, cors);
  await env.DB.prepare("DELETE FROM presence WHERE sid = ?1").bind(sid).run();
  return new Response(null, { status: 204, headers: cors });
}

// One trip to D1, timed from inside the Worker. SELECT 1 reads no table: the point is the trip, not the data.
// Date.now() in a Worker only moves when I/O completes, so this measures the wait for D1 and nothing else;
// the Worker's own CPU time cannot be seen from here.
// Nothing is stored.
async function trace(request, env, cors) {
  const cf = request.cf || {};
  const t0 = Date.now();
  const { meta } = await env.DB.prepare("SELECT 1").all();
  const d1Ms = Date.now() - t0;
  const sqlMs = meta.timings?.sql_duration_ms ?? meta.duration ?? null;
  const d1 = {
    colo: meta.served_by_colo || null,
    region: meta.served_by_region || null,
    primary: meta.served_by_primary ?? null,
    ms: d1Ms,
    sqlMs,
  };
  const body = {
    edge: cf.colo || null,
    client: {
      city: cleanPlace(cf.city),
      country: cleanPlace(cf.country),
      lat: coord(cf.latitude),
      lon: coord(cf.longitude),
      rtt: cf.clientQuicRtt || cf.clientTcpRtt || null,
      http: cf.httpProtocol || null,
      tls: cf.tlsVersion || null,
      cipher: cf.tlsCipher || null,
      isp: cleanPlace(cf.asOrganization),
    },
    d1,
  };
  const timing = [`d1;dur=${d1Ms};desc="D1 ${d1.colo || "local"}"`];
  if (sqlMs != null) timing.push(`sql;dur=${sqlMs};desc="SQL"`);
  if (body.edge) timing.push(`edge;desc="Cloudflare ${body.edge}"`);
  return json(body, 200, { ...cors, "Server-Timing": timing.join(", ") });
}

function coord(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// What other visitors see instead of the sid: the first 4 hex digits of its SHA-256.
async function tagOf(sid) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sid)));
  return [...digest.slice(0, 2)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cleanPlace(v) {
  if (typeof v !== "string") return null;
  const s = v.replace(/\p{C}/gu, "").trim().slice(0, 40);
  return s || null;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Collapse whitespace, drop control/format characters, then require 1..MAX_NAME characters.
function cleanName(v) {
  if (typeof v !== "string") return null;
  const s = v.normalize("NFC").replace(/\s+/g, " ").replace(/\p{C}/gu, "").trim();
  const n = [...s].length;
  return n >= 1 && n <= MAX_NAME ? s : null;
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Leaderboard for TankOS's Block Puzzle.
//   GET  /scores                 -> {top}
//   POST /scores {name, score}   -> {top, me}   keeps the higher of the new and stored score for that name
// Names are not authenticated: typing the same name counts as the same player.

const TOP = 10;
const MAX_NAME = 12;
const MAX_SCORE = 10_000_000;

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
          Vary: "Origin",
        }
      : { Vary: "Origin" };

    if (new URL(request.url).pathname !== "/scores") return json({ error: "not found" }, 404, cors);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET") {
      const { results } = await env.DB.prepare(TOP_SQL).all();
      return json({ top: results }, 200, cors);
    }
    if (request.method === "POST") return submit(request, env, cors);
    return json({ error: "method not allowed" }, 405, cors);
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

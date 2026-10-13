-- TankOS's database (D1 `portfolio`). Tables belonging to one app are prefixed with it (blocks_ for Block
-- Puzzle); presence is TankOS's own.

-- Block Puzzle leaderboard: one row per player name (case-insensitive), holding that name's best score.
CREATE TABLE IF NOT EXISTS blocks_scores (
  name   TEXT    PRIMARY KEY COLLATE NOCASE,
  score  INTEGER NOT NULL,
  set_at INTEGER NOT NULL  -- epoch ms when this best was reached; earlier wins a tie
);

CREATE INDEX IF NOT EXISTS blocks_scores_by_rank ON blocks_scores (score DESC, set_at);

-- Who is on the site now: one row per browser tab, refreshed by a heartbeat every 30 s and deleted
-- 5 minutes after the last one. No IP is stored.
CREATE TABLE IF NOT EXISTS presence (
  sid     TEXT    PRIMARY KEY,  -- random per tab (sessionStorage); never sent to other visitors
  tag     TEXT    NOT NULL,     -- first 4 hex digits of SHA-256(sid), shown as visitor-xxxx
  city    TEXT,                 -- request.cf.city
  country TEXT,                 -- request.cf.country
  app     TEXT    NOT NULL,     -- the window in front, or "desktop" / "lock"
  since   INTEGER NOT NULL,     -- epoch ms of the first heartbeat
  seen_at INTEGER NOT NULL      -- epoch ms of the latest heartbeat
);

CREATE INDEX IF NOT EXISTS presence_by_seen ON presence (seen_at);

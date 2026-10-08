-- One row per player name (case-insensitive), holding that name's best score.
CREATE TABLE IF NOT EXISTS scores (
  name   TEXT    PRIMARY KEY COLLATE NOCASE,
  score  INTEGER NOT NULL,
  set_at INTEGER NOT NULL  -- epoch ms when this best was reached; earlier wins a tie
);

CREATE INDEX IF NOT EXISTS scores_by_rank ON scores (score DESC, set_at);

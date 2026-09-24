CREATE TABLE IF NOT EXISTS score_submissions (
  id TEXT PRIMARY KEY,
  score INTEGER NOT NULL,
  score_max INTEGER NOT NULL DEFAULT 250,
  score_percent REAL NOT NULL,
  raw_score INTEGER,
  raw_percent REAL,
  stability_score REAL,
  consistency_discount REAL,
  is_spam INTEGER NOT NULL DEFAULT 0,
  spam_status INTEGER NOT NULL DEFAULT 0,
  duration_seconds REAL,
  question_count INTEGER,
  algorithm_version TEXT NOT NULL,
  question_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_score_submissions_created_at
  ON score_submissions(created_at);

CREATE INDEX IF NOT EXISTS idx_score_submissions_score
  ON score_submissions(score);

CREATE INDEX IF NOT EXISTS idx_score_submissions_algorithm_version
  ON score_submissions(algorithm_version);

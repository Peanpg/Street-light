-- Created automatically on first authenticated database request.
-- This file is provided for manual setup or inspection in a Postgres SQL editor.
CREATE TABLE IF NOT EXISTS survey_status (
  facility_id TEXT PRIMARY KEY,
  completed INTEGER NOT NULL DEFAULT 0,
  surveyor TEXT,
  note TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  revision TEXT NOT NULL
);

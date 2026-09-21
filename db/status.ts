import { neon } from "@neondatabase/serverless";

export type SurveyRow = {
  facility_id: string;
  completed: number;
  surveyor: string | null;
  note: string | null;
  updated_by: string | null;
  updated_at: string;
  revision: string;
};

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

let schemaReady: Promise<unknown> | null = null;
async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = database()`CREATE TABLE IF NOT EXISTS survey_status (
      facility_id TEXT PRIMARY KEY,
      completed INTEGER NOT NULL DEFAULT 0,
      surveyor TEXT,
      note TEXT,
      updated_by TEXT,
      updated_at TEXT NOT NULL,
      revision TEXT NOT NULL
    )`.catch((error) => { schemaReady = null; throw error; });
  }
  await schemaReady;
}

export async function listSurveyStatuses(): Promise<SurveyRow[]> {
  await ensureSchema();
  return await database()`SELECT facility_id, completed, surveyor, note, updated_by, updated_at, revision FROM survey_status` as SurveyRow[];
}

export async function getSurveyStatus(id: string): Promise<SurveyRow | null> {
  await ensureSchema();
  const rows = await database()`SELECT facility_id, completed, surveyor, note, updated_by, updated_at, revision FROM survey_status WHERE facility_id = ${id}` as SurveyRow[];
  return rows[0] ?? null;
}

export async function saveSurveyStatus(input: { id: string; completed: boolean; surveyor: string; note: string; updatedBy: string; expectedRevision: string | null }): Promise<SurveyRow | null> {
  await ensureSchema();
  const updatedAt = new Date().toISOString();
  const revision = crypto.randomUUID();
  const completed = input.completed ? 1 : 0;
  const surveyor = input.completed ? input.surveyor : null;
  const note = input.note || null;
  const sql = database();
  const rows = input.expectedRevision === null
    ? await sql`INSERT INTO survey_status (facility_id, completed, surveyor, note, updated_by, updated_at, revision)
        VALUES (${input.id}, ${completed}, ${surveyor}, ${note}, ${input.updatedBy}, ${updatedAt}, ${revision})
        ON CONFLICT (facility_id) DO NOTHING RETURNING *`
    : await sql`UPDATE survey_status SET completed = ${completed}, surveyor = ${surveyor}, note = ${note}, updated_by = ${input.updatedBy}, updated_at = ${updatedAt}, revision = ${revision}
        WHERE facility_id = ${input.id} AND revision = ${input.expectedRevision} RETURNING *`;
  return (rows as SurveyRow[])[0] ?? null;
}

export async function deleteSurveyStatus(id: string, expectedRevision: string): Promise<boolean> {
  await ensureSchema();
  const rows = await database()`DELETE FROM survey_status WHERE facility_id = ${id} AND revision = ${expectedRevision} RETURNING facility_id`;
  return rows.length > 0;
}

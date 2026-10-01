import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export type TeamLocation = { id: string; name: string; lat: number; long: number; accuracy: number; updated_at: string };
let ready: Promise<unknown> | null = null;
function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}
async function setup() {
  if (!ready) ready = database()`CREATE TABLE IF NOT EXISTS meter_team_locations (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL, long DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`.catch(error => { ready = null; throw error; });
  await ready;
}
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function listLocations(): Promise<TeamLocation[]> {
  await setup();
  await database()`DELETE FROM meter_team_locations WHERE updated_at < NOW() - INTERVAL '90 seconds'`;
  return await database()`SELECT id, name, lat, long, accuracy, updated_at FROM meter_team_locations WHERE updated_at >= NOW() - INTERVAL '90 seconds' ORDER BY name` as TeamLocation[];
}
export async function saveLocation(p: TeamLocation, token: string): Promise<boolean> {
  await setup();
  const tokenHash = hash(token);
  const rows = await database()`INSERT INTO meter_team_locations (id, token_hash, name, lat, long, accuracy, updated_at)
    VALUES (${p.id}, ${tokenHash}, ${p.name}, ${p.lat}, ${p.long}, ${p.accuracy}, NOW())
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, lat = EXCLUDED.lat, long = EXCLUDED.long, accuracy = EXCLUDED.accuracy, updated_at = NOW()
    WHERE meter_team_locations.token_hash = ${tokenHash} RETURNING id`;
  return rows.length > 0;
}
export async function removeLocation(id: string, token: string) {
  await setup();
  await database()`DELETE FROM meter_team_locations WHERE id = ${id} AND token_hash = ${hash(token)}`;
}

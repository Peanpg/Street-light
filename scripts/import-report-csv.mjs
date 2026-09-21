import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import { neon } from "@neondatabase/serverless";

const path = process.argv[2];
if (!path || !process.env.DATABASE_URL) {
  console.error("Usage: DATABASE_URL=... npm run import:report -- path/to/report.csv");
  process.exit(1);
}

const rows = parse(readFileSync(path, "utf8"), { columns: true, bom: true, skip_empty_lines: true });
const knownIds = new Set(JSON.parse(readFileSync(new URL("../app/lights.json", import.meta.url), "utf8")).map((light) => light.id));
const sql = neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS survey_status (
  facility_id TEXT PRIMARY KEY, completed INTEGER NOT NULL DEFAULT 0, surveyor TEXT,
  note TEXT, updated_by TEXT, updated_at TEXT NOT NULL, revision TEXT NOT NULL
)`;

let imported = 0, skipped = 0;
for (const row of rows) {
  const id = String(row.PEA ?? "").trim();
  if (row["สถานะ"] !== "สำรวจแล้ว" || !knownIds.has(id)) { skipped++; continue; }
  const surveyor = String(row["ผู้สำรวจ"] ?? "").trim() || "ไม่ระบุ";
  const note = String(row["หมายเหตุ"] ?? "").trim() || null;
  const date = new Date(String(row["อัปเดตล่าสุด"] ?? ""));
  const updatedAt = Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  const result = await sql`INSERT INTO survey_status (facility_id, completed, surveyor, note, updated_by, updated_at, revision)
    VALUES (${id}, 1, ${surveyor}, ${note}, ${"นำเข้าข้อมูลเดิม"}, ${updatedAt}, ${randomUUID()})
    ON CONFLICT (facility_id) DO NOTHING RETURNING facility_id`;
  if (result.length) imported++; else skipped++;
}
console.log(`Imported ${imported} surveyed points; skipped ${skipped} rows. Existing database entries were not overwritten.`);

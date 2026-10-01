import { NextResponse } from "next/server";
import { listLocations, removeLocation, saveLocation, type TeamLocation } from "@/db/locations";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function unavailable() { return NextResponse.json({ error: process.env.DATABASE_URL ? "เชื่อมต่อตำแหน่งทีมไม่สำเร็จ กรุณาลองใหม่" : "ต้องเชื่อม DATABASE_URL ก่อนจึงแชร์ตำแหน่งให้ทีมได้" }, { status: 503, headers }); }
export async function GET() {
  try { return NextResponse.json({ positions: await listLocations(), serverTime: new Date().toISOString() }, { headers }); }
  catch { return unavailable(); }
}
async function mutate(request: Request, deleting: boolean) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });
  let p: Record<string, unknown>;
  try { const body = await request.json(); if (!body || typeof body !== "object") throw new Error(); p = body; }
  catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  if (typeof p.id !== "string" || !uuid.test(p.id) || typeof p.token !== "string" || !uuid.test(p.token)) return NextResponse.json({ error: "ข้อมูลทีมไม่ถูกต้อง" }, { status: 400 });
  if (!deleting && (typeof p.name !== "string" || !p.name.trim() || p.name.trim().length > 80 || typeof p.lat !== "number" || !Number.isFinite(p.lat) || Math.abs(p.lat) > 90 || typeof p.long !== "number" || !Number.isFinite(p.long) || Math.abs(p.long) > 180 || typeof p.accuracy !== "number" || !Number.isFinite(p.accuracy) || p.accuracy < 0 || p.accuracy > 100000)) return NextResponse.json({ error: "ชื่อหรือพิกัดไม่ถูกต้อง" }, { status: 400 });
  try {
    if (deleting) { await removeLocation(p.id, p.token); return NextResponse.json({ stopped: true }, { headers }); }
    if (!await saveLocation({ ...p, name: (p.name as string).trim() } as TeamLocation, p.token)) return NextResponse.json({ error: "ไม่สามารถอัปเดตตำแหน่งนี้ได้" }, { status: 403 });
    return NextResponse.json({ shared: true }, { headers });
  } catch { return unavailable(); }
}
export const PUT = (request: Request) => mutate(request, false);
export const DELETE = (request: Request) => mutate(request, true);

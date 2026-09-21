import { NextResponse } from "next/server";
import { deleteSurveyStatus, getSurveyStatus, listSurveyStatuses, saveSurveyStatus } from "@/db/status";
import lights from "@/app/lights.json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const validIds = new Set(lights.map((light) => light.id));

export async function GET() {
  try {
    return NextResponse.json({ statuses: await listSurveyStatuses() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Status load failed", error);
    return NextResponse.json({ error: "ไม่สามารถโหลดสถานะสำรวจได้" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  const value = body as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id : "";
  const completed = value.completed;
  const surveyor = typeof value.surveyor === "string" ? value.surveyor.trim() : "";
  const note = typeof value.note === "string" ? value.note.trim() : "";
  const expectedRevision = value.expectedRevision;
  if (!validIds.has(id) || typeof completed !== "boolean" || !surveyor || surveyor.length > 80 || note.length > 500 || !(expectedRevision === null || (typeof expectedRevision === "string" && expectedRevision.length <= 80))) {
    return NextResponse.json({ error: "กรุณาเลือกจุดและกรอกชื่อผู้สำรวจให้ถูกต้อง" }, { status: 400 });
  }
  try {
    const status = await saveSurveyStatus({ id, completed, surveyor, note, updatedBy: surveyor, expectedRevision: expectedRevision as string | null });
    if (!status) return NextResponse.json({ error: "จุดนี้มีการเปลี่ยนแปลงจากผู้ใช้อื่น กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก", current: await getSurveyStatus(id) }, { status: 409 });
    return NextResponse.json({ status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Status save failed", error);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  const value = body as Record<string, unknown>;
  const id = value.id;
  const expectedRevision = value.expectedRevision;
  if (typeof id !== "string" || !validIds.has(id) || typeof expectedRevision !== "string" || !expectedRevision || expectedRevision.length > 80) return NextResponse.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  try {
    if (!await deleteSurveyStatus(id, expectedRevision)) return NextResponse.json({ error: "จุดนี้มีการเปลี่ยนแปลงจากผู้ใช้อื่น กรุณาโหลดข้อมูลล่าสุดก่อนลบ", current: await getSurveyStatus(id) }, { status: 409 });
    return NextResponse.json({ deleted: id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Status delete failed", error);
    return NextResponse.json({ error: "ลบไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 503 });
  }
}

import { NextResponse } from "next/server";

// The survey is open-access. Keep this route only to replace the old login API
// when files are uploaded over an existing GitHub repository.
export function POST() {
  return NextResponse.json({ error: "เว็บนี้ไม่ใช้รหัสทีมแล้ว" }, { status: 410 });
}

import { redirect } from "next/navigation";
import { getTeamUser, safeReturnTo } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; error?: string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo ?? null);
  if (await getTeamUser()) redirect(returnTo);
  return <main className="login-page"><div className="login-card">
    <div className="login-mark">⚡</div>
    <h1>สำรวจโคมไฟสาธารณะ</h1>
    <p>อำเภอน้ำพอง · เข้าใช้งานสำหรับทีมสำรวจ</p>
    {params.error && <div className="login-error" role="alert">ชื่อหรือรหัสทีมไม่ถูกต้อง กรุณาลองอีกครั้ง</div>}
    <form action="/api/login" method="post">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>ชื่อทีมงาน<input name="name" type="text" autoComplete="name" maxLength={80} required placeholder="ชื่อที่จะใช้ระบุผู้บันทึก" /></label>
      <label>รหัสทีม<input name="code" type="password" autoComplete="current-password" required placeholder="รหัสที่ผู้ดูแลแจ้งให้ทีม" /></label>
      <button type="submit">เข้าสู่แผนที่สำรวจ</button>
    </form>
    <small>ผลสำรวจจะอัปเดตให้ทุกคนในทีมเห็นร่วมกัน</small>
  </div></main>;
}

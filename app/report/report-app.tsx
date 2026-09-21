"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, MapPinned, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import lightsData from "../lights.json";

type Light = { id: string; seq: number; tambon: string; location: string; lat: number; long: number; rateKva: number };
type Status = { facility_id: string; completed: number; surveyor: string | null; note: string | null; updated_at: string };
const lights = (lightsData as Light[]).slice().sort((a, b) => a.tambon.localeCompare(b.tambon, "th") || a.seq - b.seq);
const tambons = [...new Set(lights.map((light) => light.tambon))].sort((a, b) => a.localeCompare(b, "th"));

export default function ReportApp() {
  const [tambon, setTambon] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error("โหลดรายงานไม่สำเร็จ");
      const data = await response.json() as { statuses: Status[] };
      setStatuses(Object.fromEntries(data.statuses.map((status) => [status.facility_id, status])));
      setUpdated(new Date()); setError("");
    } catch { setError("โหลดสถานะล่าสุดไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  const areaLights = useMemo(() => lights.filter((light) => tambon === "all" || light.tambon === tambon), [tambon]);
  const visible = useMemo(() => areaLights.filter((light) => statusFilter === "all" || (statusFilter === "done" ? Boolean(statuses[light.id]?.completed) : !statuses[light.id]?.completed)), [areaLights, statusFilter, statuses]);
  const completed = areaLights.filter((light) => statuses[light.id]?.completed).length;
  const summaries = tambons.map((name) => { const points = lights.filter((light) => light.tambon === name); return { name, total: points.length, done: points.filter((light) => statuses[light.id]?.completed).length }; });

  function downloadCsv() {
    const csvCell = (value: string | number) => { const text = String(value); const safe = /^[=+@\-\t\r]/.test(text) && typeof value === "string" ? "'" + text : text; return '"' + safe.replaceAll('"', '""') + '"'; };
    const rows = [["ตำบล", "ลำดับ", "Location", "PEA", "Rate kVA", "Lat", "Long", "สถานะ", "ผู้สำรวจ", "หมายเหตุ", "อัปเดตล่าสุด"], ...visible.map((light) => { const status = statuses[light.id]; return [light.tambon, light.seq, light.location, light.id, light.rateKva, light.lat, light.long, status?.completed ? "สำรวจแล้ว" : "ยังไม่สำรวจ", status?.surveyor ?? "", status?.note ?? "", status?.updated_at ?? ""]; })];
    const csv = "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `รายงานโคมไฟ_${tambon === "all" ? "ทุกตำบล" : tambon}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className="report-page">
    <header className="report-top"><a href="/" className="report-back"><ArrowLeft size={19} /> กลับแผนที่</a><span>รายงานสำรวจโคมไฟสาธารณะ</span></header>
    <div className="report-body">
      <div className="report-heading"><div><div className="eyebrow">อำเภอน้ำพอง</div><h1>รายงานผลสำรวจ</h1><p>สรุปข้อมูลล่าสุดของทุกตำบลและรายจุด</p></div><div className="report-actions"><Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} /> อัปเดต</Button><Button onClick={downloadCsv} disabled={loading || Boolean(error)}><Download size={17} /> ดาวน์โหลด CSV</Button></div></div>
      {error && <div className="status-error" role="alert">{error}</div>}
      <div className="report-stats"><div><span>จุดทั้งหมด</span><strong>{areaLights.length}</strong></div><div><span>สำรวจแล้ว</span><strong>{loading ? "—" : completed}</strong></div><div><span>ยังไม่สำรวจ</span><strong>{loading ? "—" : areaLights.length - completed}</strong></div><div><span>ตำบล</span><strong>{tambon === "all" ? tambons.length : 1}</strong></div></div>
      <div className="report-filter"><label>ตำบล<Select value={tambon} onValueChange={setTambon}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">ทุกตำบล</SelectItem>{tambons.map((name) => <SelectItem value={name} key={name}>{name}</SelectItem>)}</SelectContent></Select></label><label>สถานะ<Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">ทุกสถานะ</SelectItem><SelectItem value="done">สำรวจแล้ว</SelectItem><SelectItem value="open">ยังไม่สำรวจ</SelectItem></SelectContent></Select></label><span>{updated ? "อัปเดต " + updated.toLocaleTimeString("th-TH") : "กำลังโหลดข้อมูล"}</span></div>
      {tambon === "all" && <section className="area-summary"><h2>สรุปแต่ละตำบล</h2><div className="area-grid">{summaries.map((item) => <button type="button" key={item.name} onClick={() => setTambon(item.name)}><strong>ต.{item.name}</strong><span>{item.done}/{item.total} สำรวจแล้ว</span><div className="progress-track"><i style={{ width: `${item.total ? item.done / item.total * 100 : 0}%` }} /></div></button>)}</div></section>}
      <section className="report-points"><h2>รายการจุด <span>{visible.length} จุด · แตะจุดเพื่อดูบนแผนที่</span></h2><div className="report-list">{visible.map((light) => { const status = statuses[light.id]; return <a key={light.id} href={"/?point=" + encodeURIComponent(light.id)} className="report-point" aria-label={"ดูบนแผนที่ PEA " + light.id + " " + light.location}><div className="report-point-main"><span className="report-seq">{light.seq}</span><div><strong>{light.location === "-" ? "ไม่ระบุ Location" : light.location}</strong><span>ต.{light.tambon} · PEA {light.id} · {light.rateKva} kVA</span><small>{light.lat}, {light.long}</small></div></div><div className="report-point-status"><b className={status?.completed ? "done" : "open"}>{status?.completed ? "สำรวจแล้ว" : "ยังไม่สำรวจ"}</b>{status?.surveyor && <span>ผู้สำรวจ: {status.surveyor}</span>}{status?.note && <span>หมายเหตุ: {status.note}</span>}{status?.updated_at && <small>แก้ไข {new Date(status.updated_at).toLocaleString("th-TH")}</small>}</div></a>; })}</div></section>
    </div>
    <nav className="mobile-nav" aria-label="เมนูหลัก"><a href="/"><MapPinned size={20} />แผนที่</a><a href="/?view=list"><ArrowLeft size={20} />รายการ</a><span className="active"><Download size={20} />รายงาน</span></nav>
  </main>;
}

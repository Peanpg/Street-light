"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, LocateFixed, MapPinned, Search, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import lightsData from "./lights.json";

type Light = { id: string; seq: number; tambon: string; location: string; lat: number; long: number; rateKva: number; feeder: string; sourceStatus: string };
type SurveyStatus = { facility_id: string; completed: number; surveyor: string | null; note: string | null; updated_by: string | null; updated_at: string; revision: string };
const lights = lightsData as Light[];
const tambons = [...new Set(lights.map((light) => light.tambon))].sort((a, b) => a.localeCompare(b, "th"));

async function persistStatus(input: { id: string; completed: boolean; surveyor: string; note: string; expectedRevision: string | null }): Promise<SurveyStatus> {
  const response = await fetch("/api/status", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const result = await response.json() as { status?: SurveyStatus; error?: string; current?: SurveyStatus | null };
  if (response.status === 409) throw new ConflictError(result.error || "ข้อมูลเปลี่ยนแล้ว", result.current ?? null);
  if (!response.ok || !result.status) throw new Error(result.error || "บันทึกไม่สำเร็จ");
  return result.status;
}

class ConflictError extends Error { constructor(message: string, public current: SurveyStatus | null) { super(message); } }

export default function SurveyApp() {
  const [tambon, setTambon] = useState("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [statuses, setStatuses] = useState<Record<string, SurveyStatus>>({});
  const [statusError, setStatusError] = useState("");
  const [statusLoading, setStatusLoading] = useState(true);
  const [draftComplete, setDraftComplete] = useState(false);
  const [surveyor, setSurveyor] = useState("");
  const [note, setNote] = useState("");
  const [baseRevision, setBaseRevision] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [geoMessage, setGeoMessage] = useState("กด ‘ตำแหน่งของฉัน’ เพื่อแสดงตำแหน่งมือถือ");
  const [myPosition, setMyPosition] = useState<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const pinsRef = useRef<import("leaflet").LayerGroup | null>(null);
  const selfRef = useRef<import("leaflet").Marker | null>(null);
  const watchRef = useRef<number | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const viewportKeyRef = useRef("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pointId = params.get("point");
    if (pointId && lights.some((light) => light.id === pointId)) {
      setMobileView("map");
      setSelectedId(pointId);
    } else if (params.get("view") === "list") setMobileView("list");
  }, []);

  const visible = useMemo(() => lights.filter((light) => {
    if (tambon !== "all" && light.tambon !== tambon) return false;
    if (statusFilter === "done" && !statuses[light.id]?.completed) return false;
    if (statusFilter === "open" && statuses[light.id]?.completed) return false;
    const q = query.trim().toLocaleLowerCase("th");
    return !q || (light.location + " " + light.id + " " + light.tambon).toLocaleLowerCase("th").includes(q);
  }), [tambon, query, statusFilter, statuses]);
  const selected = lights.find((light) => light.id === selectedId) ?? null;
  const completedCount = Object.values(statuses).filter((row) => row.completed).length;
  const remoteChanged = Boolean(!statusLoading && selected && (statuses[selected.id]?.revision ?? null) !== baseRevision);

  const refreshStatuses = useCallback(async () => {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const data = await response.json() as { statuses: SurveyStatus[] };
      setStatuses(Object.fromEntries(data.statuses.map((row) => [row.facility_id, row])));
      setStatusError("");
    } catch {
      setStatusError("สถานะส่วนกลางยังไม่พร้อม กรุณาลองโหลดใหม่");
    } finally { setStatusLoading(false); }
  }, []);

  useEffect(() => {
    void refreshStatuses();
    const interval = window.setInterval(() => { if (!document.hidden) void refreshStatuses(); }, 5000);
    const onFocus = () => void refreshStatuses();
    const onVisible = () => { if (!document.hidden) void refreshStatuses(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisible); };
  }, [refreshStatuses]);

  useEffect(() => {
    type Tool = { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => Promise<unknown> };
    const context = (document as Document & { modelContext?: { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Tool) => {
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(console.error); }
      catch (error) { console.error(error); }
    };
    register({
      name: "list_survey_points", title: "ค้นหาจุดสำรวจ", description: "แสดงจุดสำรวจโคมไฟตามตำบล Location หรือรหัส PEA พร้อมพิกัดและสถานะล่าสุด",
      inputSchema: { type: "object", properties: { tambon: { type: "string" }, query: { type: "string" } }, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(input) {
        const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
        const area = typeof value.tambon === "string" ? value.tambon : "";
        const q = typeof value.query === "string" ? value.query.toLocaleLowerCase("th") : "";
        if (area && !tambons.includes(area)) throw new Error("ไม่พบตำบลนี้");
        const response = await fetch("/api/status", { cache: "no-store" });
        if (!response.ok) throw new Error("ไม่สามารถโหลดสถานะสำรวจได้");
        const data = await response.json() as { statuses: SurveyStatus[] };
        const latest = Object.fromEntries(data.statuses.map((row) => [row.facility_id, row]));
        setStatuses(latest);
        return lights.filter((light) => (!area || light.tambon === area) && (!q || (light.location + " " + light.id).toLocaleLowerCase("th").includes(q)))
          .map((light) => ({ tambon: light.tambon, seq: light.seq, location: light.location, pea: light.id, lat: light.lat, long: light.long, rateKva: light.rateKva, completed: Boolean(latest[light.id]?.completed), revision: latest[light.id]?.revision ?? null }));
      },
    });
    register({
      name: "save_survey_status", title: "บันทึกสถานะสำรวจ", description: "บันทึกว่าจุด PEA สำรวจแล้วหรือยัง พร้อมชื่อผู้สำรวจและหมายเหตุ ให้ทีมเห็นร่วมกัน",
      inputSchema: { type: "object", properties: { pea: { type: "string" }, completed: { type: "boolean" }, surveyor: { type: "string" }, note: { type: "string" }, expectedRevision: { type: ["string", "null"] } }, required: ["pea", "completed", "surveyor", "expectedRevision"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        if (!input || typeof input !== "object") throw new Error("ข้อมูลไม่ถูกต้อง");
        const value = input as Record<string, unknown>;
        if (typeof value.pea !== "string" || !lights.some((light) => light.id === value.pea) || typeof value.completed !== "boolean" || typeof value.surveyor !== "string" || (value.note !== undefined && typeof value.note !== "string") || !(value.expectedRevision === null || typeof value.expectedRevision === "string")) throw new Error("ข้อมูลไม่ถูกต้อง");
        const surveyorName = value.surveyor.trim();
        const noteText = typeof value.note === "string" ? value.note.trim() : "";
        if (!surveyorName || surveyorName.length > 80 || noteText.length > 500) throw new Error("กรุณากรอกชื่อผู้สำรวจให้ถูกต้อง");
        const status = await persistStatus({ id: value.pea, completed: value.completed, surveyor: surveyorName, note: noteText, expectedRevision: value.expectedRevision });
        setStatuses((previous) => ({ ...previous, [status.facility_id]: status }));
        setSelectedId(status.facility_id);
        setDraftComplete(Boolean(status.completed)); setSurveyor(status.surveyor ?? ""); setNote(status.note ?? ""); setBaseRevision(status.revision); setSaveMessage("บันทึกแล้ว ทีมคนอื่นจะเห็นสถานะนี้");
        return { pea: status.facility_id, completed: Boolean(status.completed), updatedAt: status.updated_at };
      },
    });
    register({
      name: "delete_survey_status", title: "ลบผลสำรวจ", description: "ลบเฉพาะผลสำรวจของจุด PEA โดยคงจุดจากไฟล์ต้นทางไว้",
      inputSchema: { type: "object", properties: { pea: { type: "string" }, expectedRevision: { type: "string" } }, required: ["pea", "expectedRevision"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        if (!input || typeof input !== "object") throw new Error("ข้อมูลไม่ถูกต้อง");
        const value = input as Record<string, unknown>;
        if (typeof value.pea !== "string" || !lights.some((light) => light.id === value.pea) || typeof value.expectedRevision !== "string" || !value.expectedRevision) throw new Error("ข้อมูลไม่ถูกต้อง");
        const response = await fetch("/api/status", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: value.pea, expectedRevision: value.expectedRevision }) });
        const result = await response.json() as { deleted?: string; error?: string };
        if (!response.ok || !result.deleted) throw new Error(result.error || "ลบไม่สำเร็จ");
        setStatuses((previous) => { const next = { ...previous }; delete next[result.deleted!]; return next; });
        setSelectedId(result.deleted);
        setDraftComplete(false); setSurveyor(""); setNote(""); setBaseRevision(null); setSaveMessage("ลบผลสำรวจแล้ว จุด PEA ยังอยู่ในรายการ");
        return { pea: result.deleted, deleted: true };
      },
    });
    return () => lifecycle.abort();
  }, []);

  useEffect(() => {
    if (statusLoading) return;
    const status = selectedId ? statuses[selectedId] : null;
    setDraftComplete(Boolean(status?.completed));
    setSurveyor(status?.surveyor ?? "");
    setNote(status?.note ?? "");
    setBaseRevision(status?.revision ?? null);
    setSaveMessage("");
  // Do not overwrite a person's unsaved form while the shared status refreshes.
  }, [selectedId, statusLoading]);

  useEffect(() => {
    let active = true;
    async function setup() {
      const L = await import("leaflet");
      if (!active || !mapEl.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(mapEl.current, { zoomControl: false }).setView([16.70, 102.86], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;
      pinsRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
    }
    void setup();
    return () => { active = false; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const L = leafletRef.current, map = mapRef.current, layer = pinsRef.current;
    if (!L || !map || !layer) return;
    if (mobileView === "map") map.invalidateSize();
    layer.clearLayers();
    for (const light of visible) {
      const icon = L.divIcon({ className: "", html: '<div class="pin ' + (selectedId === light.id ? "pin-selected" : statuses[light.id]?.completed ? "pin-done" : "") + '"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
      L.marker([light.lat, light.long], { icon }).on("click", () => setSelectedId(light.id)).addTo(layer);
    }
    const viewportKey = visible.map((light) => light.id).join("|") + ":" + selectedId;
    if (viewportKey !== viewportKeyRef.current) {
      viewportKeyRef.current = viewportKey;
      if (selected && visible.some((light) => light.id === selected.id)) {
        const zoom = Math.max(map.getZoom(), 15);
        const target: [number, number] = [selected.lat, selected.long];
        // On phones the detail sheet covers the lower half of the map. Keep the pin above it.
        const center = window.matchMedia("(max-width: 800px)").matches && mobileView === "map"
          ? map.unproject(map.project(target, zoom).add([0, Math.min(210, map.getSize().y * 0.28)]), zoom)
          : L.latLng(target);
        map.flyTo(center, zoom, { duration: 0.6 });
      }
      else if (visible.length) map.fitBounds(L.latLngBounds(visible.map((light) => [light.lat, light.long])), { padding: [30, 30], maxZoom: 14 });
    }
  }, [visible, selectedId, selected, mapReady, statuses, mobileView]);

  useEffect(() => {
    const L = leafletRef.current, map = mapRef.current;
    if (!L || !map || !myPosition) return;
    selfRef.current?.remove();
    selfRef.current = L.marker(myPosition, { icon: L.divIcon({ className: "", html: '<div class="pin-self"></div>', iconSize: [25, 25], iconAnchor: [12, 12] }) }).addTo(map);
  }, [myPosition]);

  function locateMe() {
    if (!navigator.geolocation) { setGeoMessage("อุปกรณ์นี้ไม่รองรับการแสดงตำแหน่ง"); return; }
    setGeoMessage("กำลังค้นหาตำแหน่งมือถือ…");
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    let centerOnFirstFix = true;
    watchRef.current = navigator.geolocation.watchPosition(({ coords }) => {
      const next: [number, number] = [coords.latitude, coords.longitude];
      setMyPosition(next);
      // Center only when the button is tapped; preserve the user's zoom and
      // let subsequent GPS updates move the marker without moving the map.
      if (centerOnFirstFix) {
        mapRef.current?.panTo(next, { animate: true });
        centerOnFirstFix = false;
      }
      setGeoMessage("ตำแหน่งของฉัน: " + coords.latitude.toFixed(5) + ", " + coords.longitude.toFixed(5));
    }, () => setGeoMessage("ไม่สามารถอ่านพิกัดได้ กรุณาอนุญาตตำแหน่งในเบราว์เซอร์"), { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
  }

  useEffect(() => () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); }, []);

  async function saveSelected() {
    if (!selected || saving) return;
    if (remoteChanged) { setSaveMessage("มีคนอื่นแก้ไขจุดนี้แล้ว กรุณาโหลดข้อมูลล่าสุดก่อน"); return; }
    if (!surveyor.trim()) { setSaveMessage("กรุณากรอกชื่อผู้สำรวจ"); return; }
    setSaving(true); setSaveMessage("");
    try {
      const status = await persistStatus({ id: selected.id, completed: draftComplete, surveyor: surveyor.trim(), note: note.trim(), expectedRevision: baseRevision });
      setStatuses((previous) => ({ ...previous, [selected.id]: status }));
      setBaseRevision(status.revision);
      setSaveMessage("บันทึกแล้ว ทีมคนอื่นจะเห็นสถานะนี้");
    } catch (error) { handleMutationError(error); }
    finally { setSaving(false); }
  }

  function handleMutationError(error: unknown) {
    if (error instanceof ConflictError && selected) {
      setStatuses((previous) => { const next = { ...previous }; if (error.current) next[selected.id] = error.current; else delete next[selected.id]; return next; });
    }
    setSaveMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
  }

  function loadLatest() {
    if (!selected) return;
    const latest = statuses[selected.id];
    setDraftComplete(Boolean(latest?.completed)); setSurveyor(latest?.surveyor ?? ""); setNote(latest?.note ?? ""); setBaseRevision(latest?.revision ?? null); setSaveMessage("");
  }

  async function deleteSelected() {
    if (!selected || !baseRevision || saving || remoteChanged) return;
    setSaving(true); setSaveMessage("");
    try {
      const response = await fetch("/api/status", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, expectedRevision: baseRevision }) });
      const result = await response.json() as { deleted?: string; error?: string; current?: SurveyStatus | null };
      if (response.status === 409) throw new ConflictError(result.error || "ข้อมูลเปลี่ยนแล้ว", result.current ?? null);
      if (!response.ok || !result.deleted) throw new Error(result.error || "ลบไม่สำเร็จ");
      setStatuses((previous) => { const next = { ...previous }; delete next[selected.id]; return next; });
      setDraftComplete(false); setSurveyor(""); setNote(""); setBaseRevision(null);
      setSaveMessage("ลบผลสำรวจแล้ว จุด PEA ยังอยู่ในรายการ");
    } catch (error) { handleMutationError(error); }
    finally { setSaving(false); }
  }

  const detail = selected && <div className="detail-card">
    <div className="detail-heading"><span>จุดที่เลือก · ต.{selected.tambon}</span><button type="button" onClick={() => setSelectedId(null)} aria-label="ปิดรายละเอียด">×</button></div>
    <div className="detail-location">{selected.location === "-" ? "ไม่ระบุ Location" : selected.location}</div>
    <div className="detail-meta">PEA {selected.id} · {selected.rateKva} kVA · {selected.feeder}</div>
    <div className="detail-coords">{selected.lat}, {selected.long} <a href={"https://www.google.com/maps?q=" + selected.lat + "," + selected.long} target="_blank" rel="noopener noreferrer">เปิดนำทาง ↗</a></div>
    {remoteChanged && <div className="conflict-warning" role="alert">มีคนอื่นอัปเดตจุดนี้แล้ว <Button size="sm" variant="outline" onClick={loadLatest}>โหลดข้อมูลล่าสุด</Button></div>}
    <label className="check-row"><Checkbox checked={draftComplete} onCheckedChange={(checked) => setDraftComplete(checked === true)} disabled={Boolean(statusError) || statusLoading} /><span>สำรวจแล้ว</span></label>
    <div className="detail-fields"><label>ผู้สำรวจ<Input value={surveyor} onChange={(event) => setSurveyor(event.target.value)} placeholder="ชื่อผู้สำรวจ" maxLength={80} /></label><label>หมายเหตุ (ถ้ามี)<Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="ผลสำรวจหรือข้อสังเกต" maxLength={500} /></label></div>
    <div className="detail-actions"><Button onClick={() => void saveSelected()} disabled={saving || remoteChanged || Boolean(statusError) || statusLoading}>{saving ? "กำลังบันทึก…" : statuses[selected.id] ? "บันทึกการแก้ไข" : "บันทึกผลสำรวจ"}</Button>{statuses[selected.id] && <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" disabled={saving || remoteChanged} className="delete-button">ลบผลสำรวจ</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>ลบผลสำรวจจุดนี้?</AlertDialogTitle><AlertDialogDescription>จะลบสถานะ ผู้สำรวจ และหมายเหตุที่บันทึกไว้ แต่จุด PEA ยังอยู่ในแผนที่</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ยกเลิก</AlertDialogCancel><AlertDialogAction onClick={() => void deleteSelected()} className="bg-red-700 text-white hover:bg-red-800">ยืนยันลบ</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}{statuses[selected.id]?.updated_at && <span>อัปเดต {new Date(statuses[selected.id].updated_at).toLocaleString("th-TH")}</span>}</div>
    {saveMessage && <p className="save-message" role="status">{saveMessage}</p>}
  </div>;

  return <main className="shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Zap size={22} /></div><div><div className="brand-title">สำรวจโคมไฟสาธารณะ</div><div className="brand-sub">อำเภอน้ำพอง · แผนที่หม้อแปลง PEA</div></div></div><div className="topbar-actions"><div className="top-count">{statusLoading || statusError ? lights.length + " จุด" : completedCount + "/" + lights.length + " สำรวจแล้ว"}</div><a className="report-link" href="/report"><ClipboardList size={17} /> รายงาน</a></div></header>
    <div className={"workspace view-" + mobileView}>
      <aside className="sidebar"><div className="sidebar-head"><div className="eyebrow">รายการสำรวจ</div><h1 className="section-title">เลือกพื้นที่และจุดงาน</h1><div className="search-stack">
        <div><label className="search-label">ตำบล</label><Select value={tambon} onValueChange={(value) => { setTambon(value); setSelectedId(null); }}><SelectTrigger className="search-control"><SelectValue placeholder="ทุกตำบล" /></SelectTrigger><SelectContent><SelectItem value="all">ทุกตำบล</SelectItem>{tambons.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
        <div><label className="search-label" htmlFor="search">ค้นหา Location หรือ PEA</label><div className="relative"><Search size={17} className="absolute left-3 top-3 text-slate-500" /><Input id="search" className="search-control pl-9" placeholder="พิมพ์ชื่อสถานที่หรือรหัส PEA" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(null); }} /></div></div>
        <div><label className="search-label">สถานะ</label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="search-control"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">ทุกสถานะ</SelectItem><SelectItem value="open">ยังไม่บันทึกสำรวจ</SelectItem><SelectItem value="done">สำรวจแล้ว</SelectItem></SelectContent></Select></div>
      </div></div>
      {statusError && <div className="status-error" role="alert">{statusError} <button onClick={() => void refreshStatuses()}>ลองใหม่</button></div>}
      {detail}
      <div className="summary-line"><span>แสดง {visible.length} จุด</span><span>{tambon === "all" ? "ทุกตำบล" : "ต." + tambon}</span></div>
      <div className="result-list">{visible.length ? visible.map((light) => <button key={light.id} type="button" className={"result-card " + (selectedId === light.id ? "active" : "")} onClick={() => setSelectedId(light.id)}><div className="result-top"><span className="result-number">{light.seq}</span><span className="result-name">{light.location === "-" ? "ไม่ระบุ Location" : light.location}</span>{statuses[light.id]?.completed ? <CheckCircle2 size={18} color="#258367" aria-label="สำรวจแล้ว" /> : <MapPinned size={17} />}</div><div className="result-pea">PEA {light.id} · {light.rateKva} kVA {statuses[light.id]?.completed ? "· สำรวจแล้ว" : ""}</div></button>) : <p className="p-4 text-sm text-slate-600">ไม่พบจุดที่ตรงกับคำค้น</p>}</div></aside>
      <section className="map-wrap" aria-label="แผนที่จุดสำรวจ"><div className="map" ref={mapEl} /><div className="map-filter"><Select value={tambon} onValueChange={(value) => { setTambon(value); setSelectedId(null); }}><SelectTrigger aria-label="เลือกตำบลบนแผนที่"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">ทุกตำบล</SelectItem>{tambons.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div><div className="map-tools"><Button className="map-tool" variant="outline" onClick={locateMe}><LocateFixed size={18} /> ตำแหน่งของฉัน</Button></div><div className="map-hint">{selected ? "PEA " + selected.id + " · " + selected.location + " · " + selected.rateKva + " kVA" : geoMessage}</div><div className="mobile-detail">{detail}</div></section>
    </div>
    <nav className="mobile-nav" aria-label="เมนูหลัก"><button className={mobileView === "map" ? "active" : ""} onClick={() => { viewportKeyRef.current = ""; setMobileView("map"); }}><MapPinned size={20} />แผนที่</button><button className={mobileView === "list" ? "active" : ""} onClick={() => setMobileView("list")}><Search size={20} />รายการ</button><a href="/report"><ClipboardList size={20} />รายงาน</a></nav>
  </main>;
}

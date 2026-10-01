"use client";
import { useEffect, useRef, useState } from "react";
import type { Map, LayerGroup } from "leaflet";
type Position = { lat: number; long: number; accuracy: number; capturedAt: number };
type Member = Position & { id: string; name: string; updated_at: string };
type Props = { map: Map | null; ready: boolean; position: Position | null; sharing: boolean; onTeamConfirmed: (name: string) => void };
export default function TeamLocations({ map, ready, position, sharing, onTeamConfirmed }: Props) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [confirmedName, setConfirmedName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [shared, setShared] = useState(false);
  const credentials = useRef({ id: "", token: "" });
  const current = useRef({ position, name: confirmedName });
  current.current = { position, name: confirmedName };
  const layers = useRef<LayerGroup | null>(null);
  useEffect(() => {
    let saved: { id: string; token: string } | null = null;
    try { saved = JSON.parse(sessionStorage.getItem("meter-gps-session") || "null"); } catch {}
    if (!saved?.id || !saved?.token) saved = { id: crypto.randomUUID(), token: crypto.randomUUID() };
    credentials.current = saved;
    try { sessionStorage.setItem("meter-gps-session", JSON.stringify(saved)); } catch {}
    setId(saved.id);
    try {
      const savedName = sessionStorage.getItem("meter-confirmed-team")?.trim();
      if (savedName) { setName(savedName); setConfirmedName(savedName); onTeamConfirmed(savedName); }
    } catch {}
  }, []);
  useEffect(() => {
    let active = true, busy = false;
    async function read() {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch("/api/locations", { cache: "no-store", signal: AbortSignal.timeout(12000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) { setMembers(data.positions); if (!sharing) setError(""); }
      } catch (e) { if (active) { setMembers([]); setError(e instanceof Error ? e.message : "โหลดตำแหน่งทีมไม่สำเร็จ"); } }
      finally { busy = false; }
    }
    void read();
    const timer = window.setInterval(() => { if (!document.hidden) void read(); }, 5000);
    const visible = () => { if (!document.hidden) void read(); };
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [sharing]);
  useEffect(() => {
    if (!sharing || !confirmedName || !id) { setShared(false); return; }
    let active = true;
    let pending: Promise<void> | null = null;
    async function send() {
      const p = current.current.position;
      if (!active || pending || document.hidden || !p) return;
      if (Date.now() - p.capturedAt > 45000) { setShared(false); setError("GPS ไม่ได้อัปเดต ตำแหน่งเก่าจะหายอัตโนมัติ"); return; }
      pending = (async () => {
        try {
          const response = await fetch("/api/locations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...credentials.current, name: current.current.name.trim() || "ทีม-" + id.slice(0, 4), ...p }), signal: AbortSignal.timeout(12000) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          if (active) { setShared(true); setError(""); }
        } catch (e) { if (active) { setShared(false); setError(e instanceof Error ? e.message : "แชร์ตำแหน่งไม่สำเร็จ"); } }
      })();
      await pending; pending = null;
    }
    void send();
    const timer = window.setInterval(() => void send(), 10000);
    return () => {
      active = false; clearInterval(timer);
      // Stop uploads; the server expires the last position after 90 seconds.
    };
  }, [sharing, confirmedName, id]);
  useEffect(() => {
    if (!map || !ready) return;
    let active = true;
    void import("leaflet").then(L => {
      if (!active) return;
      layers.current?.remove();
      layers.current = L.layerGroup().addTo(map);
      for (const member of members) {
        // The server applies expiry using its own clock, which may differ from a phone's clock.
        if (member.id === id) continue;
        const label = document.createElement("div");
        label.textContent = `${member.name} · GPS ±${Math.round(member.accuracy)} ม. · อัปเดต ${new Date(member.updated_at).toLocaleTimeString("th-TH")}`;
        const tooltip = document.createElement("span"); tooltip.textContent = member.name;
        L.marker([member.lat, member.long], { icon: L.divIcon({ className: "", html: '<div class="pin-team"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }) }).bindTooltip(tooltip, { permanent: true, direction: "top", className: "team-tooltip" }).bindPopup(label).addTo(layers.current);
      }
    });
    return () => { active = false; layers.current?.remove(); layers.current = null; };
  }, [map, ready, members, id]);
  return <details className="team-panel" open={sharing && !confirmedName ? true : undefined}><summary>ทีมออนไลน์ {members.filter(m => m.id !== id).length} คน {sharing && confirmedName ? shared ? "· ออนไลน์" : "· กำลังเชื่อมต่อ" : ""}</summary>
    <form onSubmit={event => {
      event.preventDefault();
      const value = name.trim();
      if (!value) return;
      setConfirmedName(value); onTeamConfirmed(value);
      try { sessionStorage.setItem("meter-confirmed-team", value); } catch {}
    }}>
      <label>กรุณากรอกชื่อทีม<input aria-label="ชื่อทีมบนแผนที่" placeholder="ชื่อทีม" value={name} required maxLength={80} onChange={e => setName(e.target.value)} /></label>
      <small>ตำแหน่งจะแสดงให้ทีม</small>
      <button type="submit" disabled={!name.trim()}>ยืนยัน</button>
    </form>
    {error && <p role="status" className="team-error">{error}</p>}
    <small>ตำแหน่งหายเมื่อไม่อัปเดต 90 วินาที</small>
  </details>;
}

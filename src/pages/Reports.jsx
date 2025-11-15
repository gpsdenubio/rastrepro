// src/pages/Reports.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { MapPin, Activity, Clock, AlertTriangle, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Reports.jsx - Pacote C (premium)
 * - Abas: Rotas, Viagens, Paradas, Histórico, Eventos
 * - Filtros: data range (início/fim) e seleção de veículo
 * - Export: Excel, PDF
 * - Gráficos básicos (Recharts)
 *
 * Observação:
 * - Este componente usa /devices e /positions como fonte inicial.
 * - Para relatórios 100% confiáveis substitua por endpoints do backend
 *   que já retornem viagens/rotas/paradas agregadas.
 */

const todayISO = () => new Date().toISOString().slice(0, 10);

function formatDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function Reports() {
  const [devices, setDevices] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(todayISO());

  const [activeTab, setActiveTab] = useState("rotas");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [dres, pres] = await Promise.all([api.get("/devices"), api.get("/positions")]);
        setDevices(dres.data || []);
        setPositions(pres.data || []);
      } catch (err) {
        console.error("Erro ao carregar relatórios:", err);
        setDevices([]);
        setPositions([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // filtrar positions por data e veículo
  const filteredPositions = useMemo(() => {
    const from = new Date(fromDate).getTime();
    const to = new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1; // fim do dia
    return (positions || []).filter((p) => {
      const time = new Date(p.serverTime || p.fixTime || p.timestamp || p.deviceTime || p.time).getTime();
      if (Number.isNaN(time)) return false;
      if (time < from || time > to) return false;
      if (vehicleFilter !== "all") return p.deviceId === Number(vehicleFilter);
      return true;
    }).sort((a,b) => new Date(a.serverTime || a.fixTime || a.timestamp || a.deviceTime || a.time) - new Date(b.serverTime || b.fixTime || b.timestamp || b.deviceTime || b.time));
  }, [positions, fromDate, toDate, vehicleFilter]);

  // dados simples para tabela Rotas: agrupamento por device: primeiro e último ponto no período
  const routes = useMemo(() => {
    const byDevice = {};
    for (const p of filteredPositions) {
      const id = p.deviceId;
      if (!byDevice[id]) byDevice[id] = [];
      byDevice[id].push(p);
    }
    const rows = [];
    for (const idStr of Object.keys(byDevice)) {
      const arr = byDevice[idStr];
      const first = arr[0];
      const last = arr[arr.length - 1];
      const device = devices.find((d) => d.id === Number(idStr)) || {};
      rows.push({
        deviceId: idStr,
        deviceName: device.name || device.uniqueId || `#${idStr}`,
        startTime: first?.serverTime || first?.fixTime || first?.time || null,
        startLat: first?.latitude,
        startLon: first?.longitude,
        endTime: last?.serverTime || last?.fixTime || last?.time || null,
        endLat: last?.latitude,
        endLon: last?.longitude,
        // distância não calculada (placeholder) — pode ser implementada via haversine ou backend
        distanceKm: "—",
        points: arr.length,
      });
    }
    return rows;
  }, [filteredPositions, devices]);

  // Viagens: por device, contar deslocamentos (aqui simplificado: se houver mais de 1 ponto -> 1 viagem)
  const trips = useMemo(() => {
    return routes.map(r => ({
      id: r.deviceId,
      vehicle: r.deviceName,
      start: r.startTime,
      end: r.endTime,
      duration: r.startTime && r.endTime ? msToDuration(new Date(r.endTime) - new Date(r.startTime)) : "-",
      points: r.points
    }));
  }, [routes]);

  // Paradas: pontos com speed === 0 agrupados (simples)
  const stops = useMemo(() => {
    const stopsList = [];
    let cur = null;
    for (const p of filteredPositions) {
      const speed = p.speed ?? 0;
      if (speed === 0) {
        if (!cur) {
          cur = { deviceId: p.deviceId, start: p.serverTime || p.fixTime || p.time, end: p.serverTime || p.fixTime || p.time, lat: p.latitude, lon: p.longitude, count:1 };
        } else {
          cur.end = p.serverTime || p.fixTime || p.time;
          cur.count++;
        }
      } else {
        if (cur) {
          stopsList.push(cur);
          cur = null;
        }
      }
    }
    if (cur) stopsList.push(cur);
    // map with names
    return stopsList.map(s => {
      const device = devices.find(d => d.id === Number(s.deviceId)) || {};
      return {
        deviceId: s.deviceId,
        vehicle: device.name || device.uniqueId || `#${s.deviceId}`,
        start: s.start,
        end: s.end,
        duration: s.start && s.end ? msToDuration(new Date(s.end) - new Date(s.start)) : "-",
        lat: s.lat,
        lon: s.lon
      };
    });
  }, [filteredPositions, devices]);

  // Eventos simples: transformar attributes (excesso de velocidade, ignition off/on, etc)
  const events = useMemo(() => {
    const ev = [];
    for (const p of filteredPositions) {
      const attrs = p.attributes || {};
      if (attrs.alarm) {
        ev.push({ id: p.id, deviceId: p.deviceId, vehicle: (devices.find(d=>d.id===p.deviceId)?.name||p.deviceId), type: attrs.alarm, time: p.serverTime || p.fixTime || p.time });
      }
      // limite de velocidade (exemplo): caso speed > 80
      if ((p.speed || 0) > 80) {
        ev.push({ id: `spd-${p.id}`, deviceId: p.deviceId, vehicle: devices.find(d=>d.id===p.deviceId)?.name || p.deviceId, type: "Excesso de Velocidade", time: p.serverTime || p.fixTime || p.time, speed: p.speed });
      }
    }
    return ev;
  }, [filteredPositions, devices]);

  // histórico = filteredPositions com colunas úteis
  const history = useMemo(() => filteredPositions.map(p => ({
    time: p.serverTime || p.fixTime || p.time,
    deviceId: p.deviceId,
    vehicle: devices.find(d=>d.id===p.deviceId)?.name || p.deviceId,
    lat: p.latitude,
    lon: p.longitude,
    speed: p.speed || 0,
    address: p.address || "-"
  })), [filteredPositions, devices]);

  // charts: viagens por dia (contagem)
  const tripsByDay = useMemo(() => {
    const map = {};
    for (const t of trips) {
      const day = (t.start ? new Date(t.start).toLocaleDateString() : "N/A");
      map[day] = (map[day] || 0) + 1;
    }
    return Object.keys(map).map(k => ({ day: k, trips: map[k] }));
  }, [trips]);

  function msToDuration(ms) {
    if (!ms || ms <= 0) return "-";
    const s = Math.floor(ms/1000);
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    return `${h}h ${m}m`;
  }

  // ---- EXPORT FUNCTIONS ----
  const exportTableToXlsx = (rows, filename = "report.xlsx") => {
    // rows: array of objects or arrays
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), filename);
  };

  const exportDivToPdf = async (elementId = "report-area", filename = "report.pdf") => {
    const el = document.getElementById(elementId);
    if (!el) {
      alert("Elemento de exportação não encontrado.");
      return;
    }
    const canvas = await html2canvas(el, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: [canvas.width, canvas.height]
    });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(filename);
  };

  // helper para exportar a aba atual em formato tabular
  const getCurrentTabRows = () => {
    switch(activeTab) {
      case "rotas": return routes.map(r => ({ ID: r.deviceId, Veículo: r.deviceName, Início: r.startTime ? formatDateTime(r.startTime) : "-", Fim: r.endTime ? formatDateTime(r.endTime) : "-", Distância_km: r.distanceKm }));
      case "viagens": return trips.map(t => ({ ID: t.id, Veículo: t.vehicle, Início: t.start ? formatDateTime(t.start) : "-", Fim: t.end ? formatDateTime(t.end) : "-", Duração: t.duration }));
      case "paradas": return stops.map((s, i) => ({ ID: i+1, Veículo: s.vehicle, Início: s.start ? formatDateTime(s.start) : "-", Fim: s.end ? formatDateTime(s.end) : "-", Duração: s.duration }));
      case "historico": return history.map(h => ({ Data: formatDateTime(h.time), Veículo: h.vehicle, Lat: h.lat, Lon: h.lon, Velocidade: h.speed }));
      case "eventos": return events.map(e => ({ ID: e.id, Tipo: e.type, Veículo: e.vehicle, Horário: e.time, Velocidade: e.speed || "-" }));
      default: return [];
    }
  };

  if (loading) return <div className="p-6">Carregando relatórios...</div>;

  return (
    <div className="w-full h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-sky-700">Relatórios</h1>

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Veículo</label>
          <select className="px-2 py-1 border rounded" value={vehicleFilter} onChange={(e)=>setVehicleFilter(e.target.value)}>
            <option value="all">Todos</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name || d.uniqueId}</option>)}
          </select>

          <label className="text-sm text-gray-600">De</label>
          <input type="date" className="px-2 py-1 border rounded" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} />
          <label className="text-sm text-gray-600">Até</label>
          <input type="date" className="px-2 py-1 border rounded" value={toDate} onChange={(e)=>setToDate(e.target.value)} />

          <div className="flex items-center gap-2">
            <button onClick={()=>{ setFromDate(()=>{ const d=new Date(); d.setDate(d.getDate()-7); return d.toISOString().slice(0,10); }); setToDate(todayISO()); }} className="px-3 py-1 bg-white border rounded">Últimos 7d</button>
          </div>
        </div>
      </div>

      {/* EXPORT / TABS */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 bg-white p-2 rounded shadow">
          <button onClick={() => { const rows = getCurrentTabRows(); exportTableToXlsx(rows, `${activeTab}_report.xlsx`); }} className="px-3 py-1 flex items-center gap-2 bg-sky-600 text-white rounded">
            <Download size={14} /> Exportar XLSX
          </button>

          <button onClick={() => exportDivToPdf("report-area", `${activeTab}_report.pdf`)} className="px-3 py-1 flex items-center gap-2 border rounded">
            <Download size={14} /> Exportar PDF
          </button>
        </div>

        <div className="flex items-center gap-2">
          {["rotas","viagens","paradas","historico","eventos"].map(t => (
            <button key={t} onClick={()=>{setActiveTab(t); setActiveTab(t);}} className={`px-3 py-1 rounded ${activeTab===t ? "bg-sky-600 text-white" : "bg-white border"}`}>
              {t==="rotas" && "Rotas"}
              {t==="viagens" && "Viagens"}
              {t==="paradas" && "Paradas"}
              {t==="historico" && "Histórico"}
              {t==="eventos" && "Eventos"}
            </button>
          ))}
        </div>
      </div>

      {/* Area do relatório (exportável por PDF) */}
      <div id="report-area" className="bg-white rounded-2xl p-4 border shadow">
        {/* Painel superior: gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="p-3 border rounded">
            <h3 className="text-sm text-gray-600">Viagens por dia</h3>
            <div style={{ width: "100%", height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tripsByDay}>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="trips" fill="#0284c7" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-3 border rounded">
            <h3 className="text-sm text-gray-600">Total de viagens</h3>
            <div className="text-3xl font-bold text-sky-700">{trips.length}</div>
            <div className="text-sm text-gray-500">Período selecionado</div>
          </div>

          <div className="p-3 border rounded">
            <h3 className="text-sm text-gray-600">Eventos detectados</h3>
            <div className="text-3xl font-bold text-red-600">{events.length}</div>
            <div className="text-sm text-gray-500">Inclui alarmes e excesso de velocidade</div>
          </div>
        </div>

        {/* Conteúdo da aba */}
        <div>
          {activeTab === "rotas" && (
            <SimpleTable
              columns={["Veículo", "Início", "Fim", "Pontos", "Distância (km)"]}
              rows={routes.map(r=>[r.deviceName, r.startTime?formatDateTime(r.startTime):"-", r.endTime?formatDateTime(r.endTime):"-", r.points, r.distanceKm])}
            />
          )}

          {activeTab === "viagens" && (
            <SimpleTable
              columns={["Veículo", "Início", "Fim", "Duração", "Pontos"]}
              rows={trips.map(t=>[t.vehicle, t.start?formatDateTime(t.start):"-", t.end?formatDateTime(t.end):"-", t.duration, t.points])}
            />
          )}

          {activeTab === "paradas" && (
            <SimpleTable
              columns={["Veículo", "Início", "Fim", "Duração", "Lat", "Lon"]}
              rows={stops.map(s=>[s.vehicle, s.start?formatDateTime(s.start):"-", s.end?formatDateTime(s.end):"-", s.duration, s.lat, s.lon])}
            />
          )}

          {activeTab === "historico" && (
            <SimpleTable
              columns={["Data", "Veículo", "Lat", "Lon", "Velocidade"]}
              rows={history.map(h=>[formatDateTime(h.time), h.vehicle, h.lat, h.lon, h.speed])}
            />
          )}

          {activeTab === "eventos" && (
            <SimpleTable
              columns={["Tipo", "Veículo", "Horário", "Detalhes"]}
              rows={events.map(e=>[e.type, e.vehicle, e.time?formatDateTime(e.time):"-", e.speed?`Vel ${e.speed} km/h`:""])}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- SimpleTable component -------------------- */
function SimpleTable({ columns = [], rows = [] }) {
  return (
    <div className="overflow-auto mt-4 rounded">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-4 text-sm text-gray-500" colSpan={columns.length}>
                Nenhum registro encontrado no período selecionado.
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {r.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-sm text-gray-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


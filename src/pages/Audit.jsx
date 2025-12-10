import React, { useEffect, useMemo, useRef, useState } from "react";
import { getAuditLogs } from "../services/traccar";
import { useAuth } from "../context/AuthContext";
import { useEventSocket } from "../hooks/useEventSocket";

const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

const formatRange = (range) => {
  const now = new Date();
  const startOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  switch (range) {
    case "today": {
      const from = startOfDay(now);
      return { from, to: now };
    }
    case "7d": {
      const from = startOfDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      return { from, to: now };
    }
    case "month": {
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      return { from, to: now };
    }
    default:
      return { from: startOfDay(now), to: now };
  }
};

const toIso = (date) => (date ? new Date(date).toISOString() : "");

const translateAction = (val) => {
  const key = String(val || "").toLowerCase();
  const map = {
    report: "Relatório",
    create: "Criar",
    update: "Atualizar",
    delete: "Excluir",
    remove: "Excluir",
    command: "Comando",
    login: "Login",
    logout: "Logout",
    device: "Dispositivo",
  };
  return map[key] || val || "-";
};

const translateObject = (val) => {
  const key = String(val || "").toLowerCase();
  const map = {
    device: "Dispositivo",
    user: "Usuário",
    geofence: "Cerca",
    position: "Posição",
    report: "Relatório",
    command: "Comando",
    config: "Configuração",
    group: "Grupo",
  };
  return map[key] || val || "-";
};

const mapEntry = (item, idx) => {
  const time =
    item.actionTime ||
    item.time ||
    item.timestamp ||
    item.date ||
    item.eventTime ||
    item.deviceTime ||
    item.serverTime;
  return {
    id: item.id || idx || `${Date.now()}-${Math.random()}`,
    time,
    account:
      item.account ||
      item.user ||
      item.username ||
      item.name ||
      item.userId ||
      "-",
    action:
      item.action ||
      item.actionType ||
      item.type ||
      item.event ||
      item.operation ||
      "-",
    object:
      item.object ||
      item.objectType ||
      item.entity ||
      item.table ||
      item.description ||
      "-",
    identifier:
      item.objectId ||
      item.entityId ||
      item.idValue ||
      item.deviceId ||
      item.userId ||
      "-",
    ip:
      item.address ||
      item.ip ||
      item.remoteAddress ||
      item.clientIp ||
      item.sourceIp ||
      "-",
    actionDisplay: translateAction(
      item.action ||
        item.actionType ||
        item.type ||
        item.event ||
        item.operation
    ),
    objectDisplay: translateObject(
      item.object ||
        item.objectType ||
        item.entity ||
        item.table ||
        item.description
    ),
  };
};

export function AuditContent({ embedded = false }) {
  const { authHeader } = useAuth();
  const [rows, setRows] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cache:audit");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [range, setRange] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const firstLoadDoneRef = useRef(false);

  const { from, to } = useMemo(() => {
    if (range === "custom" && customFrom && customTo) {
      return { from: new Date(customFrom), to: new Date(customTo) };
    }
    return formatRange(range);
  }, [range, customFrom, customTo]);

  const loadData = async () => {
    const shouldShowLoading = !firstLoadDoneRef.current && rows.length === 0;
    if (shouldShowLoading) setLoading(true);
    setError("");
    try {
      const params = {};
      const fromIso = toIso(from);
      const toIsoVal = toIso(to);
      if (fromIso) params.from = fromIso;
      if (toIsoVal) params.to = toIsoVal;
      const list = await getAuditLogs(params);
      const mapped = (Array.isArray(list) ? list : []).map((item, idx) => mapEntry(item, idx));
      setRows(mapped);
    } catch (error) {
      console.warn("Não foi possível carregar auditoria:", error);
      setError("Não foi possível carregar auditoria.");
    } finally {
      setLoading(false);
      firstLoadDoneRef.current = true;
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customFrom, customTo]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cache:audit", JSON.stringify(rows));
    }
  }, [rows]);

  useEventSocket({
    authHeader,
    onMessage: (msg) => {
      if (!msg) return;
      if (msg.type === "audit" || msg.audit || msg.action || msg.event) {
        setRows((prev) => {
          const entry = msg.audit || msg;
          const mapped = mapEntry(entry);
          const next = [mapped, ...prev];
          return next.slice(0, 200);
        });
      }
    },
  });

  const quickRanges = [
    { key: "today", label: "Hoje" },
    { key: "7d", label: "Últimos 7 dias" },
    { key: "month", label: "Este mês" },
    { key: "custom", label: "Personalizado" },
  ];

  const content = (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          {!embedded && <h1 className="text-2xl font-bold text-slate-100">Auditoria</h1>}
          <p className="text-sm text-slate-400">Registros de auditoria em tempo real.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {quickRanges.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-2 rounded-[10px] border text-sm transition ${
                range === r.key
                  ? "border-sky-500 bg-sky-500/10 text-sky-200 shadow-[0_0_12px_rgba(14,165,233,0.35)]"
                  : "border-slate-800 bg-slate-900 text-slate-200 hover:border-sky-500/60"
              }`}
            >
              {r.label}
            </button>
          ))}
          {range === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <input
                type="datetime-local"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-slate-700 bg-slate-900 rounded-lg px-2 py-1"
              />
              <span className="text-slate-500">até</span>
              <input
                type="datetime-local"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-slate-700 bg-slate-900 rounded-lg px-2 py-1"
              />
            </div>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold text-slate-100">Registros</h2>
          <button
            onClick={loadData}
            className="px-3 py-1.5 h-[40px] rounded-[10px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)] transition text-sm"
          >
            Atualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-200">
            <thead className="bg-slate-800/70 text-slate-300">
              <tr>
                {["Data/Hora", "Conta", "Ação", "Objeto", "Identificador", "IP"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 border-b border-slate-700 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">Nenhum registro no período.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(row.time)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.account || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.actionDisplay || row.action || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.objectDisplay || row.object || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.identifier || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.ip || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-950 text-slate-100">
      {content}
    </div>
  );
}

export default function Audit() {
  return <AuditContent embedded={false} />;
}

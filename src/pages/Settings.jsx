import React, { useEffect, useState } from "react";
import { AuditContent } from "./Audit";
import { fetchLogs } from "../services/logs";

const tabs = [
  { key: "audit", label: "Auditoria" },
  { key: "logs", label: "Logs" },
];

const LogsContent = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await fetchLogs();
      const mapped = (Array.isArray(list) ? list : []).map((item, idx) => ({
        id: item.id || idx,
        identifier: item.identifier || item.deviceId || item.uniqueId || item.id || "-",
        protocol: item.protocol || item.type || "-",
        data: item.data || item.payload || item.message || "-",
      }));
      setRows(mapped);
    } catch (err) {
      setError("Não foi possível carregar logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold text-slate-100">Logs</h2>
          <button
            onClick={load}
            className="px-3 py-1.5 h-[40px] rounded-[10px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)] transition text-sm"
          >
            Atualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-200">
            <thead className="bg-slate-800/70 text-slate-300">
              <tr>
                {["Identificador", "Protocolo", "Data"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 border-b border-slate-700 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    Nenhum log encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="px-4 py-3 whitespace-nowrap">{row.identifier || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.protocol || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.data || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {loading && <div className="px-4 py-3 text-sm text-slate-400">Carregando...</div>}
      </div>
    </div>
  );
};

export default function Settings() {
  const [active, setActive] = useState("audit");

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-950 text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Configurações</h1>
          <p className="text-sm text-slate-400">Ajustes e auditoria do sistema.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-3 py-2 rounded-[10px] border text-sm transition ${
              active === tab.key
                ? "border-sky-500 bg-sky-500/10 text-sky-200 shadow-[0_0_12px_rgba(14,165,233,0.35)]"
                : "border-slate-800 bg-slate-900 text-slate-200 hover:border-sky-500/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "audit" && <AuditContent embedded />}
      {active === "logs" && <LogsContent />}
    </div>
  );
}

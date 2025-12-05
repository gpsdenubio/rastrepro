import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDevice } from "../services/traccar";
import { useAuth } from "../context/AuthContext";

export default function AddDevice() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const canCreate = can("devices.create");
  const [form, setForm] = useState({ name: "", uniqueId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const dispatchToast = (type, message) => {
    try {
      window.dispatchEvent(
        new CustomEvent("local:toast", {
          detail: {
            id: `add-device-${Date.now()}`,
            type,
            message,
          },
        })
      );
    } catch {
      // silencioso
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canCreate) return;
    setSaving(true);
    setError("");
    try {
      await createDevice({ name: form.name, uniqueId: form.uniqueId });
      dispatchToast("success", "Dispositivo criado com sucesso.");
      navigate("/devices");
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        status === 403
          ? "Você não tem permissão para criar dispositivos ou o limite foi atingido."
          : err?.response?.data?.message || err?.message || "Erro ao criar dispositivo.";
      setError(msg);
      dispatchToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="p-4 md:p-6 bg-slate-950 text-slate-100 min-h-screen">
        <h1 className="text-2xl font-bold">Adicionar dispositivo</h1>
        <p className="mt-2 text-red-300 text-sm">Você não tem permissão para criar dispositivos.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-950 text-slate-100 min-h-screen">
      <div className="max-w-xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Adicionar dispositivo</h1>
          <p className="text-sm text-slate-400">Informe os dados mínimos para registrar o dispositivo.</p>
        </div>

        {error && <div className="text-sm text-red-300 bg-red-900/40 border border-red-700 p-2 rounded">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <label className="flex flex-col text-sm">
            Nome
            <input
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
              className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
              placeholder="Ex.: Caminhão 01"
            />
          </label>

          <label className="flex flex-col text-sm">
            Identificador Único (IMEI ou ID)
            <input
              value={form.uniqueId}
              onChange={(e) => handleChange("uniqueId", e.target.value)}
              required
              className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
              placeholder="IMEI/ID do rastreador"
            />
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate("/devices")}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-200 hover:border-sky-500/60"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-sky-500 text-slate-900 font-semibold shadow-[0_0_16px_rgba(14,165,233,0.45)] hover:bg-sky-400 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

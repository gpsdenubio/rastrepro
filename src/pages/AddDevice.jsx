// src/pages/AddDevice.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDevice } from "../services/traccar";
import { useAuth } from "../context/AuthContext";

const categories = [
  { value: "car", label: "Carro" },
  { value: "motorcycle", label: "Moto" },
  { value: "truck", label: "Caminhão" },
  { value: "pickup", label: "Caminhonete" },
  { value: "bus", label: "Ônibus" },
  { value: "boat", label: "Barco" },
  { value: "van", label: "Van" },
  { value: "person", label: "Pessoa" },
  { value: "animal", label: "Animal" },
  { value: "other", label: "Outro" },
];

export default function AddDevice() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const canCreate = can("devices.create");
  const [form, setForm] = useState({
    name: "",
    uniqueId: "",
    model: "",
    category: "car",
    plate: "",
    phone: "",
    odometerKm: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const dispatchToast = (type, message) => {
    try {
      window.dispatchEvent(
        new CustomEvent("local:toast", {
          detail: { id: `add-device-${Date.now()}`, type, message },
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
      const odometerMeters =
        form.odometerKm !== "" && !Number.isNaN(Number(form.odometerKm))
          ? Number(form.odometerKm) * 1000
          : undefined;
      const payload = {
        name: form.name,
        uniqueId: form.uniqueId,
        model: form.model,
        category: form.category,
        phone: form.phone,
        attributes: {
          modelo: form.model || "",
          placa: form.plate || "",
          linha: form.phone || "",
          ...(odometerMeters !== undefined
            ? {
                odometer: odometerMeters,
                odometerBase: odometerMeters,
                totalDistance: odometerMeters,
              }
            : {}),
        },
      };
      await createDevice(payload);
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
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Dispositivo</div>
            <h1 className="text-2xl font-bold text-slate-100">Novo dispositivo</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate("/devices")}
              className="h-10 px-4 rounded-[10px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="h-10 px-4 rounded-[10px] bg-sky-500 text-slate-900 font-semibold hover:bg-sky-400 disabled:opacity-60 shadow-[0_0_16px_rgba(14,165,233,0.45)]"
            >
              {saving ? "Salvando..." : "Criar"}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-300 bg-red-900/40 border border-red-700 p-2 rounded">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="px-6 py-4 overflow-y-auto flex-1 bg-slate-950 rounded-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <section className="rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-100">Informações gerais</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col text-sm">
                    Nome
                    <input
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                      required
                    />
                  </label>
                  <label className="flex flex-col text-sm">
                    IMEI (uniqueId)
                    <input
                      value={form.uniqueId}
                      onChange={(e) => handleChange("uniqueId", e.target.value)}
                      className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                      required
                    />
                  </label>
                  <label className="flex flex-col text-sm">
                    Modelo
                    <input
                      value={form.model}
                      onChange={(e) => handleChange("model", e.target.value)}
                      className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    />
                  </label>
                  <label className="flex flex-col text-sm">
                    Categoria
                    <select
                      value={form.category}
                      onChange={(e) => handleChange("category", e.target.value)}
                      className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    >
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-100">Identificação do veículo</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col text-sm">
                    Placa
                    <input
                      value={form.plate}
                      onChange={(e) => handleChange("plate", e.target.value)}
                      className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    />
                  </label>
                  <label className="flex flex-col text-sm">
                    Linha telefônica
                    <input
                      value={form.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    />
                  </label>
                  <label className="flex flex-col text-sm">
                    Odômetro (km)
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.odometerKm}
                      onChange={(e) => handleChange("odometerKm", e.target.value)}
                      placeholder="Ex.: 12345.6"
                      className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    />
                    <span className="text-[11px] text-slate-400 mt-1">Odômetro real: -</span>
                  </label>
                </div>
              </section>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

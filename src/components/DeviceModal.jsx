import React, { useEffect, useState } from "react";
import { createDevice, updateDevice, updateDeviceAttributes } from "../services/traccar";

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

export default function DeviceModal({ open, onClose, onSaved, device }) {
  const isEdit = Boolean(device?.id);
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

  useEffect(() => {
    if (device) {
      const currentOdo =
        device.totalDistance ??
        device.attributes?.odometerBase ??
        device.attributes?.odometer ??
        device.attributes?.totalDistance;
      const currentOdoKm =
        currentOdo != null && !Number.isNaN(Number(currentOdo))
          ? (Number(currentOdo) / 1000).toFixed(2)
          : "";
      setForm({
        name: device.name || "",
        uniqueId: device.uniqueId || "",
        model: device.attributes?.modelo || device.model || "",
        category: device.category || "car",
        plate: device.attributes?.placa || "",
        phone: device.attributes?.linha || device.phone || "",
        odometerKm: currentOdoKm,
      });
    } else {
      setForm({
        name: "",
        uniqueId: "",
        model: "",
        category: "car",
        plate: "",
        phone: "",
        odometerKm: "",
      });
    }
    setError("");
  }, [device, open]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const odometerMeters =
        form.odometerKm !== "" && !Number.isNaN(Number(form.odometerKm))
          ? Number(form.odometerKm) * 1000
          : undefined;
      const payload = {
        ...form,
        id: device?.id,
        groupId: device?.groupId,
        calendarId: device?.calendarId,
        attributes: {
          ...(device?.attributes || {}),
        },
      };
      if (isEdit) {
        if (odometerMeters !== undefined) {
          const attrs = {
            ...(device?.attributes || {}),
            odometer: odometerMeters,
            odometerBase: odometerMeters,
          };
          await updateDeviceAttributes({
            id: device.id,
            name: device.name,
            uniqueId: device.uniqueId,
            category: device.category,
            attributes: attrs,
          });
        } else {
          await updateDevice(device.id, payload);
        }
      } else {
        await createDevice(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err?.response?.data || err?.message || "Erro ao salvar";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-800 text-slate-100">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Dispositivo</div>
            <h2 className="text-xl font-semibold">
              {isEdit ? "Editar dispositivo" : "Novo dispositivo"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-[10px] border border-slate-700 bg-slate-800 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)] text-slate-100 transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="px-6 pt-4">
            <div className="text-sm text-red-300 bg-red-900/40 border border-red-700 p-2 rounded">
              {error}
            </div>
          </div>
        )}

        <div className="px-6 py-4 overflow-y-auto flex-1 bg-slate-950">
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
                  <span className="text-[11px] text-slate-400 mt-1">
                    Odômetro real: {(() => {
                      const raw =
                        device?.attributes?.odometer ??
                        device?.attributes?.totalDistance ??
                        device?.attributes?.odometerBase;
                      const num = raw != null && !Number.isNaN(Number(raw)) ? Number(raw) / 1000 : null;
                      return num != null ? `${num.toFixed(2)} km` : "-";
                    })()}
                  </span>
                </label>
              </div>
            </section>
          </form>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] h-[46px] border border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            onClick={handleSubmit}
            className="px-4 py-2 rounded-[10px] h-[46px] bg-sky-500 text-slate-900 font-semibold hover:bg-sky-400 disabled:opacity-60 shadow-[0_0_16px_rgba(14,165,233,0.45)]"
          >
            {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}

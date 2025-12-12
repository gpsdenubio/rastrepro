// src/pages/Notifications.jsx
import React, { useEffect, useMemo, useState } from "react";
import { saveNotificationRules, loadNotificationRules, deleteNotificationRule } from "../services/notifications";
import { getDevices } from "../services/traccar";
import { useAuth } from "../context/AuthContext";

const EVENT_OPTIONS = [
  { value: "ignitionOn", label: "Ignição ligada" },
  { value: "ignitionOff", label: "Ignição desligada" },
  { value: "deviceMoving", label: "Movimento" },
  { value: "deviceStopped", label: "Parada" },
  { value: "engineStop", label: "Bloqueio" },
  { value: "engineResume", label: "Desbloqueio" },
  { value: "lowBattery", label: "Bateria baixa" },
  { value: "overspeed", label: "Excesso de velocidade" },
  { value: "alarm", label: "Alarme" },
];

const defaultForm = {
  id: null,
  title: "",
  message: "",
  color: "#38bdf8",
  events: ["ignitionOn", "ignitionOff"],
  showPopup: true,
  playSound: true,
  enabled: true,
  scope: "all", // "all" | "device"
  deviceId: "",
};

export default function Notifications() {
  const { can, user } = useAuth();
  const canView = can("notifications.view");
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    if (!canView) return;
    const load = async () => {
      const data = await loadNotificationRules(user?.id);
      setRules(Array.isArray(data) ? data : []);
    };
    void load();
    const loadDevices = async () => {
      try {
        const list = await getDevices();
        setDevices(Array.isArray(list) ? list : []);
      } catch {
        setDevices([]);
      }
    };
    loadDevices();
  }, [canView, user]);

  const handleOpenNew = () => {
    setForm(defaultForm);
    setModalOpen(true);
  };

  const handleEdit = (rule) => {
    setForm(rule);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Excluir esta notificação?")) return;
    const next = rules.filter((r) => r.id !== id);
    setRules(next);
    await deleteNotificationRule(id);
    const saved = await saveNotificationRules(next, user?.id);
    setRules(Array.isArray(saved) && saved.length ? saved : next);
  };

  const handleToggle = async (id) => {
    const next = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    setRules(next);
    const saved = await saveNotificationRules(next, user?.id);
    setRules(Array.isArray(saved) && saved.length ? saved : next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = form.id || crypto.randomUUID();
    const nextRules = form.id
      ? rules.map((r) => (r.id === form.id ? { ...form, id } : r))
      : [...rules, { ...form, id }];
    setRules(nextRules);
    const saved = await saveNotificationRules(nextRules, user?.id);
    if (Array.isArray(saved) && saved.length) {
      setRules(saved);
    }
    setModalOpen(false);
  };

  const selectedEventsLabel = useMemo(() => {
    const map = EVENT_OPTIONS.reduce((acc, ev) => ({ ...acc, [ev.value]: ev.label }), {});
    return (form.events || []).map((e) => map[e] || e).join(", ") || "Nenhum";
  }, [form.events]);

  const toggleEvent = (value) => {
    setForm((prev) => {
      const exists = prev.events?.includes(value);
      const events = exists ? prev.events.filter((e) => e !== value) : [...(prev.events || []), value];
      return { ...prev, events };
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-950 text-slate-100">
      {!canView ? (
        <>
          <h1 className="text-2xl font-bold">Notificações</h1>
          <p className="text-sm text-red-300 mt-2">Você não tem permissão para acessar notificações.</p>
        </>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Notificações</h1>
              <p className="text-sm text-slate-400">Crie e personalize alertas para eventos.</p>
            </div>
            {can("notifications.create") && (
              <button
                onClick={handleOpenNew}
                className="bg-sky-500 hover:bg-sky-400 text-slate-900 px-4 py-2 h-[46px] rounded-[10px] font-semibold shadow-[0_0_16px_rgba(14,165,233,0.45)] transition"
              >
                + Nova notificação
              </button>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-200">
            <thead className="bg-slate-800/70 text-slate-300">
              <tr>
                <th className="text-left px-4 py-3 border-b border-slate-800">Descrição</th>
                <th className="text-left px-4 py-3 border-b border-slate-800">Tipo</th>
                <th className="text-left px-4 py-3 border-b border-slate-800">Eventos</th>
                <th className="text-left px-4 py-3 border-b border-slate-800">Escopo</th>
                <th className="text-left px-4 py-3 border-b border-slate-800">Ativo</th>
                <th className="text-right px-4 py-3 border-b border-slate-800">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rules.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-400" colSpan={6}>
                    Nenhuma notificação criada.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="px-4 py-3 font-semibold text-slate-100">
                      {rule.title || rule.message || rule.type || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {rule.type || (rule.events || [])[0] || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {(rule.events || []).map((ev) => EVENT_OPTIONS.find((o) => o.value === ev)?.label || ev).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {rule.scope === "device"
                        ? devices.find((d) => String(d.id) === String(rule.deviceId))?.name ||
                          `Dispositivo ${rule.deviceId || "-"}`
                        : "Todos os dispositivos"}
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="form-checkbox accent-sky-500"
                          checked={!!rule.enabled}
                          onChange={() => handleToggle(rule.id)}
                        />
                        <span className="text-slate-200 text-sm">{rule.enabled ? "Ativa" : "Inativa"}</span>
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="px-3 py-1 rounded-[10px] border border-slate-700 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_10px_rgba(14,165,233,0.35)] transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="px-3 py-1 rounded-[10px] border border-red-700 text-red-200 hover:border-red-400 transition"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
          </div>

          {modalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl p-5 text-slate-100">
            <h2 className="text-xl font-semibold mb-3">{form.id ? "Editar notificação" : "Nova notificação"}</h2>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">Título *</span>
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    required
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">Cor</span>
                  <input
                    type="color"
                    name="color"
                    value={form.color}
                    onChange={handleChange}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 h-[42px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">Aplicar para</span>
                  <div className="flex items-center gap-3 text-slate-200">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="scope"
                        value="all"
                        checked={form.scope === "all"}
                        onChange={handleChange}
                        className="form-radio accent-sky-500"
                      />
                      <span>Todos os dispositivos</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="scope"
                        value="device"
                        checked={form.scope === "device"}
                        onChange={handleChange}
                        className="form-radio accent-sky-500"
                      />
                      <span>Somente um dispositivo</span>
                    </label>
                  </div>
                </label>
                {form.scope === "device" && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-300">Selecione o dispositivo</span>
                    <select
                      name="deviceId"
                      value={form.deviceId}
                      onChange={handleChange}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">Selecione...</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name || d.uniqueId || d.id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-300">Texto do alerta (opcional)</span>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Deixe em branco para usar o texto automático do evento (tipo + dispositivo + endereço)"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
                />
              </label>

              <div className="flex flex-col gap-2">
                <span className="text-slate-300 text-sm">Eventos que disparam</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {EVENT_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={form.events?.includes(opt.value)}
                        onChange={() => toggleEvent(opt.value)}
                        className="form-checkbox accent-sky-500"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
                <div className="text-xs text-slate-400">Selecionados: {selectedEventsLabel}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="showPopup"
                    checked={form.showPopup}
                    onChange={handleChange}
                    className="form-checkbox accent-sky-500"
                  />
                  <span>Mostrar popup</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="playSound"
                    checked={form.playSound}
                    onChange={handleChange}
                    className="form-checkbox accent-sky-500"
                  />
                  <span>Tocar som</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="enabled"
                    checked={form.enabled}
                    onChange={handleChange}
                    className="form-checkbox accent-sky-500"
                  />
                  <span>Ativa</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const testRule = { ...form, id: form.id || crypto.randomUUID() };
                    window.dispatchEvent(new CustomEvent("notifications:test", { detail: testRule }));
                  }}
                  className="px-4 py-2 rounded-[10px] border border-sky-500 text-sky-200 hover:border-sky-400 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]"
                >
                  Testar notificação
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-[10px] border border-slate-700 text-slate-200 hover:border-sky-500/60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[10px] bg-sky-500 text-slate-900 font-semibold shadow-[0_0_16px_rgba(14,165,233,0.45)] hover:bg-sky-400"
                >
                  Salvar
                </button>
              </div>
            </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

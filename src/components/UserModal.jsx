import React, { useEffect, useState } from "react";
import { createUser, updateUser } from "../services/traccar";

export default function UserModal({ open, onClose, onSaved, user }) {
  const isEdit = Boolean(user?.id);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    phone2: "",
    admin: false,
    disabled: false,
    password: "",
    cpfCnpj: "",
    address: "",
    notes: "",
    accessLevel: "user",
    permCreate: false,
    permEdit: false,
    permDelete: false,
    permView: true,
    permFinance: false,
    permReports: true,
    permMap: true,
    permSettings: false,
    permExport: false,
    startDate: "",
    expiryDate: "",
    lastAccess: "",
    vehicleLimit: "",
    vehicleCount: "",
    clientLimit: "",
    extraDeviceLimit: "",
    theme: "light",
    language: "pt-BR",
    notifEmail: true,
    notifWhatsapp: false,
    notifApp: true,
    profilePhoto: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        phone2: user.attributes?.phone2 || "",
        admin: Boolean(user.admin || user.administrator),
        disabled: Boolean(user.disabled),
        password: "",
        cpfCnpj: user.attributes?.cpfCnpj || "",
        address: user.attributes?.address || "",
        notes: user.attributes?.notes || "",
        accessLevel: user.attributes?.accessLevel || "user",
        permCreate: Boolean(user.attributes?.permissions?.create),
        permEdit: Boolean(user.attributes?.permissions?.edit),
        permDelete: Boolean(user.attributes?.permissions?.delete),
        permView: user.attributes?.permissions?.view ?? true,
        permFinance: Boolean(user.attributes?.permissions?.finance),
        permReports: user.attributes?.permissions?.reports ?? true,
        permMap: user.attributes?.permissions?.map ?? true,
        permSettings: Boolean(user.attributes?.permissions?.settings),
        permExport: Boolean(user.attributes?.permissions?.export),
        startDate: user.attributes?.startDate || "",
        expiryDate: user.attributes?.expiryDate || "",
        lastAccess: user.attributes?.lastAccess || "",
        vehicleLimit: user.attributes?.vehicleLimit || "",
        vehicleCount: user.attributes?.vehicleCount || "",
        clientLimit: user.attributes?.clientLimit || "",
        extraDeviceLimit: user.attributes?.extraDeviceLimit || "",
        theme: user.attributes?.theme || "light",
        language: user.attributes?.language || "pt-BR",
        notifEmail: Boolean(user.attributes?.notifications?.email ?? true),
        notifWhatsapp: Boolean(user.attributes?.notifications?.whatsapp ?? false),
        notifApp: Boolean(user.attributes?.notifications?.app ?? true),
        profilePhoto: user.attributes?.profilePhoto || "",
      });
    } else {
      setForm({
        name: "",
        email: "",
        phone: "",
        phone2: "",
        admin: false,
        disabled: false,
        password: "",
        cpfCnpj: "",
        address: "",
        notes: "",
        accessLevel: "user",
        permCreate: false,
        permEdit: false,
        permDelete: false,
        permView: true,
        permFinance: false,
        permReports: true,
        permMap: true,
        permSettings: false,
        permExport: false,
        startDate: "",
        expiryDate: "",
        lastAccess: "",
        vehicleLimit: "",
        vehicleCount: "",
        clientLimit: "",
        extraDeviceLimit: "",
        theme: "light",
        language: "pt-BR",
        notifEmail: true,
        notifWhatsapp: false,
        notifApp: true,
        profilePhoto: "",
      });
    }
    setError("");
  }, [user, open]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (isEdit) {
        await updateUser(user.id, payload);
      } else {
        await createUser(payload);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err?.response?.data || err?.message || "Erro ao salvar usuário";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] w-full max-w-5xl max-h-[90vh] flex flex-col border border-slate-800">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-semibold">
              {isEdit ? "Editar usuário" : "Novo usuário"}
            </h2>
            <p className="text-xs text-slate-400">Preencha os dados e permissões do usuário.</p>
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
            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] p-4">
              <h3 className="text-sm font-semibold text-slate-100">Dados básicos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col text-sm">
                  Nome completo
                  <input
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    required
                  />
                </label>
                <label className="flex flex-col text-sm">
                  E-mail
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  />
                </label>
                <label className="flex flex-col text-sm">
                  Telefone / WhatsApp
                  <input
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  />
                </label>
                <label className="flex flex-col text-sm">
                  Telefone extra
                  <input
                    value={form.phone2}
                    onChange={(e) => handleChange("phone2", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  />
                </label>
                <label className="flex flex-col text-sm">
                  Senha {isEdit ? "(opcional)" : "(obrigatória)"}
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    required={!isEdit}
                  />
                </label>
                <label className="flex flex-col text-sm">
                  Foto de perfil (URL ou base64)
                  <input
                    value={form.profilePhoto}
                    onChange={(e) => handleChange("profilePhoto", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    placeholder="https://..."
                  />
                </label>
              </div>
              <div className="flex items-center gap-6 pt-1 flex-wrap">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.admin}
                    onChange={(e) => handleChange("admin", e.target.checked)}
                  />
                  Administrador
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.disabled}
                    onChange={(e) => handleChange("disabled", e.target.checked)}
                  />
                  Usuário inativo
                </label>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] p-4">
              <h3 className="text-sm font-semibold text-slate-100">Documentos / Endereço (opcional)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col text-sm">
                  CPF / CNPJ
                  <input
                    value={form.cpfCnpj}
                    onChange={(e) => handleChange("cpfCnpj", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  />
                </label>
                <label className="flex flex-col text-sm sm:col-span-2">
                  Endereço completo
                  <input
                    value={form.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    placeholder="Rua, número, bairro, cidade, estado, CEP"
                  />
                </label>
                <label className="flex flex-col text-sm sm:col-span-2">
                  Observações internas
                  <textarea
                    value={form.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    rows={2}
                  />
                </label>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] p-4">
              <h3 className="text-sm font-semibold text-slate-100">Controle de acesso</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col text-sm">
                  Nível de acesso
                  <select
                    value={form.accessLevel}
                    onChange={(e) => handleChange("accessLevel", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  >
                    <option value="admin">Administrador</option>
                    <option value="user">Usuário</option>
                    <option value="finance">Financeiro</option>
                    <option value="operator">Operador</option>
                    <option value="view">Visualização</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {[
                  { key: "permCreate", label: "Criar" },
                  { key: "permEdit", label: "Editar" },
                  { key: "permDelete", label: "Excluir" },
                  { key: "permView", label: "Somente visualizar" },
                  { key: "permFinance", label: "Acesso ao financeiro" },
                  { key: "permReports", label: "Acesso a relatórios" },
                  { key: "permMap", label: "Acesso ao mapa/rastreamento" },
                  { key: "permSettings", label: "Acesso às configurações" },
                  { key: "permExport", label: "Exportar dados (PDF/Excel)" },
                ].map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-slate-100">
                    <input
                      type="checkbox"
                      checked={form[p.key]}
                      onChange={(e) => handleChange(p.key, e.target.checked)}
                      className="h-4 w-4 accent-sky-500"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] p-4">
              <h3 className="text-sm font-semibold text-slate-100">Datas de acesso</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex flex-col text-sm">
                  Data de início
                  <input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(e) => handleChange("startDate", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  />
                </label>
                <label className="flex flex-col text-sm">
                  Data de expiração
                  <input
                    type="datetime-local"
                    value={form.expiryDate}
                    onChange={(e) => handleChange("expiryDate", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  />
                </label>
                <label className="flex flex-col text-sm">
                  Último acesso (somente leitura)
                  <input
                    type="text"
                    value={form.lastAccess}
                    readOnly
                    className="mt-1 border border-slate-800 bg-slate-800 text-slate-400 rounded-[10px] px-3 py-2"
                    placeholder="Automático"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] p-4">
              <h3 className="text-sm font-semibold text-slate-100">Limites e recursos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <label className="flex flex-col text-sm">
                  Limite de veículos permitidos
                  <input
                    type="number"
                    value={form.vehicleLimit}
                    onChange={(e) => handleChange("vehicleLimit", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  />
                </label>
                <label className="flex flex-col text-sm">
                  Qtd. de veículos vinculados (somente leitura)
                  <input
                    type="number"
                    value={form.vehicleCount}
                    readOnly
                    className="mt-1 border border-slate-800 bg-slate-800 text-slate-400 rounded-[10px] px-3 py-2"
                  />
                </label>
                <label className="flex flex-col text-sm">
                  Limite de clientes
                  <input
                    type="number"
                    value={form.clientLimit}
                    onChange={(e) => handleChange("clientLimit", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  />
                </label>
                <label className="flex flex-col text-sm">
                  Limite de dispositivos adicionais
                  <input
                    type="number"
                    value={form.extraDeviceLimit}
                    onChange={(e) => handleChange("extraDeviceLimit", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] p-4">
              <h3 className="text-sm font-semibold text-slate-100">Preferências do usuário</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex flex-col text-sm">
                  Tema
                  <select
                    value={form.theme}
                    onChange={(e) => handleChange("theme", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  >
                    <option value="light">Claro</option>
                    <option value="dark">Escuro</option>
                  </select>
                </label>
                <label className="flex flex-col text-sm">
                  Idioma
                  <select
                    value={form.language}
                    onChange={(e) => handleChange("language", e.target.value)}
                    className="mt-1 border border-slate-700 bg-slate-800 text-slate-100 rounded-[10px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  >
                    <option value="pt-BR">Português</option>
                    <option value="en">Inglês</option>
                    <option value="es">Espanhol</option>
                  </select>
                </label>
                <div className="flex flex-col text-sm text-slate-100">
                  Notificações
                  <div className="mt-1 grid grid-cols-1 gap-1">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.notifEmail}
                        onChange={(e) => handleChange("notifEmail", e.target.checked)}
                        className="h-4 w-4 accent-sky-500"
                      />
                      Email
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.notifWhatsapp}
                        onChange={(e) => handleChange("notifWhatsapp", e.target.checked)}
                        className="h-4 w-4 accent-sky-500"
                      />
                      WhatsApp
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.notifApp}
                        onChange={(e) => handleChange("notifApp", e.target.checked)}
                        className="h-4 w-4 accent-sky-500"
                      />
                      App
                    </label>
                  </div>
                </div>
              </div>
            </section>
          </form>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 disabled:opacity-60"
          >
            {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}

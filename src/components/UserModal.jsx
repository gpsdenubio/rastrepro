import React, { useEffect, useState } from "react";
import { createUser, updateUser } from "../services/traccar";

export default function UserModal({ open, onClose, onSaved, user }) {
  const isEdit = Boolean(user?.id);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    admin: false,
    disabled: false,
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        admin: Boolean(user.admin),
        disabled: Boolean(user.disabled),
        password: "",
      });
    } else {
      setForm({
        name: "",
        email: "",
        phone: "",
        admin: false,
        disabled: false,
        password: "",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-slate-800">
            {isEdit ? "Editar usuário" : "Novo usuário"}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            ✕
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-100 p-2 rounded mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col text-sm">
              Nome
              <input
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="mt-1 border rounded-lg px-3 py-2"
                required
              />
            </label>
            <label className="flex flex-col text-sm">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="mt-1 border rounded-lg px-3 py-2"
              />
            </label>
            <label className="flex flex-col text-sm">
              Telefone
              <input
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="mt-1 border rounded-lg px-3 py-2"
              />
            </label>
            <label className="flex flex-col text-sm">
              Senha {isEdit ? "(opcional)" : "(obrigatória)"}
              <input
                type="password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                className="mt-1 border rounded-lg px-3 py-2"
                required={!isEdit}
              />
            </label>
          </div>

          <div className="flex items-center gap-6 pt-2">
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

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 disabled:opacity-60"
            >
              {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      const rawMessage = err?.message || "Erro ao conectar";
      const message =
        rawMessage === "Credenciais inválidas" || rawMessage === "Unauthorized"
          ? "Usuário ou senha incorretos"
          : rawMessage;
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-700 to-blue-500 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/90 backdrop-blur shadow-2xl rounded-2xl p-8 border border-white/40">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-sky-800">RastrePro</h1>
            <p className="text-sm text-slate-500">Acesse com seu usuário e senha do Traccar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-100 p-2 rounded">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-slate-500">Usuário</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin, operador1 ou email@dominio.com"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-sky-300"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-sky-300"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white py-2 rounded-lg transition font-semibold"
            >
              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center text-xs text-white/80">
          Autenticação Basic Auth — Traccar
        </div>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl shadow-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="p-8 lg:p-12 bg-white/5">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center text-white font-black text-xl shadow-lg">
                R
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">rastrePro</p>
                <h1 className="text-2xl font-bold text-white leading-tight">Painel de Rastreamento</h1>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-slate-200 text-lg font-semibold">Login seguro</p>
                <p className="text-slate-400 text-sm">Acesse com suas credenciais para gerenciar frotas e usuários.</p>
              </div>
              <div className="flex gap-3 text-slate-300 text-sm">
                <div className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="font-semibold text-white">Mapa em tempo real</p>
                  <p className="text-slate-400 text-xs mt-1">Visualize posições e rotas rapidamente.</p>
                </div>
                <div className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="font-semibold text-white">Gestão de usuários</p>
                  <p className="text-slate-400 text-xs mt-1">Controle permissões e dispositivos.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 lg:p-12 bg-white">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Entrar</h2>
            <p className="text-sm text-slate-500 mb-6">Use seu usuário e senha cadastrados.</p>

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
                  placeholder="seu usuário ou email"
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
                className="w-full bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-700 hover:to-cyan-600 disabled:opacity-60 text-white py-3 rounded-xl transition font-semibold shadow-lg"
              >
                {submitting ? "Entrando..." : "Acessar painel"}
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}

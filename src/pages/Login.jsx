import React, { useState } from "react";
import axios from "axios";
import qs from "qs";
import { TRACCAR_BASE_URL } from "../config";

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await axios.post(
        `${TRACCAR_BASE_URL}/session`,
        qs.stringify({ email, password }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          withCredentials: true,
        }
      );

      setLoading(false);
      onSuccess(); // Login OK
    } catch (err) {
      setLoading(false);
      const msg =
        err.response?.data ||
        err.response?.statusText ||
        err.message ||
        "Erro ao conectar";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-sky-400 p-4">
      <div className="w-full max-w-md mx-4">
        <div className="bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-blue-600 text-white text-3xl">
                🚗
              </div>
              <div>
                <h1 className="text-2xl font-bold text-sky-700">RastrePro</h1>
                <p className="text-sm text-slate-500">Portal de Rastreamento</p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4">

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </div>
              )}

              <div>
                <label className="text-xs text-slate-500">Usuário</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="text"
                  placeholder="seu@exemplo.com"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-sky-300"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-500">Senha</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-sky-300"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white py-2 rounded-lg transition"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <div className="mt-4 text-center text-xs text-slate-400">
              Painel oficial — RastrePro
            </div>
          </div>

          <div className="bg-sky-50 px-6 py-3 text-center text-xs text-slate-500">
            Se tiver problema de CORS, o servidor precisa aceitar HTTPS ou usar proxy.
          </div>
        </div>
      </div>
    </div>
  );
}


import React from "react";
import { AuditContent } from "./Audit";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { can } = useAuth();

  if (!can("settings.view")) {
    return (
      <div className="p-4 md:p-6 space-y-4 bg-slate-950 text-slate-100">
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-red-300 mt-2">Você não tem permissão para acessar configurações.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-950 text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Configurações</h1>
          <p className="text-sm text-slate-400">Ajustes e auditoria do sistema.</p>
        </div>
      </div>

      <AuditContent embedded />
    </div>
  );
}

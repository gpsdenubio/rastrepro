// src/config.js

// URL direta do Traccar. Ajuste se necessário.
export const TRACCAR_BASE_URL = "http://104.237.2.185:8082/api";

// API de logs (backend simples opcional)
export const LOG_API_URL = import.meta.env.VITE_LOG_API_URL || "http://localhost:4100";

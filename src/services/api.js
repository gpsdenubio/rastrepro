// src/services/api.js

import axios from "axios";
import { TRACCAR_BASE_URL } from "../config";

const api = axios.create({
  baseURL: TRACCAR_BASE_URL,
});

// Aplica o Authorization salvo ou define um novo header padrão
export function setAuthHeader(authHeader) {
  if (authHeader) {
    api.defaults.headers.common.Authorization = authHeader;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// Inclui Authorization automaticamente se existir no localStorage
api.interceptors.request.use((config) => {
  const stored = typeof window !== "undefined" ? localStorage.getItem("authHeader") : null;
  const header = config.headers?.Authorization || stored;
  if (!config.headers) config.headers = {};
  if (header) {
    config.headers.Authorization = header;
  }
  return config;
});

export default api;

// Busca lista de dispositivos do Traccar
export async function getDevices() {
  try {
    const response = await api.get("/devices");
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dispositivos:", error);
    throw error;
  }
}

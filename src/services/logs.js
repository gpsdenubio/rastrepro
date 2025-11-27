import axios from "axios";
import { LOG_API_URL } from "../config";

const client = axios.create({
  baseURL: LOG_API_URL,
  timeout: 7000,
});

export async function recordLog(entry) {
  try {
    await client.post("/logs", entry);
  } catch (err) {
    console.warn("Não foi possível gravar log remoto:", err?.message);
  }
}

export async function fetchLogs() {
  try {
    const res = await client.get("/logs");
    return res.data;
  } catch (err) {
    console.warn("Não foi possível buscar logs remotos:", err?.message);
    return [];
  }
}

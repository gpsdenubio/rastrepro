import express from "express";
import cors from "cors";
import morgan from "morgan";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 4100;
const LOG_FILE = process.env.LOG_FILE || path.join(process.cwd(), "logs.json");

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const readLogs = () => {
  try {
    const data = fs.readFileSync(LOG_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const writeLogs = (logs) => {
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), "utf8");
};

app.get("/logs", (_req, res) => {
  const logs = readLogs();
  res.json(logs.slice(-500).reverse());
});

app.post("/logs", (req, res) => {
  const { action, username, detail } = req.body || {};
  if (!action) return res.status(400).json({ error: "action requerido" });
  const logs = readLogs();
  logs.push({
    action,
    username: username || "desconhecido",
    detail: detail || "",
    ip: req.ip,
    time: new Date().toISOString(),
  });
  writeLogs(logs.slice(-1000));
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Log server running on http://localhost:${PORT}`);
  console.log(`Armazenando logs em ${LOG_FILE}`);
});

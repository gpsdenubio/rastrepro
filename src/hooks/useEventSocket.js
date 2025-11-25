import { useEffect, useRef } from "react";
import { TRACCAR_BASE_URL } from "../config";

function buildWsUrl(authHeader) {
  const base = new URL(TRACCAR_BASE_URL);
  const protocol = base.protocol === "https:" ? "wss:" : "ws:";
  const path = base.pathname.endsWith("/") ? `${base.pathname}socket` : `${base.pathname}/socket`;
  const url = `${protocol}//${base.host}${path}`;
  // Pass auth via query (melhor esforço, já que headers não são suportados no browser)
  const qs = authHeader ? `?authorization=${encodeURIComponent(authHeader)}` : "";
  return `${url}${qs}`;
}

export function useEventSocket({ onMessage, authHeader }) {
  const wsRef = useRef(null);
  const retryRef = useRef(null);

  useEffect(() => {
    if (!authHeader) return undefined;

    const connect = () => {
      const url = buildWsUrl(authHeader);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        if (!evt?.data) return;
        try {
          const parsed = JSON.parse(evt.data);
          onMessage?.(parsed);
        } catch (err) {
          console.warn("Mensagem WS inválida", err);
        }
      };

      ws.onclose = () => {
        retryRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [authHeader, onMessage]);
}

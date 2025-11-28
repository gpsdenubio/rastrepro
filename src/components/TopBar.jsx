// src/components/TopBar.jsx
import React, { useEffect, useState } from "react";
import { Menu, LogOut, Bell, BellOff, Moon, Sun, ChevronDown, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function TopBar({ onToggleSidebar, title = "RastrePro" }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("theme") === "dark";
  });
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("alertsMuted") === "true";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const messages = [
    "Seja bem-vindo!",
    "Plataforma moderna, rápida e feita para quem exige resultado.",
    "Automação inteligente para facilitar o controle da sua empresa.",
  ];
  const [msgIndex, setMsgIndex] = useState(0);
  const marqueeText = messages[msgIndex];
  const marqueeRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const [durationMs, setDurationMs] = useState(6000); // default
  const [offsets, setOffsets] = useState({ start: "100%", end: "-200%" });
  const SPEED_PX_PER_SEC = 80; // velocidade constante
  const PAUSE_MS = 1000;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const body = document.body;
    if (dark) {
      root.classList.add("dark");
      body.classList.add("bg-slate-900");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      body.classList.remove("bg-slate-900");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  // Recalcula duração baseada no tamanho do texto e do container para manter velocidade constante
  useEffect(() => {
    const measure = () => {
      const textEl = marqueeRef.current;
      const contEl = containerRef.current;
      if (!textEl || !contEl) return;
      const textWidth = textEl.getBoundingClientRect().width || 0;
      const contWidth = contEl.getBoundingClientRect().width || 0;
      const totalDistance = textWidth + contWidth; // entra pela direita e sai pela esquerda
      const ms = (totalDistance / SPEED_PX_PER_SEC) * 1000;
      setOffsets({
        start: `${contWidth}px`,
        end: `-${textWidth + 20}px`,
      });
      setDurationMs(ms);
      return ms;
    };
    const ms = measure();
    const timer = setTimeout(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, (ms || durationMs) + PAUSE_MS);
    return () => clearTimeout(timer);
  }, [msgIndex, messages.length]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("alertsMuted", String(next));
      window.dispatchEvent(new CustomEvent("alerts:mute", { detail: next }));
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest("#topbar-user-menu")) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="w-full h-16 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex items-center px-4 shadow-[0_6px_20px_rgba(0,0,0,0.35)] text-slate-100">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="h-11 w-11 flex items-center justify-center rounded-[10px] bg-slate-800/70 border border-slate-700 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)] transition"
        >
          <Menu size={22} className="text-slate-100" />
        </button>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-amber-400 text-slate-900 flex items-center justify-center font-bold shadow-[0_0_12px_rgba(251,191,36,0.45)]">
            RP
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">RastrePro</div>
            <div className="text-[11px] text-slate-400">Plataforma de Rastreamento</div>
          </div>
        </div>
      </div>

      <div className="flex-1 hidden sm:flex justify-center px-4 pointer-events-none">
        <div className="led-banner max-w-4xl w-full" ref={containerRef}>
          <div className="led-banner-inner">
            <span
              key={msgIndex}
              ref={marqueeRef}
              className="led-marquee"
              style={{
                "--led-duration": `${durationMs}ms`,
                "--led-start": offsets.start,
                "--led-end": offsets.end,
              }}
            >
              {marqueeText}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          className="h-11 px-3 rounded-[10px] bg-slate-800/70 border border-slate-700 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)] transition flex items-center gap-1"
          onClick={toggleMute}
          title={muted ? "Alertas silenciados" : "Alertas com som"}
        >
          {muted ? (
            <BellOff size={18} className="text-slate-100" />
          ) : (
            <Bell size={18} className="text-slate-100" />
          )}
        </button>
        <button
          className="h-11 w-11 rounded-[10px] bg-slate-800/70 border border-slate-700 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)] transition flex items-center gap-1"
          onClick={() => setDark((v) => !v)}
        >
          {dark ? <Sun size={18} className="text-amber-300" /> : <Moon size={18} className="text-slate-100" />}
        </button>
        <div id="topbar-user-menu" className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 h-11 px-3 rounded-[10px] border border-slate-700 bg-slate-800/70 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)] transition"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-500 to-amber-400 text-slate-900 flex items-center justify-center font-bold">
              <User size={18} />
            </div>
            <div className="hidden sm:block text-left text-slate-100">
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-[11px] text-slate-400">Dados / Senha / Sair</div>
            </div>
            <ChevronDown size={16} className="text-slate-400 hidden sm:block" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-700 bg-slate-900 shadow-lg z-50">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/users");
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-100 hover:bg-slate-800/70"
              >
                Meus dados
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/users");
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-100 hover:bg-slate-800/70"
              >
                Trocar senha
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-800/70 flex items-center gap-2"
              >
                <LogOut size={14} />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

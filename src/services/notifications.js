// src/services/notifications.js
import {
  getNotifications as traccarGetNotifications,
  createNotification as traccarCreateNotification,
  updateNotification as traccarUpdateNotification,
  deleteNotification as traccarDeleteNotification,
  assignNotificationToUser,
} from "./traccar";

const STORAGE_KEY = "customNotificationRules";

export const defaultRules = [];

export function loadNotificationRulesLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultRules;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultRules;
    return parsed;
  } catch {
    return defaultRules;
  }
}

export function saveNotificationRulesLocal(rules) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    window.dispatchEvent(new CustomEvent("notifications:rules-updated", { detail: rules }));
  } catch {
    // silencioso
  }
}

export async function loadNotificationRules() {
  try {
    const list = await traccarGetNotifications();
    const parsed = (list || []).map((n) => {
      const attrs = n.attributes || {};
      const frontendRule = attrs.frontendRule || {};
      return {
        id: n.id,
        title: frontendRule.title || n.text || n.type || "Notificação",
        message: frontendRule.message || n.text || "",
        color: frontendRule.color || "#38bdf8",
        events: frontendRule.events || [],
        showPopup: frontendRule.showPopup ?? true,
        playSound: frontendRule.playSound ?? true,
        enabled: frontendRule.enabled ?? true,
        scope: frontendRule.scope || "all",
        deviceId: frontendRule.deviceId || "",
        attributes: attrs,
      };
    });
    return parsed;
  } catch (err) {
    console.warn("Falha ao carregar notificações do Traccar, usando local:", err?.message);
    return loadNotificationRulesLocal();
  }
}

export async function saveNotificationRules(rules, userId) {
  try {
    const saved = [];
    // salva/atualiza individualmente
    for (const rule of rules) {
      let savedRule;
      if (rule.id) {
        savedRule = await traccarUpdateNotification(rule.id, rule);
      } else {
        savedRule = await traccarCreateNotification(rule);
      }
      saved.push(savedRule);
      if (userId && savedRule?.id) {
        await assignNotificationToUser(userId, savedRule.id).catch(() => {});
      }
    }
    // remove órfãos: local storage serve de backup
    saveNotificationRulesLocal(saved);
    return saved;
  } catch (err) {
    console.warn("Falha ao salvar no Traccar, persistindo local:", err?.message);
    saveNotificationRulesLocal(rules);
    return rules;
  }
}

export async function deleteNotificationRule(id) {
  try {
    await traccarDeleteNotification(id);
  } catch (err) {
    console.warn("Não foi possível excluir no Traccar:", err?.message);
  }
}

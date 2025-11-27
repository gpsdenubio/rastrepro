import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getUsers,
  getDevices,
  getPermissions,
} from "../services/traccar";
import UserModal from "../components/UserModal";
import DeleteUserModal from "../components/DeleteUserModal";
import UserDevicesModal from "../components/UserDevicesModal";
import { fetchLogs } from "../services/logs";

const buildPermissionsMap = (list) => {
  return (list || []).reduce((acc, perm) => {
    if (perm?.userId === undefined || perm?.userId === null) return acc;
    const uId = Number(perm.userId);
    const dId = perm.deviceId !== undefined && perm.deviceId !== null ? Number(perm.deviceId) : null;
    if (!acc[uId]) acc[uId] = new Set();
    if (dId !== null) {
      acc[uId].add(dId);
    }
    return acc;
  }, {});
};

const hasIntersection = (a, b) => {
  if (!a || !b) return false;
  for (const item of a) {
    if (b.has(item)) return true;
  }
  return false;
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const isAdmin = Boolean(currentUser?.admin || currentUser?.administrator);

  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [permissionsByUser, setPermissionsByUser] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [devicesModalOpen, setDevicesModalOpen] = useState(false);
  const [sessionLogs, setSessionLogs] = useState([]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [userList, deviceList, permissionList] = await Promise.all([
        getUsers(),
        getDevices(),
        getPermissions({ all: true }), // admin vê tudo; não filtra tipo
      ]);
      setUsers(Array.isArray(userList) ? userList : []);
      setDevices(Array.isArray(deviceList) ? deviceList : []);
      const permsMap = buildPermissionsMap(Array.isArray(permissionList) ? permissionList : []);

      // Garante entradas vazias para todos os usuários
      (Array.isArray(userList) ? userList : []).forEach((u) => {
        const uid = Number(u.id);
        if (!permsMap[uid]) permsMap[uid] = new Set();
      });
      // Garante entrada para o usuário logado
      if (currentUser?.id && !permsMap[currentUser.id]) {
        permsMap[currentUser.id] = new Set();
      }
      setPermissionsByUser(permsMap);
    } catch (err) {
      setError("Erro ao carregar dados de usuários.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  useEffect(() => {
    // admins visualizam logs remotos
    if (!isAdmin) return;
    let active = true;
    let interval;

    const loadLogs = async () => {
      try {
        const list = await fetchLogs();
        if (active) {
          setSessionLogs(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        if (active) {
          setError("Não foi possível carregar logs remotos (verifique LOG_API_URL e servidor de logs).");
        }
      }
    };

    loadLogs();
    interval = setInterval(loadLogs, 5000);

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [isAdmin, modalOpen, deleteOpen, devicesModalOpen]);

  const filteredUsers = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return users;

    const currentDevices = permissionsByUser[currentUser.id] || new Set();
    return users.filter(
      (u) =>
        u.id === currentUser.id ||
        hasIntersection(currentDevices, permissionsByUser[u.id] || new Set())
    );
  }, [users, isAdmin, permissionsByUser, currentUser]);

  const currentUserDevices = permissionsByUser[currentUser?.id] || new Set();

  const canManageUser = (targetUser) => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    const targetSet = permissionsByUser[targetUser.id] || new Set();
    // usuário pode gerenciar quem compartilha device ou a si mesmo
    if (targetUser.id === currentUser.id) return true;
    if (hasIntersection(currentUserDevices, targetSet)) return true;
    // se o alvo não tem devices ainda, permitir atribuir se o atual tiver algum
    if (targetSet.size === 0 && currentUserDevices.size > 0) return true;
    return false;
  };

  const handleNew = () => {
    setSelectedUser(null);
    setModalOpen(true);
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setModalOpen(true);
  };

  const handleDelete = (user) => {
    setSelectedUser(user);
    setDeleteOpen(true);
  };

  const handleDevices = (user) => {
    setSelectedUser(user);
    // Assegura que há entrada em permissionsByUser para o alvo
    setPermissionsByUser((prev) => {
      if (prev[user.id]) return prev;
      return { ...prev, [user.id]: new Set() };
    });
    setDevicesModalOpen(true);
  };

  const totalDevicesFor = (userId) =>
    permissionsByUser[userId] ? Array.from(permissionsByUser[userId]).length : 0;

  const devicesForUser = (userId) => {
    const ids = permissionsByUser[userId] || new Set();
    return devices.filter((d) => ids.has(Number(d.id)));
  };

  return (
    <div className="p-4 space-y-4 bg-slate-950 min-h-screen text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Usuários</h1>
          <p className="text-sm text-slate-400">Gerencie usuários, permissões e veículos vinculados.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Dispositivos carregados: {devices.length}</span>
          {isAdmin && (
            <button
              onClick={handleNew}
              className="bg-sky-500 hover:bg-sky-400 text-slate-900 px-4 py-2 h-[46px] rounded-[10px] font-semibold shadow-[0_0_16px_rgba(14,165,233,0.45)] transition"
            >
              + Novo usuário
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="text-xs text-slate-400">Usuários</div>
          <div className="text-xl font-semibold text-slate-100">{users.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="text-xs text-slate-400">Dispositivos</div>
          <div className="text-xl font-semibold text-slate-100">{devices.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="text-xs text-slate-400">Total vínculos</div>
          <div className="text-xl font-semibold text-slate-100">
            {Object.values(permissionsByUser).reduce((sum, set) => sum + (set?.size || 0), 0)}
          </div>
        </div>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      <div className="bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Telefone</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Total de dispositivos</th>
                <th className="py-3 px-4">Lista</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
                <th className="py-3 px-4 text-right">Dispositivos</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-4 px-4" colSpan={9}>
                    Carregando...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td className="py-4 px-4" colSpan={9}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const totalDevices = totalDevicesFor(u.id);
                  const isUserAdmin = Boolean(u.admin || u.administrator);
                  const accessLevel = u.attributes?.accessLevel || (isUserAdmin ? "admin" : "user");
                  return (
                    <tr key={u.id} className="border-b border-slate-800 last:border-0">
                      <td className="py-3 px-4 font-semibold text-slate-100 flex items-center gap-2">
                        <div className="h-9 w-9 rounded-full bg-slate-800 text-slate-200 grid place-items-center">
                          {u.attributes?.profilePhoto ? (
                            <img
                              src={u.attributes.profilePhoto}
                              alt={u.name || "avatar"}
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            (u.name || "?").slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <span>{u.name || "-"}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-200">{u.email || "-"}</td>
                      <td className="py-3 px-4 text-slate-200">{u.phone || "-"}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                          {accessLevel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-200">{totalDevices}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {devicesForUser(u.id).map((dev) => (
                            <span
                              key={dev.id}
                              className="px-2 py-1 rounded-full bg-slate-800 text-slate-200 text-xs border border-slate-700"
                            >
                              {dev.name || dev.uniqueId || dev.id}
                            </span>
                          ))}
                          {devicesForUser(u.id).length === 0 && (
                            <span className="text-xs text-slate-500">Nenhum</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            u.disabled
                              ? "bg-red-900/60 text-red-200 border border-red-700"
                              : "bg-emerald-900/60 text-emerald-200 border border-emerald-700"
                          }`}
                        >
                          {u.disabled ? "Inativo" : "Ativo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {canManageUser(u) ? (
                          <>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleEdit(u)}
                                  className="px-3 py-1 rounded-[10px] border border-slate-700 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_10px_rgba(14,165,233,0.35)] transition"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDelete(u)}
                                  className="px-3 py-1 rounded-[10px] border border-red-700 text-red-200 hover:border-red-400 transition"
                                >
                                  Excluir
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDevices(u)}
                              className="px-3 py-1 rounded-[10px] border border-slate-700 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_10px_rgba(14,165,233,0.35)] transition"
                            >
                              Distribuir
                            </button>
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">
                            Sem permissão
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManageUser(u) ? (
                          <button
                            onClick={() => handleDevices(u)}
                            className="px-3 py-1 rounded-[10px] border border-slate-700 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_10px_rgba(14,165,233,0.35)] transition"
                          >
                            Distribuir dispositivos
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">
                            Sem permissão
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] rounded-2xl border border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">Logs de sessões</h3>
            <button
              onClick={() => {
                localStorage.removeItem("sessionLogs");
                setSessionLogs([]);
              }}
              className="text-xs text-slate-400 hover:text-sky-300"
            >
              Limpar
            </button>
          </div>
          {sessionLogs.length === 0 ? (
            <div className="text-xs text-slate-500">Sem registros.</div>
          ) : (
            <div className="max-h-48 overflow-auto space-y-1 text-xs text-slate-300">
              {sessionLogs.map((log, idx) => (
                <div key={idx} className="flex items-start justify-between border-b border-slate-800 py-1">
                  <div>
                    <div className="font-semibold capitalize text-slate-100">{log.action || "-"}</div>
                    <div className="text-slate-400">{log.username || "-"}</div>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {log.time ? new Date(log.time).toLocaleString() : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
        user={selectedUser}
      />

      <DeleteUserModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={loadData}
        user={selectedUser}
      />

      <UserDevicesModal
        open={devicesModalOpen}
        onClose={() => setDevicesModalOpen(false)}
        onSaved={loadData}
        user={selectedUser}
        devices={devices}
        allowedDevices={isAdmin ? devices : devices.filter((d) => currentUserDevices.has(d.id))}
        assigned={selectedUser ? permissionsByUser[selectedUser.id] : new Set()}
        onSavedSelection={(userId, selectedSet) => {
          // atualiza permissões locais para refletir imediatamente na UI
          setPermissionsByUser((prev) => ({
            ...prev,
            [userId]: new Set(Array.from(selectedSet).map((v) => Number(v))),
          }));
        }}
      />
    </div>
  );
}

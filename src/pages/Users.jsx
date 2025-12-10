import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getUsers,
  getDevices,
  getPermissions,
} from "../services/traccar";
import UserModal from "../components/UserModal";
import DeleteUserModal from "../components/DeleteUserModal";
import UserDevicesModal from "../components/UserDevicesModal";

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

const LOCAL_LINKS_KEY = "userDeviceLinks";

const loadLocalLinks = () => {
  try {
    const raw = localStorage.getItem(LOCAL_LINKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return Object.keys(parsed || {}).reduce((acc, key) => {
      const set = new Set(Array.isArray(parsed[key]) ? parsed[key].map((v) => Number(v)) : []);
      acc[Number(key)] = set;
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const saveLocalLinks = (map) => {
  try {
    const plain = {};
    Object.keys(map || {}).forEach((key) => {
      const set = map[key];
      plain[key] = Array.isArray(set) ? set : Array.from(set || []);
    });
    localStorage.setItem(LOCAL_LINKS_KEY, JSON.stringify(plain));
  } catch {
    // ignora persistência
  }
};

export default function Users() {
  const { user: currentUser, can, role } = useAuth();
  const canView = can("users.view");
  const isAdmin = role === "admin";
  // Exibe o botão de criação sempre
  const canCreateUser = true;
  const [users, setUsers] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cache:users");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [devices, setDevices] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cache:devices");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [permissionsByUser, setPermissionsByUser] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [devicesModalOpen, setDevicesModalOpen] = useState(false);
  const firstLoadDoneRef = useRef(false);

  const loadData = useCallback(async () => {
    const shouldShowLoading =
      !firstLoadDoneRef.current && users.length === 0 && devices.length === 0;
    if (shouldShowLoading) setLoading(true);
    setError("");
    try {
      const [userList, deviceList, permissionListRaw] = await Promise.all([
        getUsers(),
        getDevices(),
        getPermissions({ all: true }), // admin vê tudo; não filtra tipo
      ]);
      const extraPermissions = await getPermissions({ all: true, type: "userDevice" }).catch(() => []);
      let permissionList = [
        ...(Array.isArray(permissionListRaw) ? permissionListRaw : []),
        ...(Array.isArray(extraPermissions) ? extraPermissions : []),
      ];
      if (permissionList.length === 0 && Array.isArray(userList)) {
        const perUser = await Promise.all(
          userList.map((u) => getPermissions({ all: true, userId: u.id }).catch(() => []))
        );
        permissionList = perUser.flat();
      }
      setUsers(Array.isArray(userList) ? userList : []);
      setDevices(Array.isArray(deviceList) ? deviceList : []);
      const permsMap = buildPermissionsMap(permissionList);

      // Garante entradas vazias para todos os usuários
      (Array.isArray(userList) ? userList : []).forEach((u) => {
        const uid = Number(u.id);
        if (!permsMap[uid]) permsMap[uid] = new Set();
      });
      // mescla vínculos locais (persistência no front)
      const localLinks = loadLocalLinks();
      Object.keys(localLinks).forEach((k) => {
        const uid = Number(k);
        if (!permsMap[uid]) permsMap[uid] = new Set();
        localLinks[uid].forEach((devId) => permsMap[uid].add(devId));
      });
      // Garante entrada para o usuário logado
      if (currentUser?.id && !permsMap[currentUser.id]) {
        permsMap[currentUser.id] = new Set();
      }
      setPermissionsByUser(permsMap);
      saveLocalLinks(permsMap);
    } catch (error) {
      console.warn("Erro ao carregar dados de usuários:", error);
      setError("Erro ao carregar dados de usuários.");
    } finally {
      setLoading(false);
      firstLoadDoneRef.current = true;
    }
  }, [currentUser, users.length, devices.length]);

  useEffect(() => {
    if (!currentUser || !canView) return;
    void loadData();
  }, [currentUser, loadData, canView]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cache:users", JSON.stringify(users));
    }
  }, [users]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cache:devices", JSON.stringify(devices));
    }
  }, [devices]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const plain = {};
      Object.keys(permissionsByUser || {}).forEach((key) => {
        plain[key] = Array.from(permissionsByUser[key] || []);
      });
      localStorage.setItem("cache:user-permissions", JSON.stringify(plain));
    }
  }, [permissionsByUser]);

  const filteredUsers = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin || can("users.view")) return users;

    const currentDevices = permissionsByUser[currentUser.id] || new Set();
    return users.filter(
      (u) =>
        u.id === currentUser.id ||
        hasIntersection(currentDevices, permissionsByUser[u.id] || new Set())
    );
  }, [users, isAdmin, permissionsByUser, currentUser, can]);

  const currentUserDevices = permissionsByUser[currentUser?.id] || new Set();

  const canManageUser = (targetUser) => {
    if (!currentUser) return false;
    if (isAdmin || can("users.manage") || can("users.edit")) return true;
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
    if (!canManageUser(user)) return;
    setSelectedUser(user);
    // garante entrada local para o usuário
    setPermissionsByUser((prev) => {
      if (prev[user.id]) return prev;
      return { ...prev, [user.id]: new Set() };
    });
    setDevicesModalOpen(true);
  };

  return (
    <div className="p-4 space-y-4 bg-slate-950 text-slate-100">
      {!canView ? (
        <>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-red-300 mt-2">Você não tem permissão para visualizar usuários.</p>
        </>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Usuários</h1>
              <p className="text-sm text-slate-400">Gerencie usuários, permissões e veículos vinculados.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Dispositivos carregados: {devices.length}</span>
              {canCreateUser && (
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
        <div className="overflow-auto max-h-[70vh]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Telefone</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td className="py-4 px-4" colSpan={6}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isUserAdmin = Boolean(u.admin || u.administrator);
                  const accessLevel = isUserAdmin ? "admin" : "user";
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
                        <button
                          onClick={() => handleDevices(u)}
                          className="px-3 py-1 rounded-[10px] border border-slate-700 text-slate-100 hover:border-sky-500/60 hover:shadow-[0_0_10px_rgba(14,165,233,0.35)] transition"
                        >
                          Vincular dispositivos
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
          </div>

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
            setPermissionsByUser((prev) => {
              const updated = {
                ...prev,
                [userId]: new Set(Array.from(selectedSet).map((v) => Number(v))),
              };
              saveLocalLinks(updated);
              return updated;
            });
          }}
        />
        </>
      )}
    </div>
  );
}

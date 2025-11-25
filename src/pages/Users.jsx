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

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const permParams = isAdmin
        ? { all: true } // admin enxerga todos os vínculos
        : { userId: currentUser?.id, type: "userDevice" }; // não-admin vê apenas os seus
      const [userList, deviceList, permissionList] = await Promise.all([
        getUsers(),
        getDevices(),
        getPermissions(permParams),
      ]);
      setUsers(Array.isArray(userList) ? userList : []);
      setDevices(Array.isArray(deviceList) ? deviceList : []);
      // devices são buscados para manter contagem atualizada e cumprir integração
      const permsMap = buildPermissionsMap(
        Array.isArray(permissionList) ? permissionList : []
      );
      // Garante que o usuário logado tenha entrada mesmo sem permissão explícita
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
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Usuários</h1>
        {isAdmin && (
          <button
            onClick={handleNew}
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-semibold"
          >
            + Novo usuário
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500">
        Dispositivos carregados: {devices.length}
      </p>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="bg-white shadow rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Telefone</th>
                <th className="py-3 px-4">Administrador</th>
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
                  <td className="py-4 px-4" colSpan={7}>
                    Carregando...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td className="py-4 px-4" colSpan={7}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const totalDevices = totalDevicesFor(u.id);
                  const isUserAdmin = Boolean(u.admin || u.administrator);
                  return (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {u.name || "-"}
                      </td>
                      <td className="py-3 px-4">{u.email || "-"}</td>
                      <td className="py-3 px-4">{u.phone || "-"}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            isUserAdmin
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {isUserAdmin ? "Sim" : "Não"}
                        </span>
                      </td>
                      <td className="py-3 px-4">{totalDevices}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {devicesForUser(u.id).map((dev) => (
                            <span
                              key={dev.id}
                              className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs"
                            >
                              {dev.name || dev.uniqueId || dev.id}
                            </span>
                          ))}
                          {devicesForUser(u.id).length === 0 && (
                            <span className="text-xs text-slate-400">Nenhum</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            u.disabled
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
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
                                  className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDelete(u)}
                                  className="px-3 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                                >
                                  Excluir
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDevices(u)}
                              className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
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
                            className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
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

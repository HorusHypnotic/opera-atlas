import { useAuth } from "@/hooks/useAuth";

/**
 * Hook centralizado para verificar permissões de UI por role.
 * Alinha com as policies RLS do banco:
 * - admin: CRUD completo + delete
 * - gestor: insert + update + select
 * - operacional: insert + select
 * - visualizador: select only
 */
export function usePermissions() {
  const { roles, isAdmin, isGestor, isGuest, isSuperAdmin } = useAuth();

  const canInsert = isGuest || isAdmin || isGestor || roles.includes("operacional");
  const canUpdate = isGuest || isAdmin || isGestor;
  const canDelete = isGuest || isAdmin;
  const canManageRoles = isAdmin || isSuperAdmin;
  const canManageObras = isAdmin || isGestor;
  const isViewOnly = !canInsert;

  return {
    canInsert,
    canUpdate,
    canDelete,
    canManageRoles,
    canManageObras,
    isViewOnly,
  };
}

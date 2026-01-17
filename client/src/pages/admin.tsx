import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Shield,
  Settings,
  ArrowUpDown,
  Building2,
  Star,
} from "lucide-react";
import type { Role, Committee } from "@shared/schema";

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    name: "",
    displayName: "",
    description: "",
    sortOrder: 0,
  });

  const { data: roles, isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const { data: committees, isLoading: committeesLoading } = useQuery<Committee[]>({
    queryKey: ["/api/admin/committees"],
    enabled: user?.isSuperAdmin,
  });

  const updateCommitteeMutation = useMutation({
    mutationFn: ({ id, isGeneral, usesShifts, isRestricted }: { id: string; isGeneral?: boolean; usesShifts?: boolean; isRestricted?: boolean }) =>
      apiRequest("PATCH", `/api/admin/committees/${id}`, { isGeneral, usesShifts, isRestricted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/committees"] });
      toast({ title: "Comité actualizado", description: "Los cambios se han guardado." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "No se pudo actualizar el comité.", 
        variant: "destructive" 
      });
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/roles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setIsRoleDialogOpen(false);
      resetRoleForm();
      toast({ title: "Rol creado", description: "El rol se ha creado correctamente." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear el rol.", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/roles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setIsRoleDialogOpen(false);
      setEditingRole(null);
      resetRoleForm();
      toast({ title: "Rol actualizado", description: "Los cambios se han guardado." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el rol.", variant: "destructive" });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({ title: "Rol eliminado", description: "El rol se ha eliminado correctamente." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar el rol.", variant: "destructive" });
    },
  });

  const resetRoleForm = () => {
    setRoleFormData({
      name: "",
      displayName: "",
      description: "",
      sortOrder: 0,
    });
  };

  const handleOpenRoleDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setRoleFormData({
        name: role.name,
        displayName: role.displayName,
        description: role.description || "",
        sortOrder: role.sortOrder,
      });
    } else {
      setEditingRole(null);
      resetRoleForm();
    }
    setIsRoleDialogOpen(true);
  };

  const handleRoleSubmit = () => {
    if (!roleFormData.name.trim() || !roleFormData.displayName.trim()) {
      toast({ title: "Error", description: "El nombre y nombre para mostrar son obligatorios.", variant: "destructive" });
      return;
    }

    const payload = {
      name: roleFormData.name.toLowerCase().replace(/\s+/g, "_"),
      displayName: roleFormData.displayName,
      description: roleFormData.description || null,
      sortOrder: roleFormData.sortOrder,
    };

    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, data: payload });
    } else {
      createRoleMutation.mutate(payload);
    }
  };

  if (!user?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
            <p className="text-muted-foreground">
              Esta sección es solo para administradores del sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-admin-title">
          Administración del Sistema
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestiona roles, comités y configuración global
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <div>
                <CardTitle>Roles del Sistema</CardTitle>
                <CardDescription>Define los roles disponibles para los miembros</CardDescription>
              </div>
            </div>
            <Button onClick={() => handleOpenRoleDialog()} className="touch-manipulation" data-testid="button-add-role">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Rol
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rolesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : roles && roles.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden sm:table-cell">Descripción</TableHead>
                    <TableHead className="w-[80px]">Orden</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.sort((a, b) => a.sortOrder - b.sortOrder).map((role) => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{role.displayName}</span>
                          <span className="text-xs text-muted-foreground ml-2">({role.name})</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {role.description || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{role.sortOrder}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenRoleDialog(role)}
                            className="h-8 w-8"
                            data-testid={`button-edit-role-${role.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteRoleMutation.mutate(role.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            data-testid={`button-delete-role-${role.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay roles definidos</p>
              <p className="text-sm text-muted-foreground">
                Crea roles para asignar a los miembros de los comités
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <div>
              <CardTitle>Comités del Sistema</CardTitle>
              <CardDescription>
                Marca un comité como "General" para permitir que sus consejeros agreguen colaboradores
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {committeesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : committees && committees.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden sm:table-cell">Código</TableHead>
                    <TableHead className="w-[100px]">General</TableHead>
                    <TableHead className="w-[100px]">Turnos</TableHead>
                    <TableHead className="w-[100px]">Restringido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {committees.map((committee) => (
                    <TableRow key={committee.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{committee.name}</span>
                          {committee.isGeneral && (
                            <Badge className="bg-amber-500 text-white">
                              <Star className="h-3 w-3 mr-1" />
                              General
                            </Badge>
                          )}
                          {!committee.usesShifts && (
                            <Badge variant="outline">
                              Solo Actividades
                            </Badge>
                          )}
                          {committee.isRestricted && (
                            <Badge variant="destructive">
                              Restringido
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {committee.code || "-"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={committee.isGeneral}
                          onCheckedChange={(checked) =>
                            updateCommitteeMutation.mutate({ id: committee.id, isGeneral: checked })
                          }
                          disabled={updateCommitteeMutation.isPending}
                          data-testid={`switch-general-${committee.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={committee.usesShifts !== false}
                          onCheckedChange={(checked) =>
                            updateCommitteeMutation.mutate({ id: committee.id, usesShifts: checked })
                          }
                          disabled={updateCommitteeMutation.isPending}
                          data-testid={`switch-shifts-${committee.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={committee.isRestricted === true}
                          onCheckedChange={(checked) =>
                            updateCommitteeMutation.mutate({ id: committee.id, isRestricted: checked })
                          }
                          disabled={updateCommitteeMutation.isPending}
                          data-testid={`switch-restricted-${committee.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay comités registrados</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? "Editar Rol" : "Nuevo Rol"}
            </DialogTitle>
            <DialogDescription>
              {editingRole
                ? "Modifica los datos del rol"
                : "Define un nuevo rol para los miembros"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Nombre para mostrar *</Label>
              <Input
                id="displayName"
                value={roleFormData.displayName}
                onChange={(e) => setRoleFormData({ ...roleFormData, displayName: e.target.value })}
                placeholder="Ej: Presidente, Secretario, Consejero"
                data-testid="input-role-display-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Identificador interno *</Label>
              <Input
                id="name"
                value={roleFormData.name}
                onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                placeholder="Ej: presidente, secretario"
                data-testid="input-role-name"
              />
              <p className="text-xs text-muted-foreground">
                Usado internamente. Se convertirá a minúsculas sin espacios.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={roleFormData.description}
                onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                placeholder="Descripción del rol y sus responsabilidades"
                rows={3}
                data-testid="input-role-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortOrder">Orden de visualización</Label>
              <Input
                id="sortOrder"
                type="number"
                value={roleFormData.sortOrder}
                onChange={(e) => setRoleFormData({ ...roleFormData, sortOrder: parseInt(e.target.value) || 0 })}
                placeholder="0"
                data-testid="input-role-sort-order"
              />
              <p className="text-xs text-muted-foreground">
                Los roles con menor número aparecerán primero.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)} data-testid="button-cancel-role">
              Cancelar
            </Button>
            <Button
              onClick={handleRoleSubmit}
              disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
              data-testid="button-save-role"
            >
              {createRoleMutation.isPending || updateRoleMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

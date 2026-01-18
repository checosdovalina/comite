import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  Users,
  Search,
  Mail,
  Building2,
  UserCog,
  Filter,
  Shield,
} from "lucide-react";
import type { CommitteeMember, Committee, Role } from "@shared/schema";
import type { User } from "@shared/models/auth";

interface MemberWithDetails extends CommitteeMember {
  user?: User;
  committee?: Committee;
  role?: Role;
}

export default function MembersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin === true;

  const { data: members, isLoading: membersLoading } = useQuery<MemberWithDetails[]>({
    queryKey: ["/api/all-members"],
  });

  const { data: committees } = useQuery<Committee[]>({
    queryKey: ["/api/committees"],
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const updateAdminMutation = useMutation({
    mutationFn: async ({ memberId, isAdmin }: { memberId: string; isAdmin: boolean }) => {
      const response = await apiRequest("PATCH", `/api/committee-members/${memberId}`, { isAdmin });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-members"] });
      toast({
        title: "Admin actualizado",
        description: "El estado de administrador se ha actualizado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, roleId }: { memberId: string; roleId: string | null }) => {
      const response = await apiRequest("PATCH", `/api/committee-members/${memberId}`, { roleId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-members"] });
      toast({
        title: "Rol actualizado",
        description: "El rol se ha actualizado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el rol",
        variant: "destructive",
      });
    },
  });

  const updateLeadershipRoleMutation = useMutation({
    mutationFn: async ({ memberId, leadershipRole }: { memberId: string; leadershipRole: string }) => {
      const response = await apiRequest("PATCH", `/api/committee-members/${memberId}`, { leadershipRole });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-members"] });
      toast({
        title: "Rol de liderazgo actualizado",
        description: "El rol de liderazgo se ha actualizado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el rol de liderazgo",
        variant: "destructive",
      });
    },
  });

  const leadershipRoleOptions = [
    { value: "none", label: "Sin liderazgo" },
    { value: "counselor", label: "Consejero" },
    { value: "counselor_president", label: "Consejero Presidente" },
    { value: "counselor_secretary", label: "Consejero Secretario" },
    { value: "secretary", label: "Secretario" },
  ];

  const getRoleDisplayName = (member: MemberWithDetails) => {
    if (member.role) {
      return member.role.displayName;
    }
    return "Sin rol";
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const filteredMembers = members?.filter((member) => {
    const matchesSearch =
      member.user?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.user?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesRole = true;
    if (roleFilter === "admin") {
      matchesRole = member.isAdmin === true;
    } else if (roleFilter !== "all") {
      matchesRole = member.roleId === roleFilter;
    }
    
    const matchesCommittee =
      committeeFilter === "all" || member.committeeId === committeeFilter;

    return matchesSearch && matchesRole && matchesCommittee;
  });

  const totalMembers = members?.length || 0;
  const adminCount = members?.filter((m) => m.isAdmin === true).length || 0;
  const activeCount = members?.filter((m) => m.isActive).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Administrar Miembros
        </h1>
        <p className="text-muted-foreground">
          Gestiona los miembros y roles de todos los comités
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Miembros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-total">
                {totalMembers}
              </div>
            )}
            <p className="text-xs text-muted-foreground">en todos los comités</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-admins">
                {adminCount}
              </div>
            )}
            <p className="text-xs text-muted-foreground">con permisos de admin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-active">
                {activeCount}
              </div>
            )}
            <p className="text-xs text-muted-foreground">miembros activos</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todos los Miembros</CardTitle>
          <CardDescription>
            Lista de miembros de todos los comités
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-members"
              />
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-role-filter">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filtrar por rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="admin">Administradores</SelectItem>
                  {roles?.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-committee-filter">
                  <Building2 className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filtrar por comité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los comités</SelectItem>
                  {committees?.map((committee) => (
                    <SelectItem key={committee.id} value={committee.id}>
                      {committee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredMembers && filteredMembers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Miembro</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Comité</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Liderazgo</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.user?.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.user?.firstName, member.user?.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {member.user?.firstName} {member.user?.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="text-sm">{member.user?.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {member.committee?.name || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={member.isAdmin}
                          onCheckedChange={(checked) =>
                            updateAdminMutation.mutate({ memberId: member.id, isAdmin: checked })
                          }
                          data-testid={`switch-admin-${member.id}`}
                        />
                        {member.isAdmin && (
                          <Shield className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isSuperAdmin ? (
                        <Select
                          value={member.leadershipRole || "none"}
                          onValueChange={(value) =>
                            updateLeadershipRoleMutation.mutate({ 
                              memberId: member.id, 
                              leadershipRole: value 
                            })
                          }
                        >
                          <SelectTrigger className="w-40" data-testid={`select-leadership-${member.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {leadershipRoleOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">
                          {leadershipRoleOptions.find(o => o.value === member.leadershipRole)?.label || "Sin liderazgo"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isSuperAdmin ? (
                        <Select
                          value={member.roleId || "none"}
                          onValueChange={(value) =>
                            updateRoleMutation.mutate({ 
                              memberId: member.id, 
                              roleId: value === "none" ? null : value 
                            })
                          }
                        >
                          <SelectTrigger className="w-32" data-testid={`select-role-${member.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin rol</SelectItem>
                            {roles?.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">
                          {getRoleDisplayName(member)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery || roleFilter !== "all" || committeeFilter !== "all"
                  ? "No se encontraron miembros con esos filtros"
                  : "No hay miembros registrados aún"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Plus, UserMinus, Mail, Settings, Calendar, Edit2, Link2, X } from "lucide-react";
import type { CounselorTeam, CounselorTeamMember, Committee } from "@shared/schema";
import type { User } from "@shared/models/auth";
import { Link } from "wouter";

// Spanish labels for leadership roles
const leadershipRoleLabels: Record<string, string> = {
  counselor_president: "Consejero Presidente",
  counselor_secretary: "Consejero Secretario",
  counselor: "Consejero",
  secretary: "Secretario",
  auxiliary: "Auxiliar",
  none: "Miembro",
};

type TeamWithDetails = CounselorTeam & {
  committee?: Committee;
  owner?: User;
  memberCount?: number;
};

type TeamMemberWithUser = CounselorTeamMember & {
  user?: User;
};

export default function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ teamId: string; userId: string; name: string } | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamDescription, setEditTeamDescription] = useState("");

  const { data: myTeams, isLoading: teamsLoading } = useQuery<TeamWithDetails[]>({
    queryKey: ["/api/my-teams"],
  });

  const { data: memberships } = useQuery<any[]>({
    queryKey: ["/api/my-memberships"],
  });

  const { data: teamMembers, isLoading: membersLoading } = useQuery<TeamMemberWithUser[]>({
    queryKey: ["/api/teams", selectedTeamId, "members"],
    queryFn: async () => {
      if (!selectedTeamId) return [];
      const response = await fetch(`/api/teams/${selectedTeamId}/members`);
      if (!response.ok) throw new Error("Failed to fetch team members");
      return response.json();
    },
    enabled: !!selectedTeamId,
  });

  const createTeamMutation = useMutation({
    mutationFn: async ({ committeeId, name, description }: { committeeId: string; name: string; description: string }) => {
      const response = await apiRequest("POST", `/api/committees/${committeeId}/teams`, { name, description });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-teams"] });
      setIsCreateDialogOpen(false);
      setTeamName("");
      setTeamDescription("");
      toast({
        title: "Equipo creado",
        description: "Tu equipo ha sido creado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el equipo",
        variant: "destructive",
      });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ teamId, name, description }: { teamId: string; name: string; description: string }) => {
      const response = await apiRequest("PATCH", `/api/teams/${teamId}`, { name, description });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-teams"] });
      setIsEditDialogOpen(false);
      toast({
        title: "Equipo actualizado",
        description: "Los datos del equipo han sido actualizados",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el equipo",
        variant: "destructive",
      });
    },
  });

  // Fetch pending invites for selected team (only for team owners)
  const { data: teamInvites } = useQuery<any[]>({
    queryKey: ["/api/teams", selectedTeamId, "invites"],
    queryFn: async () => {
      if (!selectedTeamId) return [];
      const response = await fetch(`/api/teams/${selectedTeamId}/invites`);
      if (!response.ok) {
        if (response.status === 403) return [];
        throw new Error("Failed to fetch invites");
      }
      return response.json();
    },
    enabled: !!selectedTeamId && !!myTeams?.find(t => t.id === selectedTeamId && t.ownerUserId === user?.id),
  });

  const pendingInvites = teamInvites?.filter(i => i.status === "pending") || [];

  const addMemberMutation = useMutation({
    mutationFn: async ({ teamId, email }: { teamId: string; email: string }) => {
      const response = await apiRequest("POST", `/api/teams/${teamId}/invites`, { email });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "invites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-teams"] });
      setIsAddMemberDialogOpen(false);
      setNewMemberEmail("");
      
      if (data.type === "member_added") {
        toast({
          title: "Miembro agregado",
          description: "El usuario ya estaba registrado y fue agregado al equipo",
        });
      } else if (data.type === "invite_created") {
        // Copy registration URL to clipboard
        const registrationUrl = `${window.location.origin}${data.registrationUrl}`;
        navigator.clipboard.writeText(registrationUrl).then(() => {
          toast({
            title: "Invitación creada",
            description: "El enlace de registro ha sido copiado. Compártelo con el nuevo auxiliar.",
          });
        }).catch(() => {
          toast({
            title: "Invitación creada",
            description: `Comparte este enlace: ${registrationUrl}`,
          });
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo agregar el miembro",
        variant: "destructive",
      });
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async ({ teamId, inviteId }: { teamId: string; inviteId: string }) => {
      const response = await apiRequest("DELETE", `/api/teams/${teamId}/invites/${inviteId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "invites"] });
      toast({
        title: "Invitación cancelada",
        description: "La invitación ha sido cancelada",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cancelar la invitación",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const response = await apiRequest("DELETE", `/api/teams/${teamId}/members/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-teams"] });
      setMemberToRemove(null);
      toast({
        title: "Miembro eliminado",
        description: "El auxiliar ha sido removido del equipo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el miembro",
        variant: "destructive",
      });
    },
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  // Roles that can create and manage teams with auxiliares
  const rolesWithTeams = ["counselor_president", "counselor_secretary", "counselor", "secretary"];
  const counselorMemberships = memberships?.filter(m => rolesWithTeams.includes(m.leadershipRole)) || [];
  const ownedTeams = myTeams?.filter(t => t.ownerUserId === user?.id) || [];
  const memberTeams = myTeams?.filter(t => t.ownerUserId !== user?.id) || [];

  const selectedTeam = myTeams?.find(t => t.id === selectedTeamId);
  const isOwner = selectedTeam?.ownerUserId === user?.id;

  if (teamsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mi Equipo</h1>
          <p className="text-muted-foreground">
            Administra tu equipo de auxiliares de consejería
          </p>
        </div>
        {counselorMemberships.length > 0 && ownedTeams.length === 0 && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-team">
                <Plus className="h-4 w-4 mr-2" />
                Crear Equipo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear nuevo equipo</DialogTitle>
                <DialogDescription>
                  Crea un equipo para administrar a tus auxiliares de consejería
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Nombre del equipo</Label>
                  <Input
                    id="team-name"
                    placeholder="Ej: Equipo de Consejería"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    data-testid="input-team-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-description">Descripción (opcional)</Label>
                  <Textarea
                    id="team-description"
                    placeholder="Describe el propósito de tu equipo"
                    value={teamDescription}
                    onChange={(e) => setTeamDescription(e.target.value)}
                    data-testid="input-team-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  data-testid="button-cancel-create-team"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (counselorMemberships[0]?.committeeId) {
                      createTeamMutation.mutate({
                        committeeId: counselorMemberships[0].committeeId,
                        name: teamName || "Mi Equipo",
                        description: teamDescription,
                      });
                    }
                  }}
                  disabled={createTeamMutation.isPending}
                  data-testid="button-confirm-create-team"
                >
                  Crear Equipo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {myTeams && myTeams.length === 0 && counselorMemberships.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No tienes acceso a equipos</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Los equipos están disponibles para Consejeros Presidentes, Consejeros, 
              Consejeros Secretarios y Secretarios. Si tienes alguno de estos roles,
              podrás crear tu equipo y agregar a tus auxiliares.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Mis Equipos</h2>
            
            {ownedTeams.length > 0 ? (
              ownedTeams.map((team) => (
                <Card
                  key={team.id}
                  className={`cursor-pointer transition-colors ${
                    selectedTeamId === team.id ? "border-primary" : "hover-elevate"
                  }`}
                  onClick={() => setSelectedTeamId(team.id)}
                  data-testid={`team-card-${team.id}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{team.name}</CardTitle>
                      <Badge variant="secondary">Propietario</Badge>
                    </div>
                    {team.description && (
                      <CardDescription>{team.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {team.memberCount || 0} auxiliares
                      </div>
                      {team.committee && (
                        <Badge variant="outline">{team.committee.name}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : counselorMemberships.length > 0 ? (
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-muted-foreground mb-4">
                    Aún no has creado tu equipo
                  </p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Equipo
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {memberTeams.length > 0 && (
              <>
                <h3 className="text-md font-medium mt-6">Equipos donde soy auxiliar</h3>
                {memberTeams.map((team) => (
                  <Card
                    key={team.id}
                    className={`cursor-pointer transition-colors ${
                      selectedTeamId === team.id ? "border-primary" : "hover-elevate"
                    }`}
                    onClick={() => setSelectedTeamId(team.id)}
                    data-testid={`team-member-card-${team.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{team.name}</CardTitle>
                        <Badge>Auxiliar</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Consejero: {team.owner?.firstName || team.owner?.email}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>

          <div className="space-y-4">
            {selectedTeamId && selectedTeam ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Miembros de {selectedTeam.name}
                  </h2>
                  {isOwner && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditTeamName(selectedTeam.name);
                          setEditTeamDescription(selectedTeam.description || "");
                          setIsEditDialogOpen(true);
                        }}
                        data-testid="button-edit-team"
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" data-testid="button-add-member">
                            <Plus className="h-4 w-4 mr-1" />
                            Agregar auxiliar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Agregar auxiliar</DialogTitle>
                            <DialogDescription>
                              Ingresa el correo electrónico del usuario que deseas agregar como auxiliar
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="member-email">Correo electrónico</Label>
                              <div className="flex gap-2">
                                <Mail className="h-4 w-4 mt-3 text-muted-foreground" />
                                <Input
                                  id="member-email"
                                  type="email"
                                  placeholder="auxiliar@ejemplo.com"
                                  value={newMemberEmail}
                                  onChange={(e) => setNewMemberEmail(e.target.value)}
                                  data-testid="input-member-email"
                                />
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setIsAddMemberDialogOpen(false)}
                              data-testid="button-cancel-add-member"
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={() => {
                                if (selectedTeamId && newMemberEmail) {
                                  addMemberMutation.mutate({
                                    teamId: selectedTeamId,
                                    email: newMemberEmail,
                                  });
                                }
                              }}
                              disabled={addMemberMutation.isPending || !newMemberEmail}
                              data-testid="button-confirm-add-member"
                            >
                              Agregar
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Link href={`/calendar?team=${selectedTeamId}`}>
                        <Button variant="outline" size="sm" data-testid="button-team-calendar">
                          <Calendar className="h-4 w-4 mr-1" />
                          Calendario
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>

                {membersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : teamMembers && teamMembers.length > 0 ? (
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <Card key={member.id} data-testid={`team-member-${member.id}`}>
                        <CardContent className="flex items-center justify-between py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                {getInitials(member.user?.firstName, member.user?.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {member.user?.firstName} {member.user?.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {member.user?.email}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Auxiliar</Badge>
                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setMemberToRemove({
                                    teamId: selectedTeamId!,
                                    userId: member.userId,
                                    name: member.user?.firstName || member.user?.email || "este miembro",
                                  });
                                }}
                                data-testid={`button-remove-member-${member.id}`}
                              >
                                <UserMinus className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        {isOwner
                          ? "Aún no has agregado auxiliares a tu equipo"
                          : "Este equipo no tiene auxiliares"}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {isOwner && pendingInvites.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">
                      Invitaciones pendientes ({pendingInvites.length})
                    </h4>
                    <div className="space-y-2">
                      {pendingInvites.map((invite: any) => (
                        <Card key={invite.id} className="border-dashed" data-testid={`pending-invite-${invite.id}`}>
                          <CardContent className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="text-muted-foreground">
                                  ?
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-muted-foreground">
                                  {invite.email}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Expira: {new Date(invite.expiresAt).toLocaleDateString("es-MX")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Pendiente</Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const registrationUrl = `${window.location.origin}/register?invite=${invite.token}`;
                                  navigator.clipboard.writeText(registrationUrl).then(() => {
                                    toast({
                                      title: "Enlace copiado",
                                      description: "El enlace de registro ha sido copiado al portapapeles",
                                    });
                                  });
                                }}
                                title="Copiar enlace de invitación"
                                data-testid={`button-copy-invite-${invite.id}`}
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  cancelInviteMutation.mutate({
                                    teamId: selectedTeamId!,
                                    inviteId: invite.id,
                                  });
                                }}
                                disabled={cancelInviteMutation.isPending}
                                data-testid={`button-cancel-invite-${invite.id}`}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Settings className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    Selecciona un equipo para ver sus miembros
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar equipo</DialogTitle>
            <DialogDescription>
              Actualiza la información de tu equipo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Nombre del equipo</Label>
              <Input
                id="edit-team-name"
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
                data-testid="input-edit-team-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-description">Descripción</Label>
              <Textarea
                id="edit-team-description"
                value={editTeamDescription}
                onChange={(e) => setEditTeamDescription(e.target.value)}
                data-testid="input-edit-team-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedTeamId) {
                  updateTeamMutation.mutate({
                    teamId: selectedTeamId,
                    name: editTeamName,
                    description: editTeamDescription,
                  });
                }
              }}
              disabled={updateTeamMutation.isPending}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {memberToRemove?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará al auxiliar de tu equipo. El usuario seguirá existiendo en el sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove-member">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (memberToRemove) {
                  removeMemberMutation.mutate({
                    teamId: memberToRemove.teamId,
                    userId: memberToRemove.userId,
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-remove-member"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

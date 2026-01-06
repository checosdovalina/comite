import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Building2,
  Users,
  Calendar,
  Clock,
  Settings,
  ArrowLeft,
  UserPlus,
  Mail,
} from "lucide-react";
import type { Committee, CommitteeMember } from "@shared/schema";
import type { User } from "@shared/models/auth";

interface MemberWithUser extends CommitteeMember {
  user?: User;
}

export default function CommitteeDetailPage() {
  const [, params] = useRoute("/committees/:id");
  const committeeId = params?.id;
  const { toast } = useToast();

  const { data: committee, isLoading: committeeLoading } = useQuery<Committee>({
    queryKey: ["/api/committees", committeeId],
    enabled: !!committeeId,
  });

  const { data: members, isLoading: membersLoading } = useQuery<MemberWithUser[]>({
    queryKey: ["/api/committees", committeeId, "members"],
    enabled: !!committeeId,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const response = await apiRequest("PATCH", `/api/committee-members/${memberId}`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/committees", committeeId, "members"] });
      toast({
        title: "Rol actualizado",
        description: "El rol del miembro se ha actualizado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el rol",
        variant: "destructive",
      });
    },
  });

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    president: "Presidente",
    secretary: "Secretario",
    counselor: "Consejero",
    member: "Miembro",
  };

  const roleBadgeVariants: Record<string, "default" | "secondary" | "outline"> = {
    admin: "default",
    president: "default",
    secretary: "secondary",
    counselor: "secondary",
    member: "outline",
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const isLoading = committeeLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!committee) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Building2 className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Comité no encontrado</h3>
          <Link href="/committees">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Comités
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/committees">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-committee-name">
              {committee.name}
            </h1>
            <p className="text-muted-foreground">{committee.code}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/calendar?committee=${committeeId}`}>
            <Button variant="outline" data-testid="button-view-calendar">
              <Calendar className="mr-2 h-4 w-4" />
              Ver Calendario
            </Button>
          </Link>
          <Link href={`/committees/${committeeId}/settings`}>
            <Button variant="outline" data-testid="button-settings">
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </Button>
          </Link>
        </div>
      </div>

      {committee.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{committee.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Miembros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-members-count">
              {members?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">miembros activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horario Mañana</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {committee.morningStart} - {committee.morningEnd}
            </div>
            <p className="text-xs text-muted-foreground">turno matutino</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horario Tarde</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {committee.afternoonStart} - {committee.afternoonEnd}
            </div>
            <p className="text-xs text-muted-foreground">turno vespertino</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" data-testid="tab-members">
            <Users className="mr-2 h-4 w-4" />
            Miembros
          </TabsTrigger>
          <TabsTrigger value="schedule" data-testid="tab-schedule">
            <Clock className="mr-2 h-4 w-4" />
            Horarios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Miembros del Comité</CardTitle>
                <CardDescription>
                  Gestiona los roles y permisos de los miembros
                </CardDescription>
              </div>
              <Button data-testid="button-add-member">
                <UserPlus className="mr-2 h-4 w-4" />
                Agregar Miembro
              </Button>
            </CardHeader>
            <CardContent>
              {members && members.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Miembro</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
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
                          <Select
                            value={member.role}
                            onValueChange={(value) =>
                              updateRoleMutation.mutate({ memberId: member.id, role: value })
                            }
                          >
                            <SelectTrigger className="w-36" data-testid={`select-role-${member.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="president">Presidente</SelectItem>
                              <SelectItem value="secretary">Secretario</SelectItem>
                              <SelectItem value="counselor">Consejero</SelectItem>
                              <SelectItem value="member">Miembro</SelectItem>
                            </SelectContent>
                          </Select>
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
                    No hay miembros en este comité aún
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Horarios</CardTitle>
              <CardDescription>
                Horarios y días hábiles del comité
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium">Turno Matutino</h4>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {committee.morningStart} - {committee.morningEnd}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Turno Vespertino</h4>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {committee.afternoonStart} - {committee.afternoonEnd}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Días Laborables</h4>
                <div className="flex flex-wrap gap-2">
                  {(committee.workingDays || []).map((day) => (
                    <Badge key={day} variant="outline">
                      {day === "monday" && "Lunes"}
                      {day === "tuesday" && "Martes"}
                      {day === "wednesday" && "Miércoles"}
                      {day === "thursday" && "Jueves"}
                      {day === "friday" && "Viernes"}
                      {day === "saturday" && "Sábado"}
                      {day === "sunday" && "Domingo"}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Capacidad por Turno</h4>
                <p className="text-muted-foreground">
                  Máximo {committee.maxPerShift} personas por turno
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

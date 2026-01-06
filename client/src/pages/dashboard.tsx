import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Building2, 
  Calendar, 
  Users, 
  ClipboardCheck,
  ArrowRight,
  Clock,
  CalendarDays,
  TrendingUp
} from "lucide-react";
import type { Committee, CommitteeMember, AttendanceSlot } from "@shared/schema";

interface DashboardStats {
  totalCommittees: number;
  totalMembers: number;
  upcomingSlots: number;
  myAttendances: number;
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: committees, isLoading: committeesLoading } = useQuery<Committee[]>({
    queryKey: ["/api/committees"],
  });

  const { data: myMemberships, isLoading: membershipsLoading } = useQuery<CommitteeMember[]>({
    queryKey: ["/api/my-memberships"],
  });

  const { data: upcomingSlots, isLoading: slotsLoading } = useQuery<(AttendanceSlot & { committeeName: string })[]>({
    queryKey: ["/api/upcoming-slots"],
  });

  const isLoading = committeesLoading || membershipsLoading || slotsLoading;

  const stats: DashboardStats = {
    totalCommittees: committees?.length || 0,
    totalMembers: myMemberships?.length || 0,
    upcomingSlots: upcomingSlots?.length || 0,
    myAttendances: 0,
  };

  const shiftLabels: Record<string, string> = {
    morning: "Mañana",
    afternoon: "Tarde",
    full_day: "Día completo",
  };

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    president: "Presidente",
    secretary: "Secretario",
    counselor: "Consejero",
    member: "Miembro",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl" data-testid="text-welcome">
          Bienvenido, {user?.firstName || "Usuario"}
        </h1>
        <p className="text-muted-foreground">
          Gestiona tus comités, calendarios y asistencias desde aquí.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mis Comités</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-committees">
                {stats.totalCommittees}
              </div>
            )}
            <p className="text-xs text-muted-foreground">comités activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membresías</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-memberships">
                {stats.totalMembers}
              </div>
            )}
            <p className="text-xs text-muted-foreground">roles asignados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Turnos Próximos</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-upcoming">
                {stats.upcomingSlots}
              </div>
            )}
            <p className="text-xs text-muted-foreground">disponibles esta semana</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Asistencias</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-attendances">
                {stats.myAttendances}
              </div>
            )}
            <p className="text-xs text-muted-foreground">este mes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Mis Comités</CardTitle>
              <CardDescription>Comités donde participas activamente</CardDescription>
            </div>
            <Link href="/committees">
              <Button variant="ghost" size="sm" data-testid="link-all-committees">
                Ver todos <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : committees && committees.length > 0 ? (
              <div className="space-y-3">
                {committees.slice(0, 5).map((committee) => {
                  const membership = myMemberships?.find(
                    (m) => m.committeeId === committee.id
                  );
                  return (
                    <Link
                      key={committee.id}
                      href={`/committees/${committee.id}`}
                    >
                      <div
                        className="flex items-center gap-3 rounded-md p-2 hover-elevate"
                        data-testid={`card-committee-${committee.id}`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{committee.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {committee.code}
                          </p>
                        </div>
                        {membership && (
                          <Badge variant="secondary" className="text-xs">
                            {roleLabels[membership.role] || membership.role}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No perteneces a ningún comité aún
                </p>
                <Link href="/committees">
                  <Button variant="outline" size="sm" className="mt-4" data-testid="button-explore-committees">
                    Explorar Comités
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Turnos Próximos</CardTitle>
              <CardDescription>Próximas oportunidades de asistencia</CardDescription>
            </div>
            <Link href="/calendar">
              <Button variant="ghost" size="sm" data-testid="link-calendar">
                Ver calendario <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : upcomingSlots && upcomingSlots.length > 0 ? (
              <div className="space-y-3">
                {upcomingSlots.slice(0, 5).map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center gap-3 rounded-md p-2 hover-elevate"
                    data-testid={`card-slot-${slot.id}`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent">
                      <Clock className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        {new Date(slot.date).toLocaleDateString("es-MX", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {slot.committeeName}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {shiftLabels[slot.shift] || slot.shift}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No hay turnos disponibles próximamente
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>Accesos directos a las funciones más usadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/calendar">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="quick-action-calendar">
                <Calendar className="h-4 w-4" />
                Ver Calendario
              </Button>
            </Link>
            <Link href="/attendances">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="quick-action-attendance">
                <ClipboardCheck className="h-4 w-4" />
                Mis Asistencias
              </Button>
            </Link>
            <Link href="/committees">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="quick-action-committees">
                <Building2 className="h-4 w-4" />
                Gestionar Comités
              </Button>
            </Link>
            <Link href="/members">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="quick-action-members">
                <Users className="h-4 w-4" />
                Administrar Miembros
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

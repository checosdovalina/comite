import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, parseISO, isPast, isFuture } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarCheck,
  Clock,
  Building2,
  X,
  Calendar,
  History,
  AlertCircle,
} from "lucide-react";
import type { Attendance, AttendanceSlot, Committee } from "@shared/schema";

interface AttendanceWithDetails extends Attendance {
  slot?: AttendanceSlot & { committee?: Committee };
}

export default function AttendancesPage() {
  const { toast } = useToast();

  const { data: attendances, isLoading } = useQuery<AttendanceWithDetails[]>({
    queryKey: ["/api/my-attendances"],
  });

  const cancelMutation = useMutation({
    mutationFn: async (attendanceId: string) => {
      const response = await apiRequest("DELETE", `/api/attendances/${attendanceId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-attendances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance-slots"] });
      toast({
        title: "Asistencia cancelada",
        description: "Tu registro ha sido cancelado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo cancelar la asistencia",
        variant: "destructive",
      });
    },
  });

  const shiftLabels: Record<string, string> = {
    morning: "Mañana",
    afternoon: "Tarde",
    full_day: "Día completo",
  };

  const statusLabels: Record<string, string> = {
    confirmed: "Confirmado",
    cancelled: "Cancelado",
    attended: "Asistió",
    absent: "Ausente",
  };

  const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    confirmed: "default",
    cancelled: "secondary",
    attended: "default",
    absent: "destructive",
  };

  const upcomingAttendances = attendances?.filter(
    (a) => a.status === "confirmed" && a.slot && isFuture(parseISO(a.slot.date))
  ) || [];

  const pastAttendances = attendances?.filter(
    (a) => a.slot && isPast(parseISO(a.slot.date))
  ) || [];

  const cancelledAttendances = attendances?.filter(
    (a) => a.status === "cancelled"
  ) || [];

  const renderAttendanceTable = (items: AttendanceWithDetails[], showCancel = false) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No hay asistencias en esta categoría
          </p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Comité</TableHead>
            <TableHead>Turno</TableHead>
            <TableHead>Estado</TableHead>
            {showCancel && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((attendance) => (
            <TableRow key={attendance.id} data-testid={`row-attendance-${attendance.id}`}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {attendance.slot &&
                        format(parseISO(attendance.slot.date), "EEEE, d MMM", {
                          locale: es,
                        })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {attendance.slot &&
                        format(parseISO(attendance.slot.date), "yyyy")}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{attendance.slot?.committee?.name || "—"}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {attendance.slot
                      ? shiftLabels[attendance.slot.shift]
                      : "—"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={statusVariants[attendance.status]}>
                  {statusLabels[attendance.status] || attendance.status}
                </Badge>
              </TableCell>
              {showCancel && (
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelMutation.mutate(attendance.id)}
                    disabled={cancelMutation.isPending}
                    data-testid={`button-cancel-${attendance.id}`}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Cancelar
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Mis Asistencias
        </h1>
        <p className="text-muted-foreground">
          Gestiona tus registros de asistencia a los comités
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-upcoming">
                {upcomingAttendances.length}
              </div>
            )}
            <p className="text-xs text-muted-foreground">asistencias programadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Historial</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-past">
                {pastAttendances.length}
              </div>
            )}
            <p className="text-xs text-muted-foreground">asistencias pasadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-cancelled">
                {cancelledAttendances.length}
              </div>
            )}
            <p className="text-xs text-muted-foreground">registros cancelados</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">
            <Calendar className="mr-2 h-4 w-4" />
            Próximas ({upcomingAttendances.length})
          </TabsTrigger>
          <TabsTrigger value="past" data-testid="tab-past">
            <History className="mr-2 h-4 w-4" />
            Historial ({pastAttendances.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" data-testid="tab-cancelled">
            <AlertCircle className="mr-2 h-4 w-4" />
            Canceladas ({cancelledAttendances.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle>Próximas Asistencias</CardTitle>
              <CardDescription>
                Tus registros de asistencia programados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                renderAttendanceTable(upcomingAttendances, true)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="past">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Asistencias</CardTitle>
              <CardDescription>
                Registro de tus asistencias pasadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                renderAttendanceTable(pastAttendances)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cancelled">
          <Card>
            <CardHeader>
              <CardTitle>Asistencias Canceladas</CardTitle>
              <CardDescription>
                Registros que fueron cancelados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                renderAttendanceTable(cancelledAttendances)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

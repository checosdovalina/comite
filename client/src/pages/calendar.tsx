import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Plus,
  Check,
  X,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import type { Committee, AttendanceSlot, Attendance } from "@shared/schema";
import type { User } from "@shared/models/auth";

interface SlotWithAttendances extends AttendanceSlot {
  attendances?: (Attendance & { user?: User })[];
}

interface MembershipWithCommittee {
  id: string;
  committeeId: string;
  isAdmin: boolean;
  committee?: Committee;
}

export default function CalendarPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialCommitteeId = params.get("committee") || "";
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCommittee, setSelectedCommittee] = useState(initialCommitteeId);
  const [selectedSlot, setSelectedSlot] = useState<SlotWithAttendances | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newSlotShift, setNewSlotShift] = useState<string>("morning");
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { data: memberships } = useQuery<MembershipWithCommittee[]>({
    queryKey: ["/api/my-memberships"],
  });
  
  const isAdminOfSelectedCommittee = memberships?.some(
    m => m.committeeId === selectedCommittee && m.isAdmin === true
  ) || user?.isSuperAdmin === true;

  const { data: committees, isLoading: committeesLoading } = useQuery<Committee[]>({
    queryKey: ["/api/committees"],
  });

  const { data: slots, isLoading: slotsLoading } = useQuery<SlotWithAttendances[]>({
    queryKey: [
      "/api/attendance-slots",
      selectedCommittee,
      format(currentDate, "yyyy-MM"),
    ],
    enabled: !!selectedCommittee,
  });

  const registerMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const response = await apiRequest("POST", "/api/attendances", { slotId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance-slots"] });
      toast({
        title: "Registrado",
        description: "Te has registrado correctamente en este turno",
      });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo registrar tu asistencia",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (attendanceId: string) => {
      const response = await apiRequest("DELETE", `/api/attendances/${attendanceId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance-slots"] });
      toast({
        title: "Cancelado",
        description: "Tu asistencia ha sido cancelada",
      });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo cancelar tu asistencia",
        variant: "destructive",
      });
    },
  });

  const createSlotMutation = useMutation({
    mutationFn: async (data: { committeeId: string; date: string; shift: string; maxCapacity: number }) => {
      const response = await apiRequest("POST", "/api/attendance-slots", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance-slots"] });
      toast({
        title: "Turno creado",
        description: "El turno de asistencia se ha creado correctamente",
      });
      setIsCreateDialogOpen(false);
      setNewSlotShift("morning");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el turno",
        variant: "destructive",
      });
    },
  });

  const handleCreateSlot = () => {
    if (!selectedDate || !selectedCommittee) return;
    
    const selectedCommitteeData = committees?.find(c => c.id === selectedCommittee);
    const maxCapacity = selectedCommitteeData?.maxPerShift || 2;
    
    createSlotMutation.mutate({
      committeeId: selectedCommittee,
      date: format(selectedDate, "yyyy-MM-dd"),
      shift: newSlotShift,
      maxCapacity,
    });
  };

  const handleDayClick = (day: Date, daySlots: SlotWithAttendances[]) => {
    if (daySlots.length === 0 && isAdminOfSelectedCommittee) {
      setSelectedDate(day);
      setIsCreateDialogOpen(true);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = useMemo(() => {
    const days = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [calendarStart, calendarEnd]);

  const getSlotsForDate = (date: Date) => {
    if (!slots) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return slots.filter((slot) => slot.date === dateStr);
  };

  const shiftLabels: Record<string, string> = {
    morning: "Mañana",
    afternoon: "Tarde",
    full_day: "Día completo",
  };

  const shiftColors: Record<string, string> = {
    morning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    afternoon: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    full_day: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const isUserRegistered = (slot: SlotWithAttendances) => {
    return slot.attendances?.some((a) => a.userId === user?.id && a.status === "confirmed");
  };

  const getUserAttendance = (slot: SlotWithAttendances) => {
    return slot.attendances?.find((a) => a.userId === user?.id && a.status === "confirmed");
  };

  const getAvailableSpots = (slot: SlotWithAttendances) => {
    const confirmedCount = slot.attendances?.filter((a) => a.status === "confirmed").length || 0;
    return slot.maxCapacity - confirmedCount;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Calendario</h1>
          <p className="text-muted-foreground">
            Visualiza y gestiona los turnos de asistencia
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedCommittee} onValueChange={setSelectedCommittee}>
            <SelectTrigger className="w-[200px]" data-testid="select-committee">
              <SelectValue placeholder="Seleccionar comité" />
            </SelectTrigger>
            <SelectContent>
              {committees?.map((committee) => (
                <SelectItem key={committee.id} value={committee.id}>
                  {committee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="text-lg font-semibold capitalize" data-testid="text-current-month">
              {format(currentDate, "MMMM yyyy", { locale: es })}
            </h2>
          </div>
          <Button
            variant="outline"
            onClick={() => setCurrentDate(new Date())}
            data-testid="button-today"
          >
            Hoy
          </Button>
        </CardHeader>
        <CardContent>
          {!selectedCommittee ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Selecciona un comité</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Elige un comité para ver su calendario de turnos
              </p>
            </div>
          ) : slotsLoading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                  <div
                    key={day}
                    className="py-2 text-center text-sm font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  const daySlots = getSlotsForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isDayToday = isToday(day);

                  return (
                    <div
                      key={index}
                      className={`min-h-[100px] rounded-md border p-1 transition-colors cursor-pointer ${
                        !isCurrentMonth
                          ? "bg-muted/30 text-muted-foreground"
                          : isDayToday
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => handleDayClick(day, daySlots)}
                      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <div
                        className={`mb-1 flex items-center justify-between text-sm ${
                          isDayToday ? "font-bold text-primary" : ""
                        }`}
                      >
                        <span></span>
                        <span>{format(day, "d")}</span>
                        {daySlots.length === 0 && isAdminOfSelectedCommittee && isCurrentMonth && (
                          <Plus className="h-3 w-3 text-muted-foreground" />
                        )}
                        {(daySlots.length > 0 || !isAdminOfSelectedCommittee || !isCurrentMonth) && (
                          <span></span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {daySlots.slice(0, 2).map((slot) => (
                          <button
                            key={slot.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSlot(slot);
                              setIsDialogOpen(true);
                            }}
                            className={`w-full rounded px-1 py-0.5 text-left text-xs truncate ${
                              slot.isBlocked
                                ? "bg-muted text-muted-foreground line-through"
                                : isUserRegistered(slot)
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                : shiftColors[slot.shift]
                            }`}
                            data-testid={`slot-${slot.id}`}
                          >
                            {shiftLabels[slot.shift]}
                            {isUserRegistered(slot) && (
                              <Check className="ml-1 inline h-3 w-3" />
                            )}
                          </button>
                        ))}
                        {daySlots.length > 2 && (
                          <div className="text-xs text-muted-foreground text-center">
                            +{daySlots.length - 2} más
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded ${shiftColors.morning.split(" ")[0]}`} />
          <span className="text-sm">Mañana</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded ${shiftColors.afternoon.split(" ")[0]}`} />
          <span className="text-sm">Tarde</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded ${shiftColors.full_day.split(" ")[0]}`} />
          <span className="text-sm">Día completo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-green-100 dark:bg-green-900/30" />
          <span className="text-sm">Registrado</span>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          {selectedSlot && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {format(parseISO(selectedSlot.date), "EEEE, d 'de' MMMM", {
                    locale: es,
                  })}
                </DialogTitle>
                <DialogDescription>
                  Turno: {shiftLabels[selectedSlot.shift]}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {selectedSlot.attendances?.filter((a) => a.status === "confirmed").length || 0}{" "}
                      / {selectedSlot.maxCapacity} registrados
                    </span>
                  </div>
                  <Badge variant={selectedSlot.isBlocked ? "destructive" : "outline"}>
                    {selectedSlot.isBlocked
                      ? "Bloqueado"
                      : getAvailableSpots(selectedSlot) > 0
                      ? `${getAvailableSpots(selectedSlot)} cupos`
                      : "Lleno"}
                  </Badge>
                </div>

                {selectedSlot.notes && (
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-sm">{selectedSlot.notes}</p>
                  </div>
                )}

                {selectedSlot.attendances && selectedSlot.attendances.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Registrados:</h4>
                    <div className="space-y-2">
                      {selectedSlot.attendances
                        .filter((a) => a.status === "confirmed")
                        .map((attendance) => (
                          <div
                            key={attendance.id}
                            className="flex items-center gap-2"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={attendance.user?.profileImageUrl || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(
                                  attendance.user?.firstName,
                                  attendance.user?.lastName
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">
                              {attendance.user?.firstName} {attendance.user?.lastName}
                            </span>
                            {attendance.userId === user?.id && (
                              <Badge variant="secondary" className="text-xs">
                                Tú
                              </Badge>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                {selectedSlot.isBlocked ? (
                  <p className="text-sm text-muted-foreground">
                    Este turno está bloqueado y no acepta registros
                  </p>
                ) : isUserRegistered(selectedSlot) ? (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const attendance = getUserAttendance(selectedSlot);
                      if (attendance) {
                        cancelMutation.mutate(attendance.id);
                      }
                    }}
                    disabled={cancelMutation.isPending}
                    data-testid="button-cancel-attendance"
                  >
                    <X className="mr-2 h-4 w-4" />
                    {cancelMutation.isPending ? "Cancelando..." : "Cancelar Registro"}
                  </Button>
                ) : getAvailableSpots(selectedSlot) > 0 ? (
                  <Button
                    onClick={() => registerMutation.mutate(selectedSlot.id)}
                    disabled={registerMutation.isPending}
                    data-testid="button-register-attendance"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {registerMutation.isPending ? "Registrando..." : "Registrarme"}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No hay cupos disponibles en este turno
                  </p>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Turno de Asistencia</DialogTitle>
            <DialogDescription>
              {selectedDate && format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de turno</label>
              <Select value={newSlotShift} onValueChange={setNewSlotShift}>
                <SelectTrigger data-testid="select-new-slot-shift">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Mañana</SelectItem>
                  <SelectItem value="afternoon">Tarde</SelectItem>
                  <SelectItem value="full_day">Día completo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateSlot}
              disabled={createSlotMutation.isPending}
              data-testid="button-create-slot"
            >
              <Plus className="mr-2 h-4 w-4" />
              {createSlotMutation.isPending ? "Creando..." : "Crear Turno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

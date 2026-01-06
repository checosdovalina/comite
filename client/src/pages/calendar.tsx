import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Check,
  X,
  Sun,
  Sunset,
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
import type { Committee, Attendance } from "@shared/schema";

interface AttendanceWithDetails extends Attendance {
  date?: string;
  shift?: string;
  committeeId?: string;
  committeeName?: string;
}

export default function CalendarPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialCommitteeId = params.get("committee") || "";
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCommittee, setSelectedCommittee] = useState(initialCommitteeId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedShift, setSelectedShift] = useState<string>("morning");
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: committees, isLoading: committeesLoading } = useQuery<Committee[]>({
    queryKey: ["/api/committees"],
  });

  const { data: myAttendances, isLoading: attendancesLoading } = useQuery<AttendanceWithDetails[]>({
    queryKey: ["/api/my-attendances"],
  });

  const markAttendanceMutation = useMutation({
    mutationFn: async (data: { committeeId: string; date: string; shift: string }) => {
      const response = await apiRequest("POST", "/api/mark-attendance", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-attendances"] });
      toast({
        title: "Asistencia registrada",
        description: "Tu asistencia ha sido marcada correctamente",
      });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar tu asistencia",
        variant: "destructive",
      });
    },
  });

  const cancelAttendanceMutation = useMutation({
    mutationFn: async (attendanceId: string) => {
      const response = await apiRequest("DELETE", `/api/attendances/${attendanceId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-attendances"] });
      toast({
        title: "Asistencia cancelada",
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

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [calendarStart, calendarEnd]);

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const getAttendanceForDate = (date: Date, shift: string) => {
    if (!myAttendances || !selectedCommittee) return null;
    const dateStr = format(date, "yyyy-MM-dd");
    return myAttendances.find(
      (a) => a.date === dateStr && a.shift === shift && a.committeeId === selectedCommittee && a.status === "confirmed"
    );
  };

  const hasAttendanceOnDate = (date: Date) => {
    if (!myAttendances || !selectedCommittee) return { morning: false, afternoon: false };
    const dateStr = format(date, "yyyy-MM-dd");
    const dayAttendances = myAttendances.filter(
      (a) => a.date === dateStr && a.committeeId === selectedCommittee && a.status === "confirmed"
    );
    return {
      morning: dayAttendances.some((a) => a.shift === "morning"),
      afternoon: dayAttendances.some((a) => a.shift === "afternoon"),
    };
  };

  const handleDayClick = (day: Date) => {
    if (!selectedCommittee) {
      toast({
        title: "Selecciona un comité",
        description: "Primero debes seleccionar un comité",
        variant: "destructive",
      });
      return;
    }
    setSelectedDate(day);
    setSelectedShift("morning");
    setIsDialogOpen(true);
  };

  const handleMarkAttendance = () => {
    if (!selectedDate || !selectedCommittee) return;
    
    markAttendanceMutation.mutate({
      committeeId: selectedCommittee,
      date: format(selectedDate, "yyyy-MM-dd"),
      shift: selectedShift,
    });
  };

  const selectedCommitteeData = committees?.find((c) => c.id === selectedCommittee);

  if (committeesLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Marcar Asistencia
          </h1>
          <p className="text-muted-foreground">
            Selecciona una fecha para registrar tu asistencia
          </p>
        </div>

        <Select value={selectedCommittee} onValueChange={setSelectedCommittee}>
          <SelectTrigger className="w-[280px]" data-testid="select-committee">
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

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg capitalize">
              {format(currentDate, "MMMM yyyy", { locale: es })}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {selectedCommitteeData && (
            <CardDescription>
              {selectedCommitteeData.name}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {!selectedCommittee ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Selecciona un comité para ver el calendario
              </p>
            </div>
          ) : attendancesLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-sm font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isDayToday = isToday(day);
                  const attendance = hasAttendanceOnDate(day);

                  return (
                    <div
                      key={index}
                      onClick={() => isCurrentMonth && handleDayClick(day)}
                      className={`min-h-[80px] rounded-md border p-2 transition-colors ${
                        !isCurrentMonth
                          ? "bg-muted/30 text-muted-foreground cursor-not-allowed"
                          : isDayToday
                          ? "border-primary bg-primary/5 cursor-pointer hover:bg-primary/10"
                          : "cursor-pointer hover:bg-muted/50"
                      }`}
                      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <div
                        className={`text-right text-sm mb-1 ${
                          isDayToday ? "font-bold text-primary" : ""
                        }`}
                      >
                        {format(day, "d")}
                      </div>
                      {isCurrentMonth && (attendance.morning || attendance.afternoon) && (
                        <div className="space-y-1">
                          {attendance.morning && (
                            <div className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded px-1 py-0.5">
                              <Sun className="h-3 w-3" />
                              <span>Mañana</span>
                            </div>
                          )}
                          {attendance.afternoon && (
                            <div className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded px-1 py-0.5">
                              <Sunset className="h-3 w-3" />
                              <span>Tarde</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar Asistencia</DialogTitle>
            <DialogDescription>
              {selectedDate && format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es })}
            </DialogDescription>
          </DialogHeader>

          {selectedDate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Selecciona el turno</label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={selectedShift === "morning" ? "default" : "outline"}
                    className="flex flex-col items-center gap-2 h-auto py-4"
                    onClick={() => setSelectedShift("morning")}
                    data-testid="button-shift-morning"
                  >
                    <Sun className="h-6 w-6" />
                    <span>Mañana</span>
                    {selectedCommitteeData && (
                      <span className="text-xs opacity-70">
                        {selectedCommitteeData.morningStart} - {selectedCommitteeData.morningEnd}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant={selectedShift === "afternoon" ? "default" : "outline"}
                    className="flex flex-col items-center gap-2 h-auto py-4"
                    onClick={() => setSelectedShift("afternoon")}
                    data-testid="button-shift-afternoon"
                  >
                    <Sunset className="h-6 w-6" />
                    <span>Tarde</span>
                    {selectedCommitteeData && (
                      <span className="text-xs opacity-70">
                        {selectedCommitteeData.afternoonStart} - {selectedCommitteeData.afternoonEnd}
                      </span>
                    )}
                  </Button>
                </div>
              </div>

              {getAttendanceForDate(selectedDate, selectedShift) ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-md">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Ya tienes asistencia registrada para este turno</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedDate && getAttendanceForDate(selectedDate, selectedShift) ? (
              <Button
                variant="destructive"
                onClick={() => {
                  const attendance = getAttendanceForDate(selectedDate, selectedShift);
                  if (attendance) {
                    cancelAttendanceMutation.mutate(attendance.id);
                  }
                }}
                disabled={cancelAttendanceMutation.isPending}
                data-testid="button-cancel-attendance"
              >
                <X className="mr-2 h-4 w-4" />
                {cancelAttendanceMutation.isPending ? "Cancelando..." : "Cancelar Asistencia"}
              </Button>
            ) : (
              <Button
                onClick={handleMarkAttendance}
                disabled={markAttendanceMutation.isPending}
                data-testid="button-mark-attendance"
              >
                <Check className="mr-2 h-4 w-4" />
                {markAttendanceMutation.isPending ? "Registrando..." : "Marcar Asistencia"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

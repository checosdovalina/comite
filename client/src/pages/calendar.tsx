import { useState, useMemo, useEffect } from "react";
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
  Download,
  Users,
  MapPin,
  FileText,
  GraduationCap,
  CalendarDays,
  MoreHorizontal,
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
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isSameWeek,
  isToday,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import type { Committee, Attendance, MemberActivity } from "@shared/schema";

interface AttendanceWithDetails extends Attendance {
  date?: string;
  shift?: string;
  committeeId?: string;
  committeeName?: string;
}

interface CalendarAttendance {
  id: string;
  date: string;
  shift: string;
  userId: string;
  userName: string;
  registeredAt: string;
}

type ViewMode = "day" | "week" | "month";

interface CalendarActivity extends MemberActivity {
  userName?: string;
}

const activityTypeConfig: Record<string, { icon: typeof Users; color: string; label: string }> = {
  meeting: { icon: Users, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300", label: "Reunión" },
  visit: { icon: MapPin, color: "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300", label: "Visita" },
  report: { icon: FileText, color: "bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300", label: "Reporte" },
  training: { icon: GraduationCap, color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300", label: "Capacitación" },
  event: { icon: CalendarDays, color: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300", label: "Evento" },
  other: { icon: MoreHorizontal, color: "bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300", label: "Otro" },
};

export default function CalendarPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialCommitteeId = params.get("committee") || "";
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCommittee, setSelectedCommittee] = useState(initialCommitteeId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedShift, setSelectedShift] = useState<string>("morning");
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: committees, isLoading: committeesLoading } = useQuery<Committee[]>({
    queryKey: ["/api/committees"],
  });

  interface MembershipWithCommittee {
    id: string;
    committeeId: string;
    isAdmin: boolean;
    committee?: Committee;
  }

  const { data: myMemberships } = useQuery<MembershipWithCommittee[]>({
    queryKey: ["/api/my-memberships"],
  });

  const { data: myAttendances, isLoading: attendancesLoading } = useQuery<AttendanceWithDetails[]>({
    queryKey: ["/api/my-attendances"],
  });

  // Auto-select committee for non-superadmin users
  useEffect(() => {
    if (!user?.isSuperAdmin && myMemberships && myMemberships.length > 0 && !selectedCommittee) {
      setSelectedCommittee(myMemberships[0].committeeId);
    }
  }, [user?.isSuperAdmin, myMemberships, selectedCommittee]);

  // Calculate date range based on view mode
  const getDateRange = () => {
    if (viewMode === "day") {
      return { start: currentDate, end: currentDate };
    } else if (viewMode === "week") {
      return { 
        start: startOfWeek(currentDate, { weekStartsOn: 1 }), 
        end: endOfWeek(currentDate, { weekStartsOn: 1 }) 
      };
    } else {
      return { 
        start: startOfMonth(currentDate), 
        end: endOfMonth(currentDate) 
      };
    }
  };

  const dateRange = getDateRange();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);

  const { data: calendarAttendances } = useQuery<CalendarAttendance[]>({
    queryKey: ["/api/committees", selectedCommittee, "calendar-attendances", format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!selectedCommittee) return [];
      const response = await fetch(
        `/api/committees/${selectedCommittee}/calendar-attendances?startDate=${format(dateRange.start, "yyyy-MM-dd")}&endDate=${format(dateRange.end, "yyyy-MM-dd")}`
      );
      if (!response.ok) throw new Error("Failed to fetch calendar attendances");
      return response.json();
    },
    enabled: !!selectedCommittee,
  });

  const { data: calendarActivities } = useQuery<CalendarActivity[]>({
    queryKey: ["/api/committees", selectedCommittee, "calendar-activities", format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!selectedCommittee) return [];
      const response = await fetch(
        `/api/committees/${selectedCommittee}/calendar-activities?startDate=${format(dateRange.start, "yyyy-MM-dd")}&endDate=${format(dateRange.end, "yyyy-MM-dd")}`
      );
      if (!response.ok) throw new Error("Failed to fetch calendar activities");
      return response.json();
    },
    enabled: !!selectedCommittee,
  });

  const markAttendanceMutation = useMutation({
    mutationFn: async (data: { committeeId: string; date: string; shift: string }) => {
      const response = await apiRequest("POST", "/api/mark-attendance", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-attendances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/committees", selectedCommittee, "calendar-attendances"] });
      toast({
        title: "Turno registrado",
        description: "Tu turno ha sido registrado correctamente",
      });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar tu turno",
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
      queryClient.invalidateQueries({ queryKey: ["/api/committees", selectedCommittee, "calendar-attendances"] });
      toast({
        title: "Turno cancelado",
        description: "Tu turno ha sido cancelado",
      });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo cancelar tu turno",
        variant: "destructive",
      });
    },
  });

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

  // Days for week view
  const weekDaysArray = useMemo(() => {
    const days: Date[] = [];
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [currentDate]);

  // Navigation functions
  const navigatePrevious = () => {
    if (viewMode === "day") {
      setCurrentDate(addDays(currentDate, -1));
    } else if (viewMode === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === "day") {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewMode === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const getViewTitle = () => {
    if (viewMode === "day") {
      return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: es });
    } else if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      if (isSameMonth(weekStart, weekEnd)) {
        return `${format(weekStart, "d", { locale: es })} - ${format(weekEnd, "d 'de' MMMM yyyy", { locale: es })}`;
      }
      return `${format(weekStart, "d MMM", { locale: es })} - ${format(weekEnd, "d MMM yyyy", { locale: es })}`;
    } else {
      return format(currentDate, "MMMM yyyy", { locale: es });
    }
  };

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

  const getMembersForDate = (date: Date, shift: string) => {
    if (!calendarAttendances) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return calendarAttendances.filter((a) => a.date === dateStr && a.shift === shift);
  };

  const getMembersForDateBoth = (date: Date) => {
    if (!calendarAttendances) return { morning: [], afternoon: [] };
    const dateStr = format(date, "yyyy-MM-dd");
    return {
      morning: calendarAttendances.filter((a) => a.date === dateStr && a.shift === "morning"),
      afternoon: calendarAttendances.filter((a) => a.date === dateStr && a.shift === "afternoon"),
    };
  };

  const getActivitiesForDate = (date: Date): CalendarActivity[] => {
    if (!calendarActivities) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return calendarActivities.filter((a) => a.activityDate === dateStr);
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

  const escapeHtml = (text: string): string => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  const handleDownloadCalendarPDF = () => {
    if (!selectedCommittee || !calendarAttendances) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const committeeName = escapeHtml(selectedCommitteeData?.name || "Comité");
    const monthName = format(currentDate, "MMMM yyyy", { locale: es });

    // Generate calendar grid HTML
    const generateDayCell = (day: Date) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isCurrentMonth = isSameMonth(day, currentDate);
      const morningMembers = calendarAttendances.filter(a => a.date === dateStr && a.shift === "morning");
      const afternoonMembers = calendarAttendances.filter(a => a.date === dateStr && a.shift === "afternoon");

      if (!isCurrentMonth) {
        return `<td style="background: #f5f5f5; color: #999; padding: 8px; vertical-align: top; border: 1px solid #ddd;">${format(day, "d")}</td>`;
      }

      let content = `<div style="font-weight: bold; margin-bottom: 4px;">${format(day, "d")}</div>`;
      
      if (morningMembers.length > 0) {
        content += `<div style="background: #fef3c7; padding: 4px; border-radius: 4px; margin-bottom: 4px; font-size: 11px;">`;
        content += `<div style="font-weight: 600;">Mañana</div>`;
        morningMembers.forEach(m => {
          content += `<div>${escapeHtml(m.userName)}</div>`;
        });
        content += `</div>`;
      }
      
      if (afternoonMembers.length > 0) {
        content += `<div style="background: #dbeafe; padding: 4px; border-radius: 4px; font-size: 11px;">`;
        content += `<div style="font-weight: 600;">Tarde</div>`;
        afternoonMembers.forEach(m => {
          content += `<div>${escapeHtml(m.userName)}</div>`;
        });
        content += `</div>`;
      }

      return `<td style="padding: 8px; vertical-align: top; border: 1px solid #ddd; min-width: 100px;">${content}</td>`;
    };

    // Build weeks
    let weeksHtml = "";
    let currentWeek: Date[] = [];
    
    calendarDays.forEach((day, index) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeksHtml += `<tr>${currentWeek.map(d => generateDayCell(d)).join("")}</tr>`;
        currentWeek = [];
      }
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Calendario - ${committeeName} - ${monthName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; color: #333; margin-bottom: 5px; }
            .header-info { text-align: center; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th { background-color: #4f46e5; color: white; padding: 10px; text-align: center; }
            @media print {
              body { margin: 0; }
              @page { size: landscape; }
            }
          </style>
        </head>
        <body>
          <h1>Calendario de Turnos</h1>
          <div class="header-info">
            <strong>${committeeName}</strong><br/>
            ${monthName}
          </div>
          <table>
            <thead>
              <tr>
                <th>Lun</th>
                <th>Mar</th>
                <th>Mié</th>
                <th>Jue</th>
                <th>Vie</th>
                <th>Sáb</th>
                <th>Dom</th>
              </tr>
            </thead>
            <tbody>
              ${weeksHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (committeesLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">
            Registrar Turno
          </h1>
          <p className="text-sm text-muted-foreground">
            Selecciona una fecha para registrar tu turno
          </p>
        </div>

        <Select value={selectedCommittee} onValueChange={setSelectedCommittee}>
          <SelectTrigger className="w-full sm:w-[280px]" data-testid="select-committee">
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
        <CardHeader className="p-3 sm:p-6 pb-2">
          <div className="flex flex-col gap-3">
            {/* Navigation Row */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={navigatePrevious}
                className="h-10 w-10 touch-manipulation"
                data-testid="button-nav-prev"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-base sm:text-lg capitalize text-center flex-1 px-2">
                {getViewTitle()}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={navigateNext}
                className="h-10 w-10 touch-manipulation"
                data-testid="button-nav-next"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            {/* View Mode Selector Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex border rounded-md flex-1 sm:flex-initial">
                <Button
                  variant={viewMode === "day" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("day")}
                  className="rounded-r-none flex-1 sm:flex-initial touch-manipulation"
                  data-testid="button-view-day"
                >
                  Día
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  className="rounded-none border-x flex-1 sm:flex-initial touch-manipulation"
                  data-testid="button-view-week"
                >
                  Semana
                </Button>
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  className="rounded-l-none flex-1 sm:flex-initial touch-manipulation"
                  data-testid="button-view-month"
                >
                  Mes
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                  className="touch-manipulation"
                  data-testid="button-today"
                >
                  Hoy
                </Button>
                {selectedCommittee && calendarAttendances && calendarAttendances.length > 0 && viewMode === "month" && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleDownloadCalendarPDF}
                    className="touch-manipulation"
                    data-testid="button-download-calendar-pdf"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          {selectedCommitteeData && (
            <CardDescription className="mt-2">
              {selectedCommitteeData.name}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
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
          ) : viewMode === "day" ? (
            /* Day View */
            <div className="space-y-4">
              <div
                onClick={() => handleDayClick(currentDate)}
                className={`rounded-md border p-3 sm:p-4 cursor-pointer transition-colors touch-manipulation ${
                  isToday(currentDate) ? "border-primary bg-primary/5" : "hover:bg-muted/50 active:bg-muted/70"
                }`}
                data-testid={`calendar-day-${format(currentDate, "yyyy-MM-dd")}`}
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
                  <div className={`text-base sm:text-lg font-semibold ${isToday(currentDate) ? "text-primary" : ""}`}>
                    {format(currentDate, "EEEE, d 'de' MMMM", { locale: es })}
                  </div>
                  {isToday(currentDate) && <Badge>Hoy</Badge>}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  {/* Morning Section */}
                  <div className={`p-3 sm:p-4 rounded-md ${hasAttendanceOnDate(currentDate).morning ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                    <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
                      <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="font-semibold text-sm sm:text-base">Turno Mañana</span>
                      {selectedCommitteeData && (
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          ({selectedCommitteeData.morningStart} - {selectedCommitteeData.morningEnd})
                        </span>
                      )}
                    </div>
                    {getMembersForDate(currentDate, "morning").length > 0 ? (
                      <div className="space-y-1 sm:space-y-2">
                        {getMembersForDate(currentDate, "morning").map((m) => (
                          <div key={m.id} className="flex items-center gap-2 text-xs sm:text-sm">
                            <span>{m.userName}</span>
                            {m.userId === user?.id && <Badge variant="secondary">Tú</Badge>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs sm:text-sm text-muted-foreground">Sin registros</p>
                    )}
                  </div>
                  {/* Afternoon Section */}
                  <div className={`p-3 sm:p-4 rounded-md ${hasAttendanceOnDate(currentDate).afternoon ? "bg-green-100 dark:bg-green-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                    <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
                      <Sunset className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="font-semibold text-sm sm:text-base">Turno Tarde</span>
                      {selectedCommitteeData && (
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          ({selectedCommitteeData.afternoonStart} - {selectedCommitteeData.afternoonEnd})
                        </span>
                      )}
                    </div>
                    {getMembersForDate(currentDate, "afternoon").length > 0 ? (
                      <div className="space-y-1 sm:space-y-2">
                        {getMembersForDate(currentDate, "afternoon").map((m) => (
                          <div key={m.id} className="flex items-center gap-2 text-xs sm:text-sm">
                            <span>{m.userName}</span>
                            {m.userId === user?.id && <Badge variant="secondary">Tú</Badge>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs sm:text-sm text-muted-foreground">Sin registros</p>
                    )}
                  </div>
                  {/* Activities Section */}
                  {getActivitiesForDate(currentDate).length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-sm sm:text-base mb-2 flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />
                        Actividades del día
                      </h4>
                      <div className="space-y-2">
                        {getActivitiesForDate(currentDate).map((activity) => {
                          const config = activityTypeConfig[activity.activityType] || activityTypeConfig.other;
                          const ActivityIcon = config.icon;
                          return (
                            <div key={activity.id} className={`p-3 rounded-md ${config.color}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <ActivityIcon className="h-4 w-4 flex-shrink-0" />
                                <span className="font-medium text-sm">{activity.title}</span>
                              </div>
                              {activity.startTime && (
                                <div className="text-xs opacity-75 flex items-center gap-1 ml-6">
                                  <Clock className="h-3 w-3" />
                                  {activity.startTime}
                                  {activity.endTime && ` - ${activity.endTime}`}
                                </div>
                              )}
                              {activity.userName && (
                                <div className="text-xs opacity-75 ml-6 mt-1">
                                  Por: {activity.userName}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : viewMode === "week" ? (
            /* Week View */
            <>
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
                {weekDays.map((day, idx) => (
                  <div
                    key={day}
                    className="p-1 sm:p-2 text-center text-[10px] sm:text-sm font-medium text-muted-foreground"
                  >
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{day.charAt(0)}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                {weekDaysArray.map((day, index) => {
                  const isDayToday = isToday(day);
                  const myAttendance = hasAttendanceOnDate(day);
                  const members = getMembersForDateBoth(day);
                  const activities = getActivitiesForDate(day);
                  const hasMorningMembers = members.morning.length > 0;
                  const hasAfternoonMembers = members.afternoon.length > 0;
                  const hasActivities = activities.length > 0;

                  return (
                    <div
                      key={index}
                      onClick={() => handleDayClick(day)}
                      className={`min-h-[80px] sm:min-h-[140px] rounded-md border p-1 sm:p-2 transition-colors cursor-pointer touch-manipulation ${
                        isDayToday
                          ? "border-primary bg-primary/5 hover:bg-primary/10 active:bg-primary/20"
                          : "hover:bg-muted/50 active:bg-muted/70"
                      }`}
                      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <div
                        className={`text-right text-xs sm:text-sm mb-0.5 sm:mb-1 ${
                          isDayToday ? "font-bold text-primary" : ""
                        }`}
                      >
                        {format(day, "d")}
                      </div>
                      {(hasMorningMembers || hasAfternoonMembers || hasActivities) && (
                        <div className="space-y-0.5 sm:space-y-1">
                          {hasMorningMembers && (
                            <div className={`text-[9px] sm:text-xs rounded px-0.5 sm:px-1 py-0.5 ${myAttendance.morning ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"}`}>
                              <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5">
                                <Sun className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                <span className="font-medium hidden sm:inline">Mañana</span>
                                <span className="font-medium sm:hidden">{members.morning.length}</span>
                              </div>
                              <div className="space-y-0.5 pl-3 sm:pl-4 hidden sm:block">
                                {members.morning.slice(0, 2).map((m) => (
                                  <div key={m.id} className="truncate text-[9px] sm:text-[10px]">
                                    {m.userName}
                                  </div>
                                ))}
                                {members.morning.length > 2 && (
                                  <div className="text-[9px] sm:text-[10px] opacity-70">+{members.morning.length - 2}</div>
                                )}
                              </div>
                            </div>
                          )}
                          {hasAfternoonMembers && (
                            <div className={`text-[9px] sm:text-xs rounded px-0.5 sm:px-1 py-0.5 ${myAttendance.afternoon ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"}`}>
                              <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5">
                                <Sunset className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                <span className="font-medium hidden sm:inline">Tarde</span>
                                <span className="font-medium sm:hidden">{members.afternoon.length}</span>
                              </div>
                              <div className="space-y-0.5 pl-3 sm:pl-4 hidden sm:block">
                                {members.afternoon.slice(0, 2).map((m) => (
                                  <div key={m.id} className="truncate text-[9px] sm:text-[10px]">
                                    {m.userName}
                                  </div>
                                ))}
                                {members.afternoon.length > 2 && (
                                  <div className="text-[9px] sm:text-[10px] opacity-70">+{members.afternoon.length - 2}</div>
                                )}
                              </div>
                            </div>
                          )}
                          {hasActivities && activities.slice(0, 2).map((activity) => {
                            const config = activityTypeConfig[activity.activityType] || activityTypeConfig.other;
                            const ActivityIcon = config.icon;
                            return (
                              <div key={activity.id} className={`text-[9px] sm:text-xs rounded px-0.5 sm:px-1 py-0.5 ${config.color}`}>
                                <div className="flex items-center gap-0.5 sm:gap-1">
                                  <ActivityIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                  <span className="font-medium truncate">{activity.title}</span>
                                </div>
                              </div>
                            );
                          })}
                          {activities.length > 2 && (
                            <div className="text-[9px] sm:text-[10px] opacity-70 text-center">+{activities.length - 2} más</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Month View */
            <>
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="p-1 sm:p-2 text-center text-[10px] sm:text-sm font-medium text-muted-foreground"
                  >
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{day.charAt(0)}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                {calendarDays.map((day, index) => {
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isDayToday = isToday(day);
                  const myAttendance = hasAttendanceOnDate(day);
                  const members = getMembersForDateBoth(day);
                  const activities = getActivitiesForDate(day);
                  const hasMorningMembers = members.morning.length > 0;
                  const hasAfternoonMembers = members.afternoon.length > 0;
                  const hasActivities = activities.length > 0;

                  return (
                    <div
                      key={index}
                      onClick={() => isCurrentMonth && handleDayClick(day)}
                      className={`min-h-[60px] sm:min-h-[100px] rounded-md border p-1 sm:p-2 transition-colors touch-manipulation ${
                        !isCurrentMonth
                          ? "bg-muted/30 text-muted-foreground cursor-not-allowed"
                          : isDayToday
                          ? "border-primary bg-primary/5 cursor-pointer hover:bg-primary/10 active:bg-primary/20"
                          : "cursor-pointer hover:bg-muted/50 active:bg-muted/70"
                      }`}
                      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <div
                        className={`text-right text-xs sm:text-sm mb-0.5 sm:mb-1 ${
                          isDayToday ? "font-bold text-primary" : ""
                        }`}
                      >
                        {format(day, "d")}
                      </div>
                      {isCurrentMonth && (hasMorningMembers || hasAfternoonMembers || hasActivities) && (
                        <div className="space-y-0.5 sm:space-y-1">
                          {hasMorningMembers && (
                            <div className={`text-[9px] sm:text-xs rounded px-0.5 sm:px-1 py-0.5 ${myAttendance.morning ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"}`}>
                              <div className="flex items-center gap-0.5 sm:gap-1">
                                <Sun className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                <span className="font-medium sm:hidden">{members.morning.length}</span>
                                <span className="font-medium hidden sm:inline">Mañana</span>
                              </div>
                              <div className="space-y-0.5 pl-3 sm:pl-4 hidden sm:block">
                                {members.morning.slice(0, 2).map((m) => (
                                  <div key={m.id} className="truncate text-[9px] sm:text-[10px]">
                                    {m.userName}
                                  </div>
                                ))}
                                {members.morning.length > 2 && (
                                  <div className="text-[9px] sm:text-[10px] opacity-70">+{members.morning.length - 2}</div>
                                )}
                              </div>
                            </div>
                          )}
                          {hasAfternoonMembers && (
                            <div className={`text-[9px] sm:text-xs rounded px-0.5 sm:px-1 py-0.5 ${myAttendance.afternoon ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"}`}>
                              <div className="flex items-center gap-0.5 sm:gap-1">
                                <Sunset className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                <span className="font-medium sm:hidden">{members.afternoon.length}</span>
                                <span className="font-medium hidden sm:inline">Tarde</span>
                              </div>
                              <div className="space-y-0.5 pl-3 sm:pl-4 hidden sm:block">
                                {members.afternoon.slice(0, 2).map((m) => (
                                  <div key={m.id} className="truncate text-[9px] sm:text-[10px]">
                                    {m.userName}
                                  </div>
                                ))}
                                {members.afternoon.length > 2 && (
                                  <div className="text-[9px] sm:text-[10px] opacity-70">+{members.afternoon.length - 2}</div>
                                )}
                              </div>
                            </div>
                          )}
                          {hasActivities && activities.slice(0, 2).map((activity) => {
                            const config = activityTypeConfig[activity.activityType] || activityTypeConfig.other;
                            const ActivityIcon = config.icon;
                            return (
                              <div key={activity.id} className={`text-[9px] sm:text-xs rounded px-0.5 sm:px-1 py-0.5 ${config.color}`}>
                                <div className="flex items-center gap-0.5 sm:gap-1">
                                  <ActivityIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                  <span className="font-medium truncate">{activity.title}</span>
                                </div>
                              </div>
                            );
                          })}
                          {activities.length > 2 && (
                            <div className="text-[9px] sm:text-[10px] opacity-70 text-center">+{activities.length - 2} más</div>
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
            <DialogTitle>Registrar Turno</DialogTitle>
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

              {/* Show who is attending this shift */}
              {getMembersForDate(selectedDate, selectedShift).length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Miembros registrados para este turno</label>
                  <div className="p-3 bg-muted/50 rounded-md space-y-1 max-h-32 overflow-y-auto">
                    {getMembersForDate(selectedDate, selectedShift).map((member) => (
                      <div
                        key={member.id}
                        className={`text-sm flex items-center gap-2 ${member.userId === user?.id ? "font-medium text-primary" : ""}`}
                      >
                        <span>{member.userName}</span>
                        {member.userId === user?.id && <Badge variant="secondary">Tú</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getAttendanceForDate(selectedDate, selectedShift) ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-md">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Ya tienes este turno registrado</span>
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
                {cancelAttendanceMutation.isPending ? "Cancelando..." : "Cancelar Turno"}
              </Button>
            ) : (
              <Button
                onClick={handleMarkAttendance}
                disabled={markAttendanceMutation.isPending}
                data-testid="button-mark-attendance"
              >
                <Check className="mr-2 h-4 w-4" />
                {markAttendanceMutation.isPending ? "Registrando..." : "Registrar Turno"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

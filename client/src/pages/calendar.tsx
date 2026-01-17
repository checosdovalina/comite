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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Filter,
  User,
  ExternalLink,
  Presentation,
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
import type { Committee, Attendance, MemberActivity, ActivityAttendance } from "@shared/schema";

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

interface ActivityAttendanceWithUser extends ActivityAttendance {
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

// Helper to ensure URLs have proper protocol
const ensureAbsoluteUrl = (url: string): string => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
};

const activityTypeConfig: Record<string, { icon: typeof Users; color: string; label: string }> = {
  meeting: { icon: Users, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300", label: "Reunión" },
  visit: { icon: MapPin, color: "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300", label: "Visita" },
  report: { icon: FileText, color: "bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300", label: "Reporte" },
  training: { icon: GraduationCap, color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300", label: "Capacitación" },
  event: { icon: CalendarDays, color: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300", label: "Evento" },
  session: { icon: Presentation, color: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300", label: "Sesión" },
  other: { icon: MoreHorizontal, color: "bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300", label: "Otro" },
};

export default function CalendarPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialCommitteeId = params.get("committee") || "";
  const teamIdFromUrl = params.get("team") || "";
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCommittee, setSelectedCommittee] = useState(initialCommitteeId);
  const [selectedTeamId, setSelectedTeamId] = useState(teamIdFromUrl);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedShift, setSelectedShift] = useState<string>("morning");
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterActivityType, setFilterActivityType] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [activityFormData, setActivityFormData] = useState({
    title: "",
    description: "",
    activityType: "other" as string,
    startTime: "",
    endTime: "",
    location: "",
    meetingUrl: "",
  });
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
    enabled: !!selectedCommittee && !selectedTeamId,
  });

  const { data: teamActivities } = useQuery<CalendarActivity[]>({
    queryKey: ["/api/teams", selectedTeamId, "activities", format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!selectedTeamId) return [];
      const response = await fetch(
        `/api/teams/${selectedTeamId}/activities?startDate=${format(dateRange.start, "yyyy-MM-dd")}&endDate=${format(dateRange.end, "yyyy-MM-dd")}`
      );
      if (!response.ok) throw new Error("Failed to fetch team activities");
      return response.json();
    },
    enabled: !!selectedTeamId,
  });

  const { data: selectedTeamData } = useQuery<{ id: string; name: string; committeeId: string }>({
    queryKey: ["/api/teams", selectedTeamId],
    queryFn: async () => {
      if (!selectedTeamId) return null;
      const response = await fetch(`/api/teams/${selectedTeamId}`);
      if (!response.ok) throw new Error("Failed to fetch team");
      return response.json();
    },
    enabled: !!selectedTeamId,
  });

  // Merge activities - use team activities if in team view, otherwise use committee activities
  const displayActivities = selectedTeamId ? (teamActivities || []) : (calendarActivities || []);

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

  // Activity attendance query and mutations
  const { data: activityAttendances, isLoading: activityAttendancesLoading } = useQuery<ActivityAttendanceWithUser[]>({
    queryKey: ["/api/activities", expandedActivityId, "attendances"],
    queryFn: async () => {
      if (!expandedActivityId) return [];
      const response = await fetch(`/api/activities/${expandedActivityId}/attendances`);
      if (!response.ok) throw new Error("Failed to fetch activity attendances");
      return response.json();
    },
    enabled: !!expandedActivityId,
  });

  const registerForActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const response = await apiRequest("POST", `/api/activities/${activityId}/attendances`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities", expandedActivityId, "attendances"] });
      toast({
        title: "Asistencia registrada",
        description: "Te has registrado para esta actividad",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar tu asistencia",
        variant: "destructive",
      });
    },
  });

  const cancelActivityAttendanceMutation = useMutation({
    mutationFn: async (attendanceId: string) => {
      const response = await apiRequest("DELETE", `/api/activity-attendances/${attendanceId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities", expandedActivityId, "attendances"] });
      toast({
        title: "Asistencia cancelada",
        description: "Tu registro ha sido cancelado",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo cancelar tu registro",
        variant: "destructive",
      });
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/activities", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/committees", selectedCommittee, "calendar-activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      // Also invalidate team activities if in team view
      if (selectedTeamId) {
        queryClient.invalidateQueries({ 
          predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "/api/teams" && query.queryKey[2] === "activities"
        });
      }
      setIsActivityDialogOpen(false);
      setActivityFormData({
        title: "",
        description: "",
        activityType: "other",
        startTime: "",
        endTime: "",
        location: "",
        meetingUrl: "",
      });
      toast({
        title: "Actividad creada",
        description: "La actividad se ha registrado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la actividad",
        variant: "destructive",
      });
    },
  });

  const handleCreateActivity = () => {
    if (!activityFormData.title.trim()) {
      toast({ title: "Error", description: "El título es obligatorio", variant: "destructive" });
      return;
    }
    if (!selectedDate) {
      toast({ title: "Error", description: "Selecciona una fecha", variant: "destructive" });
      return;
    }
    
    // Use selected committee, or team's committee if in team view
    const committeeToUse = selectedCommittee || selectedTeamData?.committeeId;
    if (!committeeToUse) {
      toast({ title: "Error", description: "Selecciona un comité", variant: "destructive" });
      return;
    }

    createActivityMutation.mutate({
      ...activityFormData,
      committeeId: committeeToUse,
      activityDate: format(selectedDate, "yyyy-MM-dd"),
      teamId: selectedTeamId || null,
    });
  };

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
    if (!displayActivities) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return displayActivities.filter((a) => a.activityDate === dateStr);
  };

  const handleDayClick = (day: Date) => {
    if (!selectedCommittee && !selectedTeamId) {
      toast({
        title: "Selecciona un comité o equipo",
        description: "Primero debes seleccionar un comité o un equipo",
        variant: "destructive",
      });
      return;
    }
    setSelectedDate(day);
    setSelectedShift("morning");
    setIsDayDetailOpen(true);
  };

  const handleRegisterShift = () => {
    setIsDayDetailOpen(false);
    setIsDialogOpen(true);
  };

  const uniqueUsers = useMemo(() => {
    const users = new Map<string, string>();
    calendarAttendances?.forEach((a) => {
      if (!users.has(a.userId)) {
        users.set(a.userId, a.userName);
      }
    });
    displayActivities?.forEach((a) => {
      if (a.userName && !users.has(a.userId)) {
        users.set(a.userId, a.userName);
      }
    });
    return Array.from(users.entries()).map(([id, name]) => ({ id, name }));
  }, [calendarAttendances, displayActivities]);

  const getFilteredActivitiesForDate = (date: Date): CalendarActivity[] => {
    let activities = getActivitiesForDate(date);
    if (filterUser !== "all") {
      activities = activities.filter((a) => a.userId === filterUser);
    }
    if (filterActivityType !== "all") {
      activities = activities.filter((a) => a.activityType === filterActivityType);
    }
    return activities;
  };

  const getFilteredMembersForDate = (date: Date, shift: string) => {
    let members = getMembersForDate(date, shift);
    if (filterUser !== "all") {
      members = members.filter((m) => m.userId === filterUser);
    }
    return members;
  };

  const getFilteredMembersForDateBoth = (date: Date) => {
    return {
      morning: getFilteredMembersForDate(date, "morning"),
      afternoon: getFilteredMembersForDate(date, "afternoon"),
    };
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
            {selectedTeamId && selectedTeamData
              ? `Calendario de ${selectedTeamData.name}`
              : selectedCommitteeData?.usesShifts !== false 
                ? "Registrar Turno" 
                : "Calendario de Actividades"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {selectedTeamId 
              ? "Actividades de tu equipo de consejería"
              : selectedCommitteeData?.usesShifts !== false 
                ? "Selecciona una fecha para registrar tu turno"
                : "Consulta las actividades programadas"}
          </p>
        </div>

        {selectedTeamId ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              Equipo: {selectedTeamData?.name || "Cargando..."}
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedTeamId("")}
              data-testid="button-exit-team-view"
            >
              <X className="h-4 w-4 mr-1" />
              Salir de vista de equipo
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
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
          
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="touch-manipulation"
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4 mr-1" />
            Filtros
            {(filterUser !== "all" || filterActivityType !== "all") && (
              <Badge variant="secondary" className="ml-1">{(filterUser !== "all" ? 1 : 0) + (filterActivityType !== "all" ? 1 : 0)}</Badge>
            )}
          </Button>
          </div>
        )}

        {showFilters && !selectedTeamId && (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-user">
                  <SelectValue placeholder="Filtrar por usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {uniqueUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Select value={filterActivityType} onValueChange={setFilterActivityType}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-activity-type">
                  <SelectValue placeholder="Tipo de actividad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las actividades</SelectItem>
                  {Object.entries(activityTypeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(filterUser !== "all" || filterActivityType !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterUser("all");
                  setFilterActivityType("all");
                }}
                className="touch-manipulation"
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        )}
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
                    {getFilteredMembersForDate(currentDate, "morning").length > 0 ? (
                      <div className="space-y-1 sm:space-y-2">
                        {getFilteredMembersForDate(currentDate, "morning").map((m) => (
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
                    {getFilteredMembersForDate(currentDate, "afternoon").length > 0 ? (
                      <div className="space-y-1 sm:space-y-2">
                        {getFilteredMembersForDate(currentDate, "afternoon").map((m) => (
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
                  {getFilteredActivitiesForDate(currentDate).length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-sm sm:text-base mb-2 flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />
                        Actividades del día
                      </h4>
                      <div className="space-y-2">
                        {getFilteredActivitiesForDate(currentDate).map((activity) => {
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
                  const members = getFilteredMembersForDateBoth(day);
                  const activities = getFilteredActivitiesForDate(day);
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
                  const members = getFilteredMembersForDateBoth(day);
                  const activities = getFilteredActivitiesForDate(day);
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

      {/* Day Detail Dialog */}
      <Dialog open={isDayDetailOpen} onOpenChange={setIsDayDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Detalle del Día
            </DialogTitle>
            <DialogDescription>
              {selectedDate && format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es })}
            </DialogDescription>
          </DialogHeader>

          {selectedDate && (
            <Tabs defaultValue={selectedCommitteeData?.usesShifts !== false ? "shifts" : "activities"} className="flex-1 overflow-hidden flex flex-col">
              <TabsList className={`grid w-full ${selectedCommitteeData?.usesShifts !== false ? "grid-cols-2" : "grid-cols-1"}`}>
                {selectedCommitteeData?.usesShifts !== false && (
                  <TabsTrigger value="shifts" data-testid="tab-shifts">
                    <Clock className="h-4 w-4 mr-1" />
                    Turnos
                  </TabsTrigger>
                )}
                <TabsTrigger value="activities" data-testid="tab-activities">
                  <CalendarDays className="h-4 w-4 mr-1" />
                  Actividades
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="shifts" className="flex-1 overflow-y-auto space-y-4 mt-4">
                {/* Morning Shift */}
                <div className={`p-4 rounded-md ${hasAttendanceOnDate(selectedDate).morning ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Sun className="h-5 w-5" />
                    <span className="font-semibold">Turno Mañana</span>
                    {selectedCommitteeData && (
                      <span className="text-sm text-muted-foreground">
                        ({selectedCommitteeData.morningStart} - {selectedCommitteeData.morningEnd})
                      </span>
                    )}
                  </div>
                  {getFilteredMembersForDate(selectedDate, "morning").length > 0 ? (
                    <div className="space-y-2">
                      {getFilteredMembersForDate(selectedDate, "morning").map((m) => (
                        <div key={m.id} className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4" />
                          <span>{m.userName}</span>
                          {m.userId === user?.id && <Badge variant="secondary">Tú</Badge>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin registros</p>
                  )}
                  <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
                    {hasAttendanceOnDate(selectedDate).morning ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const attendance = getAttendanceForDate(selectedDate, "morning");
                          if (attendance) {
                            cancelAttendanceMutation.mutate(attendance.id);
                          }
                        }}
                        disabled={cancelAttendanceMutation.isPending}
                        data-testid="button-cancel-morning-shift"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancelar mi turno
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedShift("morning");
                          markAttendanceMutation.mutate({
                            date: format(selectedDate, "yyyy-MM-dd"),
                            shift: "morning",
                            committeeId: selectedCommittee,
                          });
                        }}
                        disabled={markAttendanceMutation.isPending}
                        data-testid="button-register-morning-shift"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Registrarme en este turno
                      </Button>
                    )}
                  </div>
                </div>

                {/* Afternoon Shift */}
                <div className={`p-4 rounded-md ${hasAttendanceOnDate(selectedDate).afternoon ? "bg-green-100 dark:bg-green-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Sunset className="h-5 w-5" />
                    <span className="font-semibold">Turno Tarde</span>
                    {selectedCommitteeData && (
                      <span className="text-sm text-muted-foreground">
                        ({selectedCommitteeData.afternoonStart} - {selectedCommitteeData.afternoonEnd})
                      </span>
                    )}
                  </div>
                  {getFilteredMembersForDate(selectedDate, "afternoon").length > 0 ? (
                    <div className="space-y-2">
                      {getFilteredMembersForDate(selectedDate, "afternoon").map((m) => (
                        <div key={m.id} className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4" />
                          <span>{m.userName}</span>
                          {m.userId === user?.id && <Badge variant="secondary">Tú</Badge>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin registros</p>
                  )}
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                    {hasAttendanceOnDate(selectedDate).afternoon ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const attendance = getAttendanceForDate(selectedDate, "afternoon");
                          if (attendance) {
                            cancelAttendanceMutation.mutate(attendance.id);
                          }
                        }}
                        disabled={cancelAttendanceMutation.isPending}
                        data-testid="button-cancel-afternoon-shift"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancelar mi turno
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedShift("afternoon");
                          markAttendanceMutation.mutate({
                            date: format(selectedDate, "yyyy-MM-dd"),
                            shift: "afternoon",
                            committeeId: selectedCommittee,
                          });
                        }}
                        disabled={markAttendanceMutation.isPending}
                        data-testid="button-register-afternoon-shift"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Registrarme en este turno
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activities" className="flex-1 overflow-y-auto space-y-2 mt-4">
                {getFilteredActivitiesForDate(selectedDate).length > 0 ? (
                  getFilteredActivitiesForDate(selectedDate).map((activity) => {
                    const config = activityTypeConfig[activity.activityType] || activityTypeConfig.other;
                    const ActivityIcon = config.icon;
                    const isExpanded = expandedActivityId === activity.id;
                    return (
                      <div 
                        key={activity.id} 
                        className={`rounded-md ${config.color} cursor-pointer transition-all duration-200`}
                        onClick={() => setExpandedActivityId(isExpanded ? null : activity.id)}
                        data-testid={`activity-card-${activity.id}`}
                      >
                        <div className="p-3 flex items-center gap-2">
                          <ActivityIcon className="h-4 w-4 flex-shrink-0" />
                          <span className="font-medium text-sm flex-1 truncate">{activity.title}</span>
                          {activity.meetingUrl && (
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          )}
                          {activity.startTime && (
                            <span className="text-xs opacity-75">{activity.startTime}</span>
                          )}
                          <Badge variant="outline" className="text-xs">{config.label}</Badge>
                          <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0 border-t border-current/10">
                            {activity.description && (
                              <p className="text-sm mb-2 opacity-90 mt-2">{activity.description}</p>
                            )}
                            <div className="flex flex-wrap gap-3 text-xs opacity-75 mt-2">
                              {activity.startTime && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {activity.startTime}
                                  {activity.endTime && ` - ${activity.endTime}`}
                                </div>
                              )}
                              {activity.userName && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {activity.userName}
                                </div>
                              )}
                              {activity.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {activity.location}
                                </div>
                              )}
                            </div>
                            {activity.notes && (
                              <div className="mt-3 pt-3 border-t border-current/20">
                                <p className="text-xs font-medium mb-1">Notas:</p>
                                <p className="text-sm opacity-90 whitespace-pre-wrap">{activity.notes}</p>
                              </div>
                            )}
                            {activity.meetingUrl && (
                              <div className="mt-3 pt-3 border-t border-current/20">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                >
                                  <a
                                    href={ensureAbsoluteUrl(activity.meetingUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`link-meeting-${activity.id}`}
                                  >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Abrir enlace
                                  </a>
                                </Button>
                              </div>
                            )}
                            
                            {/* Activity Attendance Section */}
                            <div className="mt-3 pt-3 border-t border-current/20" onClick={(e) => e.stopPropagation()}>
                              <p className="text-xs font-medium mb-2">Asistencia:</p>
                              
                              {activityAttendancesLoading ? (
                                <p className="text-xs opacity-75">Cargando...</p>
                              ) : (
                                <>
                                  {activityAttendances && activityAttendances.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {activityAttendances.map((att) => (
                                        <Badge 
                                          key={att.id} 
                                          variant="secondary" 
                                          className="text-xs"
                                        >
                                          {att.user?.firstName || att.user?.email || "Usuario"}
                                          {att.status === "confirmed" && (
                                            <Check className="h-3 w-3 ml-1 text-green-600" />
                                          )}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs opacity-75 mb-2">Nadie registrado aún</p>
                                  )}
                                  
                                  {(() => {
                                    const myAttendance = activityAttendances?.find(a => a.userId === user?.id);
                                    if (myAttendance) {
                                      return (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => cancelActivityAttendanceMutation.mutate(myAttendance.id)}
                                          disabled={cancelActivityAttendanceMutation.isPending}
                                          data-testid={`button-cancel-activity-attendance-${activity.id}`}
                                        >
                                          <X className="h-4 w-4 mr-2" />
                                          Cancelar mi asistencia
                                        </Button>
                                      );
                                    } else {
                                      return (
                                        <Button
                                          variant="default"
                                          size="sm"
                                          onClick={() => registerForActivityMutation.mutate(activity.id)}
                                          disabled={registerForActivityMutation.isPending}
                                          data-testid={`button-register-activity-attendance-${activity.id}`}
                                        >
                                          <Check className="h-4 w-4 mr-2" />
                                          Registrar mi asistencia
                                        </Button>
                                      );
                                    }
                                  })()}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No hay actividades para este día</p>
                  </div>
                )}
                <div className="pt-4 border-t">
                  <Button
                    onClick={() => setIsActivityDialogOpen(true)}
                    className="w-full"
                    data-testid="button-add-activity-from-calendar"
                  >
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Agregar Actividad
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDayDetailOpen(false)}
              data-testid="button-close-day-detail"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Registration Dialog */}
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

      {/* Activity Creation Dialog */}
      <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Nueva Actividad
            </DialogTitle>
            <DialogDescription>
              {selectedDate && format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="activity-title">Título *</Label>
              <Input
                id="activity-title"
                placeholder="Título de la actividad"
                value={activityFormData.title}
                onChange={(e) => setActivityFormData({ ...activityFormData, title: e.target.value })}
                data-testid="input-activity-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-type">Tipo de actividad</Label>
              <Select
                value={activityFormData.activityType}
                onValueChange={(val) => setActivityFormData({ ...activityFormData, activityType: val })}
              >
                <SelectTrigger data-testid="select-activity-type">
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(activityTypeConfig).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="activity-start-time">Hora inicio</Label>
                <Input
                  id="activity-start-time"
                  type="time"
                  value={activityFormData.startTime}
                  onChange={(e) => setActivityFormData({ ...activityFormData, startTime: e.target.value })}
                  data-testid="input-activity-start-time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity-end-time">Hora fin</Label>
                <Input
                  id="activity-end-time"
                  type="time"
                  value={activityFormData.endTime}
                  onChange={(e) => setActivityFormData({ ...activityFormData, endTime: e.target.value })}
                  data-testid="input-activity-end-time"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-location">Ubicación</Label>
              <Input
                id="activity-location"
                placeholder="Lugar de la actividad"
                value={activityFormData.location}
                onChange={(e) => setActivityFormData({ ...activityFormData, location: e.target.value })}
                data-testid="input-activity-location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-meeting-url">Enlace de reunión</Label>
              <Input
                id="activity-meeting-url"
                placeholder="https://meet.google.com/..."
                value={activityFormData.meetingUrl}
                onChange={(e) => setActivityFormData({ ...activityFormData, meetingUrl: e.target.value })}
                data-testid="input-activity-meeting-url"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-description">Descripción</Label>
              <Textarea
                id="activity-description"
                placeholder="Descripción de la actividad"
                value={activityFormData.description}
                onChange={(e) => setActivityFormData({ ...activityFormData, description: e.target.value })}
                rows={3}
                data-testid="input-activity-description"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsActivityDialogOpen(false)}
              data-testid="button-cancel-activity-dialog"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateActivity}
              disabled={createActivityMutation.isPending}
              data-testid="button-save-activity"
            >
              {createActivityMutation.isPending ? "Guardando..." : "Guardar Actividad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

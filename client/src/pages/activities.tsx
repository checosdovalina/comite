import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Edit,
  Trash2,
  CheckCircle,
  Circle,
  Users,
  FileText,
  GraduationCap,
  CalendarDays,
  MoreHorizontal,
  Eye,
  EyeOff,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Committee, MemberActivity } from "@shared/schema";

const activityTypes = [
  { value: "meeting", label: "Reunión", icon: Users },
  { value: "visit", label: "Visita", icon: MapPin },
  { value: "report", label: "Reporte", icon: FileText },
  { value: "training", label: "Capacitación", icon: GraduationCap },
  { value: "event", label: "Evento", icon: CalendarDays },
  { value: "other", label: "Otro", icon: MoreHorizontal },
];

export default function ActivitiesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCommittee, setSelectedCommittee] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<MemberActivity | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    activityType: "other",
    activityDate: format(new Date(), "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
    location: "",
    notes: "",
  });

  const startDate = format(startOfMonth(currentDate), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentDate), "yyyy-MM-dd");

  const { data: committees, isLoading: committeesLoading } = useQuery<Committee[]>({
    queryKey: ["/api/committees"],
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<(MemberActivity & { committee?: Committee })[]>({
    queryKey: ["/api/activities", startDate, endDate],
    queryFn: () => fetch(`/api/activities?startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/activities", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Actividad registrada", description: "La actividad se ha guardado correctamente." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo guardar la actividad.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/activities/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      setIsDialogOpen(false);
      setEditingActivity(null);
      resetForm();
      toast({ title: "Actividad actualizada", description: "Los cambios se han guardado." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la actividad.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/activities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({ title: "Actividad eliminada", description: "La actividad se ha eliminado correctamente." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar la actividad.", variant: "destructive" });
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) =>
      apiRequest("PATCH", `/api/activities/${id}`, { isCompleted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ id, isVisibleOnCalendar }: { id: string; isVisibleOnCalendar: boolean }) =>
      apiRequest("PATCH", `/api/activities/${id}`, { isVisibleOnCalendar }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/committees"] });
      toast({
        title: variables.isVisibleOnCalendar ? "Visible en calendario" : "Oculto del calendario",
        description: variables.isVisibleOnCalendar
          ? "Esta actividad ahora aparecerá en el calendario"
          : "Esta actividad ya no aparecerá en el calendario",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      activityType: "other",
      activityDate: format(new Date(), "yyyy-MM-dd"),
      startTime: "",
      endTime: "",
      location: "",
      notes: "",
    });
  };

  const handleOpenDialog = (activity?: MemberActivity) => {
    if (activity) {
      setEditingActivity(activity);
      setFormData({
        title: activity.title,
        description: activity.description || "",
        activityType: activity.activityType,
        activityDate: activity.activityDate,
        startTime: activity.startTime || "",
        endTime: activity.endTime || "",
        location: activity.location || "",
        notes: activity.notes || "",
      });
      setSelectedCommittee(activity.committeeId);
    } else {
      setEditingActivity(null);
      resetForm();
      if (committees && committees.length > 0 && !selectedCommittee) {
        setSelectedCommittee(committees[0].id);
      }
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast({ title: "Error", description: "El título es obligatorio.", variant: "destructive" });
      return;
    }
    if (!selectedCommittee) {
      toast({ title: "Error", description: "Selecciona un comité.", variant: "destructive" });
      return;
    }

    const payload = {
      ...formData,
      committeeId: selectedCommittee,
    };

    if (editingActivity) {
      updateMutation.mutate({ id: editingActivity.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getActivityTypeInfo = (type: string) => {
    return activityTypes.find((t) => t.value === type) || activityTypes[5];
  };

  const filteredActivities = activities?.filter(
    (a) => !selectedCommittee || a.committeeId === selectedCommittee
  );

  const groupedActivities = filteredActivities?.reduce((acc, activity) => {
    const date = activity.activityDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, typeof filteredActivities>);

  const sortedDates = Object.keys(groupedActivities || {}).sort();

  if (committeesLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">
            Mis Actividades
          </h1>
          <p className="text-sm text-muted-foreground">
            Registra y gestiona tus actividades del comité
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedCommittee} onValueChange={setSelectedCommittee}>
            <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-committee">
              <SelectValue placeholder="Todos los comités" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los comités</SelectItem>
              {committees?.map((committee) => (
                <SelectItem key={committee.id} value={committee.id}>
                  {committee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => handleOpenDialog()} className="touch-manipulation" data-testid="button-add-activity">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Actividad
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-3 sm:p-6 pb-2">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="h-10 w-10 touch-manipulation"
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="text-base sm:text-lg capitalize">
              {format(currentDate, "MMMM yyyy", { locale: es })}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="h-10 w-10 touch-manipulation"
              data-testid="button-next-month"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
          {activitiesLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : sortedDates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay actividades este mes</p>
              <Button
                variant="outline"
                className="mt-4 touch-manipulation"
                onClick={() => handleOpenDialog()}
                data-testid="button-add-first-activity"
              >
                <Plus className="h-4 w-4 mr-2" />
                Registrar primera actividad
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDates.map((date) => (
                <div key={date} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground sticky top-0 bg-background py-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(date + "T12:00:00"), "EEEE, d 'de' MMMM", { locale: es })}
                  </div>
                  <div className="space-y-2 pl-0 sm:pl-6">
                    {groupedActivities![date]!.map((activity) => {
                      const typeInfo = getActivityTypeInfo(activity.activityType);
                      const TypeIcon = typeInfo.icon;

                      return (
                        <div
                          key={activity.id}
                          className={`rounded-md border p-3 transition-colors touch-manipulation ${
                            activity.isCompleted ? "bg-muted/50" : "hover:bg-muted/30 active:bg-muted/50"
                          }`}
                          data-testid={`activity-${activity.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() =>
                                toggleCompleteMutation.mutate({
                                  id: activity.id,
                                  isCompleted: !activity.isCompleted,
                                })
                              }
                              className="mt-0.5 touch-manipulation"
                              data-testid={`button-toggle-${activity.id}`}
                            >
                              {activity.isCompleted ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3
                                    className={`font-medium text-sm sm:text-base ${
                                      activity.isCompleted ? "line-through text-muted-foreground" : ""
                                    }`}
                                  >
                                    {activity.title}
                                  </h3>
                                  {activity.description && (
                                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
                                      {activity.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          toggleVisibilityMutation.mutate({
                                            id: activity.id,
                                            isVisibleOnCalendar: !activity.isVisibleOnCalendar,
                                          })
                                        }
                                        className={`h-8 w-8 touch-manipulation ${
                                          activity.isVisibleOnCalendar ? "text-primary" : "text-muted-foreground"
                                        }`}
                                        data-testid={`button-visibility-${activity.id}`}
                                      >
                                        {activity.isVisibleOnCalendar ? (
                                          <Eye className="h-4 w-4" />
                                        ) : (
                                          <EyeOff className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {activity.isVisibleOnCalendar
                                        ? "Visible en calendario (click para ocultar)"
                                        : "Oculto del calendario (click para mostrar)"}
                                    </TooltipContent>
                                  </Tooltip>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenDialog(activity)}
                                    className="h-8 w-8 touch-manipulation"
                                    data-testid={`button-edit-${activity.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteMutation.mutate(activity.id)}
                                    className="h-8 w-8 text-destructive touch-manipulation"
                                    data-testid={`button-delete-${activity.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <Badge variant="secondary" className="text-xs">
                                  <TypeIcon className="h-3 w-3 mr-1" />
                                  {typeInfo.label}
                                </Badge>
                                {activity.startTime && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {activity.startTime}
                                    {activity.endTime && ` - ${activity.endTime}`}
                                  </span>
                                )}
                                {activity.location && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {activity.location}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingActivity ? "Editar Actividad" : "Nueva Actividad"}
            </DialogTitle>
            <DialogDescription>
              {editingActivity
                ? "Modifica los datos de la actividad"
                : "Registra una nueva actividad en tu calendario"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="committee">Comité</Label>
              <Select
                value={selectedCommittee}
                onValueChange={setSelectedCommittee}
                disabled={!!editingActivity}
              >
                <SelectTrigger data-testid="dialog-select-committee">
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

            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Nombre de la actividad"
                data-testid="input-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activityType">Tipo de Actividad</Label>
              <Select
                value={formData.activityType}
                onValueChange={(value) => setFormData({ ...formData, activityType: value })}
              >
                <SelectTrigger data-testid="select-activity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activityTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activityDate">Fecha *</Label>
              <Input
                id="activityDate"
                type="date"
                value={formData.activityDate}
                onChange={(e) => setFormData({ ...formData, activityDate: e.target.value })}
                data-testid="input-date"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startTime">Hora Inicio</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  data-testid="input-start-time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Hora Fin</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  data-testid="input-end-time"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Lugar de la actividad"
                data-testid="input-location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalles de la actividad"
                rows={3}
                data-testid="input-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales"
                rows={2}
                data-testid="input-notes"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Guardando..."
                : editingActivity
                ? "Actualizar"
                : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

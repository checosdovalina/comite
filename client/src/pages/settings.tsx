import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme-provider";
import { usePWA } from "@/hooks/use-pwa";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Bell,
  Moon,
  Sun,
  Monitor,
  Globe,
  Shield,
  Smartphone,
  Download,
  BellRing,
  Check,
  Clock,
  Loader2,
  Save,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { 
    isInstallable, 
    isInstalled, 
    isPushSubscribed,
    promptInstall, 
    notificationPermission, 
    subscribeToPush,
    unsubscribeFromPush,
    testPushNotification,
  } = usePWA();
  const { toast } = useToast();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    shiftReminders: true,
    calendarChanges: true,
    activityReminders: true,
    reminderTimes: [60] as number[],
  });

  // Fetch notification preferences
  const { data: preferences, isLoading: isLoadingPrefs } = useQuery<{
    shiftReminders: boolean;
    activityReminders: boolean;
    reminderMinutesBefore: number;
    pushEnabled: boolean;
  }>({
    queryKey: ["/api/notification-preferences"],
  });

  // Update local state when preferences are loaded
  useEffect(() => {
    if (preferences) {
      setNotificationSettings(prev => ({
        ...prev,
        shiftReminders: preferences.shiftReminders,
        activityReminders: preferences.activityReminders,
        reminderTimes: [preferences.reminderMinutesBefore || 60],
      }));
      setHasChanges(false);
    }
  }, [preferences]);

  // Save preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async (data: {
      shiftReminders: boolean;
      activityReminders: boolean;
      reminderMinutesBefore: number;
    }) => {
      return apiRequest("PUT", "/api/notification-preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
      toast({ title: "Preferencias guardadas", description: "Tus preferencias de notificación han sido actualizadas." });
      setHasChanges(false);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudieron guardar las preferencias.", variant: "destructive" });
    },
  });

  const handleSavePreferences = () => {
    savePreferencesMutation.mutate({
      shiftReminders: notificationSettings.shiftReminders,
      activityReminders: notificationSettings.activityReminders,
      reminderMinutesBefore: notificationSettings.reminderTimes[0] || 60,
    });
  };

  const updateSetting = <K extends keyof typeof notificationSettings>(
    key: K,
    value: typeof notificationSettings[K]
  ) => {
    setNotificationSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      toast({ title: "App instalada", description: "La aplicación se ha instalado correctamente." });
    }
  };

  const handleSubscribePush = async () => {
    setIsSubscribing(true);
    try {
      const success = await subscribeToPush();
      if (success) {
        toast({ title: "Notificaciones activadas", description: "Recibirás alertas de tus turnos y actividades." });
      } else if (notificationPermission === "denied") {
        toast({
          title: "Notificaciones bloqueadas",
          description: "Habilita las notificaciones en la configuración de tu navegador.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleUnsubscribePush = async () => {
    setIsSubscribing(true);
    try {
      await unsubscribeFromPush();
      toast({ title: "Notificaciones desactivadas", description: "Ya no recibirás alertas push." });
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleTestPush = async () => {
    setIsTesting(true);
    try {
      const success = await testPushNotification();
      if (success) {
        toast({ title: "Prueba enviada", description: "Deberías recibir una notificación en unos segundos." });
      } else {
        toast({ title: "Error", description: "No se pudo enviar la notificación de prueba.", variant: "destructive" });
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Configuración
        </h1>
        <p className="text-muted-foreground">
          Personaliza tu experiencia en la plataforma
        </p>
      </div>

      <div className="grid gap-6">
        <Card className={isInstalled ? "border-green-500/30 bg-green-500/5" : isInstallable ? "border-primary/30" : ""}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              <CardTitle>Aplicación Móvil</CardTitle>
            </div>
            <CardDescription>
              Instala la app en tu dispositivo para acceso rápido
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInstalled ? (
              <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                <Check className="h-5 w-5" />
                <div>
                  <p className="font-medium">Aplicación instalada</p>
                  <p className="text-sm text-muted-foreground">
                    Ya tienes la app instalada en tu dispositivo
                  </p>
                </div>
              </div>
            ) : isInstallable ? (
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>Instalar aplicación</Label>
                  <p className="text-sm text-muted-foreground">
                    Accede más rápido desde tu pantalla de inicio
                  </p>
                </div>
                <Button onClick={handleInstall} className="touch-manipulation" data-testid="button-install-app">
                  <Download className="h-4 w-4 mr-2" />
                  Instalar
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p>Abre esta página en Chrome o Safari en tu dispositivo móvil para poder instalar la aplicación.</p>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Notificaciones push</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe alertas en tu dispositivo
                </p>
              </div>
              {isPushSubscribed ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
                    <Check className="h-3 w-3 mr-1" />
                    Activadas
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleUnsubscribePush}
                    disabled={isSubscribing}
                    data-testid="button-disable-push"
                  >
                    Desactivar
                  </Button>
                </div>
              ) : notificationPermission === "denied" ? (
                <Badge variant="destructive">Bloqueadas</Badge>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={handleSubscribePush} 
                  disabled={isSubscribing}
                  className="touch-manipulation" 
                  data-testid="button-enable-push"
                >
                  <BellRing className="h-4 w-4 mr-2" />
                  {isSubscribing ? "Activando..." : "Activar"}
                </Button>
              )}
            </div>
            {isPushSubscribed && (
              <>
                <Separator />
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label>Probar notificaciones</Label>
                    <p className="text-sm text-muted-foreground">
                      Envía una notificación de prueba a tu dispositivo
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleTestPush}
                    disabled={isTesting}
                    className="touch-manipulation"
                    data-testid="button-test-push"
                  >
                    {isTesting ? "Enviando..." : "Enviar prueba"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              <CardTitle>Apariencia</CardTitle>
            </div>
            <CardDescription>
              Configura el tema y la apariencia de la aplicación
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Tema de la aplicación</Label>
                <p className="text-sm text-muted-foreground">
                  Selecciona el tema que prefieras
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("light")}
                  data-testid="button-theme-light"
                >
                  <Sun className="mr-2 h-4 w-4" />
                  Claro
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("dark")}
                  data-testid="button-theme-dark"
                >
                  <Moon className="mr-2 h-4 w-4" />
                  Oscuro
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("system")}
                  data-testid="button-theme-system"
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  Sistema
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <CardTitle>Notificaciones</CardTitle>
              </div>
              {hasChanges && (
                <Button 
                  onClick={handleSavePreferences}
                  disabled={savePreferencesMutation.isPending}
                  size="sm"
                  data-testid="button-save-preferences"
                >
                  {savePreferencesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar
                </Button>
              )}
            </div>
            <CardDescription>
              Configura cómo y cuándo recibir notificaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoadingPrefs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Recordatorios de turnos</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe un recordatorio antes de tus turnos programados
                    </p>
                  </div>
                  <Switch 
                    checked={notificationSettings.shiftReminders}
                    onCheckedChange={(checked) => updateSetting("shiftReminders", checked)}
                    data-testid="switch-shift-reminders" 
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Recordatorios de actividades</Label>
                    <p className="text-sm text-muted-foreground">
                      Alertas para tus actividades programadas
                    </p>
                  </div>
                  <Switch 
                    checked={notificationSettings.activityReminders}
                    onCheckedChange={(checked) => updateSetting("activityReminders", checked)}
                    data-testid="switch-activity-reminders" 
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Label>Tiempo de anticipación</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Selecciona cuándo recibir el recordatorio antes del evento
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { value: 5, label: "5 min" },
                      { value: 15, label: "15 min" },
                      { value: 30, label: "30 min" },
                      { value: 60, label: "1 hora" },
                      { value: 120, label: "2 horas" },
                      { value: 1440, label: "1 día" },
                    ].map((option) => (
                      <Button
                        key={option.value}
                        variant={notificationSettings.reminderTimes.includes(option.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateSetting("reminderTimes", [option.value])}
                        data-testid={`button-reminder-${option.value}`}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <CardTitle>Idioma y Región</CardTitle>
            </div>
            <CardDescription>
              Configuración de idioma y formato de fechas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Idioma</Label>
                <p className="text-sm text-muted-foreground">
                  Idioma de la interfaz
                </p>
              </div>
              <Badge variant="outline">Español (MX)</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Zona horaria</Label>
                <p className="text-sm text-muted-foreground">
                  Para cálculos de horarios
                </p>
              </div>
              <Badge variant="outline">America/Mexico_City</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Seguridad</CardTitle>
            </div>
            <CardDescription>
              Opciones de seguridad de tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Sesiones activas</Label>
                <p className="text-sm text-muted-foreground">
                  Dispositivos donde has iniciado sesión
                </p>
              </div>
              <Button variant="outline" size="sm" data-testid="button-manage-sessions">
                Administrar
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Autenticación</Label>
                <p className="text-sm text-muted-foreground">
                  Conectado a través de Replit
                </p>
              </div>
              <Badge>Replit Auth</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

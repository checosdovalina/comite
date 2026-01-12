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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { isInstallable, isInstalled, promptInstall, notificationPermission, requestNotificationPermission } = usePWA();
  const { toast } = useToast();

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    shiftReminders: true,
    calendarChanges: true,
    activityReminders: true,
    reminderMinutesBefore: 60,
  });

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      toast({ title: "App instalada", description: "La aplicación se ha instalado correctamente." });
    }
  };

  const handleEnableNotifications = async () => {
    const permission = await requestNotificationPermission();
    if (permission === "granted") {
      toast({ title: "Notificaciones activadas", description: "Recibirás alertas de tus turnos y actividades." });
    } else if (permission === "denied") {
      toast({
        title: "Notificaciones bloqueadas",
        description: "Habilita las notificaciones en la configuración de tu navegador.",
        variant: "destructive",
      });
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
              {notificationPermission === "granted" ? (
                <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
                  <Check className="h-3 w-3 mr-1" />
                  Activadas
                </Badge>
              ) : notificationPermission === "denied" ? (
                <Badge variant="destructive">Bloqueadas</Badge>
              ) : (
                <Button variant="outline" onClick={handleEnableNotifications} className="touch-manipulation" data-testid="button-enable-push">
                  <BellRing className="h-4 w-4 mr-2" />
                  Activar
                </Button>
              )}
            </div>
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
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>Notificaciones</CardTitle>
            </div>
            <CardDescription>
              Configura cómo y cuándo recibir notificaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notificaciones por email</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe confirmaciones y recordatorios por correo
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-email-notifications" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Recordatorios de turnos</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe un recordatorio antes de tus turnos programados
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-reminders" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Cambios en el calendario</Label>
                <p className="text-sm text-muted-foreground">
                  Notificaciones cuando hay cambios en los turnos
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-calendar-changes" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Recordatorios de actividades</Label>
                <p className="text-sm text-muted-foreground">
                  Alertas para tus actividades programadas
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-activity-reminders" />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label>Tiempo de anticipación</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Recibe el recordatorio antes del evento
                </p>
              </div>
              <Select 
                value={notificationSettings.reminderMinutesBefore.toString()}
                onValueChange={(value) => setNotificationSettings(prev => ({ 
                  ...prev, 
                  reminderMinutesBefore: parseInt(value) 
                }))}
              >
                <SelectTrigger className="w-[140px]" data-testid="select-reminder-minutes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                  <SelectItem value="1440">1 día</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

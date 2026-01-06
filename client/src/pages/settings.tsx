import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import {
  Settings as SettingsIcon,
  Bell,
  Moon,
  Sun,
  Monitor,
  Globe,
  Shield,
} from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

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

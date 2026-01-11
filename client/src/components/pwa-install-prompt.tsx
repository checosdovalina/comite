import { useState, useEffect } from "react";
import { usePWA } from "@/hooks/use-pwa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, X, Bell, BellOff, Smartphone } from "lucide-react";

export function PWAInstallPrompt() {
  const { isInstallable, isInstalled, promptInstall, notificationPermission, requestNotificationPermission } = usePWA();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem("pwa-prompt-dismissed");
    if (wasDismissed) {
      setDismissed(true);
    }
    const timer = setTimeout(() => {
      if (isInstallable && !isInstalled && !wasDismissed) {
        setShowPrompt(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled]);

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("pwa-prompt-dismissed", "true");
  };

  const handleEnableNotifications = async () => {
    await requestNotificationPermission();
  };

  if (!showPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-in slide-in-from-bottom-4">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Instalar App</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mt-1 -mr-1"
            onClick={handleDismiss}
            data-testid="button-dismiss-pwa"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <CardDescription className="mb-3 text-sm">
            Instala Comités en tu dispositivo para acceso rápido y notificaciones de recordatorios.
          </CardDescription>
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleInstall}
              className="w-full touch-manipulation"
              data-testid="button-install-pwa"
            >
              <Download className="h-4 w-4 mr-2" />
              Instalar Ahora
            </Button>
            {notificationPermission === "default" && (
              <Button
                variant="outline"
                onClick={handleEnableNotifications}
                className="w-full touch-manipulation"
                data-testid="button-enable-notifications"
              >
                <Bell className="h-4 w-4 mr-2" />
                Activar Notificaciones
              </Button>
            )}
            {notificationPermission === "denied" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <BellOff className="h-3 w-3" />
                Notificaciones bloqueadas en configuración
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

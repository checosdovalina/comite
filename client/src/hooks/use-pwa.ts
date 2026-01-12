import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    const checkInstalled = () => {
      if (window.matchMedia("(display-mode: standalone)").matches) {
        setIsInstalled(true);
      }
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    checkInstalled();

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsInstallable(false);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied";

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    return permission;
  }, []);

  const subscribeToPush = useCallback(async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.error("Push notifications not supported");
        return false;
      }

      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission !== "granted") {
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const response = await fetch("/api/vapid-public-key");
      const { publicKey } = await response.json();
      
      if (!publicKey) {
        console.error("VAPID public key not available");
        return false;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const saveResponse = await fetch("/api/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      });

      if (saveResponse.ok) {
        setIsPushSubscribed(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      return false;
    }
  }, []);

  const unsubscribeFromPush = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }

      await fetch("/api/push-subscription", { method: "DELETE" });
      setIsPushSubscribed(false);
      return true;
    } catch (error) {
      console.error("Error unsubscribing from push:", error);
      return false;
    }
  }, []);

  const testPushNotification = useCallback(async () => {
    try {
      const response = await fetch("/api/test-push", { method: "POST" });
      return response.ok;
    } catch (error) {
      console.error("Error testing push:", error);
      return false;
    }
  }, []);

  useEffect(() => {
    const checkPushSubscription = async () => {
      if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsPushSubscribed(!!subscription);
        } catch (error) {
          console.error("Error checking push subscription:", error);
        }
      }
    };
    checkPushSubscription();
  }, []);

  const showNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (notificationPermission !== "granted") return null;
      return new Notification(title, options);
    },
    [notificationPermission]
  );

  return {
    isInstallable,
    isInstalled,
    isOnline,
    isPushSubscribed,
    notificationPermission,
    promptInstall,
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
    testPushNotification,
    showNotification,
  };
}

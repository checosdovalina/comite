const CACHE_NAME = 'comites-v2';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'Comités Distritales';
  const options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: data.icon || '/favicon.png',
    badge: data.badge || '/favicon.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    renotify: data.renotify || false,
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const notificationData = event.notification.data || {};
  const action = event.action;
  const notificationId = notificationData.notificationId;
  
  // Handle action buttons
  if (action && notificationId && notificationId !== 'test') {
    let apiUrl = '';
    let body = {};
    
    if (action === 'confirm') {
      apiUrl = `/api/notifications/${notificationId}/confirm`;
    } else if (action.startsWith('snooze-')) {
      const minutes = parseInt(action.split('-')[1]) || 15;
      apiUrl = `/api/notifications/${notificationId}/snooze`;
      body = { minutes };
    } else if (action === 'dismiss') {
      apiUrl = `/api/notifications/${notificationId}/dismiss`;
    }
    
    if (apiUrl) {
      event.waitUntil(
        fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include'
        })
        .then(response => {
          if (response.ok) {
            // Show appropriate confirmation message based on action type
            let title, messageBody;
            if (action === 'confirm') {
              title = 'Confirmado';
              messageBody = 'Tu asistencia ha sido confirmada';
            } else if (action.startsWith('snooze-')) {
              title = 'Pospuesto';
              messageBody = `Recordatorio pospuesto ${body.minutes || 15} minutos`;
            } else if (action === 'dismiss') {
              title = 'Descartado';
              messageBody = 'La notificación ha sido descartada';
            } else {
              return; // Unknown action, no confirmation needed
            }
            
            return self.registration.showNotification(title, {
              body: messageBody,
              icon: '/favicon.png',
              tag: 'action-confirmation',
              requireInteraction: false
            });
          }
        })
        .catch(err => console.error('Error handling notification action:', err))
      );
      return;
    }
  }
  
  // Default: open the app at the specified URL
  const urlToOpen = notificationData.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        return clients.openWindow(urlToOpen);
      })
  );
});

/* eslint-disable no-restricted-globals */
const DEFAULT_TITLE = 'น้อนอากิ้แจ้งเตือนนัดหมายค่ะ';
const DEFAULT_BODY = 'ถึงเวลานัดหมายที่คุณตั้งไว้แล้วนะคะน้า~';
const DEFAULT_ICON = '/aki-logo.svg';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: DEFAULT_TITLE,
    body: DEFAULT_BODY,
    url: '/',
    tag: 'nong-aki-schedule',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = {
          title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title : DEFAULT_TITLE,
          body: typeof parsed.body === 'string' && parsed.body.trim() ? parsed.body : DEFAULT_BODY,
          url: typeof parsed.url === 'string' && parsed.url.startsWith('/') ? parsed.url : '/',
          tag: typeof parsed.tag === 'string' && parsed.tag.trim() ? parsed.tag : 'nong-aki-schedule',
        };
      }
    } catch {
      const text = event.data.text();
      if (text && text.trim()) {
        payload.body = text.trim();
      }
    }
  }

  const options = {
    body: payload.body,
    icon: DEFAULT_ICON,
    badge: DEFAULT_ICON,
    tag: payload.tag,
    renotify: true,
    vibrate: [180, 90, 180],
    data: {
      url: payload.url,
    },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl =
    event.notification &&
    event.notification.data &&
    typeof event.notification.data.url === 'string'
      ? event.notification.data.url
      : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            return client.navigate(targetUrl).catch(() => client);
          }
          return client;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});

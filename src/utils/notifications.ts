/**
 * Plays a soft, warm cafe bell chime using Web Audio API without external audio dependencies.
 */
export function playGentleBell(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number, peakGain: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);

      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.05);
    };

    // Warm two-note cafe chime (C6 -> E6)
    playTone(1046.5, 0, 0.45, 0.08);
    playTone(1318.51, 0.14, 0.65, 0.07);

    setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 1000);
  } catch {
    // Ignore autoplay or Web Audio restrictions gracefully
  }
}

export type BrowserNotifSupport = 'supported' | 'unsupported';

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function sendBrowserNotification(title: string, body: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  // Prefer ServiceWorkerRegistration.showNotification so mobile Android/iOS PWAs work reliably
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const readyReg = reg ?? (await navigator.serviceWorker.ready);
      if (readyReg && typeof readyReg.showNotification === 'function') {
        await readyReg.showNotification(title, {
          body,
          icon: '/aki-logo.svg',
          badge: '/aki-logo.svg',
          tag: 'nong-aki-local',
        });
        return true;
      }
    }
  } catch {
    // Fallback to Notification constructor below on desktop browsers
  }

  try {
    new Notification(title, {
      body,
      icon: '/aki-logo.svg',
    });
    return true;
  } catch {
    return false;
  }
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isIosSafariWithoutStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIOS && !isStandalone;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return registration;
  } catch {
    return null;
  }
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;
  try {
    const registration =
      (await navigator.serviceWorker.getRegistration('/')) ?? (await registerServiceWorker());
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export interface SerializedPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}

export function serializePushSubscription(sub: PushSubscription): SerializedPushSubscription | null {
  const json = typeof sub.toJSON === 'function' ? sub.toJSON() : null;
  const p256dh =
    json?.keys?.p256dh || arrayBufferToBase64Url(sub.getKey('p256dh'));
  const auth =
    json?.keys?.auth || arrayBufferToBase64Url(sub.getKey('auth'));

  if (!sub.endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint: sub.endpoint,
    p256dh,
    auth,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 240) : '',
  };
}

export async function subscribeDeviceWebPush(): Promise<{
  subscription: SerializedPushSubscription | null;
  error?: string;
}> {
  if (!isWebPushSupported()) {
    if (isIosSafariWithoutStandalone()) {
      return {
        subscription: null,
        error:
          'สำหรับ iPhone/iPad กรุณากดปุ่ม Share แล้วเลือก "เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)" และเปิดจากไอคอนหน้าจอหลักก่อนเปิดรับแจ้งเตือนนะคะ',
      };
    }
    return {
      subscription: null,
      error: 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบ Web Push ค่ะ',
    };
  }

  const vapidPublicKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();
  if (!vapidPublicKey) {
    return {
      subscription: null,
      error:
        'ยังไม่ได้ตั้งค่า VITE_VAPID_PUBLIC_KEY ใน Environment Variables ค่ะ (สร้างคีย์ด้วยคำสั่ง npx web-push generate-vapid-keys แล้วใส่ใน .env / Vercel และ Supabase Secrets นะคะ)',
    };
  }

  const permission = await requestBrowserNotificationPermission();
  if (permission !== 'granted') {
    return {
      subscription: null,
      error: 'ยังไม่ได้รับสิทธิ์แจ้งเตือนจากเบราว์เซอร์ กรุณากดอนุญาต (Allow) เพื่อรับแจ้งเตือนนะคะ',
    };
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    return {
      subscription: null,
      error: 'ไม่สามารถลงทะเบียน Service Worker (/sw.js) ได้ค่ะ',
    };
  }

  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const serialized = serializePushSubscription(subscription);
  if (!serialized) {
    return {
      subscription: null,
      error: 'ไม่สามารถอ่านข้อมูลกุญแจ Push Subscription ของอุปกรณ์นี้ได้ค่ะ',
    };
  }

  return { subscription: serialized };
}

export async function unsubscribeDeviceWebPush(): Promise<string | null> {
  try {
    const existing = await getCurrentPushSubscription();
    if (!existing) return null;
    const endpoint = existing.endpoint;
    await existing.unsubscribe();
    return endpoint;
  } catch {
    return null;
  }
}

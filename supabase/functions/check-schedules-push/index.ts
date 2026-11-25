// Supabase Edge Function: check-schedules-push
// Checks public.schedules every minute (triggered by pg_cron) and sends Web Push notifications
// to subscribed devices even when the browser/PWA is closed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import webpush from 'npm:web-push@3.6.7';

interface ScheduleRow {
  id: string;
  user_id: string;
  title: string;
  event_time: string;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function formatThaiTimeFromIso(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const expectedCronSecret = Deno.env.get('CRON_SECRET') ?? '';
  if (expectedCronSecret) {
    const providedSecret = req.headers.get('x-cron-secret') ?? '';
    if (!constantTimeEquals(providedSecret, expectedCronSecret)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@nong-aki.app';

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return new Response(
      JSON.stringify({
        error: 'Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, or VAPID_PRIVATE_KEY',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 60 * 1000).toISOString();

  const { data: dueSchedules, error: schError } = await supabase
    .from('schedules')
    .select('id, user_id, title, event_time')
    .eq('is_completed', false)
    .is('push_notified_at', null)
    .gte('event_time', windowStart)
    .lte('event_time', windowEnd);

  if (schError) {
    return new Response(JSON.stringify({ error: schError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const schedules = (dueSchedules ?? []) as ScheduleRow[];
  if (schedules.length === 0) {
    return new Response(JSON.stringify({ checked: 0, sent: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userIds = Array.from(new Set(schedules.map((s) => s.user_id)));
  const { data: subsData, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (subError) {
    return new Response(JSON.stringify({ error: subError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const subsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const sub of (subsData ?? []) as PushSubscriptionRow[]) {
    const list = subsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subsByUser.set(sub.user_id, list);
  }

  let sentCount = 0;
  const staleSubscriptionIds: string[] = [];
  const notifiedScheduleIds: string[] = [];

  for (const sch of schedules) {
    const userSubs = subsByUser.get(sch.user_id) ?? [];
    if (userSubs.length === 0) {
      continue;
    }

    const timeLabel = formatThaiTimeFromIso(sch.event_time);
    const payload = JSON.stringify({
      title: timeLabel
        ? `น้อนอากิ้เตือนนัด · ${timeLabel} น.`
        : 'น้อนอากิ้แจ้งเตือนนัดหมายค่ะ',
      body: `${sch.title} (ถึงเวลานัดแล้วนะคะน้า~)`,
      url: '/',
      tag: `schedule-${sch.id}`,
      scheduleId: sch.id,
    });

    let deliveredAtLeastOne = false;

    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
        );
        sentCount += 1;
        deliveredAtLeastOne = true;
      } catch (pushErr: unknown) {
        const statusCode =
          pushErr && typeof pushErr === 'object' && 'statusCode' in pushErr
            ? Number((pushErr as { statusCode?: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          staleSubscriptionIds.push(sub.id);
        } else {
          console.error('Failed to send Web Push:', sub.id, pushErr);
        }
      }
    }

    if (deliveredAtLeastOne) {
      notifiedScheduleIds.push(sch.id);
    }
  }

  if (staleSubscriptionIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleSubscriptionIds);
  }

  if (notifiedScheduleIds.length > 0) {
    await supabase
      .from('schedules')
      .update({ push_notified_at: now.toISOString() })
      .in('id', notifiedScheduleIds);
  }

  return new Response(
    JSON.stringify({
      checked: schedules.length,
      sent: sentCount,
      markedNotified: notifiedScheduleIds.length,
      removedStaleSubscriptions: staleSubscriptionIds.length,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});

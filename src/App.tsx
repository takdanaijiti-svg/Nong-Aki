import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Bell,
  CalendarDays,
  Loader2,
  MessageCircle,
  Settings,
  StickyNote,
  Wallet,
  X,
} from 'lucide-react';
import { AkiLogo } from './components/AkiLogo';
import { AuthScreen } from './components/AuthScreen';
import { ChatPanel } from './components/ChatPanel';
import { EditItemModal } from './components/EditItemModal';
import { FinanceDashboard } from './components/FinanceDashboard';
import { NotesDashboard } from './components/NotesDashboard';
import { ScheduleDashboard } from './components/ScheduleDashboard';
import { SettingsModal } from './components/SettingsModal';
import { createWelcomeMessage, DEFAULT_SETTINGS } from './data/initialData';
import { supabase } from './lib/supabase';
import {
  clearAllUserDataDb,
  deleteNoteDb,
  deleteScheduleDb,
  deleteTransactionDb,
  fetchAllUserData,
  insertNotesDb,
  insertSchedulesDb,
  insertTransactionsDb,
  toggleScheduleCompletedDb,
  updateNoteDb,
  updateScheduleDb,
  updateTransactionDb,
  updateTransactionPaymentMethodDb,
} from './services/supabaseData';
import {
  AnalyzedResponse,
  AppSettings,
  ChatMessage,
  CreatedItemRef,
  DashboardContext,
  DashboardTab,
  EditTarget,
  MobileTab,
  NoteItem,
  PaymentMethod,
  ScheduleItem,
  ToastAlert,
  Transaction,
} from './types';
import {
  formatCurrency,
  generateId,
  getLocalDateString,
  getLocalTimeString,
  getThaiDayOfWeek,
} from './utils/dateFormat';
import { playGentleBell, sendBrowserNotification } from './utils/notifications';
import { sanitizeImageSrc, sanitizeSingleLine, sanitizeText } from './utils/sanitize';

const SETTINGS_KEY_PREFIX = 'nong_aki_settings_v1_';
const NOTIFIED_SCHEDULES_KEY = 'nong_aki_notified_schedules_v1';
const LAST_DAILY_SUMMARY_KEY = 'nong_aki_last_daily_summary_v1';

function loadUserSettings(userId: string): AppSettings {
  try {
    const raw = localStorage.getItem(`${SETTINGS_KEY_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        notificationsEnabled: Boolean(parsed.notificationsEnabled),
        soundEnabled:
          typeof parsed.soundEnabled === 'boolean'
            ? parsed.soundEnabled
            : DEFAULT_SETTINGS.soundEnabled,
        dailySummaryEnabled:
          typeof parsed.dailySummaryEnabled === 'boolean'
            ? parsed.dailySummaryEnabled
            : DEFAULT_SETTINGS.dailySummaryEnabled,
        dailySummaryTime:
          typeof parsed.dailySummaryTime === 'string' &&
          /^\d{2}:\d{2}$/.test(parsed.dailySummaryTime)
            ? parsed.dailySummaryTime
            : DEFAULT_SETTINGS.dailySummaryTime,
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_SETTINGS;
}

function saveUserSettings(userId: string, next: AppSettings): void {
  try {
    localStorage.setItem(`${SETTINGS_KEY_PREFIX}${userId}`, JSON.stringify(next));
  } catch {
    // Ignore storage write errors
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createWelcomeMessage()]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [desktopTab, setDesktopTab] = useState<DashboardTab>('finance');
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);

  const stateRef = useRef({
    transactions,
    schedules,
    settings,
  });

  useEffect(() => {
    stateRef.current = { transactions, schedules, settings };
  }, [transactions, schedules, settings]);

  const showToast = useCallback((title: string, body: string) => {
    const id = generateId('toast');
    setToasts((prev) => [...prev, { id, title, body }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6500);
  }, []);

  // Listen to Supabase Auth session
  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session ?? null);
        setAuthLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email;

  // Fetch user's records from Supabase whenever authenticated user changes
  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setSchedules([]);
      setNotes([]);
      setMessages([createWelcomeMessage()]);
      setSettings(DEFAULT_SETTINGS);
      return;
    }

    let cancelled = false;
    setSettings(loadUserSettings(userId));
    setMessages([createWelcomeMessage()]);
    setDataLoading(true);

    fetchAllUserData(userId)
      .then((data) => {
        if (cancelled) return;
        setTransactions(data.transactions);
        setSchedules(data.schedules);
        setNotes(data.notes);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof Error
            ? sanitizeText(err.message, 300)
            : 'ไม่สามารถโหลดข้อมูลจากฐานข้อมูลได้ค่ะ';
        showToast('โหลดข้อมูลไม่สำเร็จ', msg);
      })
      .finally(() => {
        if (!cancelled) {
          setDataLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, showToast]);

  // Schedule & Daily Summary Notification Checker (runs every 15s when signed in)
  useEffect(() => {
    if (!userId) return;

    const checkReminders = () => {
      const currentSettings = stateRef.current.settings;
      if (!currentSettings.notificationsEnabled && !currentSettings.dailySummaryEnabled) {
        return;
      }

      const today = getLocalDateString(0);
      const nowTime = getLocalTimeString();

      if (currentSettings.notificationsEnabled) {
        let notifiedIds: string[] = [];
        try {
          const raw = localStorage.getItem(NOTIFIED_SCHEDULES_KEY);
          if (raw) notifiedIds = JSON.parse(raw) as string[];
        } catch {
          notifiedIds = [];
        }

        const dueItems = stateRef.current.schedules.filter(
          (item) =>
            !item.completed &&
            item.date === today &&
            item.time === nowTime &&
            !notifiedIds.includes(`${item.id}_${item.date}_${item.time}`),
        );

        if (dueItems.length > 0) {
          const updatedKeys = [...notifiedIds];
          for (const item of dueItems) {
            const key = `${item.id}_${item.date}_${item.time}`;
            updatedKeys.push(key);
            const title = `ถึงเวลานัดแล้วนะคะ · ${item.time} น.`;
            const body = item.title;
            if (currentSettings.soundEnabled) {
              playGentleBell();
            }
            sendBrowserNotification(title, body);
            showToast(title, body);
          }
          try {
            localStorage.setItem(
              NOTIFIED_SCHEDULES_KEY,
              JSON.stringify(updatedKeys.slice(-100)),
            );
          } catch {
            // Ignore
          }
        }
      }

      if (
        currentSettings.dailySummaryEnabled &&
        nowTime === currentSettings.dailySummaryTime
      ) {
        let lastSentDate = '';
        try {
          lastSentDate = localStorage.getItem(LAST_DAILY_SUMMARY_KEY) ?? '';
        } catch {
          lastSentDate = '';
        }

        if (lastSentDate !== today) {
          try {
            localStorage.setItem(LAST_DAILY_SUMMARY_KEY, today);
          } catch {
            // Ignore
          }
          const todayExpense = stateRef.current.transactions
            .filter((t) => t.type === 'expense' && t.date === today)
            .reduce((sum, t) => sum + t.amount, 0);
          const pendingCount = stateRef.current.schedules.filter(
            (s) => !s.completed && s.date === today,
          ).length;

          const title = 'สรุปยอดประจำวันจากน้อนอากิ้ค่ะ';
          const body = `วันนี้ใช้จ่ายไป ฿${formatCurrency(todayExpense)} และมีนัดหมายค้างอีก ${pendingCount} รายการนะคะน้า~`;
          if (currentSettings.soundEnabled) {
            playGentleBell();
          }
          if (currentSettings.notificationsEnabled) {
            sendBrowserNotification(title, body);
          }
          showToast(title, body);
        }
      }
    };

    checkReminders();
    const timer = window.setInterval(checkReminders, 15000);
    return () => window.clearInterval(timer);
  }, [userId, showToast]);

  const dashboardContext: DashboardContext = useMemo(() => {
    const today = getLocalDateString(0);
    const currentMonth = today.slice(0, 7);
    let todayExpense = 0;
    let todayIncome = 0;
    let monthExpense = 0;
    for (const tx of transactions) {
      if (tx.date === today) {
        if (tx.type === 'expense') todayExpense += tx.amount;
        else todayIncome += tx.amount;
      }
      if (tx.date.startsWith(currentMonth) && tx.type === 'expense') {
        monthExpense += tx.amount;
      }
    }
    const pendingSchedulesCount = schedules.filter((s) => !s.completed).length;
    return { todayExpense, todayIncome, monthExpense, pendingSchedulesCount };
  }, [transactions, schedules]);

  const handleSendMessage = async (payload: {
    text: string;
    imageBase64?: string;
    mimeType?: string;
    imagePreview?: string;
  }) => {
    if (!userId) return;

    const cleanText = sanitizeText(payload.text, 2000);
    const safePreview = sanitizeImageSrc(payload.imagePreview);

    const userMsg: ChatMessage = {
      id: generateId('msg'),
      role: 'user',
      text: cleanText || 'ส่งรูปสลิปโอนเงินให้น้อนอากิ้ช่วยบันทึกนะคะ',
      timestamp: getLocalTimeString(),
      imagePreview: safePreview,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsAnalyzing(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanText,
          imageBase64: payload.imageBase64,
          mimeType: payload.mimeType,
          currentDate: getLocalDateString(0),
          currentTime: getLocalTimeString(),
          dayOfWeek: getThaiDayOfWeek(),
          dashboardContext,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'ไม่สามารถเชื่อมต่อกับน้อนอากิ้ได้ค่ะ');
      }

      const analyzed = data as AnalyzedResponse;
      const sourceKind: 'slip' | 'chat' = payload.imageBase64 ? 'slip' : 'chat';

      const pendingTransactions: Array<Omit<Transaction, 'id'>> = Array.isArray(
        analyzed.transactions,
      )
        ? analyzed.transactions.map((t) => ({
            type: t.type === 'income' ? 'income' : 'expense',
            amount: Math.abs(Number(t.amount)),
            title: sanitizeSingleLine(t.title, 120) || 'รายการ',
            category: t.category,
            paymentMethod: payload.imageBase64
              ? 'bank'
              : t.payment_method === 'cash'
                ? 'cash'
                : 'bank',
            date: t.date,
            time: t.time,
            source: sourceKind,
          }))
        : [];

      const pendingSchedules: Array<Omit<ScheduleItem, 'id'>> = Array.isArray(analyzed.schedules)
        ? analyzed.schedules.map((s) => ({
            title: sanitizeSingleLine(s.title, 160) || 'นัดหมาย',
            date: s.date,
            time: s.time,
            completed: false,
          }))
        : [];

      const pendingNotes: Array<Omit<NoteItem, 'id' | 'createdAt'>> = Array.isArray(
        analyzed.notes,
      )
        ? analyzed.notes.map((n) => {
            const tags = n.tags.map((tag) => sanitizeSingleLine(tag, 30)).filter(Boolean);
            return {
              title: sanitizeSingleLine(n.title, 120) || 'บันทึกช่วยจำ',
              content: sanitizeText(n.content, 1500),
              tags: tags.length > 0 ? tags : ['ทั่วไป'],
            };
          })
        : [];

      const [savedTxs, savedSchs, savedNotes] = await Promise.all([
        insertTransactionsDb(userId, pendingTransactions),
        insertSchedulesDb(userId, pendingSchedules),
        insertNotesDb(userId, pendingNotes),
      ]);

      if (savedTxs.length > 0) {
        setTransactions((prev) => [...savedTxs, ...prev]);
      }
      if (savedSchs.length > 0) {
        setSchedules((prev) => [...savedSchs, ...prev]);
      }
      if (savedNotes.length > 0) {
        setNotes((prev) => [...savedNotes, ...prev]);
      }

      const createdRefs: CreatedItemRef[] = [
        ...savedTxs.map((t): CreatedItemRef => ({ kind: 'transaction', id: t.id })),
        ...savedSchs.map((s): CreatedItemRef => ({ kind: 'schedule', id: s.id })),
        ...savedNotes.map((n): CreatedItemRef => ({ kind: 'note', id: n.id })),
      ];

      if (createdRefs.length > 0) {
        const kinds = new Set(createdRefs.map((r) => r.kind));
        if (kinds.size === 1) {
          const only = createdRefs[0].kind;
          if (only === 'transaction') setDesktopTab('finance');
          else if (only === 'schedule') setDesktopTab('schedule');
          else if (only === 'note') setDesktopTab('notes');
        }
      }

      const assistantMsg: ChatMessage = {
        id: generateId('msg'),
        role: 'assistant',
        text: sanitizeText(analyzed.reply, 2000) || 'อากิ้จดให้เรียบร้อยแล้วค่ะน้า~',
        timestamp: getLocalTimeString(),
        createdItems: createdRefs.length > 0 ? createdRefs : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errorText =
        err instanceof Error
          ? sanitizeText(err.message, 400)
          : 'เกิดข้อผิดพลาดในการประมวลผลข้อความค่ะ';
      const errorMsg: ChatMessage = {
        id: generateId('msg'),
        role: 'assistant',
        text: errorText,
        timestamp: getLocalTimeString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
      showToast('บันทึกข้อมูลไม่สำเร็จ', errorText);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Supabase-backed CRUD handlers
  const handleSaveTransaction = async (
    data: Omit<Transaction, 'id' | 'source'>,
    existingId?: string,
  ) => {
    if (!userId) return;
    try {
      if (existingId) {
        const updated = await updateTransactionDb(userId, existingId, data);
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === existingId ? { ...updated, source: tx.source } : tx,
          ),
        );
      } else {
        const [inserted] = await insertTransactionsDb(userId, [
          { ...data, source: 'manual' },
        ]);
        if (inserted) {
          setTransactions((prev) => [inserted, ...prev]);
        }
      }
    } catch (err: unknown) {
      showToast(
        'บันทึกรายการไม่สำเร็จ',
        err instanceof Error ? sanitizeText(err.message, 250) : 'ลองใหม่อีกครั้งนะคะ',
      );
    }
  };

  const handleToggleTransactionPaymentMethod = async (tx: Transaction) => {
    if (!userId) return;
    const nextMethod: PaymentMethod = tx.paymentMethod === 'cash' ? 'bank' : 'cash';
    setTransactions((prev) =>
      prev.map((item) =>
        item.id === tx.id ? { ...item, paymentMethod: nextMethod } : item,
      ),
    );
    try {
      await updateTransactionPaymentMethodDb(userId, tx.id, nextMethod);
    } catch (err: unknown) {
      setTransactions((prev) =>
        prev.map((item) =>
          item.id === tx.id ? { ...item, paymentMethod: tx.paymentMethod } : item,
        ),
      );
      showToast(
        'สลับกระเป๋าเงินไม่สำเร็จ',
        err instanceof Error ? sanitizeText(err.message, 250) : 'ลองใหม่อีกครั้งนะคะ',
      );
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!userId) return;
    const prevList = transactions;
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    try {
      await deleteTransactionDb(userId, id);
    } catch (err: unknown) {
      setTransactions(prevList);
      showToast(
        'ลบรายการไม่สำเร็จ',
        err instanceof Error ? sanitizeText(err.message, 250) : 'ลองใหม่อีกครั้งนะคะ',
      );
    }
  };

  const handleSaveSchedule = async (
    data: Omit<ScheduleItem, 'id'>,
    existingId?: string,
  ) => {
    if (!userId) return;
    try {
      if (existingId) {
        const updated = await updateScheduleDb(userId, existingId, data);
        setSchedules((prev) =>
          prev.map((s) => (s.id === existingId ? updated : s)),
        );
      } else {
        const [inserted] = await insertSchedulesDb(userId, [data]);
        if (inserted) {
          setSchedules((prev) => [inserted, ...prev]);
        }
      }
    } catch (err: unknown) {
      showToast(
        'บันทึกตารางเวลาไม่สำเร็จ',
        err instanceof Error ? sanitizeText(err.message, 250) : 'ลองใหม่อีกครั้งนะคะ',
      );
    }
  };

  const handleToggleSchedule = async (id: string) => {
    if (!userId) return;
    const target = schedules.find((s) => s.id === id);
    if (!target) return;
    const nextCompleted = !target.completed;
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, completed: nextCompleted } : s)),
    );
    try {
      await toggleScheduleCompletedDb(userId, id, nextCompleted);
    } catch (err: unknown) {
      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, completed: target.completed } : s)),
      );
      showToast(
        'อัปเดตสถานะไม่สำเร็จ',
        err instanceof Error ? sanitizeText(err.message, 250) : 'ลองใหม่อีกครั้งนะคะ',
      );
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!userId) return;
    const prevList = schedules;
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteScheduleDb(userId, id);
    } catch (err: unknown) {
      setSchedules(prevList);
      showToast(
        'ลบตารางเวลาไม่สำเร็จ',
        err instanceof Error ? sanitizeText(err.message, 250) : 'ลองใหม่อีกครั้งนะคะ',
      );
    }
  };

  const handleSaveNote = async (
    data: Omit<NoteItem, 'id' | 'createdAt'>,
    existingId?: string,
  ) => {
    if (!userId) return;
    try {
      if (existingId) {
        const updated = await updateNoteDb(userId, existingId, data);
        setNotes((prev) => prev.map((n) => (n.id === existingId ? updated : n)));
      } else {
        const [inserted] = await insertNotesDb(userId, [data]);
        if (inserted) {
          setNotes((prev) => [inserted, ...prev]);
        }
      }
    } catch (err: unknown) {
      showToast(
        'บันทึกโน้ตไม่สำเร็จ',
        err instanceof Error ? sanitizeText(err.message, 250) : 'ลองใหม่อีกครั้งนะคะ',
      );
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!userId) return;
    const prevList = notes;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await deleteNoteDb(userId, id);
    } catch (err: unknown) {
      setNotes(prevList);
      showToast(
        'ลบโน้ตไม่สำเร็จ',
        err instanceof Error ? sanitizeText(err.message, 250) : 'ลองใหม่อีกครั้งนะคะ',
      );
    }
  };

  const handleUpdateSettings = (nextSettings: AppSettings) => {
    setSettings(nextSettings);
    if (userId) {
      saveUserSettings(userId, nextSettings);
    }
  };

  const handleClearAllData = async () => {
    if (!userId) return;
    try {
      await clearAllUserDataDb(userId);
      setTransactions([]);
      setSchedules([]);
      setNotes([]);
      setMessages([
        createWelcomeMessage(
          'ล้างข้อมูลทั้งหมดในบัญชีเรียบร้อยแล้วค่ะน้า~ เริ่มจดรายการใหม่กับน้อนอากิ้ได้เลยนะคะ',
        ),
      ]);
      try {
        localStorage.removeItem(NOTIFIED_SCHEDULES_KEY);
        localStorage.removeItem(LAST_DAILY_SUMMARY_KEY);
      } catch {
        // Ignore
      }
      showToast('ล้างข้อมูลทั้งหมดแล้วค่ะ', 'พื้นที่บันทึกพร้อมเริ่มใช้งานใหม่เรียบร้อยแล้วนะคะน้า~');
    } catch (err: unknown) {
      showToast(
        'ล้างข้อมูลไม่สำเร็จ',
        err instanceof Error ? sanitizeText(err.message, 250) : 'ลองใหม่อีกครั้งนะคะ',
      );
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setSettingsOpen(false);
      setEditTarget(null);
      setTransactions([]);
      setSchedules([]);
      setNotes([]);
      setMessages([createWelcomeMessage()]);
    } catch (err: unknown) {
      showToast(
        'ออกจากระบบไม่สำเร็จ',
        err instanceof Error ? sanitizeText(err.message, 250) : 'ลองใหม่อีกครั้งนะคะ',
      );
    }
  };

  const handleJumpToTab = (tab: DashboardTab) => {
    setDesktopTab(tab);
    setMobileTab(tab);
  };

  if (authLoading) {
    return (
      <div className="h-[100dvh] bg-[#FAF7F2] text-[#5C4033] flex flex-col items-center justify-center gap-3 p-6">
        <AkiLogo className="w-14 h-14" />
        <div className="flex items-center gap-2 text-sm text-[#7A6356]">
          <Loader2 className="w-4 h-4 animate-spin text-[#5C4033]" />
          <span>กำลังเตรียมพื้นที่ให้น้อนอากิ้อยู่ค่ะ...</span>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return <AuthScreen />;
  }

  const pendingScheduleCount = schedules.filter((s) => !s.completed).length;

  const dashboardTabs: Array<{
    id: DashboardTab;
    label: string;
    count: number;
    icon: typeof Wallet;
  }> = [
    { id: 'finance', label: 'การเงิน', count: transactions.length, icon: Wallet },
    { id: 'schedule', label: 'ตารางเวลา', count: pendingScheduleCount, icon: CalendarDays },
    { id: 'notes', label: 'โน้ต', count: notes.length, icon: StickyNote },
  ];

  const renderDashboardContent = (tab: DashboardTab) => {
    if (dataLoading) {
      return (
        <div className="bg-white border border-[#EAE0D5] rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-sm text-[#7A6356]">
          <Loader2 className="w-5 h-5 animate-spin text-[#5C4033]" />
          <span>น้อนอากิ้กำลังซิงค์ข้อมูลจากบัญชีของคุณอยู่นะคะ...</span>
        </div>
      );
    }

    if (tab === 'finance') {
      return (
        <FinanceDashboard
          transactions={transactions}
          onAdd={() => setEditTarget({ kind: 'transaction', mode: 'create' })}
          onEdit={(item) => setEditTarget({ kind: 'transaction', mode: 'edit', item })}
          onDelete={(id) => void handleDeleteTransaction(id)}
          onTogglePaymentMethod={(item) => void handleToggleTransactionPaymentMethod(item)}
        />
      );
    }
    if (tab === 'schedule') {
      return (
        <ScheduleDashboard
          schedules={schedules}
          onToggle={(id) => void handleToggleSchedule(id)}
          onAdd={() => setEditTarget({ kind: 'schedule', mode: 'create' })}
          onEdit={(item) => setEditTarget({ kind: 'schedule', mode: 'edit', item })}
          onDelete={(id) => void handleDeleteSchedule(id)}
        />
      );
    }
    return (
      <NotesDashboard
        notes={notes}
        onAdd={() => setEditTarget({ kind: 'note', mode: 'create' })}
        onEdit={(item) => setEditTarget({ kind: 'note', mode: 'edit', item })}
        onDelete={(id) => void handleDeleteNote(id)}
      />
    );
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-[#FAF7F2] text-[#2F2019] overflow-hidden">
      {/* Top Application Header */}
      <header className="min-h-[54px] lg:h-[58px] bg-white border-b border-[#EAE0D5] px-4 lg:px-6 py-1.5 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <AkiLogo className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" />
          <div className="min-w-0 flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
            <span className="text-sm sm:text-base font-bold tracking-tight text-[#5C4033] truncate leading-tight">
              น้อนอากิ้
            </span>
            <span className="text-[11px] sm:text-xs font-medium text-[#7A6356] truncate leading-tight">
              ผู้ช่วยส่วนตัวสไตล์คาเฟ่
            </span>
          </div>
        </div>

        {/* Desktop Dashboard Tab Switcher in Header */}
        <nav
          aria-label="หมวดหมู่แดชบอร์ด"
          className="hidden lg:flex items-center gap-1 p-1 bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg"
        >
          {dashboardTabs.map((tab) => {
            const Icon = tab.icon;
            const active = desktopTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDesktopTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#5C4033] text-white shadow-xs'
                    : 'text-[#7A6356] hover:text-[#2F2019]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    active ? 'text-[#EADBC8]' : 'text-[#9A8172]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Settings Button (Top Right) */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="ตั้งค่าและการแจ้งเตือน"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-medium text-[#5C4033] bg-[#FAF7F2] hover:bg-[#F5ECE3] border border-[#EAE0D5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          <span>ตั้งค่า</span>
        </button>
      </header>

      {/* In-App Notification Toast Banner */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-88 pointer-events-none"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-white border border-[#C8A27C] shadow-lg rounded-xl p-3.5 flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-[#F5ECE3] text-[#5C4033] flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#5C4033]">{toast.title}</p>
                <p className="text-xs text-[#7A6356] mt-0.5 leading-relaxed">{toast.body}</p>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                aria-label="ปิดการแจ้งเตือน"
                className="text-[#9A8172] hover:text-[#5C4033] p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Desktop Split View (>= lg) */}
      <main className="hidden lg:grid lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
        <div className="lg:col-span-5 h-full min-h-0 overflow-hidden">
          <ChatPanel
            messages={messages}
            transactions={transactions}
            schedules={schedules}
            notes={notes}
            isAnalyzing={isAnalyzing}
            onSendMessage={handleSendMessage}
            onEditTransaction={(item) =>
              setEditTarget({ kind: 'transaction', mode: 'edit', item })
            }
            onDeleteTransaction={(id) => void handleDeleteTransaction(id)}
            onEditSchedule={(item) =>
              setEditTarget({ kind: 'schedule', mode: 'edit', item })
            }
            onDeleteSchedule={(id) => void handleDeleteSchedule(id)}
            onEditNote={(item) => setEditTarget({ kind: 'note', mode: 'edit', item })}
            onDeleteNote={(id) => void handleDeleteNote(id)}
            onJumpToTab={handleJumpToTab}
          />
        </div>

        <div className="lg:col-span-7 h-full min-h-0 overflow-y-auto p-6 bg-[#FAF7F2]">
          <div className="max-w-4xl mx-auto">{renderDashboardContent(desktopTab)}</div>
        </div>
      </main>

      {/* Mobile Single-Tab View (< lg) */}
      <main className="lg:hidden flex-1 flex flex-col min-h-0 overflow-hidden">
        {mobileTab === 'chat' ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <ChatPanel
              messages={messages}
              transactions={transactions}
              schedules={schedules}
              notes={notes}
              isAnalyzing={isAnalyzing}
              onSendMessage={handleSendMessage}
              onEditTransaction={(item) =>
                setEditTarget({ kind: 'transaction', mode: 'edit', item })
              }
              onDeleteTransaction={(id) => void handleDeleteTransaction(id)}
              onEditSchedule={(item) =>
                setEditTarget({ kind: 'schedule', mode: 'edit', item })
              }
              onDeleteSchedule={(id) => void handleDeleteSchedule(id)}
              onEditNote={(item) => setEditTarget({ kind: 'note', mode: 'edit', item })}
              onDeleteNote={(id) => void handleDeleteNote(id)}
              onJumpToTab={handleJumpToTab}
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-6">
            {renderDashboardContent(mobileTab)}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (4 Buttons) */}
      <nav
        aria-label="เมนูนำทางหลัก"
        className="lg:hidden shrink-0 z-20 bg-white/95 backdrop-blur-md border-t border-[#EAE0D5] pb-safe"
      >
        <div className="grid grid-cols-4 h-[60px]">
          {(
            [
              { id: 'chat', label: 'แชท', icon: MessageCircle },
              { id: 'finance', label: 'การเงิน', icon: Wallet },
              { id: 'schedule', label: 'ตารางเวลา', icon: CalendarDays },
              { id: 'notes', label: 'โน้ต', icon: StickyNote },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = mobileTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMobileTab(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  active ? 'text-[#5C4033]' : 'text-[#9A8172] hover:text-[#5C4033]'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.25]' : 'stroke-[1.75]'}`} />
                <span className="text-[11px] font-medium whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Unified Edit / Create Modal */}
      <EditItemModal
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaveTransaction={(data, id) => void handleSaveTransaction(data, id)}
        onSaveSchedule={(data, id) => void handleSaveSchedule(data, id)}
        onSaveNote={(data, id) => void handleSaveNote(data, id)}
      />

      {/* Settings, Account & Notifications Modal */}
      <SettingsModal
        open={settingsOpen}
        userEmail={userEmail}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onUpdateSettings={handleUpdateSettings}
        onClearAllData={handleClearAllData}
        onSignOut={handleSignOut}
        onShowToast={showToast}
      />
    </div>
  );
}

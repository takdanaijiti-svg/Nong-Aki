import { supabase } from '../lib/supabase';
import {
  ExpenseCategory,
  NoteItem,
  ScheduleItem,
  Transaction,
  TransactionCategory,
} from '../types';
import { getLocalDateString } from '../utils/dateFormat';
import { sanitizeSingleLine, sanitizeText } from '../utils/sanitize';

const EXPENSE_CATS = new Set<ExpenseCategory>(['อาหาร', 'เดินทาง', 'ของใช้', 'อื่นๆ']);

function parseTransactionDate(rawDate: unknown): { date: string; time: string } {
  if (typeof rawDate === 'string' && rawDate.trim()) {
    const trimmed = rawDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return { date: trimmed, time: '12:00' };
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      const hh = String(parsed.getHours()).padStart(2, '0');
      const mm = String(parsed.getMinutes()).padStart(2, '0');
      return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
    }
  }
  return { date: getLocalDateString(0), time: '12:00' };
}

function parseEventTime(rawEventTime: unknown): { date: string; time: string } {
  if (typeof rawEventTime === 'string' && rawEventTime.trim()) {
    const parsed = new Date(rawEventTime);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      const hh = String(parsed.getHours()).padStart(2, '0');
      const mm = String(parsed.getMinutes()).padStart(2, '0');
      return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
    }
  }
  return { date: getLocalDateString(0), time: '09:00' };
}

function toEventTimeIso(date: string, time: string): string {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getLocalDateString(0);
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
  const dt = new Date(`${safeDate}T${safeTime}:00`);
  if (Number.isNaN(dt.getTime())) {
    return new Date().toISOString();
  }
  return dt.toISOString();
}

function mapTransactionRow(row: Record<string, unknown>): Transaction {
  const isIncome = row.type === 'income';
  const rawCat = sanitizeSingleLine(row.category, 40);
  const category: TransactionCategory = isIncome
    ? 'รายรับ'
    : EXPENSE_CATS.has(rawCat as ExpenseCategory)
      ? (rawCat as ExpenseCategory)
      : 'อื่นๆ';
  const { date, time } = parseTransactionDate(row.date);

  return {
    id: String(row.id),
    type: isIncome ? 'income' : 'expense',
    amount: Math.abs(Number(row.amount) || 0),
    title: sanitizeSingleLine(row.description, 120) || (isIncome ? 'รายรับ' : 'รายจ่าย'),
    category,
    date,
    time,
    source: 'chat',
  };
}

function mapScheduleRow(row: Record<string, unknown>): ScheduleItem {
  const { date, time } = parseEventTime(row.event_time);
  return {
    id: String(row.id),
    title: sanitizeSingleLine(row.title, 160) || 'นัดหมาย',
    date,
    time,
    completed: Boolean(row.is_completed),
  };
}

function mapNoteRow(row: Record<string, unknown>): NoteItem {
  let tags: string[] = [];
  if (Array.isArray(row.tags)) {
    tags = row.tags
      .map((t) => sanitizeSingleLine(t, 30).replace(/^#/, ''))
      .filter(Boolean);
  } else if (typeof row.tags === 'string') {
    tags = row.tags
      .split(',')
      .map((t) => sanitizeSingleLine(t, 30).replace(/^#/, ''))
      .filter(Boolean);
  }

  return {
    id: String(row.id),
    title: sanitizeSingleLine(row.title, 120) || 'บันทึกช่วยจำ',
    content: sanitizeText(row.content, 1500),
    tags: tags.length > 0 ? tags : ['ทั่วไป'],
    createdAt:
      typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  };
}

export async function fetchAllUserData(userId: string): Promise<{
  transactions: Transaction[];
  schedules: ScheduleItem[];
  notes: NoteItem[];
}> {
  const [txRes, schRes, noteRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, type, amount, category, description, date')
      .eq('user_id', userId)
      .order('date', { ascending: false }),
    supabase
      .from('schedules')
      .select('id, title, event_time, is_completed')
      .eq('user_id', userId)
      .order('event_time', { ascending: true }),
    supabase
      .from('notes')
      .select('id, title, content, tags, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (txRes.error) throw new Error(`โหลดรายการการเงินไม่สำเร็จ: ${txRes.error.message}`);
  if (schRes.error) throw new Error(`โหลดตารางเวลาไม่สำเร็จ: ${schRes.error.message}`);
  if (noteRes.error) throw new Error(`โหลดโน้ตไม่สำเร็จ: ${noteRes.error.message}`);

  return {
    transactions: (txRes.data ?? []).map((r) => mapTransactionRow(r as Record<string, unknown>)),
    schedules: (schRes.data ?? []).map((r) => mapScheduleRow(r as Record<string, unknown>)),
    notes: (noteRes.data ?? []).map((r) => mapNoteRow(r as Record<string, unknown>)),
  };
}

export async function insertTransactionsDb(
  userId: string,
  items: Array<Omit<Transaction, 'id'>>,
): Promise<Transaction[]> {
  if (items.length === 0) return [];
  const rows = items.map((item) => ({
    user_id: userId,
    type: item.type,
    amount: Math.abs(Number(item.amount) || 0),
    category: item.category,
    description: sanitizeSingleLine(item.title, 120) || 'รายการ',
    date: item.date,
  }));

  const { data, error } = await supabase
    .from('transactions')
    .insert(rows)
    .select('id, type, amount, category, description, date');

  if (error) throw new Error(`บันทึกรายการการเงินไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((r, idx) => ({
    ...mapTransactionRow(r as Record<string, unknown>),
    time: items[idx]?.time || '12:00',
    source: items[idx]?.source || 'chat',
  }));
}

export async function updateTransactionDb(
  userId: string,
  id: string,
  data: Omit<Transaction, 'id' | 'source'>,
): Promise<Transaction> {
  const { data: updated, error } = await supabase
    .from('transactions')
    .update({
      type: data.type,
      amount: Math.abs(Number(data.amount) || 0),
      category: data.category,
      description: sanitizeSingleLine(data.title, 120) || 'รายการ',
      date: data.date,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, type, amount, category, description, date')
    .single();

  if (error) throw new Error(`แก้ไขรายการการเงินไม่สำเร็จ: ${error.message}`);
  return {
    ...mapTransactionRow(updated as Record<string, unknown>),
    time: data.time,
  };
}

export async function deleteTransactionDb(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(`ลบรายการการเงินไม่สำเร็จ: ${error.message}`);
}

export async function insertSchedulesDb(
  userId: string,
  items: Array<Omit<ScheduleItem, 'id'>>,
): Promise<ScheduleItem[]> {
  if (items.length === 0) return [];
  const rows = items.map((item) => ({
    user_id: userId,
    title: sanitizeSingleLine(item.title, 160) || 'นัดหมาย',
    event_time: toEventTimeIso(item.date, item.time),
    is_completed: Boolean(item.completed),
  }));

  const { data, error } = await supabase
    .from('schedules')
    .insert(rows)
    .select('id, title, event_time, is_completed');

  if (error) throw new Error(`บันทึกตารางเวลาไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((r) => mapScheduleRow(r as Record<string, unknown>));
}

export async function updateScheduleDb(
  userId: string,
  id: string,
  data: Omit<ScheduleItem, 'id'>,
): Promise<ScheduleItem> {
  const { data: updated, error } = await supabase
    .from('schedules')
    .update({
      title: sanitizeSingleLine(data.title, 160) || 'นัดหมาย',
      event_time: toEventTimeIso(data.date, data.time),
      is_completed: Boolean(data.completed),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, title, event_time, is_completed')
    .single();

  if (error) throw new Error(`แก้ไขตารางเวลาไม่สำเร็จ: ${error.message}`);
  return mapScheduleRow(updated as Record<string, unknown>);
}

export async function toggleScheduleCompletedDb(
  userId: string,
  id: string,
  isCompleted: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .update({ is_completed: isCompleted })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(`อัปเดตสถานะตารางเวลาไม่สำเร็จ: ${error.message}`);
}

export async function deleteScheduleDb(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(`ลบตารางเวลาไม่สำเร็จ: ${error.message}`);
}

export async function insertNotesDb(
  userId: string,
  items: Array<Omit<NoteItem, 'id' | 'createdAt'>>,
): Promise<NoteItem[]> {
  if (items.length === 0) return [];
  const rows = items.map((item) => ({
    user_id: userId,
    title: sanitizeSingleLine(item.title, 120) || 'บันทึกช่วยจำ',
    content: sanitizeText(item.content, 1500),
    tags: item.tags.length > 0 ? item.tags : ['ทั่วไป'],
  }));

  const { data, error } = await supabase
    .from('notes')
    .insert(rows)
    .select('id, title, content, tags, created_at');

  if (error) throw new Error(`บันทึกโน้ตไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((r) => mapNoteRow(r as Record<string, unknown>));
}

export async function updateNoteDb(
  userId: string,
  id: string,
  data: Omit<NoteItem, 'id' | 'createdAt'>,
): Promise<NoteItem> {
  const { data: updated, error } = await supabase
    .from('notes')
    .update({
      title: sanitizeSingleLine(data.title, 120) || 'บันทึกช่วยจำ',
      content: sanitizeText(data.content, 1500),
      tags: data.tags.length > 0 ? data.tags : ['ทั่วไป'],
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, title, content, tags, created_at')
    .single();

  if (error) throw new Error(`แก้ไขโน้ตไม่สำเร็จ: ${error.message}`);
  return mapNoteRow(updated as Record<string, unknown>);
}

export async function deleteNoteDb(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(`ลบโน้ตไม่สำเร็จ: ${error.message}`);
}

export async function clearAllUserDataDb(userId: string): Promise<void> {
  const [txDel, schDel, noteDel] = await Promise.all([
    supabase.from('transactions').delete().eq('user_id', userId),
    supabase.from('schedules').delete().eq('user_id', userId),
    supabase.from('notes').delete().eq('user_id', userId),
  ]);

  if (txDel.error) throw new Error(`ล้างรายการการเงินไม่สำเร็จ: ${txDel.error.message}`);
  if (schDel.error) throw new Error(`ล้างตารางเวลาไม่สำเร็จ: ${schDel.error.message}`);
  if (noteDel.error) throw new Error(`ล้างโน้ตไม่สำเร็จ: ${noteDel.error.message}`);
}

export type ExpenseCategory = 'อาหาร' | 'เดินทาง' | 'ของใช้' | 'อื่นๆ';
export type TransactionCategory = ExpenseCategory | 'รายรับ';
export type TransactionType = 'expense' | 'income';
export type PaymentMethod = 'cash' | 'bank';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  title: string;
  category: TransactionCategory;
  paymentMethod: PaymentMethod;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  source: 'chat' | 'slip' | 'manual';
}

export interface ScheduleItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  completed: boolean;
  note?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string; // ISO string
}

export type CreatedItemRef =
  | { kind: 'transaction'; id: string }
  | { kind: 'schedule'; id: string }
  | { kind: 'note'; id: string };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string; // HH:mm
  imagePreview?: string;
  createdItems?: CreatedItemRef[];
  isError?: boolean;
}

export type DashboardTab = 'finance' | 'schedule' | 'notes';
export type MobileTab = 'chat' | DashboardTab;

export type EditTarget =
  | { kind: 'transaction'; mode: 'create' | 'edit'; item?: Transaction }
  | { kind: 'schedule'; mode: 'create' | 'edit'; item?: ScheduleItem }
  | { kind: 'note'; mode: 'create' | 'edit'; item?: NoteItem };

export interface AnalyzedResponse {
  reply: string;
  transactions: Array<{
    type: TransactionType;
    amount: number;
    title: string;
    category: TransactionCategory;
    payment_method?: PaymentMethod;
    date: string;
    time: string;
  }>;
  schedules: Array<{
    title: string;
    date: string;
    time: string;
    note?: string;
  }>;
  notes: Array<{
    title: string;
    content: string;
    tags: string[];
  }>;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  dailySummaryEnabled: boolean;
  dailySummaryTime: string; // HH:mm
}

export interface ToastAlert {
  id: string;
  title: string;
  body: string;
}

export interface DashboardContext {
  todayExpense: number;
  todayIncome: number;
  monthExpense: number;
  pendingSchedulesCount: number;
}

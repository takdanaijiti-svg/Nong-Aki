import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Car,
  Landmark,
  Package,
  Pencil,
  PieChart,
  Plus,
  ShoppingBag,
  Trash2,
  Utensils,
  Wallet,
} from 'lucide-react';
import { ExpenseCategory, PaymentMethod, Transaction } from '../types';
import { formatCurrency, formatThaiDate, getLocalDateString } from '../utils/dateFormat';

interface FinanceDashboardProps {
  transactions: Transaction[];
  onAdd: () => void;
  onEdit: (item: Transaction) => void;
  onDelete: (id: string) => void;
  onTogglePaymentMethod: (item: Transaction) => void;
}

type PeriodFilter = 'today' | 'month' | 'all';
type TypeFilter = 'all' | 'expense' | 'income';
type WalletFilter = 'all' | PaymentMethod;
type ChartMode = 'donut' | 'bar';

const CATEGORY_META: Record<
  ExpenseCategory,
  { color: string; icon: typeof Utensils }
> = {
  อาหาร: { color: '#5C4033', icon: Utensils },
  เดินทาง: { color: '#C8A27C', icon: Car },
  ของใช้: { color: '#8C6D58', icon: ShoppingBag },
  อื่นๆ: { color: '#D6C7B8', icon: Package },
};

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['อาหาร', 'เดินทาง', 'ของใช้', 'อื่นๆ'];

export function FinanceDashboard({
  transactions,
  onAdd,
  onEdit,
  onDelete,
  onTogglePaymentMethod,
}: FinanceDashboardProps) {
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [walletFilter, setWalletFilter] = useState<WalletFilter>('all');
  const [chartMode, setChartMode] = useState<ChartMode>('donut');

  const today = getLocalDateString(0);
  const currentMonth = today.slice(0, 7);

  const summary = useMemo(() => {
    let todayExpense = 0;
    let todayIncome = 0;
    let monthExpense = 0;
    let monthIncome = 0;

    for (const tx of transactions) {
      if (tx.date === today) {
        if (tx.type === 'expense') todayExpense += tx.amount;
        else todayIncome += tx.amount;
      }
      if (tx.date.startsWith(currentMonth)) {
        if (tx.type === 'expense') monthExpense += tx.amount;
        else monthIncome += tx.amount;
      }
    }

    return {
      todayExpense,
      todayIncome,
      monthExpense,
      monthIncome,
      monthNet: monthIncome - monthExpense,
    };
  }, [transactions, today, currentMonth]);

  const walletSummary = useMemo(() => {
    let bankIncome = 0;
    let bankExpense = 0;
    let cashIncome = 0;
    let cashExpense = 0;

    for (const tx of transactions) {
      const isCash = tx.paymentMethod === 'cash';
      if (tx.type === 'income') {
        if (isCash) cashIncome += tx.amount;
        else bankIncome += tx.amount;
      } else {
        if (isCash) cashExpense += tx.amount;
        else bankExpense += tx.amount;
      }
    }

    return {
      bankIncome,
      bankExpense,
      bankBalance: bankIncome - bankExpense,
      cashIncome,
      cashExpense,
      cashBalance: cashIncome - cashExpense,
    };
  }, [transactions]);

  const periodFiltered = useMemo(() => {
    return transactions.filter((tx) => {
      if (period === 'today') return tx.date === today;
      if (period === 'month') return tx.date.startsWith(currentMonth);
      return true;
    });
  }, [transactions, period, today, currentMonth]);

  const visibleTransactions = useMemo(() => {
    return periodFiltered
      .filter((tx) => (typeFilter === 'all' ? true : tx.type === typeFilter))
      .filter((tx) => (walletFilter === 'all' ? true : tx.paymentMethod === walletFilter))
      .slice()
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }, [periodFiltered, typeFilter, walletFilter]);

  const categoryBreakdown = useMemo(() => {
    const totals: Record<ExpenseCategory, number> = {
      อาหาร: 0,
      เดินทาง: 0,
      ของใช้: 0,
      อื่นๆ: 0,
    };

    for (const tx of periodFiltered) {
      if (tx.type === 'expense') {
        const cat = EXPENSE_CATEGORIES.includes(tx.category as ExpenseCategory)
          ? (tx.category as ExpenseCategory)
          : 'อื่นๆ';
        totals[cat] += tx.amount;
      }
    }

    const totalExpense = Object.values(totals).reduce((sum, v) => sum + v, 0);

    return EXPENSE_CATEGORIES.map((cat) => ({
      category: cat,
      amount: totals[cat],
      percent: totalExpense > 0 ? Math.round((totals[cat] / totalExpense) * 100) : 0,
      ...CATEGORY_META[cat],
    }));
  }, [periodFiltered]);

  const totalPeriodExpense = useMemo(
    () => categoryBreakdown.reduce((acc, item) => acc + item.amount, 0),
    [categoryBreakdown],
  );

  const dailyBars = useMemo(() => {
    const days: Array<{ date: string; label: string; expense: number }> = [];
    for (let i = 6; i >= 0; i -= 1) {
      const dateStr = getLocalDateString(-i);
      const expense = transactions
        .filter((tx) => tx.type === 'expense' && tx.date === dateStr)
        .reduce((s, tx) => s + tx.amount, 0);
      const dayNum = Number(dateStr.slice(8, 10));
      days.push({
        date: dateStr,
        label: i === 0 ? 'วันนี้' : `${dayNum}`,
        expense,
      });
    }
    const maxVal = Math.max(...days.map((d) => d.expense), 100);
    return { days, maxVal };
  }, [transactions]);

  const donutSegments = useMemo(() => {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    return categoryBreakdown
      .filter((item) => item.amount > 0)
      .map((item) => {
        const fraction = totalPeriodExpense > 0 ? item.amount / totalPeriodExpense : 0;
        const dashLength = fraction * circumference;
        const segment = {
          ...item,
          dashArray: `${dashLength} ${circumference - dashLength}`,
          dashOffset: -offset,
          radius,
        };
        offset += dashLength;
        return segment;
      });
  }, [categoryBreakdown, totalPeriodExpense]);

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#DFD1C2] rounded-xl p-4 shadow-sm shadow-[#5C4033]/10">
          <p className="text-xs font-medium text-[#7A6356]">รายจ่ายวันนี้</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-semibold text-[#C86432] font-mono tabular-nums">
            ฿{formatCurrency(summary.todayExpense)}
          </p>
          <p className="mt-1 text-xs text-[#4A7842] font-medium font-mono tabular-nums">
            รับ +฿{formatCurrency(summary.todayIncome)}
          </p>
        </div>

        <div className="bg-white border border-[#DFD1C2] rounded-xl p-4 shadow-sm shadow-[#5C4033]/10">
          <p className="text-xs font-medium text-[#7A6356]">รายจ่ายเดือนนี้</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-semibold text-[#C86432] font-mono tabular-nums">
            ฿{formatCurrency(summary.monthExpense)}
          </p>
          <p className="mt-1 text-xs text-[#9A8172]">รวมทุกหมวดหมู่</p>
        </div>

        <div className="bg-white border border-[#DFD1C2] rounded-xl p-4 shadow-sm shadow-[#5C4033]/10">
          <p className="text-xs font-medium text-[#7A6356]">รายรับเดือนนี้</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-semibold text-[#4A7842] font-mono tabular-nums">
            ฿{formatCurrency(summary.monthIncome)}
          </p>
          <p className="mt-1 text-xs text-[#9A8172]">เงินเข้าทั้งหมด</p>
        </div>

        <div className="bg-gradient-to-br from-[#855E47] via-[#5C4033] to-[#432C22] text-white border border-[#6E4C3C] rounded-xl p-4 shadow-md shadow-[#5C4033]/25">
          <p className="text-xs font-medium text-[#F3E5D8]">คงเหลือเดือนนี้</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-semibold font-mono tabular-nums">
            {summary.monthNet < 0 ? '-' : ''}฿{formatCurrency(Math.abs(summary.monthNet))}
          </p>
          <p className="mt-1 text-xs text-[#E7D3C1]">รายรับหักรายจ่าย</p>
        </div>
      </div>

      {/* Separated Cash & Bank Wallets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white border border-[#DFD1C2] rounded-xl p-4 shadow-sm shadow-[#5C4033]/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#F5ECE3] border border-[#E5D4C1] text-[#5C4033] flex items-center justify-center shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-[#5C4033]">เงินธนาคาร / โอน</p>
            </div>
            <p className="mt-2 text-lg sm:text-xl font-semibold text-[#2F2019] font-mono tabular-nums">
              {walletSummary.bankBalance < 0 ? '-' : ''}฿
              {formatCurrency(Math.abs(walletSummary.bankBalance))}
            </p>
            <p className="mt-0.5 text-[11px] font-mono tabular-nums text-[#7A6356]">
              <span className="text-[#4A7842] font-medium">
                รับ +฿{formatCurrency(walletSummary.bankIncome)}
              </span>{' '}
              ·{' '}
              <span className="text-[#C86432] font-medium">
                จ่าย -฿{formatCurrency(walletSummary.bankExpense)}
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#DFD1C2] rounded-xl p-4 shadow-sm shadow-[#5C4033]/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#FDF2EB] border border-[#F1D5C2] text-[#B85627] flex items-center justify-center shrink-0">
                <Banknote className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-[#5C4033]">เงินสด</p>
            </div>
            <p className="mt-2 text-lg sm:text-xl font-semibold text-[#2F2019] font-mono tabular-nums">
              {walletSummary.cashBalance < 0 ? '-' : ''}฿
              {formatCurrency(Math.abs(walletSummary.cashBalance))}
            </p>
            <p className="mt-0.5 text-[11px] font-mono tabular-nums text-[#7A6356]">
              <span className="text-[#4A7842] font-medium">
                รับ +฿{formatCurrency(walletSummary.cashIncome)}
              </span>{' '}
              ·{' '}
              <span className="text-[#C86432] font-medium">
                จ่าย -฿{formatCurrency(walletSummary.cashExpense)}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Period Control & Chart Card */}
      <div className="bg-white border border-[#DFD1C2] rounded-xl p-4 sm:p-5 shadow-sm shadow-[#5C4033]/10">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EFE5DA]">
          <div>
            <h2 className="text-base font-semibold text-[#2F2019]">สัดส่วนรายจ่ายแยกหมวดหมู่</h2>
            <p className="text-xs text-[#7A6356] mt-0.5">
              สรุปยอดรวม{' '}
              <span className="font-mono tabular-nums font-semibold text-[#C86432]">
                ฿{formatCurrency(totalPeriodExpense)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-[#FAF7F2] border border-[#DFD1C2] rounded-lg">
              {(
                [
                  { id: 'today', label: 'วันนี้' },
                  { id: 'month', label: 'เดือนนี้' },
                  { id: 'all', label: 'ทั้งหมด' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeriod(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    period === tab.id
                      ? 'bg-gradient-to-r from-[#7A543E] to-[#5C4033] text-white shadow-xs shadow-[#5C4033]/20'
                      : 'text-[#7A6356] hover:text-[#2F2019]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg">
              <button
                type="button"
                onClick={() => setChartMode('donut')}
                aria-label="ดูกราฟวงกลม"
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  chartMode === 'donut'
                    ? 'bg-white text-[#5C4033] shadow-xs'
                    : 'text-[#9A8172] hover:text-[#2F2019]'
                }`}
              >
                <PieChart className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setChartMode('bar')}
                aria-label="ดูกราฟแท่ง 7 วัน"
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  chartMode === 'bar'
                    ? 'bg-white text-[#5C4033] shadow-xs'
                    : 'text-[#9A8172] hover:text-[#2F2019]'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {chartMode === 'donut' ? (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
            <div className="sm:col-span-5 flex items-center justify-center">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                  <circle
                    cx="70"
                    cy="70"
                    r="54"
                    fill="none"
                    stroke="#F5ECE3"
                    strokeWidth="16"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.category}
                      cx="70"
                      cy="70"
                      r={seg.radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="16"
                      strokeDasharray={seg.dashArray}
                      strokeDashoffset={seg.dashOffset}
                      className="transition-all duration-300"
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                  <span className="text-[11px] text-[#7A6356]">รายจ่ายรวม</span>
                  <span className="text-sm font-semibold text-[#2F2019] font-mono tabular-nums">
                    ฿{formatCurrency(totalPeriodExpense)}
                  </span>
                </div>
              </div>
            </div>

            <div className="sm:col-span-7 space-y-3.5">
              {categoryBreakdown.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-[#2F2019] font-medium">
                        <Icon className="w-4 h-4 text-[#7A6356]" />
                        <span>{item.category}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono tabular-nums text-xs sm:text-sm">
                        <span className="text-[#2F2019] font-semibold">
                          ฿{formatCurrency(item.amount)}
                        </span>
                        <span className="text-[#9A8172] w-9 text-right">{item.percent}%</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-[#F5ECE3] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${item.percent}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-xs text-[#7A6356] mb-4">แนวโน้มรายจ่าย 7 วันล่าสุด (บาท)</p>
            <div className="grid grid-cols-7 gap-2 items-end h-40 pt-4">
              {dailyBars.days.map((d) => {
                const heightPct = Math.max(
                  d.expense > 0 ? Math.round((d.expense / dailyBars.maxVal) * 100) : 4,
                  4,
                );
                const isToday = d.date === today;
                return (
                  <div key={d.date} className="flex flex-col items-center h-full justify-end gap-1.5">
                    <span className="text-[11px] font-mono tabular-nums text-[#7A6356]">
                      {d.expense > 0 ? formatCurrency(d.expense) : '-'}
                    </span>
                    <div className="w-full max-w-[36px] flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          isToday ? 'bg-[#5C4033]' : 'bg-[#C8A27C] hover:bg-[#B28B64]'
                        }`}
                        style={{ height: `${heightPct}%` }}
                        title={`${formatThaiDate(d.date)}: ฿${formatCurrency(d.expense)}`}
                      />
                    </div>
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isToday ? 'text-[#5C4033] font-semibold' : 'text-[#7A6356]'
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Transaction Ledger */}
      <div className="bg-white border border-[#DFD1C2] rounded-xl shadow-sm shadow-[#5C4033]/10">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#EFE5DA]">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[#2F2019]">รายการย้อนหลัง</h3>
            <span className="text-xs font-mono tabular-nums text-[#9A8172]">
              ({visibleTransactions.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-[#FAF7F2] border border-[#DFD1C2] rounded-lg">
              {(
                [
                  { id: 'all', label: 'ทั้งหมด' },
                  { id: 'expense', label: 'รายจ่าย' },
                  { id: 'income', label: 'รายรับ' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    typeFilter === t.id
                      ? 'bg-gradient-to-r from-[#7A543E] to-[#5C4033] text-white shadow-xs shadow-[#5C4033]/20'
                      : 'text-[#7A6356] hover:text-[#2F2019]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#FAF7F2] border border-[#DFD1C2] rounded-lg">
              {(
                [
                  { id: 'all', label: 'ทุกกระเป๋า' },
                  { id: 'bank', label: 'เงินโอน' },
                  { id: 'cash', label: 'เงินสด' },
                ] as const
              ).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWalletFilter(w.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    walletFilter === w.id
                      ? 'bg-gradient-to-r from-[#D4AE87] to-[#B88B61] text-white shadow-xs'
                      : 'text-[#7A6356] hover:text-[#2F2019]'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-[#7A543E] to-[#5C4033] hover:from-[#6A4834] hover:to-[#4A3228] rounded-lg shadow-sm shadow-[#5C4033]/20 transition-all whitespace-nowrap shrink-0 min-h-[36px] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มรายการ</span>
            </button>
          </div>
        </div>

        {visibleTransactions.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Wallet className="w-8 h-8 text-[#C8A27C] mx-auto mb-2.5" />
            <p className="text-sm font-medium text-[#2F2019]">ยังไม่มีรายการในช่วงเวลานี้ค่ะ</p>
            <p className="text-xs text-[#7A6356] mt-1">
              ลองพิมพ์บอกน้อนอากิ้ในแชท เช่น &ldquo;ซื้อกาแฟ 60 บาท&rdquo; หรือกดเพิ่มรายการได้เลยน้า
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#EFE5DA]">
            {visibleTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              const CatIcon = isIncome
                ? ArrowDownLeft
                : CATEGORY_META[tx.category as ExpenseCategory]?.icon ?? ArrowUpRight;

              return (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-[#FAF7F2]/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                        isIncome
                          ? 'bg-[#EEF5EB] border-[#CFE0C9] text-[#4A7842]'
                          : 'bg-[#FDF2EB] border-[#F1D5C2] text-[#C86432]'
                      }`}
                    >
                      <CatIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#2F2019] truncate">{tx.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[#7A6356]">
                        <span>{tx.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatThaiDate(tx.date)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{tx.time}</span>
                        {tx.source === 'slip' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>จากสลิป</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => onTogglePaymentMethod(tx)}
                          title="กดเพื่อสลับระหว่างเงินสดและเงินธนาคาร"
                          aria-label={`สลับกระเป๋าเงินของ ${tx.title} (ปัจจุบัน: ${
                            tx.paymentMethod === 'cash' ? 'เงินสด' : 'เงินธนาคาร/โอน'
                          })`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                            tx.paymentMethod === 'cash'
                              ? 'bg-[#FDF2EB] border-[#F1D5C2] text-[#B85627] hover:bg-[#FAE6D9]'
                              : 'bg-[#FAF7F2] border-[#DFD1C2] text-[#5C4033] hover:bg-[#F5ECE3]'
                          }`}
                        >
                          {tx.paymentMethod === 'cash' ? (
                            <>
                              <Banknote className="w-3 h-3" />
                              <span>เงินสด</span>
                            </>
                          ) : (
                            <>
                              <Landmark className="w-3 h-3" />
                              <span>เงินโอน</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-sm font-semibold font-mono tabular-nums ${
                        isIncome ? 'text-[#4A7842]' : 'text-[#C86432]'
                      }`}
                    >
                      {isIncome ? '+' : '-'}฿{formatCurrency(tx.amount)}
                    </span>

                    <button
                      type="button"
                      onClick={() => onEdit(tx)}
                      aria-label={`แก้ไข ${tx.title}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#9A8172] hover:text-[#5C4033] hover:bg-[#FAF7F2] rounded-lg transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(tx.id)}
                      aria-label={`ลบ ${tx.title}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#9A8172] hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

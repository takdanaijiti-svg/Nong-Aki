import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  EditTarget,
  ExpenseCategory,
  NoteItem,
  ScheduleItem,
  Transaction,
  TransactionType,
} from '../types';
import { getLocalDateString, getLocalTimeString } from '../utils/dateFormat';
import { sanitizeSingleLine, sanitizeText } from '../utils/sanitize';

interface EditItemModalProps {
  target: EditTarget | null;
  onClose: () => void;
  onSaveTransaction: (data: Omit<Transaction, 'id' | 'source'>, existingId?: string) => void;
  onSaveSchedule: (data: Omit<ScheduleItem, 'id'>, existingId?: string) => void;
  onSaveNote: (data: Omit<NoteItem, 'id' | 'createdAt'>, existingId?: string) => void;
}

const EXPENSE_CATS: ExpenseCategory[] = ['อาหาร', 'เดินทาง', 'ของใช้', 'อื่นๆ'];

export function EditItemModal({
  target,
  onClose,
  onSaveTransaction,
  onSaveSchedule,
  onSaveNote,
}: EditItemModalProps) {
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState<ExpenseCategory>('อาหาร');
  const [txDate, setTxDate] = useState(getLocalDateString(0));
  const [txTime, setTxTime] = useState(getLocalTimeString());

  const [schTitle, setSchTitle] = useState('');
  const [schDate, setSchDate] = useState(getLocalDateString(0));
  const [schTime, setSchTime] = useState('09:00');
  const [schCompleted, setSchCompleted] = useState(false);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTagsText, setNoteTagsText] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setErrorMsg('');
    if (!target) return;

    if (target.kind === 'transaction') {
      const item = target.item;
      setTxType(item?.type ?? 'expense');
      setTxTitle(item?.title ?? '');
      setTxAmount(item ? String(item.amount) : '');
      setTxCategory(
        item && EXPENSE_CATS.includes(item.category as ExpenseCategory)
          ? (item.category as ExpenseCategory)
          : 'อาหาร',
      );
      setTxDate(item?.date ?? getLocalDateString(0));
      setTxTime(item?.time ?? getLocalTimeString());
    } else if (target.kind === 'schedule') {
      const item = target.item;
      setSchTitle(item?.title ?? '');
      setSchDate(item?.date ?? getLocalDateString(0));
      setSchTime(item?.time ?? '09:00');
      setSchCompleted(item?.completed ?? false);
    } else if (target.kind === 'note') {
      const item = target.item;
      setNoteTitle(item?.title ?? '');
      setNoteContent(item?.content ?? '');
      setNoteTagsText(item?.tags.join(', ') ?? '');
    }
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [target, onClose]);

  if (!target) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (target.kind === 'transaction') {
      const cleanTitle = sanitizeSingleLine(txTitle, 120);
      const numAmount = Number(txAmount);
      if (!cleanTitle) {
        setErrorMsg('กรุณาระบุชื่อรายการครับ');
        return;
      }
      if (!Number.isFinite(numAmount) || numAmount <= 0) {
        setErrorMsg('กรุณาระบุจำนวนเงินที่มากกว่า 0 ครับ');
        return;
      }
      onSaveTransaction(
        {
          type: txType,
          title: cleanTitle,
          amount: numAmount,
          category: txType === 'income' ? 'รายรับ' : txCategory,
          date: txDate || getLocalDateString(0),
          time: txTime || getLocalTimeString(),
        },
        target.item?.id,
      );
      onClose();
      return;
    }

    if (target.kind === 'schedule') {
      const cleanTitle = sanitizeSingleLine(schTitle, 160);
      if (!cleanTitle) {
        setErrorMsg('กรุณาระบุชื่อนัดหมายหรือสิ่งที่ต้องทำครับ');
        return;
      }
      onSaveSchedule(
        {
          title: cleanTitle,
          date: schDate || getLocalDateString(0),
          time: schTime || '09:00',
          completed: schCompleted,
        },
        target.item?.id,
      );
      onClose();
      return;
    }

    if (target.kind === 'note') {
      const cleanTitle = sanitizeSingleLine(noteTitle, 120);
      const cleanContent = sanitizeText(noteContent, 1500);
      if (!cleanTitle && !cleanContent) {
        setErrorMsg('กรุณากรอกหัวข้อหรือเนื้อหาโน้ตครับ');
        return;
      }
      const tags = noteTagsText
        .split(',')
        .map((t) => sanitizeSingleLine(t, 30).replace(/^#/, ''))
        .filter(Boolean);
      onSaveNote(
        {
          title: cleanTitle || 'บันทึกช่วยจำ',
          content: cleanContent || cleanTitle,
          tags: tags.length > 0 ? tags : ['ทั่วไป'],
        },
        target.item?.id,
      );
      onClose();
    }
  };

  const modalTitle =
    target.kind === 'transaction'
      ? target.mode === 'edit'
        ? 'แก้ไขรายการการเงิน'
        : 'เพิ่มรายการการเงิน'
      : target.kind === 'schedule'
        ? target.mode === 'edit'
          ? 'แก้ไขตารางเวลา'
          : 'เพิ่มนัดหมายใหม่'
        : target.mode === 'edit'
          ? 'แก้ไขโน้ต'
          : 'จดโน้ตใหม่';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#2F2019]/40 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-[#EAE0D5] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAE0D5]">
          <h2 id="modal-title" className="text-base font-semibold text-[#2F2019]">
            {modalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#7A6356] hover:text-[#5C4033] hover:bg-[#FAF7F2] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {target.kind === 'transaction' && (
            <>
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg">
                <button
                  type="button"
                  onClick={() => setTxType('expense')}
                  className={`py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    txType === 'expense'
                      ? 'bg-[#5C4033] text-white shadow-xs'
                      : 'text-[#7A6356] hover:text-[#2F2019]'
                  }`}
                >
                  รายจ่าย
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('income')}
                  className={`py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    txType === 'income'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-[#7A6356] hover:text-[#2F2019]'
                  }`}
                >
                  รายรับ
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#7A6356] mb-1">รายการ</label>
                <input
                  type="text"
                  value={txTitle}
                  onChange={(e) => setTxTitle(e.target.value)}
                  placeholder="เช่น ก๋วยเตี๋ยว, ค่ารถไฟฟ้า"
                  className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg text-[#2F2019] focus:outline-none focus:border-[#5C4033] focus:bg-white"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#7A6356] mb-1">
                    จำนวนเงิน (บาท)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg text-[#2F2019] focus:outline-none focus:border-[#5C4033] focus:bg-white"
                  />
                </div>

                {txType === 'expense' && (
                  <div>
                    <label className="block text-xs font-medium text-[#7A6356] mb-1">
                      หมวดหมู่
                    </label>
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value as ExpenseCategory)}
                      className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg text-[#2F2019] focus:outline-none focus:border-[#5C4033] focus:bg-white"
                    >
                      {EXPENSE_CATS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#7A6356] mb-1">วันที่</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg text-[#2F2019] focus:outline-none focus:border-[#5C4033] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A6356] mb-1">เวลา</label>
                  <input
                    type="time"
                    value={txTime}
                    onChange={(e) => setTxTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg text-[#2F2019] focus:outline-none focus:border-[#5C4033] focus:bg-white"
                  />
                </div>
              </div>
            </>
          )}

          {target.kind === 'schedule' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#7A6356] mb-1">
                  นัดหมาย / สิ่งที่ต้องทำ
                </label>
                <input
                  type="text"
                  value={schTitle}
                  onChange={(e) => setSchTitle(e.target.value)}
                  placeholder="เช่น ส่งงาน, ประชุมทีม"
                  className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg text-[#2F2019] focus:outline-none focus:border-[#5C4033] focus:bg-white"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#7A6356] mb-1">วันที่</label>
                  <input
                    type="date"
                    value={schDate}
                    onChange={(e) => setSchDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg text-[#2F2019] focus:outline-none focus:border-[#5C4033] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A6356] mb-1">เวลา</label>
                  <input
                    type="time"
                    value={schTime}
                    onChange={(e) => setSchTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg text-[#2F2019] focus:outline-none focus:border-[#5C4033] focus:bg-white"
                  />
                </div>
              </div>

              {target.mode === 'edit' && (
                <label className="flex items-center gap-2 text-sm text-[#2F2019] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schCompleted}
                    onChange={(e) => setSchCompleted(e.target.checked)}
                    className="w-4 h-4 accent-[#5C4033] rounded"
                  />
                  <span>ทำเสร็จแล้ว</span>
                </label>
              )}
            </>
          )}

          {target.kind === 'note' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#7A6356] mb-1">หัวข้อโน้ต</label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="เช่น ของที่ต้องซื้อ"
                  className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg text-[#2F2019] focus:outline-none focus:border-[#5C4033] focus:bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#7A6356] mb-1">เนื้อหา</label>
                <textarea
                  rows={4}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="พิมพ์ข้อความที่ต้องการจดจำ..."
                  className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg text-[#2F2019] focus:outline-none focus:border-[#5C4033] focus:bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#7A6356] mb-1">
                  แท็ก (คั่นด้วยเครื่องหมายจุลภาค ,)
                </label>
                <input
                  type="text"
                  value={noteTagsText}
                  onChange={(e) => setNoteTagsText(e.target.value)}
                  placeholder="เช่น ซื้อของ, งาน, ไอเดีย"
                  className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg text-[#2F2019] focus:outline-none focus:border-[#5C4033] focus:bg-white"
                />
              </div>
            </>
          )}

          {errorMsg && (
            <p className="text-xs text-rose-700 bg-rose-50 px-3 py-2 rounded-lg">{errorMsg}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#7A6356] hover:bg-[#FAF7F2] rounded-lg transition-colors min-h-[40px] cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-[#5C4033] hover:bg-[#4A3228] rounded-lg transition-colors min-h-[40px] cursor-pointer"
            >
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { CalendarDays, Check, Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { ScheduleItem } from '../types';
import { formatThaiDateFull } from '../utils/dateFormat';

interface ScheduleDashboardProps {
  schedules: ScheduleItem[];
  onToggle: (id: string) => void;
  onAdd: () => void;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
}

type StatusFilter = 'all' | 'pending' | 'done';

export function ScheduleDashboard({
  schedules,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
}: ScheduleDashboardProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');

  const counts = useMemo(() => {
    const done = schedules.filter((s) => s.completed).length;
    return {
      all: schedules.length,
      pending: schedules.length - done,
      done,
    };
  }, [schedules]);

  const groupedByDate = useMemo(() => {
    const filtered = schedules
      .filter((item) => {
        if (filter === 'pending') return !item.completed;
        if (filter === 'done') return item.completed;
        return true;
      })
      .slice()
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

    const groups: Array<{ date: string; items: ScheduleItem[] }> = [];
    for (const item of filtered) {
      const existing = groups.find((g) => g.date === item.date);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ date: item.date, items: [item] });
      }
    }
    return groups;
  }, [schedules, filter]);

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="bg-white border border-[#DFD1C2] rounded-xl p-4 shadow-sm shadow-[#5C4033]/10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#2F2019]">ตารางเวลาและสิ่งที่ต้องทำ</h2>
          <p className="text-xs text-[#7A6356] mt-0.5">
            ค้างทำ{' '}
            <span className="font-mono tabular-nums font-semibold text-[#C86432]">
              {counts.pending}
            </span>{' '}
            รายการ
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            เสร็จแล้ว{' '}
            <span className="font-mono tabular-nums text-[#4A7842] font-semibold">
              {counts.done}
            </span>{' '}
            รายการ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#FAF7F2] border border-[#DFD1C2] rounded-lg">
            {(
              [
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'pending', label: 'ที่ต้องทำ' },
                { id: 'done', label: 'เสร็จแล้ว' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === tab.id
                    ? 'bg-gradient-to-r from-[#7A543E] to-[#5C4033] text-white shadow-xs shadow-[#5C4033]/20'
                    : 'text-[#7A6356] hover:text-[#2F2019]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-[#7A543E] to-[#5C4033] hover:from-[#6A4834] hover:to-[#4A3228] rounded-lg shadow-sm shadow-[#5C4033]/20 transition-all whitespace-nowrap shrink-0 min-h-[36px] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มนัดหมาย</span>
          </button>
        </div>
      </div>

      {/* Schedule Groups */}
      {groupedByDate.length === 0 ? (
        <div className="bg-white border border-[#DFD1C2] rounded-xl py-14 px-4 text-center shadow-sm shadow-[#5C4033]/10">
          <CalendarDays className="w-8 h-8 text-[#C8A27C] mx-auto mb-2.5" />
          <p className="text-sm font-medium text-[#2F2019]">
            {filter === 'done'
              ? 'ยังไม่มีรายการที่ทำเสร็จแล้วค่ะ'
              : 'ไม่มีนัดหมายหรือสิ่งที่ต้องทำในตอนนี้ค่ะ'}
          </p>
          <p className="text-xs text-[#7A6356] mt-1">
            พิมพ์บอกน้อนอากิ้ในแชท เช่น &ldquo;พรุ่งนี้ 10 โมงมีส่งงาน&rdquo; ได้เลยน้า~
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map((group) => (
            <div
              key={group.date}
              className="bg-white border border-[#DFD1C2] rounded-xl overflow-hidden shadow-sm shadow-[#5C4033]/10"
            >
              <div className="px-4 sm:px-5 py-2.5 bg-[#FAF7F2] border-b border-[#DFD1C2] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#5C4033]">
                  {formatThaiDateFull(group.date)}
                </span>
                <span className="text-xs text-[#9A8172] font-mono tabular-nums">
                  {group.items.length} รายการ
                </span>
              </div>

              <ul className="divide-y divide-[#EFE5DA]">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 px-3 sm:px-4 py-3 hover:bg-[#FAF7F2]/60 transition-colors"
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onToggle(item.id)}
                        aria-label={
                          item.completed
                            ? `ยกเลิกเครื่องหมายเสร็จสิ้น ${item.title}`
                            : `ทำเครื่องหมายเสร็จสิ้น ${item.title}`
                        }
                        className="min-w-[44px] min-h-[44px] -my-1.5 flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            item.completed
                              ? 'bg-[#4A7842] border-[#4A7842] text-white shadow-xs shadow-[#4A7842]/25'
                              : 'border-[#C8A27C] bg-white hover:border-[#5C4033]'
                          }`}
                        >
                          {item.completed && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                        </span>
                      </button>

                      <div className="min-w-0 py-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums font-medium text-[#5C4033]">
                            <Clock className="w-3 h-3 text-[#C8A27C]" />
                            {item.time} น.
                          </span>
                          <span
                            className={`text-sm font-medium transition-colors ${
                              item.completed ? 'line-through text-[#9A8172]' : 'text-[#2F2019]'
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>
                        {item.note && (
                          <p
                            className={`text-xs mt-1 leading-relaxed ${
                              item.completed ? 'text-[#9A8172]' : 'text-[#7A6356]'
                            }`}
                          >
                            {item.note}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        aria-label={`แก้ไข ${item.title}`}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#9A8172] hover:text-[#5C4033] hover:bg-[#FAF7F2] rounded-lg transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        aria-label={`ลบ ${item.title}`}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#9A8172] hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

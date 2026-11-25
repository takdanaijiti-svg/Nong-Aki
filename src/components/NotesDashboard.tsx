import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, StickyNote, Trash2, X } from 'lucide-react';
import { NoteItem } from '../types';
import { formatThaiDate } from '../utils/dateFormat';

interface NotesDashboardProps {
  notes: NoteItem[];
  onAdd: () => void;
  onEdit: (item: NoteItem) => void;
  onDelete: (id: string) => void;
}

export function NotesDashboard({ notes, onAdd, onEdit, onDelete }: NotesDashboardProps) {
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ทั้งหมด');

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const n of notes) {
      for (const t of n.tags) {
        if (t.trim()) tagSet.add(t.trim());
      }
    }
    return ['ทั้งหมด', ...Array.from(tagSet)];
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes
      .filter((note) => {
        const matchesTag = selectedTag === 'ทั้งหมด' || note.tags.includes(selectedTag);
        if (!matchesTag) return false;
        if (!q) return true;
        return (
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q) ||
          note.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [notes, search, selectedTag]);

  return (
    <div className="space-y-5">
      {/* Search & Filter Header */}
      <div className="bg-white border border-[#EAE0D5] rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-[#9A8172] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาโน้ตหรือแท็ก..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-[#FAF7F2] border border-[#EAE0D5] rounded-lg text-[#2F2019] placeholder:text-[#9A8172] focus:outline-none focus:border-[#5C4033] focus:bg-white transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="ล้างคำค้นหา"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9A8172] hover:text-[#5C4033] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#5C4033] hover:bg-[#4A3228] rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>จดโน้ตใหม่</span>
          </button>
        </div>

        {/* Interactive Tag Filter Controls */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedTag === tag
                  ? 'bg-[#5C4033] text-white'
                  : 'bg-[#FAF7F2] border border-[#EAE0D5] text-[#7A6356] hover:bg-[#F5ECE3] hover:text-[#2F2019]'
              }`}
            >
              {tag === 'ทั้งหมด' ? 'ทั้งหมด' : `#${tag}`}
            </button>
          ))}
        </div>
      </div>

      {/* Notes Card Grid */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white border border-[#EAE0D5] rounded-xl py-14 px-4 text-center">
          <StickyNote className="w-8 h-8 text-[#C8A27C] mx-auto mb-2.5" />
          <p className="text-sm font-medium text-[#2F2019]">ไม่พบบันทึกช่วยจำที่ตรงกับการค้นหาครับ</p>
          <p className="text-xs text-[#7A6356] mt-1">
            ลองพิมพ์บอกน้อนอากิ้ในแชท เช่น &ldquo;อย่าลืมซื้อน้ำยาล้างจาน&rdquo; หรือเพิ่มโน้ตใหม่ด้านบนได้เลยน้า
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredNotes.map((note) => {
            const dateStr = note.createdAt.slice(0, 10);
            return (
              <article
                key={note.id}
                className="bg-white border border-[#EAE0D5] rounded-xl p-4 flex flex-col justify-between gap-4 hover:border-[#C8A27C] transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#2F2019] leading-snug">
                      {note.title}
                    </h3>
                    <div className="flex items-center gap-0.5 shrink-0 -mt-1 -mr-1">
                      <button
                        type="button"
                        onClick={() => onEdit(note)}
                        aria-label={`แก้ไขโน้ต ${note.title}`}
                        className="min-h-[34px] min-w-[34px] flex items-center justify-center text-[#9A8172] hover:text-[#5C4033] hover:bg-[#FAF7F2] rounded-lg transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(note.id)}
                        aria-label={`ลบโน้ต ${note.title}`}
                        className="min-h-[34px] min-w-[34px] flex items-center justify-center text-[#9A8172] hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-[#5C473C] leading-relaxed whitespace-pre-line">
                    {note.content}
                  </p>
                </div>

                {/* Unboxed metadata footer */}
                <div className="pt-3 border-t border-[#F2EAE1] flex items-center justify-between gap-2 text-xs text-[#9A8172]">
                  <span className="truncate">
                    {note.tags.length > 0
                      ? note.tags.map((t) => `#${t}`).join(' · ')
                      : 'ไม่มีแท็ก'}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums">
                    {formatThaiDate(dateStr)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
